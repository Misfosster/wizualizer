import {
  computeImpossibleSet,
  type ImpossibleSetResult,
} from "@/utils/filters/compute-impossible-set";
import { resolveAtom, type ProfileResolutionContext } from "@/utils/conditions/resolve-atom";
import {
  EMPTY_ATOM_OVERRIDES,
  EMPTY_CONDITION_OVERRIDES,
  type ConditionOverrides,
} from "@/utils/conditions/types";
import type { SemanticSpecCatalog } from "@/utils/semantics/types";
import type {
  HiddenActionSummary,
  TalentRenderMode,
  TalentSelectionResult,
  TalentState,
} from "@/utils/talents/types";
import type { AtomResolver } from "@/utils/talents/evaluate-condition";
import { extractCallTarget } from "./action-data";
import type { AplBlock, AplDocument } from "./document";
import { getActionNodeId } from "./node-ids";
import { getProfileScopeKey } from "./profile-scope";

/**
 * Pre-computed input for the talent-aware passes in `build-graph.ts`.
 *
 * Computed once per `buildGraph` invocation so all profile/block/action
 * iterations share the same view of impossibility. Future filter dimensions
 * extend `computeImpossibleSet`, not this struct.
 */
export interface TalentRenderContext {
  mode: TalentRenderMode;
  impossibleActionIds: ReadonlySet<string>;
  referencedBlocksByProfile: ReadonlyMap<number, ReadonlySet<string>>;
  copiedProfileIndices: ReadonlySet<number>;
  hiddenCountByProfile: ReadonlyMap<number, number>;
  hiddenActionById: ReadonlyMap<string, HiddenActionSummary>;
  profileAtomResolvers: ReadonlyMap<number, AtomResolver>;
  /**
   * Per-profile, ordered list of hidden actions with enough context to
   * power the panel's "see what was filtered" inspector. Passed through
   * from `computeImpossibleSet` unmodified so Hide and Dim share the same
   * data - only the rendering decision changes between modes.
   */
  hiddenActionsByProfile: ReadonlyMap<number, readonly HiddenActionSummary[]>;
}

const EMPTY_ACTIONS: ReadonlySet<string> = new Set();
const EMPTY_PROFILE_INDICES: ReadonlySet<number> = new Set();
const EMPTY_REFS: ReadonlyMap<number, ReadonlySet<string>> = new Map();
const EMPTY_COUNTS: ReadonlyMap<number, number> = new Map();
const EMPTY_HIDDEN: ReadonlyMap<number, readonly HiddenActionSummary[]> =
  new Map();
const EMPTY_HIDDEN_BY_ID: ReadonlyMap<string, HiddenActionSummary> =
  new Map();

const OFF_CONTEXT: TalentRenderContext = {
  mode: "off",
  impossibleActionIds: EMPTY_ACTIONS,
  referencedBlocksByProfile: EMPTY_REFS,
  copiedProfileIndices: EMPTY_PROFILE_INDICES,
  hiddenCountByProfile: EMPTY_COUNTS,
  hiddenActionById: EMPTY_HIDDEN_BY_ID,
  profileAtomResolvers: new Map(),
  hiddenActionsByProfile: EMPTY_HIDDEN,
};

export function buildTalentRenderContext(
  document: AplDocument,
  mode: TalentRenderMode,
  selectionsByProfile:
    | ReadonlyMap<number, TalentSelectionResult>
    | undefined,
  conditionOverrides?: ConditionOverrides,
  semanticCatalogsByProfile?: ReadonlyMap<number, SemanticSpecCatalog>,
): TalentRenderContext {
  if (mode === "off") {
    return OFF_CONTEXT;
  }

  const mergedOverrides = conditionOverrides ?? EMPTY_CONDITION_OVERRIDES;
  const impossible = computeImpossibleSet(document, {
    talentSelectionsByProfile: selectionsByProfile,
    conditionOverrides: mergedOverrides,
    semanticCatalogsByProfile,
  });
  const hiddenActionById = indexHiddenActions(impossible.hiddenActionsByProfile);
  const copiedProfileIndices = getCopiedProfileIndices(document);
  const profileAtomResolvers = buildProfileAtomResolvers(
    document,
    selectionsByProfile,
    mergedOverrides,
  );

  if (mode === "dim") {
    return {
      mode,
      impossibleActionIds: impossible.actionIds,
      referencedBlocksByProfile: EMPTY_REFS,
      copiedProfileIndices,
      hiddenCountByProfile: impossible.hiddenCountByProfile,
      hiddenActionById,
      profileAtomResolvers,
      hiddenActionsByProfile: impossible.hiddenActionsByProfile,
    };
  }

  return {
    mode,
    impossibleActionIds: impossible.actionIds,
    referencedBlocksByProfile: computeReferencedBlocksByProfile(
      document,
      impossible,
    ),
    copiedProfileIndices,
    hiddenCountByProfile: impossible.hiddenCountByProfile,
    hiddenActionById,
    profileAtomResolvers,
    hiddenActionsByProfile: impossible.hiddenActionsByProfile,
  };
}

function getCopiedProfileIndices(document: AplDocument): ReadonlySet<number> {
  const indices = new Set<number>();
  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    if (document.profiles[profileIndex]?.isCopy) {
      indices.add(profileIndex);
    }
  }
  return indices;
}

