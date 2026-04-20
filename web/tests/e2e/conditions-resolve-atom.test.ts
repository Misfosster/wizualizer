import { test, expect } from "@playwright/test";
import type { IdentRef } from "../../src/utils/apl-parser/types";
import { resolveAtom } from "../../src/utils/conditions/resolve-atom";
import { EMPTY_ATOM_OVERRIDES } from "../../src/utils/conditions/types";

const ident = (name: string): IdentRef => ({ kind: "ident", name });

const baseContext = {
  selections: {} as Record<string, number>,
  globalOverrides: EMPTY_ATOM_OVERRIDES,
  profileOverrides: EMPTY_ATOM_OVERRIDES,
};

test("non-talent atom with no overrides stays unknown", () => {
  expect(resolveAtom(ident("buff.ascendance.up"), baseContext)).toEqual({
    kind: "unknown",
  });
});

test("non-talent profile override beats global override", () => {
  const result = resolveAtom(ident("buff.ascendance.up"), {
    ...baseContext,
    globalOverrides: { "buff.ascendance.up": false },
    profileOverrides: { "buff.ascendance.up": true },
  });
  expect(result).toEqual({ kind: "bool", value: true });
});

test("non-talent global override applies when no profile override is set", () => {
  const result = resolveAtom(ident("buff.ascendance.up"), {
    ...baseContext,
    globalOverrides: { "buff.ascendance.up": false },
  });
  expect(result).toEqual({ kind: "bool", value: false });
});

test("numeric non-talent override resolves as a number", () => {
  const result = resolveAtom(ident("cooldown.ascendance.remains"), {
    ...baseContext,
    profileOverrides: { "cooldown.ascendance.remains": 2.5 },
  });
  expect(result).toEqual({ kind: "number", value: 2.5 });
});

test("aura up overrides resolve stack comparisons through aliases", () => {
  expect(
    resolveAtom(ident("buff.outcrash_lightning.stacks"), {
      ...baseContext,
      globalOverrides: { "buff.outcrash_lightning.up": false },
    }),
  ).toEqual({ kind: "number", value: 0 });

  expect(
    resolveAtom(ident("buff.outcrash_lightning.up"), {
      ...baseContext,
      globalOverrides: { "buff.outcrash_lightning.stacks": 2 },
    }),
  ).toEqual({ kind: "bool", value: true });
});

test("aura up and down overrides resolve as inverse aliases", () => {
  expect(
    resolveAtom(ident("buff.outcrash_lightning.down"), {
      ...baseContext,
      globalOverrides: { "buff.outcrash_lightning.up": true },
    }),
  ).toEqual({ kind: "bool", value: false });

  expect(
    resolveAtom(ident("buff.outcrash_lightning.up"), {
      ...baseContext,
      globalOverrides: { "buff.outcrash_lightning.down": true },
    }),
  ).toEqual({ kind: "bool", value: false });
});

test("cooldown remains and up/down overrides resolve through aliases", () => {
  expect(
    resolveAtom(ident("cooldown.fireblood.remains"), {
      ...baseContext,
      globalOverrides: { "cooldown.fireblood.up": false },
    }),
  ).toEqual({ kind: "number", value: 1 });

  expect(
    resolveAtom(ident("action.fireblood.cooldown"), {
      ...baseContext,
      globalOverrides: { "cooldown.fireblood.remains": 0 },
    }),
  ).toEqual({ kind: "bool", value: true });
});

test("talent atom resolves from decoded selections by default", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.enabled"), {
      ...baseContext,
      selections: { storm_unleashed: 2 },
    }),
  ).toEqual({ kind: "bool", value: true });

  expect(
    resolveAtom(ident("talent.storm_unleashed.enabled"), {
      ...baseContext,
      selections: { storm_unleashed: 0 },
    }),
  ).toEqual({ kind: "bool", value: false });
});

test("talent.<key>.rank reports the decoded number", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.rank"), {
      ...baseContext,
      selections: { storm_unleashed: 3 },
    }),
  ).toEqual({ kind: "number", value: 3 });
});

test("global override on a talent atom wins over decoded selections", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.enabled"), {
      ...baseContext,
      selections: { storm_unleashed: 0 },
      globalOverrides: { "talent.storm_unleashed.enabled": true },
    }),
  ).toEqual({ kind: "bool", value: true });
});

test("global override on talent.<key>.rank coerces to number", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.rank"), {
      ...baseContext,
      globalOverrides: { "talent.storm_unleashed.rank": true },
    }),
  ).toEqual({ kind: "number", value: 1 });
});

test("numeric global override on talent.<key>.rank stays numeric", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.rank"), {
      ...baseContext,
      globalOverrides: { "talent.storm_unleashed.rank": 2 },
    }),
  ).toEqual({ kind: "number", value: 2 });
});

test("per-profile override on a talent atom is ignored (talent layer locks)", () => {
  expect(
    resolveAtom(ident("talent.storm_unleashed.enabled"), {
      ...baseContext,
      selections: { storm_unleashed: 0 },
      profileOverrides: { "talent.storm_unleashed.enabled": true },
    }),
  ).toEqual({ kind: "bool", value: false });
});
