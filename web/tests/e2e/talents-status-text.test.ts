import { expect, test } from "@playwright/test";
import { describeTalentRow } from "../../src/components/canvas/talent-status-text";
import type { TalentSelectionResult } from "../../src/utils/talents/types";

const ENHANCEMENT = {
  name: "Demo Profile",
  className: "shaman",
  specName: "enhancement",
};

test("absent profile renders the quiet info row", () => {
  const row = describeTalentRow(ENHANCEMENT, undefined, 0, "dim");
  // Heading is the profile name, not the spec, so sibling copy= profiles
  // stay distinguishable in the panel.
  expect(row.heading).toBe("Demo Profile");
  expect(row.tone).toBe("info");
  expect(row.statusMessage).toBe("no talents= line");
  expect(row.hiddenActionsMessage).toBe("");
});

test("decoded selection counts only ranks > 0 as loaded", () => {
  const selection: TalentSelectionResult = {
    status: { kind: "decoded" },
    selections: { hot_hand: 1, lashing_flames: 2, fire_nova: 0 },
  };
  const row = describeTalentRow(ENHANCEMENT, selection, 0, "dim");
  expect(row.tone).toBe("info");
  expect(row.statusMessage).toBe("2 talents loaded");
});

test("missing_catalog renders an actionable warning", () => {
  const selection: TalentSelectionResult = {
    status: { kind: "missing_catalog" },
    selections: {},
  };
  const row = describeTalentRow(ENHANCEMENT, selection, 0, "dim");
  expect(row.tone).toBe("warning");
  expect(row.statusMessage).toContain("catalog");
});

test("loading renders a transient info row with no warning tone", () => {
  const selection: TalentSelectionResult = {
    status: { kind: "loading" },
    selections: {},
  };
  const row = describeTalentRow(ENHANCEMENT, selection, 0, "dim");
  expect(row.tone).toBe("info");
  expect(row.statusMessage).toContain("loading");
});

test("decoder_pending is honest about the stub and keeps tone info", () => {
  const selection: TalentSelectionResult = {
    status: { kind: "decoder_pending" },
    selections: {},
  };
  const row = describeTalentRow(ENHANCEMENT, selection, 0, "dim");
  expect(row.tone).toBe("info");
  expect(row.statusMessage).toContain("decoder");
  expect(row.statusMessage).toContain("no filtering");
});

test("malformed_export renders a decode-failure warning", () => {
  const selection: TalentSelectionResult = {
    status: { kind: "malformed_export" },
    selections: {},
  };
  const row = describeTalentRow(ENHANCEMENT, selection, 0, "dim");
  expect(row.tone).toBe("warning");
  expect(row.statusMessage).toContain("decode");
});

test("hidden suffix uses 'dimmed' verb in dim mode", () => {
  const row = describeTalentRow(ENHANCEMENT, undefined, 3, "dim");
  expect(row.hiddenActionsMessage).toBe("3 actions dimmed");
});

test("hidden suffix uses 'hidden' verb in hide mode and pluralizes correctly", () => {
  const single = describeTalentRow(ENHANCEMENT, undefined, 1, "hide");
  expect(single.hiddenActionsMessage).toBe("1 action hidden");

  const many = describeTalentRow(ENHANCEMENT, undefined, 5, "hide");
  expect(many.hiddenActionsMessage).toBe("5 actions hidden");
});

test("hidden suffix splits mixed talent and override counts", () => {
  const row = describeTalentRow(ENHANCEMENT, undefined, 3, "dim", 1);
  expect(row.hiddenActionsMessage).toBe(
    "2 talent actions dimmed, 1 override action dimmed",
  );
});

test("hidden suffix labels override-only counts", () => {
  const row = describeTalentRow(ENHANCEMENT, undefined, 2, "hide", 2);
  expect(row.hiddenActionsMessage).toBe("2 override actions hidden");
});

test("hidden suffix is empty in off mode regardless of count", () => {
  const row = describeTalentRow(ENHANCEMENT, undefined, 7, "off");
  expect(row.hiddenActionsMessage).toBe("");
});

test("heading falls back from name to spec to class to placeholder", () => {
  const fromName = describeTalentRow(
    { name: "My Build", className: "mage", specName: "fire" },
    undefined,
    0,
    "off",
  );
  expect(fromName.heading).toBe("My Build");

  const fromSpec = describeTalentRow(
    { name: "", className: "mage", specName: "fire" },
    undefined,
    0,
    "off",
  );
  expect(fromSpec.heading).toBe("Fire");

  const fromClass = describeTalentRow(
    { name: "", className: "mage" },
    undefined,
    0,
    "off",
  );
  expect(fromClass.heading).toBe("Mage");

  const fallback = describeTalentRow(
    { name: "", className: "unknown" },
    undefined,
    0,
    "off",
  );
  expect(fallback.heading).toBe("Profile");
});
