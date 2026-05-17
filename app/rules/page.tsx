"use client"

import { useEffect, useState } from "react"
import { Brain, Check, Clock, Edit, Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const RULE_CATEGORIES = ["time", "energy", "work", "health", "finance", "learning", "relationships", "planning", "AI", "other"] as const
const PLANNING_STYLES = ["strict", "balanced", "flexible"] as const
const REMINDER_TIMINGS = ["morning", "midday", "afternoon", "evening", "night"] as const
const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

type RuleCategory = (typeof RULE_CATEGORIES)[number]
type PlanningStyle = (typeof PLANNING_STYLES)[number]
type ReminderTiming = (typeof REMINDER_TIMINGS)[number]
type WeekDay = (typeof WEEK_DAYS)[number]

type PersonalRule = {
  id: number
  title: string
  description: string | null
  category: RuleCategory
  active: boolean
  updated_at?: string | null
}

type Preferences = {
  working_hours_start: string
  working_hours_end: string
  max_daily_focus_items: number
  reminder_timing: ReminderTiming
  heavy_days: WeekDay[]
  light_days: WeekDay[]
  planning_style: PlanningStyle
}

type RulesPayload = {
  rules: PersonalRule[]
  preferences: Preferences
  preview: string
}

type RuleForm = {
  id: number | null
  title: string
  description: string
  category: RuleCategory
  active: boolean
}

const DEFAULT_PREFERENCES: Preferences = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  max_daily_focus_items: 3,
  reminder_timing: "morning",
  heavy_days: [],
  light_days: [],
  planning_style: "balanced",
}

