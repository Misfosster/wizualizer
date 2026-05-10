import { test, expect } from "@playwright/test";
import { makeConditionAtomFromInput } from "../../src/utils/conditions/condition-input";

test("custom condition input accepts raw atom keys", () => {
  expect(makeConditionAtomFromInput("buff.outcrash_lightning.up")).toMatchObject(
    {
      key: "buff.outcrash_lightning.up",
      valueKind: "boolean",
    },
  );
});

test("custom condition input normalizes aura stack checks to up atoms", () => {
  expect(
    makeConditionAtomFromInput("buff.outcrash_lightning.stacks>0"),
  ).toMatchObject({
    key: "buff.outcrash_lightning.up",
    valueKind: "boolean",
  });
  expect(
    makeConditionAtomFromInput("buff.outcrash_lightning.stacks=0"),
  ).toMatchObject({
    key: "buff.outcrash_lightning.down",
    valueKind: "boolean",
  });
});

test("custom condition input keeps non-aliased comparisons as numeric atoms", () => {
  expect(makeConditionAtomFromInput("variable.targets>1")).toMatchObject({
    key: "variable.targets",
    valueKind: "number",
  });
});

test("custom condition input treats active_enemies as numeric", () => {
  expect(makeConditionAtomFromInput("active_enemies")).toMatchObject({
    key: "active_enemies",
    valueKind: "number",
  });
});
