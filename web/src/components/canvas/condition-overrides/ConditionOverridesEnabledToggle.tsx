import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/state/editorStore";

/**
 * Compact inline switch for the Condition Overrides section header.
 *
 * Lives next to the count + Clear so the affordance reads as a
 * property of the section it gates (Jakob's Law — header-row controls are
 * the standard dense-settings-panel pattern). The configured overrides
 * remain in store state regardless of this toggle; only the graph rebuild
 * treats them as empty when disabled, letting the user A/B compare without
 * losing their override values.
 */
export function ConditionOverridesEnabledToggle() {
  const { enabled, setEnabled } = useEditorStore(
    useShallow((state) => ({
      enabled: state.conditionOverridesEnabled,
      setEnabled: state.setConditionOverridesEnabled,
    })),
  );

  return (
    <label
      className="nodrag nopan inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap rounded border border-gray-300 px-1 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100"
      title={
        enabled
          ? "Overrides are applied to the graph. Click to compare without overrides."
          : "Overrides are paused. Click to apply them again."
      }
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <input
        type="checkbox"
        aria-label="Apply condition overrides to the rendered graph"
        data-condition-overrides-enabled-toggle
        checked={enabled}
        className="h-3 w-3 rounded border-gray-300 text-gray-800 focus:ring-2 focus:ring-blue-500"
        onChange={(event) => {
          setEnabled(event.currentTarget.checked);
        }}
      />
      <span>Apply</span>
    </label>
  );
}
