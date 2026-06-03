"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType } from "react"
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Dumbbell,
  Edit3,
  GraduationCap,
  History,
  Home,
  Loader2,
  PiggyBank,
  Plane,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Video,
  Wand2,
  XCircle,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { SortableList } from "@/components/sortable-list"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { TEMPLATES, ENDPOINT_MAP, buildPayload } from "@/lib/templates"
import type { Template, TemplateItem } from "@/lib/templates"
import {
  generatedTemplateSchema,
  templateBuilderExamples,
  type CreatedTemplateItem,
  type GeneratedTemplate,
} from "@/lib/template-builder"
import {
  generatedTemplateToUserTemplateItems,
  summarizeUserTemplateItems,
  templateItemToUserTemplateItem,
  type UserTemplate,
  type UserTemplateItem,
  type UserTemplateSource,
} from "@/lib/user-templates"

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  GraduationCap,
  Dumbbell,
  Briefcase,
  Rocket,
  PiggyBank,
  Plane,
  BookOpen,
  Video,
  Home,
  BookMarked,
}

const TYPE_CONFIG: Record<string, { label: string; plural: string; color: string }> = {
  space: { label: "Space", plural: "Space", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  project: { label: "Project", plural: "Projects", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  task: { label: "Task", plural: "Tasks", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  goal: { label: "Goal", plural: "Goals", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  habit: { label: "Habit", plural: "Habits", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  note: { label: "Note", plural: "Notes", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  link: { label: "Link", plural: "Links", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  custom_section: { label: "Custom Section", plural: "Custom Sections", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  whiteboard: { label: "Whiteboard", plural: "Whiteboard", color: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300" },
  budget_category: { label: "Budget Category", plural: "Budget Categories", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  vault_item: { label: "Vault Item", plural: "Vault Items", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300" },
}

const TYPE_ORDER = [
  "space",
  "custom_section",
  "task",
  "note",
  "habit",
  "link",
  "whiteboard",
  "budget_category",
  "project",
  "goal",
  "vault_item",
]

const HISTORY_KEY = "lifesort-ai-template-session-history"
const BUILDER_TYPE_OPTIONS: Array<{ value: UserTemplateItem["type"]; label: string }> = [
  { value: "task", label: "Task" },
  { value: "goal", label: "Goal" },
  { value: "habit", label: "Habit" },
  { value: "note", label: "Note" },
  { value: "project", label: "Project" },
  { value: "custom_section", label: "Custom Section" },
  { value: "space", label: "Space" },
  { value: "link", label: "Link" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "budget_category", label: "Budget Category" },
  { value: "vault_item", label: "Vault Item" },
]

type ItemResult = "pending" | "success" | "failed"
type TemplateMode = "library" | "my" | "ai"
type AiHistoryItem = {
  id: string
  prompt: string
  name: string
  createdAt: string
  itemCount: number
  appliedAt?: string
}

type BuilderForm = {
  id: string | null
  name: string
  description: string
  source: UserTemplateSource
  forked_from: string | null
  items: UserTemplateItem[]
}

function getItemName(item: TemplateItem): string {
  if (item.type === "habit" || item.type === "budget_category") return item.name
  return item.title
}

function getItemSubtitle(item: TemplateItem): string | null {
  if (item.type === "habit") return item.frequency === "weekly" ? "Weekly" : "Daily"
  if (item.type === "budget_category") return item.budget_limit != null ? `Budget: $${item.budget_limit}` : null
  if (item.type === "vault_item") return item.category ?? null
  return null
}

function getItemTypeCounts(items: TemplateItem[]): string[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  const shortLabels: Record<string, { one: string; many: string }> = {
    project: { one: "project", many: "projects" },
    task: { one: "task", many: "tasks" },
    goal: { one: "goal", many: "goals" },
    habit: { one: "habit", many: "habits" },
    note: { one: "note", many: "notes" },
    custom_section: { one: "section", many: "sections" },
    budget_category: { one: "budget", many: "budgets" },
    vault_item: { one: "vault item", many: "vault items" },
  }
  return TYPE_ORDER.filter((t) => counts.has(t)).map((t) => {
    const count = counts.get(t)!
    const label = shortLabels[t] ?? { one: t, many: `${t}s` }
    return `${count} ${count === 1 ? label.one : label.many}`
  })
}

function groupByType(items: TemplateItem[]) {
  const groups: Record<string, TemplateItem[]> = {}
  for (const item of items) {
    if (!groups[item.type]) groups[item.type] = []
    groups[item.type].push(item)
  }
  return TYPE_ORDER.filter((t) => groups[t]).map((t) => ({ type: t, typeItems: groups[t] }))
}

function generatedItems(template: GeneratedTemplate) {
  const items: Array<{ type: string; title: string; detail?: string }> = []
  if (template.space.create) items.push({ type: "space", title: template.space.name, detail: template.space.description })
  template.sections.forEach((section) =>
    items.push({ type: "custom_section", title: section.title, detail: `${section.fields.length} fields` }),
  )
  template.starter_tasks.forEach((task) => items.push({ type: "task", title: task.title, detail: task.priority }))
  template.starter_notes.forEach((note) => items.push({ type: "note", title: note.title, detail: note.content }))
  template.starter_habits.forEach((habit) => items.push({ type: "habit", title: habit.name, detail: habit.frequency }))
  template.starter_links.forEach((link) => items.push({ type: "link", title: link.title, detail: link.url || "Placeholder link" }))
  if (template.whiteboard.create) {
    items.push({ type: "whiteboard", title: template.whiteboard.title, detail: template.whiteboard.description })
  }
  template.budget_categories.forEach((category) =>
    items.push({ type: "budget_category", title: category.name, detail: `$${category.budget_limit}` }),
  )
  return items
}

function getGeneratedCounts(template: GeneratedTemplate) {
  const counts = new Map<string, number>()
  for (const item of generatedItems(template)) counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  return TYPE_ORDER.filter((type) => counts.has(type)).map((type) => {
    const count = counts.get(type)!
    const label = TYPE_CONFIG[type]?.plural ?? type
    return `${count} ${count === 1 ? TYPE_CONFIG[type]?.label ?? type : label.toLowerCase()}`
  })
}

function safeHistory(): AiHistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(HISTORY_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch {
    return []
  }
}

function saveHistory(items: AiHistoryItem[]) {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)))
  } catch {
    // Local history should never block template creation.
  }
}

function newBuilderItem(type: UserTemplateItem["type"] = "task"): UserTemplateItem {
  return {
    id: crypto.randomUUID(),
    type,
    title: "",
    description: "",
    priority: "medium",
    frequency: "daily",
    category: "",
    content: "",
    url: "",
    icon: "",
    color: "",
    target_count: 1,
    budget_limit: type === "budget_category" ? 0 : undefined,
  }
}

function newBuilderForm(source: UserTemplateSource = "manual", forkedFrom: string | null = null): BuilderForm {
  return {
    id: null,
    name: "",
    description: "",
    source,
    forked_from: forkedFrom,
    items: [newBuilderItem()],
  }
}

function normalizeUserTemplate(template: Partial<UserTemplate> & Record<string, unknown>): UserTemplate {
  return {
    id: String(template.id ?? ""),
    name: String(template.name ?? ""),
    description: String(template.description ?? ""),
    items: Array.isArray(template.items) ? (template.items as UserTemplateItem[]) : [],
    source: (template.source === "ai" || template.source === "forked" ? template.source : "manual") as UserTemplateSource,
    forked_from: template.forked_from ? String(template.forked_from) : null,
    created_at: String(template.created_at ?? new Date().toISOString()),
    updated_at: template.updated_at ? String(template.updated_at) : null,
    last_used_at: template.last_used_at ? String(template.last_used_at) : null,
  }
}

function getUserTemplateItemTitle(item: UserTemplateItem) {
  return item.title
}

function userTemplateItemDetail(item: UserTemplateItem) {
  if (item.type === "habit") return item.frequency === "weekly" ? "Weekly" : "Daily"
  if (item.type === "budget_category") return item.budget_limit != null ? `Budget: $${item.budget_limit}` : null
  if (item.type === "link") return item.url || "Placeholder link"
  if (item.type === "vault_item") return item.category || null
  return item.description || item.content || null
}

function formatLastUsed(value: string | null) {
  if (!value) return "Never used"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never used"
  return `Last used ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}

export default function TemplatesPage() {
  const { toast } = useToast()
  const [mode, setMode] = useState<TemplateMode>("library")
  const [selected, setSelected] = useState<Template | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<ItemResult[]>([])
  const [myTemplates, setMyTemplates] = useState<UserTemplate[]>([])
  const [loadingMyTemplates, setLoadingMyTemplates] = useState(false)
  const [myTemplatesError, setMyTemplatesError] = useState("")
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderForm, setBuilderForm] = useState<BuilderForm>(() => newBuilderForm())
  const [builderError, setBuilderError] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [selectedUserTemplate, setSelectedUserTemplate] = useState<UserTemplate | null>(null)
  const [usingTemplate, setUsingTemplate] = useState(false)
  const [usedItems, setUsedItems] = useState<Array<{ type: string; id: string; title: string; href: string }>>([])
  const [savingAiTemplate, setSavingAiTemplate] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState("")
  const [generated, setGenerated] = useState<GeneratedTemplate | null>(null)
  const [jsonDraft, setJsonDraft] = useState("")
  const [jsonError, setJsonError] = useState("")
  const [applyingAi, setApplyingAi] = useState(false)
  const [createdItems, setCreatedItems] = useState<CreatedTemplateItem[]>([])
  const [history, setHistory] = useState<AiHistoryItem[]>([])

  useEffect(() => {
    setHistory(safeHistory())
    if (typeof window !== "undefined") {
      const requestedMode = new URLSearchParams(window.location.search).get("mode")
      if (requestedMode === "ai" || requestedMode === "my") setMode(requestedMode)
    }
  }, [])

  useEffect(() => {
    loadMyTemplates()
  }, [])

  const previewItems = useMemo(() => (generated ? generatedItems(generated) : []), [generated])

  async function loadMyTemplates() {
    setLoadingMyTemplates(true)
    setMyTemplatesError("")
    try {
      const res = await fetch("/api/user-templates")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not load My Templates")
      setMyTemplates(Array.isArray(data.templates) ? data.templates.map(normalizeUserTemplate) : [])
      setMigrationRequired(Boolean(data.migration_required))
    } catch (error) {
      setMyTemplatesError(error instanceof Error ? error.message : "Could not load My Templates")
    } finally {
      setLoadingMyTemplates(false)
    }
  }

  function rememberTemplate(template: GeneratedTemplate, sourcePrompt: string, applied = false) {
    const nextItem: AiHistoryItem = {
      id: crypto.randomUUID(),
      prompt: sourcePrompt,
      name: template.name,
      createdAt: new Date().toISOString(),
      itemCount: generatedItems(template).length,
      appliedAt: applied ? new Date().toISOString() : undefined,
    }
    const next = [nextItem, ...history].slice(0, 5)
    setHistory(next)
    saveHistory(next)
  }

  function openPreview(template: Template) {
    setSelected(template)
    setApplying(false)
    setDone(false)
    setResults([])
  }

  function closeDialog() {
    if (applying) return
    setSelected(null)
    setApplying(false)
    setDone(false)
    setResults([])
  }

  function openBuilder(template?: UserTemplate) {
    setBuilderError("")
    if (template) {
      setBuilderForm({
        id: template.id,
        name: template.name,
        description: template.description,
        source: template.source,
        forked_from: template.forked_from,
        items: template.items.length > 0 ? template.items : [newBuilderItem()],
      })
    } else {
      setBuilderForm(newBuilderForm())
    }
    setBuilderOpen(true)
  }

  function closeBuilder() {
    if (savingTemplate) return
    setBuilderOpen(false)
    setBuilderError("")
  }

  function updateBuilderItem(id: string | undefined, patch: Partial<UserTemplateItem>) {
    if (!id) return
    setBuilderForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  function addBuilderItem() {
    setBuilderForm((prev) => ({ ...prev, items: [...prev.items, newBuilderItem()] }))
  }

  function removeBuilderItem(id: string | undefined) {
    if (!id) return
    setBuilderForm((prev) => ({
      ...prev,
      items: prev.items.length <= 1 ? prev.items : prev.items.filter((item) => item.id !== id),
    }))
  }

  async function saveBuilderTemplate() {
    const name = builderForm.name.trim()
    const items = builderForm.items
      .map((item) => ({ ...item, title: item.title.trim() }))
      .filter((item) => item.title)

    if (!name) {
      setBuilderError("Template name is required.")
      return
    }
    if (items.length === 0) {
      setBuilderError("Add at least one item with a title.")
      return
    }

    setSavingTemplate(true)
    setBuilderError("")
    try {
      const isEditing = Boolean(builderForm.id)
      const res = await fetch(isEditing ? `/api/user-templates/${builderForm.id}` : "/api/user-templates", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: builderForm.description,
          items,
          source: builderForm.source,
          forked_from: builderForm.forked_from,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save template")

      const saved = normalizeUserTemplate(data.template)
      setMyTemplates((prev) => {
        const withoutSaved = prev.filter((template) => template.id !== saved.id)
        return [saved, ...withoutSaved]
      })
      setMode("my")
      setBuilderOpen(false)
      toast({ title: isEditing ? "Template updated" : "Template saved", description: saved.name })
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Could not save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  async function customizeTemplate(template: Template) {
    const items = template.items.map(templateItemToUserTemplateItem)
    setSavingTemplate(true)
    try {
      const res = await fetch("/api/user-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} Copy`,
          description: template.description,
          items,
          source: "forked",
          forked_from: template.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not customize template")
      const saved = normalizeUserTemplate(data.template)
      setMyTemplates((prev) => [saved, ...prev])
      setMode("my")
      openBuilder(saved)
      toast({ title: "Template copied", description: "Customize it in My Templates." })
    } catch (error) {
      toast({
        title: "Could not customize template",
        description: error instanceof Error ? error.message : "Try again after the migration is applied.",
        variant: "destructive",
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  function openUserTemplatePreview(template: UserTemplate) {
    setSelectedUserTemplate(template)
    setUsingTemplate(false)
    setUsedItems([])
  }

  function closeUserTemplatePreview() {
    if (usingTemplate) return
    setSelectedUserTemplate(null)
    setUsedItems([])
  }

  async function useUserTemplate() {
    if (!selectedUserTemplate) return
    setUsingTemplate(true)
    setUsedItems([])
    try {
      const res = await fetch(`/api/user-templates/${selectedUserTemplate.id}/use`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not create this system")
      const created = Array.isArray(data.created) ? data.created : []
      setUsedItems(created)
      setMyTemplates((prev) =>
        prev.map((template) =>
          template.id === selectedUserTemplate.id
            ? { ...template, last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            : template,
        ),
      )
      toast({ title: "Template applied", description: `Created ${created.length} items.` })
    } catch (error) {
      toast({
        title: "Could not use template",
        description: error instanceof Error ? error.message : "Try again after the migration is applied.",
        variant: "destructive",
      })
    } finally {
      setUsingTemplate(false)
    }
  }

  async function saveGeneratedToMyTemplates() {
    if (!generated) return
    setSavingAiTemplate(true)
    setAiError("")
    try {
      const items = generatedTemplateToUserTemplateItems(generated)
      const res = await fetch("/api/user-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: generated.name,
          description: generated.description,
          items,
          source: "ai",
          forked_from: null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save generated template")
      const saved = normalizeUserTemplate(data.template)
      setMyTemplates((prev) => [saved, ...prev.filter((template) => template.id !== saved.id)])
      setMode("my")
      toast({ title: "Saved to My Templates", description: saved.name })
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not save generated template")
    } finally {
      setSavingAiTemplate(false)
    }
  }

  async function deleteBuilderTemplate() {
    if (!builderForm.id) return
    setSavingTemplate(true)
    setBuilderError("")
    try {
      const res = await fetch(`/api/user-templates/${builderForm.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not delete template")
      setMyTemplates((prev) => prev.filter((template) => template.id !== builderForm.id))
      setBuilderOpen(false)
      toast({ title: "Template deleted" })
    } catch (error) {
      setBuilderError(error instanceof Error ? error.message : "Could not delete template")
    } finally {
      setSavingTemplate(false)
    }
  }

  async function applyTemplate() {
    if (!selected) return
    const template = selected
    setApplying(true)
    setResults(template.items.map(() => "pending" as ItemResult))

    for (let i = 0; i < template.items.length; i++) {
      const item = template.items[i]
      try {
        const res = await fetch(ENDPOINT_MAP[item.type], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(item)),
        })
        setResults((prev) => {
          const next = [...prev]
          next[i] = res.ok ? "success" : "failed"
          return next
        })
      } catch {
        setResults((prev) => {
          const next = [...prev]
          next[i] = "failed"
          return next
        })
      }
    }

    setApplying(false)
    setDone(true)
  }

  async function generateAiTemplate(nextPrompt = prompt) {
    const trimmed = nextPrompt.trim()
    if (!trimmed) {
      setAiError("Describe the LifeSort system you want to build.")
      return
    }
    setPrompt(trimmed)
    setGenerating(true)
    setAiError("")
    setCreatedItems([])
    setJsonError("")

    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not generate template")

      const parsed = generatedTemplateSchema.safeParse(data.template)
      if (!parsed.success) throw new Error("Template response was not valid")

      setGenerated(parsed.data)
      setJsonDraft(JSON.stringify(parsed.data, null, 2))
      rememberTemplate(parsed.data, trimmed)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate template")
    } finally {
      setGenerating(false)
    }
  }

  function validateJsonDraft() {
    try {
      const parsedJson = JSON.parse(jsonDraft)
      const parsed = generatedTemplateSchema.safeParse(parsedJson)
      if (!parsed.success) {
        setJsonError(parsed.error.issues[0]?.message ?? "Template JSON is invalid")
        return
      }
      setGenerated(parsed.data)
      setJsonDraft(JSON.stringify(parsed.data, null, 2))
      setJsonError("")
      setCreatedItems([])
    } catch {
      setJsonError("Template JSON could not be parsed.")
    }
  }

  async function applyAiTemplate() {
    if (!generated) return
    setApplyingAi(true)
    setAiError("")
    setCreatedItems([])
    try {
      const res = await fetch("/api/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: generated }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not create this system")

      const created = Array.isArray(data.created) ? data.created : []
      setCreatedItems(created)
      rememberTemplate(generated, prompt, true)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not create this system")
    } finally {
      setApplyingAi(false)
    }
  }

  const successCount = results.filter((r) => r === "success").length
  const showStatus = applying || done

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Smart Templates</h1>
            <p className="text-muted-foreground mt-1">
              Preview a ready-made system or ask LifeSort to draft one for your workflow.
            </p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as TemplateMode)} className="space-y-5">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="library" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="my" className="gap-2">
              <BookMarked className="h-4 w-4" />
              My Templates
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Wand2 className="h-4 w-4" />
              AI Builder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((template) => {
                const IconComp = ICON_MAP[template.icon] ?? Sparkles
                const tags = getItemTypeCounts(template.items)
                return (
                  <Card key={template.id} className="overflow-hidden flex flex-col interactive-card">
                    <div className={`h-1.5 bg-gradient-to-r ${template.color}`} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${template.color} text-white shrink-0`}>
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight">{template.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2 flex-1">
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="grid grid-cols-2 gap-2 pt-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => customizeTemplate(template)}>
                        <Copy className="h-3.5 w-3.5" />
                        Customize
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openPreview(template)}>
                        Preview &amp; Apply
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="my" className="mt-0">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">My Templates</h2>
                  <p className="text-sm text-muted-foreground">
                    Templates you created, customized, or saved from AI Builder.
                  </p>
                </div>
                <Button onClick={() => openBuilder()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Template
                </Button>
              </div>

              {migrationRequired && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    My Templates needs the `user_templates` migration before saved templates persist across devices.
                  </AlertDescription>
                </Alert>
              )}

              {myTemplatesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{myTemplatesError}</AlertDescription>
                </Alert>
              )}

              {loadingMyTemplates ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <Card key={item} className="surface-card">
                      <CardContent className="flex h-36 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : myTemplates.length === 0 ? (
                <Card className="surface-card">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="rounded-lg bg-primary/10 p-3 text-primary">
                      <BookMarked className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">No saved templates yet</h3>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Create your own, customize a library template, or save an AI-generated system here.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={() => openBuilder()} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Template
                      </Button>
                      <Button variant="outline" onClick={() => setMode("ai")} className="gap-2">
                        <Wand2 className="h-4 w-4" />
                        Try AI Builder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myTemplates.map((template) => {
                    const tags = summarizeUserTemplateItems(template.items)
                    return (
                      <Card key={template.id} className="flex flex-col overflow-hidden interactive-card">
                        <div className="h-1.5 bg-gradient-to-r from-primary to-teal-500" />
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold leading-tight">{template.name}</h3>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {template.description || "Reusable LifeSort setup"}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 capitalize">
                              {template.source}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-3 pb-2">
                          <div className="flex flex-wrap gap-1">
                            {tags.length === 0 ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                No items
                              </Badge>
                            ) : (
                              tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                  {tag}
                                </Badge>
                              ))
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatLastUsed(template.last_used_at)}</p>
                        </CardContent>
                        <CardFooter className="grid grid-cols-2 gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => openUserTemplatePreview(template)}>
                            Use
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openBuilder(template)}>
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <Card className="surface-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Wand2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">AI Template Builder</h2>
                        <p className="text-sm text-muted-foreground">
                          Turn a prompt into a validated LifeSort system before anything is created.
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="Try: YouTube content planner, client project tracker, study planner..."
                      className="min-h-[120px] resize-y"
                    />
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
                      {templateBuilderExamples.map((example) => (
                        <Button
                          key={example}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => generateAiTemplate(example)}
                          disabled={generating || applyingAi}
                        >
                          {example}
                        </Button>
                      ))}
                    </div>
                    {aiError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{aiError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button onClick={() => generateAiTemplate()} disabled={generating || applyingAi} className="gap-2">
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate preview
                      </Button>
                      {generated && (
                        <Button variant="outline" onClick={() => setGenerated(null)} disabled={generating || applyingAi}>
                          Clear preview
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {generated && (
                  <Card className="surface-card">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">{generated.name}</h2>
                          <p className="text-sm text-muted-foreground mt-1">{generated.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {getGeneratedCounts(generated).map((tag) => (
                            <Badge key={tag} variant="secondary" className="font-normal">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {TYPE_ORDER.map((type) => {
                        const typeItems = previewItems.filter((item) => item.type === type)
                        if (typeItems.length === 0) return null
                        const config = TYPE_CONFIG[type]
                        return (
                          <div key={type}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {config?.plural ?? type}
                            </p>
                            <div className="space-y-2">
                              {typeItems.map((item, index) => (
                                <div
                                  key={`${type}-${index}`}
                                  className="flex items-start gap-2 rounded-md border bg-background/70 p-2"
                                >
                                  <span
                                    className={`mt-0.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium ${config?.color ?? ""}`}
                                  >
                                    {config?.label ?? type}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium leading-tight">{item.title}</p>
                                    {item.detail && (
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      <details className="rounded-md border bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm font-medium">Edit generated JSON</summary>
                        <div className="mt-3 space-y-2">
                          <Textarea
                            value={jsonDraft}
                            onChange={(event) => setJsonDraft(event.target.value)}
                            className="min-h-[260px] font-mono text-xs"
                            spellCheck={false}
                          />
                          {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
                          <Button type="button" variant="outline" size="sm" onClick={validateJsonDraft}>
                            Validate edits
                          </Button>
                        </div>
                      </details>

                      {createdItems.length > 0 && (
                        <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                            <ClipboardCheck className="h-4 w-4" />
                            Created {createdItems.length} items
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {createdItems.map((item) => (
                              <a
                                key={`${item.type}-${item.id}`}
                                href={item.href}
                                className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-3 py-2 text-sm hover:bg-background"
                              >
                                <span className="truncate">{item.title}</span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                      <Button variant="outline" onClick={() => setMode("library")} disabled={applyingAi}>
                        Browse templates
                      </Button>
                      <Button
                        variant="outline"
                        onClick={saveGeneratedToMyTemplates}
                        disabled={applyingAi || savingAiTemplate}
                        className="gap-2"
                      >
                        {savingAiTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save to My Templates
                      </Button>
                      <Button onClick={applyAiTemplate} disabled={applyingAi || createdItems.length > 0} className="gap-2">
                        {applyingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Create this system
                      </Button>
                    </CardFooter>
                  </Card>
                )}
              </div>

              <Card className="surface-card h-fit">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Recent AI templates</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Generated templates will appear here for this session.</p>
                  ) : (
                    history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded-md border bg-background/70 p-3 text-left hover:bg-muted/40"
                        onClick={() => {
                          setPrompt(item.prompt)
                          setMode("ai")
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          {item.appliedAt && <Badge variant="secondary">Applied</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.prompt}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.itemCount} preview items</p>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={builderOpen} onOpenChange={(open) => (!open ? closeBuilder() : setBuilderOpen(true))}>
        <DialogContent className="sm:max-w-[760px] max-h-[86vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{builderForm.id ? "Edit Template" : "Add Template"}</DialogTitle>
            <DialogDescription>Build a reusable LifeSort system from ordered items.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template name</Label>
                <Input
                  id="template-name"
                  value={builderForm.name}
                  onChange={(event) => setBuilderForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Client onboarding system"
                />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm capitalize text-muted-foreground">
                  {builderForm.source}
                  {builderForm.forked_from ? ` from ${builderForm.forked_from}` : ""}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={builderForm.description}
                onChange={(event) => setBuilderForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What this template helps set up"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBuilderItem} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              <SortableList
                items={builderForm.items}
                getId={(item) => item.id ?? ""}
                getLabel={(item) => item.title || TYPE_CONFIG[item.type]?.label || "template item"}
                onReorder={(items) => setBuilderForm((prev) => ({ ...prev, items }))}
                className="space-y-2"
                renderItem={(item, { dragHandle, isDragging }) => (
                  <div className={`rounded-lg border bg-background p-3 ${isDragging ? "shadow-lg" : ""}`}>
                    <div className="grid gap-3 md:grid-cols-[auto_160px_minmax(0,1fr)_auto] md:items-start">
                      <div className="hidden md:block">{dragHandle}</div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={item.type}
                          onValueChange={(value) =>
                            updateBuilderItem(item.id, {
                              type: value as UserTemplateItem["type"],
                              budget_limit: value === "budget_category" ? item.budget_limit ?? 0 : item.budget_limit,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BUILDER_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{item.type === "habit" ? "Name" : "Title"}</Label>
                          <Input
                            value={item.title}
                            onChange={(event) => updateBuilderItem(item.id, { title: event.target.value })}
                            placeholder="Item title"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(item.type === "task" || item.type === "goal" || item.type === "project") && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Priority</Label>
                              <Select
                                value={item.priority ?? "medium"}
                                onValueChange={(value) =>
                                  updateBuilderItem(item.id, { priority: value as UserTemplateItem["priority"] })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {item.type === "habit" && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Frequency</Label>
                              <Select
                                value={item.frequency ?? "daily"}
                                onValueChange={(value) =>
                                  updateBuilderItem(item.id, { frequency: value as UserTemplateItem["frequency"] })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {(item.type === "task" || item.type === "goal" || item.type === "vault_item") && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Category</Label>
                              <Input
                                value={item.category ?? ""}
                                onChange={(event) => updateBuilderItem(item.id, { category: event.target.value })}
                                placeholder="Optional"
                              />
                            </div>
                          )}
                          {item.type === "budget_category" && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Budget limit</Label>
                              <Input
                                type="number"
                                min="0"
                                value={item.budget_limit ?? 0}
                                onChange={(event) =>
                                  updateBuilderItem(item.id, { budget_limit: Number(event.target.value || 0) })
                                }
                              />
                            </div>
                          )}
                          {item.type === "link" && (
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label className="text-xs">URL</Label>
                              <Input
                                value={item.url ?? ""}
                                onChange={(event) => updateBuilderItem(item.id, { url: event.target.value })}
                                placeholder="https://example.com"
                              />
                            </div>
                          )}
                        </div>
                        {(item.type === "note" || item.type === "custom_section" || item.type === "space" || item.type === "whiteboard") ? (
                          <Textarea
                            value={item.type === "note" ? item.content ?? "" : item.description ?? ""}
                            onChange={(event) =>
                              updateBuilderItem(
                                item.id,
                                item.type === "note" ? { content: event.target.value } : { description: event.target.value },
                              )
                            }
                            placeholder={item.type === "note" ? "Starter note content" : "Optional description"}
                            className="min-h-[72px]"
                          />
                        ) : (
                          <Input
                            value={item.description ?? ""}
                            onChange={(event) => updateBuilderItem(item.id, { description: event.target.value })}
                            placeholder="Optional description"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-1 md:flex-col">
                        <div className="md:hidden">{dragHandle}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBuilderItem(item.id)}
                          disabled={builderForm.items.length <= 1}
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>

            {builderError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{builderError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {builderForm.id && (
                <Button type="button" variant="outline" onClick={deleteBuilderTemplate} disabled={savingTemplate} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeBuilder} disabled={savingTemplate}>
                Cancel
              </Button>
              <Button type="button" onClick={saveBuilderTemplate} disabled={savingTemplate} className="gap-2">
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Template
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedUserTemplate && (
        <Dialog open={!!selectedUserTemplate} onOpenChange={(open) => !open && closeUserTemplatePreview()}>
          <DialogContent className="sm:max-w-[580px] max-h-[80vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>{selectedUserTemplate.name}</DialogTitle>
              <DialogDescription>{selectedUserTemplate.description || "Review the items before creating them."}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4">
              {usedItems.length === 0 ? (
                TYPE_ORDER.map((type) => {
                  const typeItems = selectedUserTemplate.items.filter((item) => item.type === type)
                  if (typeItems.length === 0) return null
                  const config = TYPE_CONFIG[type]
                  return (
                    <div key={type}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {config?.plural ?? type}
                      </p>
                      <div className="space-y-1.5">
                        {typeItems.map((item) => {
                          const detail = userTemplateItemDetail(item)
                          return (
                            <div key={item.id ?? `${item.type}-${item.title}`} className="flex items-start gap-2">
                              <span
                                className={`mt-0.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium ${config?.color ?? ""}`}
                              >
                                {config?.label ?? type}
                              </span>
                              <span className="text-sm">
                                {getUserTemplateItemTitle(item)}
                                {detail && <span className="ml-1.5 text-xs text-muted-foreground">({detail})</span>}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                    <ClipboardCheck className="h-4 w-4" />
                    Created {usedItems.length} items
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {usedItems.map((item) => (
                      <a
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-md bg-background/80 px-3 py-2 text-sm hover:bg-background"
                      >
                        <span className="truncate">{item.title}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t px-6 py-4">
              {usedItems.length > 0 ? (
                <Button onClick={closeUserTemplatePreview}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeUserTemplatePreview} disabled={usingTemplate}>
                    Cancel
                  </Button>
                  <Button onClick={useUserTemplate} disabled={usingTemplate} className="gap-2">
                    {usingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Create this system
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selected && (
        <Dialog open={!!selected} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-[580px] max-h-[80vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>{selected.description}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
              {!showStatus
                ? groupByType(selected.items).map(({ type, typeItems }) => {
                    const config = TYPE_CONFIG[type]
                    return (
                      <div key={type}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          {config?.plural ?? type}
                        </p>
                        <div className="space-y-1.5">
                          {typeItems.map((item, idx) => {
                            const subtitle = getItemSubtitle(item)
                            return (
                              <div key={idx} className="flex items-start gap-2">
                                <span
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 mt-0.5 ${config?.color ?? ""}`}
                                >
                                  {config?.label ?? type}
                                </span>
                                <span className="text-sm">
                                  {getItemName(item)}
                                  {subtitle && (
                                    <span className="text-xs text-muted-foreground ml-1.5">({subtitle})</span>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                : selected.items.map((item, idx) => {
                    const status = results[idx] ?? "pending"
                    const config = TYPE_CONFIG[item.type]
                    return (
                      <div key={idx} className="flex items-center gap-2 py-0.5">
                        {status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                        )}
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium shrink-0 ${config?.color ?? ""}`}
                        >
                          {config?.label ?? item.type}
                        </span>
                        <span className="text-sm truncate">{getItemName(item)}</span>
                      </div>
                    )
                  })}
              {done && (
                <p className="text-sm text-muted-foreground pt-1">
                  {successCount} of {selected.items.length} items created
                  {successCount < selected.items.length
                    ? " - some items could not be created. Visit the relevant pages to retry."
                    : "."}
                </p>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              {done ? (
                <Button onClick={closeDialog}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeDialog} disabled={applying}>
                    Cancel
                  </Button>
                  <Button onClick={applyTemplate} disabled={applying}>
                    {applying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      "Create this system"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  )
}
