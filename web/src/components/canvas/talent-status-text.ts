import type {
  TalentRenderMode,
  TalentSelectionResult,
  TalentStatus,
} from "@/utils/talents/types";

/**
 * Pure mapping from a profile's decode result to the panel's per-row text.
 *
 * Kept out of the React component so the copy is unit-testable and so
 * decoder changes do not need to touch JSX.
 *
 * Display rules:
 * - `absent` is not a failure: the user simply did not paste a `talents=`
 *   line. Surfaced as a quiet info row, never with an alert tone.
 * - `decoded` is the success state. Keep the copy intentionally terse:
 *   this row is mostly a debugging hint that the import worked, not a
 *   primary summary of the selected build.
 * - The remaining kinds map to specific info / warning rows.
 */
export interface TalentRowDescriptor {
  /** Human-friendly profile heading: "Enhancement", "Demo Profile", ... */
  heading: string;
  statusMessage: string;
  /** Tone drives both the visual treatment and the assistive-tech hint. */
  tone: "info" | "warning";
  /**
   * Hidden-action suffix (only meaningful in Dim / Hide). Empty string when
   * the active mode does not filter, or when no actions were hidden.
   */
  hiddenActionsMessage: string;
}

interface ProfileLike {
  name: string;
  className: string;
  specName?: string;
}

export function describeTalentRow(
  profile: ProfileLike,
  selection: TalentSelectionResult | undefined,
  hiddenActionCount: number,
  mode: TalentRenderMode,
  overrideHiddenActionCount = 0,
): TalentRowDescriptor {
  const heading = formatHeading(profile);
  const status = selection?.status ?? { kind: "absent" as const };
  const { statusMessage, tone } = describeStatus(status);
  return {
    heading,
    statusMessage,
    tone,
    hiddenActionsMessage: formatHiddenSuffix(
      hiddenActionCount,
      mode,
      overrideHiddenActionCount,
    ),
  };
}

function formatHeading(profile: ProfileLike): string {
  // Prefer the profile's declared name because it is the only label that
  // distinguishes sibling profiles - two `copy=` variants of the same
  // class/spec would otherwise render identical rows and the user could
  // not tell which one the filter is reporting on. Fall back to spec,
  // then class, then a generic placeholder when the APL provided neither.
  if (profile.name) {
    return profile.name;
  }
  if (profile.specName) {
    return capitalize(profile.specName);
  }
  if (profile.className && profile.className !== "unknown") {
    return capitalize(profile.className);
  }
  return "Profile";
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeStatus(
  status: TalentStatus,
): { statusMessage: string; tone: "info" | "warning" } {
  switch (status.kind) {
    case "absent":
      return { statusMessage: "no talents= line", tone: "info" };
    case "loading":
      // Transient state while the catalog JSON is being fetched. Tone is
      // info, not warning: nothing is wrong, the user just sees the row
      // settle into its real status a moment later.
      return { statusMessage: "loading talent catalog...", tone: "info" };
    case "decoder_pending":
      return {
        statusMessage: "talent decoding unavailable - no filtering",
        tone: "info",
      };
    case "decoded": {
      return {
        statusMessage: "talents loaded",
        tone: "info",
      };
    }
    case "unsupported_spec":
      return {
        statusMessage: "spec not supported by the talent catalog yet",
        tone: "warning",
      };
    case "missing_catalog":
      return {
        statusMessage: "talent catalog not yet generated for this spec",
        tone: "warning",
      };
    case "version_mismatch":
      return {
        statusMessage:
          "talents= was generated for a different spec or talent tree version",
        tone: "warning",
      };
    case "malformed_export":
      return {
        statusMessage: "could not decode the talents= string",
        tone: "warning",
      };
  }
}

function formatHiddenSuffix(
  hiddenActionCount: number,
  mode: TalentRenderMode,
  overrideHiddenActionCount: number,
): string {
  if (mode === "off" || hiddenActionCount <= 0) {
    return "";
  }
  const overrideCount = Math.min(
    hiddenActionCount,
    Math.max(0, overrideHiddenActionCount),
  );
  const talentCount = hiddenActionCount - overrideCount;
  // Wording differs by mode so the row reads naturally:
  //   Dim: "3 actions dimmed"
  //   Hide: "3 actions hidden"
  const verb = mode === "dim" ? "dimmed" : "hidden";
  if (overrideCount > 0 && talentCount > 0) {
    return [
      `${String(talentCount)} talent ${formatActionNoun(talentCount)} ${verb}`,
      `${String(overrideCount)} override ${formatActionNoun(overrideCount)} ${verb}`,
    ].join(", ");
  }
  if (overrideCount > 0) {
    return `${String(overrideCount)} override ${formatActionNoun(overrideCount)} ${verb}`;
  }
  const noun = formatActionNoun(hiddenActionCount);
  return `${String(hiddenActionCount)} ${noun} ${verb}`;
}

function formatActionNoun(count: number): string {
  return count === 1 ? "action" : "actions";
}
