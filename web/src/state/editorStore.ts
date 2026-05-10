import { create } from "zustand";
import type { TalentRenderMode } from "@/utils/talents/types";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "@/utils/conditions/types";
import { validateDocumentSemantics } from "@/utils/semantics/validate";
import {
  createAplId,
  getAplDisplayName,
  getUniqueAplName,
  hasUnsavedAplChanges,
  persistAplLibrary,
  saveDraftToLibrary,
  updateStoredApl,
} from "./apl-library-manager";
import {
  buildRuntimeStateForApl,
  snapshotFallback,
  withSemanticDiagnostics,
  type RuntimeEditorState,
} from "./apl-runtime-builder";
import {
  migrateStoredOverridesForDocument,
  prepareConditionOverridesForDocument,
} from "./condition-override-coordinator";
import {
  getBlockActionIds,
  getDocumentBlockIds,
} from "./document-ids";
import {
  buildDerivedState,
  deriveStateFromText,
  rebuildGraph,
} from "./derivation";
import { getActionIdsForcedOffByOverride } from "@/utils/filters/compute-impossible-set";
import {
  catalogLoader,
  decodeSelections,
  lookupLoadedSemanticCatalogs,
  prefetchCatalogsFor,
  selectionsEqual,
  semanticCatalogLoader,
} from "./talent-catalog-coordinator";
import { ForcedOverrideCollapseCoordinator } from "./forced-override-collapse-coordinator";
import {
  readStoredAplAutoSave,
  readStoredAplLibrary,
  readStoredConditionOverrides,
  readStoredConditionOverridesEnabled,
  readStoredTalentRenderMode,
  type StoredApl,
  writeStoredAplAutoSave,
  writeStoredConditionOverridesEnabled,
  writeStoredTalentRenderMode,
} from "./storage";

export {
  APL_AUTO_SAVE_STORAGE_KEY,
  ACTIVE_APL_ID_STORAGE_KEY,
  APL_LIBRARY_STORAGE_KEY,
  APL_STORAGE_KEY,
  CONDITION_OVERRIDES_STORAGE_KEY,
  CONDITION_OVERRIDES_ENABLED_STORAGE_KEY,
  LAST_GOOD_APL_STORAGE_KEY,
  TALENT_RENDER_MODE_STORAGE_KEY,
} from "./storage";

interface EditorState extends RuntimeEditorState {
  savedApls: StoredApl[];
  activeAplId: string;
  draftAplName: string;
  autoSaveEnabled: boolean;
  hasUnsavedChanges: boolean;
  applyAplText: (text: string) => void;
  saveActiveApl: () => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  switchApl: (aplId: string) => void;
  createApl: () => void;
  duplicateApl: (aplId: string) => void;
  renameApl: (aplId: string, name: string) => void;
  deleteApl: (aplId: string) => void;
  buildGraphCache: () => void;
  toggleActionCollapse: (actionId: string) => void;
  toggleBlockCollapse: (blockId: string) => void;
  toggleAllBlocksCollapse: () => void;
  setTalentRenderMode: (mode: TalentRenderMode) => void;
  setConditionOverrides: (overrides: ConditionOverrides) => void;
  setConditionOverridesEnabled: (enabled: boolean) => void;
  requestGraphJumpToNode: (nodeId: string) => void;
  requestGraphJump: (actionId: string) => void;
  clearGraphJumpTarget: () => void;
}

type EditorActions =
  | "applyAplText"
  | "saveActiveApl"
  | "setAutoSaveEnabled"
  | "switchApl"
  | "createApl"
  | "duplicateApl"
  | "renameApl"
  | "deleteApl"
  | "buildGraphCache"
  | "toggleActionCollapse"
  | "toggleBlockCollapse"
  | "toggleAllBlocksCollapse"
  | "setTalentRenderMode"
  | "setConditionOverrides"
  | "setConditionOverridesEnabled"
  | "requestGraphJumpToNode"
  | "requestGraphJump"
  | "clearGraphJumpTarget";

