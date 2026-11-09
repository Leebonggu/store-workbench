import { init } from "@flue/runtime";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { ProductAgent } from "./agents/product.ts";
import { validateAgentOutput } from "../../shared/agent-contract";
const app = new Hono();
const inputSchema = v.object({
  productId: v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,100}$/)),
  sourceVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  facts: v.pipe(
    v.array(
      v.object({
        key: v.picklist(["name", "price", "size", "material", "origin"]),
        value: v.pipe(v.string(), v.maxLength(1000)),
        confirmed: v.boolean(),
      }),
    ),
    v.maxLength(5),
  ),
  options: v.pipe(v.string(), v.maxLength(5000)),
  skus: v.optional(
    v.pipe(
      v.array(
        v.object({
          label: v.pipe(v.string(), v.maxLength(100)),
          price: v.pipe(v.number(), v.integer(), v.minValue(1)),
        }),
      ),
      v.maxLength(50),
    ),
  ),
  images: v.pipe(
    v.array(
      v.object({
        mimeType: v.picklist(["image/png", "image/jpeg", "image/webp"]),
        data: v.pipe(
          v.string(),
          v.maxLength(2800000),
          v.regex(/^[A-Za-z0-9+/]+=*$/),
        ),
      }),
    ),
    v.maxLength(3),
  ),
  instruction: v.pipe(v.string(), v.maxLength(3000)),
  previousDraft: v.optional(
    v.object({
      title: v.pipe(v.string(), v.maxLength(300)),
      description: v.pipe(v.string(), v.maxLength(10000)),
    }),
  ),
});
app.use("*", async (c, next) => {
  const host = new URL(c.req.url).hostname;
  const origin = c.req.header("origin");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(host) ||
    (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  )
    return c.json({ error: "로컬 작업대에서만 사용할 수 있습니다." }, 403);
  await next();
});
app.use(
  "*",
  bodyLimit({
    maxSize: 9 * 1024 * 1024,
    onError: (c) => c.json({ error: "사진 용량이 너무 큽니다." }, 413),
  }),
);
app.get("/api/health", (c) =>
  c.json({
    configured: !!process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "openrouter/google/gemini-2.5-flash",
  }),
);
let running = false;
let lastRequest = 0;
app.post("/api/propose", async (c) => {
  if (!process.env.OPENROUTER_API_KEY)
    return c.json(
      {
        error:
          "프로젝트 .env에 OPENROUTER_API_KEY를 설정하고 서버를 다시 실행하세요.",
      },
      503,
    );
  if (running || Date.now() - lastRequest < 5000)
    return c.json(
      { error: "다른 AI 작업이 진행 중입니다. 잠시 후 다시 시도하세요." },
      429,
    );
  let payload;
  try {
    payload = v.parse(inputSchema, await c.req.json());
  } catch {
    return c.json({ error: "상품 입력 형식을 확인하세요." }, 400);
  }
  if (
    !["name", "price"].every((key) =>
      payload.facts.some((f) => f.key === key && f.confirmed && f.value.trim()),
    )
  )
    return c.json({ error: "상품명과 가격을 먼저 확인해 주세요." }, 400);
  running = true;
  lastRequest = Date.now();
  const handle = init(ProductAgent);
  const timer = setTimeout(() => void handle.abort().catch(() => {}), 90000);
  try {
    const { images, ...text } = payload;
    const receipt = await handle.dispatch({
      initialData: { ...payload, images: [] },
      message: {
        kind: "user",
        body: JSON.stringify(text),
        attachments: images.map((image) => ({
          type: "image" as const,
          ...image,
        })),
      },
    });
    const reply = await handle.read(receipt, {
      signal: AbortSignal.timeout(95000),
    });
    const output = reply.data.proposal?.at(-1);
    if (!validateAgentOutput(output))
      return c.json(
        {
          error: "AI 결과 형식이 올바르지 않습니다. 기존 초안을 유지했습니다.",
        },
        502,
      );
    return c.json(output);
  } catch {
    await handle.abort().catch(() => {});
    return c.json(
      {
        error:
          "AI 요청을 완료하지 못했습니다. 키·잔액·모델 설정을 확인하세요. 자동 재시도하지 않았으며 기존 초안은 유지됩니다.",
      },
      502,
    );
  } finally {
    clearTimeout(timer);
    running = false;
  }
});
export default app;
