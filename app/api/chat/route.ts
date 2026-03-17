import { streamText } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: `You are a helpful AI assistant for LifeSort, a life organization app. 
    Help users with productivity tips, goal setting advice, time management strategies, and personal organization.
    Be concise, encouraging, and actionable in your responses.`,
    messages,
  })

  return result.toDataStreamResponse()
}
