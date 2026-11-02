import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { unzipSync } from "fflate";
import { crc32 } from "../src/media";
import { contentHash } from "../src/model";
import { packageZip } from "../src/blocks/package";
import { readyProduct } from "./fixture";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type: string, data: Buffer = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}
function header(color = 6, depth = 8, interlace = 0) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(860);
  data.writeUInt32BE(100, 4);
  data[8] = depth;
  data[9] = color;
  data[12] = interlace;
  return chunk("IHDR", data);
}
const pixels = Buffer.alloc((860 * 4 + 1) * 100);
const compressed = deflateSync(pixels);
const png = (...chunks: Buffer[]) =>
  new Uint8Array(Buffer.concat([signature, ...chunks]));
const good = png(header(), chunk("IDAT", compressed), chunk("IEND"));
async function run(bytes: Uint8Array) {
  const product = await readyProduct();
  return packageZip.run({
    product,
    pages: [
      {
        sourceHash: await contentHash(product),
        filename: "detail-001.png",
        bytes,
        width: 860,
        height: 100,
      },
    ],
  });
}

test("ZIP rejects the reviewer's 24-byte signature/dimensions-only detail PNG", async () => {
  const fake = new Uint8Array(24);
  fake.set(signature);
  new DataView(fake.buffer).setUint32(16, 860);
  new DataView(fake.buffer).setUint32(20, 100);
  const result = await run(fake);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "INVALID_INPUT");
});

test("ZIP rejects incomplete, malformed and undecodable detail PNG with matching lineage", async () => {
  const badCrc = good.slice();
  badCrc[29] ^= 1;
  const badAdler = Buffer.from(compressed);
  badAdler[badAdler.length - 1] ^= 1;
  const badFilter = Buffer.from(pixels);
  badFilter[0] = 5;
  const cases: Record<string, Uint8Array> = {
    "unsupported ancillary": png(
      header(),
      chunk("iCCP", Buffer.from("fake")),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "invalid transparency for RGBA": png(
      header(),
      chunk("tRNS", Buffer.alloc(6)),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "invalid sRGB metadata": png(
      header(),
      chunk("sRGB", Buffer.from([9])),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "missing IHDR": png(chunk("IDAT", compressed), chunk("IEND")),
    "duplicate IHDR": png(
      header(),
      header(),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "missing IDAT": png(header(), chunk("IEND")),
    "missing IEND": png(header(), chunk("IDAT", compressed)),
    "truncated chunk": good.slice(0, -1),
    "trailing bytes": new Uint8Array([...good, 0]),
    "bad chunk CRC": badCrc,
    "unsupported bit depth": png(
      header(6, 16),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "unsupported color mode": png(
      header(3),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "unsupported interlace": png(
      header(6, 8, 1),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "unknown critical chunk": png(
      header(),
      chunk("ABCD"),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "animated PNG": png(
      header(),
      chunk("acTL", Buffer.alloc(8)),
      chunk("IDAT", compressed),
      chunk("IEND"),
    ),
    "non-contiguous IDAT": png(
      header(),
      chunk("IDAT", compressed.subarray(0, 8)),
      chunk("tEXt"),
      chunk("IDAT", compressed.subarray(8)),
      chunk("IEND"),
    ),
    "invalid deflate": png(
      header(),
      chunk("IDAT", Buffer.from("fake")),
      chunk("IEND"),
    ),
    "truncated deflate": png(
      header(),
      chunk("IDAT", compressed.subarray(0, -8)),
      chunk("IEND"),
    ),
    "bad zlib checksum with valid chunk CRC": png(
      header(),
      chunk("IDAT", badAdler),
      chunk("IEND"),
    ),
    "too few pixel bytes": png(
      header(),
      chunk("IDAT", deflateSync(pixels.subarray(1))),
      chunk("IEND"),
    ),
    "excess pixel bytes": png(
      header(),
      chunk("IDAT", deflateSync(Buffer.concat([pixels, Buffer.alloc(1)]))),
      chunk("IEND"),
    ),
    "invalid row filter": png(
      header(),
      chunk("IDAT", deflateSync(badFilter)),
      chunk("IEND"),
    ),
  };
  for (const [name, bytes] of Object.entries(cases)) {
    assert.equal((await run(bytes)).ok, false, name);
  }
});

test("ZIP preserves valid RGB/RGBA detail PNG, including consecutive IDAT chunks", async () => {
  const rgb = Buffer.alloc((860 * 3 + 1) * 100);
  for (const bytes of [
    good,
    png(header(2), chunk("IDAT", deflateSync(rgb)), chunk("IEND")),
    png(
      header(),
      chunk("IDAT", compressed.subarray(0, 8)),
      chunk("IDAT", compressed.subarray(8)),
      chunk("IEND"),
    ),
  ]) {
    const result = await run(bytes);
    assert.ok(result.ok);
    assert.deepEqual(unzipSync(result.value)["detail/detail-001.png"], bytes);
  }
});
