import { zipSync, strToU8 } from "fflate";
import { validDetailPng } from "../detail-png";
import { parseImageDataUrl } from "../media";
import { contentHash, type Product } from "../model";
import { exportChannel } from "./channel";
import { define, fail, success } from "./contract";
export type DetailPage = {
  sourceHash: string;
  filename: string;
  bytes: Uint8Array;
  width: number;
  height: number;
};
export const packageZip = define<
  { product: Product; pages: DetailPage[] },
  Uint8Array
>(
  { id: "manual-package-zip", effects: ["download"], approval: "human-output" },
  async ({ product, pages }) => {
    const result = await exportChannel.run({
      product,
      expectedVersion: product.version,
    });
    if (!result.ok) return result;
    const sourceHash = await contentHash(product);
    if (
      !Array.isArray(pages) ||
      !pages.length ||
      pages.length > 30 ||
      pages.some(
        (p, i) =>
          p.sourceHash !== sourceHash ||
          p.filename !== `detail-${String(i + 1).padStart(3, "0")}.png` ||
          !(p.bytes instanceof Uint8Array),
      )
    )
      return fail("INVALID_INPUT", "상세 출력 페이지를 확인하세요.");
    for (const page of pages) {
      if (!(await validDetailPng(page.bytes, page.width, page.height)))
        return fail(
          "INVALID_INPUT",
          "상세 PNG의 구조·압축 데이터·크기를 확인하세요.",
        );
    }
    const files: Record<string, Uint8Array> = {};
    result.value.images.forEach((image, i) => {
      const parsed = parseImageDataUrl(image.dataUrl, image.mime)!;
      files[
        `originals/product-${String(i + 1).padStart(3, "0")}.${image.mime.split("/")[1]}`
      ] = parsed.bytes;
    });
    pages.forEach((page) => (files[`detail/${page.filename}`] = page.bytes));
    const { images, ...manifest } = result.value;
    files["manifest.json"] = strToU8(
      JSON.stringify(
        {
          ...manifest,
          images: images.map((image, i) => ({
            assetId: image.assetId,
            filename: `originals/product-${String(i + 1).padStart(3, "0")}.${image.mime.split("/")[1]}`,
            sha256: image.sha256,
          })),
          detailPages: pages.map((p) => ({
            filename: `detail/${p.filename}`,
            width: p.width,
            height: p.height,
          })),
        },
        null,
        2,
      ),
    );
    files["listing.txt"] = strToU8(
      `${result.value.title}\n\n${result.value.description}\n\n${result.value.checklist.join("\n")}`,
    );
    files["READ-ME.txt"] = strToU8(
      "수동 등록 준비 패키지입니다. 공식 업로드 양식이 아닙니다. originals는 원본 사진, detail은 실사와 판매자 확인 문구로 만든 상세 PNG입니다. 판매자센터에서 필수 상품정보·배송·반품·인증·옵션·가격을 확인한 뒤 등록하세요. 내부 출처·권리 메모와 검수자는 제외했습니다. 원본 사진 메타데이터는 보존됩니다.",
    );
    return success(product, zipSync(files, { level: 0 }));
  },
  (value) => value instanceof Uint8Array && value.length > 0,
);
