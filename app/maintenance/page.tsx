"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Briefcase,
  Building2,
  Car,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Shield,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaBadge, LifeAreaSelect } from "@/components/life-area-controls"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { LifeArea } from "@/lib/life-areas"
import { denormalizedLifeArea, normalizeLifeArea } from "@/lib/life-areas"

type MaintenanceCategory = "home" | "vehicle" | "health" | "finance" | "digital" | "school" | "work" | "business" | "other"
type MaintenanceRecurrence = "weekly" | "monthly" | "quarterly" | "yearly" | "custom"
type MaintenanceStatus = "active" | "paused" | "completed"
type MaintenanceView = "all" | "upcoming" | "overdue" | "paused" | "completed" | "category"

type MaintenanceItem = {
  id: number
  title: string
  category: MaintenanceCategory
  recurrence: MaintenanceRecurrence
  custom_interval_days: number | null
  next_due_date: string | null
  last_completed_date: string | null
  reminder_days_before: number | null
  life_area_id: number | string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  vault_item_id: number | string | null
  vault_item_title?: string | null
  notes: string | null
  status: MaintenanceStatus
  is_overdue?: boolean
  is_upcoming?: boolean
  created_at?: string | null
  updated_at?: string | null
}

type VaultOption = {
  id: number | string
  title: string
  category?: string | null
}

type MaintenanceForm = {
  title: string
  category: MaintenanceCategory
  recurrence: MaintenanceRecurrence
  custom_interval_days: string
  next_due_date: string
  last_completed_date: string
  reminder_days_before: string
  life_area_id: string
  vault_item_id: string
  notes: string
  status: MaintenanceStatus
}

type TemplateItem = Omit<MaintenanceForm, "life_area_id" | "vault_item_id" | "last_completed_date" | "status">

const categoryOptions: Array<{ value: MaintenanceCategory; label: string; icon: typeof Wrench }> = [
  { value: "home", label: "Home", icon: Home },
  { value: "vehicle", label: "Vehicle", icon: Car },
  { value: "health", label: "Health", icon: HeartPulse },
  { value: "finance", label: "Finance", icon: Wallet },
  { value: "digital", label: "Digital", icon: Laptop },
  { value: "school", label: "School", icon: GraduationCap },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "business", label: "Business", icon: Building2 },
  { value: "other", label: "Other", icon: Wrench },
]

const recurrenceOptions: Array<{ value: MaintenanceRecurrence; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
]

const statusOptions: Array<{ value: MaintenanceStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
]

const viewOptions: Array<{ value: MaintenanceView; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "category", label: "By category" },
]

const emptyForm: MaintenanceForm = {
  title: "",
  category: "other",
  recurrence: "monthly",
  custom_interval_days: "30",
  next_due_date: "",
  last_completed_date: "",
  reminder_days_before: "7",
  life_area_id: "",
  vault_item_id: "",
  notes: "",
  status: "active",
}

