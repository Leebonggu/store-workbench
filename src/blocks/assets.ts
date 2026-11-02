import { define, fail, success } from "./contract";
import { type Product, type Asset } from "../model";
export const manageAsset = define<
  { product: Product; name: string; dataUrl: string; source: string },
  Asset
>(
  { id: "asset-import", effects: ["write"], approval: "none" },
  async ({ product, name, dataUrl, source }) => {
    if (
      typeof dataUrl !== "string" ||
      typeof name !== "string" ||
      typeof source !== "string" ||
      !name.trim() ||
      !source.trim()
    )
      return fail("ASSET_ERROR", "파일 이름과 촬영·자료 출처가 필요합니다.");
    if (
      dataUrl.length > 2_800_000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)
    )
      return fail(
        "ASSET_ERROR",
        "PNG/JPEG/WebP, 파일당 2MB 이하만 지원합니다.",
      );
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
    const validSignature =
      mime === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
        : mime === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!validSignature || bytes.length > 2 * 1024 * 1024)
      return fail("ASSET_ERROR", "원본 이미지 형식·크기를 확인하세요.");
    if (product.assets.length >= 3)
      return fail("ASSET_ERROR", "로컬 초안은 상품당 사진 3장까지 지원합니다.");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (product.assets.some((a) => a.sha256 === sha256))
      return fail("ASSET_ERROR", "이미 추가한 원본 사진입니다.");
    return success(product, {
      id: crypto.randomUUID(),
      name,
      mime: dataUrl.slice(5, dataUrl.indexOf(";")),
      dataUrl,
      sha256,
      source,
      rightsConfirmed: false,
    });
  },
  (a) => typeof a.id === "string" && !!a.sha256 && a.rightsConfirmed === false,
);
