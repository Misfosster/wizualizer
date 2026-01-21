import { expect, test } from "@playwright/test";

test("loads editor tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Write" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
  await expect(page.getByPlaceholder("Paste APL...")).toBeVisible();
});
