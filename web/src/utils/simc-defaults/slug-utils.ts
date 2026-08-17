/** SimC profile filename segment -> Logiccraft class slug (matches talents/semantics). */
export const SIMC_CLASS_SEGMENTS: Readonly<
  Partial<Record<string, { slug: string; label: string }>>
> = {
  Death_Knight: { slug: "death_knight", label: "Death Knight" },
  Demon_Hunter: { slug: "demon_hunter", label: "Demon Hunter" },
  Warrior: { slug: "warrior", label: "Warrior" },
  Paladin: { slug: "paladin", label: "Paladin" },
  Hunter: { slug: "hunter", label: "Hunter" },
  Rogue: { slug: "rogue", label: "Rogue" },
  Priest: { slug: "priest", label: "Priest" },
  Shaman: { slug: "shaman", label: "Shaman" },
  Mage: { slug: "mage", label: "Mage" },
  Warlock: { slug: "warlock", label: "Warlock" },
  Monk: { slug: "monk", label: "Monk" },
  Druid: { slug: "druid", label: "Druid" },
  Evoker: { slug: "evoker", label: "Evoker" },
};

const CLASS_SEGMENTS_BY_LENGTH = Object.entries(SIMC_CLASS_SEGMENTS).sort(
  ([left], [right]) => right.length - left.length,
);

export function titleCaseSlug(slug: string): string {
  return slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", "_");
}

export function parseMid1ProfileFilename(
  filename: string,
): { classSegment: string; specPart: string } | null {
  const match = /^MID1_(.+)\.simc$/i.exec(filename);
  if (!match?.[1]) {
    return null;
  }

  const rest = match[1];
  for (const [classSegment] of CLASS_SEGMENTS_BY_LENGTH) {
    const prefix = `${classSegment}_`;
    if (rest.startsWith(prefix)) {
      return {
        classSegment,
        specPart: rest.slice(prefix.length),
      };
    }
  }

  return null;
}

export function splitSpecPartIntoBaseAndVariant(
  specPart: string,
  knownSpecSlugs: readonly string[],
): { specSlug: string; variantSuffix: string | null } {
  const normalized = normalizeSlug(specPart);
  const sortedSpecs = [...knownSpecSlugs].sort(
    (left, right) => right.length - left.length,
  );

  for (const specSlug of sortedSpecs) {
    if (normalized === specSlug) {
      return { specSlug, variantSuffix: null };
    }
    const prefix = `${specSlug}_`;
    if (normalized.startsWith(prefix)) {
      const variantSlug = normalized.slice(prefix.length);
      return { specSlug, variantSuffix: variantSlug || null };
    }
  }

  const fallbackSlug = normalizeSlug(specPart.replaceAll(" ", "_"));
  return { specSlug: fallbackSlug, variantSuffix: null };
}

export function buildVariantLabel(
  specLabel: string,
  variantSuffix: string | null,
): string {
  if (!variantSuffix) {
    return specLabel;
  }
  return `${specLabel} (${titleCaseSlug(variantSuffix)})`;
}

export function buildAplNameFromSelection(
  classLabel: string,
  variantLabel: string,
): string {
  return `MID1 ${variantLabel} ${classLabel}`;
}