const EMPTY_FORM: RuleForm = {
  id: null,
  title: "",
  description: "",
  category: "planning",
  active: true,
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function dayType(preferences: Preferences, day: WeekDay) {
  if (preferences.heavy_days.includes(day)) return "heavy"
  if (preferences.light_days.includes(day)) return "light"
  return "normal"
}

export default function RulesPage() {
  const [rules, setRules] = useState<PersonalRule[]>([])
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [preview, setPreview] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM)

  useEffect(() => {
    void loadRules()
  }, [])

  const applyPayload = (payload: RulesPayload) => {
    setRules(payload.rules ?? [])
    setPreferences(payload.preferences ?? DEFAULT_PREFERENCES)
    setPreview(payload.preview ?? "")
  }

  const loadRules = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/personal-rules")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load personal rules")
      applyPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load personal rules")
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (rule: PersonalRule) => {
    setForm({
      id: rule.id,
      title: rule.title,
      description: rule.description ?? "",
      category: rule.category,
      active: rule.active,
    })
    setDialogOpen(true)
  }

  const saveRule = async () => {
    if (!form.title.trim()) {
      setError("Rule title is required")
      return
    }

    setSavingRule(true)
    setError("")
    try {
      const response = await fetch("/api/personal-rules", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save personal rule")
      setDialogOpen(false)
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save personal rule")
    } finally {
      setSavingRule(false)
    }
  }

  const deleteRule = async (rule: PersonalRule) => {
    if (!window.confirm(`Delete "${rule.title}"? AI planning will stop using this rule.`)) return
    setError("")
    try {
      const response = await fetch("/api/personal-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete personal rule")
      await loadRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete personal rule")
    }
  }

  const savePreferences = async () => {
    setSavingPrefs(true)
    setError("")
    try {
      const response = await fetch("/api/personal-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save preferences")
      applyPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences")
    } finally {
      setSavingPrefs(false)
    }
  }

  const setPreferenceDay = (day: WeekDay, nextType: "normal" | "heavy" | "light") => {
    setPreferences((current) => ({
      ...current,
      heavy_days: nextType === "heavy"
        ? Array.from(new Set([...current.heavy_days, day]))
        : current.heavy_days.filter((value) => value !== day),
      light_days: nextType === "light"
        ? Array.from(new Set([...current.light_days, day]))
        : current.light_days.filter((value) => value !== day),
    }))
  }

  return (
    <DashboardLayout
      title="Personal Operating Rules"
      subtitle="Visible preferences and constraints LifeSort AI uses when suggesting plans"
    >
      <div className="space-y-6">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading your operating rules...
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-primary" />
                        Structured Preferences
                      </CardTitle>
                      <CardDescription>
                        These settings stay visible and are included in AI planning context.
                      </CardDescription>
                    </div>
                    <Button onClick={savePreferences} disabled={savingPrefs}>
                      {savingPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Preferences
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="working-start">Preferred work start</Label>
                      <Input
                        id="working-start"
                        type="time"
                        value={preferences.working_hours_start}
                        onChange={(event) => setPreferences((current) => ({ ...current, working_hours_start: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="working-end">Preferred work end</Label>
                      <Input
                        id="working-end"
                        type="time"
                        value={preferences.working_hours_end}
                        onChange={(event) => setPreferences((current) => ({ ...current, working_hours_end: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-focus">Max daily focus items</Label>
                      <Input
                        id="max-focus"
                        type="number"
                        min={1}
                        max={5}
                        value={preferences.max_daily_focus_items}
                        onChange={(event) => {
                          const next = Number.parseInt(event.target.value, 10)
                          setPreferences((current) => ({ ...current, max_daily_focus_items: Number.isFinite(next) ? next : 3 }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred reminder timing</Label>
                      <Select
                        value={preferences.reminder_timing}
                        onValueChange={(value) => setPreferences((current) => ({ ...current, reminder_timing: value as ReminderTiming }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMINDER_TIMINGS.map((timing) => (
                            <SelectItem key={timing} value={timing}>{titleCase(timing)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Planning style</Label>
                      <Select
                        value={preferences.planning_style}
                        onValueChange={(value) => setPreferences((current) => ({ ...current, planning_style: value as PlanningStyle }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLANNING_STYLES.map((style) => (
                            <SelectItem key={style} value={style}>{titleCase(style)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label>Heavy and light days</Label>
                      <p className="text-sm text-muted-foreground">
                        Mark days where plans should be more ambitious or gentler.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {WEEK_DAYS.map((day) => (
                        <div key={day} className="space-y-2 rounded-lg border p-3">
                          <Label>{titleCase(day)}</Label>
                          <Select value={dayType(preferences, day)} onValueChange={(value) => setPreferenceDay(day, value as "normal" | "heavy" | "light")}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="heavy">Heavy</SelectItem>
                              <SelectItem value="light">Light</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    AI Planning Context Preview
                  </CardTitle>
                  <CardDescription>
                    This is the visible context AI planning features can read. There are no hidden rules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">{preview || "Save preferences or add rules to build your preview."}</pre>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI can use active rules for suggestions, but it cannot create or change rules without your confirmation.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Operating Rules</CardTitle>
                    <CardDescription>
                      Add practical constraints like “no heavy planning after 8 PM” or “keep Fridays light.”
                    </CardDescription>
                  </div>
                  <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <h3 className="font-semibold">No operating rules yet</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      Start with one constraint or preference you want LifeSort to respect when it suggests plans.
                    </p>
                    <Button className="mt-4" onClick={openCreateDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Rule
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {rules.map((rule) => (
                      <div key={rule.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold">{rule.title}</h3>
                              <Badge variant={rule.active ? "default" : "secondary"}>
                                {rule.active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline">{titleCase(rule.category)}</Badge>
                            </div>
                            {rule.description ? (
                              <p className="text-sm text-muted-foreground">{rule.description}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">No description added.</p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)} aria-label={`Edit ${rule.title}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteRule(rule)} aria-label={`Delete ${rule.title}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Operating Rule" : "Add Operating Rule"}</DialogTitle>
            <DialogDescription>
              Rules are visible to you and can be read by AI planning features when they suggest plans.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-title">Title</Label>
              <Input
                id="rule-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Keep Friday afternoons light"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as RuleCategory }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>{titleCase(category)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Explain the preference or constraint in plain language."
                rows={4}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="rule-active">Active</Label>
                <p className="text-sm text-muted-foreground">Inactive rules stay saved but are not included in AI planning context.</p>
              </div>
              <Switch
                id="rule-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={savingRule}>
              {savingRule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
