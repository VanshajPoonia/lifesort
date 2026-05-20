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
  Dumbbell,
  GraduationCap,
  History,
  Home,
  Loader2,
  PiggyBank,
  Plane,
  Rocket,
  Sparkles,
  Video,
  Wand2,
  XCircle,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { TEMPLATES, ENDPOINT_MAP, buildPayload } from "@/lib/templates"
import type { Template, TemplateItem } from "@/lib/templates"
import {
  generatedTemplateSchema,
  templateBuilderExamples,
  type CreatedTemplateItem,
  type GeneratedTemplate,
} from "@/lib/template-builder"

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

const HISTORY_KEY = "lifesort-ai-template-history"

type ItemResult = "pending" | "success" | "failed"
type TemplateMode = "library" | "ai"
type AiHistoryItem = {
  id: string
  prompt: string
  name: string
  createdAt: string
  itemCount: number
  appliedAt?: string
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
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch {
    return []
  }
}

function saveHistory(items: AiHistoryItem[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 5)))
  } catch {
    // Local history should never block template creation.
  }
}

export default function TemplatesPage() {
  const [mode, setMode] = useState<TemplateMode>("library")
  const [selected, setSelected] = useState<Template | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<ItemResult[]>([])
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
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "ai") {
      setMode("ai")
    }
  }, [])

  const previewItems = useMemo(() => (generated ? generatedItems(generated) : []), [generated])

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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="library" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Library
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
                    <CardFooter className="pt-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openPreview(template)}>
                        Preview &amp; Apply
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
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
                    <p className="text-sm text-muted-foreground">Generated templates will appear here on this device.</p>
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
