import { define, success } from "./contract";
import type { Product } from "../model";
export const captureGuide = define<{ product: Product }, string[]>(
  { id: "capture-guide", effects: ["read"], approval: "none" },
  ({ product }) =>
    success(product, [
      "대표 정면 사진",
      "상품 고유 디테일",
      "크기 비교 또는 치수 확인",
      ...(product.options ? ["옵션별 색상·구성 사진 확인"] : []),
    ]),
  (value) => Array.isArray(value) && value.every((v) => typeof v === "string"),
);
