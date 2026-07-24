"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  X,
} from "lucide-react"
import { AttachmentList } from "@/components/attachment-list"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { LifeAreaSelect } from "@/components/life-area-controls"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"

// ── Types ─────────────────────────────────────────────────────────────────────

type VaultCategory =
  | "documents" | "subscriptions" | "warranty" | "insurance"
  | "vehicle" | "home" | "medical" | "education" | "work" | "other"

type VaultItem = {
  id: number
  title: string
  category: VaultCategory
  description: string | null
  notes: string | null
  start_date: string | null
  expiry_date: string | null
  renewal_date: string | null
  reminder_date: string | null
  url: string | null
  life_area_id: number | null
  life_area_name: string | null
  life_area_color: string | null
  tags: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: VaultCategory[] = [
  "documents", "subscriptions", "warranty", "insurance",
  "vehicle", "home", "medical", "education", "work", "other",
]

const CATEGORY_LABELS: Record<VaultCategory, string> = {
  documents: "Documents",
  subscriptions: "Subscriptions",
  warranty: "Warranty",
  insurance: "Insurance",
  vehicle: "Vehicle",
  home: "Home",
  medical: "Medical",
  education: "Education",
  work: "Work",
  other: "Other",
}

const CATEGORY_COLORS: Record<VaultCategory, string> = {
  documents: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  subscriptions: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  warranty: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  insurance: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  vehicle: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  home: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medical: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  education: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  work: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + "T00:00:00")
  if (Number.isNaN(target.getTime())) return null
  return Math.ceil((target.getTime() - today().getTime()) / 86400000)
}

type ExpiryStatus = "expired" | "critical" | "warning" | "upcoming" | "ok" | "none"

function expiryStatus(dateStr: string | null): ExpiryStatus {
  const days = daysUntil(dateStr)
  if (days === null) return "none"
  if (days < 0) return "expired"
  if (days < 7) return "critical"
  if (days < 30) return "warning"
  if (days < 60) return "upcoming"
  return "ok"
}

function ExpiryBadge({ dateStr, label = "Expires" }: { dateStr: string | null; label?: string }) {
  const days = daysUntil(dateStr)
  const status = expiryStatus(dateStr)
  if (status === "none") return null

  const text =
    status === "expired" ? "Expired" :
    days === 0 ? "Today" :
    days === 1 ? "Tomorrow" :
    `${days}d`

  const cls =
    status === "expired" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800" :
    status === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
    status === "warning" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200" :
    status === "upcoming" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" :
    "bg-muted text-muted-foreground border-border"

  return (
    <span className={`inline-flex items-center gap-1 text-xs rounded px-1.5 py-0.5 border ${cls}`}>
      <Calendar className="h-3 w-3" />
      {label}: {text}
    </span>
  )
}

// ── Form types ────────────────────────────────────────────────────────────────

type VaultFormData = {
  title: string
  category: VaultCategory
  description: string
  notes: string
  start_date: string
  expiry_date: string
  renewal_date: string
  reminder_date: string
  url: string
  life_area_id: string
  tags: string
}

const emptyForm: VaultFormData = {
  title: "",
  category: "other",
  description: "",
  notes: "",
  start_date: "",
  expiry_date: "",
  renewal_date: "",
  reminder_date: "",
  url: "",
  life_area_id: "",
  tags: "",
}

function itemToForm(item: VaultItem): VaultFormData {
  return {
    title: item.title,
    category: item.category,
    description: item.description || "",
    notes: item.notes || "",
    start_date: item.start_date ? item.start_date.slice(0, 10) : "",
    expiry_date: item.expiry_date ? item.expiry_date.slice(0, 10) : "",
    renewal_date: item.renewal_date ? item.renewal_date.slice(0, 10) : "",
    reminder_date: item.reminder_date ? item.reminder_date.slice(0, 10) : "",
    url: item.url || "",
    life_area_id: item.life_area_id ? String(item.life_area_id) : "",
    tags: (item.tags || []).join(", "),
  }
}

// ── VaultItemForm ─────────────────────────────────────────────────────────────

