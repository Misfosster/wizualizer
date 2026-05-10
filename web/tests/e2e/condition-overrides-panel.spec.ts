import { expect, test, type Page } from "@playwright/test";
import { MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT } from "./support/talent-export";

const PROFILE_WITH_CONDITIONS = [
  'shaman="Demo Profile"',
  "spec=enhancement",
  `talents=${MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT}`,
  "actions=auto_attack",
  "actions+=/lava_lash,if=buff.hot_hand.up",
  "actions+=/stormstrike,if=talent.storm_unleashed.enabled",
  "actions+=/blood_fury,if=cooldown.blood_fury.duration>0",
  "actions+=/fireblood,if=action.fireblood.cooldown",
  "actions+=/chain_lightning,if=active_enemies",
].join("\n");

const DUPLICATE_PROFILE_NAMES = [
  'shaman="Same"',
  "actions+=/lava_lash,if=buff.first.up",
  "",
  'shaman="Same"',
  "actions+=/stormstrike,if=buff.second.up",
].join("\n");

const MULTI_PROFILE_CONDITION_SCOPES = [
  'shaman="Enhance"',
  "spec=enhancement",
  "actions=stormstrike,if=cooldown.doom_winds.remains>0&fight_remains<30",
  "",
  'monk="Windwalker"',
  "spec=windwalker",
  "actions=tiger_palm,if=energy>50&fight_remains<30",
].join("\n");

async function fillAplEditor(page: Page, text: string): Promise<void> {
  await page.getByRole("textbox", { name: "APL editor" }).fill(text);
}

async function gotoPreview(page: Page, apl: string): Promise<void> {
  await page.goto("/");
  await fillAplEditor(page, apl);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("tab", { name: "Preview" }).click();
}

test("per-profile talent atom pills are disabled while global talent atoms are editable", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  const globalSection = page.locator("[data-condition-overrides-section]");
  await expect(globalSection.locator("[data-condition-override-row]")).toHaveCount(
    0,
  );

  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();
  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );

  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("talent.storm");
  await profileSection
    .locator(
      '[data-profile-condition-overrides-suggestion="talent.storm_unleashed.enabled"]',
    )
    .click();

  const profileTalentPill = profileSection.locator(
    '[data-condition-override-pill="talent.storm_unleashed.enabled"]',
  );
  await expect(
    profileTalentPill.locator('[data-condition-override-value="default"]'),
  ).toHaveCount(0);
  await expect(
    profileTalentPill.locator('[data-condition-override-value="true"]'),
  ).toBeDisabled();
  await expect(
    profileTalentPill.locator('[data-condition-override-value="false"]'),
  ).toBeDisabled();

  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("buff.hot");
  await profileSection
    .locator(
      '[data-profile-condition-overrides-suggestion="buff.hot_hand.up"]',
    )
    .click();

  const profileBuffPill = profileSection.locator(
    '[data-condition-override-pill="buff.hot_hand.up"]',
  );
  await expect(
    profileBuffPill.locator('[data-condition-override-value="false"]'),
  ).toBeEnabled();

  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("cooldown.blood");
  await profileSection
    .locator(
      '[data-profile-condition-overrides-suggestion="cooldown.blood_fury.duration"]',
    )
    .click();
  await expect(
    profileSection.locator(
      '[data-condition-override-number="cooldown.blood_fury.duration"]',
    ),
  ).toBeVisible();
  await expect(
    profileSection
      .locator('[data-condition-override-namespace="cooldown"]')
      .getByText("Cooldowns"),
  ).toBeVisible();
  await expect(
    profileSection.locator(
      '[data-condition-override-pill="cooldown.blood_fury.duration"]',
    ),
  ).toHaveCount(0);

  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("cooldown.fireblood");
  await profileSection
    .locator(
      '[data-profile-condition-overrides-suggestion="action.fireblood.cooldown"]',
    )
    .click();
  const cooldownPill = profileSection.locator(
    '[data-condition-override-pill="action.fireblood.cooldown"]',
  );
  await expect(
    profileSection.locator(
      '[data-condition-override-number="action.fireblood.cooldown"]',
    ),
  ).toHaveCount(0);
  await expect(
    cooldownPill.locator('[data-condition-override-value="true"]'),
  ).toHaveText("Up");
  await expect(
    cooldownPill.locator('[data-condition-override-value="false"]'),
  ).toHaveText("Down");

  await globalSection
    .locator("[data-condition-overrides-search]")
    .fill("talent.storm");
  await globalSection
    .locator(
      '[data-condition-overrides-suggestion="talent.storm_unleashed.enabled"]',
    )
    .click();

  const globalTalentPill = globalSection.locator(
    '[data-condition-override-pill="talent.storm_unleashed.enabled"]',
  );
  await expect(
    globalSection
      .locator('[data-condition-override-namespace="talent"]')
      .getByText("Talents"),
  ).toBeVisible();
  await expect(
    globalTalentPill.locator('[data-condition-override-value="false"]'),
  ).toBeEnabled();
});

