import { test, expect, type Page } from "@playwright/test";
import { readyProduct, PNG } from "../fixture";
async function pauseDecode(page: Page) {
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    (window as any).decodeEntered = false;
    HTMLImageElement.prototype.decode = async function () {
      HTMLImageElement.prototype.decode = original;
      (window as any).decodeEntered = true;
      await new Promise<void>((resolve) => {
        (window as any).releaseDecode = resolve;
      });
      return original.call(this);
    };
  });
}
test("delayed photo validation cannot overwrite another tab product", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "예시 추가" }).click();
  const second = await context.newPage();
  await second.goto("/");
  await pauseDecode(page);
  await page.locator("#asset-form [name=source]").fill("synthetic");
  await page.locator("#asset-form [name=file]").setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG, "base64"),
  });
  await page
    .getByRole("button", { name: "원본 사진 추가", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).decodeEntered);
  await second.getByRole("button", { name: "+ 새 상품" }).click();
  await expect(second.locator(".product")).toHaveCount(2);
  await page.evaluate(() => (window as any).releaseDecode());
  await expect(page.locator("#notice")).toContainText("덮어쓰기");
  await expect(
    page.getByRole("button", { name: "원본 사진 추가", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("store-workbench:v1")!).length,
    ),
  ).toBe(2);
  await second.reload();
  await expect(second.locator(".product")).toHaveCount(2);
});
test("delayed export cannot download stale snapshot after another tab changes data", async ({
  page,
  context,
}) => {
  const product = await readyProduct();
  await page.addInitScript(
    (p) => localStorage.setItem("store-workbench:v1", JSON.stringify([p])),
    product,
  );
  await page.goto("/");
  await expect(page.locator("#export")).toBeEnabled();
  const second = await context.newPage();
  await second.goto("/");
  await pauseDecode(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator("#export").click();
  await page.waitForFunction(() => (window as any).decodeEntered);
  await second.getByRole("button", { name: "+ 새 상품" }).click();
  await expect(second.locator(".product")).toHaveCount(2);
  await page.evaluate(() => (window as any).releaseDecode());
  await expect(page.locator("#notice")).toContainText("덮어쓰기");
  await expect(page.locator("#export")).toBeDisabled();
  expect(downloads).toBe(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("store-workbench:v1")!).length,
    ),
  ).toBe(2);
});
test("hostile restored URL never becomes markup; valid sibling draft is preserved read-only", async ({
  page,
}) => {
  const good = await readyProduct();
  const bad = structuredClone(good);
  bad.id = "hostile";
  bad.assets[0].dataUrl =
    'data:image/png;base64,AA==" onerror="window.syntheticMarker=1';
  const raw = JSON.stringify([good, bad]);
  await page.addInitScript(
    (value) => localStorage.setItem("store-workbench:v1", value),
    raw,
  );
  await page.goto("/");
  await expect(page.locator("#notice")).toContainText("검증 실패");
  expect(
    await page.evaluate(() => (window as any).syntheticMarker),
  ).toBeUndefined();
  await expect(page.locator("img[onerror]")).toHaveCount(0);
  await expect(page.locator(".product")).toHaveCount(1);
  await expect(page.locator("#export")).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("store-workbench:v1")),
  ).toBe(raw);
});
test("restored negative price and corrupted image/hash are rejected before approval", async ({
  page,
}) => {
  const p = await readyProduct();
  p.facts[1].value = "-1";
  p.assets[0].sha256 = "0".repeat(64);
  await page.addInitScript(
    (value) =>
      localStorage.setItem("store-workbench:v1", JSON.stringify([value])),
    p,
  );
  await page.goto("/");
  await expect(page.locator("#notice")).toContainText("검증 실패");
  await expect(page.locator(".product")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("store-workbench:v1")!)[0].facts[1]
          .value,
    ),
  ).toBe("-1");
});
