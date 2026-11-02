import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  newProduct,
  revise,
  editDraft,
  contentHash,
  type Product,
} from "../src/model";
import { captureGuide } from "../src/blocks/capture";
import { manageAsset } from "../src/blocks/assets";
import { candidateFacts, confirmFacts } from "../src/blocks/facts";
import { checkRights } from "../src/blocks/rights";
import { channelCopy } from "../src/blocks/copy";
import { composeDetail } from "../src/blocks/detail";
import { approve } from "../src/blocks/approval";
import {
  capabilities,
  exportChannel,
  unsupportedChannelOperation,
} from "../src/blocks/channel";
import { generateDraft } from "../src/pipeline";
import {
  load,
  save,
  saveIfCurrent,
  CONFLICT,
  type Exclusive,
} from "../src/storage";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
async function fixture(): Promise<Product> {
  let p = newProduct("synthetic-test");
  p.facts = p.facts.map((f) =>
    f.key === "name"
      ? { ...f, value: "합성 카드", source: "테스트 자료", confirmed: true }
      : f.key === "price"
        ? { ...f, value: "3000", source: "테스트 자료", confirmed: true }
        : f,
  );
  const asset = await manageAsset.run({
    product: p,
    name: "test.png",
    dataUrl: png,
    source: "private-source-note",
  });
  assert.ok(asset.ok);
  p.assets = [{ ...asset.value, rightsConfirmed: true }];
  p.channelRights = true;
  p.rightsNote = "private-rights-note";
  const draft = await generateDraft(p);
  assert.ok(draft.ok);
  p.draft = draft.value;
  return p;
}
async function approved() {
  const p = await fixture();
  const r = await approve.run({
    product: p,
    expectedVersion: p.version,
    reviewer: "synthetic-reviewer",
    visualReviewed: true,
  });
  assert.ok(r.ok);
  return { ...p, approval: r.value };
}
test("every block declares free local effects and validates bad product input", async () => {
  for (const block of [
    captureGuide,
    manageAsset,
    candidateFacts,
    confirmFacts,
    checkRights,
    channelCopy,
    composeDetail,
    approve,
    exportChannel,
  ]) {
    assert.equal(block.meta.cost, "none");
    assert.equal(block.meta.externalTransmission, false);
    const r = await block.run({ product: {} } as never);
    assert.equal(r.ok, false);
  }
});
test("candidate parser retains uncertainty; unresolved material never enters generated copy", async () => {
  const p = await fixture();
  const r = await candidateFacts.run({
    product: p,
    text: "material:추측한 소재",
    source: "확인 전 라벨",
  });
  assert.ok(r.ok);
  assert.equal(r.value[0].confirmed, false);
  p.facts = p.facts.map((f) => r.value.find((x) => x.key === f.key) ?? f);
  const copy = await channelCopy.run({ product: p });
  assert.ok(copy.ok);
  assert.ok(!copy.value.lines.join("").includes("추측한"));
});
test("confirmation requires source and positive integer price", async () => {
  const p = await fixture();
  for (const facts of [
    p.facts.map((f) => ({ ...f, source: "" })),
    p.facts.map((f) => (f.key === "price" ? { ...f, value: "-1" } : f)),
  ]) {
    const r = await confirmFacts.run({ product: p, facts });
    assert.equal(r.ok, false);
  }
});
test("rights holds block approval and export even with an old approval", async () => {
  for (const change of ["channel", "asset", "note", "missing-photo"]) {
    const p = await approved();
    if (change === "channel") p.channelRights = false;
    if (change === "asset") p.assets[0].rightsConfirmed = false;
    if (change === "note") p.rightsNote = "";
    if (change === "missing-photo") p.assets = [];
    assert.equal((await checkRights.run({ product: p })).ok, false);
    assert.equal(
      (
        await approve.run({
          product: p,
          reviewer: "test",
          expectedVersion: p.version,
          visualReviewed: true,
        })
      ).ok,
      false,
    );
    assert.equal(
      (await exportChannel.run({ product: p, expectedVersion: p.version })).ok,
      false,
    );
  }
});
test("source edit clears approval and source version mismatch prevents stale draft approval", async () => {
  const p = await approved();
  const changed = revise(p, { options: "다른 구성" });
  assert.equal(changed.approval, undefined);
  assert.equal(
    (
      await approve.run({
        product: changed,
        reviewer: "test",
        expectedVersion: changed.version,
        visualReviewed: true,
      })
    ).ok,
    false,
  );
});
test("draft edit invalidates approval; silent content tamper is caught by export hash", async () => {
  const p = await approved();
  const edited = editDraft(p, "새 제목", p.draft!.description);
  assert.equal(edited.approval, undefined);
  p.draft!.title = "몰래 바뀐 제목";
  const result = await exportChannel.run({
    product: p,
    expectedVersion: p.version,
  });
  assert.equal(result.ok, false);
});
test("expected-version checks reject outdated callers", async () => {
  const p = await approved();
  for (const r of [
    await approve.run({
      product: p,
      expectedVersion: p.version - 1,
      reviewer: "x",
      visualReviewed: true,
    }),
    await exportChannel.run({ product: p, expectedVersion: p.version - 1 }),
  ]) {
    assert.ok(!r.ok);
    assert.equal(r.error.code, "VERSION_MISMATCH");
  }
});
test("manual export contains only allowlisted public fields and original asset", async () => {
  const p = await approved();
  (p as unknown as Record<string, unknown>).credentials =
    "fake-secret-never-export";
  const r = await exportChannel.run({ product: p, expectedVersion: p.version });
  assert.ok(r.ok);
  const json = JSON.stringify(r.value);
  for (const internal of [
    "private-source-note",
    "private-rights-note",
    "synthetic-reviewer",
    "fake-secret-never-export",
  ])
    assert.ok(!json.includes(internal));
  assert.equal(r.value.images[0].dataUrl, png);
  assert.equal(
    r.value.images[0].sha256,
    createHash("sha256")
      .update(Buffer.from(png.split(",")[1], "base64"))
      .digest("hex"),
  );
  assert.equal(r.value.contentHash, await contentHash(p));
  assert.equal(p.exported, undefined);
});
test("remote API capabilities remain unsupported", async () => {
  assert.equal(capabilities.create, false);
  for (const op of ["create", "update", "status"] as const)
    assert.equal(
      (await unsupportedChannelOperation(op)).error.code,
      "UNSUPPORTED",
    );
});
test("failed regeneration preserves existing draft and does not mutate input", async () => {
  const p = await fixture();
  p.facts.find((f) => f.key === "name")!.confirmed = false;
  const before = JSON.stringify(p);
  assert.equal((await generateDraft(p)).ok, false);
  assert.equal(JSON.stringify(p), before);
});
test("asset import rejects unsupported format, duplicate, and oversized file", async () => {
  const p = await fixture();
  for (const dataUrl of [
    png,
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64," + "a".repeat(2_800_001),
  ])
    assert.equal(
      (
        await manageAsset.run({
          product: p,
          name: "x",
          source: "test",
          dataUrl,
        })
      ).ok,
      false,
    );
});
test("approval needs explicit reviewer and visual check", async () => {
  const p = await fixture();
  assert.equal(
    (
      await approve.run({
        product: p,
        expectedVersion: p.version,
        reviewer: "",
        visualReviewed: true,
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await approve.run({
        product: p,
        expectedVersion: p.version,
        reviewer: "x",
        visualReviewed: false,
      })
    ).ok,
    false,
  );
});
test("storage recovers valid draft and reports corrupt or quota errors without overwriting", async () => {
  const p = await fixture();
  assert.deepEqual(
    (await load({ getItem: () => JSON.stringify([p]) })).products,
    [p],
  );
  for (const raw of ["{bad", JSON.stringify([{ schemaVersion: 99 }])])
    assert.ok((await load({ getItem: () => raw })).error);
  assert.ok(
    save(
      {
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
      },
      [p],
    ),
  );
});
test("output lineage matches source snapshot", async () => {
  const p = await fixture();
  p.version = 42;
  const r = await generateDraft(p);
  assert.ok(r.ok);
  assert.equal(r.lineage.sourceVersion, 42);
  assert.equal(r.value.sourceVersion, 42);
});

test("detail block rejects stale or foreign copy lineage", async () => {
  const p = await fixture();
  const r = await channelCopy.run({ product: p });
  assert.ok(r.ok);
  for (const copy of [
    { ...r.value, sourceVersion: p.version - 1 },
    { ...r.value, productId: "other-product" },
  ]) {
    const out = await composeDetail.run({ product: p, copy });
    assert.ok(!out.ok);
    assert.equal(out.error.code, "VERSION_MISMATCH");
  }
});
test("asset block rejects forged image MIME", async () => {
  const p = newProduct();
  const result = await manageAsset.run({
    product: p,
    source: "test",
    name: "fake.png",
    dataUrl: "data:image/png;base64,ZmFrZQ==",
  });
  assert.equal(result.ok, false);
});

test("restore rejects hostile image attributes, invalid confirmed prices, fake bytes and bad hashes without overwriting originals", async () => {
  const valid = await fixture();
  const cases: Product[] = [];
  const hostile = structuredClone(valid);
  hostile.assets[0].dataUrl =
    'data:image/png;base64,AA==" onerror="window.syntheticMarker=1';
  cases.push(hostile);
  const price = structuredClone(valid);
  price.facts.find((f) => f.key === "price")!.value = "-1";
  cases.push(price);
  const bytes = structuredClone(valid);
  bytes.assets[0].dataUrl = "data:image/png;base64,ZmFrZQ==";
  cases.push(bytes);
  const hash = structuredClone(valid);
  hash.assets[0].sha256 = "0".repeat(64);
  cases.push(hash);
  for (const bad of cases) {
    bad.id = "bad";
    const raw = JSON.stringify([valid, bad]);
    const restored = await load({ getItem: () => raw });
    assert.ok(restored.error);
    assert.deepEqual(restored.products, [valid]);
    assert.equal(restored.snapshot, raw);
    for (const result of [
      await generateDraft(bad),
      await approve.run({
        product: bad,
        expectedVersion: bad.version,
        reviewer: "test",
        visualReviewed: true,
      }),
      await exportChannel.run({ product: bad, expectedVersion: bad.version }),
    ])
      assert.equal(result.ok, false);
  }
});
test("strict image parsing rejects truncated bytes, invalid dimensions, MIME mismatch and noncanonical base64", async () => {
  const p = await fixture();
  for (const value of [
    png + '" onerror="alert(1)',
    png.replace("image/png", "image/jpeg"),
    png.slice(0, -4),
    "data:image/png;base64,AA",
  ]) {
    assert.equal(
      (
        await manageAsset.run({
          product: newProduct(),
          name: "bad",
          source: "synthetic",
          dataUrl: value,
        })
      ).ok,
      false,
    );
  }
  const bad = structuredClone(p);
  bad.assets[0].mime = "image/jpeg";
  assert.equal((await generateDraft(bad)).ok, false);
});
test("snapshot-checked commits reject delayed and same-tab stale work before side effects", async () => {
  const p = newProduct("one");
  let raw: string | null = JSON.stringify([p]);
  const initial = raw;
  let effects = 0;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const exclusive: Exclusive = async (operation) => operation();
  raw = JSON.stringify([p, newProduct("two")]);
  const r = await saveIfCurrent(
    storage,
    initial,
    [p],
    exclusive,
    () => true,
    () => effects++,
  );
  assert.ok(!r.ok);
  assert.equal(r.error, CONFLICT);
  assert.equal(JSON.parse(raw).length, 2);
  assert.equal(effects, 0);
  const stale = await saveIfCurrent(
    storage,
    raw,
    [p],
    exclusive,
    () => false,
    () => effects++,
  );
  assert.ok(!stale.ok);
  assert.equal(effects, 0);
});
test("serialized commits sharing the same snapshot cannot overwrite each other", async () => {
  let raw: string | null = null,
    queue: Promise<unknown> = Promise.resolve();
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  const exclusive: Exclusive = (operation) => {
    const next = queue.then(operation);
    queue = next;
    return next;
  };
  const results = await Promise.all([
    saveIfCurrent(storage, null, [newProduct("one")], exclusive, () => true),
    saveIfCurrent(storage, null, [newProduct("two")], exclusive, () => true),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok).length, 1);
});
