import { contentHash, type Product, type SKU } from "../model";
import { readyIssues } from "./approval";
import { define, fail, success, type Failure } from "./contract";
export const capabilities = {
  preview: true,
  export: true,
  create: false,
  update: false,
  status: false,
  officialValidation: false,
} as const;
export type ExportPackage = {
  format: "store-workbench-manual-v1";
  productId: string;
  sourceVersion: number;
  contentHash: string;
  channel: "smartstore";
  title: string;
  price: number;
  description: string;
  options: string;
  skus: SKU[];
  images: {
    assetId: string;
    filename: string;
    mime: string;
    dataUrl: string;
    sha256: string;
  }[];
  checklist: string[];
};
export const exportChannel = define<
  { product: Product; expectedVersion: number },
  ExportPackage
>(
  { id: "smartstore-export", effects: ["download"], approval: "human-output" },
  async ({ product, expectedVersion }) => {
    if (expectedVersion !== product.version)
      return fail("VERSION_MISMATCH", "내보낼 상품 버전이 달라졌습니다.");
    const issues = readyIssues(product);
    if (issues.length) return fail("NOT_APPROVED", issues.join(" "));
    const digest = await contentHash(product);
    if (!product.approval || product.approval.hash !== digest)
      return fail("NOT_APPROVED", "현재 내용을 검수·승인한 뒤 내보내세요.");
    return success(product, {
      format: "store-workbench-manual-v1",
      productId: product.id,
      sourceVersion: product.version,
      contentHash: digest,
      channel: "smartstore",
      title: product.draft!.title,
      price: Number(product.facts.find((fact) => fact.key === "price")!.value),
      description: product.draft!.description,
      options: product.options,
      skus: (product.skus ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        price: s.price,
        stock: s.stock,
        assetId: s.assetId,
      })),
      images: product.assets.map((a, i) => ({
        assetId: a.id,
        filename: `product-${i + 1}.${a.mime.split("/")[1]}`,
        mime: a.mime,
        dataUrl: a.dataUrl,
        sha256: a.sha256,
      })),
      checklist: [
        "공식 일괄 업로드 형식이 아닙니다.",
        "카테고리·필수 고시·배송·반품·가격·옵션·인증 해당 여부를 판매자센터에서 확인하세요.",
        "사진과 문구의 상품 일치 여부를 마지막으로 확인하세요.",
        "내보내기는 게시 완료가 아닙니다.",
      ],
    });
  },
  (value) =>
    value.format === "store-workbench-manual-v1" &&
    !!value.title &&
    Array.isArray(value.images),
);
export async function unsupportedChannelOperation(
  operation: "create" | "update" | "status",
): Promise<Failure> {
  return fail(
    "UNSUPPORTED",
    `${operation}: 공식 판매처 API는 연결되지 않았습니다.`,
  );
}
