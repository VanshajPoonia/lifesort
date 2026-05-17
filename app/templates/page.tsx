"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
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
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
} from "lucide-react"
import { TEMPLATES, ENDPOINT_MAP, buildPayload } from "@/lib/templates"
import type { Template, TemplateItem } from "@/lib/templates"

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  project: { label: "Project", plural: "Projects", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  task: { label: "Task", plural: "Tasks", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  goal: { label: "Goal", plural: "Goals", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  habit: { label: "Habit", plural: "Habits", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  note: { label: "Note", plural: "Notes", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  custom_section: { label: "Custom Section", plural: "Custom Sections", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  budget_category: { label: "Budget Category", plural: "Budget Categories", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  vault_item: { label: "Vault Item", plural: "Vault Items", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300" },
}

const TYPE_ORDER = ["project", "goal", "task", "habit", "note", "custom_section", "budget_category", "vault_item"]

type ItemResult = "pending" | "success" | "failed"

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
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }
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
    const l = shortLabels[t] ?? { one: t, many: t + "s" }
    return `${count} ${count === 1 ? l.one : l.many}`
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

export default function TemplatesPage() {
  const [selected, setSelected] = useState<Template | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<ItemResult[]>([])

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

  const successCount = results.filter((r) => r === "success").length
  const showStatus = applying || done

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Templates</h1>
          <p className="text-muted-foreground mt-1">
            Start your life systems in one click. Preview everything before it&apos;s created.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((template) => {
            const IconComp = ICON_MAP[template.icon] ?? Sparkles
            const tags = getItemTypeCounts(template.items)
            return (
              <Card key={template.id} className="overflow-hidden flex flex-col">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openPreview(template)}
                  >
                    Preview &amp; Apply
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
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
                    ? " — some items could not be created. Visit the relevant pages to retry."
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
                        Creating…
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
