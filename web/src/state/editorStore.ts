import { create } from "zustand";
import type { TalentRenderMode } from "@/utils/talents/types";
import type { ConditionOverrides } from "@/utils/conditions/types";
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
import {
  catalogLoader,
  decodeSelections,
  prefetchCatalogsFor,
  selectionsEqual,
  semanticCatalogLoader,
} from "./talent-catalog-coordinator";
import {
  readStoredAplAutoSave,
  readStoredAplLibrary,
  readStoredConditionOverrides,
  readStoredTalentRenderMode,
  type StoredApl,
  writeStoredAplAutoSave,
  writeStoredTalentRenderMode,
} from "./storage";

export {
  APL_AUTO_SAVE_STORAGE_KEY,
  ACTIVE_APL_ID_STORAGE_KEY,
  APL_LIBRARY_STORAGE_KEY,
  APL_STORAGE_KEY,
  CONDITION_OVERRIDES_STORAGE_KEY,
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
  toggleActionCollapse: (actionId: string) => void;
  toggleBlockCollapse: (blockId: string) => void;
  toggleAllBlocksCollapse: () => void;
  setTalentRenderMode: (mode: TalentRenderMode) => void;
  setConditionOverrides: (overrides: ConditionOverrides) => void;
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
  | "toggleActionCollapse"
  | "toggleBlockCollapse"
  | "toggleAllBlocksCollapse"
  | "setTalentRenderMode"
  | "setConditionOverrides"
  | "requestGraphJumpToNode"
  | "requestGraphJump"
  | "clearGraphJumpTarget";

function buildRuntimeStateForAplWithOverrideMigration(
  aplText: string,
  lastGoodText: string,
  talentRenderMode: TalentRenderMode,
  conditionOverrides: ConditionOverrides,
): RuntimeEditorState {
  const runtime = buildRuntimeStateForApl(
    aplText,
    lastGoodText,
    talentRenderMode,
    conditionOverrides,
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
  );
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
    const rebuilt = rebuildGraph(state.document, {
      collapsedBlocks: state.collapsedBlocks,
      collapsedActions: state.collapsedActions,
      talentRenderMode: state.talentRenderMode,
      talentSelectionsByProfile: state.talentSelectionsByProfile,
      conditionOverrides: state.conditionOverrides,
    });
    set({
      ...rebuilt,
      diagnostics: [...syntaxDiagnostics, ...semanticDiagnostics],
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
          const nextState = {
            aplText: text,
            ...derived,
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
          ),
        );
        const nextState = {
          aplText: text,
          ...rebuilt,
          talentSelectionsByProfile: nextSelections,
          conditionOverrides: nextConditionOverrides,
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
        const graph = rebuildGraph(state.document, {
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: state.collapsedActions,
          talentRenderMode: state.talentRenderMode,
          talentSelectionsByProfile: state.talentSelectionsByProfile,
          conditionOverrides: nextOverrides,
        });
        return { conditionOverrides: nextOverrides, ...graph };
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

