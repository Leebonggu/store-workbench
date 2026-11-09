import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("morebijou:editor-mode", "advanced"),
  );
});
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

test("deletion requires confirmation, preserves siblings and persists the empty state", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#sample").click();
  await page.locator("#new").click();
  await expect(page.locator(".product")).toHaveCount(2);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#delete-product").click();
  await expect(page.locator(".product")).toHaveCount(2);
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("이름 없는 신상품");
    return dialog.accept();
  });
  await page.locator("#delete-product").click();
  await expect(page.locator(".product")).toHaveCount(1);
  await expect(page.locator("#value-name")).toHaveValue(
    "[합성 예시] 작은 메모 카드",
  );
  await page.reload();
  await expect(page.locator(".product")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#delete-product").click();
  await expect(page.locator(".welcome")).toBeVisible();
  await page.reload();
  await expect(page.locator(".product")).toHaveCount(0);
});

test("guide navigation and all populated editor sections fit six viewport widths", async ({
  page,
}) => {
  await page.goto("/guide.html");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "차근차근",
  );
  for (const link of await page.locator(".guide-nav a").all()) {
    const href = await link.getAttribute("href");
    await expect(page.locator(href!)).toHaveCount(1);
  }
  for (const width of [320, 390, 464, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/");
  await page.locator("#real-samples").click();
  await page.locator("#generate").click();
  await page.locator("#render-preview").click();
  await expect(page.locator(".rendered-preview img").first()).toBeVisible();
  for (const width of [320, 390, 464, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflows = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          ".card, .ai-panel, .card button, .card label, .card p, .card textarea, .card select, .fact-row, .sku-row",
        ),
      )
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width &&
            (r.left < -1 ||
              r.right > innerWidth + 1 ||
              el.scrollWidth > el.clientWidth + 2)
          );
        })
        .map(
          (el) =>
            `${el.tagName}.${el.className}: ${el.textContent?.slice(0, 45)}`,
        ),
    );
    expect(overflows, `Overflow at ${width}px`).toEqual([]);
    const boxes = await page
      .locator(".export-actions button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const r = button.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
        }),
      );
    expect(
      boxes[0].bottom <= boxes[1].top || boxes[0].right <= boxes[1].left,
    ).toBe(true);
  }
});

test("guide mode follows product progress and toggles without losing unsaved edits", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "가이드 모드", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".guide-now")).toContainText("첫 상품부터");
  await page.locator("#new").click();
  await expect(page.locator(".guide-now")).toContainText("상품 사진");
  await page.locator("#value-name").fill("저장하지 않은 이름");
  await toggle.click();
  await expect(page.locator(".guide-hint")).toHaveCount(0);
  await expect(page.locator("#value-name")).toHaveValue("저장하지 않은 이름");
  await toggle.click();
  await expect(page.locator("#value-name")).toHaveValue("저장하지 않은 이름");
  await expect(page.locator("#ai-form textarea")).toBeDisabled();
  await page.locator("#facts-form .quiet").click();
  await page.locator("#real-samples").click();
  await expect(page.locator(".guide-now")).toContainText("사용 범위");
  for (const checkbox of await page
    .locator('#rights-form input[type="checkbox"]')
    .all())
    await checkbox.check();
  await page
    .locator('#rights-form [name="note"]')
    .fill("합성 테스트: 사용 권한 확인 기록");
  await page
    .getByRole("button", { name: "권리 확인 저장", exact: true })
    .click();
  await expect(page.locator(".guide-now")).toContainText("상품 소개");
  await page.locator("#generate").click();
  await expect(page.locator(".guide-now")).toContainText("검수하고 승인");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".guide-hint")).toHaveCount(6);
  for (const width of [320, 390, 464, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const overflow = await page
      .locator(".guide-hint, .guide-now, header")
      .evaluateAll((elements) =>
        elements.some(
          (element) => element.scrollWidth > element.clientWidth + 2,
        ),
      );
    expect(overflow).toBe(false);
  }
});
