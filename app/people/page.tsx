"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Bell,
  Cake,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { LifeAreaSelect } from "@/components/life-area-controls"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"

// ── Types ─────────────────────────────────────────────────────────────────────

type RelationshipType = "family" | "friend" | "work" | "school" | "client" | "mentor" | "other"

type Person = {
  id: number
  name: string
  relationship_type: RelationshipType
  email: string | null
  phone: string | null
  birthday: string | null
  location: string | null
  notes: string | null
  life_area_id: number | null
  life_area_name: string | null
  life_area_color: string | null
  tags: string[]
  avatar_color: string
  upcoming_reminders: Reminder[] | null
}

type Reminder = {
  id: number
  person_id: number
  reminder_type: "birthday" | "follow_up" | "custom"
  title: string
  remind_at: string
  is_recurring: boolean
  recur_interval: string | null
  is_sent: boolean
  note: string | null
  person_name?: string
  avatar_color?: string
  relationship_type?: string
}

type PersonLink = {
  id: number
  item_type: "task" | "note" | "project" | "calendar_event"
  item_id: number
  item_title: string | null
  item_href: string
}

type PersonCounts = {
  commitments: number
  waiting: number
  tasks: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES: RelationshipType[] = ["family", "friend", "work", "school", "client", "mentor", "other"]

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  family: "Family",
  friend: "Friend",
  work: "Work",
  school: "School",
  client: "Client",
  mentor: "Mentor",
  other: "Other",
}

const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  family: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  friend: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  work: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  school: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  client: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  mentor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

const AVATAR_COLORS = [
  "#2563EB", "#7C3AED", "#059669", "#DC2626",
  "#EA580C", "#DB2777", "#0891B2", "#CA8A04", "#4F46E5", "#0F766E",
]

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
}

function daysUntilBirthday(birthday: string | null): number | null {
  if (!birthday) return null
  const today = new Date()
  const bday = new Date(birthday)
  const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.ceil((next.getTime() - today.setHours(0, 0, 0, 0)) / 86400000)
}

