import { z } from "zod"

// AI task breakdown (AI_BUILD_PLAN.md Part 0, Later): small next steps with minutes,
// added to the task's checklist once the person picks them.

export const breakdownSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        minutes: z.number().int().min(5).max(240),
      }),
    )
    .min(2)
    .max(8),
})

export type BreakdownStep = z.infer<typeof breakdownSchema>["steps"][number]

export function buildBreakdownPrompt(task: { title: string; description: string | null }, existing: string[]) {
  return `Break this task into small, concrete next steps for one person.
Task: "${task.title}"${task.description ? `\nNotes: "${task.description.slice(0, 600)}"` : ""}${
    existing.length ? `\nSteps they already listed, don't repeat them: ${existing.map((title) => `"${title}"`).join(", ")}` : ""
  }

Rules:
- 2 to 8 steps, in the order they'd do them. Each starts with a verb and fits in one sitting.
- minutes is an honest estimate for that step, from 5 to 240, rounded to 5.
- Plain words, no emojis, no numbering in the titles.
- Don't invent facts about their situation. For medical, legal or money steps, suggest checking with a professional.`
}

// Rounds a total up to the next 15 minutes so it fits the day planner's lengths.
export function totalMinutes(steps: Pick<BreakdownStep, "minutes">[]) {
  const sum = steps.reduce((total, step) => total + step.minutes, 0)
  return Math.min(24 * 60, Math.ceil(sum / 15) * 15)
}
