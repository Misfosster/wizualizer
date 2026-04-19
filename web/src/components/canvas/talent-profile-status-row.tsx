import type { ReactNode } from "react";
import type { HiddenActionSummary } from "@/utils/talents/types";
import { HiddenActionsList } from "./hidden-actions-list";
import type { TalentRowDescriptor } from "./talent-status-text";

/**
 * Render one decode + filter row for a single profile.
 *
 * Two visual states:
 *  - flat row when there is nothing to drill into,
 *  - `<details>` disclosure when the filter has hidden at least one
 *    action, so the user can expand to see exactly which actions and
 *    why.
 *
 * Plain rows stay keyboard-inert (Nielsen #5: do not invite the user to
 * trigger a no-op); only rows with content to reveal expose a focusable
 * summary.
 */
export interface TalentProfileStatusRowProps {
  profileIndex: number;
  profileName: string;
  row: TalentRowDescriptor;
  hiddenActions: readonly HiddenActionSummary[];
}

export function TalentProfileStatusRow({
  profileIndex,
  profileName,
  row,
  hiddenActions,
}: TalentProfileStatusRowProps) {
  const isWarning = row.tone === "warning";
  const markerClass = isWarning
    ? "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
    : "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300";
  const statusToneClass = isWarning ? "text-amber-700" : "text-gray-600";
  const summary = renderSummary(row, statusToneClass);
  const canExpand = hiddenActions.length > 0;

  return (
    <li
      key={`${String(profileIndex)}__${profileName}`}
      data-talent-row-tone={row.tone}
      className="flex items-baseline gap-2 leading-snug"
    >
      <span aria-hidden="true" className={markerClass} />
      <div className="flex min-w-0 flex-col gap-0.5">
        {canExpand ? (
          <details data-talent-row-details="" className="group min-w-0">
            <summary
              data-talent-row-summary=""
              className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-1.5 gap-y-0.5 marker:hidden"
            >
              <span
                aria-hidden="true"
                className="mr-1 inline-block transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              {summary}
            </summary>
            <HiddenActionsList
              profileIndex={profileIndex}
              actions={hiddenActions}
            />
          </details>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {summary}
          </span>
        )}
      </div>
    </li>
  );
}

function renderSummary(
  row: TalentRowDescriptor,
  statusToneClass: string,
): ReactNode {
  return (
    <>
      <span className="font-semibold text-gray-800">{row.heading}</span>
      <span className={statusToneClass}>{row.statusMessage}</span>
      {row.hiddenActionsMessage ? (
        <span data-talent-hidden-suffix="" className="text-gray-500">
          · {row.hiddenActionsMessage}
        </span>
      ) : null}
    </>
  );
}
