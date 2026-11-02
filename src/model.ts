import { parseImageDataUrl, inspectImage } from "./media";
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
    /^[A-Za-z0-9_-]{1,100}$/.test(p.id) &&
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
    p.assets.length <= 3 &&
    new Set(p.assets.map((a) => a?.id)).size === p.assets.length &&
    p.assets.every(
      (a) =>
        a &&
        typeof a.id === "string" &&
        /^[A-Za-z0-9_-]{1,100}$/.test(a.id) &&
        typeof a.name === "string" &&
        typeof a.mime === "string" &&
        typeof a.dataUrl === "string" &&
        !!parseImageDataUrl(a.dataUrl, a.mime) &&
        typeof a.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(a.sha256) &&
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

export function factIssues(p: Product): string[] {
  return p.facts.flatMap((f) => {
    if (!f.confirmed) return [];
    if (!f.value.trim() || !f.source.trim())
      return [`${LABELS[f.key]}: 확인한 값과 출처가 필요합니다.`];
    if (
      f.key === "price" &&
      (!/^[1-9]\d*$/.test(f.value) || !Number.isSafeInteger(Number(f.value)))
    )
      return ["가격은 안전한 범위의 양의 원 단위 정수여야 합니다."];
    return [];
  });
}
export async function validateProduct(
  value: unknown,
): Promise<string | undefined> {
  try {
    if (!isProduct(value))
      return "상품·사진의 형식 또는 이미지 바이트가 올바르지 않습니다.";
    const issues = factIssues(value);
    if (issues.length) return issues.join(" ");
    for (const asset of value.assets) {
      const image = await inspectImage(asset.dataUrl, asset.mime);
      if (!image || image.sha256 !== asset.sha256)
        return `${asset.name}: 사진 디코딩·크기·원본 해시를 확인하세요.`;
    }
    return undefined;
  } catch {
    return "상품 자료를 검증하지 못했습니다.";
  }
}
