import { test, expect } from "@playwright/test";

test("new product reuses an untouched draft and preserves saved products", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#new").click();
  await expect(page.locator(".product")).toHaveCount(1);
  const original = await page
    .locator(".product.active")
    .getAttribute("data-product");
  for (let i = 0; i < 3; i++) {
    await page.locator("#new").click();
    await expect(page.locator(".product")).toHaveCount(1);
  }
  await page.locator("#value-name").fill("작성한 상품");
  await page.locator('#facts-form button[type="submit"]').click();
  await expect(page.locator("#notice")).toContainText("저장");
  await page.locator("#new").click();
  await expect(page.locator(".product")).toHaveCount(2);
  await expect(page.locator("#value-name")).toHaveValue("");
  await page.locator(`[data-product="${original}"]`).click();
  await expect(page.locator("#value-name")).toHaveValue("작성한 상품");
  await page.locator("#new").click();
  await expect(page.locator(".product")).toHaveCount(2);
  await expect(page.locator("#value-name")).toHaveValue("");
  await page.reload();
  await page.locator("#new").click();
  await expect(page.locator(".product")).toHaveCount(2);
});

test("product editor fits narrow screens and never displays hidden SKU IDs", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#real-samples").click();
  await expect(page.locator(".product")).toHaveCount(3);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('input[name="sku-id-0"]')).toBeHidden();
    await expect(page.locator("#value-name")).toBeVisible();
    expect(
      await page
        .locator("#value-name")
        .evaluate((input) => input.getBoundingClientRect().width),
    ).toBeGreaterThan(70);
  }
  await page.locator('a[href="#information"]').click();
  await expect(page.locator("#information")).toBeInViewport();
});
