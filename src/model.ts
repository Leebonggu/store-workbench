export const SCHEMA = 1 as const;
export type FactKey = "name" | "price" | "material" | "size" | "origin";
export type Fact = {
  key: FactKey;
  value: string;
  source: string;
  confirmed: boolean;
};
export type Asset = {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  sha256: string;
  source: string;
  rightsConfirmed: boolean;
};
export type Draft = {
  channel: "smartstore";
  sourceVersion: number;
  rulesVersion: "manual-v1";
  title: string;
  description: string;
  assetIds: string[];
  generator: "local-template";
  version: number;
};
export type Product = {
  schemaVersion: 1;
  id: string;
  version: number;
  facts: Fact[];
  options: string;
  assets: Asset[];
  channelRights: boolean;
  rightsNote: string;
  draft?: Draft;
  approval?: { hash: string; reviewer: string; at: string };
  exported?: { hash: string; at: string };
  updatedAt: string;
};
export const LABELS: Record<FactKey, string> = {
  name: "상품명",
  price: "가격 (원)",
  material: "소재",
  size: "크기",
  origin: "원산지",
};
export const keys = Object.keys(LABELS) as FactKey[];
export function newProduct(id: string = crypto.randomUUID()): Product {
  return {
    schemaVersion: SCHEMA,
    id,
    version: 1,
    facts: keys.map((key) => ({
      key,
      value: "",
      source: "",
      confirmed: false,
    })),
    options: "",
    assets: [],
    channelRights: false,
    rightsNote: "",
    updatedAt: new Date().toISOString(),
  };
}
export function revise(
  p: Product,
  patch: Partial<
    Pick<
      Product,
      "facts" | "options" | "assets" | "channelRights" | "rightsNote"
    >
  >,
): Product {
  return {
    ...p,
    ...patch,
    version: p.version + 1,
    approval: undefined,
    exported: undefined,
    updatedAt: new Date().toISOString(),
  };
}
export function editDraft(
  p: Product,
  title: string,
  description: string,
): Product {
  if (!p.draft) return p;
  return {
    ...p,
    draft: { ...p.draft, title, description, version: p.draft.version + 1 },
    approval: undefined,
    exported: undefined,
    updatedAt: new Date().toISOString(),
  };
}
export async function hash(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function contentHash(p: Product): Promise<string> {
  return hash({
    schemaVersion: p.schemaVersion,
    id: p.id,
    version: p.version,
    facts: p.facts,
    options: p.options,
    assets: p.assets,
    channelRights: p.channelRights,
    rightsNote: p.rightsNote,
    draft: p.draft,
  });
}
export function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Product;
  return (
    p.schemaVersion === 1 &&
    typeof p.id === "string" &&
    Number.isInteger(p.version) &&
    p.version > 0 &&
    typeof p.options === "string" &&
    typeof p.rightsNote === "string" &&
    typeof p.channelRights === "boolean" &&
    typeof p.updatedAt === "string" &&
    Array.isArray(p.facts) &&
    p.facts.length === keys.length &&
    keys.every((key) => p.facts.filter((f) => f?.key === key).length === 1) &&
    p.facts.every(
      (f) =>
        typeof f.value === "string" &&
        typeof f.source === "string" &&
        typeof f.confirmed === "boolean",
    ) &&
    Array.isArray(p.assets) &&
    p.assets.every(
      (a) =>
        a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        typeof a.mime === "string" &&
        typeof a.dataUrl === "string" &&
        /^data:image\/(png|jpeg|webp);base64,/.test(a.dataUrl) &&
        typeof a.sha256 === "string" &&
        typeof a.source === "string" &&
        typeof a.rightsConfirmed === "boolean",
    ) &&
    (!p.draft ||
      (p.draft.channel === "smartstore" &&
        p.draft.rulesVersion === "manual-v1" &&
        Number.isInteger(p.draft.sourceVersion) &&
        Number.isInteger(p.draft.version) &&
        p.draft.generator === "local-template" &&
        typeof p.draft.title === "string" &&
        typeof p.draft.description === "string" &&
        Array.isArray(p.draft.assetIds) &&
        p.draft.assetIds.every((id) => typeof id === "string"))) &&
    (!p.approval ||
      (typeof p.approval.hash === "string" &&
        typeof p.approval.reviewer === "string" &&
        typeof p.approval.at === "string")) &&
    (!p.exported ||
      (typeof p.exported.hash === "string" &&
        typeof p.exported.at === "string"))
  );
}
