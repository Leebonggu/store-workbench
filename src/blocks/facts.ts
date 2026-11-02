import { define, fail, success } from "./contract";
import { keys, type Product, type Fact } from "../model";
export const candidateFacts = define<
  { product: Product; text: string; source: string },
  Fact[]
>(
  { id: "candidate-facts", effects: ["read"], approval: "none" },
  ({ product, text, source }) => {
    if (
      typeof text !== "string" ||
      typeof source !== "string" ||
      !source.trim()
    )
      return fail("INVALID_INPUT", "후보 정보의 출처를 적어주세요.");
    const parsed = text.split("\n").flatMap((line) => {
      const [key, ...value] = line.split(":");
      return keys.includes(key as Fact["key"]) && value.join(":").trim()
        ? [
            {
              key: key as Fact["key"],
              value: value.join(":").trim(),
              source,
              confirmed: false,
            },
          ]
        : [];
    });
    if (
      !parsed.length ||
      new Set(parsed.map((f) => f.key)).size !== parsed.length
    )
      return fail(
        "INVALID_INPUT",
        "name:상품명 형식으로 서로 다른 항목을 입력하세요.",
      );
    return success(product, parsed, [
      "로컬 텍스트 파서입니다. OCR·AI 추출이 아닙니다.",
    ]);
  },
  (facts) => facts.every((f) => keys.includes(f.key) && !f.confirmed),
);
export const confirmFacts = define<{ product: Product; facts: Fact[] }, Fact[]>(
  { id: "human-facts", effects: ["write"], approval: "human-fact" },
  ({ product, facts }) => {
    if (
      !Array.isArray(facts) ||
      facts.length !== keys.length ||
      keys.some((k) => facts.filter((f) => f.key === k).length !== 1) ||
      facts.some(
        (f) =>
          typeof f.value !== "string" ||
          typeof f.source !== "string" ||
          typeof f.confirmed !== "boolean",
      )
    )
      return fail("INVALID_INPUT", "상품 정보 형식이 올바르지 않습니다.");
    if (facts.some((f) => f.confirmed && (!f.value.trim() || !f.source.trim())))
      return fail("MISSING_FACTS", "확인한 항목에는 값과 출처가 필요합니다.");
    const price = facts.find((f) => f.key === "price")!;
    if (price.confirmed && !/^[1-9]\d*$/.test(price.value))
      return fail(
        "INVALID_INPUT",
        "가격은 0보다 큰 원 단위 정수로 입력하세요.",
      );
    return success(
      product,
      facts.map((f) => ({
        ...f,
        value: f.value.trim(),
        source: f.source.trim(),
      })),
    );
  },
  (facts) => facts.length === keys.length,
);
