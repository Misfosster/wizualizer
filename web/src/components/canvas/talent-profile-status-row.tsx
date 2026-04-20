import { useId, useState, type ReactNode } from "react";
import type { ConditionAtom } from "@/utils/conditions/types";
import type { HiddenActionSummary } from "@/utils/talents/types";
import { HiddenActionsList } from "./hidden-actions-list";
import type { TalentRowDescriptor } from "./talent-status-text";
import { ProfileConditionOverridesSection } from "./condition-overrides/ProfileConditionOverridesSection";

/**
 * Render one decode + filter row for a single profile.
 *
 * The row has two independent drill-downs:
 *  - hidden-action details when the active filter dimmed or hid actions,
 *  - profile-scoped condition overrides for atoms referenced by this profile.
 */
export interface TalentProfileStatusRowProps {
  profileIndex: number;
  profileName: string;
  row: TalentRowDescriptor;
  hiddenActions: readonly HiddenActionSummary[];
  profileAtoms: readonly ConditionAtom[];
}

export function TalentProfileStatusRow({
  profileIndex,
  profileName,
  row,
  hiddenActions,
  profileAtoms,
}: TalentProfileStatusRowProps) {
  const [isOverridesOpen, setOverridesOpen] = useState(false);
  const overridesId = useId();
  const isWarning = row.tone === "warning";
  const markerClass = isWarning
    ? "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
    : "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300";
  const statusToneClass = isWarning ? "text-amber-700" : "text-gray-600";
  const canExpandHiddenActions = hiddenActions.length > 0;
  const toggleLabel = isOverridesOpen
    ? `Hide condition overrides for ${profileName || "profile"}`
    : `Show condition overrides for ${profileName || "profile"}`;

  return (
    <li
      key={`${String(profileIndex)}__${profileName}`}
      data-talent-row-tone={row.tone}
      className="flex items-start gap-2 leading-snug"
    >
      <span aria-hidden="true" className={markerClass} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {canExpandHiddenActions ? (
              <details data-talent-row-details="" className="group min-w-0">
                <summary
                  data-talent-row-summary=""
                  className="cursor-pointer list-none marker:hidden"
                >
                  {renderSummary(row, statusToneClass, true)}
                </summary>
                <HiddenActionsList
                  profileIndex={profileIndex}
                  actions={hiddenActions}
                />
              </details>
            ) : (
              <div data-talent-row-summary="">
                {renderSummary(row, statusToneClass, false)}
              </div>
            )}
          </div>
          <button
            type="button"
            data-profile-condition-overrides-toggle={profileName}
            aria-expanded={isOverridesOpen}
            aria-controls={overridesId}
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => {
              setOverridesOpen((prev) => !prev);
            }}
            className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Overrides
          </button>
        </div>

        {isOverridesOpen ? (
          <div id={overridesId}>
            <ProfileConditionOverridesSection
              profileName={profileName}
              profileAtoms={profileAtoms}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function renderSummary(
  row: TalentRowDescriptor,
  statusToneClass: string,
  showArrow: boolean,
): ReactNode {
  return (
    <span className="grid min-w-0 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-1.5">
      <span
        aria-hidden="true"
        className={
          showArrow
            ? "inline-block transition-transform group-open:rotate-90"
            : "inline-block text-transparent"
        }
      >
        &gt;
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="font-semibold text-gray-800">{row.heading}</span>
          <span className={statusToneClass}>{row.statusMessage}</span>
        </span>
        <span
          data-talent-hidden-suffix=""
          className="block min-h-[0.875rem] text-gray-500"
        >
          {row.hiddenActionsMessage}
        </span>
      </span>
    </span>
  );
}
