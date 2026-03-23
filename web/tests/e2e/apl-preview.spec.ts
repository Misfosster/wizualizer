import { expect, test } from "@playwright/test";

const VALID_APL = [
  'shaman="Demo Profile"',
  "actions.precombat=windfury_weapon",
  "actions+=/auto_attack,if=active_enemies>1",
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
