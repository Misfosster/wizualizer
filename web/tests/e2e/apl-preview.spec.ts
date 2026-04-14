import { expect, test } from "@playwright/test";

const VALID_APL = [
  'shaman="Demo Profile"',
  "actions.precombat=windfury_weapon",
  "actions+=/auto_attack,if=active_enemies>1",
].join("\n");

const STRUCTURAL_APL = [
  'shaman="Demo Profile"',
  "actions.precombat=windfury_weapon",
  "actions+=/variable,name=aoe_threshold,op=set,value=active_enemies,if=active_enemies>1",
  "actions+=/call_action_list,name=cds",
  "actions+=/use_item,name=treacherous_transmitter,if=fight_remains<=20",
  "actions+=/sequence,stormstrike:lavalash:crashlightning",
].join("\n");

const INVALID_APL = [
  'shaman="Demo Profile"',
  "actions+=/auto_attack,if=floor(",
].join("\n");

test("renders parsed APL text in the preview graph", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(VALID_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-root__0")).toContainText("Demo Profile");
  await expect(page.getByTestId("rf__node-block__0__actions.precombat")).toContainText("actions.precombat");
  await expect(page.getByTestId("rf__node-block__0__actions")).toContainText("actions");
  await expect(page.getByTestId("rf__node-action__0__actions.precombat__0")).toContainText("windfury_weapon");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("auto_attack");
  await expect(page.getByTestId("rf__node-condition__0__actions__0__if")).toContainText("active_enemies>1");
});

test("remembers the last active editor tab", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.reload();
  await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute(
    "data-state",
    "active",
  );

  await page.getByRole("tab", { name: "Write" }).click();
  await page.reload();
  await expect(page.getByRole("tab", { name: "Write" })).toHaveAttribute(
    "data-state",
    "active",
  );
});

test("renders custom structural node components in the preview graph", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-block__0__actions")).toContainText("Block");
  await expect(page.getByTestId("rf__node-block__0__actions")).toContainText("4 actions");

  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("Variable");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("aoe_threshold");

  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toContainText("Value");
  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toContainText("active_enemies");

  await expect(page.getByTestId("rf__node-action__0__actions__1")).toContainText("Call List");
  await expect(page.getByTestId("rf__node-action__0__actions__1")).toContainText("cds");

  await expect(page.getByTestId("rf__node-action__0__actions__2")).toContainText("Item");
  await expect(page.getByTestId("rf__node-action__0__actions__2")).not.toContainText("If");
  await expect(page.getByTestId("rf__node-action__0__actions__2")).toContainText(
    "treacherous_transmitter",
  );

});

test("collapses and expands block children from the preview graph", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  const actionsBlock = page.getByTestId("rf__node-block__0__actions");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toBeVisible();

  await actionsBlock
    .getByRole("button", { name: "Collapse block actions" })
    .click();

  await expect(page.getByTestId("rf__node-action__0__actions__0")).toHaveCount(0);
  await expect(page.getByTestId("rf__node-action__0__actions__1")).toHaveCount(0);
  await expect(page.getByTestId("rf__node-action__0__actions__2")).toHaveCount(0);
  await expect(page.getByTestId("rf__node-action__0__actions__3")).toHaveCount(0);
  await expect(
    page.getByTestId("rf__node-action__0__actions.precombat__0"),
  ).toBeVisible();

  await actionsBlock
    .getByRole("button", { name: "Expand block actions" })
    .click();

  await expect(page.getByTestId("rf__node-action__0__actions__0")).toBeVisible();
});

test("collapses and expands an action detail graph", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  const variableAction = page.getByTestId("rf__node-action__0__actions__0");
  await expect(variableAction).toContainText("aoe_threshold");
  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toBeVisible();
  await expect(page.getByTestId("rf__node-condition__0__actions__0__if")).toBeVisible();

  await variableAction
    .getByRole("button", { name: "Collapse action aoe_threshold" })
    .click();

  await expect(variableAction).toBeVisible();
  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toHaveCount(0);
  await expect(page.getByTestId("rf__node-condition__0__actions__0__if")).toHaveCount(0);

  await variableAction
    .getByRole("button", { name: "Expand action aoe_threshold" })
    .click();

  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toBeVisible();
});

test("expanding a block expands collapsed action details inside it", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  const actionsBlock = page.getByTestId("rf__node-block__0__actions");
  const variableAction = page.getByTestId("rf__node-action__0__actions__0");
  const valueNode = page.getByTestId(
    "rf__node-valueExpression__0__actions__0__value",
  );

  await expect(valueNode).toBeVisible();
  await variableAction
    .getByRole("button", { name: "Collapse action aoe_threshold" })
    .click();
  await expect(valueNode).toHaveCount(0);

  await actionsBlock
    .getByRole("button", { name: "Collapse block actions" })
    .click();
  await expect(variableAction).toHaveCount(0);

  await actionsBlock
    .getByRole("button", { name: "Expand block actions" })
    .click();

  await expect(variableAction).toBeVisible();
  await expect(valueNode).toBeVisible();
  await expect(
    variableAction.getByRole("button", { name: "Collapse action aoe_threshold" }),
  ).toBeVisible();
});

test("collapses and expands all block children from the canvas control", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-action__0__actions.precombat__0")).toBeVisible();
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toBeVisible();

  await page.getByRole("button", { name: "Collapse All" }).click();

  await expect(page.getByRole("button", { name: "Expand All" })).toBeVisible();
  await expect(page.getByTestId("rf__node-action__0__actions.precombat__0")).toHaveCount(0);
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toHaveCount(0);

  await page.getByRole("button", { name: "Expand All" }).click();

  await expect(page.getByRole("button", { name: "Collapse All" })).toBeVisible();
});

test("keeps the last good graph when a parse error occurs", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Paste APL...").fill(VALID_APL);
  await page.getByPlaceholder("Paste APL...").fill(INVALID_APL);

  await expect(page.getByText("Line 2:")).toBeVisible();
  await expect(
    page.getByText("Preview shows the last successful parse", { exact: false }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("rf__node-root__0")).toContainText("Demo Profile");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("auto_attack");
});
