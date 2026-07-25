"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Archive,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ResetActionType = "reschedule" | "mark_complete" | "archive" | "delete" | "move_someday"

type ResetItem = {
  id: string
  type: string
  title: string
  subtitle: string
  href: string
  date: string | null
  status: string | null
  priority: string | null
  life_area_id: string | null
  updated_at: string | null
  reason: string
  actions: ResetActionType[]
}

type ResetSection = {
  key: string
  title: string
  description: string
  items: ResetItem[]
}

type ResetResponse = {
  generated_at: string
  life_areas: Array<{ id: string; name: string; icon?: string; color?: string }>
  sections: ResetSection[]
  unavailable: string[]
  counts: { total: number; urgent: number; upcoming: number; unavailable: number }
}

type AiSuggestion = {
  item_type: string
  id: string
  title: string
  recommendation: "prioritize" | "defer" | "archive" | "complete"
  action: ResetActionType
  reason: string
}

const actionLabels: Record<ResetActionType, string> = {
  reschedule: "Reschedule",
  mark_complete: "Mark complete",
  archive: "Archive",
  delete: "Delete",
  move_someday: "Move to someday",
}

function localDateString(daysFromNow = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return "No date"
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function itemKey(item: Pick<ResetItem, "type" | "id">) {
  return `${item.type}:${item.id}`
}

function EmptyPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

export default function ResetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ResetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<ResetActionType | null>(null)
  const [actionDate, setActionDate] = useState(localDateString(7))
  const [applying, setApplying] = useState(false)
  const [notice, setNotice] = useState("")
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [focusKeys, setFocusKeys] = useState<Set<string>>(new Set())
  const [deferDate, setDeferDate] = useState(localDateString(7))
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [aiSummary, setAiSummary] = useState("")
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const loadReset = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/reset")
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error || "Reset dashboard could not be loaded.")
      setData(json as ResetResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Reset dashboard could not be loaded.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: loadReset is shared with
    // several mutation handlers below that need the reload afterward too.
    loadReset()
  }, [loadReset])

  const allItems = useMemo(() => data?.sections.flatMap((section) => section.items) ?? [], [data])
  const itemsByKey = useMemo(() => new Map(allItems.map((item) => [itemKey(item), item])), [allItems])
  const selectedItems = useMemo(() => Array.from(selected).flatMap((key) => {
    const item = itemsByKey.get(key)
    return item ? [item] : []
  }), [itemsByKey, selected])
  const actionableItems = useMemo(() => selectedItems.filter((item) => pendingAction && item.actions.includes(pendingAction)), [pendingAction, selectedItems])

  const toggleItem = (item: ResetItem) => {
    setSelected((current) => {
      const next = new Set(current)
      const key = itemKey(item)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSection = (section: ResetSection) => {
    setSelected((current) => {
      const next = new Set(current)
      const allSelected = section.items.every((item) => next.has(itemKey(item)))
      for (const item of section.items) {
        if (allSelected) next.delete(itemKey(item))
        else next.add(itemKey(item))
      }
      return next
    })
  }

  const applyAction = async () => {
    if (!pendingAction || actionableItems.length === 0) return
    setApplying(true)
    setNotice("")
    try {
      const response = await fetch("/api/reset/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: actionableItems.map((item) => ({
            item_type: item.type,
            id: item.id,
            action: pendingAction,
            date: pendingAction === "reschedule" ? actionDate : undefined,
          })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error || "Reset actions could not be applied.")
      setNotice(`Applied ${json.applied || 0} action${json.applied === 1 ? "" : "s"}.`)
      setSelected(new Set())
      setPendingAction(null)
      await loadReset()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Reset actions could not be applied.")
    } finally {
      setApplying(false)
    }
  }

  const createRecoveryPlan = async () => {
    const focusItems = Array.from(focusKeys).flatMap((key) => {
      const item = itemsByKey.get(key)
      return item ? [item] : []
    })
    if (focusItems.length < 1 || focusItems.length > 3) {
      setError("Choose 1-3 focus items for today.")
      return
    }

    setCreatingPlan(true)
    setError("")
    try {
      const response = await fetch("/api/reset/recovery-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: localDateString(),
          defer_date: deferDate,
          focus_items: focusItems,
          defer_items: allItems.filter((item) => !focusKeys.has(itemKey(item))),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error || "Recovery plan could not be created.")
      setNotice(`Recovery plan saved with ${focusItems.length} focus item${focusItems.length === 1 ? "" : "s"}.`)
      setRecoveryOpen(false)
      setFocusKeys(new Set())
      await loadReset()
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Recovery plan could not be created.")
    } finally {
      setCreatingPlan(false)
    }
  }

  const analyzeReset = async () => {
    setAiLoading(true)
    setAiError("")
    try {
      const response = await fetch("/api/ai/reset-suggestions", { method: "POST" })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error || "AI suggestions could not be generated.")
      setAiSummary(json.analysis?.summary || "")
      setAiSuggestions(Array.isArray(json.analysis?.suggestions) ? json.analysis.suggestions : [])
      setSelectedSuggestions(new Set())
    } catch (analysisError) {
      setAiError(analysisError instanceof Error ? analysisError.message : "AI suggestions could not be generated.")
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiSuggestions = async () => {
    const picked = aiSuggestions.filter((suggestion) => selectedSuggestions.has(`${suggestion.item_type}:${suggestion.id}:${suggestion.action}`))
    if (picked.length === 0) return
    setApplying(true)
    try {
      const response = await fetch("/api/reset/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: picked.map((suggestion) => ({
            item_type: suggestion.item_type,
            id: suggestion.id,
            action: suggestion.action,
            date: suggestion.action === "reschedule" ? deferDate : undefined,
          })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error || "AI suggestions could not be applied.")
      setNotice(`Applied ${json.applied || 0} AI-suggested action${json.applied === 1 ? "" : "s"}.`)
      setSelectedSuggestions(new Set())
      await loadReset()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "AI suggestions could not be applied.")
    } finally {
      setApplying(false)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Reset My Life" subtitle="Recover from overwhelm without losing your system.">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}><CardContent className="p-6"><Skeleton className="h-10 w-full" /></CardContent></Card>
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Reset My Life" subtitle="Triage the messy parts, pick today’s top three, and move the rest safely.">
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total reset items</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{data?.counts.total ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Needs attention</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold text-destructive">{data?.counts.urgent ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Upcoming deadlines</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{data?.counts.upcoming ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Unavailable sources</CardDescription></CardHeader>
            <CardContent><p className="text-3xl font-bold">{data?.counts.unavailable ?? 0}</p></CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><RefreshCcw className="h-5 w-5" /> Recovery controls</CardTitle>
              <CardDescription>Bulk changes require confirmation. AI suggestions are read-only until you apply them.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setRecoveryOpen(true)} disabled={allItems.length === 0}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Create recovery plan
              </Button>
              <Button onClick={analyzeReset} disabled={aiLoading || allItems.length === 0}>
                {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analyze my reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto_auto_auto]">
              <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                {selected.size} selected. Unsupported actions are ignored in the confirmation preview.
              </div>
              <Input type="date" value={actionDate} onChange={(event) => setActionDate(event.target.value)} />
              {(["reschedule", "mark_complete", "archive", "move_someday", "delete"] as ResetActionType[]).map((action) => (
                <Button
                  key={action}
                  variant={action === "delete" ? "destructive" : "outline"}
                  disabled={selected.size === 0}
                  onClick={() => setPendingAction(action)}
                >
                  {action === "delete" ? <Trash2 className="mr-2 h-4 w-4" /> : action === "archive" ? <Archive className="mr-2 h-4 w-4" /> : null}
                  {actionLabels[action]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {data?.unavailable && data.unavailable.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Some sources are unavailable.</p>
                <p className="mt-1 text-xs">{data.unavailable.join(", ")}</p>
              </div>
            </div>
          </div>
        )}

        {allItems.length === 0 ? (
          <EmptyPanel title="Nothing needs a reset right now">
            Your overdue, stale, missed, and unsorted lists are clear. Nice. Future deadlines will show here when they need a decision.
          </EmptyPanel>
        ) : (
          <div className="space-y-4">
            {data?.sections.map((section) => (
              <Card key={section.key}>
                <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{section.items.length}</Badge>
                    <Button variant="outline" size="sm" disabled={section.items.length === 0} onClick={() => toggleSection(section)}>
                      {section.items.every((item) => selected.has(itemKey(item))) ? "Clear" : "Select"} section
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {section.items.length === 0 ? (
                    <EmptyPanel title={`No ${section.title.toLowerCase()}`}>
                      This part of your system is not adding pressure right now.
                    </EmptyPanel>
                  ) : (
                    <div className="grid gap-3">
                      {section.items.map((item) => (
                        <div key={itemKey(item)} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="flex gap-3">
                              <Checkbox checked={selected.has(itemKey(item))} onCheckedChange={() => toggleItem(item)} />
                              <div>
                                <Link href={item.href} className="font-medium hover:underline">{item.title}</Link>
                                <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <Badge variant="outline">{item.type}</Badge>
                              {item.priority && <Badge variant="secondary">{item.priority}</Badge>}
                              <Badge variant={item.date ? "default" : "outline"}>{formatDate(item.date)}</Badge>
                              <Link href={item.href} className="inline-flex items-center text-xs text-primary hover:underline">
                                Open <ChevronRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1">
                            {item.actions.map((action) => (
                              <Badge key={action} variant="outline" className="text-[11px]">{actionLabels[action]}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> AI reset suggestions</CardTitle>
            <CardDescription>Read-only triage. Select suggestions before applying anything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{aiError}</p>}
            {aiSummary && <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{aiSummary}</p>}
            {aiSuggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Run analysis to get suggestions for what to prioritize, defer, archive, or complete.</p>
            ) : (
              <div className="space-y-3">
                {aiSuggestions.map((suggestion) => {
                  const key = `${suggestion.item_type}:${suggestion.id}:${suggestion.action}`
                  return (
                    <label key={key} className="flex cursor-pointer gap-3 rounded-lg border p-3">
                      <Checkbox
                        checked={selectedSuggestions.has(key)}
                        onCheckedChange={() => setSelectedSuggestions((current) => {
                          const next = new Set(current)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })}
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{suggestion.title}</p>
                          <Badge>{suggestion.recommendation}</Badge>
                          <Badge variant="outline">{actionLabels[suggestion.action]}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{suggestion.reason}</p>
                      </div>
                    </label>
                  )
                })}
                <Button onClick={applyAiSuggestions} disabled={applying || selectedSuggestions.size === 0}>
                  {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Apply selected suggestions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingAction === "delete" ? "Delete selected items?" : `Apply ${pendingAction ? actionLabels[pendingAction].toLowerCase() : "action"}?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {actionableItems.length} of {selectedItems.length} selected item{selectedItems.length === 1 ? "" : "s"} support this action.
                {pendingAction === "delete" ? " Deletion is permanent and cannot be undone." : " This will update your LifeSort records after confirmation."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={applyAction} disabled={applying || actionableItems.length === 0}>
                {applying ? "Applying..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
          <AlertDialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Create recovery plan</AlertDialogTitle>
              <AlertDialogDescription>
                Pick 1-3 focus items for today. Everything else will be moved later after confirmation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="defer-date">Move the rest to</Label>
                <Input id="defer-date" type="date" value={deferDate} onChange={(event) => setDeferDate(event.target.value)} />
              </div>
              <div className="grid gap-2">
                {allItems.slice(0, 30).map((item) => {
                  const key = itemKey(item)
                  const checked = focusKeys.has(key)
                  return (
                    <label key={key} className="flex cursor-pointer gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={checked}
                        disabled={!checked && focusKeys.size >= 3}
                        onCheckedChange={() => setFocusKeys((current) => {
                          const next = new Set(current)
                          if (next.has(key)) next.delete(key)
                          else if (next.size < 3) next.add(key)
                          return next
                        })}
                      />
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.subtitle} · {formatDate(item.date)}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={creatingPlan}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={createRecoveryPlan} disabled={creatingPlan || focusKeys.size < 1 || focusKeys.size > 3}>
                {creatingPlan ? "Saving..." : "Create plan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}
