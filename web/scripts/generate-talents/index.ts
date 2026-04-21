#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitCatalog } from "./emit-catalog";
import { parseHeader, parseTraitData } from "./parse-trait-data";

/**
 * `npm run generate:talents` - read SimC's `trait_data.inc`, fold the
 * rows into per-class `TalentCatalog` JSON, and commit the output to
 * `web/src/data/talents/`.
 *
 * Usage:
 *   npm run generate:talents                         # uses SIMC_PATH env or default
 *   npm run generate:talents -- --source <path>      # explicit trait_data.inc path
 *   npm run generate:talents -- --simc <simc-root>   # path to a SimC checkout
 *
 * Defaults search order:
 *   1. --source <path>                  (file path to trait_data.inc itself)
 *   2. --simc <simc-root>               (<simc-root>/engine/dbc/generated/trait_data.inc)
 *   3. SIMC_PATH env                    (same as --simc)
 *   4. ../../simc/engine/dbc/generated/trait_data.inc (sibling checkout)
 *
 * The script never mutates state outside `web/src/data/talents/` and
 * rewrites every generated `*.json` file in that folder, so partial runs
 * don't leave stale class files on disk and non-generated docs can stay
 * alongside the catalogs.
 */

interface CliOptions {
  sourcePath: string;
  outDir: string;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(SCRIPT_DIR, "..", "..");
const DEFAULT_OUT = resolve(WEB_ROOT, "src", "data", "talents");
const DEFAULT_SIBLING_SIMC = resolve(WEB_ROOT, "..", "..", "simc");
const TRAIT_DATA_REL = "engine/dbc/generated/trait_data.inc";

function parseArgs(argv: readonly string[]): CliOptions {
  const args = Array.from(argv);
  let sourcePath: string | undefined;
  let simcRoot: string | undefined;
  let outDir = DEFAULT_OUT;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--source") {
      sourcePath = args[++i];
      continue;
    }
    if (arg === "--simc") {
      simcRoot = args[++i];
      continue;
    }
    if (arg === "--out") {
      outDir = resolve(args[++i]);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!sourcePath) {
    const envSimc = process.env.SIMC_PATH;
    const candidateRoot = simcRoot ?? envSimc ?? DEFAULT_SIBLING_SIMC;
    sourcePath = resolve(candidateRoot, TRAIT_DATA_REL);
  }

  return { sourcePath: resolve(sourcePath), outDir };
}

function printHelp(): void {
  console.log(
    [
      "generate:talents - produce per-class talent catalog JSON from SimC source",
      "",
      "Options:",
      "  --source <path>   path to trait_data.inc (default: derived from --simc)",
      "  --simc <root>     path to a SimulationCraft checkout",
      "  --out <dir>       output directory (default: web/src/data/talents)",
      "  --help            show this help",
      "",
      "Environment:",
      "  SIMC_PATH         same as --simc when neither --simc nor --source is set",
    ].join("\n"),
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.sourcePath)) {
    console.error(
      [
        `Could not find trait_data.inc at:`,
        `  ${options.sourcePath}`,
        ``,
        `Point the generator at a SimC checkout by either:`,
        `  - setting the SIMC_PATH environment variable to the simc repo root, or`,
        `  - passing --simc <path>, or`,
        `  - passing --source <path-to-trait_data.inc> directly.`,
        ``,
        `You can clone SimC with:`,
        `  git clone https://github.com/simulationcraft/simc.git`,
      ].join("\n"),
    );
    process.exit(1);
  }

  const source = readFileSync(options.sourcePath, "utf8");
  const header = parseHeader(source);
  const rows = parseTraitData(source);

  if (rows.length === 0) {
    console.error(
      `Parsed 0 trait rows from ${options.sourcePath}. The file format may have changed; update parse-trait-data.ts.`,
    );
    process.exit(2);
  }

  const result = emitCatalog(rows, {
    outDir: options.outDir,
    gameVersion: header.gameVersion,
  });

  console.log(
    `generated ${String(result.specCount)} specs across ${String(
      result.classesWritten.length,
    )} classes (${String(result.nodeCount)} nodes) for WoW build ${result.gameVersion}`,
  );
  if (result.classesWritten.length > 0) {
    console.log(`  classes: ${result.classesWritten.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    console.warn(`warnings:`);
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
  }
}

main();
