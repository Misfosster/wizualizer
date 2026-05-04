import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

interface SourceCorpus {
  gameVersion: string;
  entries: SourceEntry[];
}

interface SourceEntry {
  classSlug: string;
  specSlug: string;
  actions?: string[];
  buffs?: string[];
  debuffs?: string[];
  cooldowns?: string[];
  dots?: string[];
  talents?: string[];
  trinkets?: string[];
  equipped?: string[];
  setBonuses?: string[];
  options?: string[];
}

interface SemanticBucketEntry {
  actions?: string[];
  buffs?: string[];
  debuffs?: string[];
  cooldowns?: string[];
  dots?: string[];
  talents?: string[];
  trinkets?: string[];
  equipped?: string[];
  setBonuses?: string[];
  options?: string[];
}

interface SemanticSpecCatalog {
  actions: string[];
  buffs: string[];
  debuffs: string[];
  cooldowns: string[];
  dots: string[];
  talents: string[];
  trinkets: string[];
  equipped: string[];
  setBonuses: string[];
  options: string[];
}

interface SemanticCatalog {
  v: number;
  gameVersion: string;
  byClassSpec: Record<string, SemanticSpecCatalog>;
}

interface MetadataSource {
  byClass?: Record<string, SemanticBucketEntry>;
}

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, "src", "data", "semantics", "source", "corpus.json");
const METADATA_SOURCE_PATH = path.join(
  ROOT,
  "src",
  "data",
  "semantics",
  "source",
  "metadata.json",
);
const TALENTS_DIR = path.join(ROOT, "src", "data", "talents");
const OUTPUT_DIR = path.join(ROOT, "src", "data", "semantics");
const SPEC_OUTPUT_DIR = path.join(OUTPUT_DIR, "specs");

const STRUCTURAL_BASELINE: SemanticSpecCatalog = {
  actions: [
    "auto_attack",
    "call_action_list",
    "run_action_list",
    "variable",
    "cycling_variable",
    "sequence",
    "strict_sequence",
    "use_item",
    "use_items",
    "wait",
  ],
  buffs: [],
  debuffs: [],
  cooldowns: [],
  dots: [],
  talents: [],
  trinkets: [],
  equipped: [],
  setBonuses: [],
  options: [
    "if",
    "target_if",
    "name",
    "value",
    "op",
    "slot",
    "slots",
    "line_cd",
    "use_off_gcd",
    "chain",
  ],
};

