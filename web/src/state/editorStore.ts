import type { Edge } from "@xyflow/react";
import { create } from "zustand";
import type { AplDocument } from "@/utils/apl-parser/document";
import type { GraphFlowNode } from "@components/nodes/types";
import {
  decodeDocumentTalents,
  makeProfileCatalogLookup,
  type ProfileCatalogLookup,
} from "@/utils/talents/decode-export";
import { catalogLoader } from "@/utils/talents/catalog-loader-browser";
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";
import type { ConditionOverrides } from "@/utils/conditions/types";
import {
  getBlockActionIds,
  getDocumentBlockIds,
} from "./document-ids";
import {
  buildDerivedState,
  deriveStateFromText,
  getEmptyDerivedState,
  rebuildGraph,
  type DerivedEditorState,
} from "./derivation";
import {
  APL_STORAGE_KEY,
  LAST_GOOD_APL_STORAGE_KEY,
  readStoredConditionOverrides,
  readStoredTalentRenderMode,
  readStoredText,
  writeStoredConditionOverrides,
  writeStoredTalentRenderMode,
} from "./storage";

export {
  APL_STORAGE_KEY,
  CONDITION_OVERRIDES_STORAGE_KEY,
  LAST_GOOD_APL_STORAGE_KEY,
  TALENT_RENDER_MODE_STORAGE_KEY,
} from "./storage";

const EMPTY_SELECTIONS: ReadonlyMap<number, TalentSelectionResult> = new Map();

const resolveCatalogForProfile: ProfileCatalogLookup =
  makeProfileCatalogLookup(catalogLoader);

/**
 * Kick off catalog fetches for every distinct class referenced by the
 * document. The loader dedupes, so calling this on every document
 * change is cheap. We do not await: the store reacts to catalog
 * arrivals via the `onLoaded` subscription below.
 */
function prefetchCatalogsFor(document: AplDocument | null): void {
  if (!document) return;
  const seen = new Set<string>();
  for (const profile of document.profiles) {
    const slug = profile.className;
    if (!slug || slug === "unknown" || seen.has(slug)) continue;
    seen.add(slug);
    void catalogLoader.ensure(slug);
  }
}

interface EditorState {
  aplText: string;
  lastGoodText: string;
  parseError: string | null;
  parseErrorLineNumber: number | null;
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
  collapsedActions: Set<string>;
  nodes: GraphFlowNode[];
  edges: Edge[];
  talentRenderMode: TalentRenderMode;
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>;
  talentSummary: TalentRenderSummary | null;
  conditionOverrides: ConditionOverrides;
  graphJumpTarget: { actionId: string; nonce: number } | null;
  applyAplText: (text: string) => void;
  toggleActionCollapse: (actionId: string) => void;
  toggleBlockCollapse: (blockId: string) => void;
  toggleAllBlocksCollapse: () => void;
  setTalentRenderMode: (mode: TalentRenderMode) => void;
  setConditionOverrides: (overrides: ConditionOverrides) => void;
  requestGraphJump: (actionId: string) => void;
  clearGraphJumpTarget: () => void;
}

function decodeSelections(
  document: AplDocument | null,
): ReadonlyMap<number, TalentSelectionResult> {
  return document
    ? decodeDocumentTalents(document, resolveCatalogForProfile)
    : EMPTY_SELECTIONS;
}

/**
 * Picks up where the user left off by reading localStorage.
 *
 * 1. Their text still works -> show it
 * 2. Their text is broken, but we kept a backup that works -> show the backup graph + the error
 * 3. Nothing works -> blank canvas + the error
 *
 * The talent render mode is read independently so a corrupted APL never
 * resets the user's preferred mode.
 */
function getInitialEditorState(): Omit<
  EditorState,
  | "applyAplText"
  | "toggleActionCollapse"
  | "toggleBlockCollapse"
  | "toggleAllBlocksCollapse"
  | "setTalentRenderMode"
  | "setConditionOverrides"
  | "requestGraphJump"
  | "clearGraphJumpTarget"
