import { LABELS, type Product } from "../model";
import { define, fail, success } from "./contract";
export type Copy = {
  productId: string;
  sourceVersion: number;
  title: string;
  lines: string[];
  factKeys: string[];
};
export const channelCopy = define<{ product: Product }, Copy>(
  { id: "smartstore-copy", effects: ["read"], approval: "none" },
  ({ product }) => {
    const facts = product.facts.filter(
      (f) => f.confirmed && f.value.trim() && f.source.trim(),
    );
    if (!["name", "price"].every((key) => facts.some((f) => f.key === key)))
      return fail("MISSING_FACTS", "상품명과 가격을 출처와 함께 확인하세요.");
    return success(
      product,
      {
        productId: product.id,
        sourceVersion: product.version,
        title: facts.find((f) => f.key === "name")!.value,
        lines: facts
          .filter((f) => f.key !== "name")
          .map((f) => `${LABELS[f.key]}: ${f.value}`),
        factKeys: facts.map((f) => f.key),
      },
      [
        "로컬 템플릿 초안입니다. AI·검색량 분석·공식 채널 규칙 검증은 지원하지 않습니다.",
      ],
    );
  },
  (value) => !!value.title.trim() && Array.isArray(value.lines),
);
