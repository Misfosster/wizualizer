import type { HiddenActionSummary } from "@/utils/talents/types";

/**
 * Expanded inspector rendered under a profile row when the condition filter
 * has hidden at least one action. Tells the user the three pieces of info
 * they usually want when debugging a filter result:
 *
 *   - *where* the action lives (block + source line number),
 *   - *which* action it was (spell / call target), and
 *   - *why* the filter removed it (the failing `if=` / `target_if=` clause).
 *
 * Accessible naming (Nielsen #9: help users recognise and recover from
 * filter decisions) is the primary goal; the row layout is deliberately
 * plain so a screen reader reads it as a flat list of annotated lines.
 */
export interface HiddenActionsListProps {
  profileIndex: number;
  actions: readonly HiddenActionSummary[];
}

export function HiddenActionsList({
  profileIndex,
  actions,
}: HiddenActionsListProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <ul
      data-hidden-actions-list=""
      data-profile-index={profileIndex}
      className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 pl-3 text-[11px] text-gray-600"
    >
      {actions.map((action) => (
        <li
          key={action.actionId}
          data-hidden-action=""
          className="flex flex-wrap items-baseline gap-x-1.5 leading-snug"
        >
          <span className="font-mono text-gray-500">
            {action.blockName}
          </span>
          <span className="text-gray-400">·</span>
          <span className="font-mono text-gray-500">
            line {String(action.lineNumber)}
          </span>
          <span className="text-gray-400">·</span>
          <span className="font-semibold text-gray-800">{action.label}</span>
          <span
            className="font-mono text-amber-700"
            title={action.reason}
          >
            {action.reason}
          </span>
        </li>
      ))}
    </ul>
  );
}
