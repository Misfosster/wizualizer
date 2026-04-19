import { expect, test, type Page } from "@playwright/test";

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

const VARIABLE_JUMP_APL = [
  'shaman="Demo Profile"',
  "actions+=/variable,name=aoe_threshold,value=active_enemies",
  "actions+=/stormstrike,if=variable.aoe_threshold>1",
].join("\n");

const MULTIPLE_VARIABLE_DEFINITION_APL = [
  'shaman="Demo Profile"',
  "actions+=/variable,name=foo,value=1",
  "actions+=/stormstrike,if=variable.foo>0",
  "actions+=/variable,name=foo,value=2",
  "actions+=/lava_lash,if=variable.foo>0",
].join("\n");

const FOLDING_APL = [
  'shaman="Demo Profile"',
  "actions.precombat=windfury_weapon",
  "actions.precombat+=/flametongue_weapon",
  "actions=auto_attack",
  "head=locus_of_the_primal_core,id=249979",
  "neck=amulet_of_the_abyssal_hymn,id=250247",
  "trinket1=gaze_of_the_alnseer,id=249343",
  'profileset."AoE"+=talents=example_aoe',
  'profileset."AoE"+=trinket1=example_trinket',
  'copy="Second Profile"',
  "actions=stormstrike",
  "actions+=/lava_lash",
].join("\n");

// Real-world layout: each action subgroup is preceded by a header comment
// and separated from the previous subgroup by blank lines. Folding the
// `aoe` section should keep the trailing whitespace and the `# Buff …`
// header visible because they belong to the next section.
const FOLDING_APL_WITH_COMMENTS = [
  'shaman="Demo Profile"',
  "# Multi target action priority list",
  "actions.aoe=voltaic_blaze,if=active_enemies>1",
  "actions.aoe+=/surging_totem",
  "",
  "",
  "# Buff action priority list",
  "actions.buffs=use_item,name=algethar_puzzle_box",
  "actions.buffs+=/blood_fury",
].join("\n");

async function fillAplEditor(page: Page, text: string): Promise<void> {
  await page.getByRole("textbox", { name: "APL editor" }).fill(text);
}

async function clickFoldMarkerForLine(
  page: Page,
  lineText: string,
): Promise<void> {
  const lineBox = await page.getByText(lineText).boundingBox();
  const gutterBox = await page.locator(".cm-foldGutter").boundingBox();
  expect(lineBox).toBeTruthy();
  expect(gutterBox).toBeTruthy();
  if (!lineBox || !gutterBox) {
    throw new Error(`Expected fold marker for line: ${lineText}`);
  }

  await page.mouse.click(
    gutterBox.x + gutterBox.width / 2,
    lineBox.y + lineBox.height / 2,
  );
}

test("renders parsed APL text in the preview graph", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);
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
  await fillAplEditor(page, STRUCTURAL_APL);
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
  await fillAplEditor(page, STRUCTURAL_APL);
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
  await fillAplEditor(page, STRUCTURAL_APL);
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
  await fillAplEditor(page, STRUCTURAL_APL);
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
  await fillAplEditor(page, STRUCTURAL_APL);
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
  await fillAplEditor(page, VALID_APL);
  await fillAplEditor(page, INVALID_APL);

  await expect(page.getByText("Line 2:")).toBeVisible();
  await expect(
    page.getByTestId("apl-code-editor").locator(".lc-apl-editor-error-line"),
  ).toBeVisible();
  await expect(
    page.getByText("Preview shows the last successful parse", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to line 2" }).click();
  await expect(page.locator(".lc-apl-editor-jump-target-line")).toContainText(
    "actions+=/auto_attack,if=floor(",
  );

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("rf__node-root__0")).toContainText("Demo Profile");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("auto_attack");
});

test("highlights a restored parse error when a saved fallback graph exists", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);
  await fillAplEditor(
    page,
    [
      "actions=asdasd/bloodlust,line_cd=600",
      "actions+=/auto_attack",
    ].join("\n"),
  );

  await expect(page.getByText("Line 1:")).toBeVisible();
  await page.waitForFunction(
    () =>
      window.localStorage.getItem("logiccraft.aplText")?.includes("asdasd"),
  );

  await page.reload();

  await expect(page.getByText("Line 1:")).toBeVisible();
  await expect(
    page.getByTestId("apl-code-editor").locator(".lc-apl-editor-error-line"),
  ).toContainText("actions=asdasd/bloodlust,line_cd=600");
  await expect(page.getByRole("button", { name: "Go to line 1" })).toBeVisible();
});

