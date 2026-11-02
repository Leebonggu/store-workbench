import { isProduct, type Product } from "../model";
export type Code =
  | "INVALID_INPUT"
  | "MISSING_FACTS"
  | "RIGHTS_HOLD"
  | "VERSION_MISMATCH"
  | "NOT_APPROVED"
  | "UNSUPPORTED"
  | "ASSET_ERROR";
export type Failure = {
  ok: false;
  error: { code: Code; message: string; retryable: boolean };
};
export type Result<T> =
  | {
      ok: true;
      value: T;
      lineage: { productId: string; sourceVersion: number; schemaVersion: 1 };
      warnings: string[];
    }
  | Failure;
export type Meta = {
  id: string;
  effects: readonly ("read" | "write" | "download")[];
  approval: "none" | "human-fact" | "human-rights" | "human-output";
  cost: "none";
  externalTransmission: false;
};
export interface Block<I, O> {
  meta: Meta;
  run(input: I): Promise<Result<O>>;
}
export const fail = (code: Code, message: string): Failure => ({
  ok: false,
  error: { code, message, retryable: false },
});
export function success<T>(
  p: Product,
  value: T,
  warnings: string[] = [],
): Result<T> {
  return {
    ok: true,
    value,
    lineage: { productId: p.id, sourceVersion: p.version, schemaVersion: 1 },
    warnings,
  };
}
export function define<I extends { product: Product }, O>(
  meta: Omit<Meta, "cost" | "externalTransmission">,
  run: (input: I) => Promise<Result<O>> | Result<O>,
  validOutput: (value: O) => boolean,
): Block<I, O> {
  return {
    meta: { ...meta, cost: "none", externalTransmission: false },
    async run(input) {
      if (!input || !isProduct(input.product))
        return fail("INVALID_INPUT", "상품 스키마를 확인하세요.");
      try {
        const result = await run(input);
        return result.ok && !validOutput(result.value)
          ? fail("INVALID_INPUT", "블록 출력이 계약과 다릅니다.")
          : result;
      } catch {
        return fail(
          "INVALID_INPUT",
          "처리하지 못했습니다. 기존 초안은 유지됩니다.",
        );
      }
    },
  };
}
