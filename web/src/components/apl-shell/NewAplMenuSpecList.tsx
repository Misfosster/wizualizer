import {
  getWowSpecVisual,
  needsNeutralSpecLabel,
} from "@/data/wow-class-visuals";
import type { SimcDefaultClass, SimcDefaultVariant } from "@/utils/simc-defaults/types";
import {
  getWowSelectionButtonStyle,
  WOW_SELECTION_SPEC_BUTTON_CLASS,
} from "./wow-selection-button-styles";
import { WowGameIcon } from "./WowGameIcon";

export interface SpecVariantRow {
  specSlug: string;
  variant: SimcDefaultVariant;
  classEntry: SimcDefaultClass;
}

interface NewAplMenuSpecListProps {
  rows: readonly SpecVariantRow[];
  onSelectVariant: (row: SpecVariantRow) => void;
}

export function NewAplMenuSpecList({
  rows,
  onSelectVariant,
}: NewAplMenuSpecListProps) {
  return (
    <div
      role="listbox"
      aria-label="Choose specialization"
      className="max-h-56 space-y-1 overflow-y-auto"
    >
      {rows.map((row) => {
        const visual = getWowSpecVisual(row.classEntry.slug, row.specSlug);
        const useNeutralLabel = needsNeutralSpecLabel(visual.color);

        return (
          <button
            key={`${row.classEntry.slug}:${row.variant.file}`}
            type="button"
            role="option"
            onClick={() => {
              onSelectVariant(row);
            }}
            className={`flex min-h-11 w-full items-center gap-2 rounded-md border border-transparent border-l-[3px] px-2 py-2 text-left text-sm font-medium normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:text-white ${WOW_SELECTION_SPEC_BUTTON_CLASS}`}
            style={{
              ...getWowSelectionButtonStyle(visual.color, "spec"),
              borderLeftColor: visual.color,
            }}
          >
            <WowGameIcon
              iconFile={visual.icon}
              accentColor={visual.color}
              size="sm"
            />
            <span
              className="truncate"
              style={useNeutralLabel ? undefined : { color: visual.color }}
            >
              {row.variant.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function flattenClassVariants(
  classEntry: SimcDefaultClass,
): SpecVariantRow[] {
  return classEntry.specs.flatMap((spec) =>
    spec.variants.map((variant) => ({
      specSlug: spec.slug,
      variant,
      classEntry,
    })),
  );
}
