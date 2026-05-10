import type { Edge } from "@xyflow/react";
import type { GraphFlowNode } from "@components/nodes/types";
import type { AplDocument } from "@/utils/apl-parser/document";
import { buildGraph } from "@/utils/apl-parser/build-graph";
import {
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "@/utils/conditions/types";
import type { SemanticSpecCatalog } from "@/utils/semantics/types";
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";
import { lookupLoadedSemanticCatalogs } from "./talent-catalog-coordinator";

/**
 * Inputs that influence a `buildGraph` call. We mirror `RebuildInputs` here
 * rather than importing it to keep this module independent of the broader
 * derivation surface (single responsibility: cache + stabilize, nothing else).
 */
export interface GraphBuildInputs {
  collapsedBlocks: ReadonlySet<string>;
  collapsedActions: ReadonlySet<string>;
  talentRenderMode: TalentRenderMode;
  talentSelectionsByProfile: ReadonlyMap<number, TalentSelectionResult>;
  conditionOverrides?: ConditionOverrides;
  semanticCatalogsByProfile?: ReadonlyMap<number, SemanticSpecCatalog>;
}

export interface GraphBuildResult {
  nodes: GraphFlowNode[];
  edges: Edge[];
  talentSummary: TalentRenderSummary | null;
}

interface CacheEntry {
  signature: string;
  result: GraphBuildResult;
}

const SIGNATURE_DELIMITER = "\u0001";

/**
 * LRU + identity-stabilization wrapper around `buildGraph`.
 *
 * Two distinct optimizations live here:
 *  1. **Memoization (LRU).** Most user actions (toggle a block, switch talent
 *     mode, toggle a condition override) are exact inverses of a previous
 *     state. Caching the last few full results means "toggle + untoggle"
 *     becomes free — no graph rebuild, no React reconciliation.
 *  2. **Per-node identity stabilization.** When a fresh build is unavoidable
 *     (e.g. text edit producing a new document), most nodes are still
 *     content-identical to the prior build. Reusing the prior node and edge
 *     references for unchanged items lets `React.memo`-wrapped node
 *     components skip rendering, which is the main re-render storm cost.
 */
export class GraphBuildCache {
  private readonly maxEntries: number;
  private readonly entries: CacheEntry[] = [];
  private readonly documentIds = new WeakMap<AplDocument, number>();
  private nextDocumentId = 0;

  // Most-recent stabilization state, used to dedupe references on cache miss.
  private lastNodes = new Map<string, GraphFlowNode>();
  private lastEdges = new Map<string, Edge>();

  constructor(maxEntries = 4) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  /**
   * Returns a `GraphBuildResult` for the given document + inputs. On cache
   * hit, returns the prior result with all node/edge references preserved.
   * On cache miss, runs `buildGraph`, stabilizes identities against the last
   * miss-built result, and stores it.
   */
  rebuild(document: AplDocument, inputs: GraphBuildInputs): GraphBuildResult {
    const signature = this.computeSignature(document, inputs);
    const hitIndex = this.entries.findIndex((e) => e.signature === signature);
    if (hitIndex !== -1) {
      const hit = this.entries[hitIndex];
      this.promoteToFront(hitIndex);
      return hit.result;
    }

    const fresh = this.runBuildGraph(document, inputs);
    const stabilized = this.stabilizeIdentities(fresh);
    this.entries.unshift({ signature, result: stabilized });
    while (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }
    return stabilized;
  }

  private runBuildGraph(
    document: AplDocument,
    inputs: GraphBuildInputs,
  ): GraphBuildResult {
    const result = buildGraph(
      document,
      inputs.collapsedBlocks,
      inputs.collapsedActions,
      {
        talentRenderMode: inputs.talentRenderMode,
        talentSelectionsByProfile: inputs.talentSelectionsByProfile,
        conditionOverrides:
          inputs.conditionOverrides ?? EMPTY_CONDITION_OVERRIDES,
        semanticCatalogsByProfile:
          inputs.semanticCatalogsByProfile ??
          lookupLoadedSemanticCatalogs(document),
      },
    );
    return {
      nodes: result.nodes,
      edges: result.edges,
      talentSummary: result.talentSummary ?? null,
    };
  }

  private promoteToFront(index: number): void {
    if (index <= 0) return;
    const [entry] = this.entries.splice(index, 1);
    this.entries.unshift(entry);
  }

  private computeSignature(
    document: AplDocument,
    inputs: GraphBuildInputs,
  ): string {
    const parts: string[] = [
      String(this.getDocumentId(document)),
      this.signSet(inputs.collapsedBlocks),
      this.signSet(inputs.collapsedActions),
      inputs.talentRenderMode,
      // Map references only change when their content changes (decoded once
      // per document parse, conditional overrides spread on toggle), so
      // identity is a safe proxy here.
      String(this.getMapId(inputs.talentSelectionsByProfile)),
      String(this.getOverridesId(inputs.conditionOverrides)),
      String(this.getMapId(inputs.semanticCatalogsByProfile)),
    ];
    return parts.join(SIGNATURE_DELIMITER);
  }

  private getDocumentId(document: AplDocument): number {
    let id = this.documentIds.get(document);
    if (id === undefined) {
      id = ++this.nextDocumentId;
      this.documentIds.set(document, id);
    }
    return id;
  }

  private readonly objectIds = new WeakMap<object, number>();
  private nextObjectId = 0;
  private getMapId(value: ReadonlyMap<unknown, unknown> | undefined): number {
    if (!value) return 0;
    let id = this.objectIds.get(value as object);
    if (id === undefined) {
      id = ++this.nextObjectId;
      this.objectIds.set(value as object, id);
    }
    return id;
  }
  private getOverridesId(value: ConditionOverrides | undefined): number {
    if (!value) return 0;
    return this.getMapId(value as unknown as ReadonlyMap<unknown, unknown>);
  }

  private signSet(set: ReadonlySet<string>): string {
    if (set.size === 0) return "";
    const sorted = Array.from(set).sort();
    return sorted.join(",");
  }

  private stabilizeIdentities(fresh: GraphBuildResult): GraphBuildResult {
    const nextNodes = new Map<string, GraphFlowNode>();
    const stabilizedNodes = fresh.nodes.map((node) => {
      const prior = this.lastNodes.get(node.id);
      const reused = prior && nodesShallowEqual(prior, node) ? prior : node;
      nextNodes.set(reused.id, reused);
      return reused;
    });

    const nextEdges = new Map<string, Edge>();
    const stabilizedEdges = fresh.edges.map((edge) => {
      const prior = this.lastEdges.get(edge.id);
      const reused = prior && edgesShallowEqual(prior, edge) ? prior : edge;
      nextEdges.set(reused.id, reused);
      return reused;
    });

    this.lastNodes = nextNodes;
    this.lastEdges = nextEdges;

    return {
      nodes: stabilizedNodes,
      edges: stabilizedEdges,
      talentSummary: fresh.talentSummary,
    };
  }
}

function nodesShallowEqual(a: GraphFlowNode, b: GraphFlowNode): boolean {
  if (a === b) return true;
  if (a.type !== b.type) return false;
  if (a.parentId !== b.parentId) return false;
  if (a.zIndex !== b.zIndex) return false;
  if (a.hidden !== b.hidden) return false;
  if (a.className !== b.className) return false;
  if (a.sourcePosition !== b.sourcePosition) return false;
  if (a.targetPosition !== b.targetPosition) return false;
  if (a.position.x !== b.position.x || a.position.y !== b.position.y) {
    return false;
  }
  return shallowRecordEqual(
    a.data as Record<string, unknown>,
    b.data as Record<string, unknown>,
  );
}

function edgesShallowEqual(a: Edge, b: Edge): boolean {
  if (a === b) return true;
  if (a.source !== b.source) return false;
  if (a.target !== b.target) return false;
  if (a.sourceHandle !== b.sourceHandle) return false;
  if (a.targetHandle !== b.targetHandle) return false;
  if (a.type !== b.type) return false;
  if (a.hidden !== b.hidden) return false;
  if (a.animated !== b.animated) return false;
  if (a.label !== b.label) return false;
  return shallowRecordEqual(
    (a.style ?? {}) as Record<string, unknown>,
    (b.style ?? {}) as Record<string, unknown>,
  );
}

function shallowRecordEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Singleton cache shared by the editor store. A single instance is correct
 * because the store is itself a singleton — there is one active document,
 * one set of collapse state, etc. Keeping the cache module-local avoids
 * having to thread it through every store action.
 */
export const graphBuildCache = new GraphBuildCache();
