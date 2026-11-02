import type { Product } from "../model";
import { exportChannel, type ExportPackage } from "./channel";
import { fail, type Result } from "./contract";
export type SellerSetup = {
  categoryReference: string;
  deliveryPolicyReference: string;
  noticeReviewReference: string;
};
export type RegistrationIntent = {
  mode: "mock";
  schema: "internal-registration-intent-v1";
  setup: SellerSetup;
  listing: ExportPackage;
  networkCalls: 0;
};
// Internal preparation contract only, deliberately NOT the official API payload.
export async function prepareSmartstoreMock(
  product: Product,
  setup: SellerSetup,
): Promise<Result<RegistrationIntent>> {
  if (
    !setup ||
    ![
      setup.categoryReference,
      setup.deliveryPolicyReference,
      setup.noticeReviewReference,
    ].every((v) => typeof v === "string" && v.trim())
  )
    return fail(
      "INVALID_INPUT",
      "카테고리·배송·필수 고시 검토 참조가 필요합니다.",
    );
  const result = await exportChannel.run({
    product,
    expectedVersion: product.version,
  });
  if (!result.ok) return result;
  return {
    ...result,
    value: {
      mode: "mock",
      schema: "internal-registration-intent-v1",
      setup: {
        categoryReference: setup.categoryReference,
        deliveryPolicyReference: setup.deliveryPolicyReference,
        noticeReviewReference: setup.noticeReviewReference,
      },
      listing: result.value,
      networkCalls: 0,
    },
  };
}
