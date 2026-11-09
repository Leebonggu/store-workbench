import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "@flue/runtime/node";
import {
  fauxProvider,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { ProductAgent } from "../src/agents/product";
import app from "../src/app";

test("Flue HTTP request actually executes inspect and submit tools without paid calls", async () => {
  const model = fauxProvider({
    provider: "test",
    models: [{ id: "product", input: ["text", "image"] }],
  });
  process.env.OPENROUTER_MODEL = "test/product";
  process.env.OPENROUTER_API_KEY = "test-only-not-a-real-key";
  const input = {
    productId: "sample",
    sourceVersion: 1,
    facts: [
      { key: "name", value: "응원 키링", confirmed: true },
      { key: "price", value: "5500", confirmed: true },
      { key: "size", value: "", confirmed: false },
    ],
    options: "1개 기준 · 배송비 3,300원",
    skus: [{ label: "펜던트 추가", price: 8000 }],
    images: [],
    instruction: "귀엽게",
  };
  model.setResponses([
    fauxAssistantMessage(fauxToolCall("inspect_product", {})),
    (context) => {
      assert.match(JSON.stringify(context), /1개 기준/);
      assert.match(JSON.stringify(context), /missing/);
      return fauxAssistantMessage(
        fauxToolCall("submit_proposal", {
          title: "응원 키링",
          description: "작은 응원을 달고 다녀요.",
          questions: ["크기를 알려주세요."],
          observations: [],
          keywords: ["응원 키링"],
          checklist: ["판매 조건 확인"],
        }),
      );
    },
  ]);
  const runtime = await start({
    agents: [ProductAgent],
    providers: [model.provider],
  });
  try {
    const response = await app.request("http://127.0.0.1:3583/api/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    assert.equal(value.sourceVersion, 1);
    assert.match(value.description, /배송비 3,300원/);
    assert.match(value.description, /펜던트 추가: 8,000원/);
    assert.equal(value.questions[0], "크기를 알려주세요.");
    assert.equal(model.state.callCount, 2);
    const forbidden = await app.request("http://127.0.0.1:3583/api/propose", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });
    assert.equal(forbidden.status, 403);
  } finally {
    await runtime.stop();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
  }
});
test("missing key is explicit and never dispatches a model call", async () => {
  const response = await app.request("http://127.0.0.1:3583/api/propose", {
    method: "POST",
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OPENROUTER_API_KEY/);
});