function buildRuntimeStateForAplWithOverrideMigration(
  aplText: string,
  lastGoodText: string,
  talentRenderMode: TalentRenderMode,
  conditionOverrides: ConditionOverrides,
  conditionOverridesEnabled: boolean,
): RuntimeEditorState {
  const runtime = buildRuntimeStateForApl(
    aplText,
    lastGoodText,
    talentRenderMode,
    conditionOverrides,
    conditionOverridesEnabled,
  );
  const migratedOverrides = migrateStoredOverridesForDocument(
    conditionOverrides,
    runtime.document,
  );
  if (migratedOverrides === conditionOverrides) {
    return runtime;
  }
  return buildRuntimeStateForApl(
    aplText,
    lastGoodText,
    talentRenderMode,
    migratedOverrides,
    conditionOverridesEnabled,
  );
}

/**
 * Single source of truth for "what overrides actually feed the graph?". When
 * the user has toggled overrides off, every consumer (rebuildGraph,
 * forced-collapse coordinator, semantic catalog lookup) reads `EMPTY_…`
 * here while the configured `conditionOverrides` stay untouched in state
 * for the moment they flip back on.
 */
function effectiveConditionOverrides<S extends Pick<EditorState, "conditionOverrides" | "conditionOverridesEnabled">>(
  state: S,
): ConditionOverrides {
  return state.conditionOverridesEnabled
    ? state.conditionOverrides
    : EMPTY_CONDITION_OVERRIDES;
}

const INITIAL_AUTO_COLLAPSE_ACTION_THRESHOLD = 160;

function countDocumentActions(document: NonNullable<RuntimeEditorState["document"]>): number {
  return document.profiles.reduce(
    (profileTotal, profile) =>
      profileTotal +
      profile.blocks.reduce(
        (blockTotal, block) => blockTotal + block.actions.length,
        0,
      ),
    0,
  );
}

function shouldAutoCollapseInitialGraph(
  document: NonNullable<RuntimeEditorState["document"]>,
): boolean {
  return countDocumentActions(document) >= INITIAL_AUTO_COLLAPSE_ACTION_THRESHOLD;
}

function mergeForcedOverrideCollapse(
  state: Pick<
    EditorState,
    | "document"
    | "collapsedActions"
    | "lastForcedOffByOverrideActionIds"
    | "userExpandedForcedOffActionIds"
    | "talentSelectionsByProfile"
    | "conditionOverrides"
  >,
  conditionOverrides: ConditionOverrides,
) {
  if (!state.document) {
    return null;
  }
  return ForcedOverrideCollapseCoordinator.merge(
    state.document,
    {
      collapsedActions: state.collapsedActions,
      lastForcedOffActionIds: state.lastForcedOffByOverrideActionIds,
      userExpandedForcedOffActionIds: state.userExpandedForcedOffActionIds,
    },
    {
      talentSelectionsByProfile: state.talentSelectionsByProfile,
      conditionOverrides,
      semanticCatalogsByProfile: lookupLoadedSemanticCatalogs(state.document),
    },
  );
}

function markGraphStale(
  state: EditorState,
  document: RuntimeEditorState["document"],
): Pick<
  RuntimeEditorState,
  | "nodes"
  | "edges"
  | "talentSummary"
  | "graphBuildStatus"
  | "graphBuildVersion"
  | "graphBuiltVersion"
> {
  const nextVersion = state.graphBuildVersion + 1;
  return {
    nodes: [],
    edges: [],
    talentSummary: null,
    graphBuildStatus: document ? "stale" : "ready",
    graphBuildVersion: nextVersion,
    graphBuiltVersion: document ? state.graphBuiltVersion : nextVersion,
  };
}

/**
 * Picks up where the user left off by reading the saved APL library from
 * localStorage. The talent render mode remains global, so a corrupted APL
 * never resets the user's preferred preview mode.
 */
