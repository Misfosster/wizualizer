import { expect, test } from "@playwright/test";

const MOCK_PROFILE = [
  'monk="MID1_Monk_Windwalker"',
  "spec=windwalker",
  "actions.precombat=snapshot_stats",
  "actions=auto_attack",
].join("\n");

test("new apl menu can load a SimC default profile from GitHub", async ({
  page,
}) => {
  await page.route("**/raw.githubusercontent.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: MOCK_PROFILE,
    });
  });

  await page.goto("/");
  await page.getByTestId("apl-library-button").click();
  await page.getByTestId("new-apl-option").click();
  await page.getByTestId("new-apl-simc-default").click();
  await page.getByRole("option", { name: "Monk", exact: true }).click();
  await page.getByRole("option", { name: "Windwalker", exact: true }).click();

  await expect(page.getByTestId("apl-library-button")).toContainText(
    "MID1 Windwalker Monk",
  );
  await expect(page.getByTestId("apl-code-editor")).toContainText(
    "spec=windwalker",
  );
  await expect(page.getByTestId("apl-code-editor")).toContainText(
    "actions=auto_attack",
  );
});