function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const templateSets: Array<{ name: string; description: string; items: TemplateItem[] }> = [
  {
    name: "Home maintenance",
    description: "Quarterly and yearly home upkeep.",
    items: [
      { title: "Change HVAC filter", category: "home", recurrence: "quarterly", custom_interval_days: "90", next_due_date: localDate(14), reminder_days_before: "7", notes: "Check filter size before ordering." },
      { title: "Test smoke and carbon monoxide alarms", category: "home", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(7), reminder_days_before: "3", notes: "" },
      { title: "Review home maintenance list", category: "home", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(30), reminder_days_before: "14", notes: "" },
    ],
  },
  {
    name: "Vehicle maintenance",
    description: "Basic recurring vehicle care.",
    items: [
      { title: "Check tire pressure and fluids", category: "vehicle", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(7), reminder_days_before: "2", notes: "" },
      { title: "Schedule oil change", category: "vehicle", recurrence: "custom", custom_interval_days: "180", next_due_date: localDate(30), reminder_days_before: "14", notes: "Adjust interval for your car and mileage." },
      { title: "Renew vehicle registration", category: "vehicle", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(90), reminder_days_before: "30", notes: "" },
    ],
  },
  {
    name: "Health checkups",
    description: "Health admin and appointments.",
    items: [
      { title: "Book annual physical", category: "health", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(60), reminder_days_before: "30", notes: "" },
      { title: "Schedule dental cleaning", category: "health", recurrence: "custom", custom_interval_days: "180", next_due_date: localDate(45), reminder_days_before: "21", notes: "" },
      { title: "Review prescriptions and refills", category: "health", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(10), reminder_days_before: "5", notes: "" },
    ],
  },
  {
    name: "Digital subscriptions/domains",
    description: "Digital renewals and account cleanup.",
    items: [
      { title: "Review subscriptions", category: "digital", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(14), reminder_days_before: "5", notes: "Cancel anything no longer useful." },
      { title: "Renew domains and hosting", category: "digital", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(90), reminder_days_before: "30", notes: "" },
      { title: "Password manager/security review", category: "digital", recurrence: "quarterly", custom_interval_days: "90", next_due_date: localDate(30), reminder_days_before: "7", notes: "" },
    ],
  },
  {
    name: "Finance review",
    description: "Recurring finance hygiene.",
    items: [
      { title: "Monthly budget review", category: "finance", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(7), reminder_days_before: "3", notes: "" },
      { title: "Quarterly investment review", category: "finance", recurrence: "quarterly", custom_interval_days: "90", next_due_date: localDate(30), reminder_days_before: "10", notes: "" },
      { title: "Annual tax document check", category: "finance", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(120), reminder_days_before: "30", notes: "" },
    ],
  },
  {
    name: "School/admin deadlines",
    description: "School and paperwork check-ins.",
    items: [
      { title: "Check school admin portal", category: "school", recurrence: "weekly", custom_interval_days: "7", next_due_date: localDate(3), reminder_days_before: "1", notes: "" },
      { title: "Review forms and deadlines", category: "school", recurrence: "monthly", custom_interval_days: "30", next_due_date: localDate(14), reminder_days_before: "5", notes: "" },
      { title: "Renew school documents", category: "school", recurrence: "yearly", custom_interval_days: "365", next_due_date: localDate(90), reminder_days_before: "30", notes: "" },
    ],
  },
]

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function daysUntil(value?: string | null) {
  const date = parseDate(value)
  if (!date) return null
  const today = parseDate(localDate())!
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function formatDate(value?: string | null) {
  const date = parseDate(value)
  if (!date) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isActive(item: MaintenanceItem) {
  return item.status === "active"
}

function isOverdue(item: MaintenanceItem) {
  const days = daysUntil(item.next_due_date)
  return isActive(item) && days !== null && days < 0
}

function isUpcoming(item: MaintenanceItem) {
  const days = daysUntil(item.next_due_date)
  return isActive(item) && days !== null && days >= 0 && days <= 30
}

function formFromItem(item: MaintenanceItem): MaintenanceForm {
  return {
    title: item.title || "",
    category: item.category || "other",
    recurrence: item.recurrence || "monthly",
    custom_interval_days: item.custom_interval_days ? String(item.custom_interval_days) : "30",
    next_due_date: item.next_due_date ? String(item.next_due_date).slice(0, 10) : "",
    last_completed_date: item.last_completed_date ? String(item.last_completed_date).slice(0, 10) : "",
    reminder_days_before: item.reminder_days_before === null || item.reminder_days_before === undefined ? "7" : String(item.reminder_days_before),
    life_area_id: item.life_area_id ? String(item.life_area_id) : "",
    vault_item_id: item.vault_item_id ? String(item.vault_item_id) : "",
    notes: item.notes || "",
    status: item.status || "active",
  }
}

function payloadFromForm(form: MaintenanceForm) {
  return {
    title: form.title,
    category: form.category,
    recurrence: form.recurrence,
    custom_interval_days: form.recurrence === "custom" ? Number.parseInt(form.custom_interval_days || "30", 10) : null,
    next_due_date: form.next_due_date || null,
    last_completed_date: form.last_completed_date || null,
    reminder_days_before: Number.parseInt(form.reminder_days_before || "7", 10),
    life_area_id: form.life_area_id || null,
    vault_item_id: form.vault_item_id || null,
    notes: form.notes || null,
    status: form.status,
  }
}

function CategoryBadge({ category }: { category: MaintenanceCategory }) {
  const option = categoryOptions.find((item) => item.value === category) || categoryOptions[categoryOptions.length - 1]
  const Icon = option.icon
  return (
    <Badge variant="outline" className="gap-1.5">
      <Icon className="h-3.5 w-3.5" />
      {option.label}
    </Badge>
  )
}

function DueBadge({ item }: { item: MaintenanceItem }) {
  const days = daysUntil(item.next_due_date)
  if (days === null) return <Badge variant="outline">No due date</Badge>
  if (item.status !== "active") return <Badge variant="outline">{formatDate(item.next_due_date)}</Badge>
  if (days < 0) return <Badge variant="destructive">{Math.abs(days)}d overdue</Badge>
  if (days === 0) return <Badge>Due today</Badge>
  if (days <= 30) return <Badge variant="secondary">Due in {days}d</Badge>
  return <Badge variant="outline">{formatDate(item.next_due_date)}</Badge>
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [vaultItems, setVaultItems] = useState<VaultOption[]>([])
  const [vaultUnavailable, setVaultUnavailable] = useState(false)
  const [view, setView] = useState<MaintenanceView>("all")
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory>("home")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceItem | null>(null)
  const [form, setForm] = useState<MaintenanceForm>(emptyForm)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError("")
    try {
      const [itemsRes, areasRes, vaultRes] = await Promise.all([
        fetch("/api/maintenance?view=all&limit=200"),
        fetch("/api/life-areas"),
        fetch("/api/vault"),
      ])

      if (!itemsRes.ok) throw new Error("Failed to fetch maintenance items")
      const itemsData = (await itemsRes.json()) as MaintenanceItem[]
      setItems(itemsData)

      if (areasRes.ok) {
        const areasData = await areasRes.json()
        setLifeAreas(Array.isArray(areasData) ? areasData.map((area) => normalizeLifeArea(area as Record<string, unknown>)) : [])
      }

      if (vaultRes.ok) {
        const vaultData = (await vaultRes.json()) as VaultOption[]
        setVaultItems(Array.isArray(vaultData) ? vaultData : [])
        setVaultUnavailable(false)
      } else {
        setVaultUnavailable(true)
      }
    } catch (err) {
      console.error("[maintenance] load failed:", err)
      setError("Failed to load maintenance items. Apply the migration if this is the first time using Life Maintenance.")
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const active = items.filter(isActive)
    return {
      active: active.length,
      upcoming: items.filter(isUpcoming).length,
      overdue: items.filter(isOverdue).length,
      paused: items.filter((item) => item.status === "paused").length,
      completed: items.filter((item) => item.status === "completed").length,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (view === "upcoming" && !isUpcoming(item)) return false
      if (view === "overdue" && !isOverdue(item)) return false
      if (view === "paused" && item.status !== "paused") return false
      if (view === "completed" && item.status !== "completed") return false
      if (view === "category" && item.category !== categoryFilter) return false
      if (!query) return true
      return [
        item.title,
        item.category,
        item.recurrence,
        item.status,
        item.notes,
        item.life_area_name,
        item.vault_item_title,
      ].some((value) => String(value || "").toLowerCase().includes(query))
    })
  }, [categoryFilter, items, search, view])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, next_due_date: localDate(7) })
    setDialogOpen(true)
  }

  const openEdit = (item: MaintenanceItem) => {
    setEditing(item)
    setForm(formFromItem(item))
    setDialogOpen(true)
  }

  const saveItem = async () => {
    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/maintenance", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...payloadFromForm(form),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save maintenance item")

      if (editing) {
        setItems((current) => current.map((item) => (item.id === editing.id ? { ...item, ...data } : item)))
      } else {
        setItems((current) => [data, ...current])
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save maintenance item.")
    } finally {
      setSaving(false)
    }
  }

  const updateItem = async (item: MaintenanceItem, updates: Partial<MaintenanceItem>) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/maintenance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...updates }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update maintenance item")
      setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, ...data } : currentItem)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update maintenance item.")
    } finally {
      setSaving(false)
    }
  }

  const completeItem = async (item: MaintenanceItem) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/maintenance/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, completed_date: localDate() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to complete maintenance item")
      setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, ...data } : currentItem)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete maintenance item.")
    } finally {
      setSaving(false)
    }
  }

  const createTask = async (item: MaintenanceItem) => {
    if (!confirm(`Create a task from "${item.title}"?`)) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/maintenance/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create task")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task from maintenance item.")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item: MaintenanceItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/maintenance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete maintenance item")
      }
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete maintenance item.")
    } finally {
      setSaving(false)
    }
  }

  const applyTemplate = async (template: (typeof templateSets)[number]) => {
    if (!confirm(`Create ${template.items.length} starter items from "${template.name}"? You can edit them after creation.`)) return
    setSaving(true)
    setError("")
    try {
      const created: MaintenanceItem[] = []
      for (const item of template.items) {
        const response = await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...item,
            life_area_id: null,
            vault_item_id: null,
            last_completed_date: null,
            status: "active",
            custom_interval_days: item.recurrence === "custom" ? Number.parseInt(item.custom_interval_days, 10) : null,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `Failed to create ${item.title}`)
        created.push(data)
      }
      setItems((current) => [...created, ...current])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template items.")
    } finally {
      setSaving(false)
    }
  }

  const emptyMessage =
    search.trim() ? "No maintenance items match that search." :
    view === "upcoming" ? "Nothing is due in the next 30 days." :
    view === "overdue" ? "No overdue maintenance. Nice." :
    view === "paused" ? "No paused maintenance items." :
    view === "completed" ? "No completed maintenance items yet." :
    view === "category" ? `No ${titleCase(categoryFilter)} maintenance items yet.` :
    "No maintenance items yet."

  return (
    <DashboardLayout title="Life Maintenance" subtitle="Recurring renewals, checkups, repairs, reviews, and admin.">
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-3xl font-bold">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Upcoming</p>
              <p className="text-3xl font-bold">{stats.upcoming}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className={`text-3xl font-bold ${stats.overdue > 0 ? "text-destructive" : ""}`}>{stats.overdue}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Paused</p>
              <p className="text-3xl font-bold">{stats.paused}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Maintenance Items
                </CardTitle>
                <CardDescription>Track the recurring work that keeps life from quietly drifting.</CardDescription>
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={view === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setView(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[220px_1fr] lg:ml-auto lg:w-[520px]">
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as MaintenanceCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search maintenance..."
                  />
                </div>
              </div>
            </div>

            {vaultUnavailable && (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Vault links are unavailable until the Vault table/API is available.
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <Wrench className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">{emptyMessage}</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Add a recurring responsibility or use a starter template to make this useful quickly.
                </p>
                <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Add maintenance
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredItems.map((item) => {
                  const area = item.life_area_id
                    ? denormalizedLifeArea({
                        id: String(item.life_area_id),
                        name: item.life_area_name || "Life domain",
                        icon: item.life_area_icon,
                        color: item.life_area_color,
                      })
                    : null

                  return (
                    <Card key={item.id} className={isOverdue(item) ? "border-destructive/40" : undefined}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-lg font-semibold">{item.title}</h3>
                              <CategoryBadge category={item.category} />
                              <Badge variant="outline">{titleCase(item.recurrence)}</Badge>
                              <Badge variant={item.status === "active" ? "secondary" : "outline"}>{titleCase(item.status)}</Badge>
                              <DueBadge item={item} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <LifeAreaBadge area={area} />
                              {item.vault_item_title && (
                                <Badge variant="outline" className="gap-1.5">
                                  <Shield className="h-3.5 w-3.5" />
                                  {item.vault_item_title}
                                </Badge>
                              )}
                              <Badge variant="outline">Remind {item.reminder_days_before ?? 7}d before</Badge>
                              {item.last_completed_date && (
                                <Badge variant="outline">Last done {formatDate(item.last_completed_date)}</Badge>
                              )}
                            </div>
                            {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Button size="sm" variant="outline" onClick={() => completeItem(item)} disabled={saving || item.status === "completed"} className="gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Complete
                            </Button>
                            {item.status === "paused" ? (
                              <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "active" })} disabled={saving} className="gap-2">
                                <Play className="h-4 w-4" />
                                Resume
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "paused" })} disabled={saving} className="gap-2">
                                <Pause className="h-4 w-4" />
                                Pause
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => createTask(item)} disabled={saving}>
                              Make task
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(item)} disabled={saving}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteItem(item)} disabled={saving} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Starter Templates</CardTitle>
            <CardDescription>Create a small editable starter set, then adjust dates and notes for your real life.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templateSets.map((template) => (
              <div key={template.name} className="rounded-md border p-4">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                <Button size="sm" variant="outline" onClick={() => applyTemplate(template)} disabled={saving} className="mt-4">
                  Use template
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditing(null)
          setForm(emptyForm)
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit maintenance item" : "Add maintenance item"}</DialogTitle>
            <DialogDescription>Track the next due date and recurrence for a life maintenance responsibility.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="maintenance-title">Title</Label>
              <Input
                id="maintenance-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Renew passport, book checkup, review subscriptions..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as MaintenanceCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Recurrence</Label>
                <Select value={form.recurrence} onValueChange={(value) => setForm((current) => ({ ...current, recurrence: value as MaintenanceRecurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as MaintenanceStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {form.recurrence === "custom" && (
                <div className="grid gap-2">
                  <Label htmlFor="custom-interval">Interval days</Label>
                  <Input
                    id="custom-interval"
                    type="number"
                    min="1"
                    max="3650"
                    value={form.custom_interval_days}
                    onChange={(event) => setForm((current) => ({ ...current, custom_interval_days: event.target.value }))}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="next-due">Next due</Label>
                <Input
                  id="next-due"
                  type="date"
                  value={form.next_due_date}
                  onChange={(event) => setForm((current) => ({ ...current, next_due_date: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-completed">Last completed</Label>
                <Input
                  id="last-completed"
                  type="date"
                  value={form.last_completed_date}
                  onChange={(event) => setForm((current) => ({ ...current, last_completed_date: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reminder-days">Reminder days before</Label>
                <Input
                  id="reminder-days"
                  type="number"
                  min="0"
                  max="365"
                  value={form.reminder_days_before}
                  onChange={(event) => setForm((current) => ({ ...current, reminder_days_before: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Life domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={form.life_area_id || null}
                  onChange={(value) => setForm((current) => ({ ...current, life_area_id: value || "" }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Vault item</Label>
                <Select
                  value={form.vault_item_id || "none"}
                  onValueChange={(value) => setForm((current) => ({ ...current, vault_item_id: value === "none" ? "" : value }))}
                  disabled={vaultUnavailable || vaultItems.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={vaultUnavailable ? "Vault unavailable" : "No vault item"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vault item</SelectItem>
                    {vaultItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="maintenance-notes">Notes</Label>
              <Textarea
                id="maintenance-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Where to do it, what to check, account numbers, or special steps..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveItem} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
