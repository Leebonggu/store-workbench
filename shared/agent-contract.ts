/** Public AI boundary. No internal rights notes or credentials are sent. */
export type AgentInput = {
  productId: string;
  sourceVersion: number;
  facts: { key: string; value: string; confirmed: boolean }[];
  options: string;
  skus?: { label: string; price: number }[];
  images: { mimeType: string; data: string }[];
  instruction: string;
  previousDraft?: { title: string; description: string };
};
export type AgentOutput = {
  productId: string;
  sourceVersion: number;
  title: string;
  description: string;
  questions: string[];
  observations: string[];
  keywords: string[];
  checklist: string[];
};
export function validateAgentOutput(value: unknown): value is AgentOutput {
  if (!value || typeof value !== "object") return false;
  const x = value as AgentOutput;
  return (
    typeof x.productId === "string" &&
    Number.isInteger(x.sourceVersion) &&
    typeof x.title === "string" &&
    x.title.length > 0 &&
    x.title.length <= 300 &&
    typeof x.description === "string" &&
    x.description.length > 0 &&
    x.description.length <= 10000 &&
    [x.questions, x.observations, x.keywords, x.checklist].every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 30 &&
        a.every((t) => typeof t === "string" && t.length <= 2000),
    )
  );
}
export function publicProduct(
  p: {
    id: string;
    version: number;
    facts: AgentInput["facts"];
    options: string;
    skus?: { label: string; price: number }[];
    assets: { mime: string; dataUrl: string }[];
    draft?: { title: string; description: string };
  },
  instruction: string,
): AgentInput {
  return {
    productId: p.id,
    sourceVersion: p.version,
    facts: p.facts.map(({ key, value, confirmed }) => ({
      key,
      value: confirmed ? value : "",
      confirmed,
    })),
    options: p.options,
    skus: p.skus?.map(({ label, price }) => ({ label, price })),
    images: p.assets.map((a) => ({
      mimeType: a.mime,
      data: a.dataUrl.split(",")[1],
    })),
    instruction,
    previousDraft: p.draft
      ? { title: p.draft.title, description: p.draft.description }
      : undefined,
  };
}
