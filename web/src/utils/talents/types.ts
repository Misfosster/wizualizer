export type TalentRenderMode = "off" | "dim" | "hide";

export type EvalValue =
  | { kind: "bool"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "unknown" };

export type TalentStatus =
  | { kind: "absent" }
  | { kind: "loading" }
  | { kind: "decoder_pending" }
  | { kind: "decoded" }
  | { kind: "unsupported_spec" }
  | { kind: "missing_catalog" }
  | { kind: "version_mismatch" }
  | { kind: "malformed_export" };

export type TalentState = "normal" | "impossible" | "unknown";

/**
 * A single picked-from-one branch of a choice node. SimC's trait data
 * groups "Menace vs Cacophonous Roar"-style nodes under one node id with
 * two entries, and only one variant can be active at a time.
 */
export interface TalentChoiceVariant {
  talentId: number;
  displayName: string;
  simcKey: string;
}

/**
 * One talent node from a class, spec, or hero tree.
 *
 * Normal nodes (`nodeType === "normal"`) carry `talentId` / `displayName`
 * / `simcKey` directly: the decoder records the chosen rank under the
 * single `simcKey`.
 *
 * Choice nodes (`nodeType === "choice"`) expose both variants via
 * `choices`. The top-level `talentId` / `displayName` / `simcKey` mirror
 * the first variant so callers that only know how to read a single-node
 * shape keep working; the decoder uses `choices` plus the export string's
 * 2-bit variant index to decide which variant's `simcKey` receives the
 * rank.
 */
export interface TalentNodeEntry {
  talentId: number;
  displayName: string;
  simcKey: string;
  maxRank: number;
  row?: number;
  col?: number;
  nodeType?: "normal" | "choice";
  choices?: readonly TalentChoiceVariant[];
}

export interface TalentSpecCatalog {
  classId: number;
  specId: number;
  treeHash: string;
  classNodes: TalentNodeEntry[];
  specNodes: TalentNodeEntry[];
  heroNodes?: TalentNodeEntry[];
}

export interface TalentCatalog {
  gameVersion: string;
  byClassSpec: Record<string, TalentSpecCatalog>;
}

export interface TalentSelectionResult {
  status: TalentStatus;
  selections: Record<string, number>;
}

/**
 * A single filtered action, reported to the UI panel so the user can tell
 * which specific actions the filter touched and why. Keeping this as a
 * data shape (not a JSX chunk) lets us reuse it from the per-profile row
 * expander in Dim, from the hidden-block banner in Hide, and later from
 * a per-action tooltip without duplicating the extraction logic.
 *
 * `reason` is the pretty-printed form of the first eligibility segment
 * (`if=...` or `target_if=...`) that proved false. Using the first failing
 * segment keeps the row compact; users who need every failing segment can
 * open the action in the editor at `lineNumber`.
 *
 * `reasonLabel` is the short classification used by graph badges and status
 * copy. `reason` keeps the exact expression for the inspector row.
 */
export interface HiddenActionSummary {
  /** Stable graph-node id (matches `getActionNodeId`). */
  actionId: string;
  /** Block name, e.g. `actions` or `actions.single_totemic`. */
  blockName: string;
  /** Source line number, 1-indexed, for jump-to-line in the editor. */
  lineNumber: number;
  /** Action's spell / structural keyword, e.g. `call_action_list`. */
  spell: string;
  /** Human label for the action. For call_action_list this is the target. */
  label: string;
  /** The eligibility segment that proved false, e.g. `if=talent.foo`. */
  reason: string;
  /** Short cause label, e.g. `forced off by override` or `rank check`. */
  reasonLabel: string;
}

/**
 * Output of the graph builder describing what the talent-aware filter pass
 * removed or tagged. Decoupled from `TalentSelectionResult` so the decoder
 * stays a pure data transform.
 */
export interface TalentRenderSummary {
  hiddenActionCountByProfile: ReadonlyMap<number, number>;
  hiddenActionsByProfile: ReadonlyMap<number, readonly HiddenActionSummary[]>;
}

export const UNKNOWN_VALUE: EvalValue = { kind: "unknown" };

export function boolValue(value: boolean): EvalValue {
  return { kind: "bool", value };
}

export function numberValue(value: number): EvalValue {
  return { kind: "number", value };
}

export function isKnownBool(
  value: EvalValue,
): value is { kind: "bool"; value: boolean } {
  return value.kind === "bool";
}

export function isKnownNumber(
  value: EvalValue,
): value is { kind: "number"; value: number } {
  return value.kind === "number";
}

export function asBool(value: EvalValue): boolean | null {
  if (value.kind === "bool") {
    return value.value;
  }

  if (value.kind === "number") {
    return value.value !== 0;
  }

  return null;
}
