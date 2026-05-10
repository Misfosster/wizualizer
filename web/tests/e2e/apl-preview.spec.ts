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

const ACTION_LIST_JUMP_APL = [
  'monk="Demo Profile"',
  "actions+=/call_action_list,name=trinket",
  "actions+=/run_action_list,name=finish",
  "actions.trinket=tiger_palm",
  "actions.finish=blackout_kick",
].join("\n");

const MULTIPLE_VARIABLE_DEFINITION_APL = [
  'shaman="Demo Profile"',
  "actions+=/variable,name=foo,value=1",
  "actions+=/stormstrike,if=variable.foo>0",
  "actions+=/variable,name=foo,value=2",
  "actions+=/lava_lash,if=variable.foo>0",
].join("\n");

const COPY_FOCUS_APL = [
  'monk="Base Profile"',
  ...Array.from(
    { length: 60 },
    (_, index) => `actions+=/tiger_palm,if=variable.profile_anchor_${String(index)}=0`,
  ),
  'copy="Default"',
  "actions+=/rising_sun_kick",
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

async function saveApl(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openAplLibrary(page: Page): Promise<void> {
  if (!(await page.getByTestId("apl-library-menu").isVisible())) {
    await page.getByTestId("apl-library-button").click();
  }
}

async function openAplRowActions(page: Page, aplName: string): Promise<void> {
  await page
    .getByTestId("apl-library-row")
    .filter({ hasText: aplName })
    .getByRole("button", { name: `Actions for ${aplName}` })
    .click();
}

async function renameApl(
  page: Page,
  currentName: string,
  nextName: string,
): Promise<void> {
  await openAplLibrary(page);
  await openAplRowActions(page, currentName);
  await page
    .getByTestId("apl-library-row")
    .filter({ hasText: currentName })
    .getByRole("menuitem", { name: "Rename" })
    .click();
  await page.getByRole("textbox", { name: `Rename ${currentName}` }).fill(nextName);
  await page.getByRole("button", { name: "Apply" }).click();
}

async function renameCurrentApl(page: Page, nextName: string): Promise<void> {
  await page.getByRole("button", { name: /^Rename / }).click();
  await page.getByRole("textbox", { name: "Rename current APL" }).fill(nextName);
  await page.getByRole("button", { name: "Apply" }).click();
}

async function clickFoldMarkerForLine(
  page: Page,
  lineText: string,
): Promise<void> {
  const editor = page.getByTestId("apl-code-editor");
  const line = editor.locator(".cm-line").filter({ hasText: lineText }).first();
  const marker = line.locator(".lc-apl-editor-fold-marker").first();
  await expect(marker).toBeVisible();
  await marker.click();
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

test("call list arrow jumps to the target action list block", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, ACTION_LIST_JUMP_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  const targetBlock = page.getByTestId("rf__node-block__0__actions.trinket");
  await expect(targetBlock).toBeVisible();
  await page.locator('[data-call-list-jump="block__0__actions.trinket"]').click();

  await expect(targetBlock).toHaveClass(/lc-node-jump-highlight/);
});

test("graph search starts with matching blocks collapsed", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  const searchInput = page.locator("[data-graph-search-input]");
  await searchInput.fill("actions");

  const precombatSummary = page.locator(
    '[data-graph-search-block-summary="actions.precombat"]',
  );
  const actionsSummary = page.locator(
    '[data-graph-search-block-summary="actions"]',
  );
  const precombatAction = page.locator(
    '[data-graph-search-action="action__0__actions.precombat__0"]',
  );
  const actionsAction = page.locator(
    '[data-graph-search-action="action__0__actions__0"]',
  );
  await expect(precombatSummary).toBeVisible();
  await expect(actionsSummary).toBeVisible();

  // Search results keep the block list compact by default; expand only the
  // block you care about to reveal its matching actions.
  await expect(precombatAction).toBeHidden();
  await expect(actionsAction).toBeHidden();

  await precombatSummary.click();
  await expect(precombatAction).toBeVisible();
  await expect(actionsAction).toBeHidden();
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

test("keeps preview canvas mounted but hidden while writing", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);

  const previewPanel = page.getByRole("tabpanel", {
    name: "Preview",
    includeHidden: true,
  });
  await expect(previewPanel).toHaveCount(1);
  await expect(previewPanel).toHaveAttribute("aria-hidden", "true");
  await expect(previewPanel).toHaveAttribute("inert", "");
  await expect(page.locator(".react-flow")).not.toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(previewPanel).toHaveAttribute("aria-hidden", "false");
  await expect(previewPanel).not.toHaveAttribute("inert");
  await expect(page.locator(".react-flow")).toBeVisible();
});

test("keeps editor undo history across a Write Preview Write roundtrip", async ({
  page,
}) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);

  const editor = page.getByTestId("apl-code-editor-input");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nactions+=/bloodlust");
  await expect(editor).toContainText("bloodlust");

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("rf__node-action__0__actions__1")).toContainText(
    "bloodlust",
  );

  await page.getByRole("tab", { name: "Write" }).click();
  await editor.click();
  await page.keyboard.press("Control+Z");

  await expect(editor).not.toContainText("bloodlust");
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("rf__node-action__0__actions__1")).toHaveCount(0);
});

