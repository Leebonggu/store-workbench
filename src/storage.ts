import { isProduct, type Product } from "./model";
export const STORAGE_KEY = "store-workbench:v1";
export function load(storage: Pick<Storage, "getItem">): {
  products: Product[];
  error?: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { products: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isProduct))
      return {
        products: [],
        error:
          "저장된 자료 형식이 다릅니다. 원본은 덮어쓰지 않았습니다. 다른 브라우저 프로필에서 시작하거나 개발자 도구로 자료를 백업하세요.",
      };
    return { products: parsed };
  } catch {
    return {
      products: [],
      error:
        "로컬 자료를 읽지 못했습니다. 브라우저 저장 권한과 자료를 확인하세요.",
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
