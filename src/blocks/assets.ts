import { inspectImage } from "../media";
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
    if (product.assets.length >= 3)
      return fail("ASSET_ERROR", "로컬 초안은 상품당 사진 3장까지 지원합니다.");
    const image = await inspectImage(dataUrl);
    if (!image)
      return fail(
        "ASSET_ERROR",
        "사진 형식·바이트·크기를 확인하세요. 정지 PNG/JPEG/WebP, 2MB 이하만 지원합니다.",
      );
    const { sha256, mime } = image;
    if (product.assets.some((a) => a.sha256 === sha256))
      return fail("ASSET_ERROR", "이미 추가한 원본 사진입니다.");
    return success(product, {
      id: crypto.randomUUID(),
      name,
      mime,
      dataUrl,
      sha256,
      source,
      rightsConfirmed: false,
    });
  },
  (a) => typeof a.id === "string" && !!a.sha256 && a.rightsConfirmed === false,
);
