import { test, expect } from "./fixtures/extension";

test.describe("Sidepanel", () => {
  test("should display settings page when no API key is configured", async ({
    context,
    sidepanelUrl,
  }) => {
    // Open the sidepanel (without API key, it should show settings)
    const page = await context.newPage();
    await page.goto(sidepanelUrl);
    await page.waitForLoadState("networkidle");

    // Verify settings page is shown (extension auto-redirects when no API key)
    await expect(page.getByText("Spark Settings")).toBeVisible();
    await expect(page.getByText("API Key")).toBeVisible();
    await expect(page.getByText("Save Settings")).toBeVisible();
  });

  test("should navigate to chat view after clicking Back to Chat", async ({
    context,
    sidepanelUrl,
  }) => {
    const page = await context.newPage();
    await page.goto(sidepanelUrl);
    await page.waitForLoadState("networkidle");

    // Click "Back to Chat" button
    await page.getByText("Back to Chat").click();

    // Wait for chat view to appear
    await page.waitForLoadState("networkidle");

    // Now we should see the chat view with welcome message
    const welcomeMessage = page.getByTestId("welcome-message");
    await expect(welcomeMessage).toBeVisible({ timeout: 10000 });

    // Verify task input is visible
    const taskInput = page.getByTestId("task-input");
    await expect(taskInput).toBeVisible();
    await expect(taskInput).toBeEnabled();

    // Verify send button is visible but disabled (empty input)
    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();

    // Verify settings button is visible
    const settingsButton = page.getByTestId("settings-button");
    await expect(settingsButton).toBeVisible();
  });

  test("should enable send button when text is entered", async ({ context, sidepanelUrl }) => {
    const page = await context.newPage();
    await page.goto(sidepanelUrl);
    await page.waitForLoadState("networkidle");

    // Navigate to chat view
    await page.getByText("Back to Chat").click();
    await page.waitForLoadState("networkidle");

    const taskInput = page.getByTestId("task-input");
    const sendButton = page.getByTestId("send-button");

    // Initially disabled
    await expect(sendButton).toBeDisabled();

    // Type some text
    await taskInput.fill("Test task");

    // Should be enabled now
    await expect(sendButton).toBeEnabled();
  });

  test("should open settings when clicking settings button", async ({ context, sidepanelUrl }) => {
    const page = await context.newPage();
    await page.goto(sidepanelUrl);
    await page.waitForLoadState("networkidle");

    // Navigate to chat view first
    await page.getByText("Back to Chat").click();
    await page.waitForLoadState("networkidle");

    // Click settings button
    const settingsButton = page.getByTestId("settings-button");
    await settingsButton.click();

    // Should be back on settings page
    await expect(page.getByText("Spark Settings")).toBeVisible();
    await expect(page.getByText("API Key")).toBeVisible();
  });
});