function getInitialEditorState(): Omit<EditorState, EditorActions> {
  const library = readStoredAplLibrary();
  const activeApl =
    library.apls.find((apl) => apl.id === library.activeAplId) ??
    library.apls[0];
  const autoSaveEnabled = readStoredAplAutoSave();
  const talentRenderMode = readStoredTalentRenderMode();
  const conditionOverrides = readStoredConditionOverrides();
  const conditionOverridesEnabled = readStoredConditionOverridesEnabled();

  return {
    savedApls: library.apls,
    activeAplId: activeApl.id,
    draftAplName: activeApl.name,
    autoSaveEnabled,
    hasUnsavedChanges: false,
    ...buildRuntimeStateForAplWithOverrideMigration(
      activeApl.text,
      activeApl.lastGoodText,
      talentRenderMode,
      conditionOverrides,
      conditionOverridesEnabled,
    ),
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
    if (state.graphBuildStatus !== "ready") {
      set({
        talentSelectionsByProfile: nextSelections,
        graphBuildStatus: "stale",
        graphBuildVersion: state.graphBuildVersion + 1,
      });
      return;
    }
    const forced = mergeForcedOverrideCollapse(
      { ...state, talentSelectionsByProfile: nextSelections },
      effectiveConditionOverrides(state),
    )!;
    const rebuilt = rebuildGraph(state.document, {
      collapsedBlocks: state.collapsedBlocks,
      collapsedActions: forced.collapsedActions,
      talentRenderMode: state.talentRenderMode,
      talentSelectionsByProfile: nextSelections,
      conditionOverrides: effectiveConditionOverrides(state),
    });
    set({
      ...rebuilt,
      talentSelectionsByProfile: nextSelections,
      collapsedActions: forced.collapsedActions,
      lastForcedOffByOverrideActionIds: forced.lastForcedOffActionIds,
      userExpandedForcedOffActionIds: forced.userExpandedForcedOffActionIds,
      graphBuildStatus: "ready",
      graphBuildVersion: state.graphBuildVersion + 1,
      graphBuiltVersion: state.graphBuildVersion + 1,
    });
  });

  semanticCatalogLoader.onLoaded(() => {
    const state = get();
    if (!state.document || state.parseError) {
      return;
    }

    const syntaxDiagnostics = state.diagnostics.filter(
      (diagnostic) => diagnostic.code !== "semantic_warning",
    );
    const semanticDiagnostics = validateDocumentSemantics(
      state.document,
      (classSlug, specSlug) =>
        semanticCatalogLoader.lookupSpec(classSlug, specSlug),
    );
    if (state.graphBuildStatus !== "ready") {
      set({
        diagnostics: [...syntaxDiagnostics, ...semanticDiagnostics],
        graphBuildStatus: "stale",
        graphBuildVersion: state.graphBuildVersion + 1,
      });
      return;
    }
    const forced = mergeForcedOverrideCollapse(state, effectiveConditionOverrides(state))!;
    const rebuilt = rebuildGraph(state.document, {
      collapsedBlocks: state.collapsedBlocks,
      collapsedActions: forced.collapsedActions,
      talentRenderMode: state.talentRenderMode,
      talentSelectionsByProfile: state.talentSelectionsByProfile,
      conditionOverrides: effectiveConditionOverrides(state),
    });
    set({
      ...rebuilt,
      diagnostics: [...syntaxDiagnostics, ...semanticDiagnostics],
      collapsedActions: forced.collapsedActions,
      lastForcedOffByOverrideActionIds: forced.lastForcedOffActionIds,
      userExpandedForcedOffActionIds: forced.userExpandedForcedOffActionIds,
      graphBuildStatus: "ready",
      graphBuildVersion: state.graphBuildVersion + 1,
      graphBuiltVersion: state.graphBuildVersion + 1,
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
          { buildGraph: false },
        );

        if (!derived.document || derived.document === state.document) {
          const graphState =
            derived.parseError === null
              ? markGraphStale(state, derived.document)
              : {};
          const nextState = {
            aplText: text,
            ...derived,
            ...graphState,
          };
          if (!state.autoSaveEnabled) {
            return {
              ...nextState,
              hasUnsavedChanges: hasUnsavedAplChanges({
                ...state,
                aplText: text,
                lastGoodText: derived.lastGoodText,
              }),
            };
          }
          const savedApls = updateStoredApl(
            state.savedApls,
            state.activeAplId,
            {
              name: state.draftAplName,
              text,
              lastGoodText: derived.lastGoodText,
            },
          );
          persistAplLibrary(savedApls, state.activeAplId);
          return {
            savedApls,
            ...nextState,
            hasUnsavedChanges: false,
          };
        }

        prefetchCatalogsFor(derived.document);
        const nextConditionOverrides = migrateStoredOverridesForDocument(
          state.conditionOverrides,
          derived.document,
        );
        const nextSelections = decodeSelections(derived.document);
        const rebuilt = withSemanticDiagnostics(
          buildDerivedState(
            derived.lastGoodText,
            derived.document,
            derived.collapsedBlocks,
            derived.collapsedActions,
            state.talentRenderMode,
            nextSelections,
            nextConditionOverrides,
            derived.diagnostics,
            { buildGraph: false },
          ),
        );
        const nextState = {
          aplText: text,
          ...rebuilt,
          talentSelectionsByProfile: nextSelections,
          conditionOverrides: nextConditionOverrides,
          ...markGraphStale(state, rebuilt.document),
        };
        if (!state.autoSaveEnabled) {
          return {
            ...nextState,
            hasUnsavedChanges: hasUnsavedAplChanges({
              ...state,
              aplText: text,
              lastGoodText: rebuilt.lastGoodText,
            }),
          };
        }
        const savedApls = updateStoredApl(
          state.savedApls,
          state.activeAplId,
          {
            name: state.draftAplName,
            text,
            lastGoodText: rebuilt.lastGoodText,
          },
        );
        persistAplLibrary(savedApls, state.activeAplId);
        return {
          savedApls,
          ...nextState,
          hasUnsavedChanges: false,
        };
      });
    },
    saveActiveApl: () => {
      set((state) => {
        const savedApls = saveDraftToLibrary(state);
        persistAplLibrary(savedApls, state.activeAplId);
        return {
          savedApls,
          hasUnsavedChanges: false,
        };
      });
    },
    setAutoSaveEnabled: (enabled) => {
      writeStoredAplAutoSave(enabled);
      set((state) => {
        if (!enabled) {
          return { autoSaveEnabled: false };
        }
        const savedApls = saveDraftToLibrary(state);
        persistAplLibrary(savedApls, state.activeAplId);
        return {
          autoSaveEnabled: true,
          savedApls,
          hasUnsavedChanges: false,
        };
      });
    },
    switchApl: (aplId) => {
      set((state) => {
        if (aplId === state.activeAplId) {
          return {};
        }
        const nextApl = state.savedApls.find((apl) => apl.id === aplId);
        if (!nextApl) {
          return {};
        }
        const runtime = buildRuntimeStateForAplWithOverrideMigration(
          nextApl.text,
          nextApl.lastGoodText,
          state.talentRenderMode,
          state.conditionOverrides,
          state.conditionOverridesEnabled,
        );
        prefetchCatalogsFor(runtime.document);
        persistAplLibrary(state.savedApls, nextApl.id);
        return {
          activeAplId: nextApl.id,
          draftAplName: nextApl.name,
          hasUnsavedChanges: false,
          ...runtime,
        };
      });
    },
    createApl: () => {
      set((state) => {
        const nextApl: StoredApl = {
          id: createAplId(),
          name: getUniqueAplName("Untitled APL", state.savedApls),
          text: "",
          lastGoodText: "",
          updatedAt: Date.now(),
        };
        const savedApls = [...state.savedApls, nextApl];
        const runtime = buildRuntimeStateForAplWithOverrideMigration(
          nextApl.text,
          nextApl.lastGoodText,
          state.talentRenderMode,
          state.conditionOverrides,
          state.conditionOverridesEnabled,
        );
        persistAplLibrary(savedApls, nextApl.id);
        return {
          savedApls,
          activeAplId: nextApl.id,
          draftAplName: nextApl.name,
          hasUnsavedChanges: false,
          ...runtime,
        };
      });
    },
    duplicateApl: (aplId) => {
      set((state) => {
        const sourceIndex = state.savedApls.findIndex((apl) => apl.id === aplId);
        if (sourceIndex === -1) {
          return {};
        }
        const sourceApl = state.savedApls[sourceIndex];
        const isActiveApl = sourceApl.id === state.activeAplId;
        const nextApl: StoredApl = {
          id: createAplId(),
          name: getUniqueAplName(
            `${getAplDisplayName({
              name: isActiveApl ? state.draftAplName : sourceApl.name,
            })} copy`,
            state.savedApls,
          ),
          text: isActiveApl ? state.aplText : sourceApl.text,
          lastGoodText: isActiveApl
            ? state.lastGoodText
            : sourceApl.lastGoodText,
          updatedAt: Date.now(),
        };
        const savedApls = [...state.savedApls];
        savedApls.splice(sourceIndex + 1, 0, nextApl);
        persistAplLibrary(savedApls, state.activeAplId);
        return { savedApls };
      });
    },
    renameApl: (aplId, name) => {
      set((state) => {
        const nextName = name.slice(0, 80);
        const savedApls = updateStoredApl(state.savedApls, aplId, {
          name: nextName,
        });
        persistAplLibrary(savedApls, state.activeAplId);
        if (aplId !== state.activeAplId) {
          return { savedApls };
        }
        return {
          savedApls,
          draftAplName: nextName,
          hasUnsavedChanges: hasUnsavedAplChanges({
            ...state,
            savedApls,
            draftAplName: nextName,
          }),
        };
      });
    },
    deleteApl: (aplId) => {
      set((state) => {
        if (state.savedApls.length <= 1) {
          return {};
        }

        const deleteIndex = state.savedApls.findIndex((apl) => apl.id === aplId);
        if (deleteIndex === -1) {
          return {};
        }

        const nextApls = state.savedApls.filter((apl) => apl.id !== aplId);
        if (aplId !== state.activeAplId) {
          persistAplLibrary(nextApls, state.activeAplId);
          return { savedApls: nextApls };
        }

        const nextIndex = Math.min(deleteIndex, nextApls.length - 1);
        const nextApl = nextApls[nextIndex];
        const runtime = buildRuntimeStateForAplWithOverrideMigration(
          nextApl.text,
          nextApl.lastGoodText,
          state.talentRenderMode,
          state.conditionOverrides,
          state.conditionOverridesEnabled,
        );
        prefetchCatalogsFor(runtime.document);
        persistAplLibrary(nextApls, nextApl.id);
        return {
          savedApls: nextApls,
          activeAplId: nextApl.id,
          draftAplName: nextApl.name,
          hasUnsavedChanges: false,
          ...runtime,
        };
      });
    },
    buildGraphCache: () => {
      set((state) => {
        if (
          state.graphBuildStatus === "ready" &&
          state.graphBuiltVersion === state.graphBuildVersion
        ) {
          return {};
        }
        if (!state.document) {
          return {
            nodes: [],
            edges: [],
            talentSummary: null,
            graphBuildStatus: "ready",
            graphBuiltVersion: state.graphBuildVersion,
            shouldAutoCollapseOnNextGraphBuild: false,
            lastForcedOffByOverrideActionIds: new Set<string>(),
            userExpandedForcedOffActionIds: new Set<string>(),
          };
        }

        const shouldAutoCollapse =
          state.shouldAutoCollapseOnNextGraphBuild &&
          shouldAutoCollapseInitialGraph(state.document);
        const collapsedBlocks = shouldAutoCollapse
          ? getDocumentBlockIds(state.document)
          : state.collapsedBlocks;
        const forced = mergeForcedOverrideCollapse(
          state,
          effectiveConditionOverrides(state),
        )!;
        const graph = rebuildGraph(state.document, {
          collapsedBlocks,
          collapsedActions: forced.collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: effectiveConditionOverrides(state),
        });

        return {
          collapsedBlocks,
          collapsedActions: forced.collapsedActions,
          lastForcedOffByOverrideActionIds: forced.lastForcedOffActionIds,
          userExpandedForcedOffActionIds: forced.userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuiltVersion: state.graphBuildVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
      });
    },
    toggleActionCollapse: (actionId) => {
      set((state) => {
        const wasCollapsed = state.collapsedActions.has(actionId);
        const collapsedActions = new Set(state.collapsedActions);
        if (collapsedActions.has(actionId)) {
          collapsedActions.delete(actionId);
        } else {
          collapsedActions.add(actionId);
        }
        let userExpandedForcedOffActionIds = new Set(
          state.userExpandedForcedOffActionIds,
        );
        if (state.document) {
          const nextForced = getActionIdsForcedOffByOverride(state.document, {
            talentSelectionsByProfile: state.talentSelectionsByProfile,
            conditionOverrides: effectiveConditionOverrides(state),
            semanticCatalogsByProfile:
              lookupLoadedSemanticCatalogs(state.document),
          });
          if (wasCollapsed && !collapsedActions.has(actionId)) {
            if (nextForced.has(actionId)) {
              userExpandedForcedOffActionIds.add(actionId);
            }
          } else if (!wasCollapsed && collapsedActions.has(actionId)) {
            userExpandedForcedOffActionIds.delete(actionId);
          }
        }

        if (!state.document) {
          return { collapsedActions, userExpandedForcedOffActionIds };
        }

        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: effectiveConditionOverrides(state),
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          collapsedActions,
          userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
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
        let userExpandedForcedOffActionIds = new Set(
          state.userExpandedForcedOffActionIds,
        );
        if (isExpandingBlock) {
          const nextForced = getActionIdsForcedOffByOverride(state.document, {
            talentSelectionsByProfile: state.talentSelectionsByProfile,
            conditionOverrides: effectiveConditionOverrides(state),
            semanticCatalogsByProfile:
              lookupLoadedSemanticCatalogs(state.document),
          });
          for (const actionId of getBlockActionIds(state.document, blockId)) {
            collapsedActions.delete(actionId);
            if (nextForced.has(actionId)) {
              userExpandedForcedOffActionIds.add(actionId);
            }
          }
        }

        const graph = rebuildGraph(state.document, {
          collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: effectiveConditionOverrides(state),
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          collapsedBlocks,
          collapsedActions,
          userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
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
        let userExpandedForcedOffActionIds = new Set(
          state.userExpandedForcedOffActionIds,
        );
        let collapsedActions: Set<string>;
        if (shouldExpandAll) {
          collapsedActions = new Set<string>();
          const nextForced = getActionIdsForcedOffByOverride(state.document, {
            talentSelectionsByProfile: state.talentSelectionsByProfile,
            conditionOverrides: effectiveConditionOverrides(state),
            semanticCatalogsByProfile:
              lookupLoadedSemanticCatalogs(state.document),
          });
          for (const id of nextForced) {
            userExpandedForcedOffActionIds.add(id);
          }
        } else {
          collapsedActions = state.collapsedActions;
        }
        const graph = rebuildGraph(state.document, {
          collapsedBlocks,
          collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: effectiveConditionOverrides(state),
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          collapsedBlocks,
          collapsedActions,
          userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
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
          conditionOverrides: effectiveConditionOverrides(state),
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          talentRenderMode: mode,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
      });
    },
    setConditionOverrides: (overrides) => {
      set((state) => {
        const nextOverrides = prepareConditionOverridesForDocument(
          overrides,
          state.document,
        );
        if (state.conditionOverrides === nextOverrides) {
          return {};
        }
        if (!state.document) {
          return { conditionOverrides: nextOverrides };
        }
        // While overrides are toggled off, edits are still persisted to
        // state (so they survive a future re-enable) but the rebuild fed
        // to the graph treats them as empty — the graph stays "as if no
        // overrides were configured".
        const overridesForGraph = state.conditionOverridesEnabled
          ? nextOverrides
          : EMPTY_CONDITION_OVERRIDES;
        const forced = mergeForcedOverrideCollapse(
          { ...state, conditionOverrides: nextOverrides },
          overridesForGraph,
        )!;
        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: forced.collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: overridesForGraph,
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          conditionOverrides: nextOverrides,
          collapsedActions: forced.collapsedActions,
          lastForcedOffByOverrideActionIds: forced.lastForcedOffActionIds,
          userExpandedForcedOffActionIds: forced.userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
      });
    },
    setConditionOverridesEnabled: (enabled) => {
      writeStoredConditionOverridesEnabled(enabled);
      set((state) => {
        if (state.conditionOverridesEnabled === enabled) {
          return {};
        }
        if (!state.document) {
          return { conditionOverridesEnabled: enabled };
        }
        const overridesForGraph = enabled
          ? state.conditionOverrides
          : EMPTY_CONDITION_OVERRIDES;
        const forced = mergeForcedOverrideCollapse(state, overridesForGraph)!;
        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: forced.collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: overridesForGraph,
        });
        const nextVersion = state.graphBuildVersion + 1;
        return {
          conditionOverridesEnabled: enabled,
          collapsedActions: forced.collapsedActions,
          lastForcedOffByOverrideActionIds: forced.lastForcedOffActionIds,
          userExpandedForcedOffActionIds: forced.userExpandedForcedOffActionIds,
          ...graph,
          graphBuildStatus: "ready",
          graphBuildVersion: nextVersion,
          graphBuiltVersion: nextVersion,
          shouldAutoCollapseOnNextGraphBuild: false,
        };
      });
    },
    requestGraphJumpToNode: (nodeId) => {
      set((state) => ({
        graphJumpTarget: {
          nodeId,
          nonce: (state.graphJumpTarget?.nonce ?? 0) + 1,
        },
      }));
    },
    requestGraphJump: (actionId) => {
      set((state) => ({
        graphJumpTarget: {
          nodeId: actionId,
          nonce: (state.graphJumpTarget?.nonce ?? 0) + 1,
        },
      }));
    },
    clearGraphJumpTarget: () => {
      set({ graphJumpTarget: null });
    },
  };
});