> {
  const aplText = readStoredText(APL_STORAGE_KEY);
  const lastGoodText = readStoredText(LAST_GOOD_APL_STORAGE_KEY);
  const talentRenderMode = readStoredTalentRenderMode();
  const conditionOverrides = readStoredConditionOverrides();
  const collapsedBlocks = new Set<string>();
  const collapsedActions = new Set<string>();

  const initialFallback = getEmptyDerivedState(lastGoodText);
  const initialState = deriveStateFromText(
    aplText,
    initialFallback,
    collapsedBlocks,
    collapsedActions,
    talentRenderMode,
    EMPTY_SELECTIONS,
    conditionOverrides,
  );

  // The decoder runs against the document we actually keep, so we resolve it
  // after the initial parse. This avoids an extra parse when the text is
  // empty or malformed.
  const initialSelections = decodeSelections(initialState.document);
  const initialDerived = initialState.document
    ? buildDerivedState(
        initialState.lastGoodText,
        initialState.document,
        collapsedBlocks,
        collapsedActions,
        talentRenderMode,
        initialSelections,
        conditionOverrides,
      )
    : initialState;

  if (!initialDerived.parseError || !lastGoodText) {
    return {
      aplText,
      ...initialDerived,
      talentRenderMode,
      talentSelectionsByProfile: initialSelections,
      conditionOverrides,
      graphJumpTarget: null,
    };
  }

  const fallbackState = deriveStateFromText(
    lastGoodText,
    initialFallback,
    collapsedBlocks,
    collapsedActions,
    talentRenderMode,
    EMPTY_SELECTIONS,
    conditionOverrides,
  );
  if (fallbackState.parseError) {
    return {
      aplText,
      ...initialDerived,
      talentRenderMode,
      talentSelectionsByProfile: initialSelections,
      conditionOverrides,
      graphJumpTarget: null,
    };
  }

  const fallbackSelections = decodeSelections(fallbackState.document);
  const fallbackDerived = fallbackState.document
    ? buildDerivedState(
        fallbackState.lastGoodText,
        fallbackState.document,
        collapsedBlocks,
        collapsedActions,
        talentRenderMode,
        fallbackSelections,
        conditionOverrides,
      )
    : fallbackState;

  return {
    aplText,
    ...fallbackDerived,
    lastGoodText,
    parseError: initialDerived.parseError,
    parseErrorLineNumber: initialDerived.parseErrorLineNumber,
    talentRenderMode,
    talentSelectionsByProfile: fallbackSelections,
    conditionOverrides,
    graphJumpTarget: null,
  };
}

