"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Edit, Plus, Trash2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaIcon } from "@/components/life-area-controls"
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import {
  DOMAIN_ATTENTION_OPTIONS,
  DOMAIN_IMPORTANCE_OPTIONS,
  DOMAIN_REVIEW_FREQUENCY_OPTIONS,
  DOMAIN_STATUS_OPTIONS,
  LIFE_AREA_COLORS,
  LIFE_AREA_ICONS,
  type DomainAttention,
  type DomainImportance,
  type DomainReviewFrequency,
  type DomainStatus,
  type LifeArea,
  normalizeLifeArea,
} from "@/lib/life-areas"

type DomainForm = {
  id?: string
  name: string
  icon: string
  color: string
  description: string
  sort_order: number
  status: DomainStatus
  importance: DomainImportance | "none"
  desired_attention: DomainAttention | "none"
  review_frequency: DomainReviewFrequency
}

const emptyForm: DomainForm = {
  name: "",
  icon: "Target",
  color: "#2563EB",
  description: "",
  sort_order: 0,
  status: "active",
  importance: "none",
  desired_attention: "none",
  review_frequency: "none",
}

const STATUS_TABS: { value: DomainStatus | "all"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" },
]

export default function DomainsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [domains, setDomains] = useState<LifeArea[]>([])
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<DomainForm>(emptyForm)
  const [statusFilter, setStatusFilter] = useState<DomainStatus | "all">("active")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) fetchDomains()
  }, [loading, user, router])

  const fetchDomains = async () => {
    setLoadingDomains(true)
    try {
      const response = await fetch("/api/life-areas")
      if (!response.ok) throw new Error("Failed to load life domains")
      const data = await response.json()
      setDomains(Array.isArray(data) ? data.map(normalizeLifeArea) : [])
    } catch (error) {
      console.error("Failed to fetch life domains:", error)
      setDomains([])
    } finally {
      setLoadingDomains(false)
    }
  }

  const sortedDomains = useMemo(
    () => [...domains].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [domains]
  )

  const visibleDomains = useMemo(
    () => (statusFilter === "all" ? sortedDomains : sortedDomains.filter((domain) => domain.status === statusFilter)),
    [sortedDomains, statusFilter]
  )

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sortedDomains.length }
    for (const domain of sortedDomains) counts[domain.status] = (counts[domain.status] || 0) + 1
    return counts
  }, [sortedDomains])

  const openCreate = () => {
    setForm({ ...emptyForm, sort_order: sortedDomains.length })
    setDialogOpen(true)
  }

  const openEdit = (domain: LifeArea) => {
    setForm({
      id: domain.id,
      name: domain.name,
      icon: domain.icon,
      color: domain.color,
      description: domain.description || "",
      sort_order: domain.sort_order,
      status: domain.status,
      importance: domain.importance || "none",
      desired_attention: domain.desired_attention || "none",
      review_frequency: domain.review_frequency,
    })
    setDialogOpen(true)
  }

  const saveDomain = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/life-areas", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          importance: form.importance === "none" ? null : form.importance,
          desired_attention: form.desired_attention === "none" ? null : form.desired_attention,
        }),
      })
      if (!response.ok) throw new Error("Failed to save life domain")
      const saved = normalizeLifeArea(await response.json())
      setDomains((prev) => {
        if (form.id) return prev.map((domain) => (domain.id === saved.id ? saved : domain))
        return [...prev, saved]
      })
      setDialogOpen(false)
      setForm(emptyForm)
    } catch (error) {
      console.error("Failed to save life domain:", error)
    } finally {
      setSaving(false)
    }
  }

  const deleteDomain = async (domain: LifeArea) => {
    if (!confirm(`Delete "${domain.name}"? Linked records will stay unassigned.`)) return
    try {
      const response = await fetch("/api/life-areas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: domain.id }),
      })
      if (!response.ok) throw new Error("Failed to delete life domain")
      setDomains((prev) => prev.filter((item) => item.id !== domain.id))
    } catch (error) {
      console.error("Failed to delete life domain:", error)
    }
  }

  const setStatus = async (domain: LifeArea, status: DomainStatus) => {
    setDomains((prev) => prev.map((item) => (item.id === domain.id ? { ...item, status } : item)))
    try {
      const response = await fetch("/api/life-areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...domain, status }),
      })
      if (!response.ok) throw new Error("Failed to update status")
      const saved = normalizeLifeArea(await response.json())
      setDomains((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      console.error("Failed to update life domain status:", error)
      fetchDomains()
    }
  }

  const reorder = async (domain: LifeArea, direction: -1 | 1) => {
    const currentIndex = sortedDomains.findIndex((item) => item.id === domain.id)
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= sortedDomains.length) return

    const nextDomains = [...sortedDomains]
    const [moved] = nextDomains.splice(currentIndex, 1)
    nextDomains.splice(nextIndex, 0, moved)
    const ordered = nextDomains.map((item, index) => ({ ...item, sort_order: index }))
    setDomains(ordered)

    try {
      const response = await fetch("/api/life-areas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ordered.map((item) => item.id) }),
      })
      if (!response.ok) throw new Error("Failed to reorder life domains")
      const data = await response.json()
      setDomains(Array.isArray(data) ? data.map(normalizeLifeArea) : ordered)
    } catch (error) {
      console.error("Failed to reorder life domains:", error)
      fetchDomains()
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
    <DashboardLayout title="Life Domains" subtitle="Organize your work, money, health, relationships, and personal priorities">
      <div className="space-y-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Life Domains</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create the major spaces that your tasks, goals, notes, money, and trackers belong to.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Domain
          </Button>
        </section>

        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as DomainStatus | "all")}>
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1 sm:inline-flex sm:w-auto">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-w-20 flex-1 gap-1.5 sm:flex-none">
                {tab.label}
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{statusCounts[tab.value] || 0}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {loadingDomains ? (
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
            ) : visibleDomains.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{statusFilter === "active" ? "No life domains yet" : `No ${statusFilter === "all" ? "" : statusFilter} domains`}</EmptyTitle>
                  <EmptyDescription>Create your first domain to start grouping your LifeSort data.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreate} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Life Domain
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleDomains.map((domain) => {
                  const index = sortedDomains.findIndex((item) => item.id === domain.id)
                  return (
                    <Card
                      key={domain.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
                      onClick={() => router.push(`/domains/${domain.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          router.push(`/domains/${domain.id}`)
                        }
                      }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: domain.color }}>
                              <LifeAreaIcon name={domain.icon} className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="truncate text-base">{domain.name}</CardTitle>
                              <CardDescription className="line-clamp-2">{domain.description || "No description"}</CardDescription>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                reorder(domain, -1)
                              }}
                              disabled={index === 0}
                              title="Move up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                reorder(domain, 1)
                              }}
                              disabled={index === sortedDomains.length - 1}
                              title="Move down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {domain.parent_domain_id && (
                            <Badge variant="outline" className="text-xs">
                              Subdomain of {sortedDomains.find((item) => item.id === domain.parent_domain_id)?.name || "another domain"}
                            </Badge>
                          )}
                          {domain.importance && <Badge variant="outline" className="text-xs capitalize">{domain.importance} importance</Badge>}
                          {domain.desired_attention && <Badge variant="outline" className="text-xs capitalize">Wants {domain.desired_attention} attention</Badge>}
                          {domain.review_frequency !== "none" && <Badge variant="outline" className="text-xs capitalize">{domain.review_frequency} review</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-2">
                        <Select value={domain.status} onValueChange={(value) => setStatus(domain, value as DomainStatus)}>
                          <SelectTrigger className="h-8 w-32 text-xs" onClick={(event) => event.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent onClick={(event) => event.stopPropagation()}>
                            {DOMAIN_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation()
                              openEdit(domain)
                            }}
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteDomain(domain)
                            }}
                            className="gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Life Domain" : "Create Life Domain"}</DialogTitle>
              <DialogDescription>Choose a name, icon, accent color, and how much attention this domain deserves.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="domain-name">Name</Label>
                <Input id="domain-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain-description">Description</Label>
                <Textarea id="domain-description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as DomainStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOMAIN_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Importance</Label>
                  <Select value={form.importance} onValueChange={(value) => setForm((prev) => ({ ...prev, importance: value as DomainImportance | "none" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {DOMAIN_IMPORTANCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Desired attention</Label>
                  <Select value={form.desired_attention} onValueChange={(value) => setForm((prev) => ({ ...prev, desired_attention: value as DomainAttention | "none" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {DOMAIN_ATTENTION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Review frequency</Label>
                  <Select value={form.review_frequency} onValueChange={(value) => setForm((prev) => ({ ...prev, review_frequency: value as DomainReviewFrequency }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOMAIN_REVIEW_FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              <Button onClick={saveDomain} disabled={saving || !form.name.trim()}>{saving ? "Saving..." : "Save Domain"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
