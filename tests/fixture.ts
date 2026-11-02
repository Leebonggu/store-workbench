import { newProduct, type Product } from "../src/model";
import { manageAsset } from "../src/blocks/assets";
import { generateDraft } from "../src/pipeline";
import { approve } from "../src/blocks/approval";
export const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAAGQCAYAAADfrrmFAAAJZ0lEQVR4nO3UoY3dAABEwV9dULq4Js0tuYrwwwfCIv0UETnPuh0wfMm+1+evrzfAolc9AKAigMAsAQRmCSAwSwCBWQIIzBJAYJYAArMEEJglgMAsAQRmCSAwSwCBWQIIzBJAYJYAArMEEJglgMAsAQRmCSAwSwCBWQIIzBJAYJYAArMEEJglgMAsAQRmCSAwSwCBWQIIzBJAYJYAArMEEJglgMAsAQRmCSAwSwCBWQIIzBJAYJYAArO+VQDff34D/0H9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XQAGETP11ARRAyNRfF0ABhEz9dQEUQMjUXxdAAYRM/XUBFEDI1F8XwCiAPz5+wqMJoAAKILMEUAAFkFkCKIACyCwBFEABZJYACiBwo/rrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AUQDP64BHE0ABFEBmCaAAAjeqvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAhgF8LwOeDQBFEABZJYACiBwo/rrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AUQDP64BHE0ABFEBmCaAAAjeqvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAhgF8LwOeDQBFEABZJYACiBwo/rrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AUQDP64BHE0ABFEBmCaAAAjeqvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAiiAkKm/LoACCJn66wIogJCpvy6AAgiZ+usCKICQqb8ugAIImfrrAgjwjwQQmCWAwCwBBGYJIDBLAIFZAgjMEkBglgACswQQmCWAwCwBBGYJIDBLAIFZAgjMEkBglgACswQQmCWAwCwBBGYJIDBLAIFZAgjMEkBglgACswQQmCWAwCwBBGYJIDBLAIFZAgjMEkBglgACswQQmCWAwCwBBGYJIDBLAIFZAgjMEkBg1l89j/Ra5D1ghgAAAABJRU5ErkJggg==";
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
