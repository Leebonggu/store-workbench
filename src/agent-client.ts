import { publicProduct, validateAgentOutput } from "../shared/agent-contract";
import type { Product } from "./model";
export async function requestProposal(product: Product, instruction: string) {
  const response = await fetch("/api/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(publicProduct(product, instruction)),
    signal: AbortSignal.timeout(100000),
  });
  const result: unknown = await response.json();
  if (!response.ok)
    throw Error(
      typeof result === "object" && result && "error" in result
        ? String(result.error)
        : "AI 서버 연결 실패",
    );
  if (
    !validateAgentOutput(result) ||
    result.productId !== product.id ||
    result.sourceVersion !== product.version
  )
    throw Error("상품과 AI 결과 버전이 다릅니다. 기존 초안을 유지합니다.");
  return result;
}
