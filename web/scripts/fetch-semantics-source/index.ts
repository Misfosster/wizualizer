import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface SemanticBuckets {
  actions: string[];
  buffs: string[];
  debuffs: string[];
  cooldowns: string[];
  dots: string[];
  trinkets: string[];
  equipped: string[];
  setBonuses: string[];
  options: string[];
}

interface MetadataSource {
  source: string;
  ref: string;
  sourcePaths: string[];
  byClass: Record<string, SemanticBuckets>;
}

const ROOT = process.cwd();
const SIMC_REPO = "simulationcraft/simc";
const SIMC_REF = process.env.SIMC_REF ?? "thewarwithin";
const RAW_BASE_URL = `https://raw.githubusercontent.com/${SIMC_REPO}/${SIMC_REF}`;
const OUTPUT_PATH = path.join(
  ROOT,
  "src",
  "data",
  "semantics",
  "source",
  "metadata.json",
);

async function main(): Promise<void> {
  const sourceFiles = await fetchText("source_files/cmake_engine.txt");
  const metadataPaths = parseSourceFileList(sourceFiles).filter(
    isClassMetadataPath,
  );
  const byClass = new Map<string, SemanticBuckets>();

  for (const sourcePath of metadataPaths) {
    const classSlug = inferClassFromSourcePath(sourcePath);
    if (!classSlug) {
      continue;
    }

    const source = await fetchText(`engine/${sourcePath}`);
    mergeBuckets(getClassBuckets(byClass, classSlug), extractMetadata(source));
  }

  const output: MetadataSource = {
    source: SIMC_REPO,
    ref: SIMC_REF,
    sourcePaths: metadataPaths,
    byClass: Object.fromEntries(
      Array.from(byClass.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([classSlug, buckets]) => [classSlug, sortBuckets(buckets)]),
    ),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function fetchText(pathname: string): Promise<string> {
  const response = await fetch(`${RAW_BASE_URL}/${pathname}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${pathname}: ${String(response.status)} ${response.statusText}`,
    );
  }
  return response.text();
}

function parseSourceFileList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("set("))
    .filter((line) => line !== ")");
}

function isClassMetadataPath(sourcePath: string): boolean {
  if (!sourcePath.startsWith("class_modules/")) {
    return false;
  }
  if (sourcePath.startsWith("class_modules/apl/")) {
    return false;
  }
  return /\.(?:cpp|hpp)$/.test(sourcePath);
}

function inferClassFromSourcePath(sourcePath: string): string | null {
  const parts = sourcePath.split("/");
  const directMatch = /^sc_(.+)\.(?:cpp|hpp)$/.exec(parts.at(-1) ?? "");
  if (directMatch?.[1]) {
    return normalizeClassSlug(directMatch[1]);
  }

  const classDirectory = parts[1];
  return classDirectory ? normalizeClassSlug(classDirectory) : null;
}

function normalizeClassSlug(value: string): string | null {
  const slug = normalizeSlug(value);
  switch (slug) {
    case "deathknight":
      return "death_knight";
    case "demonhunter":
      return "demon_hunter";
    case "warrior":
    case "paladin":
    case "hunter":
    case "rogue":
    case "priest":
    case "death_knight":
    case "shaman":
    case "mage":
    case "warlock":
    case "monk":
    case "druid":
    case "demon_hunter":
    case "evoker":
      return slug;
    default:
      return null;
  }
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll("-", "_");
}

