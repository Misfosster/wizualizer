import { expect, test } from "@playwright/test";
import { parseDocument } from "../../src/utils/apl-parser/document";
import { getAplCompletionsForLine } from "../../src/components/apl-editor/completion";

function parseOrThrow(text: string) {
  const result = parseDocument(text);
  if (!result.ok) {
    throw new Error(`Parse failed: ${result.error}`);
  }
  return result.document;
}

function labels(result: ReturnType<typeof getAplCompletionsForLine>): string[] {
  return result?.options.map((option) => option.label) ?? [];
}

function singleLabel(
  result: ReturnType<typeof getAplCompletionsForLine>,
): string | undefined {
  return result?.options[0]?.label;
}

function applyText(
  result: ReturnType<typeof getAplCompletionsForLine>,
  label: string,
): string | undefined {
  const apply = result?.options.find((option) => option.label === label)?.apply;
  return typeof apply === "string" ? apply : undefined;
}

test("APL autocomplete offers action-list starts", () => {
  const result = getAplCompletionsForLine({
    text: "act",
    lineNumber: 1,
    column: 3,
    document: null,
  });

  expect(labels(result)).toContain("actions");
});

test("APL autocomplete offers nothing inside comments", () => {
  const result = getAplCompletionsForLine({
    text: "# act",
    lineNumber: 1,
    column: 5,
    document: null,
  });

  expect(result).toBeNull();
});

test("APL autocomplete offers structural actions after action assignments", () => {
  const result = getAplCompletionsForLine({
    text: "actions+=/",
    lineNumber: 1,
    column: "actions+=/".length,
    document: null,
  });

  expect(labels(result)).toEqual(
    expect.arrayContaining(["call_action_list", "sequence", "use_items"]),
  );
});

test("APL autocomplete ranks action names by local APL popularity", () => {
  const parsedText = [
    'shaman="A"',
    "actions.aoe+=/stormstrike",
    "actions.aoe+=/lava_lash",
    "actions.aoe+=/stormstrike",
  ].join("\n");
  const text = [parsedText, "actions.aoe+=/s"].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 5,
    column: "actions.aoe+=/s".length,
    document: parseOrThrow(parsedText),
  });

  const sLabels = labels(result).filter((label) => label.startsWith("s"));
  expect(sLabels[0]).toBe("stormstrike");
  expect(sLabels.indexOf("sequence")).toBeGreaterThan(
    sLabels.indexOf("stormstrike"),
  );
});

test("APL autocomplete offers action names inside sequence entries", () => {
  const text = [
    'monk="A"',
    "spec=windwalker",
    "actions.opening=sequence,tiger_palm:ris",
  ].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 3,
    column: "actions.opening=sequence,tiger_palm:ris".length,
    document: parseOrThrow(text),
    lookupSemanticSpec: () => ({
      status: "loaded",
      catalog: {
        actions: ["rising_sun_kick", "roll", "tiger_palm"],
        buffs: [],
        debuffs: [],
        cooldowns: [],
        dots: [],
        talents: [],
        trinkets: [],
        equipped: [],
        setBonuses: [],
        options: [],
      },
    }),
  });

  expect(result?.from).toBe(
    ['monk="A"', "spec=windwalker"].join("\n").length +
      "\nactions.opening=sequence,tiger_palm:".length,
  );
  expect(labels(result)).toContain("rising_sun_kick");
});

test("APL autocomplete offers segment keys after commas", () => {
  const result = getAplCompletionsForLine({
    text: "actions+=/stormstrike,",
    lineNumber: 1,
    column: "actions+=/stormstrike,".length,
    document: null,
  });

  expect(labels(result)).toEqual(expect.arrayContaining(["if", "target_if"]));
});

test("APL autocomplete suggests replacement assignment for first action-list call", () => {
  const text = ['shaman="A"', "actions.aoe+="].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 2,
    column: "actions.aoe+=".length,
    document: parseOrThrow('shaman="A"'),
  });

  expect(singleLabel(result)).toBe("=");
  expect(result?.from).toBe('shaman="A"\n'.length + "actions.aoe".length);
  expect(result?.to).toBe('shaman="A"\n'.length + "actions.aoe+=".length);
});

test("APL autocomplete suggests append assignment after the list exists", () => {
  const parsedText = ['shaman="A"', "actions.aoe=stormstrike"].join("\n");
  const text = [parsedText, "actions.aoe+="].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 3,
    column: "actions.aoe+=".length,
    document: parseOrThrow(parsedText),
  });

  expect(singleLabel(result)).toBe("+=/");
});

test("APL autocomplete applies replacement assignment for a new action list", () => {
  const text = ['shaman="A"', "act"].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 2,
    column: "act".length,
    document: parseOrThrow('shaman="A"'),
  });

  expect(applyText(result, "actions")).toBe("actions=");
});

test("APL autocomplete applies append assignment for an existing action list", () => {
  const parsedText = ['shaman="A"', "actions=stormstrike"].join("\n");
  const text = [parsedText, "act"].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 3,
    column: "act".length,
    document: parseOrThrow(parsedText),
  });

  expect(applyText(result, "actions")).toBe("actions+=/");
});

test("APL autocomplete treats first copy override as a replacement", () => {
  const parsedText = [
    'shaman="A"',
    "actions.aoe=stormstrike",
    'copy="B"',
  ].join("\n");
  const text = [parsedText, "actions.aoe+="].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 4,
    column: "actions.aoe+=".length,
    document: parseOrThrow(parsedText),
  });

  expect(singleLabel(result)).toBe("=");
});

test("APL autocomplete applies replacement assignment for first copy override", () => {
  const parsedText = [
    'shaman="A"',
    "actions=stormstrike",
    'copy="B"',
  ].join("\n");
  const text = [parsedText, "act"].join("\n");
  const result = getAplCompletionsForLine({
    text,
    lineNumber: 4,
    column: "act".length,
    document: parseOrThrow(parsedText),
  });

  expect(applyText(result, "actions")).toBe("actions=");
});

test("APL autocomplete offers variables defined earlier in the same profile", () => {
  const text = [
    'shaman="A"',
    "actions+=/variable,name=foo,value=1",
    "actions+=/stormstrike,if=variable.",
  ].join("\n");

  const result = getAplCompletionsForLine({
    text,
    lineNumber: 3,
    column: "actions+=/stormstrike,if=variable.".length,
    document: parseOrThrow(text),
  });

  expect(labels(result)).toContain("variable.foo");
});

test("APL autocomplete includes semantic catalog atoms for the active spec", () => {
  const text = [
    'evoker="Aug"',
    "spec=augmentation",
    "actions+=/eruption,if=buff.",
  ].join("\n");

  const result = getAplCompletionsForLine({
    text,
    lineNumber: 3,
    column: "actions+=/eruption,if=buff.".length,
    document: parseOrThrow(text),
    lookupSemanticSpec: () => ({
      status: "loaded",
      catalog: {
        actions: ["eruption"],
        buffs: ["ebon_might"],
        debuffs: [],
        cooldowns: [],
        dots: [],
        talents: [],
        trinkets: [],
        equipped: [],
        setBonuses: [],
        options: [],
      },
    }),
  });

  expect(labels(result)).toContain("buff.ebon_might.up");
});