test("per-profile override dims the matching action and persists across reload", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  const lavaLash = page.getByTestId("rf__node-action__0__actions__1");
  await expect(lavaLash.locator('[data-talent-state="normal"]')).toBeVisible();

  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();
  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("buff.hot_hand.up");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");
  await profileSection
    .locator(
      '[data-condition-override-pill="buff.hot_hand.up"] [data-condition-override-value="false"]',
    )
    .click();

  await expect(
    lavaLash.locator('[data-talent-state="impossible"]'),
  ).toBeVisible();
  await expect(
    lavaLash.locator('[data-talent-state="impossible"]'),
  ).toHaveAttribute("data-talent-reason", "forced off by override");
  await expect(
    profileSection.locator('[data-condition-override-row="buff.hot_hand.up"]'),
  ).toHaveAttribute("data-condition-override-overridden", "true");
  await page.waitForFunction(() =>
    window.localStorage
      .getItem("logiccraft.conditionOverrides.v1")
      ?.includes("buff.hot_hand.up"),
  );
  await page.waitForFunction(() =>
    window.localStorage.getItem("logiccraft.aplText")?.includes("lava_lash"),
  );

  await page.reload();
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(
    page
      .getByTestId("rf__node-action__0__actions__1")
      .locator('[data-talent-state="impossible"]'),
  ).toBeVisible();
});

test("hide true conditions toggle removes resolved condition nodes", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  const lavaLashCondition = page.getByTestId(
    "rf__node-condition__0__actions__1__if",
  );
  await expect(lavaLashCondition).toBeVisible();

  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();
  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("buff.hot_hand.up");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");
  await profileSection
    .locator(
      '[data-condition-override-pill="buff.hot_hand.up"] [data-condition-override-value="true"]',
    )
    .click();

  await expect(lavaLashCondition).toBeVisible();
  await page.locator("[data-hide-true-conditions-toggle]").check();
  await expect(lavaLashCondition).toHaveCount(0);
  await page.waitForFunction(
    () =>
      window.localStorage.getItem("logiccraft.hideTrueConditions") === "1",
  );
});

test("duplicate profile rows expose display-name and scope-key attributes", async ({
  page,
}) => {
  await gotoPreview(page, DUPLICATE_PROFILE_NAMES);

  await expect(
    page.locator('[data-profile-condition-overrides-toggle="Same"]'),
  ).toHaveCount(2);

  const firstRow = page.locator(
    '[data-talent-row-tone][data-profile-scope-key="profile:shaman:Same:0"]',
  );
  const secondRow = page.locator(
    '[data-talent-row-tone][data-profile-scope-key="profile:shaman:Same:1"]',
  );
  await firstRow.locator('[data-profile-condition-overrides-toggle="Same"]').click();
  await secondRow.locator('[data-profile-condition-overrides-toggle="Same"]').click();

  await expect(
    page.locator('[data-profile-condition-overrides-section="Same"]'),
  ).toHaveCount(2);
  await expect(
    page.locator(
      '[data-profile-condition-overrides-section="Same"][data-profile-scope-key="profile:shaman:Same:0"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-profile-condition-overrides-section="Same"][data-profile-scope-key="profile:shaman:Same:1"]',
    ),
  ).toBeVisible();
});

test("condition suggestions stay scoped to the matching profile", async ({
  page,
}) => {
  await gotoPreview(page, MULTI_PROFILE_CONDITION_SCOPES);

  const globalSection = page.locator("[data-condition-overrides-section]");
  await globalSection.locator("[data-condition-overrides-search]").fill("fight");
  await expect(
    globalSection.locator(
      '[data-condition-overrides-suggestion="fight_remains"]',
    ),
  ).toBeVisible();

  await globalSection.locator("[data-condition-overrides-search]").fill("doom");
  await expect(
    globalSection.locator(
      '[data-condition-overrides-suggestion="cooldown.doom_winds.remains"]',
    ),
  ).toHaveCount(0);

  await page
    .locator('[data-profile-condition-overrides-toggle="Enhance"]')
    .click();
  const enhanceSection = page.locator(
    '[data-profile-condition-overrides-section="Enhance"]',
  );
  await enhanceSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("doom");
  await expect(
    enhanceSection.locator(
      '[data-profile-condition-overrides-suggestion="cooldown.doom_winds.remains"]',
    ),
  ).toBeVisible();

  await page
    .locator('[data-profile-condition-overrides-toggle="Windwalker"]')
    .click();
  const windwalkerSection = page.locator(
    '[data-profile-condition-overrides-section="Windwalker"]',
  );
  await windwalkerSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("doom");
  await expect(
    windwalkerSection.locator(
      '[data-profile-condition-overrides-suggestion="cooldown.doom_winds.remains"]',
    ),
  ).toHaveCount(0);
});

