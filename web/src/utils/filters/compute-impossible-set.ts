import { extractCallTarget } from "@/utils/apl-parser/action-data";
import type { AplBlock, AplDocument } from "@/utils/apl-parser/document";
import { getActionNodeId } from "@/utils/apl-parser/node-ids";
import { prettySegment } from "@/utils/apl-parser/pretty-log";
import type { Segment } from "@/utils/apl-parser/types";
import { describeActionEligibilityIn } from "@/utils/talents/action-eligibility";
import {
  EMPTY_ATOM_OVERRIDES,
  EMPTY_CONDITION_OVERRIDES,
  type AtomOverrides,
  type ConditionOverrides,
} from "@/utils/conditions/types";
import type {
  HiddenActionSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";

/**
 * Combine every active filter dimension into the final set of impossible
 * action IDs and a per-profile count.
 *
 * v1 has only one contributing dimension: talent eligibility. Future
 * dimensions (target count, consumables, gear, set bonuses, per-profile
 * activation) plug in here as additional contributors. The seam is kept
 * deliberately small so adding a dimension never requires touching
 * `build-graph.ts` or the React Flow renderers.
 *
 * Action IDs use the same format as the graph node IDs produced by
 * `getActionNodeId`, so callers can do constant-time `Set.has()` lookups
 * during graph construction.
 */
export interface ImpossibleSetResult {
  actionIds: ReadonlySet<string>;
  hiddenCountByProfile: ReadonlyMap<number, number>;
  /**
   * Per-profile ordered list of actions that were filtered, with enough
   * context (spell, block, line, and the failing eligibility segment) for
   * the UI to show a "here is what the filter removed" inspector. Order
   * matches the source order of actions within each profile so rows read
   * top-to-bottom the same way the APL does.
   */
  hiddenActionsByProfile: ReadonlyMap<number, readonly HiddenActionSummary[]>;
}

export interface ComputeImpossibleSetOptions {
  /**
   * Per-profile decoded talent selections. Only profiles whose
   * `status.kind === "decoded"` contribute trusted talent ranks. Every
   * other status means the selections map is not trustworthy (an empty
   * `{}` under e.g. `missing_catalog` is "we have no idea what was
   * picked", not "nothing was picked"), so `talent.*` references stay
   * unknown unless an explicit override flips them.
   */
  talentSelectionsByProfile?: ReadonlyMap<number, TalentSelectionResult>;
  /**
   * Manual override panel state. A profile is evaluated when it has
   * either trustworthy talents or at least one applicable override
   * (global, or per-profile by name). Profiles with neither stay
   * untouched - matching the v0 behaviour.
   */
  conditionOverrides?: ConditionOverrides;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_COUNTS: ReadonlyMap<number, number> = new Map();
const EMPTY_ACTIONS: ReadonlyMap<number, readonly HiddenActionSummary[]> =
  new Map();

const EMPTY_RESULT: ImpossibleSetResult = {
  actionIds: EMPTY_SET,
  hiddenCountByProfile: EMPTY_COUNTS,
  hiddenActionsByProfile: EMPTY_ACTIONS,
};

export function emptyImpossibleSet(): ImpossibleSetResult {
  return EMPTY_RESULT;
}

export function computeImpossibleSet(
  document: AplDocument,
  options: ComputeImpossibleSetOptions = {},
): ImpossibleSetResult {
  const { talentSelectionsByProfile, conditionOverrides } = options;
  const overrides = conditionOverrides ?? EMPTY_CONDITION_OVERRIDES;
  const hasGlobalOverrides = countKeys(overrides.global) > 0;

  if (
    (!talentSelectionsByProfile || talentSelectionsByProfile.size === 0) &&
    !hasGlobalOverrides &&
    countByProfileKeys(overrides.byProfile) === 0
  ) {
    return EMPTY_RESULT;
  }

  const actionIds = new Set<string>();
  const hiddenCountByProfile = new Map<number, number>();
  const hiddenActionsByProfile = new Map<
    number,
    HiddenActionSummary[]
  >();

  for (
    let profileIndex = 0;
    profileIndex < document.profiles.length;
    profileIndex++
  ) {
    const profile = document.profiles[profileIndex];
    const selectionResult = talentSelectionsByProfile?.get(profileIndex);
    const trustedSelections =
      selectionResult?.status.kind === "decoded"
        ? selectionResult.selections
        : null;
    const profileOverrides =
      overrides.byProfile[profile.name] ?? EMPTY_ATOM_OVERRIDES;

    // Trust gate (broadened): we only evaluate when at least one source
    // of truth is available for this profile. Without any of them
    // every atom resolves to `unknown` and nothing can be impossible -
    // running the loop would just be wasted work.
    if (
      !trustedSelections &&
      !hasGlobalOverrides &&
      countKeys(profileOverrides) === 0
    ) {
      continue;
    }

    const context = {
      selections: trustedSelections ?? {},
      selectionsTrusted: trustedSelections !== null,
      globalOverrides: overrides.global,
      profileOverrides,
    };

    const profileHiddenActions: HiddenActionSummary[] = [];

    for (const block of profile.blocks) {
      for (
        let actionIndex = 0;
        actionIndex < block.actions.length;
        actionIndex++
      ) {
        const actionLine = block.actions[actionIndex];
        const { state, failingSegment } = describeActionEligibilityIn(
          actionLine.action,
          context,
        );
        if (state !== "impossible") {
          continue;
        }

        const actionId = getActionNodeId(
          profileIndex,
          block.name,
          actionIndex,
        );
        actionIds.add(actionId);
        profileHiddenActions.push(
          summarizeHiddenAction(
            actionId,
            block,
            actionLine.action.spell,
            actionLine.action.segments,
            actionLine.lineNumber,
            failingSegment,
          ),
        );
      }
    }

    if (profileHiddenActions.length > 0) {
      hiddenCountByProfile.set(profileIndex, profileHiddenActions.length);
      hiddenActionsByProfile.set(profileIndex, profileHiddenActions);
    }
  }

  return { actionIds, hiddenCountByProfile, hiddenActionsByProfile };
}

function countKeys(overrides: AtomOverrides): number {
  return Object.keys(overrides).length;
}

function countByProfileKeys(
  byProfile: Readonly<Record<string, AtomOverrides>>,
): number {
  let total = 0;
  for (const key of Object.keys(byProfile)) {
    total += countKeys(byProfile[key] ?? EMPTY_ATOM_OVERRIDES);
  }
  return total;
}

function summarizeHiddenAction(
  actionId: string,
  block: AplBlock,
  spell: string,
  segments: readonly Segment[],
  lineNumber: number,
  failingSegment: Segment | undefined,
): HiddenActionSummary {
  return {
    actionId,
    blockName: block.name,
    lineNumber,
    spell,
    label: pickActionLabel(spell, segments),
    reason: failingSegment
      ? prettySegment(failingSegment)
      : "condition filter",
  };
}

/**
 * For call-action-list rows show the target list name (what the user
 * actually wrote, e.g. `single_totemic`); for everything else the spell
 * name is the best identifier.
 */
function pickActionLabel(spell: string, segments: readonly Segment[]): string {
  if (spell === "call_action_list" || spell === "run_action_list") {
    return extractCallTarget(segments);
  }
  return spell;
}
