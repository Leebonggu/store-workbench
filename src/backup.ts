import { validateProduct, type Product } from "./model";
export const BACKUP_LIMIT = 100 * 1024 * 1024;
export async function createBackup(products: Product[]): Promise<string> {
  for (const p of products) {
    const issue = await validateProduct(p);
    if (issue) throw Error(issue);
  }
  return JSON.stringify(
    {
      format: "store-workbench-private-backup",
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      products,
    },
    null,
    2,
  );
}
export async function restoreBackup(
  text: string,
  existing: Product[],
): Promise<Product[]> {
  if (new TextEncoder().encode(text).length > BACKUP_LIMIT)
    throw Error("백업은 100MiB 이하만 지원합니다.");
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== "object") throw Error("백업 형식이 아닙니다.");
  const envelope = input as {
    format?: string;
    schemaVersion?: number;
    products?: unknown[];
  };
  if (
    envelope.format !== "store-workbench-private-backup" ||
    envelope.schemaVersion !== 1 ||
    !Array.isArray(envelope.products) ||
    envelope.products.length > 100
  )
    throw Error("지원하는 백업 형식·상품 수를 확인하세요.");
  const restored: Product[] = [];
  for (const value of envelope.products) {
    const issue = await validateProduct(value);
    if (issue) throw Error(issue);
    const p = value as Product;
    // Explicit allowlist; never revive arbitrary fields or a prior approval.
    restored.push({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      version: p.version,
      facts: p.facts.map((f) => ({
        key: f.key,
        value: f.value,
        source: f.source,
        confirmed: f.confirmed,
      })),
      options: p.options,
      skus: p.skus?.map((s) => ({
        id: s.id,
        label: s.label,
        price: s.price,
        stock: s.stock,
        assetId: s.assetId,
      })),
      rightsExpiresOn: p.rightsExpiresOn,
      assets: p.assets.map((a) => ({
        id: a.id,
        name: a.name,
        mime: a.mime,
        dataUrl: a.dataUrl,
        sha256: a.sha256,
        source: a.source,
        rightsConfirmed: a.rightsConfirmed,
      })),
      channelRights: p.channelRights,
      rightsNote: p.rightsNote,
      draft: p.draft
        ? {
            channel: p.draft.channel,
            sourceVersion: p.draft.sourceVersion,
            rulesVersion: p.draft.rulesVersion,
            title: p.draft.title,
            description: p.draft.description,
            assetIds: [...p.draft.assetIds],
            generator: p.draft.generator,
            version: p.draft.version,
            layout: p.draft.layout ? { ...p.draft.layout } : undefined,
          }
        : undefined,
      updatedAt: new Date().toISOString(),
    });
  }
  return [...existing, ...restored];
}
