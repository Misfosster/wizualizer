import type { Edge } from "@xyflow/react";
import type { AplDocument } from "@/utils/apl-parser/document";
import type { GraphFlowNode } from "@components/nodes/types";
import type { ConditionOverrides } from "@/utils/conditions/types";
import { semanticCatalogLoader } from "@/utils/semantics/catalog-loader-browser";
import { validateDocumentSemantics } from "@/utils/semantics/validate";
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";
import {
  buildDerivedState,
  deriveStateFromText,
  getEmptyDerivedState,
  type DerivedEditorState,
} from "./derivation";
import { decodeSelections } from "./talent-catalog-coordinator";

const EMPTY_SELECTIONS: ReadonlyMap<number, TalentSelectionResult> = new Map();

export interface RuntimeEditorState {
  aplText: string;
  lastGoodText: string;
  parseError: string | null;
  parseErrorLineNumber: number | null;
  diagnostics: DerivedEditorState["diagnostics"];
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
  collapsedActions: Set<string>;
  nodes: GraphFlowNode[];
  edges: Edge[];
  graphBuildStatus: "ready" | "stale";
  graphBuildVersion: number;
  graphBuiltVersion: number;
  shouldAutoCollapseOnNextGraphBuild: boolean;
  talentRenderMode: TalentRenderMode;
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>;
  talentSummary: TalentRenderSummary | null;
  conditionOverrides: ConditionOverrides;
  graphJumpTarget: { nodeId: string; nonce: number } | null;
}

export function withSemanticDiagnostics<T extends Pick<
  DerivedEditorState,
  "diagnostics" | "document" | "parseError"
>>(state: T): T {
  if (!state.document || state.parseError) {
    return state;
  }

  const semanticDiagnostics = validateDocumentSemantics(
    state.document,
    (classSlug, specSlug) =>
      semanticCatalogLoader.lookupSpec(classSlug, specSlug),
  );
  if (semanticDiagnostics.length === 0) {
    return state;
  }

  return {
    ...state,
    diagnostics: [...state.diagnostics, ...semanticDiagnostics],
  };
}

/**
 * Converts a saved APL record into live editor state.
 *
 * 1. Its text still works -> show it
 * 2. Its text is broken, but we kept a backup that works -> show the backup graph + the error
 * 3. Nothing works -> blank canvas + the error
 */
export function buildRuntimeStateForApl(
  aplText: string,
  lastGoodText: string,
  talentRenderMode: TalentRenderMode,
  conditionOverrides: ConditionOverrides,
): RuntimeEditorState {
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
    { buildGraph: false },
  );

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
        initialState.diagnostics,
        { buildGraph: false },
      )
    : initialState;
  const initialGraphStatus = initialDerived.document ? "stale" : "ready";

  if (!initialDerived.parseError || !lastGoodText) {
    return withSemanticDiagnostics({
      aplText,
      ...initialDerived,
      graphBuildStatus: initialGraphStatus,
      graphBuildVersion: initialDerived.document ? 1 : 0,
      graphBuiltVersion: 0,
      shouldAutoCollapseOnNextGraphBuild: true,
      talentRenderMode,
      talentSelectionsByProfile: initialSelections,
      conditionOverrides,
      graphJumpTarget: null,
    });
  }

  const fallbackState = deriveStateFromText(
    lastGoodText,
    initialFallback,
    collapsedBlocks,
    collapsedActions,
    talentRenderMode,
    EMPTY_SELECTIONS,
    conditionOverrides,
    { buildGraph: false },
  );
  if (fallbackState.parseError) {
    return withSemanticDiagnostics({
      aplText,
      ...initialDerived,
      graphBuildStatus: initialGraphStatus,
      graphBuildVersion: initialDerived.document ? 1 : 0,
      graphBuiltVersion: 0,
      shouldAutoCollapseOnNextGraphBuild: true,
      talentRenderMode,
      talentSelectionsByProfile: initialSelections,
      conditionOverrides,
      graphJumpTarget: null,
    });
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
        fallbackState.diagnostics,
        { buildGraph: false },
      )
    : fallbackState;

  return withSemanticDiagnostics({
    aplText,
    ...fallbackDerived,
    lastGoodText,
    parseError: initialDerived.parseError,
    parseErrorLineNumber: initialDerived.parseErrorLineNumber,
    graphBuildStatus: fallbackDerived.document ? "stale" : "ready",
    graphBuildVersion: fallbackDerived.document ? 1 : 0,
    graphBuiltVersion: 0,
    shouldAutoCollapseOnNextGraphBuild: true,
    talentRenderMode,
    talentSelectionsByProfile: fallbackSelections,
    conditionOverrides,
    graphJumpTarget: null,
  });
}

export function snapshotFallback(
  state: Pick<
    RuntimeEditorState,
    | "lastGoodText"
    | "parseError"
    | "parseErrorLineNumber"
    | "diagnostics"
    | "document"
    | "collapsedBlocks"
    | "collapsedActions"
    | "nodes"
    | "edges"
    | "graphBuildStatus"
    | "graphBuildVersion"
    | "graphBuiltVersion"
    | "shouldAutoCollapseOnNextGraphBuild"
    | "talentSummary"
  >,
): DerivedEditorState {
  return {
    lastGoodText: state.lastGoodText,
    parseError: state.parseError,
    parseErrorLineNumber: state.parseErrorLineNumber,
    diagnostics: state.diagnostics,
    document: state.document,
    collapsedBlocks: state.collapsedBlocks,
    collapsedActions: state.collapsedActions,
    nodes: state.nodes,
    edges: state.edges,
    talentSummary: state.talentSummary,
  };
}
