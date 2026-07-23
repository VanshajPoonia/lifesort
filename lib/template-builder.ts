import { z } from "zod"

export const TEMPLATE_BUILDER_MODEL = "gemini-3.5-flash"

export const templatePromptSchema = z.object({
  prompt: z.string().trim().min(2, "Describe the system you want to build.").max(500, "Keep the prompt under 500 characters."),
})

export const templateColors = [
  "primary",
  "purple",
  "blue",
  "green",
  "orange",
  "pink",
  "teal",
  "amber",
  "slate",
] as const

export const templateFieldTypes = ["text", "number", "date", "checkbox", "select", "url", "notes"] as const

export const templateBuilderExamples = [
  "Budget tracker",
  "Study planner",
  "Fitness routine",
  "YouTube content planner",
  "Job application tracker",
  "Client project tracker",
  "Reading list",
  "Travel planner",
]

export const templateFieldSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(templateFieldTypes),
  options: z.array(z.string().trim().min(1).max(60)).max(12),
  required: z.boolean(),
})

export const templateSectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  icon: z.string().trim().min(1).max(50),
  color: z.enum(templateColors),
  fields: z.array(templateFieldSchema).max(8),
})

export const templateTaskSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(600),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().trim().max(80),
  due_in_days: z.number().int().min(0).max(365).nullable(),
})

export const templateNoteSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().trim().max(5000),
})

export const templateHabitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600),
  frequency: z.enum(["daily", "weekly"]),
  target_count: z.number().int().min(1).max(100),
  icon: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(40),
})

export const templateLinkSchema = z.object({
  title: z.string().trim().min(1).max(180),
  url: z.string().trim().max(2000),
  description: z.string().trim().max(600),
})

export const templateBudgetCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  budget_limit: z.number().min(0).max(1000000),
  icon: z.string().trim().min(1).max(50),
  color: z.string().trim().min(1).max(40),
})

export const generatedTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(800),
  icon: z.string().trim().min(1).max(50),
  color: z.enum(templateColors),
  space: z.object({
    create: z.boolean(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    icon: z.string().trim().min(1).max(50),
    color: z.enum(templateColors),
  }),
  sections: z.array(templateSectionSchema).max(6),
  starter_tasks: z.array(templateTaskSchema).max(12),
  starter_notes: z.array(templateNoteSchema).max(8),
  starter_habits: z.array(templateHabitSchema).max(8),
  starter_links: z.array(templateLinkSchema).max(8),
  whiteboard: z.object({
    create: z.boolean(),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(1000),
  }),
  budget_categories: z.array(templateBudgetCategorySchema).max(8),
})

export const templateApplySchema = z.object({
  template: generatedTemplateSchema,
})

export type GeneratedTemplate = z.infer<typeof generatedTemplateSchema>

export type CreatedTemplateItem = {
  type: "space" | "custom_section" | "task" | "note" | "habit" | "link" | "whiteboard" | "budget_category"
  id: string
  title: string
  href: string
  linkedToSpace: boolean
}

export function hasTemplateContent(template: GeneratedTemplate) {
  return (
    template.space.create ||
    template.sections.length > 0 ||
    template.starter_tasks.length > 0 ||
    template.starter_notes.length > 0 ||
    template.starter_habits.length > 0 ||
    template.starter_links.length > 0 ||
    template.whiteboard.create ||
    template.budget_categories.length > 0
  )
}

export function isSafeGeneratedUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return true
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function dateFromOffset(days: number | null) {
  if (days === null) return null
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function buildTemplateBuilderPrompt(userPrompt: string) {
  return `Create a practical LifeSort system from this user prompt: "${userPrompt}".

Return a compact system that helps the user start immediately. Follow these rules:
- Use LifeSort records only: Space, Custom Sections, starter tasks, starter notes, habits, links, optional whiteboard, optional budget categories.
- Do not include apps, code projects, external automations, API keys, or fake user data.
- Keep it useful and not bloated: 1 Space, 1-4 Custom Sections, 3-8 tasks, 1-4 notes, 0-5 habits, 0-5 links, 0-4 budget categories.
- Use short human titles and concrete starter content.
- The Space should usually be created unless the prompt is too tiny.
- Whiteboard should be created only when visual planning would clearly help.
- Links may have empty url strings when they are placeholders the user can fill in later.
- Field names should be user-facing labels like "Status", "Due Date", "Priority", "Notes".
- Select fields must include useful options. Non-select fields must use an empty options array.
- Use only these field types: ${templateFieldTypes.join(", ")}.
- Use only these color values: ${templateColors.join(", ")}.
- Use icons as lucide-style names such as Sparkles, FolderKanban, BookOpen, PiggyBank, Dumbbell, Briefcase, Plane, Video, Calendar, Target.`
}
