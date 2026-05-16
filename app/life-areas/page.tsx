"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Edit, Plus, Trash2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaIcon } from "@/components/life-area-controls"
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import {
  LIFE_AREA_COLORS,
  LIFE_AREA_ICONS,
  type LifeArea,
  normalizeLifeArea,
} from "@/lib/life-areas"

type AreaForm = {
  id?: string
  name: string
  icon: string
  color: string
  description: string
  sort_order: number
}

const emptyForm: AreaForm = {
  name: "",
  icon: "Target",
  color: "#2563EB",
  description: "",
  sort_order: 0,
}

export default function LifeAreasPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [areas, setAreas] = useState<LifeArea[]>([])
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AreaForm>(emptyForm)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) fetchAreas()
  }, [loading, user, router])

  const fetchAreas = async () => {
    setLoadingAreas(true)
    try {
      const response = await fetch("/api/life-areas")
      if (!response.ok) throw new Error("Failed to load life areas")
      const data = await response.json()
      setAreas(Array.isArray(data) ? data.map(normalizeLifeArea) : [])
    } catch (error) {
      console.error("Failed to fetch life areas:", error)
      setAreas([])
    } finally {
      setLoadingAreas(false)
    }
  }

  const sortedAreas = useMemo(
    () => [...areas].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [areas]
  )

  const openCreate = () => {
    setForm({ ...emptyForm, sort_order: sortedAreas.length })
    setDialogOpen(true)
  }

  const openEdit = (area: LifeArea) => {
    setForm({
      id: area.id,
      name: area.name,
      icon: area.icon,
      color: area.color,
      description: area.description || "",
      sort_order: area.sort_order,
    })
    setDialogOpen(true)
  }

  const saveArea = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/life-areas", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error("Failed to save life area")
      const saved = normalizeLifeArea(await response.json())
      setAreas((prev) => {
        if (form.id) return prev.map((area) => (area.id === saved.id ? saved : area))
        return [...prev, saved]
      })
      setDialogOpen(false)
      setForm(emptyForm)
    } catch (error) {
      console.error("Failed to save life area:", error)
    } finally {
      setSaving(false)
    }
  }

  const deleteArea = async (area: LifeArea) => {
    if (!confirm(`Delete "${area.name}"? Linked records will stay unassigned.`)) return
    try {
      const response = await fetch("/api/life-areas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: area.id }),
      })
      if (!response.ok) throw new Error("Failed to delete life area")
      setAreas((prev) => prev.filter((item) => item.id !== area.id))
    } catch (error) {
      console.error("Failed to delete life area:", error)
    }
  }

  const reorder = async (area: LifeArea, direction: -1 | 1) => {
    const currentIndex = sortedAreas.findIndex((item) => item.id === area.id)
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= sortedAreas.length) return

    const nextAreas = [...sortedAreas]
    const [moved] = nextAreas.splice(currentIndex, 1)
    nextAreas.splice(nextIndex, 0, moved)
    const ordered = nextAreas.map((item, index) => ({ ...item, sort_order: index }))
    setAreas(ordered)

    try {
      const response = await fetch("/api/life-areas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ordered.map((item) => item.id) }),
      })
      if (!response.ok) throw new Error("Failed to reorder life areas")
      const data = await response.json()
      setAreas(Array.isArray(data) ? data.map(normalizeLifeArea) : ordered)
    } catch (error) {
      console.error("Failed to reorder life areas:", error)
      fetchAreas()
    }
  }

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

  return (
    <DashboardLayout title="Life Areas" subtitle="Organize your work, money, health, relationships, and personal priorities">
      <div className="space-y-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Life Areas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create the major buckets that your tasks, goals, notes, money, and trackers belong to.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Area
          </Button>
        </section>

        {loadingAreas ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedAreas.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No life areas yet</EmptyTitle>
              <EmptyDescription>Create your first area to start grouping your LifeSort data.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Life Area
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedAreas.map((area, index) => (
              <Card key={area.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: area.color }}>
                        <LifeAreaIcon name={area.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{area.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{area.description || "No description"}</CardDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => reorder(area, -1)} disabled={index === 0} title="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => reorder(area, 1)} disabled={index === sortedAreas.length - 1} title="Move down">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Order {index + 1}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(area)} className="gap-2">
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteArea(area)} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Life Area" : "Create Life Area"}</DialogTitle>
              <DialogDescription>Choose a name, icon, and accent color for this part of your life.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="area-name">Name</Label>
                <Input id="area-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area-description">Description</Label>
                <Textarea id="area-description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="grid grid-cols-8 gap-2">
                  {LIFE_AREA_ICONS.map((icon) => (
                    <Button
                      key={icon}
                      type="button"
                      variant={form.icon === icon ? "default" : "outline"}
                      size="icon"
                      onClick={() => setForm((prev) => ({ ...prev, icon }))}
                      title={icon}
                    >
                      <LifeAreaIcon name={icon} className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent</Label>
                <div className="flex flex-wrap gap-2">
                  {LIFE_AREA_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-8 w-8 rounded-full border-2 ${form.color === color ? "border-foreground" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setForm((prev) => ({ ...prev, color }))}
                      aria-label={`Choose ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveArea} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save Area"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
