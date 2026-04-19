import { expect, test } from "@playwright/test";
import {
  parseHeader,
  parseTraitData,
} from "../../scripts/generate-talents/parse-trait-data";
import { emitCatalog } from "../../scripts/generate-talents/emit-catalog";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The parser only needs to handle SimC's generated shape, so the
// fixtures here mirror that shape exactly. Upstream churn is detected
// when `parseTraitData` returns fewer rows than we expected.

const FIXTURE = `// WOW BUILD 11.2.7.64772
static constexpr std::array<trait_data_t, 4> __trait_data { {
 { 1, 7, 112250, 90383, 1, 8, 117255, 275338, 0, 0, 5, 1, 200, "Menace", { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, 0, 2 },
 { 1, 7, 112251, 90383, 1, 8, 117256, 382954, 0, 0, 5, 1, 100, "Cacophonous Roar", { 0, 0, 0, 0 }, { 0, 0, 0, 0 }, 0, 2 },
 { 2, 7, 101813, 80949, 1, 20, 106882, 384444, 0, 0, 10, 3, -1, "Thorim's Invocation", { 263, 0, 0, 0 }, { 0, 0, 0, 0 }, 0, 0 },
 { 3, 7, 117487, 94890, 1, 1, 122499, 445025, 0, 0, 2, 1, -1, "Totemic Rebound", { 0, 263, 264, 0 }, { 0, 0, 0, 0 }, 54, 0 },
} };`;

test("parseHeader extracts the WoW build string", () => {
  expect(parseHeader(FIXTURE).gameVersion).toBe("11.2.7.64772");
});

test("parseTraitData returns one row per entry", () => {
  const rows = parseTraitData(FIXTURE);
  expect(rows).toHaveLength(4);
});

test("parseTraitData resolves tree_index into a readable kind", () => {
  const rows = parseTraitData(FIXTURE);
  expect(rows[0].treeKind).toBe("class");
  expect(rows[2].treeKind).toBe("spec");
  expect(rows[3].treeKind).toBe("hero");
});

test("parseTraitData keeps spec ids and names intact", () => {
  const rows = parseTraitData(FIXTURE);
  const thorims = rows.find((r) => r.displayName === "Thorim's Invocation");
  expect(thorims).toBeDefined();
  expect(thorims?.specIds).toEqual([263]);
  expect(thorims?.classId).toBe(7);
});

test("parseTraitData groups both choice entries under the same node id", () => {
  const rows = parseTraitData(FIXTURE);
  const choices = rows.filter((r) => r.nodeId === 90383);
  expect(choices).toHaveLength(2);
  expect(choices.map((r) => r.displayName).sort()).toEqual([
    "Cacophonous Roar",
    "Menace",
  ]);
});

test("emitCatalog groups choice rows into a single node with both variants", () => {
  const rows = parseTraitData(FIXTURE);
  const outDir = mkdtempSync(join(tmpdir(), "talent-catalog-"));
  try {
    const result = emitCatalog(rows, {
      outDir,
      gameVersion: "11.2.7.64772",
    });
    expect(result.classesWritten).toContain("shaman");

    const shaman = JSON.parse(
      readFileSync(join(outDir, "shaman.json"), "utf8"),
    ) as { byClassSpec: Record<string, { classNodes: unknown[]; specNodes: unknown[]; heroNodes?: unknown[] }> };
    const enhancement = shaman.byClassSpec["shaman/enhancement"];
    expect(enhancement).toBeDefined();

    interface NodeShape {
      simcKey: string;
      nodeType?: "normal" | "choice";
      choices?: readonly { simcKey: string }[];
    }
    const menaceNode = (enhancement.classNodes as NodeShape[]).find(
      (node) => node.simcKey === "menace",
    );
    expect(menaceNode?.nodeType).toBe("choice");
    expect(menaceNode?.choices?.map((c) => c.simcKey).sort()).toEqual([
      "cacophonous_roar",
      "menace",
    ]);

    const thorims = (enhancement.specNodes as NodeShape[]).find(
      (node) => node.simcKey === "thorims_invocation",
    );
    expect(thorims).toBeDefined();
    expect(thorims?.nodeType).toBe("normal");

    const totemic = (enhancement.heroNodes as NodeShape[] | undefined)?.find(
      (node) => node.simcKey === "totemic_rebound",
    );
    expect(totemic?.nodeType).toBe("normal");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
