import type { Edge } from "@xyflow/react";
import { buildGraph } from "@/utils/apl-parser/build-graph";
import {
  parseDocument,
  type AplDocument,
  type ParseDocumentResult,
} from "@/utils/apl-parser/document";
import type { AplDiagnostic } from "@/utils/apl-parser/diagnostics";
import type { GraphFlowNode } from "@components/nodes/types";
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "@/utils/conditions/types";
import type { SemanticSpecCatalog } from "@/utils/semantics/types";
import {
  pruneCollapsedActions,
  pruneCollapsedBlocks,
} from "./document-ids";
import { lookupLoadedSemanticCatalogs } from "./talent-catalog-coordinator";

type ParseFailure = Exclude<ParseDocumentResult, { ok: true }>;

/**
 * Snapshot of everything that changes when the APL text or talent-aware
 * filter inputs change. The store swaps these together so the UI never sees
 * a mixed state where, say, the nodes know about a profile that the
 * document map has already dropped.
 */
export interface DerivedEditorState {
  lastGoodText: string;
  parseError: string | null;
  parseErrorLineNumber: number | null;
  diagnostics: readonly AplDiagnostic[];
  document: AplDocument | null;
  collapsedBlocks: Set<string>;
  collapsedActions: Set<string>;
  nodes: GraphFlowNode[];
  edges: Edge[];
  talentSummary: TalentRenderSummary | null;
}

export interface RebuildInputs {
  collapsedBlocks: ReadonlySet<string>;
  collapsedActions: ReadonlySet<string>;
  talentRenderMode: TalentRenderMode;
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>;
  conditionOverrides?: ConditionOverrides;
  semanticCatalogsByProfile?: ReadonlyMap<number, SemanticSpecCatalog>;
}

function formatParseError(result: ParseFailure): string {
  const suggestion = result.suggestion
    ? ` Suggestion: ${result.suggestion}`
    : "";
  return `Line ${String(result.lineNumber)}: ${result.error}${suggestion}`;
}

export interface BuildDerivedStateOptions {
  buildGraph?: boolean;
}

/**
 * Build the React Flow graph for a known-good document, applying both the
 * collapse state and the active talent render mode in one pass. Returning
 * `talentSummary` here (rather than asking the caller to re-derive it) keeps
 * the per-profile hidden counts perfectly in sync with whatever set of nodes
 * the panel will display.
 */
export function rebuildGraph(
  document: AplDocument,
  inputs: RebuildInputs,
): {
  nodes: GraphFlowNode[];
  edges: Edge[];
  talentSummary: TalentRenderSummary | null;
} {
  const {
    collapsedBlocks,
    collapsedActions,
    talentRenderMode,
    talentSelectionsByProfile,
    conditionOverrides,
  } = inputs;
  const result = buildGraph(document, collapsedBlocks, collapsedActions, {
    talentRenderMode,
    talentSelectionsByProfile,
    conditionOverrides: conditionOverrides ?? EMPTY_CONDITION_OVERRIDES,
    semanticCatalogsByProfile:
      inputs.semanticCatalogsByProfile ??
      lookupLoadedSemanticCatalogs(document),
  });
  return {
    nodes: result.nodes,
    edges: result.edges,
    talentSummary: result.talentSummary ?? null,
  };
}

export function buildDerivedState(
  text: string,
  document: AplDocument,
  collapsedBlocks: ReadonlySet<string>,
  collapsedActions: ReadonlySet<string>,
  talentRenderMode: TalentRenderMode,
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>,
  conditionOverrides: ConditionOverrides = EMPTY_CONDITION_OVERRIDES,
  diagnostics: readonly AplDiagnostic[] = [],
  options: BuildDerivedStateOptions = {},
): DerivedEditorState {
  const nextCollapsedBlocks = pruneCollapsedBlocks(document, collapsedBlocks);
  const nextCollapsedActions = pruneCollapsedActions(document, collapsedActions);
  const shouldBuildGraph = options.buildGraph ?? true;
  const graph = shouldBuildGraph
    ? rebuildGraph(document, {
        collapsedBlocks: nextCollapsedBlocks,
        collapsedActions: nextCollapsedActions,
        talentRenderMode,
        talentSelectionsByProfile,
        conditionOverrides,
      })
    : { nodes: [], edges: [], talentSummary: null };
  return {
    lastGoodText: text,
    parseError: null,
    parseErrorLineNumber: null,
    diagnostics,
    document,
    collapsedBlocks: nextCollapsedBlocks,
    collapsedActions: nextCollapsedActions,
    nodes: graph.nodes,
    edges: graph.edges,
    talentSummary: graph.talentSummary,
  };
}

function buildFailedState(
  result: ParseFailure,
  fallback: DerivedEditorState,
): DerivedEditorState {
  return {
    ...fallback,
    parseError: formatParseError(result),
    parseErrorLineNumber: result.lineNumber,
    diagnostics: result.diagnostics,
  };
}

/**
 * Parse-and-derive in one call. On failure, keep the previously rendered
 * graph (and previously decoded selections) so the user does not lose
 * context while their text is mid-edit; only the error banner changes.
 */
export function deriveStateFromText(
  text: string,
  fallback: DerivedEditorState,
  collapsedBlocks: ReadonlySet<string>,
  collapsedActions: ReadonlySet<string>,
  talentRenderMode: TalentRenderMode,
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>,
  conditionOverrides: ConditionOverrides = EMPTY_CONDITION_OVERRIDES,
  options: BuildDerivedStateOptions = {},
): DerivedEditorState {
  const parsed = parseDocument(text);
  if (parsed.ok) {
    return buildDerivedState(
      text,
      parsed.document,
      collapsedBlocks,
      collapsedActions,
      talentRenderMode,
      talentSelectionsByProfile,
      conditionOverrides,
      parsed.diagnostics,
      options,
    );
  }
  return buildFailedState(parsed, fallback);
}

export function getEmptyDerivedState(lastGoodText = ""): DerivedEditorState {
  return {
    lastGoodText,
    parseError: null,
    parseErrorLineNumber: null,
    diagnostics: [],
    document: null,
    collapsedBlocks: new Set<string>(),
    collapsedActions: new Set<string>(),
    nodes: [],
    edges: [],
    talentSummary: null,
  };
}
