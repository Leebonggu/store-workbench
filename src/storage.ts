import { validateProduct, type Product } from "./model";
export const STORAGE_KEY = "store-workbench:v1";
export const CONFLICT =
  "다른 탭 또는 작업에서 자료가 바뀌었습니다. 입력 중인 내용을 보관한 뒤 새로고침하세요. 덮어쓰기와 다운로드를 막았습니다.";
export type Store = Pick<Storage, "getItem" | "setItem">;
export async function load(
  storage: Pick<Storage, "getItem">,
): Promise<{ products: Product[]; snapshot: string | null; error?: string }> {
  let snapshot: string | null = null;
  try {
    snapshot = storage.getItem(STORAGE_KEY);
    if (!snapshot) return { products: [], snapshot };
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) throw Error("schema");
    const products: Product[] = [],
      errors: string[] = [];
    for (const value of parsed) {
      const issue = await validateProduct(value);
      if (issue) errors.push(issue);
      else products.push(value as Product);
    }
    if (new Set(products.map((p) => p.id)).size !== products.length)
      errors.push("중복 상품 ID");
    return {
      products,
      snapshot,
      ...(errors.length
        ? {
            error: `저장 자료 검증 실패: ${errors[0]} 원본 저장 자료는 보존했고 유효한 상품만 읽기 전용으로 표시합니다.`,
          }
        : {}),
    };
  } catch {
    return {
      products: [],
      snapshot,
      error:
        "저장 자료를 읽지 못했습니다. 원본은 덮어쓰지 않았습니다. 자료를 백업하고 형식을 확인하세요.",
    };
  }
}
export function save(
  storage: Pick<Storage, "setItem">,
  products: Product[],
): string | undefined {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(products));
    return undefined;
  } catch {
    return "저장 공간이 부족하거나 저장이 차단되었습니다. 변경을 적용하지 않았습니다. 사진 크기를 줄이거나 저장 권한을 확인하세요.";
  }
}
export type Exclusive = <T>(operation: () => T) => Promise<T>;
export const browserExclusive: Exclusive = async (operation) => {
  if (!navigator.locks) throw Error("Web Locks unavailable");
  return navigator.locks.request(STORAGE_KEY, { mode: "exclusive" }, operation);
};
// All app writers use the same cross-tab lock. Compare the exact read snapshot
// inside it, immediately before write/download, even if no storage event arrived.
export async function saveIfCurrent(
  storage: Store,
  expected: string | null,
  products: Product[],
  exclusive: Exclusive,
  stillCurrent: () => boolean,
  afterSave?: () => void,
): Promise<{ ok: true; snapshot: string } | { ok: false; error: string }> {
  const candidate = structuredClone(products);
  for (const product of candidate) {
    const issue = await validateProduct(product);
    if (issue) return { ok: false, error: issue };
  }
  try {
    return await exclusive(() => {
      if (!stillCurrent() || storage.getItem(STORAGE_KEY) !== expected)
        return { ok: false as const, error: CONFLICT };
      const error = save(storage, candidate);
      if (error) return { ok: false as const, error };
      const snapshot = JSON.stringify(candidate);
      afterSave?.(); // synchronous side effect; no await while holding freshness
      return { ok: true as const, snapshot };
    });
  } catch {
    return {
      ok: false,
      error:
        "안전한 저장 잠금 또는 저장소 접근에 실패했습니다. 새로고침 전에 입력을 따로 보관하세요.",
    };
  }
}
