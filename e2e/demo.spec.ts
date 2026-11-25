import { expect, test } from "@playwright/test";

test("answers from the sample library with a citation that opens the passage", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-badge")).toContainText("Demo mode");
  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("button", { name: /passages Chunking and embeddings/ })).toBeVisible();
  }
  await page.getByTestId("composer").fill("Why do we overlap chunks before embedding them?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("tool-step").filter({ hasText: "Retrieve" })).toBeVisible();
  const assistant = page.getByTestId("assistant");
  await expect(assistant.getByTestId("citation").first()).toBeVisible();
  await assistant.getByTestId("citation").first().click();
  await expect(page.getByTestId("source-drawer")).toBeVisible();
  await expect(page.getByTestId("source-drawer")).toContainText(/Chunking and embeddings|overlap/i);
});

test("shows the calculator tool and its result", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("composer").fill("Calculate (12 + 8) * 3");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("tool-step").filter({ hasText: "Calculator" })).toBeVisible();
  await expect(page.getByTestId("assistant")).toContainText("60");
});

test("opens the library from the mobile menu", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile layout only");
  await page.goto("/");
  await page.getByTestId("library-toggle").click();
  await expect(page.getByTestId("library-sheet")).toBeVisible();
  await expect(page.getByTestId("library-sheet").getByRole("button", { name: /passages Evaluating a RAG system/ })).toBeVisible();
});
