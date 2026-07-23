export interface ModelInfo {
  id: string
  name: string
  provider: string
  description: string
  free: boolean
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    description: "Fast Gemini model with a generous free tier — the default LifeSort Coach model",
    free: true,
  },
  {
    id: "gemini-pro-latest",
    name: "Gemini Pro",
    provider: "Google",
    description: "Google's most capable Gemini model, for harder reasoning",
    free: false,
  },
]

export const DEFAULT_MODEL = "gemini-3.5-flash"
