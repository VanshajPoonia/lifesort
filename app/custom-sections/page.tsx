"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  AlertCircle,
  Book,
  Briefcase,
  Camera,
  Car,
  CheckSquare,
  Code,
  Dumbbell,
  Film,
  Folder,
  Gamepad2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  List,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  PenLine,
  Plane,
  Plus,
  ShoppingBag,
  Star,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType = "text" | "number" | "date" | "checkbox" | "select" | "url" | "notes"

interface FieldDefinition {
  id: string
  name: string
  type: FieldType
  options?: string[]
  required?: boolean
}

interface CustomSection {
  id: string
  title: string
  description: string | null
  icon: string
  color: string
  fields: FieldDefinition[]
  position: number
  created_at: string
  updated_at: string
}

interface CustomRecord {
  id: string
  section_id: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Icon registry ──────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Folder,
  List,
  Book,
  Film,
  Music,
  Star,
  Heart,
  Briefcase,
  CheckSquare,
  Target,
  Dumbbell,
  GraduationCap,
  ShoppingBag,
  Globe,
  Code,
  Camera,
  PenLine,
  Lightbulb,
  Trophy,
  Users,
  Plane,
  Car,
  Home,
  Gamepad2,
}

const ICON_NAMES = Object.keys(ICON_MAP)

function SectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Folder
  return <Icon className={className} />
}

// ── Field type helpers ─────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "Checkbox",
  select: "Select / Dropdown",
  url: "URL",
  notes: "Notes (long text)",
}

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[]

function formatRecordValue(value: unknown, field: FieldDefinition): string {
  if (value === null || value === undefined || value === "") return "—"
  if (field.type === "checkbox") return value ? "Yes" : "No"
  if (field.type === "date" && typeof value === "string") {
    const d = new Date(value)
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString()
  }
  return String(value)
}

function newFieldId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeSection(raw: Record<string, unknown>): CustomSection {
  let fields: FieldDefinition[] = []
  if (Array.isArray(raw.fields)) {
    fields = raw.fields as FieldDefinition[]
  } else if (typeof raw.fields === "string") {
    try { fields = JSON.parse(raw.fields) } catch { fields = [] }
  }
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "Untitled",
    description: typeof raw.description === "string" ? raw.description : null,
    icon: typeof raw.icon === "string" ? raw.icon : "Folder",
    color: typeof raw.color === "string" ? raw.color : "primary",
    fields,
    position: typeof raw.position === "number" ? raw.position : 0,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  }
}

function normalizeRecord(raw: Record<string, unknown>): CustomRecord {
  let data: Record<string, unknown> = {}
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    data = raw.data as Record<string, unknown>
  } else if (typeof raw.data === "string") {
    try { data = JSON.parse(raw.data) } catch { data = {} }
  }
  return {
    id: String(raw.id),
    section_id: String(raw.section_id),
    data,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  }
}

// ── Section dialog (create / edit) ────────────────────────────────────────────

interface SectionFormState {
  title: string
  description: string
  icon: string
  fields: FieldDefinition[]
}

function emptySection(): SectionFormState {
  return { title: "", description: "", icon: "Folder", fields: [] }
}

function sectionToForm(s: CustomSection): SectionFormState {
  return { title: s.title, description: s.description ?? "", icon: s.icon, fields: s.fields }
}

function SectionDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: SectionFormState
  onClose: () => void
  onSave: (form: SectionFormState) => Promise<void>
}) {
  const [form, setForm] = useState<SectionFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setForm(initial)
      setError("")
    }
  }, [open, initial])

  const addField = () => {
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, { id: newFieldId(), name: "", type: "text" }],
    }))
  }

  const updateField = (idx: number, patch: Partial<FieldDefinition>) => {
    setForm((prev) => {
      const next = [...prev.fields]
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, fields: next }
    })
  }

  const removeField = (idx: number) => {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== idx) }))
  }

  const addOption = (fieldIdx: number) => {
    setForm((prev) => {
      const next = [...prev.fields]
      const field = next[fieldIdx]
      next[fieldIdx] = { ...field, options: [...(field.options ?? []), ""] }
      return { ...prev, fields: next }
    })
  }

  const updateOption = (fieldIdx: number, optionIdx: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.fields]
      const field = next[fieldIdx]
      const opts = [...(field.options ?? [])]
      opts[optionIdx] = value
      next[fieldIdx] = { ...field, options: opts }
      return { ...prev, fields: next }
    })
  }

  const removeOption = (fieldIdx: number, optionIdx: number) => {
    setForm((prev) => {
      const next = [...prev.fields]
      const field = next[fieldIdx]
      next[fieldIdx] = { ...field, options: (field.options ?? []).filter((_, i) => i !== optionIdx) }
      return { ...prev, fields: next }
    })
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Section name is required."); return }
    for (const field of form.fields) {
      if (!field.name.trim()) { setError("All field names are required."); return }
    }
    setSaving(true)
    setError("")
    try {
      await onSave(form)
      onClose()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial.title ? "Edit Section" : "New Section"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="section-title">Name *</Label>
            <Input
              id="section-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Books, Job Applications, Gym Routine…"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="section-desc">Description</Label>
            <Input
              id="section-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional short description"
            />
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, icon: name }))}
                  className={`rounded-md border p-2 transition-colors ${
                    form.icon === name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary hover:bg-muted"
                  }`}
                  title={name}
                >
                  <SectionIcon name={name} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button type="button" size="sm" variant="outline" onClick={addField} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add Field
              </Button>
            </div>

            {form.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No fields yet. Add fields to define what you track in each record.
              </p>
            )}

            <div className="space-y-3">
              {form.fields.map((field, idx) => (
                <div key={field.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={field.name}
                      onChange={(e) => updateField(idx, { name: e.target.value })}
                      placeholder="Field name"
                      className="flex-1"
                    />
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(idx, { type: v as FieldType, options: v === "select" ? [""] : undefined })}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeField(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {field.type === "select" && (
                    <div className="space-y-1.5 pl-1">
                      <p className="text-xs text-muted-foreground">Options</p>
                      {(field.options ?? []).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(idx, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}`}
                            className="h-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeOption(idx, oi)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => addOption(idx)}
                      >
                        <Plus className="h-3 w-3" />
                        Add option
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {initial.title ? "Save Changes" : "Create Section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Record dialog (create / edit) ─────────────────────────────────────────────

function RecordDialog({
  open,
  section,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  section: CustomSection
  initial: Record<string, unknown>
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const [data, setData] = useState<Record<string, unknown>>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setData(initial)
      setError("")
    }
  }, [open, initial])

  const setValue = (fieldId: string, value: unknown) => {
    setData((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSave = async () => {
    for (const field of section.fields) {
      if (field.required && !data[field.id]) {
        setError(`"${field.name}" is required.`)
        return
      }
    }
    setSaving(true)
    setError("")
    try {
      await onSave(data)
      onClose()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {Object.keys(initial).length > 0 ? "Edit Record" : "Add Record"}
          </DialogTitle>
        </DialogHeader>

        {section.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This section has no fields defined. Edit the section to add fields.
          </p>
        ) : (
          <div className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`field-${field.id}`}>
                  {field.name}
                  {field.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <FieldInput
                  field={field}
                  value={data[field.id]}
                  onChange={(v) => setValue(field.id, v)}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || section.fields.length === 0} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition
  value: unknown
  onChange: (v: unknown) => void
}) {
  const id = `field-${field.id}`

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
        />
        <Label htmlFor={id} className="cursor-pointer font-normal">Yes</Label>
      </div>
    )
  }

  if (field.type === "select") {
    const options = (field.options ?? []).filter(Boolean)
    return (
      <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === "notes") {
    return (
      <Textarea
        id={id}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Enter notes…"
      />
    )
  }

  const typeMap: Partial<Record<FieldType, string>> = {
    number: "number",
    date: "date",
    url: "url",
    text: "text",
  }

  return (
    <Input
      id={id}
      type={typeMap[field.type] ?? "text"}
      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
      onChange={(e) => {
        const raw = e.target.value
        onChange(field.type === "number" ? (raw === "" ? "" : Number(raw)) : raw)
      }}
      placeholder={field.type === "url" ? "https://…" : undefined}
    />
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomSectionsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [sections, setSections] = useState<CustomSection[]>([])
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [sectionsError, setSectionsError] = useState("")

  const [selectedSection, setSelectedSection] = useState<CustomSection | null>(null)

  const [records, setRecords] = useState<CustomRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const [showCreateSection, setShowCreateSection] = useState(false)
  const [editingSection, setEditingSection] = useState<CustomSection | null>(null)

  const [showCreateRecord, setShowCreateRecord] = useState(false)
  const [editingRecord, setEditingRecord] = useState<CustomRecord | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [user, authLoading, router])

  const fetchSections = useCallback(async () => {
    setSectionsLoading(true)
    setSectionsError("")
    try {
      const res = await fetch("/api/custom-sections")
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      const normalized = Array.isArray(data) ? data.map((r: Record<string, unknown>) => normalizeSection(r)) : []
      setSections(normalized)
      setSelectedSection((prev) => {
        if (!prev) return normalized[0] ?? null
        return normalized.find((s) => s.id === prev.id) ?? normalized[0] ?? null
      })
    } catch {
      setSectionsError("Could not load sections.")
    } finally {
      setSectionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchSections()
  }, [fetchSections, user])

  const fetchRecords = useCallback(async (sectionId: string) => {
    setRecordsLoading(true)
    try {
      const res = await fetch(`/api/custom-sections/records?section_id=${sectionId}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setRecords(Array.isArray(data) ? data.map((r: Record<string, unknown>) => normalizeRecord(r)) : [])
    } catch {
      setRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSection) fetchRecords(selectedSection.id)
    else setRecords([])
  }, [selectedSection, fetchRecords])

  // Section CRUD
  const createSection = async (form: SectionFormState) => {
    const res = await fetch("/api/custom-sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, description: form.description, icon: form.icon, fields: form.fields }),
    })
    if (!res.ok) throw new Error("Failed")
    const created = normalizeSection(await res.json())
    setSections((prev) => [created, ...prev])
    setSelectedSection(created)
  }

  const updateSection = async (form: SectionFormState) => {
    if (!editingSection) return
    const res = await fetch("/api/custom-sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingSection.id, title: form.title, description: form.description, icon: form.icon, fields: form.fields, position: editingSection.position }),
    })
    if (!res.ok) throw new Error("Failed")
    const updated = normalizeSection(await res.json())
    setSections((prev) => prev.map((s) => s.id === updated.id ? updated : s))
    setSelectedSection((prev) => prev?.id === updated.id ? updated : prev)
    setEditingSection(null)
  }

  const deleteSection = async (section: CustomSection) => {
    if (!confirm(`Delete "${section.title}" and all its records? This cannot be undone.`)) return
    const res = await fetch(`/api/custom-sections?id=${section.id}`, { method: "DELETE" })
    if (!res.ok) return
    setSections((prev) => prev.filter((s) => s.id !== section.id))
    setSelectedSection((prev) => {
      if (prev?.id !== section.id) return prev
      const remaining = sections.filter((s) => s.id !== section.id)
      return remaining[0] ?? null
    })
  }

  // Record CRUD
  const createRecord = async (data: Record<string, unknown>) => {
    if (!selectedSection) return
    const res = await fetch("/api/custom-sections/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: selectedSection.id, data }),
    })
    if (!res.ok) throw new Error("Failed")
    const created = normalizeRecord(await res.json())
    setRecords((prev) => [created, ...prev])
  }

  const updateRecord = async (data: Record<string, unknown>) => {
    if (!editingRecord) return
    const res = await fetch("/api/custom-sections/records", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingRecord.id, data }),
    })
    if (!res.ok) throw new Error("Failed")
    const updated = normalizeRecord(await res.json())
    setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    setEditingRecord(null)
  }

  const deleteRecord = async (record: CustomRecord) => {
    if (!confirm("Delete this record?")) return
    const res = await fetch(`/api/custom-sections/records?id=${record.id}`, { method: "DELETE" })
    if (!res.ok) return
    setRecords((prev) => prev.filter((r) => r.id !== record.id))
  }

  if (authLoading || sectionsLoading) {
    return (
      <DashboardLayout title="Custom Sections" subtitle="Your personal trackers">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Custom Sections" subtitle="Your personal trackers">
      <div className="flex h-[calc(100vh-200px)] gap-4">

        {/* ── Left: section list ── */}
        <Card className="w-72 shrink-0">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sections</CardTitle>
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreateSection(true)}>
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sectionsError ? (
              <div className="p-4">
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {sectionsError}
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={fetchSections}>
                  Retry
                </Button>
              </div>
            ) : sections.length === 0 ? (
              <Empty className="py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><List className="h-5 w-5" /></EmptyMedia>
                  <EmptyTitle>No sections yet</EmptyTitle>
                  <EmptyDescription>Create your first custom tracker.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button size="sm" className="gap-1.5" onClick={() => setShowCreateSection(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New Section
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="space-y-0.5 p-2">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 transition-colors ${
                      selectedSection?.id === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedSection(section)}
                  >
                    <SectionIcon
                      name={section.icon}
                      className={`h-4 w-4 shrink-0 ${selectedSection?.id === section.id ? "text-primary-foreground" : "text-muted-foreground"}`}
                    />
                    <span className="flex-1 truncate text-sm font-medium">{section.title}</span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 opacity-0 group-hover:opacity-100 ${
                            selectedSection?.id === section.id
                              ? "text-primary-foreground hover:bg-primary-foreground/20"
                              : ""
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSection(section)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSection(section)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Right: records view ── */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            {!selectedSection ? (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Folder className="h-6 w-6" /></EmptyMedia>
                  <EmptyTitle>No section selected</EmptyTitle>
                  <EmptyDescription>
                    {sections.length === 0
                      ? "Create a section to start tracking."
                      : "Select a section from the list."}
                  </EmptyDescription>
                </EmptyHeader>
                {sections.length === 0 && (
                  <EmptyContent>
                    <Button className="gap-2" onClick={() => setShowCreateSection(true)}>
                      <Plus className="h-4 w-4" />
                      New Section
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : (
              <>
                {/* Section header */}
                <div className="flex items-start justify-between border-b border-border p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <SectionIcon name={selectedSection.icon} className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold leading-tight">{selectedSection.title}</h2>
                      {selectedSection.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{selectedSection.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{records.length} record{records.length !== 1 ? "s" : ""}</Badge>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setShowCreateRecord(true)}
                      disabled={selectedSection.fields.length === 0}
                      title={selectedSection.fields.length === 0 ? "Add fields to this section first" : undefined}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Record
                    </Button>
                  </div>
                </div>

                {/* No fields warning */}
                {selectedSection.fields.length === 0 && (
                  <div className="border-b border-border bg-muted/40 px-5 py-3">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      This section has no fields. Edit it to define what you want to track.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1.5"
                      onClick={() => setEditingSection(selectedSection)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Section
                    </Button>
                  </div>
                )}

                {/* Records */}
                <div className="flex-1 overflow-auto">
                  {recordsLoading ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : records.length === 0 ? (
                    <Empty className="h-full border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SectionIcon name={selectedSection.icon} className="h-6 w-6" />
                        </EmptyMedia>
                        <EmptyTitle>No records yet</EmptyTitle>
                        <EmptyDescription>
                          {selectedSection.fields.length === 0
                            ? "Add fields to this section, then create records."
                            : `Add your first entry to "${selectedSection.title}".`}
                        </EmptyDescription>
                      </EmptyHeader>
                      {selectedSection.fields.length > 0 && (
                        <EmptyContent>
                          <Button className="gap-2" onClick={() => setShowCreateRecord(true)}>
                            <Plus className="h-4 w-4" />
                            Add Record
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            {selectedSection.fields.map((field) => (
                              <th
                                key={field.id}
                                className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                              >
                                {field.name}
                                {field.type === "checkbox" && (
                                  <span className="ml-1 text-[10px] opacity-60">✓</span>
                                )}
                              </th>
                            ))}
                            <th className="w-10 px-2 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((record) => (
                            <tr
                              key={record.id}
                              className="group border-b border-border last:border-0 hover:bg-muted/30"
                            >
                              {selectedSection.fields.map((field) => (
                                <td key={field.id} className="px-4 py-3 align-top">
                                  {field.type === "checkbox" ? (
                                    <span className={`inline-block h-4 w-4 rounded-sm border ${record.data[field.id] ? "border-primary bg-primary" : "border-border"}`}>
                                      {Boolean(record.data[field.id]) && (
                                        <svg viewBox="0 0 12 12" fill="none" className="h-4 w-4 text-primary-foreground">
                                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      )}
                                    </span>
                                  ) : field.type === "url" && typeof record.data[field.id] === "string" && record.data[field.id] ? (
                                    <a
                                      href={record.data[field.id] as string}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline underline-offset-2 hover:no-underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {String(record.data[field.id]).replace(/^https?:\/\//, "").slice(0, 40)}
                                    </a>
                                  ) : field.type === "notes" ? (
                                    <span className="line-clamp-2 max-w-xs text-muted-foreground">
                                      {formatRecordValue(record.data[field.id], field)}
                                    </span>
                                  ) : (
                                    <span>{formatRecordValue(record.data[field.id], field)}</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-2 py-3 text-right align-top">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditingRecord(record)}>
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => deleteRecord(record)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create section dialog */}
      <SectionDialog
        open={showCreateSection}
        initial={emptySection()}
        onClose={() => setShowCreateSection(false)}
        onSave={createSection}
      />

      {/* Edit section dialog */}
      <SectionDialog
        open={editingSection !== null}
        initial={editingSection ? sectionToForm(editingSection) : emptySection()}
        onClose={() => setEditingSection(null)}
        onSave={updateSection}
      />

      {/* Create record dialog */}
      {selectedSection && (
        <RecordDialog
          open={showCreateRecord}
          section={selectedSection}
          initial={{}}
          onClose={() => setShowCreateRecord(false)}
          onSave={createRecord}
        />
      )}

      {/* Edit record dialog */}
      {selectedSection && editingRecord && (
        <RecordDialog
          open={editingRecord !== null}
          section={selectedSection}
          initial={editingRecord.data}
          onClose={() => setEditingRecord(null)}
          onSave={updateRecord}
        />
      )}
    </DashboardLayout>
  )
}
