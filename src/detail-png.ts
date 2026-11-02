import { crc32 } from "./media";

// Narrow renderer contract: static, non-interlaced 8-bit RGB/RGBA PNG.
// Validate chunks and decode the zlib scanlines with a bounded reader in Node
// and the browser. A signature/dimension check alone is not a PNG decoder.
export async function validDetailPng(
  bytes: Uint8Array,
  width: number,
  height: number,
): Promise<boolean> {
  try {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.length < 57 ||
      bytes.length > 12 * 1024 * 1024 ||
      width !== 860 ||
      !Number.isInteger(height) ||
      height < 1 ||
      height > 3000 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
    )
      return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8,
      channels = 0,
      ended = false,
      dataEnded = false,
      palette = false;
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const metadata = new Set<string>();
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset),
        next = offset + size + 12;
      if (next > bytes.length) return false;
      const type = String.fromCharCode(
        ...bytes.subarray(offset + 4, offset + 8),
      );
      if (
        !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) ||
        crc32(bytes.subarray(offset + 4, next - 4)) !== view.getUint32(next - 4)
      )
        return false;
      if (offset === 8) {
        if (
          type !== "IHDR" ||
          size !== 13 ||
          view.getUint32(offset + 8) !== width ||
          view.getUint32(offset + 12) !== height ||
          bytes[offset + 16] !== 8 ||
          ![2, 6].includes(bytes[offset + 17]) ||
          bytes[offset + 18] !== 0 ||
          bytes[offset + 19] !== 0 ||
          bytes[offset + 20] !== 0
        )
          return false;
        channels = bytes[offset + 17] === 6 ? 4 : 3;
      } else if (type === "IHDR") return false;
      else if (type === "IDAT") {
        if (dataEnded) return false;
        chunks.push(new Uint8Array(bytes.subarray(offset + 8, next - 4)));
      } else {
        if (chunks.length) dataEnded = true;
        if (type === "IEND") {
          if (size !== 0 || next !== bytes.length || !chunks.length)
            return false;
          ended = true;
        } else if (type === "PLTE") {
          if (palette || chunks.length || !size || size > 768 || size % 3)
            return false;
          palette = true;
        } else {
          // Only recognized, structurally checked metadata is accepted. The
          // current Canvas renderer does not need arbitrary ancillary chunks.
          if (chunks.length || metadata.has(type)) return false;
          metadata.add(type);
          const start = offset + 8;
          if (type === "sRGB") {
            if (size !== 1 || bytes[start] > 3) return false;
          } else if (type === "gAMA") {
            if (size !== 4 || view.getUint32(start) === 0) return false;
          } else if (type === "cHRM") {
            if (size !== 32) return false;
          } else if (type === "pHYs") {
            if (size !== 9 || bytes[start + 8] > 1) return false;
          } else if (type === "tRNS") {
            if (
              channels !== 3 ||
              size !== 6 ||
              [0, 2, 4].some((n) => view.getUint16(start + n) > 255)
            )
              return false;
          } else return false;
        }
      }
      offset = next;
      if (ended) break;
    }
    if (!ended || offset !== bytes.length || !channels) return false;
    const stride = width * channels + 1,
      expected = stride * height;
    const reader = new Blob(chunks)
      .stream()
      .pipeThrough(new DecompressionStream("deflate"))
      .getReader();
    let count = 0,
      complete = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          complete = true;
          break;
        }
        if (count + value.length > expected) return false;
        // Each scanline begins with a valid PNG filter byte; the following
        // channel bytes always decode to pixels under these supported modes.
        for (
          let i = (stride - (count % stride)) % stride;
          i < value.length;
          i += stride
        )
          if (value[i] > 4) return false;
        count += value.length;
      }
      return count === expected;
    } finally {
      if (!complete) await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  } catch {
    return false;
  }
}
