import { getWowClassVisual } from "@/data/wow-class-visuals";
import type { SimcDefaultClass } from "@/utils/simc-defaults/types";
import {
  getWowSelectionButtonStyle,
  WOW_SELECTION_BUTTON_CLASS,
} from "./wow-selection-button-styles";
import { WowGameIcon } from "./WowGameIcon";

interface NewAplMenuClassGridProps {
  classes: readonly SimcDefaultClass[];
  onSelectClass: (classEntry: SimcDefaultClass) => void;
}

export function NewAplMenuClassGrid({
  classes,
  onSelectClass,
}: NewAplMenuClassGridProps) {
  return (
    <div
      role="listbox"
      aria-label="Choose class"
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
    >
      {classes.map((classEntry) => {
        const visual = getWowClassVisual(classEntry.slug);

        return (
          <button
            key={classEntry.slug}
            type="button"
            role="option"
            onClick={() => {
              onSelectClass(classEntry);
            }}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-2 py-2 text-left text-xs font-semibold normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:bg-gray-950/80 ${WOW_SELECTION_BUTTON_CLASS}`}
            style={getWowSelectionButtonStyle(visual.color, "class")}
          >
            <WowGameIcon
              iconFile={visual.icon}
              accentColor={visual.color}
              size="sm"
            />
            <span className="truncate text-gray-900 dark:text-white">
              {classEntry.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
