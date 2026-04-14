import type { Edge } from "@xyflow/react";
import { create } from "zustand";
import {
  buildGraph,
  getActionNodeId,
  getBlockNodeId,
} from "@/utils/apl-parser/build-graph";
import {
  parseDocument,
  type AplDocument,
  type ParseDocumentResult,
} from "@/utils/apl-parser/document";
import type { GraphFlowNode } from "@components/nodes/types";

export const APL_STORAGE_KEY = "logiccraft.aplText";
export const LAST_GOOD_APL_STORAGE_KEY = "logiccraft.lastGoodAplText";

type ParseFailure = Exclude<ParseDocumentResult, { ok: true }>;

interface EditorState {
  aplText: string;
  lastGoodText: string;
  parseError: string | null;
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
  collapsedActions: Set<string>;
  nodes: GraphFlowNode[];
  edges: Edge[];
  applyAplText: (text: string) => void;
  toggleActionCollapse: (actionId: string) => void;
  toggleBlockCollapse: (blockId: string) => void;
  toggleAllBlocksCollapse: () => void;
}

// Everything that changes when we re-parse the APL text.
// We swap all of these together like a snapshot so the UI never sees mixed state.
interface DerivedEditorState {
  lastGoodText: string;
  parseError: string | null;
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
  collapsedActions: Set<string>;
  nodes: GraphFlowNode[];
  edges: Edge[];
}

function readStoredText(key: string): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
}

function formatParseError(result: ParseFailure): string {
  return `Line ${String(result.lineNumber)}: ${result.error}`;
}

function pruneCollapsedBlocks(
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string>,
): Set<string> {
  if (collapsedBlocks.size === 0) {
    return new Set<string>();
  }

  const validBlockIds = getDocumentBlockIds(document);

  return new Set(
    Array.from(collapsedBlocks).filter((blockId) => validBlockIds.has(blockId)),
  );
}

function pruneCollapsedActions(
  document: AplDocument,
  collapsedActions: ReadonlySet<string>,
): Set<string> {
  if (collapsedActions.size === 0) {
    return new Set<string>();
  }

  const validActionIds = getDocumentActionIds(document);

  return new Set(
    Array.from(collapsedActions).filter((actionId) =>
      validActionIds.has(actionId),
    ),
  );
}

function getDocumentBlockIds(document: AplDocument): Set<string> {
  const blockIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      blockIds.add(getBlockNodeId(profileIndex, block.name));
    }
  }

  return blockIds;
}

function getDocumentActionIds(document: AplDocument): Set<string> {
  const actionIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        actionIds.add(getActionNodeId(profileIndex, block.name, actionIndex));
      }
    }
  }

  return actionIds;
}

function getBlockActionIds(
  document: AplDocument,
  blockId: string,
): Set<string> {
  const actionIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      if (getBlockNodeId(profileIndex, block.name) !== blockId) {
        continue;
      }

      for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
        actionIds.add(getActionNodeId(profileIndex, block.name, actionIndex));
      }

      return actionIds;
    }
  }

  return actionIds;
}

function buildDerivedState(
  text: string,
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string>,
  collapsedActions: ReadonlySet<string>,
): DerivedEditorState {
  const nextCollapsedBlocks = pruneCollapsedBlocks(document, collapsedBlocks);
  const nextCollapsedActions = pruneCollapsedActions(document, collapsedActions);
  const graph = buildGraph(
    document,
    nextCollapsedBlocks,
    nextCollapsedActions,
  );
  return {
    lastGoodText: text,
    parseError: null,
    document,
    collapsedBlocks: nextCollapsedBlocks,
    collapsedActions: nextCollapsedActions,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

// Something went wrong, so keep the fallback graph and add the new error message.
function buildFailedState(
  result: ParseFailure,
  fallback: DerivedEditorState,
): DerivedEditorState {
  return {
    ...fallback,
    parseError: formatParseError(result),
  };
}

function deriveStateFromText(
  text: string,
  fallback: DerivedEditorState,
  collapsedBlocks: ReadonlySet<string>,
  collapsedActions: ReadonlySet<string>,
): DerivedEditorState {
  const parsed = parseDocument(text);
  if (parsed.ok) {
    return buildDerivedState(
      text,
      parsed.document,
      collapsedBlocks,
      collapsedActions,
    );
  }

  return buildFailedState(parsed, fallback);
}

function getEmptyDerivedState(lastGoodText = ""): DerivedEditorState {
  return {
    lastGoodText,
    parseError: null,
    document: null,
    collapsedBlocks: new Set<string>(),
    collapsedActions: new Set<string>(),
    nodes: [],
    edges: [],
  };
}

/**
 * Picks up where the user left off by reading localStorage.
 *
 * 1. Their text still works -> show it
 * 2. Their text is broken, but we kept a backup that works -> show the backup graph + the error
 * 3. Nothing works -> blank canvas + the error
 */
function getInitialEditorState(): Omit<
  EditorState,
  | "applyAplText"
  | "toggleActionCollapse"
  | "toggleBlockCollapse"
  | "toggleAllBlocksCollapse"
> {
  const aplText = readStoredText(APL_STORAGE_KEY);
  const lastGoodText = readStoredText(LAST_GOOD_APL_STORAGE_KEY);
  const collapsedBlocks = new Set<string>();
  const collapsedActions = new Set<string>();
  const initialFallback = getEmptyDerivedState(lastGoodText);
  const initialState = deriveStateFromText(
    aplText,
    initialFallback,
    collapsedBlocks,
    collapsedActions,
  );

  // Happy path, or there is no backup to try.
  if (!initialState.parseError || !lastGoodText) {
    return { aplText, ...initialState };
  }

  // Current text is broken, so see if the backup still works.
  const fallbackState = deriveStateFromText(
    lastGoodText,
    initialFallback,
    collapsedBlocks,
    collapsedActions,
  );
  if (fallbackState.parseError) {
    // Even the backup is broken.
    return { aplText, ...initialState };
  }

  // Use the backup graph but keep the current parse error visible.
  return {
    aplText,
    ...fallbackState,
    lastGoodText,
    parseError: initialState.parseError,
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  ...getInitialEditorState(),
  applyAplText: (text) => {
    set((state) => ({
      aplText: text,
      ...deriveStateFromText(
        text,
        {
          lastGoodText: state.lastGoodText,
          parseError: state.parseError,
          document: state.document,
          collapsedBlocks: state.collapsedBlocks,
          collapsedActions: state.collapsedActions,
          nodes: state.nodes,
          edges: state.edges,
        },
        state.collapsedBlocks,
        state.collapsedActions,
      ),
    }));
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

      const graph = buildGraph(
        state.document,
        state.collapsedBlocks,
        collapsedActions,
      );
      return {
        collapsedActions,
        nodes: graph.nodes,
        edges: graph.edges,
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
      if (isExpandingBlock) {
        for (const actionId of getBlockActionIds(state.document, blockId)) {
          collapsedActions.delete(actionId);
        }
      }

      const graph = buildGraph(
        state.document,
        collapsedBlocks,
        collapsedActions,
      );
      return {
        collapsedBlocks,
        collapsedActions,
        nodes: graph.nodes,
        edges: graph.edges,
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
      const collapsedActions = shouldExpandAll
        ? new Set<string>()
        : state.collapsedActions;
      const graph = buildGraph(
        state.document,
        collapsedBlocks,
        collapsedActions,
      );

      return {
        collapsedBlocks,
        collapsedActions,
        nodes: graph.nodes,
        edges: graph.edges,
      };
    });
  },
}));
