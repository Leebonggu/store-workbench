import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
test("seller completes local workflow, reloads, exports, and edits invalidate approval", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "예시 추가" }).click();
  await page.locator("#asset-form [name=source]").fill("합성 테스트 이미지");
  await page.locator("#asset-form [name=file]").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("button", { name: "원본 사진 추가", exact: true })
    .click();
  await expect(page.locator(".assets img")).toHaveCount(1);
  await page.getByLabel("상품명 확인", { exact: true }).check();
  await page.getByLabel("가격 (원) 확인", { exact: true }).check();
  await page.getByRole("button", { name: "확인 정보 저장" }).click();
  await page.getByRole("button", { name: "저장된 정보로 초안 만들기" }).click();
  await expect(
    page.getByRole("button", { name: "현재 버전 승인", exact: true }),
  ).toBeDisabled();
  await page.locator("#rights-form input[type=checkbox]").first().check();
  await page.locator("#rights-form [name=channel]").check();
  await page.locator("#rights-form [name=note]").fill("PRIVATE_RIGHTS_TEST");
  await page.getByRole("button", { name: "권리 확인 저장" }).click();
  await page.locator("#replace-draft").check();
  await page.getByRole("button", { name: "저장된 정보로 초안 만들기" }).click();
  await page.locator("#approval-form [name=reviewer]").fill("UI 검수자");
  await page.locator("#approval-form [name=reviewed]").check();
  await page
    .getByRole("button", { name: "현재 버전 승인", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "등록 준비 JSON 내보내기" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "등록 준비 JSON 내보내기" }).click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toMatch(/product-.*\.json/);
  const stream = await artifact.createReadStream();
  let body = "";
  for await (const chunk of stream!) body += chunk.toString();
  expect(body).not.toContain("PRIVATE_RIGHTS_TEST");
  expect(JSON.parse(body).images).toHaveLength(1);
  await expect(page.locator(".workspace-heading .badge")).toHaveText(
    "내보냄 · 게시 아님",
  );
  await page.locator("#draft-form [name=title]").fill("수정한 합성 상품명");
  await page.getByRole("button", { name: "초안 편집 저장" }).click();
  await expect(
    page.getByRole("button", { name: "등록 준비 JSON 내보내기" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "test-results/workbench-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("empty and mobile workbench keeps controls in viewport and preserves unsaved edit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("첫 상품을 준비해 보세요")).toBeVisible();
  await page.getByRole("button", { name: "+ 새 상품" }).click();
  await page.locator("#value-name").fill("저장 전 이름");
  await page.getByRole("button", { name: "+ 새 상품" }).click();
  await expect(page.locator("#value-name")).toHaveValue("저장 전 이름");
  await expect(page.locator("#notice")).toContainText("먼저 저장");
  await page.screenshot({
    path: "test-results/workbench-mobile.png",
    fullPage: true,
  });
  await page
    .locator("#facts-form")
    .getByRole("button", { name: "입력 취소" })
    .click();
  await expect(page.locator("#value-name")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("another tab update blocks stale writes without deleting current input", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "예시 추가" }).click();
  const second = await context.newPage();
  await second.goto("/");
  await page.locator("#value-name").fill("현재 탭의 미저장 편집");
  await second.getByRole("button", { name: "+ 새 상품" }).click();
  await expect(page.locator("#notice")).toContainText("다른 탭");
  await expect(
    page.getByRole("button", { name: "확인 정보 저장" }),
  ).toBeDisabled();
  await expect(page.locator("#value-name")).toHaveValue(
    "현재 탭의 미저장 편집",
  );
});
