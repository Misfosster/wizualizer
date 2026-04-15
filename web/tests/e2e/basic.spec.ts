import { expect, test } from "@playwright/test";

test("loads editor tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("tab", { name: "Write" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "APL editor" })).toBeVisible();
  await expect(page.getByTestId("apl-code-editor")).toBeVisible();
  await expect(
    page.getByTestId("apl-code-editor").locator(".cm-lineNumbers"),
  ).toBeVisible();
});
