import type { Edge } from "@xyflow/react";
import { create } from "zustand";
import { buildGraph, getBlockNodeId } from "@/utils/apl-parser/build-graph";
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
  nodes: GraphFlowNode[];
  edges: Edge[];
  applyAplText: (text: string) => void;
  toggleBlockCollapse: (blockId: string) => void;
}

// Everything that changes when we re-parse the APL text.
// We swap all of these together like a snapshot so the UI never sees mixed state.
interface DerivedEditorState {
  lastGoodText: string;
  parseError: string | null;
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
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
  const validBlockIds = new Set<string>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    for (const block of profile.blocks) {
      validBlockIds.add(getBlockNodeId(profileIndex, block.name));
    }
  }

  return new Set(
    Array.from(collapsedBlocks).filter((blockId) => validBlockIds.has(blockId)),
  );
}

function buildDerivedState(
  text: string,
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string>,
): DerivedEditorState {
  const nextCollapsedBlocks = pruneCollapsedBlocks(document, collapsedBlocks);
  const graph = buildGraph(document, nextCollapsedBlocks);
  return {
    lastGoodText: text,
    parseError: null,
    document,
    collapsedBlocks: nextCollapsedBlocks,
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
): DerivedEditorState {
  const parsed = parseDocument(text);
  if (parsed.ok) {
    return buildDerivedState(text, parsed.document, collapsedBlocks);
  }

  return buildFailedState(parsed, fallback);
}

function getEmptyDerivedState(lastGoodText = ""): DerivedEditorState {
  return {
    lastGoodText,
    parseError: null,
    document: null,
    collapsedBlocks: new Set<string>(),
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
  "applyAplText" | "toggleBlockCollapse"
> {
  const aplText = readStoredText(APL_STORAGE_KEY);
  const lastGoodText = readStoredText(LAST_GOOD_APL_STORAGE_KEY);
  const collapsedBlocks = new Set<string>();
  const initialFallback = getEmptyDerivedState(lastGoodText);
  const initialState = deriveStateFromText(
    aplText,
    initialFallback,
    collapsedBlocks,
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
          nodes: state.nodes,
          edges: state.edges,
        },
        state.collapsedBlocks,
      ),
    }));
  },
  toggleBlockCollapse: (blockId) => {
    set((state) => {
      const collapsedBlocks = new Set(state.collapsedBlocks);
      if (collapsedBlocks.has(blockId)) {
        collapsedBlocks.delete(blockId);
      } else {
        collapsedBlocks.add(blockId);
      }

      if (!state.document) {
        return { collapsedBlocks };
      }

      const graph = buildGraph(state.document, collapsedBlocks);
      return {
        collapsedBlocks,
        nodes: graph.nodes,
        edges: graph.edges,
      };
    });
  },
}));