test("keeps editor scroll position across a Write Preview Write roundtrip", async ({
  page,
}) => {
  const longApl = [
    'monk="Demo Profile"',
    ...Array.from(
      { length: 90 },
      (_, index) => `actions+=/spell_${String(index)}`,
    ),
  ].join("\n");
  await page.goto("/");
  await fillAplEditor(page, longApl);

  const scroller = page.locator(".cm-scroller");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByRole("tab", { name: "Write" }).click();

  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
});

test("editor search opens with Ctrl+F and jumps between matches", async ({
  page,
}) => {
  await page.goto("/");
  await fillAplEditor(
    page,
    [
      'shaman="Demo Profile"',
      "actions+=/stormstrike",
      "actions+=/lava_lash",
      "actions+=/stormstrike",
    ].join("\n"),
  );

  await page.getByTestId("apl-code-editor-input").click();
  await page.keyboard.press("Control+F");

  const searchInput = page.locator("[data-apl-editor-search-input]");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("stormstrike");
  await expect(page.locator("[data-apl-editor-search-count]")).toHaveText("1/2");
  await expect(page.locator(".lc-apl-editor-search-match")).toHaveCount(2);

  await searchInput.press("Enter");
  await expect(page.locator("[data-apl-editor-search-count]")).toHaveText("2/2");
  await expect(
    page.locator(".lc-apl-editor-search-match--current"),
  ).toHaveCount(1);
});

test("preview starts focused on the editor's current copy profile", async ({
  page,
}) => {
  await page.goto("/");
  await fillAplEditor(page, COPY_FOCUS_APL);

  const scroller = page.locator(".cm-scroller");
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(
    page.getByTestId("apl-code-editor-input").getByText('copy="Default"'),
  ).toBeVisible();
  await page
    .getByTestId("apl-code-editor-input")
    .getByText('copy="Default"')
    .evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });
  await page.waitForTimeout(50);
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-root__1")).toContainText("Default");
  await expect(page.getByTestId("rf__node-root__0")).toHaveCount(0);
});

