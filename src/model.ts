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
export type SKU = {
  id: string;
  label: string;
  price: number;
  stock?: number;
  assetId: string;
};
export type Layout = {
  order: "photos-first" | "facts-first";
  accent: "forest" | "ink";
};
export type Draft = {
  layout?: Layout;
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
  skus?: SKU[];
  rightsExpiresOn?: string;
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
      | "facts"
      | "options"
      | "assets"
      | "channelRights"
      | "rightsNote"
      | "skus"
      | "rightsExpiresOn"
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
  layout?: Layout,
): Product {
  if (!p.draft) return p;
  return {
    ...p,
    draft: {
      ...p.draft,
      title,
      description,
      layout: layout ?? p.draft.layout,
      version: p.draft.version + 1,
    },
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
    skus: p.skus,
    rightsExpiresOn: p.rightsExpiresOn,
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
    p.options.length <= 5000 &&
    (p.rightsExpiresOn === undefined ||
      (typeof p.rightsExpiresOn === "string" &&
        validDate(p.rightsExpiresOn))) &&
    (p.skus === undefined ||
      (Array.isArray(p.skus) &&
        p.skus.length <= 50 &&
        p.skus.every(
          (s) =>
            s &&
            typeof s.id === "string" &&
            typeof s.label === "string" &&
            typeof s.price === "number" &&
            typeof s.assetId === "string" &&
            (s.stock === undefined || typeof s.stock === "number"),
        ))) &&
    typeof p.rightsNote === "string" &&
    p.rightsNote.length <= 10000 &&
    typeof p.channelRights === "boolean" &&
    typeof p.updatedAt === "string" &&
    Array.isArray(p.facts) &&
    p.facts.length === keys.length &&
    keys.every((key) => p.facts.filter((f) => f?.key === key).length === 1) &&
    p.facts.every(
      (f) =>
        typeof f.value === "string" &&
        f.value.length <= 1000 &&
        typeof f.source === "string" &&
        f.source.length <= 2000 &&
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
        p.draft.description.length <= 10000 &&
        p.draft.title.length <= 300 &&
        (!p.draft.layout ||
          (["photos-first", "facts-first"].includes(p.draft.layout.order) &&
            ["forest", "ink"].includes(p.draft.layout.accent))) &&
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
    const issues = [...factIssues(value), ...skuIssues(value)];
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

export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function koreaDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function skuIssues(p: Product): string[] {
  const skus = p.skus ?? [];
  if (
    new Set(skus.map((s) => s.id)).size !== skus.length ||
    new Set(skus.map((s) => s.label.trim())).size !== skus.length
  )
    return ["옵션 ID·이름은 중복될 수 없습니다."];
  return skus.flatMap((s) =>
    !/^[A-Za-z0-9_-]{1,100}$/.test(s.id) ||
    !s.label.trim() ||
    s.label.length > 100 ||
    !Number.isSafeInteger(s.price) ||
    s.price <= 0 ||
    (s.stock !== undefined &&
      (!Number.isSafeInteger(s.stock) || s.stock < 0)) ||
    !p.assets.some((a) => a.id === s.assetId)
      ? ["옵션 이름·양의 가격·입력 재고·연결 사진을 확인하세요."]
      : [],
  );
}
