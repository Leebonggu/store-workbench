import { contentHash, factIssues, type Product } from "../model";
import { rightsIssues } from "./rights";
import { define, fail, success } from "./contract";
export function readyIssues(p: Product): string[] {
  return [
    ...factIssues(p),
    ...rightsIssues(p),
    ...(!p.draft
      ? ["초안이 없습니다."]
      : p.draft.sourceVersion !== p.version
        ? ["상품 정보가 바뀌었습니다. 초안을 다시 만드세요."]
        : []),
    ...(["name", "price"].some(
      (key) =>
        !p.facts.some(
          (f) =>
            f.key === key && f.confirmed && f.source.trim() && f.value.trim(),
        ),
    )
      ? ["상품명·가격 확인이 필요합니다."]
      : []),
    ...(p.draft && (!p.draft.title.trim() || !p.draft.description.trim())
      ? ["초안 제목·설명을 작성하세요."]
      : []),
    ...(p.draft &&
    (p.draft.assetIds.length !== p.assets.length ||
      p.assets.some((a) => !p.draft!.assetIds.includes(a.id)))
      ? ["초안 사진 연결을 갱신하세요."]
      : []),
  ];
}
export const approve = define<
  {
    product: Product;
    expectedVersion: number;
    reviewer: string;
    visualReviewed: boolean;
  },
  NonNullable<Product["approval"]>
>(
  { id: "approval", effects: ["write"], approval: "human-output" },
  async ({ product, expectedVersion, reviewer, visualReviewed }) => {
    if (expectedVersion !== product.version)
      return fail("VERSION_MISMATCH", "최신 상품 버전을 다시 확인하세요.");
    const issues = readyIssues(product);
    if (issues.length) return fail("NOT_APPROVED", issues.join(" "));
    if (
      typeof reviewer !== "string" ||
      !reviewer.trim() ||
      visualReviewed !== true
    )
      return fail(
        "NOT_APPROVED",
        "검수자와 사진·문구·옵션 검수 확인이 필요합니다.",
      );
    return success(product, {
      hash: await contentHash(product),
      reviewer: reviewer.trim(),
      at: new Date().toISOString(),
    });
  },
  (value) => !!value.hash && !!value.reviewer,
);