test("saves named APLs and switches between them", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VALID_APL);

  await expect(page.getByTestId("apl-save-status")).toHaveAttribute(
    "aria-label",
    "Save APL",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Control+S");
  await expect(page.getByTestId("apl-save-status")).toHaveAttribute(
    "aria-label",
    "Saved",
  );
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await renameCurrentApl(page, "Single target");

  await openAplLibrary(page);
  await page.getByTestId("new-apl-option").click();
  await expect(page.getByTestId("apl-library-button")).toContainText(
    "Untitled APL",
  );

  await fillAplEditor(page, STRUCTURAL_APL);
  await saveApl(page);
  await renameApl(page, "Untitled APL", "Structure test");

  await openAplLibrary(page);
  await openAplRowActions(page, "Structure test");
  await expect(
    page
      .getByTestId("apl-library-row")
      .filter({ hasText: "Structure test" })
      .getByRole("menuitem", { name: "Delete" }),
  ).toBeVisible();
  await page
    .getByTestId("apl-library-row")
    .filter({ hasText: "Structure test" })
    .getByRole("menuitem", { name: "Create copy" })
    .click();
  await expect(page.getByTestId("apl-library-button")).toContainText(
    "Structure test",
  );
  await expect(page.getByTestId("apl-library-menu")).toBeVisible();
  await expect(
    page.getByTestId("apl-library-row").filter({ hasText: "Structure test copy" }),
  ).toBeVisible();

  await page
    .getByTestId("apl-library-row")
    .filter({ hasText: "Single target" })
    .getByRole("button", { name: "Single target", exact: true })
    .click();
  await expect(page.getByTestId("apl-code-editor")).toContainText("auto_attack");
  await expect(page.getByTestId("apl-code-editor")).not.toContainText(
    "aoe_threshold",
  );

  await openAplLibrary(page);
  await page
    .getByTestId("apl-library-row")
    .filter({ hasText: "Structure test" })
    .getByRole("button", { name: "Structure test", exact: true })
    .click();
  await expect(page.getByTestId("apl-code-editor")).toContainText(
    "aoe_threshold",
  );
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toContainText(
    "aoe_threshold",
  );

  await page.getByRole("tab", { name: "Write" }).click();
  await page.waitForFunction(
    () =>
      window.localStorage
        .getItem("logiccraft.aplLibrary.v1")
        ?.includes("Structure test") &&
      window.localStorage
        .getItem("logiccraft.aplLibrary.v1")
        ?.includes("aoe_threshold"),
  );
  await page.reload();

  await expect(page.getByTestId("apl-library-button")).toContainText(
    "Structure test",
  );
  await expect(page.getByTestId("apl-code-editor")).toContainText(
    "aoe_threshold",
  );
});

test("auto-save persists editor changes without pressing Save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Auto-save APL" }).check();
  await fillAplEditor(page, VALID_APL);

  await page.waitForFunction(
    () =>
      window.localStorage.getItem("logiccraft.aplText")?.includes("auto_attack"),
  );

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Auto-save APL" })).toBeChecked();
  await expect(page.getByTestId("apl-code-editor")).toContainText("auto_attack");
});

test("renders custom structural node components in the preview graph", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, STRUCTURAL_APL);
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByTestId("rf__node-block__0__actions")).toContainText("Block");
  await expect(page.getByTestId("rf__node-block__0__actions")).toContainText("4 actions");

  const variableActionNode = page.getByTestId("rf__node-action__0__actions__0");
  await expect(variableActionNode).toHaveClass(/react-flow__node-variable/);
  await expect(variableActionNode).toContainText("aoe_threshold");

  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toContainText("Value");
  await expect(
    page.getByTestId("rf__node-valueExpression__0__actions__0__value"),
  ).toContainText("active_enemies");

  const callListActionNode = page.getByTestId("rf__node-action__0__actions__1");
  await expect(callListActionNode).toHaveClass(/react-flow__node-callActionList/);
  await expect(callListActionNode).toContainText("cds");

  const useItemActionNode = page.getByTestId("rf__node-action__0__actions__2");
  await expect(useItemActionNode).toHaveClass(/react-flow__node-useItem/);
  await expect(useItemActionNode).not.toContainText("If");
  await expect(useItemActionNode).toContainText("treacherous_transmitter");

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
  await saveApl(page);
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
  const editor = page.getByTestId("apl-code-editor-input");

  await clickFoldMarkerForLine(page, "actions.precombat=windfury_weapon");
  await expect(editor.getByText("flametongue_weapon")).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toBeVisible();

  await clickFoldMarkerForLine(page, "actions.precombat=windfury_weapon");
  await expect(editor.getByText("flametongue_weapon")).toBeVisible();

  await clickFoldMarkerForLine(
    page,
    "head=locus_of_the_primal_core,id=249979",
  );
  await expect(editor.getByText("amulet_of_the_abyssal_hymn")).toHaveCount(0);
  await expect(editor.getByText("gaze_of_the_alnseer")).toHaveCount(0);

  await clickFoldMarkerForLine(
    page,
    'profileset."AoE"+=talents=example_aoe',
  );
  await expect(editor.getByText("example_trinket")).toHaveCount(0);

  await clickFoldMarkerForLine(page, 'copy="Second Profile"');
  await expect(editor.getByText("stormstrike")).toHaveCount(0);
  await expect(editor.getByText("lava_lash")).toHaveCount(0);
});

