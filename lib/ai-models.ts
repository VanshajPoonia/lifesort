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
]

export const DEFAULT_MODEL = "gemini-3.5-flash"
