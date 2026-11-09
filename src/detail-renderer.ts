import { validateProduct, contentHash, type Product } from "./model";
import type { DetailPage } from "./blocks/package";
const WIDTH = 860,
  PAD = 48,
  MAX_HEIGHT = 3000;
function canvas(height: number) {
  const c = document.createElement("canvas");
  c.width = WIDTH;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw Error("Canvas 미지원");
  return { c, ctx };
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(paragraph)) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}
async function encode(c: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      async (blob) =>
        blob
          ? resolve(new Uint8Array(await blob.arrayBuffer()))
          : reject(Error("상세 이미지 인코딩 실패")),
      "image/png",
    ),
  );
}
export async function renderDetail(product: Product): Promise<DetailPage[]> {
  const p = structuredClone(product),
    issue = await validateProduct(p);
  if (issue) throw Error(issue);
  if (!p.draft || p.draft.sourceVersion !== p.version)
    throw Error("최신 초안이 필요합니다.");
  const accent = p.draft.layout?.accent === "ink" ? "#24333c" : "#46715b";
  const sourceHash = await contentHash(p);
  const pages: Omit<DetailPage, "filename" | "sourceHash">[] = [];
  const heading = (ctx: CanvasRenderingContext2D) => {
    ctx.font = "bold 42px sans-serif";
    return wrap(ctx, p.draft!.title, WIDTH - PAD * 2);
  };
  const createPhoto = async () => {
    for (const asset of p.assets) {
      const img = new Image();
      img.src = asset.dataUrl;
      await img.decode();
      const photoH = Math.min(
        1800,
        Math.round(((WIDTH - PAD * 2) * img.naturalHeight) / img.naturalWidth),
      );
      const measure = canvas(1);
      const title = heading(measure.ctx);
      const titleH = title.length * 60 + 80;
      const height = PAD * 3 + titleH + photoH;
      if (height > MAX_HEIGHT)
        throw Error("제목이 너무 길어 상세 사진을 배치할 수 없습니다.");
      const { c, ctx } = canvas(height);
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, WIDTH, height);
      ctx.fillStyle = "#e6efdf";
      ctx.beginPath();
      ctx.roundRect(PAD, 28, 260, 42, 21);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.font = "18px sans-serif";
      ctx.fillText("작은 소품, 기분 좋은 하루", PAD + 18, 56);
      ctx.font = "bold 42px sans-serif";
      title.forEach((line, i) => ctx.fillText(line, PAD, PAD + 100 + i * 60));
      const scale = Math.min(
        (WIDTH - PAD * 2) / img.naturalWidth,
        photoH / img.naturalHeight,
      );
      const w = img.naturalWidth * scale,
        h = img.naturalHeight * scale;
      ctx.drawImage(
        img,
        (WIDTH - w) / 2,
        PAD * 2 + titleH + (photoH - h) / 2,
        w,
        h,
      );
      pages.push({ bytes: await encode(c), width: WIDTH, height });
    }
  };
  const createText = async () => {
    const measure = canvas(1);
    measure.ctx.font = "30px sans-serif";
    const lines = wrap(measure.ctx, p.draft!.description, WIDTH - PAD * 2);
    if (lines.length > 1000)
      throw Error(
        "상세 설명 줄 수가 너무 많습니다. 1,000줄 이하로 줄여주세요.",
      );
    const perPage = 52;
    for (let offset = 0; offset < lines.length; offset += perPage) {
      const part = lines.slice(offset, offset + perPage);
      const height = PAD * 2 + 110 + part.length * 48;
      const { c, ctx } = canvas(height);
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, WIDTH, height);
      ctx.fillStyle = accent;
      ctx.font = "bold 38px sans-serif";
      ctx.fillText("꼼꼼히 살펴보세요 ♡", PAD, PAD + 40);
      ctx.fillStyle = "#26342c";
      ctx.font = "30px sans-serif";
      part.forEach((line, i) => {
        const y = PAD + 110 + i * 48;
        const section = /^\[.+\]$/.test(line.trim());
        if (section) {
          ctx.fillStyle = "#e6efdf";
          ctx.beginPath();
          ctx.roundRect(PAD - 12, y - 34, WIDTH - PAD * 2 + 24, 45, 12);
          ctx.fill();
        }
        ctx.fillStyle = section || line.startsWith("Q.") ? accent : "#26342c";
        ctx.fillText(section ? line.slice(1, -1) : line, PAD, y);
      });
      pages.push({ bytes: await encode(c), width: WIDTH, height });
    }
  };
  if (p.draft.layout?.order === "facts-first") {
    await createText();
    await createPhoto();
  } else {
    await createPhoto();
    await createText();
  }
  return pages.map((page, i) => ({
    ...page,
    sourceHash,
    filename: `detail-${String(i + 1).padStart(3, "0")}.png`,
  }));
}
