import test from "node:test";
import assert from "node:assert/strict";
import { readyProduct, PNG } from "./fixture";
import { createBackup, restoreBackup } from "../src/backup";
import {
  revise,
  validateProduct,
  koreaDay,
  validDate,
  contentHash,
} from "../src/model";
import { approve } from "../src/blocks/approval";
import { exportChannel } from "../src/blocks/channel";
import { packageZip } from "../src/blocks/package";
import { extractWithProvider } from "../src/blocks/providers";
test("backup restore preserves existing data, renews IDs, clears approvals and rejects corrupted input atomically", async () => {
  const p = await readyProduct(),
    raw = await createBackup([p]);
  const restored = await restoreBackup(raw, [p]);
  assert.equal(restored.length, 2);
  assert.deepEqual(restored[0], p);
  assert.notEqual(restored[1].id, p.id);
  assert.equal(restored[1].approval, undefined);
  assert.equal(restored[1].assets[0].dataUrl, p.assets[0].dataUrl);
  assert.equal(restored[1].rightsNote, p.rightsNote);
  const bad = JSON.parse(raw);
  bad.products[0].assets[0].sha256 = "0".repeat(64);
  await assert.rejects(restoreBackup(JSON.stringify(bad), [p]));
  assert.equal(p.approval?.hash, await contentHash(p));
});
test("SKU semantics reject duplicates, invalid price/stock and missing photo links", async () => {
  const p = await readyProduct();
  const valid = {
    id: "sku-one",
    label: "한 장",
    price: 3000,
    stock: 0,
    assetId: p.assets[0].id,
  };
  assert.equal(await validateProduct({ ...p, skus: [valid] }), undefined);
  for (const skus of [
    [valid, valid],
    [{ ...valid, price: -1 }],
    [{ ...valid, stock: -1 }],
    [{ ...valid, assetId: "missing" }],
  ])
    assert.ok(await validateProduct({ ...p, skus }));
  assert.equal(revise(p, { skus: [valid] }).approval, undefined);
});
test("expired rights block export even if an earlier snapshot was approved; Korean date boundary is explicit", async () => {
  const p = await readyProduct();
  p.rightsExpiresOn = "2000-01-01";
  assert.equal(
    (
      await approve.run({
        product: p,
        expectedVersion: p.version,
        reviewer: "test",
        visualReviewed: true,
      })
    ).ok,
    false,
  );
  assert.equal(
    (await exportChannel.run({ product: p, expectedVersion: p.version })).ok,
    false,
  );
  assert.equal(koreaDay(new Date("2026-01-01T14:59:59Z")), "2026-01-01");
  assert.equal(koreaDay(new Date("2026-01-01T15:00:00Z")), "2026-01-02");
  assert.equal(validDate("2026-02-30"), false);
});
test("ZIP refuses unsafe paths, stale detail lineage and invalid rendered bytes", async () => {
  const p = await readyProduct(),
    sourceHash = await contentHash(p),
    bytes = new Uint8Array(Buffer.from(PNG, "base64"));
  for (const page of [
    { sourceHash, filename: "../private.png", bytes, width: 860, height: 1 },
    {
      sourceHash: "stale",
      filename: "detail-001.png",
      bytes,
      width: 860,
      height: 1,
    },
    { sourceHash, filename: "detail-001.png", bytes, width: 860, height: 1 },
  ])
    assert.equal(
      (await packageZip.run({ product: p, pages: [page] })).ok,
      false,
    );
});
test("optional provider accepts only mock candidates with matching lineage and never confirms them", async () => {
  const p = await readyProduct();
  assert.equal((await extractWithProvider(p)).ok, false);
  let calls = 0;
  assert.equal(
    (
      await extractWithProvider(p, {
        id: "disabled",
        mode: "live",
        extract: async () => {
          calls++;
          throw Error("must not call");
        },
      })
    ).ok,
    false,
  );
  assert.equal(calls, 0);
  const good = await extractWithProvider(p, {
    id: "mock",
    mode: "mock",
    extract: async () => ({
      productId: p.id,
      sourceVersion: p.version,
      source: "synthetic",
      text: "material:합성 소재",
    }),
  });
  assert.ok(good.ok);
  assert.equal(good.value[0].confirmed, false);
  assert.equal(
    (
      await extractWithProvider(p, {
        id: "mock",
        mode: "mock",
        extract: async () => ({
          productId: "other",
          sourceVersion: p.version,
          source: "synthetic",
          text: "name:x",
        }),
      })
    ).ok,
    false,
  );
});

test("Smartstore preparation is a reviewable internal mock, never an official request", async () => {
  const { prepareSmartstoreMock } =
    await import("../src/blocks/smartstore-mock");
  const p = await readyProduct();
  assert.equal(
    (
      await prepareSmartstoreMock(p, {
        categoryReference: "",
        deliveryPolicyReference: "",
        noticeReviewReference: "",
      })
    ).ok,
    false,
  );
  const r = await prepareSmartstoreMock(p, {
    categoryReference: "synthetic-category",
    deliveryPolicyReference: "synthetic-delivery",
    noticeReviewReference: "synthetic-notice",
  });
  assert.ok(r.ok);
  assert.equal(r.value.mode, "mock");
  assert.equal(r.value.networkCalls, 0);
});
