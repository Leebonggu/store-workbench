import type { Product, Draft } from "./model";
import type { Result } from "./blocks/contract";
import { channelCopy } from "./blocks/copy";
import { composeDetail } from "./blocks/detail";
export async function generateDraft(product: Product): Promise<Result<Draft>> {
  const copy = await channelCopy.run({ product });
  if (!copy.ok) return copy;
  const detail = await composeDetail.run({ product, copy: copy.value });
  if (detail.ok) detail.warnings.push(...copy.warnings);
  return detail;
}
