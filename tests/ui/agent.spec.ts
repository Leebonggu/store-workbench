import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("morebijou:editor-mode", "advanced"),
  );
});
test("three real products: images, facts, AI review, persistence, stale rejection and PNG", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#real-samples").click();
  await expect(page.locator(".product")).toHaveCount(3);
  await expect(page.locator("#value-size")).toHaveValue("");
  await expect(page.locator("[name=options]")).toHaveValue(/랜덤 1개/);
  await page.locator(".product").nth(2).click();
  await expect(page.locator("#value-size")).toHaveValue(
    "약 3.5~4cm (고리 제외)",
  );
  await expect(page.locator("#value-material")).toHaveValue("아크릴");
  await page.locator("#generate").click();
  const old = await page.locator("[name=description]").inputValue();
  await page.route("**/api/propose", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.images).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("rightsNote");
    await route.fulfill({
      json: {
        productId: body.productId,
        sourceVersion: body.sourceVersion,
        title: "응원 아크릴 키링 3종 택1",
        description:
          "작은 응원을 달고 다녀요\n\n호랑이 기운 · 표지판 · 행운터짐\n\n[구매 FAQ]\nQ. 세트인가요?\nA. 3종 중 1개를 선택하는 상품입니다.\n\n[상품 정보]\n소재: 아크릴\n크기: 약 3.5~4cm (고리 제외)\n가격: 1개 5,500원\n배송비: 3,300원, 60,000원 이상 무료배송",
        questions: ["원산지는 어디인가요?"],
        observations: ["초록색 표지판과 호랑이 그림이 보입니다."],
        keywords: ["응원 키링"],
        checklist: ["판매자센터 카테고리 확인"],
      },
    });
  });
  await page.locator("#ai-form [name=instruction]").fill("귀엽고 짧게");
  await page.locator("#ai-form [name=consent]").check();
  await page.getByRole("button", { name: "AI 제안 받기", exact: true }).click();
  await expect(page.locator(".ai-result")).toContainText(
    "원산지는 어디인가요?",
  );
  await expect(page.locator("[name=description]")).toHaveValue(old);
  await page.reload();
  await page.locator(".product").nth(2).click();
  await expect(page.locator(".ai-result")).toContainText("응원 아크릴 키링");
  await page.locator("#apply-ai").click();
  await expect(page.locator("[name=title]")).toHaveValue(
    "응원 아크릴 키링 3종 택1",
  );
  await page.locator("#render-preview").click();
  await expect(page.locator(".rendered-preview img")).toHaveCount(2);
  const photo = await page
    .locator(".rendered-preview img")
    .first()
    .evaluate(async (img: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
    );
  await writeFile("test-results/morebijou-detail.png", Buffer.from(photo));
  const info = await page
    .locator(".rendered-preview img")
    .nth(1)
    .evaluate(async (img: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
    );
  await writeFile("test-results/morebijou-info.png", Buffer.from(info));
  await page.locator("#value-price").fill("5600");
  await page
    .getByRole("button", { name: "확인 정보 저장", exact: true })
    .click();
  await page.locator("#apply-ai").click();
  await expect(page.locator("#notice")).toContainText("최신 정보로");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/morebijou-mobile.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("AI error retains original draft and pending input", async ({ page }) => {
  await page.goto("/");
  await page.locator("#real-samples").click();
  await expect(page.locator(".product")).toHaveCount(3);
  await page.locator("#generate").click();
  const old = await page.locator("[name=description]").inputValue();
  await page.route("**/api/propose", (route) =>
    route.fulfill({ status: 503, json: { error: "키 설정 필요" } }),
  );
  await page.locator("#ai-form [name=instruction]").fill("짧게 써줘");
  await page.locator("#ai-form [name=consent]").check();
  await page.getByRole("button", { name: "AI 제안 받기", exact: true }).click();
  await expect(page.locator("#notice")).toHaveText("키 설정 필요");
  await expect(page.locator("[name=description]")).toHaveValue(old);
  await expect(page.locator("#ai-form [name=instruction]")).toHaveValue(
    "짧게 써줘",
  );
});