test("folds action blocks and copied profile sections in the editor", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, FOLDING_APL);

  await clickFoldMarkerForLine(page, "actions.precombat=windfury_weapon");
  await expect(page.getByText("flametongue_weapon")).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toBeVisible();

  await clickFoldMarkerForLine(page, "actions.precombat=windfury_weapon");
  await expect(page.getByText("flametongue_weapon")).toBeVisible();

  await clickFoldMarkerForLine(
    page,
    "head=locus_of_the_primal_core,id=249979",
  );
  await expect(page.getByText("amulet_of_the_abyssal_hymn")).toHaveCount(0);
  await expect(page.getByText("gaze_of_the_alnseer")).toHaveCount(0);

  await clickFoldMarkerForLine(
    page,
    'profileset."AoE"+=talents=example_aoe',
  );
  await expect(page.getByText("example_trinket")).toHaveCount(0);

  await clickFoldMarkerForLine(page, 'copy="Second Profile"');
  await expect(page.getByText("stormstrike")).toHaveCount(0);
  await expect(page.getByText("lava_lash")).toHaveCount(0);
});

test("folding a section keeps trailing comments and blank lines for the next section visible", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, FOLDING_APL_WITH_COMMENTS);

  await clickFoldMarkerForLine(page, "actions.aoe=voltaic_blaze,if=active_enemies>1");

  // The other action inside the aoe block is hidden and a placeholder is shown.
  await expect(page.getByText("surging_totem")).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toBeVisible();

  // The header comment for the next section and the next section's actions
  // belong to that next section, not to the folded one, so they remain visible.
  await expect(page.getByText("# Buff action priority list")).toBeVisible();
  await expect(page.getByText("algethar_puzzle_box")).toBeVisible();
  await expect(page.getByText("blood_fury")).toBeVisible();
});

test("variable references are emphasized and show ctrl-hover affordance", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VARIABLE_JUMP_APL);

  await expect(page.locator(".lc-apl-editor-variable-ref")).toContainText(
    "variable.aoe_threshold",
  );

  await page.keyboard.down("Control");
  await page.getByText("variable.aoe_threshold").hover();
  await expect(page.locator(".lc-apl-editor-variable-ref--hover")).toContainText(
    "variable.aoe_threshold",
  );
  await page.keyboard.up("Control");
});

test("ctrl-clicking a variable reference jumps to its definition", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VARIABLE_JUMP_APL);

  await page.getByText("variable.aoe_threshold").click({
    modifiers: ["Control"],
  });

  await expect(page.locator(".lc-apl-editor-jump-target-line")).toContainText(
    "name=aoe_threshold",
  );
});

test("ctrl-clicking a variable reference uses the nearest earlier definition", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, MULTIPLE_VARIABLE_DEFINITION_APL);

  await page.getByText("variable.foo").nth(1).click({
    modifiers: ["Control"],
  });

  await expect(page.locator(".lc-apl-editor-jump-target-line")).toContainText(
    "value=2",
  );
});

test("ctrl-clicking an unresolved variable reference does not jump", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(
    page,
    'shaman="Demo Profile"\nactions+=/stormstrike,if=variable.missing>0',
  );

  await page.getByText("variable.missing").click({
    modifiers: ["Control"],
  });

  await expect(page.locator(".lc-apl-editor-jump-target-line")).toHaveCount(0);
});

test("clicking below the last editor line moves the cursor to document end", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, 'shaman="Demo Profile"');

  const editor = page.getByRole("textbox", { name: "APL editor" });
  await editor.press("Home");

  const scrollerBox = await page
    .getByTestId("apl-code-editor")
    .locator(".cm-scroller")
    .boundingBox();
  expect(scrollerBox).toBeTruthy();
  if (!scrollerBox) {
    throw new Error("Expected CodeMirror scroller to be visible");
  }

  await page.mouse.click(
    scrollerBox.x + 120,
    scrollerBox.y + scrollerBox.height - 24,
  );
  await page.keyboard.type("\nactions+=/auto_attack");
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-root__0")).toContainText("Demo Profile");
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText("auto_attack");
});
