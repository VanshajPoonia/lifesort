export interface ModelInfo {
  id: string
  name: string
  provider: string
  description: string
  free: boolean
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  // ── Free tier ──────────────────────────────────────────────────────────────
  {
    id: "openrouter/free",
    name: "Free AI Router",
    provider: "OpenRouter",
    description: "Automatically routes to an available free model",
    free: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    provider: "Meta",
    description: "Powerful open-source model, free",
    free: true,
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Strong reasoning model, free",
    free: true,
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
    provider: "Mistral",
    description: "Efficient European model, free",
    free: true,
  },

  // ── Paid tier ──────────────────────────────────────────────────────────────
  {
    id: "~openai/gpt-mini-latest",
    name: "GPT Mini Latest",
    provider: "OpenAI",
    description: "OpenAI's latest compact chat model",
    free: false,
  },
  {
    id: "~openai/gpt-latest",
    name: "GPT Latest",
    provider: "OpenAI",
    description: "OpenAI's latest flagship chat model",
    free: false,
  },
  {
    id: "~google/gemini-flash-latest",
    name: "Gemini Flash Latest",
    provider: "Google",
    description: "Google's latest fast Gemini Flash model",
    free: false,
  },
  {
    id: "~google/gemini-pro-latest",
    name: "Gemini Pro Latest",
    provider: "Google",
    description: "Google's latest high-capability Gemini Pro model",
    free: false,
  },
  {
    id: "~anthropic/claude-sonnet-latest",
    name: "Claude Sonnet Latest",
    provider: "Anthropic",
    description: "Anthropic's latest Sonnet model",
    free: false,
  },
]

export const DEFAULT_MODEL = "openrouter/free"