function extractMetadata(rawSource: string): SemanticBuckets {
  const source = stripComments(rawSource);
  const buckets = emptyBuckets();

  collectStructPointerNames(source, "buffs_t", buckets.buffs);
  collectStructPointerNames(source, "debuffs_t", buckets.debuffs);
  collectStructPointerNames(source, "dots_t", buckets.dots);
  collectStructPointerNames(source, "cooldowns_t", buckets.cooldowns);
  collectStructPointerNames(source, "cooldown_t", buckets.cooldowns);

  collectMemberNames(source, /\bbuffs?\.([A-Za-z_][A-Za-z0-9_]*)\b/g, buckets.buffs);
  collectMemberNames(
    source,
    /\bdebuffs?\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    buckets.debuffs,
  );
  collectMemberNames(source, /\bdots?\.([A-Za-z_][A-Za-z0-9_]*)\b/g, buckets.dots);
  collectMemberNames(
    source,
    /\bcooldowns?\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    buckets.cooldowns,
  );

  collectStringMatches(
    source,
    /\bget_cooldown\s*\(\s*"([^"]+)"/g,
    buckets.cooldowns,
  );
  collectStringMatches(source, /\bname\s*==\s*"([^"]+)"/g, buckets.actions);
  collectStringMatches(
    source,
    /\butil::str_compare_ci\s*\(\s*name\s*,\s*"([^"]+)"/g,
    buckets.actions,
  );

  return buckets;
}

function stripComments(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/\/\/.*$/gm, "");
}

function collectStructPointerNames(
  source: string,
  structName: string,
  target: string[],
): void {
  const pattern = new RegExp(
    `struct\\s+${structName}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`,
    "g",
  );
  for (const match of source.matchAll(pattern)) {
    const body = match.groups?.body;
    if (!body) {
      continue;
    }
    collectMemberNames(body, /\*\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[;,=])/g, target);
  }
}

function collectMemberNames(
  source: string,
  pattern: RegExp,
  target: string[],
): void {
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (name && isUsefulAtomName(name)) {
      target.push(normalizeSlug(name));
    }
  }
}

function collectStringMatches(
  source: string,
  pattern: RegExp,
  target: string[],
): void {
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (name && isUsefulAtomName(name)) {
      target.push(normalizeSlug(name));
    }
  }
}

function isUsefulAtomName(name: string): boolean {
  if (name.startsWith("_")) {
    return false;
  }
  return !IGNORED_MEMBER_NAMES.has(name);
}

const IGNORED_MEMBER_NAMES = new Set([
  "action",
  "active",
  "actor",
  "background",
  "base",
  "callbacks",
  "current",
  "default",
  "duration",
  "enabled",
  "event",
  "execute",
  "found",
  "global",
  "main_hand",
  "name",
  "none",
  "off_hand",
  "ok",
  "options",
  "player",
  "ready",
  "result",
  "school",
  "source",
  "state",
  "target",
  "tick",
  "trigger",
  "unknown",
]);

function getClassBuckets(
  byClass: Map<string, SemanticBuckets>,
  classSlug: string,
): SemanticBuckets {
  const existing = byClass.get(classSlug);
  if (existing) {
    return existing;
  }

  const buckets = emptyBuckets();
  byClass.set(classSlug, buckets);
  return buckets;
}

function emptyBuckets(): SemanticBuckets {
  return {
    actions: [],
    buffs: [],
    debuffs: [],
    cooldowns: [],
    dots: [],
    trinkets: [],
    equipped: [],
    setBonuses: [],
    options: [],
  };
}

function mergeBuckets(
  target: SemanticBuckets,
  source: SemanticBuckets,
): void {
  target.actions.push(...source.actions);
  target.buffs.push(...source.buffs);
  target.debuffs.push(...source.debuffs);
  target.cooldowns.push(...source.cooldowns);
  target.dots.push(...source.dots);
  target.trinkets.push(...source.trinkets);
  target.equipped.push(...source.equipped);
  target.setBonuses.push(...source.setBonuses);
  target.options.push(...source.options);
}

function sortBuckets(buckets: SemanticBuckets): SemanticBuckets {
  return {
    actions: uniqueSorted(buckets.actions),
    buffs: uniqueSorted(buckets.buffs),
    debuffs: uniqueSorted(buckets.debuffs),
    cooldowns: uniqueSorted(buckets.cooldowns),
    dots: uniqueSorted(buckets.dots),
    trinkets: uniqueSorted(buckets.trinkets),
    equipped: uniqueSorted(buckets.equipped),
    setBonuses: uniqueSorted(buckets.setBonuses),
    options: uniqueSorted(buckets.options),
  };
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

await main();
