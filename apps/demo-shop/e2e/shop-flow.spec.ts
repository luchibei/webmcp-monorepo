import { expect, test } from "@playwright/test";

test.describe("demo-shop flows", () => {
  test("home -> cart -> checkout basic flow", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-testid^="add-to-cart-"]').first().click();
    await page.getByTestId("nav-cart-link").click();

    await expect(page.getByTestId("cart-page")).toBeVisible();
    await expect(page.locator('[data-testid^="cart-item-"]')).toHaveCount(1);

    await page.getByTestId("go-checkout").click();
    await expect(page.getByTestId("checkout-page")).toBeVisible();
  });

  test("product detail can add quantity to cart", async ({ page }) => {
    await page.goto("/products/p-aurora-headphones");

    const quantity = page.getByLabel("Quantity");
    await quantity.fill("2");
    await page.getByTestId("detail-add-to-cart").click();

    await page.getByTestId("nav-cart-link").click();
    await expect(page.getByTestId("cart-item-p-aurora-headphones")).toContainText("2");
  });

  test("checkout place order uses confirmation modal", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("add-to-cart-p-aurora-headphones").click();
    await page.getByTestId("nav-checkout-link").click();

    await page.getByTestId("shipping-name").fill("Taylor Mason");
    await page.getByTestId("shipping-phone").fill("555-2233");
    await page.getByTestId("shipping-address").fill("88 9th Street, Austin, TX");
    await page.getByTestId("save-address-button").click();

    await page.getByTestId("manual-place-order").click();

    await expect(page.getByTestId("order-confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-order-button").click();

    await expect(page.getByTestId("order-id")).toBeVisible();
  });

  test("prepareCheckout tool is executed via service worker", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("add-to-cart-p-aurora-headphones").click();

    await page.getByTestId("nav-checkout-link").click();
    await page.getByTestId("shipping-name").fill("Avery Swift");
    await page.getByTestId("shipping-phone").fill("555-3000");
    await page.getByTestId("shipping-address").fill("88 Elm Street, Seattle, WA");
    await page.getByTestId("save-address-button").click();

    await page.getByTestId("nav-tools-link").click();
    await page.getByTestId("manual-sync-sw").click();
    await expect(page.getByTestId("sync-status")).toContainText("synced");

    await page.getByTestId("manual-tool-select").selectOption("prepareCheckout");
    await page.getByTestId("manual-tool-run").click();

    await expect(page.getByTestId("manual-tool-output")).toContainText("service-worker");
  });
});
