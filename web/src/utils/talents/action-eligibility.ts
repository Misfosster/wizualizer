import type { Action, Segment } from "@/utils/apl-parser/types";
import { resolveAtom } from "@/utils/conditions/resolve-atom";
import type { ProfileResolutionContext } from "@/utils/conditions/resolve-atom";
import { EMPTY_ATOM_OVERRIDES } from "@/utils/conditions/types";
import { evaluateConditionWith } from "./evaluate-condition";
import type { TalentState } from "./types";

/**
 * Decide whether an action can fire given the talent selections that the
 * profile has chosen, and (optionally) report which eligibility segment
 * caused the verdict.
 *
 * Eligibility rules:
 * - `if=<expr>` is plain action eligibility. If it definitely evaluates
 *   to `false`, the action is impossible.
 * - `target_if=<expr>` and `target_if=first:<expr>` are *filter* modes.
 *   If the expression evaluates to `false` from talent state alone, no
 *   target can match, so the action is impossible.
 * - `target_if=min:<expr>` and `target_if=max:<expr>` are *ranking* modes
 *   that always pick some target and therefore can never make an action
 *   impossible. The current parser does not yet accept the `min:` / `max:`
 *   prefix outside `sequence` segments, so any ranking-mode action fails
 *   to parse upstream and never reaches this function. When the parser
 *   learns those prefixes, this module must learn to skip them.
 *
 * Anything else (`other` segments such as `name=foo`, `op=set`,
 * `value=...`) has no bearing on eligibility.
 *
 * Conservatism: an action is `impossible` only when at least one
 * eligibility segment is provably `false`. Anything else is `normal`
 * (when every eligibility segment is provably `true`) or `unknown`
 * (when at least one segment depends on runtime state we cannot resolve).
 */
export interface ActionEligibilityResult {
  state: TalentState;
  /**
   * The first eligibility segment that proved false, if any. Returned as
   * an AST so the caller can pretty-print, jump-to-line, or build a
   * tooltip without re-walking the action.
   */
  failingSegment?: Segment;
}

export function describeActionEligibility(
  action: Action,
  selections: Readonly<Record<string, number>>,
): ActionEligibilityResult {
  return describeActionEligibilityIn(action, {
    selections,
    globalOverrides: EMPTY_ATOM_OVERRIDES,
    profileOverrides: EMPTY_ATOM_OVERRIDES,
  });
}

/**
 * Override-aware variant: consults the layered atom resolver
 * (`talent.*` -> global override / decoded; everything else ->
 * profile / global override) before falling back to `unknown`.
 *
 * The legacy `describeActionEligibility(action, selections)` overload
 * is kept as a thin wrapper so call sites that don't yet plumb
 * overrides keep working unchanged.
 */
export function describeActionEligibilityIn(
  action: Action,
  context: ProfileResolutionContext,
): ActionEligibilityResult {
  let sawUnknown = false;
  let sawAnySegment = false;

  for (const segment of action.segments) {
    if (segment.type !== "if" && segment.type !== "target_if") {
      continue;
    }

    sawAnySegment = true;
    const result = evaluateConditionWith(segment.expr, (ident) =>
      resolveAtom(ident, context),
    );
    switch (result.kind) {
      case "bool":
        if (!result.value) {
          return { state: "impossible", failingSegment: segment };
        }
        break;
      case "number":
        if (result.value === 0) {
          return { state: "impossible", failingSegment: segment };
        }
        break;
      case "unknown":
        sawUnknown = true;
        break;
    }
  }

  if (!sawAnySegment) {
    return { state: "normal" };
  }
  return { state: sawUnknown ? "unknown" : "normal" };
}

export function evaluateActionEligibility(
  action: Action,
  selections: Readonly<Record<string, number>>,
): TalentState {
  return describeActionEligibility(action, selections).state;
}
