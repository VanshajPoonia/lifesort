"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Cake,
  CalendarCheck,
  CheckSquare,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  FolderPlus,
  Heart,
  Inbox,
  ListTodo,
  NotebookText,
  PiggyBank,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  History,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { LifeAreaIcon } from "@/components/life-area-controls"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"

type DashboardApiKey = "tasks" | "goals" | "notes" | "budget" | "investments" | "wishlist" | "income" | "projects"
type DashboardErrorKey = DashboardApiKey | "today" | "review"

interface Task {
  id: number | string
  title: string
  description?: string | null
  completed?: boolean
  priority?: string | null
  due_date?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Goal {
  id: number | string
  title: string
  description?: string | null
  category?: string | null
  progress?: number | string | null
  status?: string | null
  target_date?: string | null
  deadline?: string | null
  target_value?: number | string | null
  current_value?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Note {
  id: number | string
  title?: string | null
  content?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface BudgetCategory {
  id: number | string
  name?: string | null
  life_area_id?: string | number | null
}

interface BudgetTransaction {
  id: number | string
  type?: string | null
  amount?: number | string | null
  description?: string | null
  date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface BudgetData {
  categories?: BudgetCategory[]
  transactions?: BudgetTransaction[]
  goals?: unknown[]
  summary?: {
    income?: number | string | null
    expenses?: number | string | null
    balance?: number | string | null
  }
}

interface Investment {
  id: number | string
  name: string
  type?: string | null
  symbol?: string | null
  amount?: number | string | null
  current_value?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface WishlistItem {
  id: number | string
  title: string
  price?: number | string | null
  purchased?: boolean | null
  priority?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface IncomeSource {
  id: number | string
  name?: string | null
  source_name?: string | null
  type?: string | null
  category?: string | null
  amount?: number | string | null
  frequency?: string | null
  active?: boolean | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Project {
  id: number | string
  title: string
  description?: string | null
  status?: string | null
  priority?: string | null
  progress?: number | string | null
  due_date?: string | null
  item_count?: number | string | null
  next_action_count?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface InboxItem {
  id: number | string
  title: string
  raw_text?: string | null
  status?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface WaitingItem {
  id: number | string
  title: string
  waiting_on_name?: string | null
  status?: string | null
  expected_date?: string | null
  follow_up_date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface CommitmentItem {
  id: number | string
  title: string
  committed_to?: string | null
  status?: string | null
  due_date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface DashboardSources {
  tasks: Task[]
  goals: Goal[]
  notes: Note[]
  budget: BudgetData | null
  investments: Investment[]
  wishlist: WishlistItem[]
  income: IncomeSource[]
  projects: Project[]
}

interface ActivityItem {
  id: string
  title: string
  label: string
  href: string
  type: string
  at: string
  life_area_id?: string | number | null
}

interface TodayPlanPreview {
  summary?: {
    focusItems?: number
    dueOrOverdueTasks?: number
    calendarToday?: number
  }
}

interface WeeklyReviewPreview {
  review?: {
    id?: string | null
    week_start?: string
    week_end?: string
    updated_at?: string | null
  }
  summary?: {
    tasks?: { completed?: number; overdue?: number }
    goals?: { progressed?: number }
    habits?: { completed_checkins?: number }
    projects?: { updated?: number }
  }
}

const emptySources: DashboardSources = {
  tasks: [],
  goals: [],
  notes: [],
  budget: null,
  investments: [],
  wishlist: [],
  income: [],
  projects: [],
}

const apiEndpoints: Record<DashboardApiKey, string> = {
  tasks: "/api/tasks",
  goals: "/api/goals",
  notes: "/api/notes",
  budget: "/api/budget",
  investments: "/api/investments",
  wishlist: "/api/wishlist",
  income: "/api/income",
  projects: "/api/projects",
}

const quickActions = [
  { title: "Capture inbox", href: "/inbox", icon: Inbox },
  { title: "Track waiting", href: "/waiting", icon: Clock },
  { title: "Add commitment", href: "/commitments", icon: ClipboardCheck },
  { title: "Add task", href: "/tasks", icon: ListTodo },
  { title: "Add goal", href: "/goals", icon: Target },
  { title: "Add project", href: "/projects", icon: FolderPlus },
  { title: "Write note", href: "/notes", icon: NotebookText },
  { title: "Track budget", href: "/budget", icon: Wallet },
  { title: "Add wishlist", href: "/wishlist", icon: Heart },
  { title: "Track investment", href: "/investments", icon: TrendingUp },
]

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return "Recently"
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function isDueWithinDays(task: Task, days: number) {
  const date = parseDate(task.due_date)
  if (!date) return false
  const today = startOfToday()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + days)
  return date <= limit && (!task.completed || date >= today)
}

function waitingItemIsActive(item: WaitingItem) {
  return item.status === "waiting" || item.status === "follow_up_needed"
}

function waitingFollowUpDue(item: WaitingItem) {
  const date = parseDate(item.follow_up_date)
  return waitingItemIsActive(item) && Boolean(date && date <= startOfToday())
}

function waitingOverdue(item: WaitingItem) {
  const date = parseDate(item.expected_date)
  return waitingItemIsActive(item) && Boolean(date && date < startOfToday())
}

function commitmentIsActive(item: CommitmentItem) {
  return item.status === "open" || item.status === "at_risk"
}

function commitmentDueSoon(item: CommitmentItem) {
  const date = parseDate(item.due_date)
  if (!commitmentIsActive(item) || !date) return false
  const today = startOfToday()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 7)
  return date >= today && date <= limit
}

function sortByDueDate<T extends { date: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function getGoalDate(goal: Goal) {
  return goal.target_date || goal.deadline || null
}

function getGoalProgress(goal: Goal) {
  const explicitProgress = toNumber(goal.progress)
  const targetValue = toNumber(goal.target_value)
  const currentValue = toNumber(goal.current_value)
  if (targetValue > 0) return Math.min(100, Math.round((currentValue / targetValue) * 100))
  return Math.min(100, Math.max(0, Math.round(explicitProgress)))
}

function monthlyIncomeForSource(source: IncomeSource) {
  if (source.active === false) return 0
  const amount = toNumber(source.amount)
  switch (source.frequency) {
    case "weekly":
      return amount * 4
    case "bi-weekly":
      return amount * 2
    case "quarterly":
      return amount / 3
    case "yearly":
      return amount / 12
    case "monthly":
    default:
      return amount
  }
}

function getTimestamp(item: { updated_at?: string | null; created_at?: string | null }) {
  return item.updated_at || item.created_at || ""
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

async function fetchJson<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { data: null, error: `Could not load ${url.replace("/api/", "")}` }
    }
    return { data: (await response.json()) as T, error: null }
  } catch (error) {
    console.error(`Dashboard fetch failed for ${url}:`, error)
    return { data: null, error: `Could not load ${url.replace("/api/", "")}` }
  }
}

function LoadingCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  )
}

function SectionUnavailable({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>{label} could not be loaded.</span>
      </div>
    </div>
  )
}

function EmptyState({
  children,
  actionHref,
  actionLabel,
}: {
  children: React.ReactNode
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p>{children}</p>
      {actionHref && actionLabel && (
        <Button asChild variant="link" className="mt-2 h-auto p-0 text-sm">
          <Link href={actionHref}>
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  )
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [sources, setSources] = useState<DashboardSources>(emptySources)
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [todayPreview, setTodayPreview] = useState<TodayPlanPreview | null>(null)
  const [weeklyReviewPreview, setWeeklyReviewPreview] = useState<WeeklyReviewPreview | null>(null)
  const [habitsToday, setHabitsToday] = useState<{ total: number; done: number; streak: number } | null>(null)
  const [peopleWidget, setPeopleWidget] = useState<{ birthdays: number; followUps: number; total: number } | null>(null)
  const [vaultWidget, setVaultWidget] = useState<{ expiringSoon: number; total: number } | null>(null)
  const [inboxWidget, setInboxWidget] = useState<{ total: number; recent: InboxItem[] } | null>(null)
  const [waitingWidget, setWaitingWidget] = useState<{ followUpsDue: number; overdue: number; recent: WaitingItem[] } | null>(null)
  const [commitmentsWidget, setCommitmentsWidget] = useState<{ dueSoon: number; atRisk: number; recent: CommitmentItem[] } | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<DashboardErrorKey, string>>>({})
  const [milestones, setMilestones] = useState<Array<{ id: string; label: string; title: string; occurred_at: string }>>([])
  const [milestonesLoading, setMilestonesLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      checkOnboarding()
      fetchDashboard()
      fetch("/api/timeline?limit=5")
        .then((r) => r.ok ? r.json() : { events: [] })
        .then((d) => setMilestones(d.events ?? []))
        .catch(() => {})
        .finally(() => setMilestonesLoading(false))
    }
  }, [user, loading, router])

  const checkOnboarding = async () => {
    try {
      if (sessionStorage.getItem("onboarding_completed") === "true") return

      const response = await fetch("/api/onboarding")
      if (!response.ok) return

      const data = await response.json()
      if (data.onboarding_completed === false) {
        setShowOnboarding(true)
      } else {
        sessionStorage.setItem("onboarding_completed", "true")
      }
    } catch (error) {
      console.error("Error checking onboarding:", error)
    }
  }

  const fetchDashboard = async () => {
    setDashboardLoading(true)
    const planDate = localDateString()
    const [tasks, goals, notes, budget, investments, wishlist, income, projects, lifeAreasResult, todayPlan, weeklyReview] = await Promise.all([
      fetchJson<Task[]>(apiEndpoints.tasks),
      fetchJson<Goal[]>(apiEndpoints.goals),
      fetchJson<Note[]>(apiEndpoints.notes),
      fetchJson<BudgetData>(apiEndpoints.budget),
      fetchJson<Investment[]>(apiEndpoints.investments),
      fetchJson<WishlistItem[]>(apiEndpoints.wishlist),
      fetchJson<IncomeSource[]>(apiEndpoints.income),
      fetchJson<Project[]>(apiEndpoints.projects),
      fetchJson<LifeArea[]>("/api/life-areas"),
      fetchJson<TodayPlanPreview>(`/api/today-plan?date=${planDate}`),
      fetchJson<WeeklyReviewPreview>(`/api/weekly-review?date=${planDate}`),
    ])

    // Habits widget — fetch independently so failures don't block the rest
    try {
      const [habitsRes, checkinsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch(`/api/habits/checkins?date=${planDate}`),
      ])
      if (habitsRes.ok && checkinsRes.ok) {
        type RawHabit = { id: number; is_active: boolean; frequency: string; custom_days: number[]; target_count: number }
        type RawCheckin = { habit_id: number; count: number }
        type RawCheckinData = { checkins: RawCheckin[]; stats: Record<string, { current_streak: number }> }
        const habitsData: RawHabit[] = await habitsRes.json()
        const checkinsData: RawCheckinData = await checkinsRes.json()

        const today = new Date().getDay()
        const activeHabits = habitsData.filter((h: RawHabit) => {
          if (!h.is_active) return false
          if (h.frequency === "daily") return true
          if (h.frequency === "weekly") return true
          if (h.frequency === "custom") return (h.custom_days || []).includes(today)
          return false
        })
        const checkinMap = new Map((checkinsData.checkins || []).map((c: RawCheckin) => [c.habit_id, c.count]))
        const done = activeHabits.filter((h: RawHabit) => (checkinMap.get(h.id) ?? 0) >= h.target_count).length
        const streak = Object.values(checkinsData.stats || {}).reduce((sum: number, s: { current_streak: number }) => sum + s.current_streak, 0)
        setHabitsToday({ total: activeHabits.length, done, streak })
      }
    } catch {
      // Habits widget failure is non-fatal
    }

    // People widget — fetch independently, fails silently
    try {
      const [peopleRes, remindersRes] = await Promise.all([
        fetch("/api/people"),
        fetch("/api/people/reminders?upcoming=true"),
      ])
      if (peopleRes.ok && remindersRes.ok) {
        type RawPerson = { birthday: string | null }
        type RawReminder = { reminder_type: string }
        const peopleData: RawPerson[] = await peopleRes.json()
        const remindersData: RawReminder[] = await remindersRes.json()
        const today2 = new Date()
        today2.setHours(0, 0, 0, 0)
        const birthdays = peopleData.filter((p) => {
          if (!p.birthday) return false
          const bday = new Date(p.birthday)
          const next = new Date(today2.getFullYear(), bday.getMonth(), bday.getDate())
          if (next < today2) next.setFullYear(today2.getFullYear() + 1)
          const days = Math.ceil((next.getTime() - today2.getTime()) / 86400000)
          return days <= 30
        }).length
        const followUps = remindersData.filter((r) => r.reminder_type === "follow_up").length
        setPeopleWidget({ birthdays, followUps, total: peopleData.length })
      }
    } catch {
      // People widget failure is non-fatal
    }

    // Vault widget — fetch independently, fails silently
    try {
      const vaultRes = await fetch("/api/vault")
      if (vaultRes.ok) {
        type RawVaultItem = { expiry_date: string | null }
        const vaultData: RawVaultItem[] = await vaultRes.json()
        const todayMs = new Date().setHours(0, 0, 0, 0)
        const expiringSoon = vaultData.filter((item) => {
          if (!item.expiry_date) return false
          const d = new Date(item.expiry_date + "T00:00:00")
          const days = Math.ceil((d.getTime() - todayMs) / 86400000)
          return days >= 0 && days <= 30
        }).length
        setVaultWidget({ expiringSoon, total: vaultData.length })
      }
    } catch {
      // Vault widget failure is non-fatal
    }

    // Inbox widget — fetch independently, fails silently
    try {
      const inboxRes = await fetch("/api/inbox?status=unsorted&limit=100")
      if (inboxRes.ok) {
        const inboxData: InboxItem[] = await inboxRes.json()
        setInboxWidget({ total: inboxData.length, recent: inboxData.slice(0, 3) })
      }
    } catch {
      // Inbox widget failure is non-fatal
    }

    // Waiting For widget — fetch independently, fails silently
    try {
      const waitingRes = await fetch("/api/waiting?view=all&limit=100")
      if (waitingRes.ok) {
        const waitingData: WaitingItem[] = await waitingRes.json()
        const activeWaiting = waitingData.filter(waitingItemIsActive)
        setWaitingWidget({
          followUpsDue: waitingData.filter(waitingFollowUpDue).length,
          overdue: waitingData.filter(waitingOverdue).length,
          recent: activeWaiting.slice(0, 3),
        })
      }
    } catch {
      // Waiting For widget failure is non-fatal
    }

    // Commitments widget — fetch independently, fails silently
    try {
      const commitmentsRes = await fetch("/api/commitments?view=all&limit=100")
      if (commitmentsRes.ok) {
        const commitmentsData: CommitmentItem[] = await commitmentsRes.json()
        const activeCommitments = commitmentsData.filter(commitmentIsActive)
        setCommitmentsWidget({
          dueSoon: commitmentsData.filter(commitmentDueSoon).length,
          atRisk: commitmentsData.filter((item) => item.status === "at_risk").length,
          recent: activeCommitments.slice(0, 3),
        })
      }
    } catch {
      // Commitments widget failure is non-fatal
    }

    setSources({
      tasks: normalizeArray<Task>(tasks.data),
      goals: normalizeArray<Goal>(goals.data),
      notes: normalizeArray<Note>(notes.data),
      budget: budget.data,
      investments: normalizeArray<Investment>(investments.data),
      wishlist: normalizeArray<WishlistItem>(wishlist.data),
      income: normalizeArray<IncomeSource>(income.data),
      projects: normalizeArray<Project>(projects.data),
    })
    setLifeAreas(normalizeArray<LifeArea>(lifeAreasResult.data).map((area) => normalizeLifeArea(area as unknown as Record<string, unknown>)))
    setTodayPreview(todayPlan.data)
    setWeeklyReviewPreview(weeklyReview.data)
    setErrors({
      ...(tasks.error ? { tasks: tasks.error } : {}),
      ...(goals.error ? { goals: goals.error } : {}),
      ...(notes.error ? { notes: notes.error } : {}),
      ...(budget.error ? { budget: budget.error } : {}),
      ...(investments.error ? { investments: investments.error } : {}),
      ...(wishlist.error ? { wishlist: wishlist.error } : {}),
      ...(income.error ? { income: income.error } : {}),
      ...(projects.error ? { projects: projects.error } : {}),
      ...(todayPlan.error ? { today: todayPlan.error } : {}),
      ...(weeklyReview.error ? { review: weeklyReview.error } : {}),
    })
    setDashboardLoading(false)
  }

  // Must be before any early return — hooks cannot be called conditionally
  const lifeAreaBalance = useMemo(() => {
    const byId = new Map(lifeAreas.map((area) => [String(area.id), area]))
    const rows = new Map<string, {
      key: string
      area: LifeArea | null
      activeTasks: number
      activeGoals: number
      recentActivity: number
    }>()

    const ensure = (key: string) => {
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          area: key === "unassigned" ? null : byId.get(key) ?? null,
          activeTasks: 0,
          activeGoals: 0,
          recentActivity: 0,
        })
      }
      return rows.get(key)!
    }

    const keyFor = (value?: string | number | null) => {
      if (!value) return "unassigned"
      const key = String(value)
      return byId.has(key) ? key : "unassigned"
    }

    lifeAreas.forEach((area) => ensure(String(area.id)))
    sources.tasks.filter((task) => !task.completed).forEach((task) => {
      ensure(keyFor(task.life_area_id)).activeTasks += 1
    })
    sources.goals.filter((goal) => goal.status !== "completed").forEach((goal) => {
      ensure(keyFor(goal.life_area_id)).activeGoals += 1
    })
    const allItems = [
      ...sources.tasks, ...sources.goals, ...sources.notes,
      ...sources.wishlist, ...sources.investments, ...sources.income, ...sources.projects,
    ]
    allItems.slice(0, 12).forEach((item) => {
      ensure(keyFor(item.life_area_id)).recentActivity += 1
    })

    return Array.from(rows.values())
      .filter((row) => row.activeTasks > 0 || row.activeGoals > 0 || row.recentActivity > 0)
      .sort((a, b) => (b.activeTasks + b.activeGoals + b.recentActivity) - (a.activeTasks + a.activeGoals + a.recentActivity))
      .slice(0, 6)
  }, [lifeAreas, sources])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const firstName = user.name?.split(" ")[0] || "there"
  const activeGoals = sources.goals.filter((goal) => goal.status !== "completed")
  const completedGoals = sources.goals.length - activeGoals.length
  const dueSoonTasks = sources.tasks
    .filter((task) => isDueWithinDays(task, 3))
    .sort((a, b) => new Date(a.due_date || "").getTime() - new Date(b.due_date || "").getTime())
  const openDueSoonTasks = dueSoonTasks.filter((task) => !task.completed)
  const completedDueSoonTasks = dueSoonTasks.length - openDueSoonTasks.length
  const taskProgress = dueSoonTasks.length ? Math.round((completedDueSoonTasks / dueSoonTasks.length) * 100) : 0

  const goalProgress = sources.goals.length
    ? Math.round(sources.goals.reduce((total, goal) => total + getGoalProgress(goal), 0) / sources.goals.length)
    : 0
  const investmentTotal = sources.investments.reduce(
    (total, investment) => total + (toNumber(investment.current_value) || toNumber(investment.amount)),
    0,
  )
  const investmentBasis = sources.investments.reduce((total, investment) => total + toNumber(investment.amount), 0)
  const investmentGain = investmentTotal - investmentBasis
  const monthlyIncome = sources.income.reduce((total, source) => total + monthlyIncomeForSource(source), 0)
  const budgetSummary = sources.budget?.summary
  const budgetIncome = toNumber(budgetSummary?.income)
  const budgetExpenses = toNumber(budgetSummary?.expenses)
  const budgetBalance = toNumber(budgetSummary?.balance)
  const wishlistPurchased = sources.wishlist.filter((item) => item.purchased).length
  const wishlistOpen = sources.wishlist.filter((item) => !item.purchased)
  const wishlistOpenValue = wishlistOpen.reduce((total, item) => total + toNumber(item.price), 0)
  const wishlistTotalValue = sources.wishlist.reduce((total, item) => total + toNumber(item.price), 0)
  const wishlistProgress = sources.wishlist.length ? Math.round((wishlistPurchased / sources.wishlist.length) * 100) : 0
  const activeProjects = sources.projects.filter((project) => project.status === "active")
  const overdueProjects = sources.projects.filter((project) => {
    if (!project.due_date || project.status === "completed" || project.status === "archived") return false
    const today = startOfToday()
    const due = parseDate(project.due_date)
    return Boolean(due && due < today)
  })
  const projectProgress = sources.projects.length
    ? Math.round(sources.projects.reduce((total, project) => total + toNumber(project.progress), 0) / sources.projects.length)
    : 0
  const projectNextActions = sources.projects.reduce((total, project) => total + toNumber(project.next_action_count), 0)

  const upcomingDeadlines = sortByDueDate([
    ...activeGoals
      .filter((goal) => getGoalDate(goal))
      .map((goal) => ({
        id: `goal-${goal.id}`,
        title: goal.title,
        type: "Goal",
        date: getGoalDate(goal) || "",
        href: "/goals",
      })),
    ...openDueSoonTasks
      .filter((task) => task.due_date)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        type: "Task",
        date: task.due_date || "",
        href: "/tasks",
      })),
  ]).slice(0, 7)

  const recentNotes = [...sources.notes]
    .sort((a, b) => new Date(getTimestamp(b)).getTime() - new Date(getTimestamp(a)).getTime())
    .slice(0, 4)

  const recentActivityFull: ActivityItem[] = [
    ...sources.tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      label: task.completed ? "Completed task" : "Updated task",
      href: "/tasks",
      type: "Task",
      at: getTimestamp(task),
      life_area_id: task.life_area_id,
    })),
    ...sources.goals.map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.title,
      label: goal.status === "completed" ? "Completed goal" : "Updated goal",
      href: "/goals",
      type: "Goal",
      at: getTimestamp(goal),
      life_area_id: goal.life_area_id,
    })),
    ...sources.notes.map((note) => ({
      id: `note-${note.id}`,
      title: note.title || "Untitled note",
      label: "Updated note",
      href: "/notes",
      type: "Note",
      at: getTimestamp(note),
      life_area_id: note.life_area_id,
    })),
    ...sources.wishlist.map((item) => ({
      id: `wishlist-${item.id}`,
      title: item.title,
      label: item.purchased ? "Purchased wishlist item" : "Updated wishlist item",
      href: "/wishlist",
      type: "Wishlist",
      at: getTimestamp(item),
      life_area_id: item.life_area_id,
    })),
    ...sources.investments.map((investment) => ({
      id: `investment-${investment.id}`,
      title: investment.name,
      label: "Updated investment",
      href: "/investments",
      type: "Investment",
      at: getTimestamp(investment),
      life_area_id: investment.life_area_id,
    })),
    ...sources.income.map((source) => ({
      id: `income-${source.id}`,
      title: source.source_name || source.name || "Income source",
      label: "Updated income source",
      href: "/income",
      type: "Income",
      at: getTimestamp(source),
      life_area_id: source.life_area_id,
    })),
    ...sources.projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      label: project.status === "completed" ? "Completed project" : "Updated project",
      href: `/projects/${project.id}`,
      type: "Project",
      at: getTimestamp(project),
      life_area_id: project.life_area_id,
    })),
  ]
    .filter((activity) => activity.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const recentActivity = recentActivityFull.slice(0, 6)

  const hasAnyErrors = Object.keys(errors).length > 0
  const weeklyReviewSaved = Boolean(weeklyReviewPreview?.review?.id)
  const weeklyReviewActivity =
    toNumber(weeklyReviewPreview?.summary?.tasks?.completed) +
    toNumber(weeklyReviewPreview?.summary?.goals?.progressed) +
    toNumber(weeklyReviewPreview?.summary?.habits?.completed_checkins) +
    toNumber(weeklyReviewPreview?.summary?.projects?.updated)

  return (
    <DashboardLayout>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false)
          sessionStorage.setItem("onboarding_completed", "true")
          sessionStorage.removeItem("sidebar_prefs")
          fetchDashboard()
        }}
      />

      <div className="space-y-6">
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Today at a glance</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Welcome back, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your tasks, goals, notes, wishlist, and money summaries in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button asChild key={action.href} variant="outline" size="sm">
                <Link href={action.href} className="gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.title}
                </Link>
              </Button>
            ))}
          </div>
        </section>

        {hasAnyErrors && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Some dashboard sections could not load. No fallback numbers are being shown for failed data.</span>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardLoading ? (
            <>
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Due Soon
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errors.tasks ? (
                    <p className="text-sm text-muted-foreground">Unavailable</p>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {completedDueSoonTasks}/{dueSoonTasks.length}
                      </div>
                      <Progress value={taskProgress} className="mt-3 h-2" />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-primary" />
                    Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errors.goals ? (
                    <p className="text-sm text-muted-foreground">Unavailable</p>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {completedGoals}/{sources.goals.length}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{goalProgress}% average progress</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-primary" />
                    Monthly Income
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errors.income ? (
                    <p className="text-sm text-muted-foreground">Unavailable</p>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(monthlyIncome)}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{sources.income.length} active or saved sources</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {errors.investments ? (
                    <p className="text-sm text-muted-foreground">Unavailable</p>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(investmentTotal)}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{sources.investments.length} tracked investments</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  Today Plan
                </CardTitle>
                <CardDescription>Your daily focus, schedule, and reflection.</CardDescription>
              </div>
              <Button asChild size="sm" className="gap-2">
                <Link href="/today">
                  Open Today
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : errors.today ? (
              <SectionUnavailable label="Today Plan" />
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background/70 p-3">
                  <p className="text-2xl font-bold">{todayPreview?.summary?.focusItems || 0}/3</p>
                  <p className="text-xs text-muted-foreground">focus items selected</p>
                </div>
                <div className="rounded-md border bg-background/70 p-3">
                  <p className="text-2xl font-bold">{todayPreview?.summary?.dueOrOverdueTasks || 0}</p>
                  <p className="text-xs text-muted-foreground">due or overdue tasks</p>
                </div>
                <div className="rounded-md border bg-background/70 p-3">
                  <p className="text-2xl font-bold">{todayPreview?.summary?.calendarToday || 0}</p>
                  <p className="text-xs text-muted-foreground">calendar events today</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {inboxWidget !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-primary" />
                    Inbox
                  </CardTitle>
                  <CardDescription>Unsorted thoughts waiting to be turned into LifeSort items.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/inbox">
                    Open Inbox
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : inboxWidget.total === 0 ? (
                <EmptyState actionHref="/inbox" actionLabel="Capture something">
                  Your universal inbox is clear.
                </EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-2xl font-bold">{inboxWidget.total}</p>
                    <p className="text-xs text-muted-foreground">unsorted items</p>
                  </div>
                  <div className="space-y-2">
                    {inboxWidget.recent.map((item) => (
                      <Link
                        key={item.id}
                        href="/inbox"
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary"
                      >
                        <span className="min-w-0 truncate font-medium">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.updated_at || item.created_at)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {waitingWidget !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Waiting For
                  </CardTitle>
                  <CardDescription>Follow-ups, overdue replies, approvals, deliveries, and refunds.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/waiting">
                    Open Waiting
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : waitingWidget.followUpsDue === 0 && waitingWidget.overdue === 0 && waitingWidget.recent.length === 0 ? (
                <EmptyState actionHref="/waiting" actionLabel="Track something">
                  Nothing is waiting on your attention.
                </EmptyState>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[160px_160px_minmax(0,1fr)]">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-2xl font-bold">{waitingWidget.followUpsDue}</p>
                    <p className="text-xs text-muted-foreground">follow-ups due</p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-2xl font-bold">{waitingWidget.overdue}</p>
                    <p className="text-xs text-muted-foreground">overdue items</p>
                  </div>
                  <div className="space-y-2">
                    {waitingWidget.recent.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No active waiting items.</p>
                    ) : (
                      waitingWidget.recent.map((item) => (
                        <Link
                          key={item.id}
                          href="/waiting"
                          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              Waiting on {item.waiting_on_name || "someone"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.follow_up_date || item.expected_date || item.updated_at || item.created_at)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {commitmentsWidget !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Commitments
                  </CardTitle>
                  <CardDescription>Promises and obligations that need to stay visible.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/commitments">
                    Open Commitments
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : commitmentsWidget.dueSoon === 0 && commitmentsWidget.atRisk === 0 && commitmentsWidget.recent.length === 0 ? (
                <EmptyState actionHref="/commitments" actionLabel="Add commitment">
                  No active commitments are asking for attention.
                </EmptyState>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[160px_160px_minmax(0,1fr)]">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-2xl font-bold">{commitmentsWidget.dueSoon}</p>
                    <p className="text-xs text-muted-foreground">due soon</p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-2xl font-bold">{commitmentsWidget.atRisk}</p>
                    <p className="text-xs text-muted-foreground">at risk</p>
                  </div>
                  <div className="space-y-2">
                    {commitmentsWidget.recent.length === 0 ? (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No open or at-risk commitments.</p>
                    ) : (
                      commitmentsWidget.recent.map((item) => (
                        <Link
                          key={item.id}
                          href="/commitments"
                          className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              Committed to {item.committed_to || "someone"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.due_date || item.updated_at || item.created_at)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  Complete your weekly review
                </CardTitle>
                <CardDescription>Reflect on the week and choose next week&apos;s focus.</CardDescription>
              </div>
              <Button asChild size="sm" variant={weeklyReviewSaved ? "outline" : "default"} className="gap-2">
                <Link href="/review">
                  {weeklyReviewSaved ? "View review" : "Start review"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : errors.review ? (
              <SectionUnavailable label="Weekly Review" />
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{weeklyReviewSaved ? "Done" : "Open"}</p>
                  <p className="text-xs text-muted-foreground">current week status</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{weeklyReviewActivity}</p>
                  <p className="text-xs text-muted-foreground">tracked highlights</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{weeklyReviewPreview?.summary?.tasks?.overdue || 0}</p>
                  <p className="text-xs text-muted-foreground">overdue tasks</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderPlus className="h-5 w-5 text-primary" />
                  Projects
                </CardTitle>
                <CardDescription>Active projects, overdue deadlines, progress, and next actions.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href="/projects">
                  Open projects
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="grid gap-3 md:grid-cols-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : errors.projects ? (
              <SectionUnavailable label="Projects" />
            ) : sources.projects.length === 0 ? (
              <EmptyState actionHref="/projects" actionLabel="Create a project">
                Projects can group tasks, notes, goals, links, wishlist items, and budget records.
              </EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{activeProjects.length}</p>
                  <p className="text-xs text-muted-foreground">active projects</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{overdueProjects.length}</p>
                  <p className="text-xs text-muted-foreground">overdue</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{projectProgress}%</p>
                  <p className="text-xs text-muted-foreground">average progress</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-2xl font-bold">{projectNextActions}</p>
                  <p className="text-xs text-muted-foreground">next actions</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {habitsToday !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Habits Today
                  </CardTitle>
                  <CardDescription>Daily habit completion and streak progress.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/habits">
                    View habits
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{habitsToday.done}/{habitsToday.total}</p>
                  <p className="text-xs text-muted-foreground">Done today</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
                    <Flame className="h-5 w-5" />
                    {habitsToday.streak}
                  </p>
                  <p className="text-xs text-muted-foreground">Total streak</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">
                    {habitsToday.total > 0 ? Math.round((habitsToday.done / habitsToday.total) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {peopleWidget !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    People
                  </CardTitle>
                  <CardDescription>Upcoming birthdays and follow-up reminders.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/people">
                    View people
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{peopleWidget.total}</p>
                  <p className="text-xs text-muted-foreground">People tracked</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold text-pink-500 flex items-center justify-center gap-1">
                    <Cake className="h-5 w-5" />
                    {peopleWidget.birthdays}
                  </p>
                  <p className="text-xs text-muted-foreground">Birthdays this month</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{peopleWidget.followUps}</p>
                  <p className="text-xs text-muted-foreground">Follow-ups due</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {vaultWidget !== null && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Life Vault
                  </CardTitle>
                  <CardDescription>Important documents, subscriptions, and upcoming expirations.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/vault">
                    View vault
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{vaultWidget.total}</p>
                  <p className="text-xs text-muted-foreground">Items stored</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-center">
                  <p className={`text-2xl font-bold ${vaultWidget.expiringSoon > 0 ? "text-orange-500" : ""}`}>
                    {vaultWidget.expiringSoon}
                  </p>
                  <p className="text-xs text-muted-foreground">Expiring ≤30d</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Life Balance
                </CardTitle>
                <CardDescription>Active tasks, active goals, and recent activity grouped by area.</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href="/insights">
                  Open insights
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : lifeAreaBalance.length === 0 ? (
              <EmptyState actionHref="/life-areas" actionLabel="Manage life areas">
                Assign tasks, goals, or records to life areas to see balance here.
              </EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lifeAreaBalance.map((row) => (
                  <div key={row.key} className="rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-md"
                        style={{
                          backgroundColor: `${row.area?.color || "#64748B"}22`,
                          color: row.area?.color || "#64748B",
                        }}
                      >
                        <LifeAreaIcon name={row.area?.icon || "Circle"} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.area?.name || "Unassigned"}</p>
                        <p className="text-xs text-muted-foreground">{row.recentActivity} recent update{row.recentActivity !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/60 p-2">
                        <p className="text-lg font-semibold">{row.activeTasks}</p>
                        <p className="text-xs text-muted-foreground">Active tasks</p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2">
                        <p className="text-lg font-semibold">{row.activeGoals}</p>
                        <p className="text-xs text-muted-foreground">Active goals</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                Today's Tasks
              </CardTitle>
              <CardDescription>Incomplete tasks due today, overdue, or coming up soon.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : errors.tasks ? (
                <SectionUnavailable label="Tasks" />
              ) : openDueSoonTasks.length === 0 ? (
                <EmptyState actionHref="/tasks" actionLabel="Add a task">
                  No incomplete tasks are due soon.
                </EmptyState>
              ) : (
                openDueSoonTasks.slice(0, 6).map((task) => (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(task.due_date)}</p>
                    </div>
                    <Badge variant="outline">{task.priority || "medium"}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Goals & Deadlines
              </CardTitle>
              <CardDescription>Goal target dates and task due dates from your current data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : errors.tasks && errors.goals ? (
                <SectionUnavailable label="Deadlines" />
              ) : upcomingDeadlines.length === 0 ? (
                <EmptyState actionHref="/goals" actionLabel="Add a goal">
                  No upcoming goal or task deadlines yet.
                </EmptyState>
              ) : (
                upcomingDeadlines.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                    <Badge variant="outline">{formatDate(item.date)}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" />
                Budget Summary
              </CardTitle>
              <CardDescription>This month from budget entries and income sources.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </>
              ) : errors.budget && errors.income ? (
                <SectionUnavailable label="Budget" />
              ) : (
                <>
                  {errors.income ? (
                    <SectionUnavailable label="Income" />
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Income sources</span>
                      <span className="font-medium">{formatCurrency(monthlyIncome)}</span>
                    </div>
                  )}
                  {errors.budget ? (
                    <SectionUnavailable label="Budget entries" />
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget income</span>
                        <span className="font-medium">{formatCurrency(budgetIncome)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget expenses</span>
                        <span className="font-medium">{formatCurrency(budgetExpenses)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3 text-sm">
                        <span className="text-muted-foreground">Budget balance</span>
                        <span className="font-medium">{formatCurrency(budgetBalance)}</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Investment Summary
              </CardTitle>
              <CardDescription>Tracked value from your investments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-5 w-full" />
                </>
              ) : errors.investments ? (
                <SectionUnavailable label="Investments" />
              ) : sources.investments.length === 0 ? (
                <EmptyState actionHref="/investments" actionLabel="Add investment">
                  No investments are tracked yet.
                </EmptyState>
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(investmentTotal)}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost basis</span>
                    <span className="font-medium">{formatCurrency(investmentBasis)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gain/loss</span>
                    <span className="font-medium">{formatCurrency(investmentGain)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Wishlist Summary
              </CardTitle>
              <CardDescription>Open wants and purchased items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-3 w-full" />
                </>
              ) : errors.wishlist ? (
                <SectionUnavailable label="Wishlist" />
              ) : sources.wishlist.length === 0 ? (
                <EmptyState actionHref="/wishlist" actionLabel="Add wishlist item">
                  No wishlist items yet.
                </EmptyState>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-2xl font-bold">{formatCurrency(wishlistOpenValue)}</div>
                      <p className="text-sm text-muted-foreground">Open wishlist value</p>
                    </div>
                    <Badge variant="secondary">
                      {wishlistPurchased}/{sources.wishlist.length} bought
                    </Badge>
                  </div>
                  <Progress value={wishlistProgress} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total listed value</span>
                    <span className="font-medium">{formatCurrency(wishlistTotalValue)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Recent Notes
              </CardTitle>
              <CardDescription>Your latest saved thoughts and plans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : errors.notes ? (
                <SectionUnavailable label="Notes" />
              ) : recentNotes.length === 0 ? (
                <EmptyState actionHref="/notes" actionLabel="Write a note">
                  No notes yet.
                </EmptyState>
              ) : (
                recentNotes.map((note) => (
                  <Link key={note.id} href="/notes" className="block rounded-md border p-3 hover:bg-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium">{note.title || "Untitled"}</p>
                      {getTimestamp(note) && <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(getTimestamp(note))}</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{note.content || "Empty note"}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Recent Milestones
              </CardTitle>
              <CardDescription>Your latest life achievements and activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {milestonesLoading ? (
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
              ) : milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">Complete tasks and goals to see milestones here.</p>
              ) : (
                milestones.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(m.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))
              )}
              <Link href="/timeline" className="block pt-1">
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                  View Full Timeline →
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Real updates from your LifeSort modules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : errors.tasks && errors.goals && errors.notes && errors.wishlist && errors.investments && errors.income ? (
                <SectionUnavailable label="Activity" />
              ) : recentActivity.length === 0 ? (
                <EmptyState>No recent activity yet. Updates will appear here after you add or change items.</EmptyState>
              ) : (
                recentActivity.map((activity) => (
                  <Link key={activity.id} href={activity.href} className="block rounded-md border p-3 hover:bg-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.label} · {timeAgo(activity.at)}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
