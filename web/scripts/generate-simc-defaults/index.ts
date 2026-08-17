import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildVariantLabel,
  parseMid1ProfileFilename,
  SIMC_CLASS_SEGMENTS,
  splitSpecPartIntoBaseAndVariant,
  titleCaseSlug,
} from "../../src/utils/simc-defaults/slug-utils.ts";
import type {
  SimcDefaultClass,
  SimcDefaultsManifest,
  SimcDefaultVariant,
} from "../../src/utils/simc-defaults/types.ts";

const ROOT = process.cwd();
const SIMC_REPO = "simulationcraft/simc";
const SIMC_REF = process.env.SIMC_REF ?? "midnight";
const PROFILE_DIRECTORY = "profiles/MID1";
const GITHUB_API_URL = `https://api.github.com/repos/${SIMC_REPO}/contents/${PROFILE_DIRECTORY}?ref=${SIMC_REF}`;
const OUTPUT_PATH = path.join(ROOT, "src", "data", "simc-defaults", "manifest.json");
const TALENT_SPECS_DIR = path.join(ROOT, "src", "data", "talents", "specs");

interface GitHubContentEntry {
  name: string;
  type: string;
}

async function main(): Promise<void> {
  const knownSpecsByClass = await loadKnownSpecSlugsByClass();
  const filenames = await listProfileFilenames();
  const manifest = buildManifest(filenames, knownSpecsByClass);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${OUTPUT_PATH} (${String(manifest.classes.length)} classes, ${String(
      countVariants(manifest),
    )} profiles)`,
  );
}

async function listProfileFilenames(): Promise<string[]> {
  const response = await fetch(GITHUB_API_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to list ${PROFILE_DIRECTORY}: ${String(response.status)} ${response.statusText}`,
    );
  }

  const entries = (await response.json()) as GitHubContentEntry[];
  return entries
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".simc"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function loadKnownSpecSlugsByClass(): Promise<Map<string, string[]>> {
  const byClass = new Map<string, string[]>();
  const entries = await readdir(TALENT_SPECS_DIR);
  for (const entry of entries) {
    const match = /^(.+)__(.+)\.json$/.exec(entry);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    const classSlug = match[1];
    const specSlug = match[2];
    const specs = byClass.get(classSlug) ?? [];
    specs.push(specSlug);
    byClass.set(classSlug, specs);
  }

  for (const [classSlug, specs] of byClass) {
    byClass.set(
      classSlug,
      Array.from(new Set(specs)).sort((left, right) => left.localeCompare(right)),
    );
  }

  return byClass;
}

function buildManifest(
  filenames: readonly string[],
  knownSpecsByClass: ReadonlyMap<string, string[]>,
): SimcDefaultsManifest {
  const inferredSpecsByClass = inferSpecSlugsFromFilenames(filenames);
  const classBuilders = new Map<
    string,
    {
      slug: string;
      label: string;
      specs: Map<string, { slug: string; label: string; variants: SimcDefaultVariant[] }>;
    }
  >();

  for (const filename of filenames) {
    const parsed = parseMid1ProfileFilename(filename);
    if (!parsed) {
      continue;
    }

    const classMeta = SIMC_CLASS_SEGMENTS[parsed.classSegment];
    if (!classMeta) {
      continue;
    }

    const knownSpecs = mergeSpecSlugs(
      knownSpecsByClass.get(classMeta.slug) ?? [],
      inferredSpecsByClass.get(classMeta.slug) ?? [],
    );
    const { specSlug, variantSuffix } = splitSpecPartIntoBaseAndVariant(
      parsed.specPart,
      knownSpecs,
    );
    const specLabel = titleCaseSlug(specSlug);
    const variantLabel = buildVariantLabel(specLabel, variantSuffix);

    let classBuilder = classBuilders.get(classMeta.slug);
    if (!classBuilder) {
      classBuilder = {
        slug: classMeta.slug,
        label: classMeta.label,
        specs: new Map(),
      };
      classBuilders.set(classMeta.slug, classBuilder);
    }

    let specBuilder = classBuilder.specs.get(specSlug);
    if (!specBuilder) {
      specBuilder = {
        slug: specSlug,
        label: specLabel,
        variants: [],
      };
      classBuilder.specs.set(specSlug, specBuilder);
    }

    if (specBuilder.variants.some((variant) => variant.file === filename)) {
      continue;
    }

    specBuilder.variants.push({ label: variantLabel, file: filename });
  }

  const classes: SimcDefaultClass[] = Array.from(classBuilders.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((classBuilder) => ({
      slug: classBuilder.slug,
      label: classBuilder.label,
      specs: Array.from(classBuilder.specs.values())
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((specBuilder) => ({
          slug: specBuilder.slug,
          label: specBuilder.label,
          variants: sortVariants(specBuilder.variants, specBuilder.label),
        })),
    }));

  return {
    source: SIMC_REPO,
    ref: SIMC_REF,
    directory: PROFILE_DIRECTORY,
    classes,
  };
}

function inferSpecSlugsFromFilenames(
  filenames: readonly string[],
): Map<string, string[]> {
  const byClass = new Map<string, Set<string>>();

  for (const filename of filenames) {
    const parsed = parseMid1ProfileFilename(filename);
    if (!parsed) {
      continue;
    }
    const classMeta = SIMC_CLASS_SEGMENTS[parsed.classSegment];
    if (!classMeta) {
      continue;
    }

    const firstSegment = normalizeSlug(parsed.specPart.split("_")[0] ?? parsed.specPart);
    if (!firstSegment) {
      continue;
    }

    const specs = byClass.get(classMeta.slug) ?? new Set<string>();
    specs.add(firstSegment);
    byClass.set(classMeta.slug, specs);
  }

  return new Map(
    Array.from(byClass.entries()).map(([classSlug, specs]) => [
      classSlug,
      Array.from(specs),
    ]),
  );
}

function mergeSpecSlugs(
  talentSpecs: readonly string[],
  inferredSpecs: readonly string[],
): string[] {
  return Array.from(new Set([...talentSpecs, ...inferredSpecs])).sort((left, right) =>
    right.length - left.length,
  );
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", "_");
}

function sortVariants(
  variants: SimcDefaultVariant[],
  specLabel: string,
): SimcDefaultVariant[] {
  return [...variants].sort((left, right) => {
    const leftIsBase = left.label === specLabel;
    const rightIsBase = right.label === specLabel;
    if (leftIsBase !== rightIsBase) {
      return leftIsBase ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  });
}

function countVariants(manifest: SimcDefaultsManifest): number {
  return manifest.classes.reduce(
    (total, classEntry) =>
      total +
      classEntry.specs.reduce(
        (specTotal, spec) => specTotal + spec.variants.length,
        0,
      ),
    0,
  );
}

await main();
