import { z } from "zod"

import type { TemplateItem } from "@/lib/templates"
import type { GeneratedTemplate } from "@/lib/template-builder"

export const userTemplateItemTypes = [
  "space",
  "task",
  "goal",
  "habit",
  "note",
  "link",
  "project",
  "custom_section",
  "whiteboard",
  "budget_category",
  "vault_item",
] as const

export const userTemplateSources = ["manual", "ai", "forked"] as const

const optionalText = z.string().trim().max(1000).optional().default("")
const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0).max(1000000).optional(),
)

export const userTemplateItemSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  type: z.enum(userTemplateItemTypes),
  title: z.string().trim().min(1, "Item title is required").max(180),
  description: optionalText,
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  frequency: z.enum(["daily", "weekly"]).optional().default("daily"),
  category: z.string().trim().max(80).optional().default(""),
  content: z.string().trim().max(5000).optional().default(""),
  url: z.string().trim().max(2000).optional().default(""),
  icon: z.string().trim().max(50).optional().default(""),
  color: z.string().trim().max(50).optional().default(""),
  target_count: z.coerce.number().int().min(1).max(100).optional().default(1),
  budget_limit: optionalNumber,
})

export const userTemplatePayloadSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(120),
  description: z.string().trim().max(800).optional().default(""),
  items: z.array(userTemplateItemSchema).min(1, "Add at least one template item").max(80),
  source: z.enum(userTemplateSources).optional().default("manual"),
  forked_from: z.string().trim().max(120).nullable().optional(),
})

export const userTemplateUpdateSchema = userTemplatePayloadSchema

export type UserTemplateItem = z.infer<typeof userTemplateItemSchema>
export type UserTemplatePayload = z.infer<typeof userTemplatePayloadSchema>
export type UserTemplateSource = (typeof userTemplateSources)[number]

export type UserTemplate = {
  id: string
  name: string
  description: string
  items: UserTemplateItem[]
  source: UserTemplateSource
  forked_from: string | null
  created_at: string
  updated_at: string | null
  last_used_at: string | null
}

export function templateItemToUserTemplateItem(item: TemplateItem): UserTemplateItem {
  if (item.type === "habit") {
    return {
      id: crypto.randomUUID(),
      type: "habit",
      title: item.name,
      description: item.description ?? "",
      frequency: item.frequency ?? "daily",
      target_count: item.target_count ?? 1,
      priority: "medium",
      category: "",
      content: "",
      url: "",
      icon: "",
      color: "",
    }
  }

  if (item.type === "budget_category") {
    return {
      id: crypto.randomUUID(),
      type: "budget_category",
      title: item.name,
      description: "",
      budget_limit: item.budget_limit ?? 0,
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      url: "",
      icon: item.icon ?? "",
      color: item.color ?? "",
      target_count: 1,
    }
  }

  return {
    id: crypto.randomUUID(),
    type: item.type,
    title: item.title,
    description: "description" in item ? item.description ?? "" : "",
    priority: "priority" in item ? item.priority ?? "medium" : "medium",
    frequency: "daily",
    category: "category" in item ? item.category ?? "" : "",
    content: "content" in item ? item.content ?? "" : "",
    url: "",
    icon: "icon" in item ? item.icon ?? "" : "",
    color: "",
    target_count: 1,
  }
}

export function generatedTemplateToUserTemplateItems(template: GeneratedTemplate): UserTemplateItem[] {
  const items: UserTemplateItem[] = []

  if (template.space.create) {
    items.push({
      id: crypto.randomUUID(),
      type: "space",
      title: template.space.name,
      description: template.space.description,
      icon: template.space.icon,
      color: template.space.color,
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      url: "",
      target_count: 1,
    })
  }

  template.sections.forEach((section) => {
    items.push({
      id: crypto.randomUUID(),
      type: "custom_section",
      title: section.title,
      description: section.description,
      icon: section.icon,
      color: section.color,
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      url: "",
      target_count: 1,
    })
  })

  template.starter_tasks.forEach((task) => {
    items.push({
      id: crypto.randomUUID(),
      type: "task",
      title: task.title,
      description: task.description,
      priority: task.priority,
      category: task.category,
      frequency: "daily",
      content: "",
      url: "",
      icon: "",
      color: "",
      target_count: 1,
    })
  })

  template.starter_notes.forEach((note) => {
    items.push({
      id: crypto.randomUUID(),
      type: "note",
      title: note.title,
      content: note.content,
      description: "",
      priority: "medium",
      frequency: "daily",
      category: "",
      url: "",
      icon: "",
      color: "",
      target_count: 1,
    })
  })

  template.starter_habits.forEach((habit) => {
    items.push({
      id: crypto.randomUUID(),
      type: "habit",
      title: habit.name,
      description: habit.description,
      frequency: habit.frequency,
      target_count: habit.target_count,
      icon: habit.icon,
      color: habit.color,
      priority: "medium",
      category: "",
      content: "",
      url: "",
    })
  })

  template.starter_links.forEach((link) => {
    items.push({
      id: crypto.randomUUID(),
      type: "link",
      title: link.title,
      url: link.url,
      description: link.description,
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      icon: "",
      color: "",
      target_count: 1,
    })
  })

  if (template.whiteboard.create) {
    items.push({
      id: crypto.randomUUID(),
      type: "whiteboard",
      title: template.whiteboard.title,
      description: template.whiteboard.description,
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      url: "",
      icon: "",
      color: "",
      target_count: 1,
    })
  }

  template.budget_categories.forEach((category) => {
    items.push({
      id: crypto.randomUUID(),
      type: "budget_category",
      title: category.name,
      budget_limit: category.budget_limit,
      icon: category.icon,
      color: category.color,
      description: "",
      priority: "medium",
      frequency: "daily",
      category: "",
      content: "",
      url: "",
      target_count: 1,
    })
  })

  return items
}

export function summarizeUserTemplateItems(items: UserTemplateItem[]) {
  const counts = new Map<UserTemplateItem["type"], number>()
  items.forEach((item) => counts.set(item.type, (counts.get(item.type) ?? 0) + 1))

  const labels: Record<UserTemplateItem["type"], { one: string; many: string }> = {
    space: { one: "space", many: "spaces" },
    task: { one: "task", many: "tasks" },
    goal: { one: "goal", many: "goals" },
    habit: { one: "habit", many: "habits" },
    note: { one: "note", many: "notes" },
    link: { one: "link", many: "links" },
    project: { one: "project", many: "projects" },
    custom_section: { one: "section", many: "sections" },
    whiteboard: { one: "whiteboard", many: "whiteboards" },
    budget_category: { one: "budget", many: "budgets" },
    vault_item: { one: "vault item", many: "vault items" },
  }

  return userTemplateItemTypes
    .filter((type) => counts.has(type))
    .map((type) => {
      const count = counts.get(type)!
      const label = labels[type]
      return `${count} ${count === 1 ? label.one : label.many}`
    })
}
