import { writeFile } from "node:fs/promises";
import { test, expect, type Download } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { readyProduct, PNG } from "../fixture";
import { createBackup } from "../../src/backup";
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("morebijou:editor-mode", "advanced"),
  );
});
test("usable workflow uploads JPEG, maps SKU, edits layout, opens actual ZIP and restores a private backup", async ({
  page,
}) => {
  const p = await readyProduct();
  p.rightsNote = "INTERNAL-ONLY-TEST";
  p.approval = undefined;
  await page.addInitScript(
    (value) =>
      localStorage.setItem("store-workbench:v1", JSON.stringify([value])),
    p,
  );
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(1);
  const jpeg = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 80;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#723ba0";
    ctx.fillRect(0, 0, 96, 80);
    ctx.fillStyle = "white";
    ctx.fillRect(20, 20, 50, 40);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  await page.locator("#asset-form [name=source]").fill("synthetic JPEG");
  await page.locator("#asset-form [name=file]").setInputFiles({
    name: "../../synthetic.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(jpeg, "base64"),
  });
  await page
    .getByRole("button", { name: "원본 사진 추가", exact: true })
    .click();
  await expect(page.locator(".assets img")).toHaveCount(2);
  await page.locator("[name=sku-label-0]").fill("보라 · 한 장");
  await expect(page.locator("[name=layout-order]")).toBeDisabled();
  await page.locator("[name=sku-price-0]").fill("3100");
  await page.locator("[name=sku-stock-0]").fill("4");
  await page.locator("[name=sku-asset-0]").selectOption({ index: 2 });
  await page.getByRole("button", { name: "옵션 저장", exact: true }).click();
  await expect(page.locator("#notice")).toContainText("옵션을 저장");
  await page.locator("#rights-form input[type=checkbox]").nth(1).check();
  await page.getByRole("button", { name: "권리 확인 저장" }).click();
  await expect(page.locator("#notice")).toContainText("권리 상태");
  await page.locator("#replace-draft").check();
  await page.locator("#generate").click();
  await expect(page.locator("#notice")).toContainText("로컬 템플릿");
  await page.locator("[name=layout-order]").selectOption("facts-first");
  await page.locator("[name=layout-accent]").selectOption("ink");
  await page.getByRole("button", { name: "초안 편집 저장" }).click();
  await expect(page.locator("#notice")).toContainText("초안을 저장");
  await page.locator("#render-preview").click();
  await expect(page.locator(".rendered-preview img")).toHaveCount(3);
  await page.locator("#approval-form [name=reviewer]").fill("synthetic");
  await page.locator("#approval-form [name=reviewed]").check();
  await page
    .getByRole("button", { name: "현재 버전 승인", exact: true })
    .click();
  await expect(page.locator("#zip")).toBeEnabled();
  const zipDownload = page.waitForEvent("download");
  await page.locator("#zip").click();
  const archive = unzipSync(await bytes(await zipDownload));
  const paths = Object.keys(archive);
  expect(
    paths.every((path) => !path.includes("..") && !path.startsWith("/")),
  ).toBe(true);
  expect(paths).toContain("originals/product-002.jpeg");
  expect(Buffer.from(archive["originals/product-002.jpeg"])).toEqual(
    Buffer.from(jpeg, "base64"),
  );
  expect(Buffer.from(archive["originals/product-001.png"])).toEqual(
    Buffer.from(PNG, "base64"),
  );
  const manifest = strFromU8(archive["manifest.json"]);
  expect(manifest).not.toContain("INTERNAL-ONLY-TEST");
  const parsedManifest = JSON.parse(manifest);
  expect(parsedManifest.skus[0].price).toBe(3100);
  expect(parsedManifest.price).toBe(3000);
  expect(
    parsedManifest.images.find(
      (image: { assetId: string }) =>
        image.assetId === parsedManifest.skus[0].assetId,
    ).filename,
  ).toBe("originals/product-002.jpeg");
  expect(paths.filter((p) => p.startsWith("detail/")).length).toBe(3);
  const detail = archive["detail/detail-001.png"];
  await writeFile("test-results/detail-output.png", detail);
  await writeFile(
    "test-results/detail-photo.png",
    archive["detail/detail-002.png"],
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/guide-workbench.png",
    fullPage: false,
  });
  const size = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, Buffer.from(detail).toString("base64"));
  expect(size[0]).toBe(860);
  expect(size[1]).toBeGreaterThan(200);
  const backupDownload = page.waitForEvent("download");
  await page.locator("#backup").click();
  const backup = await bytes(await backupDownload);
  expect(backup.toString()).toContain("INTERNAL-ONLY-TEST");
  await page.getByText("백업 복원 도구", { exact: true }).click();
  await page.locator("#restore-form [name=backup]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await page.locator("[name=restore-confirm]").check();
  await page.getByRole("button", { name: "백업 복원", exact: true }).click();
  await expect(page.locator(".product")).toHaveCount(2);
  await expect(page.locator("#zip")).toBeDisabled();
  await page.reload();
  await expect(page.locator(".product")).toHaveCount(2);
});
test("invalid import preserves current products and corrupted storage can recover without erasing raw evidence", async ({
  page,
}) => {
  const p = await readyProduct();
  const bad = structuredClone(p);
  bad.assets[0].sha256 = "0".repeat(64);
  const original = JSON.stringify([bad]);
  await page.addInitScript(
    (value) => localStorage.setItem("store-workbench:v1", value),
    original,
  );
  await page.goto("/");
  await expect(page.locator("#notice")).toContainText("검증 실패");
  await page.locator("#restore-form [name=backup]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await page.locator("[name=restore-confirm]").check();
  await page.getByRole("button", { name: "백업 복원", exact: true }).click();
  await expect(page.locator("#restore-form [name=backup]")).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem("store-workbench:v1")),
  ).toBe(original);
  await page.locator("#restore-form [name=backup]").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(await createBackup([p])),
  });
  await page.getByRole("button", { name: "백업 복원", exact: true }).click();
  await expect(page.locator(".product")).toHaveCount(1);
  await expect(page.locator("#zip")).toBeDisabled();
  const recovery = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const r = indexedDB.open("store-workbench", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("workspace", "readonly"),
            req = tx.objectStore("workspace").getAllKeys();
          req.onsuccess = () => {
            db.close();
            resolve(req.result.map(String));
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
  expect(recovery.some((k) => k.startsWith("recovery-"))).toBe(true);
});

test("an aborted IndexedDB write preserves saved state and editable input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "예시 추가" }).click();
  await expect(page.locator(".product")).toHaveCount(1);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "store-workbench:v1")
        throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await page.locator("#value-name").fill("저장 실패할 합성 이름");
  await page.getByRole("button", { name: "확인 정보 저장" }).click();
  await expect(page.locator("#notice")).toContainText("저장 공간");
  await expect(page.locator("#value-name")).toHaveValue(
    "저장 실패할 합성 이름",
  );
  await page.reload();
  await expect(page.locator("#value-name")).toHaveValue(
    "[합성 예시] 작은 메모 카드",
  );
});
