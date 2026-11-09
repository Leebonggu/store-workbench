import { setProvider } from "@flue/runtime";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
// Pi 0.87.1's static catalog predates these models. Keep its tested OpenRouter
// protocol/auth implementation and extend only public, verified model metadata.
const provider = openrouterProvider();
const catalog = provider.getModels();
const template = catalog.find((model) => model.id === "openai/gpt-5.5");
if (!template) throw Error("OpenRouter protocol template is unavailable.");
export const writingModel = "openrouter/openai/gpt-6.1-sol";
export const addedModels = [
  {
    ...template,
    id: "openai/gpt-6.1-sol",
    name: "OpenAI: GPT-6.1 Sol",
    contextWindow: 1050000,
    maxTokens: 8192,
    cost: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 0 },
  },
];
setProvider({
  ...provider,
  getModels: () => [
    ...catalog,
    ...addedModels.filter((item) => !catalog.some((old) => old.id === item.id)),
  ],
});