function VaultItemForm({
  initial,
  lifeAreas,
  onSave,
  onCancel,
  saving,
}: {
  initial?: VaultFormData
  lifeAreas: LifeArea[]
  onSave: (data: VaultFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<VaultFormData>(initial || emptyForm)
  const set = (field: keyof VaultFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }))

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Title *</Label>
          <Input value={form.title} onChange={set("title")} placeholder="e.g. Car Insurance Policy" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v as VaultCategory }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Life domain</Label>
          <LifeAreaSelect
            areas={lifeAreas}
            value={form.life_area_id}
            onChange={(v) => setForm((p) => ({ ...p, life_area_id: v ?? "" }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input value={form.description} onChange={set("description")} placeholder="Brief description" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start date</Label>
          <Input type="date" value={form.start_date} onChange={set("start_date")} />
        </div>
        <div className="space-y-2">
          <Label>Expiry date</Label>
          <Input type="date" value={form.expiry_date} onChange={set("expiry_date")} />
        </div>
        <div className="space-y-2">
          <Label>Renewal date</Label>
          <Input type="date" value={form.renewal_date} onChange={set("renewal_date")} />
        </div>
        <div className="space-y-2">
          <Label>Reminder date</Label>
          <Input type="date" value={form.reminder_date} onChange={set("reminder_date")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>URL / Link</Label>
        <Input type="url" value={form.url} onChange={set("url")} placeholder="https://provider.com/account" />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={set("notes")} rows={3} placeholder="Policy number, account details, contact info..." />
      </div>

      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input value={form.tags} onChange={set("tags")} placeholder="auto, annual, important" />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.title.trim()}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </Button>
      </div>
    </div>
  )
}

// ── VaultCard ─────────────────────────────────────────────────────────────────

function VaultCard({
  item,
  onEdit,
  onDelete,
}: {
  item: VaultItem
  onEdit: (item: VaultItem) => void
  onDelete: (id: number) => void
}) {
  const expStatus = expiryStatus(item.expiry_date)
  const borderClass =
    expStatus === "expired" || expStatus === "critical" ? "border-red-300 dark:border-red-800" :
    expStatus === "warning" ? "border-orange-300 dark:border-orange-700" :
    expStatus === "upcoming" ? "border-amber-300 dark:border-amber-700" :
    ""

  return (
    <Card className={`group transition-all hover:shadow-md ${borderClass}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.title}</p>
            <span className={`inline-block text-xs rounded px-1.5 py-0.5 mt-1 font-medium ${CATEGORY_COLORS[item.category]}`}>
              {CATEGORY_LABELS[item.category]}
            </span>
          </div>
          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(item)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {item.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3">
          <ExpiryBadge dateStr={item.expiry_date} label="Expires" />
          <ExpiryBadge dateStr={item.renewal_date} label="Renews" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {item.life_area_name && (
            <span className="text-xs rounded px-1.5 py-0.5 text-white" style={{ background: item.life_area_color || "#666" }}>
              {item.life_area_name}
            </span>
          )}
          {(item.tags || []).slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
          ))}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
              onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-3 w-3" />Link
            </a>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <AttachmentList itemType="vault_item" itemId={item.id} />
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [itemsRes, laRes] = await Promise.all([
        fetch("/api/vault"),
        fetch("/api/life-areas"),
      ])
      if (!itemsRes.ok) throw new Error("Failed to fetch vault items")
      const itemsData = await itemsRes.json()
      setItems(Array.isArray(itemsData) ? itemsData : [])
      if (laRes.ok) {
        const laData = await laRes.json()
        setLifeAreas(Array.isArray(laData) ? laData.map((a: Record<string, unknown>) => normalizeLifeArea(a)) : [])
      }
    } catch {
      setError("Failed to load vault items. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleSave(data: VaultFormData) {
    setSaving(true)
    try {
      const tags = data.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
      const body = {
        ...data,
        tags,
        life_area_id: data.life_area_id || null,
        start_date: data.start_date || null,
        expiry_date: data.expiry_date || null,
        renewal_date: data.renewal_date || null,
        reminder_date: data.reminder_date || null,
        url: data.url || null,
        description: data.description || null,
        notes: data.notes || null,
      }
      const method = editingItem ? "PUT" : "POST"
      const payload = editingItem ? { ...body, id: editingItem.id } : body
      const res = await fetch("/api/vault", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Save failed")
      setDialogOpen(false)
      setEditingItem(null)
      await fetchAll()
    } catch {
      alert("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this vault item?")) return
    try {
      await fetch("/api/vault", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch { alert("Failed to delete.") }
  }

  function openAdd() { setEditingItem(null); setDialogOpen(true) }
  function openEdit(item: VaultItem) { setEditingItem(item); setDialogOpen(true) }

  const filtered = filter
    ? items.filter((i) =>
        i.title.toLowerCase().includes(filter.toLowerCase()) ||
        i.category.includes(filter.toLowerCase()) ||
        (i.description || "").toLowerCase().includes(filter.toLowerCase()) ||
        (i.notes || "").toLowerCase().includes(filter.toLowerCase()) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(filter.toLowerCase()))
      )
    : items

  const expiringSoon = filtered.filter((i) => {
    const d = daysUntil(i.expiry_date)
    return d !== null && d >= 0 && d <= 60
  }).sort((a, b) => (daysUntil(a.expiry_date) ?? 999) - (daysUntil(b.expiry_date) ?? 999))

  const expired = filtered.filter((i) => {
    const d = daysUntil(i.expiry_date)
    return d !== null && d < 0
  })

  const renewalsDue = filtered
    .filter((i) => {
      const d = daysUntil(i.renewal_date)
      return d !== null && d >= 0 && d <= 60
    })
    .sort((a, b) => (daysUntil(a.renewal_date) ?? 999) - (daysUntil(b.renewal_date) ?? 999))

  const byCategory = CATEGORIES.reduce<Record<VaultCategory, VaultItem[]>>((acc, c) => {
    acc[c] = filtered.filter((i) => i.category === c)
    return acc
  }, {} as Record<VaultCategory, VaultItem[]>)

  return (
    <DashboardLayout>
      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingItem(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Vault Item" : "Add Vault Item"}</DialogTitle>
          </DialogHeader>
          <VaultItemForm
            initial={editingItem ? itemToForm(editingItem) : undefined}
            lifeAreas={lifeAreas}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditingItem(null) }}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Life Vault
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Store important documents, subscriptions, warranties, and other life information.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchAll} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
          </div>
        </div>

        {/* Privacy warning */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Privacy notice:</span> Life Vault stores reference information only.
            Do not save passwords, PINs, or sensitive secrets here.
          </p>
        </div>

        {/* Summary stats */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total items</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-destructive">{expired.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Expired</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-warning">{expiringSoon.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Expiring ≤60d</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-warning">{renewalsDue.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Renewals ≤60d</p>
              </CardContent>
            </Card>
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* Search */}
        {!loading && items.length > 0 && (
          <div className="relative">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search by title, category, tags, or notes..."
            />
            {filter && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setFilter("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="expiring" className="gap-1 text-orange-600 dark:text-orange-400">
              Expiring ({expiringSoon.length + expired.length})
            </TabsTrigger>
            <TabsTrigger value="renewals">
              Renewals ({renewalsDue.length})
            </TabsTrigger>
            <TabsTrigger value="by-category">By category</TabsTrigger>
          </TabsList>

          {/* All */}
          <TabsContent value="all" className="mt-4">
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-base font-medium">
                    {filter ? "No results" : "Your vault is empty"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    {filter
                      ? "Try a different search term."
                      : "Add important documents, subscriptions, warranties, and other life information."}
                  </p>
                  {!filter && (
                    <Button onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-1" /> Add first item
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <VaultCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Expiring */}
          <TabsContent value="expiring" className="mt-4 space-y-4">
            {expired.length > 0 && (
              <div>
                <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-2">
                  Expired ({expired.length})
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {expired.map((item) => (
                    <VaultCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            {expiringSoon.length > 0 && (
              <div>
                <p className="text-xs font-medium text-warning uppercase tracking-wide mb-2">
                  Expiring within 60 days ({expiringSoon.length})
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {expiringSoon.map((item) => (
                    <VaultCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
            {expired.length === 0 && expiringSoon.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No items expiring in the next 60 days.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Renewals */}
          <TabsContent value="renewals" className="mt-4">
            {renewalsDue.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No renewals due in the next 60 days.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {renewalsDue.map((item) => (
                  <VaultCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* By category */}
          <TabsContent value="by-category" className="mt-4 space-y-6">
            {CATEGORIES.map((cat) =>
              byCategory[cat].length === 0 ? null : (
                <div key={cat}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[cat]} ({byCategory[cat].length})
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {byCategory[cat].map((item) => (
                      <VaultCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              )
            )}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No items yet.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
