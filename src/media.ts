// Local image boundary shared by restore, blocks and export. No HTML parsing.
export type ParsedImage = {
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
  width: number;
  height: number;
};
const MAX_BYTES = 2 * 1024 * 1024;
const u32 = (b: Uint8Array, n: number) =>
  new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(n);
const str = (b: Uint8Array, from: number, size: number) =>
  String.fromCharCode(...b.slice(from, from + size));
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngSize(b: Uint8Array): [number, number] {
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
    throw Error("PNG signature");
  let offset = 8,
    width = 0,
    height = 0,
    data = false,
    end = false;
  while (offset + 12 <= b.length) {
    const size = u32(b, offset),
      type = str(b, offset + 4, 4),
      next = offset + size + 12;
    if (
      next > b.length ||
      crc32(b.subarray(offset + 4, next - 4)) !== u32(b, next - 4)
    )
      throw Error("PNG integrity");
    if (offset === 8) {
      if (type !== "IHDR" || size !== 13) throw Error("PNG header");
      width = u32(b, offset + 8);
      height = u32(b, offset + 12);
    }
    if (type === "IDAT" && size > 0) data = true;
    offset = next;
    if (type === "IEND") {
      if (size !== 0 || offset !== b.length) throw Error("PNG end");
      end = true;
      break;
    }
  }
  if (!data || !end) throw Error("PNG incomplete");
  return [width, height];
}
function jpegSize(b: Uint8Array): [number, number] {
  if (
    b[0] !== 255 ||
    b[1] !== 216 ||
    b[b.length - 2] !== 255 ||
    b[b.length - 1] !== 217
  )
    throw Error("JPEG signature");
  let pos = 2,
    width = 0,
    height = 0,
    scan = false;
  while (pos + 4 < b.length) {
    if (b[pos++] !== 255) throw Error("JPEG marker");
    while (b[pos] === 255) pos++;
    const marker = b[pos++];
    if (marker === 0xda) {
      scan = true;
      break;
    }
    const length = (b[pos] << 8) | b[pos + 1];
    if (length < 2 || pos + length > b.length) throw Error("JPEG length");
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      if (length < 8) throw Error("JPEG frame");
      height = (b[pos + 3] << 8) | b[pos + 4];
      width = (b[pos + 5] << 8) | b[pos + 6];
    }
    pos += length;
  }
  if (!scan) throw Error("JPEG scan");
  return [width, height];
}
function webpSize(b: Uint8Array): [number, number] {
  const view = new DataView(b.buffer);
  if (
    str(b, 0, 4) !== "RIFF" ||
    str(b, 8, 4) !== "WEBP" ||
    view.getUint32(4, true) + 8 !== b.length
  )
    throw Error("WebP signature");
  let pos = 12,
    width = 0,
    height = 0,
    image = false;
  const le24 = (n: number) => b[n] | (b[n + 1] << 8) | (b[n + 2] << 16);
  while (pos + 8 <= b.length) {
    const type = str(b, pos, 4),
      length = view.getUint32(pos + 4, true),
      start = pos + 8;
    if (start + length > b.length) throw Error("WebP length");
    if (type === "VP8X" && length === 10) {
      width = le24(start + 4) + 1;
      height = le24(start + 7) + 1;
    }
    if (
      type === "VP8 " &&
      length >= 10 &&
      str(b, start + 3, 3) === "\x9d\x01\x2a"
    ) {
      image = true;
      width ||= view.getUint16(start + 6, true) & 0x3fff;
      height ||= view.getUint16(start + 8, true) & 0x3fff;
    }
    if (type === "VP8L" && length >= 5 && b[start] === 0x2f) {
      image = true;
      const bits = view.getUint32(start + 1, true);
      width ||= (bits & 0x3fff) + 1;
      height ||= ((bits >>> 14) & 0x3fff) + 1;
    }
    pos = start + length + (length % 2);
  }
  // Animated WebP is not supported by this first-frame product asset boundary.
  if (!image || pos !== b.length) throw Error("WebP incomplete or animated");
  return [width, height];
}
export function parseImageDataUrl(
  value: unknown,
  expectedMime?: string,
): ParsedImage | null {
  try {
    if (typeof value !== "string" || value.length > 2_800_000) return null;
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        value,
      );
    if (!match || (expectedMime && match[1] !== expectedMime)) return null;
    const binary = atob(match[2]);
    if (
      btoa(binary) !== match[2] ||
      !binary.length ||
      binary.length > MAX_BYTES
    )
      return null;
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const [width, height] =
      match[1] === "image/png"
        ? pngSize(bytes)
        : match[1] === "image/jpeg"
          ? jpegSize(bytes)
          : webpSize(bytes);
    if (
      !width ||
      !height ||
      width > 10000 ||
      height > 10000 ||
      width * height > 40_000_000
    )
      return null;
    return { bytes, mime: match[1], width, height };
  } catch {
    return null;
  }
}
export async function inspectImage(
  value: string,
  expectedMime?: string,
): Promise<(ParsedImage & { sha256: string }) | null> {
  const parsed = parseImageDataUrl(value, expectedMime);
  if (!parsed) return null;
  // Actual decoding is part of the shared browser boundary, not only the upload UI.
  if (typeof Image !== "undefined") {
    try {
      const image = new Image();
      image.src = value;
      await image.decode();
      // JPEG orientation metadata may swap displayed width/height.
      if (
        !(
          image.naturalWidth === parsed.width &&
          image.naturalHeight === parsed.height
        ) &&
        !(
          image.naturalWidth === parsed.height &&
          image.naturalHeight === parsed.width
        )
      )
        return null;
    } catch {
      return null;
    }
  }
  const digest = await crypto.subtle.digest("SHA-256", parsed.bytes);
  return {
    ...parsed,
    sha256: Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
