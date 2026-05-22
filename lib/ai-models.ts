export interface ModelInfo {
  id: string
  name: string
  provider: string
  description: string
  free: boolean
}

export const AVAILABLE_MODELS: ModelInfo[] = [
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

  // ── Free fallback ──────────────────────────────────────────────────────────
  {
    id: "openrouter/free",
    name: "Free AI Router",
    provider: "OpenRouter",
    description: "Fallback route to an available free OpenRouter model",
    free: true,
  },
]

export const DEFAULT_MODEL = "~openai/gpt-mini-latest"
