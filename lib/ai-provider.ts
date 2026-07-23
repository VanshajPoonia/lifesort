import { createGoogleGenerativeAI } from "@ai-sdk/google"

export const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
})

export const GEMINI_FLASH_MODEL = "gemini-3.5-flash"
export const GEMINI_PRO_MODEL = "gemini-pro-latest"