function snapshotFallback(state: EditorState): DerivedEditorState {
  return {
    lastGoodText: state.lastGoodText,
    parseError: state.parseError,
    parseErrorLineNumber: state.parseErrorLineNumber,
    document: state.document,
    collapsedBlocks: state.collapsedBlocks,
    collapsedActions: state.collapsedActions,
    nodes: state.nodes,
    edges: state.edges,
    talentSummary: state.talentSummary,
  };
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initial = getInitialEditorState();
  prefetchCatalogsFor(initial.document);

  // When a class catalog finishes loading, re-decode every profile so
  // `loading` statuses resolve to their real outcome and the graph
  // rebuilds with the new selections. We only rebuild when the decode
  // result actually changes, to avoid a useless re-render loop if a
  // fetch resolves to `null` (unknown class) for a document that had
  // already rendered with `loading` safely.
  catalogLoader.onLoaded(() => {
    const state = get();
    if (!state.document) return;
    const nextSelections = decodeSelections(state.document);
    if (selectionsEqual(state.talentSelectionsByProfile, nextSelections)) {
      return;
    }
    const rebuilt = rebuildGraph(state.document, {
      collapsedBlocks: state.collapsedBlocks,
      collapsedActions: state.collapsedActions,
      talentRenderMode: state.talentRenderMode,
      talentSelectionsByProfile: nextSelections,
      conditionOverrides: state.conditionOverrides,
    });
    set({
      ...rebuilt,
      talentSelectionsByProfile: nextSelections,
    });
  });

  return {
    ...initial,
    applyAplText: (text) => {
      set((state) => {
        const derived = deriveStateFromText(
          text,
          snapshotFallback(state),
          state.collapsedBlocks,
          state.collapsedActions,
          state.talentRenderMode,
          // Use stale selections during the parse pass so a malformed edit does
          // not blow away the panel. We re-decode + re-build below if the parse
          // produced a fresh document.
          state.talentSelectionsByProfile,
          state.conditionOverrides,
        );

        if (!derived.document || derived.document === state.document) {
          return { aplText: text, ...derived };
        }

        prefetchCatalogsFor(derived.document);
        const nextSelections = decodeSelections(derived.document);
        const rebuilt = buildDerivedState(
          derived.lastGoodText,
          derived.document,
          derived.collapsedBlocks,
          derived.collapsedActions,
          state.talentRenderMode,
          nextSelections,
          state.conditionOverrides,
        );
        return {
          aplText: text,
          ...rebuilt,
          talentSelectionsByProfile: nextSelections,
        };
      });
    },
    toggleActionCollapse: (actionId) => {
      set((state) => {
        const collapsedActions = new Set(state.collapsedActions);
        if (collapsedActions.has(actionId)) {
          collapsedActions.delete(actionId);
        } else {
          collapsedActions.add(actionId);
        }

        if (!state.document) {
          return { collapsedActions };
        }

        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: state.conditionOverrides,
        });
        return { collapsedActions, ...graph };
      });
    },
    toggleBlockCollapse: (blockId) => {
      set((state) => {
        const collapsedBlocks = new Set(state.collapsedBlocks);
        const isExpandingBlock = collapsedBlocks.has(blockId);
        if (isExpandingBlock) {
          collapsedBlocks.delete(blockId);
        } else {
          collapsedBlocks.add(blockId);
        }

        if (!state.document) {
          return { collapsedBlocks };
        }

        const collapsedActions = isExpandingBlock
          ? new Set(state.collapsedActions)
          : state.collapsedActions;
        if (isExpandingBlock) {
          for (const actionId of getBlockActionIds(state.document, blockId)) {
            collapsedActions.delete(actionId);
          }
        }

        const graph = rebuildGraph(state.document, {
          collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: state.conditionOverrides,
        });
        return { collapsedBlocks, collapsedActions, ...graph };
      });
    },
    toggleAllBlocksCollapse: () => {
      set((state) => {
        if (!state.document) {
          return {};
        }

        const blockIds = getDocumentBlockIds(state.document);
        const shouldExpandAll =
          blockIds.size > 0 &&
          Array.from(blockIds).every((blockId) =>
            state.collapsedBlocks.has(blockId),
          );
        const collapsedBlocks = shouldExpandAll
          ? new Set<string>()
          : new Set(blockIds);
        const collapsedActions = shouldExpandAll
          ? new Set<string>()
          : state.collapsedActions;
        const graph = rebuildGraph(state.document, {
          collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: state.conditionOverrides,
        });
        return { collapsedBlocks, collapsedActions, ...graph };
      });
    },
    setTalentRenderMode: (mode) => {
      writeStoredTalentRenderMode(mode);
      set((state) => {
        if (state.talentRenderMode === mode) {
          return {};
        }
        if (!state.document) {
          return { talentRenderMode: mode };
        }
        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: state.collapsedActions,
          talentRenderMode: mode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: state.conditionOverrides,
        });
        return { talentRenderMode: mode, ...graph };
      });
    },
    setConditionOverrides: (overrides) => {
      writeStoredConditionOverrides(overrides);
      set((state) => {
        if (state.conditionOverrides === overrides) {
          return {};
        }
        if (!state.document) {
          return { conditionOverrides: overrides };
        }
        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: state.collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: overrides,
        });
        return { conditionOverrides: overrides, ...graph };
      });
    },
    requestGraphJump: (actionId) => {
      set((state) => ({
        graphJumpTarget: {
          actionId,
          nonce: (state.graphJumpTarget?.nonce ?? 0) + 1,
        },
      }));
    },
    clearGraphJumpTarget: () => {
      set({ graphJumpTarget: null });
    },
  };
});

/**
 * Structural equality for the per-profile selection map. Catalog
 * arrivals can resolve to the same value the store already held (e.g.
 * `missing_catalog` stays `missing_catalog` when a fetch returns
 * `null`), and rebuilding the graph in that case would be pure waste.
 */
function selectionsEqual(
  a: ReadonlyMap<number, TalentSelectionResult>,
  b: ReadonlyMap<number, TalentSelectionResult>,
): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [index, left] of a) {
    const right = b.get(index);
    if (!right) return false;
    if (left.status.kind !== right.status.kind) return false;
    const leftKeys = Object.keys(left.selections);
    const rightKeys = Object.keys(right.selections);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (left.selections[key] !== right.selections[key]) return false;
    }
  }
  return true;
}
