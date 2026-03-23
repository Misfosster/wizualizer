import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";
import { buildGraph } from "@/utils/apl-parser/build-graph";
import {
  parseDocument,
  type AplDocument,
  type ParseDocumentResult,
} from "@/utils/apl-parser/document";

export const APL_STORAGE_KEY = "logiccraft.aplText";
export const LAST_GOOD_APL_STORAGE_KEY = "logiccraft.lastGoodAplText";

type ParseFailure = Exclude<ParseDocumentResult, { ok: true }>;

interface EditorState {
  aplText: string;
  lastGoodText: string;
  parseError: string | null;
  document: AplDocument | null;
  nodes: Node[];
  edges: Edge[];
  applyAplText: (text: string) => void;
}

// Everything that changes when we re-parse the APL text.
// We swap all of these together like a snapshot — the UI never sees a mix of old and new.
interface DerivedEditorState {
  lastGoodText: string;
  parseError: string | null;
  document: AplDocument | null;
  nodes: Node[];
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

function buildDerivedState(
  text: string,
  document: AplDocument,
): DerivedEditorState {
  const graph = buildGraph(document);
  return {
    lastGoodText: text,
    parseError: null,
    document,
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

// Something went wrong — don't wipe the screen, just pin the error message on top
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
): DerivedEditorState {
  const parsed = parseDocument(text);
  if (parsed.ok) {
    return buildDerivedState(text, parsed.document);
  }

  return buildFailedState(parsed, fallback);
}

function getEmptyDerivedState(lastGoodText = ""): DerivedEditorState {
  return {
    lastGoodText,
    parseError: null,
    document: null,
    nodes: [],
    edges: [],
  };
}

/**
 * Picks up where the user left off by reading localStorage.
 *
 * 1. Their text still works → show it
 * 2. Their text is broken, but we kept a backup that works → show the backup graph + the error
 * 3. Nothing works → blank canvas + the error
 */
function getInitialEditorState(): Omit<EditorState, "applyAplText"> {
  const aplText = readStoredText(APL_STORAGE_KEY);
  const lastGoodText = readStoredText(LAST_GOOD_APL_STORAGE_KEY);
  const initialFallback = getEmptyDerivedState(lastGoodText);
  const initialState = deriveStateFromText(aplText, initialFallback);

  // Happy path, or there's no backup to try
  if (!initialState.parseError || !lastGoodText) {
    return { aplText, ...initialState };
  }

  // Current text is broken — see if the backup still works
  const fallbackState = deriveStateFromText(lastGoodText, initialFallback);
  if (fallbackState.parseError) {
    // Even the backup is broken — nothing we can do, show empty canvas
    return { aplText, ...initialState };
  }

  // Use the backup's graph but tell the user their current text has a problem
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
      ...deriveStateFromText(text, {
        lastGoodText: state.lastGoodText,
        parseError: state.parseError,
        document: state.document,
        nodes: state.nodes,
        edges: state.edges,
      }),
    }));
  },
}));
