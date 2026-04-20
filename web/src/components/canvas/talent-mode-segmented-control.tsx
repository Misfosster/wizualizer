import { useCallback, useId } from "react";
import type { TalentRenderMode } from "@/utils/talents/types";

/**
 * Three-way segmented control for the talent render mode.
 *
 * UX notes:
 * - `radiogroup` semantics rather than three separate buttons so screen
 *   readers and keyboard users perceive the modes as a single mutually
 *   exclusive choice (Nielsen #4 - consistency with platform conventions).
 * - The active button uses both colour and a darker fill for the contrast
 *   ratio (visibility of system status; WCAG AA against the white panel).
 * - Vertical padding is bumped relative to the existing collapse button so
 *   the primary classification control is closer to a comfortable target
 *   size (Fitts's Law) without breaking visual rhythm with the panel.
 */
export interface TalentModeSegmentedControlProps {
  value: TalentRenderMode;
  onChange: (mode: TalentRenderMode) => void;
  ariaLabel?: string;
}

interface ModeOption {
  value: TalentRenderMode;
  label: string;
  description: string;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  {
    value: "off",
    label: "Off",
    description: "Show every action regardless of talents",
  },
  {
    value: "dim",
    label: "Dim",
    description: "Fade actions that talents make impossible",
  },
  {
    value: "hide",
    label: "Hide",
    description: "Remove actions that talents make impossible",
  },
];

export function TalentModeSegmentedControl({
  value,
  onChange,
  ariaLabel = "Condition filter mode",
}: TalentModeSegmentedControlProps) {
  const groupId = useId();
  const handleSelect = useCallback(
    (mode: TalentRenderMode) => {
      if (mode !== value) {
        onChange(mode);
      }
    },
    [onChange, value],
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      id={groupId}
      className="nodrag nopan inline-flex rounded-md border border-gray-300 bg-white p-0.5 shadow-sm"
    >
      {MODE_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.description}
            data-talent-mode={option.value}
            data-active={isActive ? "true" : "false"}
            className={
              isActive
                ? "rounded px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                : "rounded px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
            }
            onPointerDown={(event) => {
              event.stopPropagation();
              if (event.button !== 0) {
                return;
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              handleSelect(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
