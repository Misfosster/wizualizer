import type { AplProfile } from "@/utils/apl-parser/document";
import { getProfileScopeKey } from "@/utils/apl-parser/profile-scope";
import type { ConditionAtom } from "@/utils/conditions/types";
import type {
  TalentRenderMode,
  TalentRenderSummary,
  TalentSelectionResult,
} from "@/utils/talents/types";
import { TalentProfileStatusRow } from "./talent-profile-status-row";
import { describeTalentRow } from "./talent-status-text";

/**
 * Per-profile decode + filter rows shown beneath the segmented control.
 *
 * Each row reports two pieces of information:
 *  1. Did this profile's talents= line decode? Why or why not?
 *  2. If a non-Off mode is active, how many of its actions did the filter
 *     remove or dim?
 *
 * Layout is intentionally compact (Hick's Law: collapse into a single
 * scannable column rather than a multi-section dialog). Row rendering -
 * including the disclosure widget for hidden actions - lives in
 * `TalentProfileStatusRow` so this component stays a pure list/router.
 */
export interface TalentProfileStatusListProps {
  profiles: readonly AplProfile[];
  selectionsByProfile: ReadonlyMap<number, TalentSelectionResult>;
  talentSummary: TalentRenderSummary | null;
  mode: TalentRenderMode;
  profileAtomsByScopeKey: ReadonlyMap<string, readonly ConditionAtom[]>;
}

export function TalentProfileStatusList({
  profiles,
  selectionsByProfile,
  talentSummary,
  mode,
  profileAtomsByScopeKey,
}: TalentProfileStatusListProps) {
  if (profiles.length === 0) {
    return null;
  }

  return (
    <ul
      data-talent-status-list=""
      className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-xs text-gray-700"
    >
      {profiles.map((profile, profileIndex) => {
        const selection = selectionsByProfile.get(profileIndex);
        const hiddenCount =
          talentSummary?.hiddenActionCountByProfile.get(profileIndex) ?? 0;
        const hiddenActions =
          talentSummary?.hiddenActionsByProfile.get(profileIndex) ?? [];
        const overrideHiddenCount = hiddenActions.filter(
          (action) => action.reasonLabel === "forced off by override",
        ).length;
        const row = describeTalentRow(
          profile,
          selection,
          hiddenCount,
          mode,
          overrideHiddenCount,
        );
        const profileScopeKey = getProfileScopeKey(profile);
        const profileAtoms =
          profileAtomsByScopeKey.get(profileScopeKey) ?? [];
        return (
          <TalentProfileStatusRow
            key={profileScopeKey}
            profileIndex={profileIndex}
            profileName={profile.name}
            profileScopeKey={profileScopeKey}
            row={row}
            hiddenActions={hiddenActions}
            profileAtoms={profileAtoms}
          />
        );
      })}
    </ul>
  );
}