function formatBirthday(birthday: string | null) {
  if (!birthday) return null
  const d = new Date(birthday + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" })
}

function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

// ── Person Form ───────────────────────────────────────────────────────────────

type PersonFormData = {
  name: string
  relationship_type: RelationshipType
  email: string
  phone: string
  birthday: string
  location: string
  notes: string
  life_area_id: string
  tags: string
  avatar_color: string
}

const emptyPersonForm: PersonFormData = {
  name: "",
  relationship_type: "friend",
  email: "",
  phone: "",
  birthday: "",
  location: "",
  notes: "",
  life_area_id: "",
  tags: "",
  avatar_color: "#2563EB",
}

function PersonForm({
  initial,
  lifeAreas,
  onSave,
  onCancel,
  saving,
}: {
  initial?: PersonFormData
  lifeAreas: LifeArea[]
  onSave: (data: PersonFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<PersonFormData>(initial || emptyPersonForm)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Alice Kim"
          />
        </div>
        <div className="space-y-2">
          <Label>Relationship</Label>
          <Select
            value={form.relationship_type}
            onValueChange={(v) => setForm((p) => ({ ...p, relationship_type: v as RelationshipType }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{RELATIONSHIP_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="alice@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Birthday</Label>
          <Input
            type="date"
            value={form.birthday}
            onChange={(e) => setForm((p) => ({ ...p, birthday: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            placeholder="New York, NY"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Context about this person..."
          rows={3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Life area</Label>
          <LifeAreaSelect
            areas={lifeAreas}
            value={form.life_area_id}
            onChange={(v) => setForm((p) => ({ ...p, life_area_id: v ?? "" }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Tags (comma-separated)</Label>
          <Input
            value={form.tags}
            onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            placeholder="vip, investor, mentor"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Avatar color</Label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="h-7 w-7 rounded-full border-2 transition-all"
              style={{
                background: c,
                borderColor: form.avatar_color === c ? "#fff" : "transparent",
                outline: form.avatar_color === c ? `2px solid ${c}` : "none",
              }}
              onClick={() => setForm((p) => ({ ...p, avatar_color: c }))}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </Button>
      </div>
    </div>
  )
}

// ── Reminder Form ─────────────────────────────────────────────────────────────

type ReminderFormData = {
  reminder_type: "birthday" | "follow_up" | "custom"
  title: string
  remind_at: string
  is_recurring: boolean
  recur_interval: string
  note: string
}

const emptyReminderForm: ReminderFormData = {
  reminder_type: "custom",
  title: "",
  remind_at: "",
  is_recurring: false,
  recur_interval: "yearly",
  note: "",
}

function ReminderForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: ReminderFormData
  onSave: (data: ReminderFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<ReminderFormData>(initial || emptyReminderForm)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.reminder_type} onValueChange={(v) => setForm((p) => ({ ...p, reminder_type: v as ReminderFormData["reminder_type"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="birthday">Birthday</SelectItem>
              <SelectItem value="follow_up">Follow-up</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Wish happy birthday" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Remind at *</Label>
          <Input type="datetime-local" value={form.remind_at} onChange={(e) => setForm((p) => ({ ...p, remind_at: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Note</Label>
          <Input value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional note" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm((p) => ({ ...p, is_recurring: v }))} id="recurring" />
          <Label htmlFor="recurring">Recurring</Label>
        </div>
        {form.is_recurring && (
          <Select value={form.recur_interval} onValueChange={(v) => setForm((p) => ({ ...p, recur_interval: v }))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.title.trim() || !form.remind_at}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save reminder
        </Button>
      </div>
    </div>
  )
}

// ── Person Card ───────────────────────────────────────────────────────────────

function PersonCard({
  person,
  counts,
  onEdit,
  onDelete,
  onSelect,
}: {
  person: Person
  counts?: PersonCounts
  onEdit: (p: Person) => void
  onDelete: (id: number) => void
  onSelect: (p: Person) => void
}) {
  const daysUntil = daysUntilBirthday(person.birthday)
  const nextReminder = person.upcoming_reminders?.[0] ?? null
  const tags = person.tags || []

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-all group"
      onClick={() => onSelect(person)}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: person.avatar_color }}
          >
            {initials(person.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{person.name}</p>
                <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mt-0.5 ${RELATIONSHIP_COLORS[person.relationship_type]}`}>
                  {RELATIONSHIP_LABELS[person.relationship_type]}
                </span>
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onEdit(person) }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(person.id) }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              {person.email && (
                <a href={`mailto:${person.email}`} className="flex items-center gap-1 hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}>
                  <Mail className="h-3 w-3" />{person.email}
                </a>
              )}
              {person.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />{person.phone}
                </span>
              )}
              {person.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{person.location}
                </span>
              )}
            </div>

            {/* Birthday + reminders */}
            <div className="flex flex-wrap gap-2 mt-2">
              {person.birthday && daysUntil !== null && (
                <span className={`flex items-center gap-1 text-xs rounded px-1.5 py-0.5 ${
                  daysUntil <= 7 ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" : "text-muted-foreground"
                }`}>
                  <Cake className="h-3 w-3" />
                  {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                </span>
              )}
              {nextReminder && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Bell className="h-3 w-3" />
                  {formatDateTime(nextReminder.remind_at)}
                </span>
              )}
              {person.life_area_name && (
                <span className="text-xs rounded px-1.5 py-0.5 text-white" style={{ background: person.life_area_color || "#666" }}>
                  {person.life_area_name}
                </span>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
                ))}
              </div>
            )}

            {counts && (counts.commitments > 0 || counts.waiting > 0 || counts.tasks > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {counts.commitments > 0 && (
                  <Badge variant="secondary" className="text-xs">{counts.commitments} commitments</Badge>
                )}
                {counts.waiting > 0 && (
                  <Badge variant="secondary" className="text-xs">{counts.waiting} waiting</Badge>
                )}
                {counts.tasks > 0 && (
                  <Badge variant="secondary" className="text-xs">{counts.tasks} tasks</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Person Detail Drawer ───────────────────────────────────────────────────────

function PersonDetail({
  person,
  onClose,
  onEdit,
  onDelete,
}: {
  person: Person
  onClose: () => void
  onEdit: (p: Person) => void
  onDelete: (id: number) => void
}) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [links, setLinks] = useState<PersonLink[]>([])
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [savingReminder, setSavingReminder] = useState(false)
  const [expanded, setExpanded] = useState<"reminders" | "links" | null>("reminders")

  const daysUntil = daysUntilBirthday(person.birthday)

  useEffect(() => {
    async function load() {
      setLoadingDetails(true)
      try {
        const [remindersRes, linksRes] = await Promise.all([
          fetch(`/api/people/reminders?person_id=${person.id}`),
          fetch(`/api/people/links?person_id=${person.id}`),
        ])
        if (remindersRes.ok) setReminders(await remindersRes.json())
        if (linksRes.ok) setLinks(await linksRes.json())
      } catch { /* non-fatal */ }
      finally { setLoadingDetails(false) }
    }
    load()
  }, [person.id])

  async function handleSaveReminder(data: ReminderFormData) {
    setSavingReminder(true)
    try {
      const remindAt = new Date(data.remind_at).toISOString()
      const res = await fetch("/api/people/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person_id: person.id,
          reminder_type: data.reminder_type,
          title: data.title,
          remind_at: remindAt,
          is_recurring: data.is_recurring,
          recur_interval: data.is_recurring ? data.recur_interval : null,
          note: data.note || null,
        }),
      })
      if (res.ok) {
        const r = await res.json()
        setReminders((prev) => [...prev, r])
        setShowReminderForm(false)
      }
    } catch { /* non-fatal */ }
    finally { setSavingReminder(false) }
  }

  async function handleDeleteReminder(id: number) {
    try {
      await fetch("/api/people/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch { /* non-fatal */ }
  }

  async function handleUnlink(linkId: number) {
    try {
      await fetch("/api/people/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      })
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
    } catch { /* non-fatal */ }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-5 border-b border-border">
        <div
          className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-white text-base font-bold"
          style={{ background: person.avatar_color }}
        >
          {initials(person.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{person.name}</h2>
          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mt-0.5 ${RELATIONSHIP_COLORS[person.relationship_type]}`}>
            {RELATIONSHIP_LABELS[person.relationship_type]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(person)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive"
            onClick={() => { onDelete(person.id); onClose() }}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Contact */}
        <div className="space-y-2">
          {person.email && (
            <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Mail className="h-4 w-4" />{person.email}
            </a>
          )}
          {person.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />{person.phone}
            </div>
          )}
          {person.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />{person.location}
            </div>
          )}
          {person.birthday && (
            <div className={`flex items-center gap-2 text-sm ${daysUntil !== null && daysUntil <= 7 ? "text-pink-700 dark:text-pink-300" : "text-muted-foreground"}`}>
              <Cake className="h-4 w-4" />
              {formatBirthday(person.birthday)}
              {daysUntil !== null && (
                <span className="ml-1 text-xs">
                  {daysUntil === 0 ? "(Today!)" : daysUntil === 1 ? "(Tomorrow)" : `(in ${daysUntil} days)`}
                </span>
              )}
            </div>
          )}
          {person.life_area_name && (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full inline-block" style={{ background: person.life_area_color || "#666" }} />
              <span className="text-muted-foreground">{person.life_area_name}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {person.notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{person.notes}</p>
          </div>
        )}

        {/* Tags */}
        {(person.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {person.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Reminders section */}
        <div>
          <button
            className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-primary"
            onClick={() => setExpanded((v) => v === "reminders" ? null : "reminders")}
          >
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4" />Reminders ({reminders.length})
            </span>
            {expanded === "reminders" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "reminders" && (
            <div className="space-y-2 mt-2">
              {loadingDetails ? <Skeleton className="h-10 w-full" /> : reminders.length === 0 && !showReminderForm ? (
                <p className="text-xs text-muted-foreground">No reminders yet.</p>
              ) : reminders.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                  <Bell className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.remind_at)}{r.is_recurring ? ` · ${r.recur_interval}` : ""}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteReminder(r.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {showReminderForm ? (
                <div className="rounded-lg border p-3">
                  <ReminderForm
                    onSave={handleSaveReminder}
                    onCancel={() => setShowReminderForm(false)}
                    saving={savingReminder}
                  />
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => setShowReminderForm(true)}>
                  <Plus className="h-3 w-3" /> Add reminder
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Linked items section */}
        <div>
          <button
            className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-primary"
            onClick={() => setExpanded((v) => v === "links" ? null : "links")}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />Linked items ({links.length})
            </span>
            {expanded === "links" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded === "links" && (
            <div className="space-y-2 mt-2">
              {loadingDetails ? <Skeleton className="h-10 w-full" /> : links.length === 0 ? (
                <p className="text-xs text-muted-foreground">No linked items yet. Link tasks, notes, or projects from their respective pages.</p>
              ) : links.map((link) => (
                <div key={link.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <Badge variant="outline" className="text-xs shrink-0 capitalize">{link.item_type.replace("_", " ")}</Badge>
                  {link.item_title ? (
                    <Link href={link.item_href} className="text-xs text-primary hover:underline truncate flex-1">
                      {link.item_title}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground flex-1 truncate">(deleted)</span>
                  )}
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnlink(link.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [personCounts, setPersonCounts] = useState<Record<number, PersonCounts>>({})
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [filter, setFilter] = useState("")

  const loadPersonCounts = useCallback(async (items: Person[]) => {
    if (items.length === 0) {
      setPersonCounts({})
      return
    }

    const entries = await Promise.all(
      items.map(async (person): Promise<[number, PersonCounts]> => {
        const [commitmentsRes, waitingRes, linksRes] = await Promise.allSettled([
          fetch(`/api/commitments?person_id=${person.id}&view=open&limit=100`),
          fetch(`/api/waiting?person_id=${person.id}&view=all&limit=100`),
          fetch(`/api/people/links?person_id=${person.id}`),
        ])

        const commitments =
          commitmentsRes.status === "fulfilled" && commitmentsRes.value.ok
            ? await commitmentsRes.value.json().then((data) => (Array.isArray(data) ? data.length : 0)).catch(() => 0)
            : 0
        const waiting =
          waitingRes.status === "fulfilled" && waitingRes.value.ok
            ? await waitingRes.value
                .json()
                .then((data) =>
                  Array.isArray(data)
                    ? data.filter((item: { status?: string }) => item.status !== "resolved" && item.status !== "cancelled").length
                    : 0,
                )
                .catch(() => 0)
            : 0
        const tasks =
          linksRes.status === "fulfilled" && linksRes.value.ok
            ? await linksRes.value
                .json()
                .then((data) => (Array.isArray(data) ? data.filter((item: { item_type?: string }) => item.item_type === "task").length : 0))
                .catch(() => 0)
            : 0

        return [person.id, { commitments, waiting, tasks }]
      }),
    )

    setPersonCounts(Object.fromEntries(entries) as Record<number, PersonCounts>)
  }, [])

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [peopleRes, lifeAreasRes, remindersRes] = await Promise.all([
        fetch("/api/people"),
        fetch("/api/life-areas"),
        fetch("/api/people/reminders?upcoming=true"),
      ])
      if (!peopleRes.ok) throw new Error("Failed to fetch people")
      const [peopleData, remindersData] = await Promise.all([
        peopleRes.json(),
        remindersRes.ok ? remindersRes.json() : Promise.resolve([]),
      ])
      const nextPeople = Array.isArray(peopleData) ? peopleData : []
      setPeople(nextPeople)
      setUpcomingReminders(Array.isArray(remindersData) ? remindersData : [])
      loadPersonCounts(nextPeople)
      if (lifeAreasRes.ok) {
        const laData = await lifeAreasRes.json()
        setLifeAreas(Array.isArray(laData) ? laData.map((a: Record<string, unknown>) => normalizeLifeArea(a)) : [])
      }
    } catch {
      setError("Failed to load people. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [loadPersonCounts])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSave(data: PersonFormData) {
    setSaving(true)
    try {
      const tags = data.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
      const body = {
        ...data,
        tags,
        life_area_id: data.life_area_id || null,
        birthday: data.birthday || null,
        email: data.email || null,
        phone: data.phone || null,
        location: data.location || null,
        notes: data.notes || null,
      }
      const method = editingPerson ? "PUT" : "POST"
      const payload = editingPerson ? { ...body, id: editingPerson.id } : body
      const res = await fetch("/api/people", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Save failed")
      setShowForm(false)
      setEditingPerson(null)
      await fetchAll()
    } catch {
      alert("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this person and all their reminders?")) return
    try {
      await fetch("/api/people", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setPeople((prev) => prev.filter((p) => p.id !== id))
      if (selectedPerson?.id === id) setSelectedPerson(null)
    } catch { alert("Failed to delete.") }
  }

  function editPersonForm(p: Person): PersonFormData {
    return {
      name: p.name,
      relationship_type: p.relationship_type,
      email: p.email || "",
      phone: p.phone || "",
      birthday: p.birthday ? p.birthday.slice(0, 10) : "",
      location: p.location || "",
      notes: p.notes || "",
      life_area_id: p.life_area_id ? String(p.life_area_id) : "",
      tags: (p.tags || []).join(", "),
      avatar_color: p.avatar_color || "#2563EB",
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingBirthdays = people
    .filter((p) => p.birthday)
    .map((p) => ({ person: p, days: daysUntilBirthday(p.birthday) ?? 999 }))
    .filter(({ days }) => days <= 30)
    .sort((a, b) => a.days - b.days)

  const followUpsDue = upcomingReminders.filter((r) => r.reminder_type === "follow_up")

  const filtered = filter
    ? people.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.email?.toLowerCase().includes(filter.toLowerCase()) ||
        p.relationship_type.includes(filter.toLowerCase()) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(filter.toLowerCase()))
      )
    : people

  const byType = RELATIONSHIP_TYPES.reduce<Record<RelationshipType, Person[]>>((acc, t) => {
    acc[t] = filtered.filter((p) => p.relationship_type === t)
    return acc
  }, {} as Record<RelationshipType, Person[]>)

  return (
    <DashboardLayout>
      {/* Detail drawer overlay */}
      {selectedPerson && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedPerson(null)} />
          <PersonDetail
            person={selectedPerson}
            onClose={() => setSelectedPerson(null)}
            onEdit={(p) => { setSelectedPerson(null); setEditingPerson(p); setShowForm(true) }}
            onDelete={handleDelete}
          />
        </>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">People</h1>
            <p className="text-sm text-muted-foreground mt-1">Track important relationships, reminders, and follow-ups.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => { setEditingPerson(null); setShowForm(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Add person
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {!loading && people.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold">{people.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total people</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-pink-500">{upcomingBirthdays.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Birthdays this month</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-amber-500">{followUpsDue.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Follow-ups due</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold">{upcomingReminders.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Upcoming reminders</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editingPerson ? "Edit Person" : "Add Person"}</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonForm
                initial={editingPerson ? editPersonForm(editingPerson) : undefined}
                lifeAreas={lifeAreas}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingPerson(null) }}
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

        {/* Search filter */}
        {!loading && people.length > 0 && (
          <div className="relative">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by name, email, tag, or relationship..."
              className="pl-4"
            />
            {filter && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setFilter("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="birthdays" className="gap-1">
              <Cake className="h-3 w-3" />Birthdays ({upcomingBirthdays.length})
            </TabsTrigger>
            <TabsTrigger value="followups" className="gap-1">
              <Clock className="h-3 w-3" />Follow-ups ({followUpsDue.length})
            </TabsTrigger>
            <TabsTrigger value="bytype">By type</TabsTrigger>
          </TabsList>

          {/* ── All ── */}
          <TabsContent value="all" className="mt-4 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-medium">
                    {filter ? "No results" : "No people yet"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    {filter ? "Try a different search term." : "Add important people in your life to track contact info, birthdays, and follow-ups."}
                  </p>
                  {!filter && (
                    <Button onClick={() => { setEditingPerson(null); setShowForm(true) }}>
                      <Plus className="h-4 w-4 mr-1" /> Add first person
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <PersonCard key={p.id} person={p}
                    counts={personCounts[p.id]}
                    onEdit={(p) => { setEditingPerson(p); setShowForm(true) }}
                    onDelete={handleDelete}
                    onSelect={setSelectedPerson}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Birthdays ── */}
          <TabsContent value="birthdays" className="mt-4">
            {upcomingBirthdays.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Cake className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No birthdays in the next 30 days.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {upcomingBirthdays.map(({ person: p, days }) => (
                  <Card key={p.id} className="cursor-pointer hover:border-pink-400 transition-all"
                    onClick={() => setSelectedPerson(p)}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ background: p.avatar_color }}>
                          {initials(p.name)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBirthday(p.birthday)}</p>
                        </div>
                        <span className={`text-sm font-semibold ${days <= 7 ? "text-pink-500" : "text-muted-foreground"}`}>
                          {days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days}d`}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Follow-ups ── */}
          <TabsContent value="followups" className="mt-4">
            {followUpsDue.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No follow-up reminders in the next 30 days.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {followUpsDue.map((r) => {
                  const person = people.find((p) => p.id === r.person_id)
                  return (
                    <Card key={r.id} className="cursor-pointer hover:border-amber-400 transition-all"
                      onClick={() => person && setSelectedPerson(person)}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{ background: r.avatar_color || "#2563EB" }}>
                            {initials(r.person_name || "?")}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-xs text-muted-foreground">{r.person_name} · {formatDateTime(r.remind_at)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ── By type ── */}
          <TabsContent value="bytype" className="mt-4 space-y-6">
            {RELATIONSHIP_TYPES.map((type) =>
              byType[type].length === 0 ? null : (
                <div key={type}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {RELATIONSHIP_LABELS[type]} ({byType[type].length})
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {byType[type].map((p) => (
                      <PersonCard key={p.id} person={p}
                        counts={personCounts[p.id]}
                        onEdit={(p) => { setEditingPerson(p); setShowForm(true) }}
                        onDelete={handleDelete}
                        onSelect={setSelectedPerson}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No people added yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
