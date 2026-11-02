import type { Product, Draft } from "../model";
import type { Copy } from "./copy";
import { define, fail, success } from "./contract";
export const composeDetail = define<{ product: Product; copy: Copy }, Draft>(
  { id: "detail-composition", effects: ["read"], approval: "none" },
  ({ product, copy }) => {
    if (
      !copy ||
      typeof copy.title !== "string" ||
      !Array.isArray(copy.lines) ||
      copy.lines.some((l) => typeof l !== "string")
    )
      return fail("INVALID_INPUT", "문구 블록 출력이 필요합니다.");
    if (copy.productId !== product.id || copy.sourceVersion !== product.version)
      return fail("VERSION_MISMATCH", "문구와 상품의 원본 버전이 다릅니다.");
    return success(product, {
      channel: "smartstore",
      sourceVersion: product.version,
      rulesVersion: "manual-v1",
      generator: "local-template",
      version: (product.draft?.version ?? 0) + 1,
      title: copy.title,
      description: [
        ...copy.lines,
        ...(product.options.trim()
          ? [`옵션 안내 (판매자 입력): ${product.options.trim()}`]
          : []),
      ].join("\n"),
      assetIds: product.assets.map((a) => a.id),
    });
  },
  (draft) =>
    draft.channel === "smartstore" &&
    !!draft.title.trim() &&
    !!draft.description.trim(),
);