test("folding a section keeps trailing comments and blank lines for the next section visible", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, FOLDING_APL_WITH_COMMENTS);
  const editor = page.getByTestId("apl-code-editor-input");

  await clickFoldMarkerForLine(page, "actions.aoe=voltaic_blaze,if=active_enemies>1");

  // The other action inside the aoe block is hidden and a placeholder is shown.
  await expect(editor.getByText("surging_totem")).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toBeVisible();

  // The header comment for the next section and the next section's actions
  // belong to that next section, not to the folded one, so they remain visible.
  await expect(editor.getByText("# Buff action priority list")).toBeVisible();
  await expect(editor.getByText("algethar_puzzle_box")).toBeVisible();
  await expect(editor.getByText("blood_fury")).toBeVisible();
});

test("single-line sequence actions do not show a working fold gutter marker", async ({ page }) => {
  const sequenceLine =
    "actions.opening=sequence,tiger_palm:zenith:rising_sun_kick:fists_of_fury";
  await page.goto("/");
  await fillAplEditor(
    page,
    ['monk="Demo Profile"', sequenceLine].join("\n"),
  );

  const editor = page.getByTestId("apl-code-editor");
  const sequenceRow = editor
    .locator(".cm-line")
    .filter({ hasText: sequenceLine })
    .first();
  await expect(sequenceRow.locator(".lc-apl-editor-fold-marker")).toHaveCount(0);
  await expect(page.locator(".cm-foldPlaceholder")).toHaveCount(0);
});

test("variable references are emphasized and show ctrl-hover affordance", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VARIABLE_JUMP_APL);
  const editor = page.getByTestId("apl-code-editor-input");

  await expect(editor.locator(".lc-apl-editor-variable-ref")).toContainText(
    "variable.aoe_threshold",
  );

  await page.keyboard.down("Control");
  await editor.getByText("variable.aoe_threshold").hover();
  await expect(editor.locator(".lc-apl-editor-variable-ref--hover")).toContainText(
    "variable.aoe_threshold",
  );
  await page.keyboard.up("Control");
});

test("ctrl-clicking a variable reference jumps to its definition", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, VARIABLE_JUMP_APL);
  const editor = page.getByTestId("apl-code-editor-input");

  await editor.getByText("variable.aoe_threshold").click({
    modifiers: ["Control"],
  });

  await expect(page.locator(".lc-apl-editor-jump-target-line")).toContainText(
    "name=aoe_threshold",
  );
});

test("ctrl-clicking a call_action_list target jumps to its action list", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, ACTION_LIST_JUMP_APL);
  const editor = page.getByTestId("apl-code-editor-input");
  const target = editor.locator(".lc-apl-editor-action-list-ref", {
    hasText: "trinket",
  });

  await expect(target).toHaveText("trinket");

  await page.keyboard.down("Control");
  await target.hover();
  await expect(
    editor.locator(".lc-apl-editor-action-list-ref--hover"),
  ).toContainText("trinket");
  await page.keyboard.up("Control");

  await target.click({
    modifiers: ["Control"],
  });

  await expect(page.locator(".lc-apl-editor-jump-target-line")).toContainText(
    "actions.trinket=tiger_palm",
  );
});

test("ctrl-clicking a variable reference uses the nearest earlier definition", async ({ page }) => {
  await page.goto("/");
  await fillAplEditor(page, MULTIPLE_VARIABLE_DEFINITION_APL);
  const editor = page.getByTestId("apl-code-editor-input");

  await editor.getByText("variable.foo").nth(1).click({
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
  const editor = page.getByTestId("apl-code-editor-input");

  await editor.getByText("variable.missing").click({
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
