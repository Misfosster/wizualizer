import type { TalentRenderMode } from "@/utils/talents/types";

/**
 * Card shown over the empty React Flow viewport when the active filter has
 * removed every node. The placeholder is informational rather than blocking:
 * the user can still interact with the panel and the editor on either side
 * of the canvas, and a single click on the action button restores Dim mode.
 *
 * Why this exists: in Hide mode, an entire document can collapse to nothing
 * if every action depends on talents the profile did not pick. Without a
 * placeholder, the canvas would look broken (Nielsen #1 - visibility of
 * system status; #9 - help users diagnose). The placeholder names the cause
 * ("hidden by talents") and offers the most likely recovery path.
 */
export interface EmptyGraphPlaceholderProps {
  mode: TalentRenderMode;
  onSwitchToDim: () => void;
}

export function EmptyGraphPlaceholder({
  mode,
  onSwitchToDim,
}: EmptyGraphPlaceholderProps) {
  if (mode !== "hide") {
    return null;
  }

  return (
    <div
      data-empty-graph-placeholder=""
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-4"
    >
      <div className="pointer-events-auto max-w-sm rounded-lg border border-gray-300 bg-white/95 p-5 text-center shadow-md">
        <h3 className="text-sm font-semibold text-gray-800">
          Nothing to show in Hide mode
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          Every action in the current document is impossible given the
          selected talents, so the graph has been emptied. Switch to Dim to
          keep the actions visible but faded.
        </p>
        <button
          type="button"
          data-empty-placeholder-switch-to-dim=""
          className="nodrag nopan mt-3 inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.button !== 0) return;
            event.preventDefault();
            onSwitchToDim();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.detail > 0) return;
            onSwitchToDim();
          }}
        >
          Switch to Dim
        </button>
      </div>
    </div>
  );
}