async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as SourceCorpus;
  const byClass = new Map<string, SemanticCatalog>();

  await mergeTalentCatalogs(byClass, corpus.gameVersion);
  await mergeMetadataSource(byClass);
  for (const entry of corpus.entries) {
    const specCatalog = getSpecCatalog(
      byClass,
      corpus.gameVersion,
      entry.classSlug,
      entry.specSlug,
    );
    mergeEntry(specCatalog, entry);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(SPEC_OUTPUT_DIR, { recursive: true });
  await clearGeneratedJson(SPEC_OUTPUT_DIR);
  for (const [classSlug, catalog] of byClass) {
    sortCatalog(catalog);
    await writeFile(
      path.join(OUTPUT_DIR, `${classSlug}.json`),
      `${JSON.stringify(catalog, null, 2)}\n`,
      "utf8",
    );
    for (const [classSpec, specCatalog] of Object.entries(catalog.byClassSpec)) {
      const [, specSlug] = classSpec.split("/");
      if (!specSlug) {
        continue;
      }
      await writeFile(
        path.join(SPEC_OUTPUT_DIR, `${classSlug}__${specSlug}.json`),
        `${JSON.stringify(
          {
            v: catalog.v,
            gameVersion: catalog.gameVersion,
            classSpec,
            catalog: specCatalog,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }
  }
}

async function clearGeneratedJson(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => unlink(path.join(dir, entry.name))),
  );
}

async function mergeMetadataSource(
  byClass: Map<string, SemanticCatalog>,
): Promise<void> {
  let raw: MetadataSource;
  try {
    raw = JSON.parse(await readFile(METADATA_SOURCE_PATH, "utf8")) as MetadataSource;
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }

  for (const [classSlug, entry] of Object.entries(raw.byClass ?? {})) {
    const catalog = byClass.get(classSlug);
    if (!catalog) {
      continue;
    }

    for (const [classSpec, specCatalog] of Object.entries(catalog.byClassSpec)) {
      if (classSpec.startsWith(`${classSlug}/`)) {
        mergeEntry(specCatalog, entry);
      }
    }
  }
}

async function mergeTalentCatalogs(
  byClass: Map<string, SemanticCatalog>,
  gameVersion: string,
): Promise<void> {
  const files = await readdir(TALENTS_DIR);
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const raw = JSON.parse(
      await readFile(path.join(TALENTS_DIR, file), "utf8"),
    ) as { byClassSpec?: Record<string, unknown> };
    for (const [classSpec, spec] of Object.entries(raw.byClassSpec ?? {})) {
      const [classSlug, specSlug] = classSpec.split("/");
      if (!classSlug || !specSlug) {
        continue;
      }
      const specCatalog = getSpecCatalog(
        byClass,
        gameVersion,
        classSlug,
        specSlug,
      );
      specCatalog.talents.push(...collectSimcKeys(spec));
    }
  }
}

function getSpecCatalog(
  byClass: Map<string, SemanticCatalog>,
  gameVersion: string,
  classSlug: string,
  specSlug: string,
): SemanticSpecCatalog {
  const catalog =
    byClass.get(classSlug) ??
    ({
      v: 1,
      gameVersion,
      byClassSpec: {},
    } satisfies SemanticCatalog);
  byClass.set(classSlug, catalog);

  const key = `${classSlug}/${specSlug}`;
  catalog.byClassSpec[key] ??= cloneBaseline();
  return catalog.byClassSpec[key];
}

function mergeEntry(
  target: SemanticSpecCatalog,
  entry: SemanticBucketEntry,
): void {
  target.actions.push(...(entry.actions ?? []));
  target.buffs.push(...(entry.buffs ?? []));
  target.debuffs.push(...(entry.debuffs ?? []));
  target.cooldowns.push(...(entry.cooldowns ?? []));
  target.dots.push(...(entry.dots ?? []));
  target.talents.push(...(entry.talents ?? []));
  target.trinkets.push(...(entry.trinkets ?? []));
  target.equipped.push(...(entry.equipped ?? []));
  target.setBonuses.push(...(entry.setBonuses ?? []));
  target.options.push(...(entry.options ?? []));
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function collectSimcKeys(value: unknown): string[] {
  const result: string[] = [];
  collectSimcKeysInto(value, result);
  return result;
}

function collectSimcKeysInto(value: unknown, result: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSimcKeysInto(item, result);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.simcKey === "string" && record.simcKey.length > 0) {
    result.push(record.simcKey);
  }

  for (const child of Object.values(record)) {
    collectSimcKeysInto(child, result);
  }
}

function cloneBaseline(): SemanticSpecCatalog {
  return {
    actions: [...STRUCTURAL_BASELINE.actions],
    buffs: [...STRUCTURAL_BASELINE.buffs],
    debuffs: [...STRUCTURAL_BASELINE.debuffs],
    cooldowns: [...STRUCTURAL_BASELINE.cooldowns],
    dots: [...STRUCTURAL_BASELINE.dots],
    talents: [...STRUCTURAL_BASELINE.talents],
    trinkets: [...STRUCTURAL_BASELINE.trinkets],
    equipped: [...STRUCTURAL_BASELINE.equipped],
    setBonuses: [...STRUCTURAL_BASELINE.setBonuses],
    options: [...STRUCTURAL_BASELINE.options],
  };
}

function sortCatalog(catalog: SemanticCatalog): void {
  catalog.byClassSpec = Object.fromEntries(
    Object.entries(catalog.byClassSpec)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, spec]) => [
        key,
        {
          actions: uniqueSorted(spec.actions),
          buffs: uniqueSorted(spec.buffs),
          debuffs: uniqueSorted(spec.debuffs),
          cooldowns: uniqueSorted(spec.cooldowns),
          dots: uniqueSorted(spec.dots),
          talents: uniqueSorted(spec.talents),
          trinkets: uniqueSorted(spec.trinkets),
          equipped: uniqueSorted(spec.equipped),
          setBonuses: uniqueSorted(spec.setBonuses),
          options: uniqueSorted(spec.options),
        },
      ]),
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

await main();
