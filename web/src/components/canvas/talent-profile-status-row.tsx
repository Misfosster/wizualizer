import { ChevronRight } from "lucide-react";
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
  profileScopeKey: string;
  row: TalentRowDescriptor;
  hiddenActions: readonly HiddenActionSummary[];
  profileAtoms: readonly ConditionAtom[];
}

export function TalentProfileStatusRow({
  profileIndex,
  profileName,
  profileScopeKey,
  row,
  hiddenActions,
  profileAtoms,
}: TalentProfileStatusRowProps) {
  const [isOverridesOpen, setOverridesOpen] = useState(false);
  const [isHiddenActionsOpen, setHiddenActionsOpen] = useState(false);
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
  const toggleText = isOverridesOpen ? "Hide filter" : "Show filter";

  return (
    <li
      key={`${String(profileIndex)}__${profileName}`}
      data-talent-row-tone={row.tone}
      data-profile-scope-key={profileScopeKey}
      className="rounded-md border border-gray-200 bg-gray-50/70 p-2 leading-snug shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className={markerClass} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="min-w-0 flex-1">
            {canExpandHiddenActions ? (
              <details
                data-talent-row-details=""
                className="group min-w-0"
                onToggle={(event) => {
                  setHiddenActionsOpen(event.currentTarget.open);
                }}
              >
                <summary
                  data-talent-row-summary=""
                  className="cursor-pointer list-none marker:hidden"
                >
                  {renderSummary(row, statusToneClass, true, isHiddenActionsOpen)}
                </summary>
                <HiddenActionsList profileIndex={profileIndex} actions={hiddenActions} />
              </details>
            ) : (
              <div data-talent-row-summary="">
                {renderSummary(row, statusToneClass, false, false)}
              </div>
            )}
          </div>
          <div className="flex justify-center pt-1">
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
              className={
                isOverridesOpen
                  ? "inline-flex min-h-[26px] items-center rounded border border-blue-300 bg-blue-50 px-2 text-[10px] font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  : "inline-flex min-h-[26px] items-center rounded border border-gray-300 bg-white px-2 text-[10px] font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              }
            >
              {toggleText}
            </button>
          </div>

          {isOverridesOpen ? (
            <div id={overridesId}>
              <ProfileConditionOverridesSection
                profileName={profileName}
                profileScopeKey={profileScopeKey}
                profileAtoms={profileAtoms}
              />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function renderSummary(
  row: TalentRowDescriptor,
  statusToneClass: string,
  showArrow: boolean,
  isExpanded: boolean,
): ReactNode {
  return (
    <span className="block min-w-0">
      <span className="flex min-w-0 items-start justify-between gap-1">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-800">{row.heading}</span>
          <span className={`mt-0.5 block ${statusToneClass}`}>
            {row.statusMessage}
          </span>
        </span>
        {showArrow ? (
          <ChevronRight
            aria-hidden="true"
            className={`mt-0.5 h-3 w-3 shrink-0 text-gray-500 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        ) : null}
      </span>
      <span className="mt-0.5 block min-w-0 min-h-[1.15rem] py-px">
        <span
          data-talent-hidden-suffix=""
          className="block min-w-0 truncate whitespace-nowrap text-gray-500"
        >
          {row.hiddenActionsMessage}
        </span>
      </span>
    </span>
  );
}
