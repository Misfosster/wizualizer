import { test, expect } from "@playwright/test";
import {
  parseDocument,
  type AplDocument,
} from "../../src/utils/apl-parser/document";

function parseOrThrow(text: string): AplDocument {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(
      `Parse failed on line ${String(result.lineNumber)}: ${result.error}`,
    );
  }

  return result.document;
}

test("document parser captures spec= for the current profile", () => {
  const doc = parseOrThrow(
    [
      'shaman="Demo Profile"',
      "spec=enhancement",
      "actions+=/windfury_weapon",
    ].join("\n"),
  );

  expect(doc.profiles).toHaveLength(1);
  expect(doc.profiles[0]).toMatchObject({
    name: "Demo Profile",
    className: "shaman",
    specName: "enhancement",
  });
});

test("document parser captures talents= export string verbatim", () => {
  const doc = parseOrThrow(
    [
      'shaman="Demo Profile"',
      "talents=CIcAAAAA1234567890==",
      "actions+=/windfury_weapon",
    ].join("\n"),
  );

  expect(doc.profiles[0].talentExport).toBe("CIcAAAAA1234567890==");
});

test("document parser keeps spec and talents independent across profiles", () => {
  const doc = parseOrThrow(
    [
      'shaman="Profile A"',
      "spec=enhancement",
      "talents=AAA",
      'shaman="Profile B"',
      "spec=elemental",
      "talents=BBB",
    ].join("\n"),
  );

  expect(doc.profiles).toHaveLength(2);
  expect(doc.profiles[0]).toMatchObject({
    name: "Profile A",
    specName: "enhancement",
    talentExport: "AAA",
  });
  expect(doc.profiles[1]).toMatchObject({
    name: "Profile B",
    specName: "elemental",
    talentExport: "BBB",
  });
});

test("copy= snapshots className, specName, and talentExport from the previous profile", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "spec=enhancement",
      "talents=ORIGINAL",
      'copy="Mirror"',
    ].join("\n"),
  );

  expect(doc.profiles).toHaveLength(2);
  expect(doc.profiles[1]).toMatchObject({
    name: "Mirror",
    className: "shaman",
    specName: "enhancement",
    talentExport: "ORIGINAL",
  });
});

test("copy= override does not mutate the source profile", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "spec=enhancement",
      "talents=ORIGINAL",
      'copy="Mirror"',
      "talents=OVERRIDE",
      "spec=elemental",
    ].join("\n"),
  );

  const [source, mirror] = doc.profiles;
  expect(source).toMatchObject({
    name: "Source",
    specName: "enhancement",
    talentExport: "ORIGINAL",
  });
  expect(mirror).toMatchObject({
    name: "Mirror",
    specName: "elemental",
    talentExport: "OVERRIDE",
  });
});

test("copy= clones the previous profile action lists", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "actions+=/bloodlust",
      "actions.cds+=/ascendance",
      'copy="Mirror"',
    ].join("\n"),
  );

  const [source, mirror] = doc.profiles;
  expect(source.blocks.map((block) => block.name)).toEqual(["actions", "actions.cds"]);
  expect(mirror.blocks.map((block) => block.name)).toEqual(["actions", "actions.cds"]);
  expect(mirror.blocks[0]?.actions[0]?.rawLine.trim()).toBe("actions+=/bloodlust");
  expect(mirror.blocks[1]?.actions[0]?.rawLine.trim()).toBe("actions.cds+=/ascendance");
});

test("copy= appends on top of cloned blocks without mutating source blocks", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "actions+=/bloodlust",
      'copy="Mirror"',
      "actions+=/windfury_weapon",
    ].join("\n"),
  );

  const [source, mirror] = doc.profiles;
  const sourceActions = source.blocks.find((block) => block.name === "actions");
  const mirrorActions = mirror.blocks.find((block) => block.name === "actions");
  expect(sourceActions?.actions.map((line) => line.rawLine.trim())).toEqual(["actions+=/bloodlust"]);
  expect(mirrorActions?.actions.map((line) => line.rawLine.trim())).toEqual([
    "actions+=/bloodlust",
    "actions+=/windfury_weapon",
  ]);
});

test("actions= replaces previous actions in the same block", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "actions+=/bloodlust",
      "actions+=/windfury_weapon",
      "actions=lava_lash",
    ].join("\n"),
  );

  const actions = doc.profiles[0]?.blocks.find((block) => block.name === "actions");
  expect(actions?.actions.map((line) => line.rawLine.trim())).toEqual([
    "actions=lava_lash",
  ]);
});

test("copy= with actions= replaces inherited list instead of appending to it", () => {
  const doc = parseOrThrow(
    [
      'shaman="Source"',
      "actions+=/bloodlust",
      "actions+=/windfury_weapon",
      'copy="Mirror"',
      "actions=lava_lash",
    ].join("\n"),
  );

  const [source, mirror] = doc.profiles;
  const sourceActions = source.blocks.find((block) => block.name === "actions");
  const mirrorActions = mirror.blocks.find((block) => block.name === "actions");
  expect(sourceActions?.actions.map((line) => line.rawLine.trim())).toEqual([
    "actions+=/bloodlust",
    "actions+=/windfury_weapon",
  ]);
  expect(mirrorActions?.actions.map((line) => line.rawLine.trim())).toEqual([
    "actions=lava_lash",
  ]);
});

test("spec= and talents= before any class profile attach to the implicit Untitled profile", () => {
  const doc = parseOrThrow(
    [
      "spec=enhancement",
      "talents=EARLY",
      "actions+=/bloodlust",
    ].join("\n"),
  );

  expect(doc.profiles).toHaveLength(1);
  expect(doc.profiles[0]).toMatchObject({
    name: "Untitled",
    className: "unknown",
    specName: "enhancement",
    talentExport: "EARLY",
  });
});

test("talents= line does not interfere with action parsing", () => {
  const doc = parseOrThrow(
    [
      'shaman="Demo"',
      "spec=enhancement",
      "talents=CIcAAAAA",
      "actions.precombat+=/windfury_weapon",
      "actions+=/bloodlust,if=buff.bloodlust.up",
    ].join("\n"),
  );

  const profile = doc.profiles[0];
  expect(profile.specName).toBe("enhancement");
  expect(profile.talentExport).toBe("CIcAAAAA");
  expect(profile.blocks).toHaveLength(2);
  expect(profile.blocks[0].name).toBe("actions.precombat");
  expect(profile.blocks[1].name).toBe("actions");
});
