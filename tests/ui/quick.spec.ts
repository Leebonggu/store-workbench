import { test, expect } from "@playwright/test";
import { PNG } from "../fixture";
async function upload(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("#new").click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator("#quick-upload [name=file]").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG, "base64"),
  });
  await page
    .locator("#quick-upload [name=source]")
    .selectOption({ label: "직접 만든 테스트 이미지" });
  await page
    .getByRole("button", { name: "사진 올리고 다음으로 →", exact: true })
    .click();
  await expect(page.locator("#quick-facts")).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
}
async function answer(page: import("@playwright/test").Page) {
  await page.locator("#quick-facts [name=name]").fill("테스트 키링");
  await page.locator("#quick-facts [name=price]").fill("5500");
  await page.locator("#quick-facts [name=unit]").selectOption("1개");
  await page.locator("#quick-facts [name=selection]").selectOption("랜덤 발송");
  for (const checkbox of await page
    .locator("#quick-facts input[type=checkbox]")
    .all())
    await checkbox.check();
}
test("photo, short answers, automatic result and saved approval without downloading", async ({
  page,
}) => {
  await upload(page);
  await answer(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.route("**/api/propose", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.options).toContain("판매 단위: 1개");
    expect(body.options).toContain("랜덤 발송");
    expect(
      body.facts.find((f: { key: string }) => f.key === "material")?.value ??
        "",
    ).toBe("");
    await route.fulfill({
      json: {
        productId: body.productId,
        sourceVersion: body.sourceVersion,
        title: "테스트 키링",
        description: "테스트용 키링입니다. 1개 5,500원. 랜덤 발송입니다.",
        questions: ["크기를 알려주세요."],
        observations: [],
        keywords: ["키링"],
        checklist: [],
      },
    });
  });
  await page
    .getByRole("button", { name: "이 정보로 상세페이지 만들기 ✦", exact: true })
    .click();
  await expect(page.locator(".rendered-preview img").first()).toBeVisible();
  await expect(page.locator("#quick-facts")).toHaveCount(0);
  await expect(page.locator("#apply-ai")).toHaveCount(0);
  await page.locator("#quick-finish [name=reviewed]").check();
  await page
    .getByRole("button", {
      name: "확인 완료 · 이 내용으로 저장 ✓",
      exact: true,
    })
    .click();
  await expect(page.locator(".quick-card>.good")).toContainText("저장되어");
  expect(downloads).toBe(0);
  await page.reload();
  await expect(page.locator(".quick-card>.good")).toBeVisible();
  await expect(page.locator(".rendered-preview img").first()).toBeVisible();
  await page.getByText("문구를 직접 수정할게요", { exact: true }).click();
  await page.locator("#quick-edit [name=title]").fill("수정한 테스트 키링");
  await page
    .getByRole("button", { name: "수정 내용 저장", exact: true })
    .click();
  await expect(page.locator("#quick-finish")).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("failed model call preserves answers and allows retry without duplicated conditions", async ({
  page,
}) => {
  await upload(page);
  await answer(page);
  await page.route("**/api/propose", (route) =>
    route.fulfill({ status: 503, json: { error: "테스트 연결 실패" } }),
  );
  await page
    .getByRole("button", { name: "이 정보로 상세페이지 만들기 ✦", exact: true })
    .click();
  await expect(page.locator("#notice")).toHaveText("테스트 연결 실패");
  await expect(page.locator("#quick-facts [name=name]")).toHaveValue(
    "테스트 키링",
  );
  await expect(page.locator("#quick-facts [name=name]")).toBeEnabled();
  await expect(page.locator("#quick-facts [name=unit]")).toHaveValue("1개");
  await expect(page.locator("#quick-facts [name=options]")).not.toHaveValue(
    /판매 단위:/,
  );
});
