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
    id: "google/gemini-2.5-flash-preview:free",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Google's latest fast model, free",
    free: true,
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Fast, free, great for everyday tasks",
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
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and capable, great balance",
    free: false,
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "OpenAI",
    description: "OpenAI's most advanced model",
    free: false,
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Google's most capable model",
    free: false,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    description: "Fast and smart, great for analysis",
    free: false,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description: "Highly capable, strong reasoning",
    free: false,
  },
  {
    id: "anthropic/claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "Anthropic",
    description: "Anthropic's most powerful model",
    free: false,
  },
]

export const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free"
