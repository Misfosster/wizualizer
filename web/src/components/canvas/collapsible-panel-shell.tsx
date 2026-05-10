import { Minus, Plus } from "lucide-react";
import { useId, type ReactNode } from "react";

interface CollapsiblePanelShellProps {
  dataPanelAttr: string;
  dataCollapsedAttr: string;
  toggleDataAttr?: string;
  ariaLabel: string;
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  expandedClassName: string;
  children: ReactNode;
}

export function CollapsiblePanelShell({
  dataPanelAttr,
  dataCollapsedAttr,
  toggleDataAttr,
  ariaLabel,
  title,
  isCollapsed,
  onToggle,
  expandedClassName,
  children,
}: CollapsiblePanelShellProps) {
  const contentId = useId();
  const toggleLabel = isCollapsed ? `Expand ${ariaLabel}` : `Collapse ${ariaLabel}`;
  const dataAttrs: Record<string, string> = {
    [dataPanelAttr]: "",
    [dataCollapsedAttr]: isCollapsed ? "true" : "false",
  };
  const toggleDataAttrs: Record<string, string> = toggleDataAttr
    ? { [toggleDataAttr]: "" }
    : {};

  return (
    <section
      {...dataAttrs}
      aria-label={ariaLabel}
      className={`nodrag nopan flex w-72 max-w-xs flex-col rounded-md border border-gray-300 bg-white/95 p-3 text-gray-700 shadow-sm ${
        isCollapsed ? "h-auto overflow-hidden" : expandedClassName
      }`}
    >
      <button
        type="button"
        {...toggleDataAttrs}
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h2>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
          {isCollapsed ? (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </span>
      </button>
      {isCollapsed ? null : (
        <div id={contentId} className="mt-2 min-w-0 pr-1 pb-[10px]">
          {children}
        </div>
      )}
    </section>
  );
}
