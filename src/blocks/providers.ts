import { candidateFacts } from "./facts";
import { fail, type Result } from "./contract";
import type { Fact, Product } from "../model";
export type ExtractionProvider = {
  id: string;
  mode: "mock" | "live";
  extract(input: {
    productId: string;
    sourceVersion: number;
    assetIds: string[];
  }): Promise<{
    productId: string;
    sourceVersion: number;
    source: string;
    text: string;
  }>;
};
// Live providers remain disconnected: no keys, environment reads or network calls.
export async function extractWithProvider(
  product: Product,
  provider?: ExtractionProvider,
): Promise<Result<Fact[]>> {
  if (!provider || provider.mode !== "mock")
    return fail(
      "UNSUPPORTED",
      "AI/OCR 실연동은 비활성화되어 있습니다. 수동 후보 입력을 사용하세요.",
    );
  try {
    const result = await provider.extract({
      productId: product.id,
      sourceVersion: product.version,
      assetIds: product.assets.map((a) => a.id),
    });
    if (
      result.productId !== product.id ||
      result.sourceVersion !== product.version
    )
      return fail("VERSION_MISMATCH", "추출 결과의 원본 버전이 다릅니다.");
    return candidateFacts.run({
      product,
      text: result.text,
      source: result.source,
    });
  } catch {
    return fail(
      "INVALID_INPUT",
      "모의 추출 실패. 수동 입력과 기존 초안은 유지됩니다.",
    );
  }
}
