import { Minus, Plus } from "lucide-react";
import { useEditorStore } from "@/state/editorStore";

interface ActionCollapseToggleProps {
  actionId: string;
  label: string;
  isCollapsed: boolean;
}

export function ActionCollapseToggle({
  actionId,
  label,
  isCollapsed,
}: ActionCollapseToggleProps) {
  const actionLabel = isCollapsed ? "Expand" : "Collapse";
  const toggleActionCollapse = () => {
    useEditorStore.getState().toggleActionCollapse(actionId);
  };

  return (
    <button
      type="button"
      className="lc-node-toggle lc-node-toggle--action nodrag nopan"
      aria-label={`${actionLabel} action ${label}`}
      title={`${actionLabel} action`}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        toggleActionCollapse();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.detail > 0) {
          return;
        }

        toggleActionCollapse();
      }}
    >
      {isCollapsed ? (
        <Plus className="lc-node-toggle-icon" />
      ) : (
        <Minus className="lc-node-toggle-icon" />
      )}
    </button>
  );
}
