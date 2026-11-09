import rows from "../fixtures/morebijou.json";
import { newProduct, type Product } from "./model";
import { manageAsset } from "./blocks/assets";
const images: Record<string, string> = {
  "13851185772": new URL("../13851185772.webp", import.meta.url).href,
  "6035908474": new URL("../6035908474.webp", import.meta.url).href,
  "13014621474": new URL("../13014621474.webp", import.meta.url).href,
};
export async function loadRealSamples(): Promise<Product[]> {
  const products: Product[] = [];
  for (const row of rows) {
    const p = newProduct();
    p.facts = p.facts.map((f) => ({
      ...f,
      value: row[f.key as keyof typeof row] ?? "",
      source: row.source,
      confirmed: !!row[f.key as keyof typeof row],
    }));
    p.options = `판매 단위: ${row.unit}\n${row.options}\n${row.shipping}`;
    const response = await fetch(images[row.id]);
    if (!response.ok) throw Error("샘플 사진 로드 실패");
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const asset = await manageAsset.run({
      product: p,
      name: row.image,
      dataUrl,
      source: `사용자 제공 대표 사진 · ${row.url}`,
    });
    if (!asset.ok) throw Error(asset.error.message);
    p.assets = [asset.value];
    products.push(p);
  }
  return products;
}
