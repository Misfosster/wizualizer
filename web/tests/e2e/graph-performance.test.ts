import { test, expect } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { buildGraph } from "../../src/utils/apl-parser/build-graph";
import { parseDocument, type AplDocument } from "../../src/utils/apl-parser/document";
import type { TalentSelectionResult } from "../../src/utils/talents/types";

interface PerfStats {
  medianMs: number;
  minMs: number;
  maxMs: number;
}

const PARSE_MEDIAN_MAX_MS = process.env.CI ? 1500 : 900;
const BUILD_OFF_MEDIAN_MAX_MS = process.env.CI ? 2000 : 1200;
const BUILD_HIDE_MEDIAN_MAX_MS = process.env.CI ? 2600 : 1600;

const PROFILE_COUNT = 3;
const BLOCKS_PER_PROFILE = 6;
const ACTIONS_PER_BLOCK = 80;
const COPY_CHAIN_COUNT = 10;

function parseOrThrow(text: string): AplDocument {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(
      `Parse failed on line ${String(result.lineNumber)}: ${result.error}\n${result.lineText}`,
    );
  }
  return result.document;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function measure(
  fn: () => void,
  options: { warmups: number; runs: number },
): PerfStats {
  for (let i = 0; i < options.warmups; i++) {
    fn();
  }

  const samples: number[] = [];
  for (let i = 0; i < options.runs; i++) {
    const started = performance.now();
    fn();
    samples.push(performance.now() - started);
  }

  return {
    medianMs: median(samples),
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

function buildLargeApl(
  profileCount: number,
  blocksPerProfile: number,
  actionsPerBlock: number,
): string {
  const lines: string[] = [];
  for (let profileIndex = 0; profileIndex < profileCount; profileIndex++) {
    lines.push(`shaman="Perf-${String(profileIndex)}"`);
    for (let blockIndex = 0; blockIndex < blocksPerProfile; blockIndex++) {
      const blockName = blockIndex === 0 ? "actions" : `actions.block_${String(blockIndex)}`;
      for (let actionIndex = 0; actionIndex < actionsPerBlock; actionIndex++) {
        if (actionIndex % 10 === 0) {
          lines.push(
            `${blockName}+=/call_action_list,name=block_${String((blockIndex + 1) % blocksPerProfile)},if=talent.perf_${String(actionIndex)}.enabled|buff.hot_hand.up`,
          );
          continue;
        }
        lines.push(
          `${blockName}+=/stormstrike,if=buff.hot_hand.up|active_enemies>${String((actionIndex % 5) + 1)}&cooldown.lava_lash.remains<gcd.max+${String((actionIndex % 3) + 1)}`,
        );
      }
    }
  }
  return lines.join("\n");
}

function buildCopyHeavyApl(copyCount: number): string {
  const lines: string[] = [
    'shaman="Perf-Base"',
    "actions.precombat=windfury_weapon",
    "actions.precombat+=/flametongue_weapon",
  ];
  const blocks = [
    "actions",
    "actions.opener",
    "actions.aoe",
    "actions.buffs",
    "actions.single_sb",
    "actions.single_totemic",
  ];

  for (const block of blocks) {
    lines.push(`${block}=stormstrike,if=active_enemies=1`);
    for (let i = 0; i < 20; i++) {
      const op = i % 4 === 0 ? "call_action_list,name=buffs" : "lava_lash";
      lines.push(
        `${block}+=/${op},if=buff.hot_hand.up|active_enemies>${String((i % 5) + 1)}&cooldown.lava_lash.remains<gcd.max+${String((i % 3) + 1)}`,
      );
    }
  }

  for (let copyIndex = 1; copyIndex <= copyCount; copyIndex++) {
    lines.push(`copy="Perf-Copy-${String(copyIndex)}"`);
    lines.push("actions.single_totemic=voltaic_blaze,if=dot.flame_shock.remains=0");
    for (let i = 0; i < 24; i++) {
      lines.push(
        `actions.single_totemic+=/stormstrike,if=charges_fractional>=1.${String(i % 9)}|buff.maelstrom_weapon.stack>=${String((i % 6) + 5)}`,
      );
    }
  }

  return lines.join("\n");
}

test("parseDocument performance: large APL under median budget", () => {
  const largeApl = buildLargeApl(
    PROFILE_COUNT,
    BLOCKS_PER_PROFILE,
    ACTIONS_PER_BLOCK,
  );

  const stats = measure(() => {
    const result = parseDocument(largeApl);
    if (!result.ok) {
      throw new Error(result.error);
    }
  }, { warmups: 1, runs: 5 });

  expect(stats.medianMs).toBeLessThan(PARSE_MEDIAN_MAX_MS);
});

test("buildGraph performance (off/hide): large document under median budgets", () => {
  const largeApl = buildLargeApl(
    PROFILE_COUNT,
    BLOCKS_PER_PROFILE,
    ACTIONS_PER_BLOCK,
  );
  const document = parseOrThrow(largeApl);
  const selections = new Map<number, TalentSelectionResult>();
  for (let profileIndex = 0; profileIndex < PROFILE_COUNT; profileIndex++) {
    selections.set(profileIndex, {
      status: { kind: "decoded" },
      selections: {
        perf_0: 1,
        perf_10: 1,
        perf_20: 1,
        perf_30: 1,
      },
    });
  }

  const offStats = measure(() => {
    buildGraph(document, undefined, undefined, { talentRenderMode: "off" });
  }, { warmups: 1, runs: 4 });

  const hideStats = measure(() => {
    buildGraph(document, undefined, undefined, {
      talentRenderMode: "hide",
      talentSelectionsByProfile: selections,
    });
  }, { warmups: 1, runs: 4 });

  expect(offStats.medianMs).toBeLessThan(BUILD_OFF_MEDIAN_MAX_MS);
  expect(hideStats.medianMs).toBeLessThan(BUILD_HIDE_MEDIAN_MAX_MS);
});

test("copy-heavy profile chain performance: parse/build remains responsive", () => {
  const apl = buildCopyHeavyApl(COPY_CHAIN_COUNT);
  const parseStats = measure(() => {
    const result = parseDocument(apl);
    if (!result.ok) {
      throw new Error(result.error);
    }
  }, { warmups: 1, runs: 5 });

  const document = parseOrThrow(apl);
  const selections = new Map<number, TalentSelectionResult>();
  for (let profileIndex = 0; profileIndex <= COPY_CHAIN_COUNT; profileIndex++) {
    selections.set(profileIndex, {
      status: { kind: "decoded" },
      selections: {
        surging_totem: 1,
        fire_nova: 1,
      },
    });
  }

  const offStats = measure(() => {
    buildGraph(document, undefined, undefined, { talentRenderMode: "off" });
  }, { warmups: 1, runs: 4 });

  const hideStats = measure(() => {
    buildGraph(document, undefined, undefined, {
      talentRenderMode: "hide",
      talentSelectionsByProfile: selections,
    });
  }, { warmups: 1, runs: 4 });

  // Slightly looser than the synthetic-wide test because this case intentionally
  // stresses copy cloning and many inherited actions.
  expect(parseStats.medianMs).toBeLessThan(process.env.CI ? 1800 : 1200);
  expect(offStats.medianMs).toBeLessThan(process.env.CI ? 2600 : 1800);
  expect(hideStats.medianMs).toBeLessThan(process.env.CI ? 3200 : 2300);
});