test("numeric per-profile overrides use a number field", async ({ page }) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  const bloodFury = page.getByTestId("rf__node-action__0__actions__3");
  await expect(bloodFury.locator('[data-talent-state="normal"]')).toBeVisible();

  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();
  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("cooldown.blood_fury.duration");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");

  const numberInput = profileSection.locator(
    '[data-condition-override-number-input="cooldown.blood_fury.duration"]',
  );
  await expect(numberInput).toBeVisible();
  await expect(
    profileSection.locator(
      '[data-condition-override-number="cooldown.blood_fury.duration"] [data-condition-override-value="default"]',
    ),
  ).toHaveCount(0);
  await numberInput.fill("0");

  await expect(
    bloodFury.locator('[data-talent-state="impossible"]'),
  ).toBeVisible();

  await numberInput.fill("");
  await expect(bloodFury.locator('[data-talent-state="normal"]')).toBeVisible();

  await numberInput.fill("0");
  await profileSection
    .locator(
      '[data-condition-override-remove="cooldown.blood_fury.duration"]',
    )
    .click();
  await expect(
    profileSection.locator(
      '[data-condition-override-row="cooldown.blood_fury.duration"]',
    ),
  ).toHaveCount(0);
  await expect(bloodFury.locator('[data-talent-state="normal"]')).toBeVisible();
});

test("active_enemies per-profile override uses a number field", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();
  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("active_enemies");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");

  await expect(
    profileSection.locator(
      '[data-condition-override-number="active_enemies"]',
    ),
  ).toBeVisible();
  await expect(
    profileSection.locator('[data-condition-override-pill="active_enemies"]'),
  ).toHaveCount(0);
});

test("hide mode removes override-impossible actions from the graph", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  await page.locator('[data-talent-mode="hide"]').click();
  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();

  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("buff.hot_hand.up");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");
  await profileSection
    .locator(
      '[data-condition-override-pill="buff.hot_hand.up"] [data-condition-override-value="false"]',
    )
    .click();

  await expect(
    page.locator('[data-talent-row-summary]').getByText("1 override action hidden"),
  ).toBeVisible();
  await expect(page.getByTestId("rf__node-action__0__actions__1")).toHaveCount(0);
});

test("jump to hidden action switches hide mode to dim and focuses graph target", async ({
  page,
}) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  await page.locator('[data-talent-mode="hide"]').click();
  await page
    .locator('[data-profile-condition-overrides-toggle="Demo Profile"]')
    .click();

  const profileSection = page.locator(
    '[data-profile-condition-overrides-section="Demo Profile"]',
  );
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .fill("buff.hot_hand.up");
  await profileSection
    .locator("[data-profile-condition-overrides-search]")
    .press("Enter");
  await profileSection
    .locator(
      '[data-condition-override-pill="buff.hot_hand.up"] [data-condition-override-value="false"]',
    )
    .click();

  await page.locator("[data-talent-row-summary]").first().click();
  await page
    .locator('[data-hidden-action-jump="action__0__actions__1"]')
    .first()
    .click();

  await expect(page.locator('[data-talent-mode="dim"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    page
      .getByTestId("rf__node-action__0__actions__1")
      .locator('[data-talent-state="impossible"]'),
  ).toBeVisible();
});

test("global overrides can add custom alias conditions", async ({ page }) => {
  await gotoPreview(page, PROFILE_WITH_CONDITIONS);

  const globalSection = page.locator("[data-condition-overrides-section]");
  await globalSection
    .locator("[data-condition-overrides-search]")
    .fill("buff.outcrash_lightning.stacks>0");
  await globalSection
    .locator(
      '[data-condition-overrides-suggestion="buff.outcrash_lightning.up"]',
    )
    .click();

  await expect(
    globalSection
      .locator('[data-condition-override-namespace="buff"]')
      .getByText("Buffs"),
  ).toBeVisible();
  const customPill = globalSection.locator(
    '[data-condition-override-pill="buff.outcrash_lightning.up"]',
  );
  await expect(customPill).toBeVisible();
  await expect(customPill.locator('[data-condition-override-value="true"]'))
    .toBeEnabled();

  const before = await customPill.boundingBox();
  expect(before).not.toBeNull();
  await customPill.locator('[data-condition-override-value="true"]').click();
  const afterOn = await customPill.boundingBox();
  expect(afterOn).not.toBeNull();
  await customPill.locator('[data-condition-override-value="false"]').click();
  const afterOff = await customPill.boundingBox();
  expect(afterOff).not.toBeNull();
  expect(Math.abs((afterOn?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1);
  expect(Math.abs((afterOff?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1);
  expect(Math.abs((afterOn?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(
    1,
  );
  expect(Math.abs((afterOff?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(
    1,
  );

  await globalSection
    .locator('[data-condition-override-remove="buff.outcrash_lightning.up"]')
    .click();
  await expect(
    globalSection.locator(
      '[data-condition-override-row="buff.outcrash_lightning.up"]',
    ),
  ).toHaveCount(0);
});
