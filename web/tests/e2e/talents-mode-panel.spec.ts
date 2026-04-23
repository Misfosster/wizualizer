import { expect, test, type Page } from "@playwright/test";
import { MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT } from "./support/talent-export";

const SHAMAN_WITHOUT_TALENTS = [
  'shaman="Demo Profile"',
  "spec=enhancement",
  "actions.precombat=windfury_weapon",
  "actions+=/auto_attack",
].join("\n");

const SHAMAN_WITH_TALENTS = [
  'shaman="Demo Profile"',
  "spec=enhancement",
  `talents=${MIDNIGHT_ENHANCEMENT_TOTEMIC_EXPORT}`,
  "actions.precombat=windfury_weapon",
  "actions+=/auto_attack",
].join("\n");

const TWO_PROFILES = [
  'shaman="Enhance Profile"',
  "spec=enhancement",
  "actions.precombat=windfury_weapon",
  'mage="Fire Profile"',
  "spec=fire",
  "talents=CafdMaybeCorrupted",
  "actions=fireball",
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

test("talent mode panel is visible in the Preview tab with Dim selected by default", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const panel = page.locator("[data-talent-mode-panel]");
  await expect(panel).toBeVisible();

  const dimButton = panel.locator('[data-talent-mode="dim"]');
  await expect(dimButton).toHaveAttribute("aria-checked", "true");

  await expect(panel.locator('[data-talent-mode="off"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(panel.locator('[data-talent-mode="hide"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("clicking a different mode button updates aria-checked across the segmented control", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const panel = page.locator("[data-talent-mode-panel]");
  await panel.locator('[data-talent-mode="hide"]').click();

  await expect(panel.locator('[data-talent-mode="hide"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(panel.locator('[data-talent-mode="dim"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(panel.locator('[data-talent-mode="off"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

test("the selected talent mode is persisted across reloads", async ({ page }) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const panel = page.locator("[data-talent-mode-panel]");
  await panel.locator('[data-talent-mode="off"]').click();
  await page.waitForFunction(
    () => window.localStorage.getItem("logiccraft.talentRenderMode") === "off",
  );

  await page.reload();
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(
    page.locator('[data-talent-mode-panel] [data-talent-mode="off"]'),
  ).toHaveAttribute("aria-checked", "true");
});

test("a profile without a talents= line surfaces the absent info row", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const list = page.locator("[data-talent-status-list]");
  await expect(list.getByRole("listitem")).toHaveCount(1);

  const row = list.getByRole("listitem").first();
  // Heading is the profile name (what the user typed after shaman=), not
  // the spec, so copy= siblings stay distinguishable.
  await expect(row).toContainText("Demo Profile");
  await expect(row).toContainText("no talents= line");
  await expect(row).toHaveAttribute("data-talent-row-tone", "info");
});

test("a profile whose class has a committed catalog decodes its talents string", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITH_TALENTS);

  const row = page
    .locator("[data-talent-status-list]")
    .getByRole("listitem")
    .first();
  // The catalog resolves asynchronously, so wait for the row to settle
  // into its final state instead of the transient "loading" phase.
  await expect(row).toContainText("Demo Profile");
  await expect(row).toContainText("talents loaded");
  await expect(row).not.toContainText(/\d+\s+talents loaded/);
  await expect(row).toHaveAttribute("data-talent-row-tone", "info");
});

test("each parsed profile gets its own status row in panel order", async ({ page }) => {
  await gotoPreview(page, TWO_PROFILES);

  const rows = page
    .locator("[data-talent-status-list]")
    .getByRole("listitem");
  await expect(rows).toHaveCount(2);

  // Both classes have committed catalogs, so the first row lands on
  // `absent` (no talents= line) and the second on a version mismatch.
  await expect(rows.nth(0)).toContainText("Enhance Profile");
  await expect(rows.nth(0)).toContainText("no talents= line");
  await expect(rows.nth(0)).toHaveAttribute("data-talent-row-tone", "info");

  await expect(rows.nth(1)).toContainText("Fire Profile");
  await expect(rows.nth(1)).toContainText(
    "different spec or talent tree version",
  );
  await expect(rows.nth(1)).toHaveAttribute("data-talent-row-tone", "warning");
});

test("switching to Off persists and removes the active styling from Dim", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const panel = page.locator("[data-talent-mode-panel]");
  await panel.locator('[data-talent-mode="off"]').click();

  await expect(panel.locator('[data-talent-mode="off"]')).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(panel.locator('[data-talent-mode="dim"]')).toHaveAttribute(
    "data-active",
    "false",
  );
});

test("the empty-graph placeholder is not shown when nodes are present", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  await page
    .locator("[data-talent-mode-panel] [data-talent-mode=\"hide\"]")
    .click();

  // The graph stays populated for this simple sample and the placeholder
  // must remain hidden. This guards against the placeholder leaking into
  // the normal Hide-mode path.
  await expect(page.locator("[data-empty-graph-placeholder]")).toHaveCount(0);
  await expect(page.getByTestId("rf__node-action__0__actions__0")).toBeVisible();
});

test("the panel collapse toggle hides the body and persists across reloads", async ({
  page,
}) => {
  await gotoPreview(page, SHAMAN_WITHOUT_TALENTS);

  const panel = page.locator("[data-talent-mode-panel]");
  const toggle = panel.locator("[data-talent-panel-toggle]");
  const modeList = panel.getByRole("radiogroup");
  const statusList = panel.locator("[data-talent-status-list]");

  // Expanded by default: segmented control and status list are visible.
  await expect(panel).toHaveAttribute("data-talent-panel-collapsed", "false");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(modeList).toBeVisible();
  await expect(statusList).toBeVisible();

  await toggle.click();

  // Collapsed: body is gone, header + toggle remain so the user can reopen.
  await expect(panel).toHaveAttribute("data-talent-panel-collapsed", "true");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(modeList).toHaveCount(0);
  await expect(statusList).toHaveCount(0);

  await page.waitForFunction(
    () =>
      window.localStorage.getItem("logiccraft.talentPanelCollapsed") === "1",
  );

  await page.reload();
  await page.getByRole("tab", { name: "Preview" }).click();

  // Persisted across reload.
  const reopenedPanel = page.locator("[data-talent-mode-panel]");
  await expect(reopenedPanel).toHaveAttribute(
    "data-talent-panel-collapsed",
    "true",
  );
  await expect(reopenedPanel.getByRole("radiogroup")).toHaveCount(0);

  await reopenedPanel.locator("[data-talent-panel-toggle]").click();
  await expect(reopenedPanel).toHaveAttribute(
    "data-talent-panel-collapsed",
    "false",
  );
  await expect(reopenedPanel.getByRole("radiogroup")).toBeVisible();
});
