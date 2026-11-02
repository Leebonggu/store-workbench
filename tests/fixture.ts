import { newProduct, type Product } from "../src/model";
import { manageAsset } from "../src/blocks/assets";
import { generateDraft } from "../src/pipeline";
import { approve } from "../src/blocks/approval";
export const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
export async function readyProduct(): Promise<Product> {
  const p = newProduct("synthetic-ready");
  p.facts[0] = {
    key: "name",
    value: "Synthetic product",
    source: "synthetic",
    confirmed: true,
  };
  p.facts[1] = {
    key: "price",
    value: "3000",
    source: "synthetic",
    confirmed: true,
  };
  const asset = await manageAsset.run({
    product: p,
    name: "synthetic.png",
    dataUrl: `data:image/png;base64,${PNG}`,
    source: "synthetic",
  });
  if (!asset.ok) throw Error(asset.error.message);
  p.assets = [{ ...asset.value, rightsConfirmed: true }];
  p.channelRights = true;
  p.rightsNote = "synthetic";
  const draft = await generateDraft(p);
  if (!draft.ok) throw Error(draft.error.message);
  p.draft = draft.value;
  const approval = await approve.run({
    product: p,
    expectedVersion: p.version,
    reviewer: "synthetic",
    visualReviewed: true,
  });
  if (!approval.ok) throw Error(approval.error.message);
  p.approval = approval.value;
  return p;
}