function buildProfileAtomResolvers(
  document: AplDocument,
  selectionsByProfile: ReadonlyMap<number, TalentSelectionResult> | undefined,
  overrides: ConditionOverrides,
): ReadonlyMap<number, AtomResolver> {
  const resolvers = new Map<number, AtomResolver>();

  for (let profileIndex = 0; profileIndex < document.profiles.length; profileIndex++) {
    const profile = document.profiles[profileIndex];
    const selectionResult = selectionsByProfile?.get(profileIndex);
    const trustedSelections =
      selectionResult?.status.kind === "decoded"
        ? selectionResult.selections
        : null;
    const profileOverrides =
      overrides.byProfile[getProfileScopeKey(profile)] ?? EMPTY_ATOM_OVERRIDES;
    const context: ProfileResolutionContext = {
      selections: trustedSelections ?? {},
      selectionsTrusted: trustedSelections !== null,
      globalOverrides: overrides.global,
      profileOverrides,
    };

    resolvers.set(profileIndex, (ident) => resolveAtom(ident, context));
  }

  return resolvers;
}

function indexHiddenActions(
  hiddenActionsByProfile: ReadonlyMap<
    number,
    readonly HiddenActionSummary[]
  >,
): ReadonlyMap<string, HiddenActionSummary> {
  if (hiddenActionsByProfile.size === 0) {
    return EMPTY_HIDDEN_BY_ID;
  }

  const byId = new Map<string, HiddenActionSummary>();
  for (const actions of hiddenActionsByProfile.values()) {
    for (const action of actions) {
      byId.set(action.actionId, action);
    }
  }
  return byId;
}

/**
 * For each profile, collect the set of block names targeted by a *surviving*
 * `call_action_list` / `run_action_list`. A block referenced only by an
 * impossible invoker stays unreachable, so it must not exempt that block from
 * the empty-block sweep. References are computed after the impossible set so
 * "hidden invoker → block → another hidden invoker" chains do not keep
 * unreachable blocks alive.
 *
 * SimC convention: a block is declared as `actions.<name>=...` and
 * `extractCallTarget` returns the bare `<name>` (e.g. `"cds"`). Block names
 * stored on the document include the `actions.` prefix (`"actions.cds"`).
 * Normalize to the stored form so membership checks work.
 */
function computeReferencedBlocksByProfile(
  document: AplDocument,
  impossible: ImpossibleSetResult,
): ReadonlyMap<number, ReadonlySet<string>> {
  const byProfile = new Map<number, Set<string>>();

  for (
    let profileIndex = 0;
    profileIndex < document.profiles.length;
    profileIndex++
  ) {
    const profile = document.profiles[profileIndex];
    const referenced = new Set<string>();

    for (const block of profile.blocks) {
      for (
        let actionIndex = 0;
        actionIndex < block.actions.length;
        actionIndex++
      ) {
        const actionLine = block.actions[actionIndex];
        const spell = actionLine.action.spell;
        if (spell !== "call_action_list" && spell !== "run_action_list") {
          continue;
        }

        const actionId = getActionNodeId(
          profileIndex,
          block.name,
          actionIndex,
        );
        if (impossible.actionIds.has(actionId)) {
          continue;
        }

        const target = extractCallTarget(actionLine.action.segments);
        if (target) {
          referenced.add(`actions.${target}`);
        }
      }
    }

    byProfile.set(profileIndex, referenced);
  }

  return byProfile;
}

/**
 * Indices into `block.actions` that should reach the graph. In Off and Dim
 * modes every action survives; in Hide mode impossible actions are skipped
 * but surviving actions keep their original index so node IDs (and the
 * editor's collapse state) stay stable across mode switches.
 */
export function getSurvivingActionIndices(
  block: AplBlock,
  profileIndex: number,
  context: TalentRenderContext,
): number[] {
  if (context.mode !== "hide") {
    return block.actions.map((_, index) => index);
  }

  const indices: number[] = [];
  for (let actionIndex = 0; actionIndex < block.actions.length; actionIndex++) {
    const actionId = getActionNodeId(profileIndex, block.name, actionIndex);
    if (context.impossibleActionIds.has(actionId)) {
      continue;
    }
    indices.push(actionIndex);
  }
  return indices;
}

/**
 * In Hide mode, a block survives only when at least one of its actions
 * survives OR when a surviving `call_action_list` action targets it.
 */
export function shouldKeepBlockInHide(
  block: AplBlock,
  profileIndex: number,
  context: TalentRenderContext,
  survivingActionCount: number,
): boolean {
  if (context.mode !== "hide") {
    return true;
  }
  // Entrypoint lists are executed directly by SimC and should always remain
  // visible when Hide is active if they still have surviving actions.
  if (isDirectEntrypointBlock(block.name)) {
    return survivingActionCount > 0;
  }

  // Copy profiles should continue to expose their surviving lists even when a
  // surviving caller is not present inside the copied profile itself.
  if (context.copiedProfileIndices.has(profileIndex)) {
    return survivingActionCount > 0;
  }

  // Non-entrypoint lists are only meaningful when a surviving call path can
  // reach them. Even if they still contain actions, hide unreachable lists so
  // the graph reflects actual execution flow under the active filter.
  if (
    context.referencedBlocksByProfile.get(profileIndex)?.has(block.name) ??
    false
  ) {
    return true;
  }
  return false;
}

function isDirectEntrypointBlock(blockName: string): boolean {
  return blockName === "actions" || blockName === "actions.precombat";
}

/**
 * Talent state to record on an action node and its child condition / value
 * subtree. Only Dim mode records anything; Off omits the field, and Hide
 * omits the action entirely so the field is unreachable.
 */
export function getActionTalentState(
  profileIndex: number,
  blockName: string,
  actionIndex: number,
  context: TalentRenderContext,
): TalentState | undefined {
  if (context.mode !== "dim") {
    return undefined;
  }
  const actionId = getActionNodeId(profileIndex, blockName, actionIndex);
  return context.impossibleActionIds.has(actionId) ? "impossible" : undefined;
}
