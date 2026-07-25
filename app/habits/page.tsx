"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import {
  CheckSquare,
  Flame,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Clock,
  Sunrise,
  Sunset,
  Star,
  BarChart2,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { LifeAreaSelect } from "@/components/life-area-controls"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"

// ── Types ─────────────────────────────────────────────────────────────────────

type Habit = {
  id: number
  name: string
  description: string | null
  frequency: "daily" | "weekly" | "custom"
  custom_days: number[]
  target_count: number
  reminder_time: string | null
  life_area_id: number | null
  life_area_name: string | null
  life_area_color: string | null
  is_active: boolean
  color: string
  icon: string
}

type HabitStats = {
  current_streak: number
  best_streak: number
  completion_week: number
  completion_month: number
}

type Checkin = {
  habit_id: number
  checkin_date: string
  count: number
}

type RoutineStep = {
  id?: number
  step_type: "habit" | "custom"
  habit_id: number | null
  title: string
  description: string | null
  duration_minutes: number | null
  sort_order: number
}

type Routine = {
  id: number
  name: string
  description: string | null
  routine_type: "morning" | "evening" | "custom"
  is_active: boolean
  steps: RoutineStep[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const COLORS = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#EA580C", "#DB2777", "#0891B2", "#CA8A04"]

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function lastTwelveWeekDays() {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(end.getDate() - 83)

  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function isDueToday(habit: Habit) {
  if (!habit.is_active) return false
  if (habit.frequency === "daily") return true
  if (habit.frequency === "weekly") return true
  if (habit.frequency === "custom") {
    const day = new Date().getDay()
    return (habit.custom_days || []).includes(day)
  }
  return false
}

function streakLabel(n: number) {
  if (n === 0) return "No streak"
  return `${n} day${n === 1 ? "" : "s"}`
}

// ── Habit Form ────────────────────────────────────────────────────────────────

type HabitFormData = {
  name: string
  description: string
  frequency: "daily" | "weekly" | "custom"
  custom_days: number[]
  target_count: number
  reminder_time: string
  life_area_id: string
  is_active: boolean
  color: string
}

const emptyHabitForm: HabitFormData = {
  name: "",
  description: "",
  frequency: "daily",
  custom_days: [],
  target_count: 1,
  reminder_time: "",
  life_area_id: "",
  is_active: true,
  color: "#2563EB",
}

function HabitForm({
  initial,
  lifeAreas,
  onSave,
  onCancel,
  saving,
}: {
  initial?: HabitFormData
  lifeAreas: LifeArea[]
  onSave: (data: HabitFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<HabitFormData>(initial || emptyHabitForm)

  function toggleDay(d: number) {
    setForm((prev) => ({
      ...prev,
      custom_days: prev.custom_days.includes(d)
        ? prev.custom_days.filter((x) => x !== d)
        : [...prev.custom_days, d],
    }))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Morning run"
          />
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={form.frequency} onValueChange={(v) => setForm((p) => ({ ...p, frequency: v as HabitFormData["frequency"] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly (any day)</SelectItem>
              <SelectItem value="custom">Custom days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.frequency === "custom" && (
        <div className="space-y-2">
          <Label>Days of the week</Label>
          <div className="flex gap-2 flex-wrap">
            {DAY_LABELS.map((label, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant={form.custom_days.includes(i) ? "default" : "outline"}
                onClick={() => toggleDay(i)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Target count per day</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={form.target_count}
            onChange={(e) => setForm((p) => ({ ...p, target_count: Math.max(1, Number(e.target.value)) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Reminder time (optional)</Label>
          <Input
            type="time"
            value={form.reminder_time}
            onChange={(e) => setForm((p) => ({ ...p, reminder_time: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Why does this habit matter?"
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Life domain (optional)</Label>
          <LifeAreaSelect
            areas={lifeAreas}
            value={form.life_area_id}
            onChange={(v) => setForm((p) => ({ ...p, life_area_id: v ?? "" }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="h-7 w-7 rounded-full border-2 transition-all"
                style={{
                  background: c,
                  borderColor: form.color === c ? "#fff" : "transparent",
                  outline: form.color === c ? `2px solid ${c}` : "none",
                }}
                onClick={() => setForm((p) => ({ ...p, color: c }))}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_active}
          onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
          id="habit-active"
        />
        <Label htmlFor="habit-active">Active</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Habit
        </Button>
      </div>
    </div>
  )
}

// ── Routine Form ──────────────────────────────────────────────────────────────

type RoutineFormData = {
  name: string
  description: string
  routine_type: "morning" | "evening" | "custom"
  is_active: boolean
  steps: Array<{ title: string; step_type: "habit" | "custom"; habit_id: string; duration_minutes: string }>
}

const emptyRoutineForm: RoutineFormData = {
  name: "",
  description: "",
  routine_type: "morning",
  is_active: true,
  steps: [],
}

function RoutineForm({
  initial,
  habits,
  onSave,
  onCancel,
  saving,
}: {
  initial?: RoutineFormData
  habits: Habit[]
  onSave: (data: RoutineFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<RoutineFormData>(initial || emptyRoutineForm)

  function addStep() {
    setForm((p) => ({
      ...p,
      steps: [...p.steps, { title: "", step_type: "custom", habit_id: "", duration_minutes: "" }],
    }))
  }

  function removeStep(i: number) {
    setForm((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }))
  }

  function updateStep(i: number, field: string, value: string) {
    setForm((p) => {
      const steps = [...p.steps]
      steps[i] = { ...steps[i], [field]: value }
      if (field === "step_type" && value === "habit") {
        steps[i].title = ""
      }
      if (field === "habit_id" && value) {
        const h = habits.find((h) => String(h.id) === value)
        if (h) steps[i].title = h.name
      }
      return { ...p, steps }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Morning Routine"
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.routine_type} onValueChange={(v) => setForm((p) => ({ ...p, routine_type: v as RoutineFormData["routine_type"] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          rows={2}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Steps</Label>
          <Button type="button" size="sm" variant="outline" onClick={addStep}>
            <Plus className="h-3 w-3 mr-1" /> Add step
          </Button>
        </div>
        {form.steps.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps yet. Add steps to build your routine.</p>
        )}
        {form.steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start border border-border rounded-lg p-3">
            <div className="flex-1 grid gap-2 sm:grid-cols-3">
              <Select value={step.step_type} onValueChange={(v) => updateStep(i, "step_type", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="habit">Habit</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {step.step_type === "habit" ? (
                <Select value={step.habit_id} onValueChange={(v) => updateStep(i, "habit_id", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select habit" />
                  </SelectTrigger>
                  <SelectContent>
                    {habits.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  value={step.title}
                  onChange={(e) => updateStep(i, "title", e.target.value)}
                  placeholder="Step title"
                />
              )}
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                value={step.duration_minutes}
                onChange={(e) => updateStep(i, "duration_minutes", e.target.value)}
                placeholder="Minutes"
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeStep(i)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={form.is_active}
          onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
          id="routine-active"
        />
        <Label htmlFor="routine-active">Active</Label>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Routine
        </Button>
      </div>
    </div>
  )
}

// ── Habit Card ────────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  checkin,
  stats,
  onCheckin,
  onEdit,
  onDelete,
  recentCheckins,
}: {
  habit: Habit
  checkin: Checkin | undefined
  stats: HabitStats | undefined
  onCheckin: (habit: Habit, count: number) => void
  onEdit: (habit: Habit) => void
  onDelete: (id: number) => void
  recentCheckins: Checkin[]
}) {
  const done = (checkin?.count ?? 0) >= habit.target_count
  const count = checkin?.count ?? 0
  const due = isDueToday(habit)
  const completionDates = useMemo(
    () =>
      new Set(
        recentCheckins
          .filter((item) => item.habit_id === habit.id && item.count > 0)
          .map((item) => item.checkin_date.slice(0, 10)),
      ),
    [habit.id, recentCheckins],
  )
  const gridDays = useMemo(() => lastTwelveWeekDays(), [])

  return (
    <Card className={`relative overflow-hidden transition-all ${!habit.is_active ? "opacity-60" : ""}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ background: habit.color }} />
      <CardContent className="pl-5 pt-4 pb-4">
        <div className="flex items-start gap-3">
          {/* Check button */}
          <button
            className={`mt-0.5 h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
              done
                ? "border-transparent text-white"
                : "border-border hover:border-primary"
            }`}
            style={done ? { background: habit.color } : {}}
            onClick={() => onCheckin(habit, done ? 0 : (habit.target_count > 1 ? count + 1 : 1))}
            title={done ? "Unmark" : "Mark complete"}
          >
            {done && <Check className="h-3 w-3" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-sm font-medium leading-tight ${done ? "line-through text-muted-foreground" : ""}`}>
                  {habit.name}
                </p>
                {habit.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{habit.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!habit.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                {!due && habit.is_active && <Badge variant="outline" className="text-xs">Not today</Badge>}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(habit)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(habit.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {stats && stats.current_streak > 0 && (
                <span className="flex items-center gap-1 text-orange-500 font-medium">
                  <Flame className="h-3 w-3" />
                  {streakLabel(stats.current_streak)}
                </span>
              )}
              {habit.target_count > 1 && (
                <span>
                  {count}/{habit.target_count} today
                </span>
              )}
              {stats && (
                <span>{stats.completion_week}% this week</span>
              )}
              {habit.life_area_name && (
                <span
                  className="rounded px-1.5 py-0.5 text-white text-xs"
                  style={{ background: habit.life_area_color || "#666" }}
                >
                  {habit.life_area_name}
                </span>
              )}
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Last 12 weeks</span>
                <span>{stats?.completion_month ?? 0}% last 30 days</span>
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1">
                {gridDays.map((date) => {
                  const key = dateString(date)
                  const filled = completionDates.has(key)

                  return (
                    <div
                      key={key}
                      title={`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${filled ? "completed" : "not checked in"}`}
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border/60"
                      style={filled ? { background: habit.color, borderColor: habit.color } : undefined}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Routine Card ──────────────────────────────────────────────────────────────

function RoutineCard({
  routine,
  habits,
  onEdit,
  onDelete,
}: {
  routine: Routine
  habits: Habit[]
  onEdit: (routine: Routine) => void
  onDelete: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const totalMinutes = routine.steps.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const icon = routine.routine_type === "morning" ? <Sunrise className="h-4 w-4" /> : routine.routine_type === "evening" ? <Sunset className="h-4 w-4" /> : <Star className="h-4 w-4" />
  const typeLabel = routine.routine_type === "morning" ? "Morning" : routine.routine_type === "evening" ? "Evening" : "Custom"

  return (
    <Card className={!routine.is_active ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <div>
              <CardTitle className="text-base">{routine.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                {totalMinutes > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {totalMinutes} min
                  </span>
                )}
                {!routine.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(routine)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(routine.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {routine.steps.length > 0 && (
        <CardContent className="pt-0">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {routine.steps.length} step{routine.steps.length !== 1 ? "s" : ""}
          </button>
          {expanded && (
            <ol className="space-y-1">
              {routine.steps.map((step, i) => {
                const linkedHabit = step.habit_id ? habits.find((h) => h.id === step.habit_id) : null
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-xs text-muted-foreground mt-0.5 w-5 shrink-0">{i + 1}.</span>
                    <span className={linkedHabit ? "font-medium" : ""}>{step.title}</span>
                    {step.duration_minutes && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">{step.duration_minutes}m</span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HabitsPage() {
  const searchParams = useSearchParams()
  const lifeAreaFilter = searchParams.get("life_area_id")
  const [habits, setHabits] = useState<Habit[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([])
  const [stats, setStats] = useState<Record<string, HabitStats>>({})
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [today] = useState(todayString)

  const [showHabitForm, setShowHabitForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [showRoutineForm, setShowRoutineForm] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [habitsRes, routinesRes, checkinsRes, recentCheckinsRes, lifeAreasRes] = await Promise.all([
        fetch(lifeAreaFilter ? `/api/habits?life_area_id=${encodeURIComponent(lifeAreaFilter)}` : "/api/habits"),
        fetch("/api/routines"),
        fetch(`/api/habits/checkins?date=${today}`),
        fetch("/api/habits/checkins"),
        fetch("/api/life-areas"),
      ])

      if (!habitsRes.ok || !routinesRes.ok || !checkinsRes.ok) throw new Error("Fetch failed")

      const [habitsData, routinesData, checkinsData, recentCheckinsData] = await Promise.all([
        habitsRes.json(),
        routinesRes.json(),
        checkinsRes.json(),
        recentCheckinsRes.ok ? recentCheckinsRes.json() : Promise.resolve({ checkins: [] }),
      ])

      setHabits(Array.isArray(habitsData) ? habitsData : [])
      setRoutines(Array.isArray(routinesData) ? routinesData : [])
      setCheckins(Array.isArray(checkinsData.checkins) ? checkinsData.checkins : [])
      setRecentCheckins(Array.isArray(recentCheckinsData.checkins) ? recentCheckinsData.checkins : [])
      setStats(checkinsData.stats && typeof checkinsData.stats === "object" ? checkinsData.stats : {})

      if (lifeAreasRes.ok) {
        const laData = await lifeAreasRes.json()
        setLifeAreas(Array.isArray(laData) ? laData.map((a: Record<string, unknown>) => normalizeLifeArea(a)) : [])
      }
    } catch {
      setError("Failed to load habits. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [lifeAreaFilter, today])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: re-runs when lifeAreaFilter
    // changes, and fetchAll is also shared with checkin/mutation handlers
    // that need the reload afterward too.
    fetchAll()
  }, [fetchAll])

  async function handleCheckin(habit: Habit, count: number) {
    const prev = checkins.find((c) => c.habit_id === habit.id)
    // Optimistic update
    if (count === 0) {
      setCheckins((cs) => cs.filter((c) => c.habit_id !== habit.id))
      setRecentCheckins((cs) => cs.filter((c) => !(c.habit_id === habit.id && c.checkin_date.slice(0, 10) === today)))
    } else {
      setCheckins((cs) => {
        const next = cs.filter((c) => c.habit_id !== habit.id)
        return [...next, { habit_id: habit.id, checkin_date: today, count }]
      })
      setRecentCheckins((cs) => {
        const next = cs.filter((c) => !(c.habit_id === habit.id && c.checkin_date.slice(0, 10) === today))
        return [{ habit_id: habit.id, checkin_date: today, count }, ...next]
      })
    }

    try {
      await fetch("/api/habits/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habit.id, checkin_date: today, count }),
      })
      // Refresh stats after checkin
      const res = await fetch(`/api/habits/checkins?date=${today}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || {})
      }
      const recentRes = await fetch("/api/habits/checkins")
      if (recentRes.ok) {
        const data = await recentRes.json()
        setRecentCheckins(Array.isArray(data.checkins) ? data.checkins : [])
      }
    } catch {
      // Revert optimistic update
      if (prev) {
        setCheckins((cs) => [...cs.filter((c) => c.habit_id !== habit.id), prev])
      } else {
        setCheckins((cs) => cs.filter((c) => c.habit_id !== habit.id))
      }
    }
  }

  async function handleSaveHabit(data: HabitFormData) {
    setSaving(true)
    try {
      const body = {
        ...data,
        life_area_id: data.life_area_id || null,
        reminder_time: data.reminder_time || null,
      }
      const method = editingHabit ? "PUT" : "POST"
      const payload = editingHabit ? { ...body, id: editingHabit.id } : body

      const res = await fetch("/api/habits", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Save failed")

      setShowHabitForm(false)
      setEditingHabit(null)
      await fetchAll()
    } catch {
      alert("Failed to save habit.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHabit(id: number) {
    if (!confirm("Delete this habit and all its check-ins?")) return
    try {
      await fetch("/api/habits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setHabits((hs) => hs.filter((h) => h.id !== id))
      setCheckins((cs) => cs.filter((c) => c.habit_id !== id))
    } catch {
      alert("Failed to delete habit.")
    }
  }

  async function handleSaveRoutine(data: RoutineFormData) {
    setSaving(true)
    try {
      const steps = data.steps
        .filter((s) => s.title.trim() || s.habit_id)
        .map((s, i) => ({
          step_type: s.step_type,
          habit_id: s.habit_id ? Number(s.habit_id) : null,
          title: s.title.trim() || habits.find((h) => String(h.id) === s.habit_id)?.name || "",
          description: null,
          duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
          sort_order: i,
        }))

      const body = { ...data, steps }
      const method = editingRoutine ? "PUT" : "POST"
      const payload = editingRoutine ? { ...body, id: editingRoutine.id } : body

      const res = await fetch("/api/routines", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Save failed")

      setShowRoutineForm(false)
      setEditingRoutine(null)
      await fetchAll()
    } catch {
      alert("Failed to save routine.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRoutine(id: number) {
    if (!confirm("Delete this routine?")) return
    try {
      await fetch("/api/routines", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setRoutines((rs) => rs.filter((r) => r.id !== id))
    } catch {
      alert("Failed to delete routine.")
    }
  }

  const todayHabits = habits.filter(isDueToday)
  const completedToday = todayHabits.filter((h) => {
    const c = checkins.find((c) => c.habit_id === h.id)
    return (c?.count ?? 0) >= h.target_count
  })
  const totalStreak = Object.values(stats).reduce((sum, s) => sum + s.current_streak, 0)

  function editHabitInitial(h: Habit): HabitFormData {
    return {
      name: h.name,
      description: h.description || "",
      frequency: h.frequency,
      custom_days: h.custom_days || [],
      target_count: h.target_count,
      reminder_time: h.reminder_time || "",
      life_area_id: h.life_area_id ? String(h.life_area_id) : "",
      is_active: h.is_active,
      color: h.color || "#2563EB",
    }
  }

  function editRoutineInitial(r: Routine): RoutineFormData {
    return {
      name: r.name,
      description: r.description || "",
      routine_type: r.routine_type,
      is_active: r.is_active,
      steps: (r.steps || []).map((s) => ({
        step_type: s.step_type,
        habit_id: s.habit_id ? String(s.habit_id) : "",
        title: s.title,
        duration_minutes: s.duration_minutes ? String(s.duration_minutes) : "",
      })),
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Habits & Routines</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build consistency with tracked habits and structured routines.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchAll} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary cards */}
        {!loading && habits.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-foreground">{completedToday.length}/{todayHabits.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Done today</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                  <Flame className="h-5 w-5" />
                  {totalStreak}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total streak days</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-foreground">{habits.filter((h) => h.is_active).length}</p>
                <p className="text-xs text-muted-foreground mt-1">Active habits</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-foreground">{routines.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Routines</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="habits">
          <TabsList>
            <TabsTrigger value="habits" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Habits
            </TabsTrigger>
            <TabsTrigger value="routines" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Routines
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart2 className="h-4 w-4" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* ── Habits Tab ─── */}
          <TabsContent value="habits" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">My Habits</h2>
              <Button size="sm" onClick={() => { setEditingHabit(null); setShowHabitForm(true) }}>
                <Plus className="h-4 w-4 mr-1" /> New Habit
              </Button>
            </div>

            {showHabitForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{editingHabit ? "Edit Habit" : "New Habit"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <HabitForm
                    initial={editingHabit ? editHabitInitial(editingHabit) : undefined}
                    lifeAreas={lifeAreas}
                    onSave={handleSaveHabit}
                    onCancel={() => { setShowHabitForm(false); setEditingHabit(null) }}
                    saving={saving}
                  />
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : habits.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-medium text-foreground">No habits yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Start building a consistent routine by adding your first habit.
                  </p>
                  <Button onClick={() => { setEditingHabit(null); setShowHabitForm(true) }}>
                    <Plus className="h-4 w-4 mr-1" /> Add your first habit
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Due today */}
                {todayHabits.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Due today</p>
                    <div className="space-y-2">
                      {todayHabits.map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          checkin={checkins.find((c) => c.habit_id === h.id)}
                          stats={stats[h.id]}
                          onCheckin={handleCheckin}
                          onEdit={(h) => { setEditingHabit(h); setShowHabitForm(true) }}
                          onDelete={handleDeleteHabit}
                          recentCheckins={recentCheckins}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Remaining active habits not due today */}
                {habits.filter((h) => h.is_active && !isDueToday(h)).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Other active</p>
                    <div className="space-y-2">
                      {habits.filter((h) => h.is_active && !isDueToday(h)).map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          checkin={checkins.find((c) => c.habit_id === h.id)}
                          stats={stats[h.id]}
                          onCheckin={handleCheckin}
                          onEdit={(h) => { setEditingHabit(h); setShowHabitForm(true) }}
                          onDelete={handleDeleteHabit}
                          recentCheckins={recentCheckins}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Inactive */}
                {habits.filter((h) => !h.is_active).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Inactive</p>
                    <div className="space-y-2">
                      {habits.filter((h) => !h.is_active).map((h) => (
                        <HabitCard
                          key={h.id}
                          habit={h}
                          checkin={checkins.find((c) => c.habit_id === h.id)}
                          stats={stats[h.id]}
                          onCheckin={handleCheckin}
                          onEdit={(h) => { setEditingHabit(h); setShowHabitForm(true) }}
                          onDelete={handleDeleteHabit}
                          recentCheckins={recentCheckins}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Routines Tab ─── */}
          <TabsContent value="routines" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">My Routines</h2>
              <Button size="sm" onClick={() => { setEditingRoutine(null); setShowRoutineForm(true) }}>
                <Plus className="h-4 w-4 mr-1" /> New Routine
              </Button>
            </div>

            {showRoutineForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{editingRoutine ? "Edit Routine" : "New Routine"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RoutineForm
                    initial={editingRoutine ? editRoutineInitial(editingRoutine) : undefined}
                    habits={habits}
                    onSave={handleSaveRoutine}
                    onCancel={() => { setShowRoutineForm(false); setEditingRoutine(null) }}
                    saving={saving}
                  />
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : routines.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-medium text-foreground">No routines yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Routines are ordered sequences of habits and tasks. Create one to structure your morning or evening.
                  </p>
                  <Button onClick={() => { setEditingRoutine(null); setShowRoutineForm(true) }}>
                    <Plus className="h-4 w-4 mr-1" /> Create a routine
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {routines.map((r) => (
                  <RoutineCard
                    key={r.id}
                    routine={r}
                    habits={habits}
                    onEdit={(r) => { setEditingRoutine(r); setShowRoutineForm(true) }}
                    onDelete={handleDeleteRoutine}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Stats Tab ─── */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            <h2 className="text-base font-semibold">Habit Statistics</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : habits.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Add habits to see statistics.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {habits.filter((h) => h.is_active).map((h) => {
                  const s = stats[h.id]
                  return (
                    <Card key={h.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                            style={{ background: h.color }}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{h.name}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                              <div className="text-center">
                                <p className="text-lg font-bold text-orange-500 flex items-center justify-center gap-1">
                                  <Flame className="h-4 w-4" />
                                  {s?.current_streak ?? 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Current streak</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold">{s?.best_streak ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Best streak</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold">{s?.completion_week ?? 0}%</p>
                                <p className="text-xs text-muted-foreground">This week</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold">{s?.completion_month ?? 0}%</p>
                                <p className="text-xs text-muted-foreground">This month</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
