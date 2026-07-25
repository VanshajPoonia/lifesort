"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckSquare,
  FileText,
  FolderKanban,
  Link2,
  Loader2,
  Paintbrush,
  Plus,
  Save,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Space = {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  favorite: boolean
  archived_at: string | null
  updated_at: string
  item_count: number
}

type ItemType = "note" | "whiteboard" | "task" | "link" | "project" | "custom_section"

type SpaceItem = {
  id: string
  item_type: ItemType
  item_id: string
  title: string
  subtitle: string
  href: string
  updated_at: string | null
  missing: boolean
}

type SourceItem = {
  id: string
  title: string
  subtitle: string
}

const RECENTS_KEY = "lifesort:recent-spaces"

const tabs: Array<{ value: ItemType; label: string; icon: LucideIcon; empty: string }> = [
  { value: "note", label: "Pages/Notes", icon: FileText, empty: "Link notes or create a page for this space." },
  { value: "whiteboard", label: "Whiteboards", icon: Paintbrush, empty: "Add a visual canvas for mapping ideas." },
  { value: "task", label: "Tasks", icon: CheckSquare, empty: "Collect related actions without moving them out of Tasks." },
  { value: "link", label: "Links", icon: Link2, empty: "Attach useful references and resources." },
  { value: "project", label: "Projects", icon: FolderKanban, empty: "Bring related projects into this space." },
  { value: "custom_section", label: "Templates", icon: Sparkles, empty: "Link reusable custom sections and systems." },
]

function rememberSpace(id: string) {
  if (typeof window === "undefined") return
  try {
    const value = window.localStorage.getItem(RECENTS_KEY)
    const parsed = value ? JSON.parse(value) : []
    const current = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([id, ...current.filter((item) => item !== id)].slice(0, 8)))
  } catch {
    // Recents should never block opening a space.
  }
}

function formatDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function SpaceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [space, setSpace] = useState<Space | null>(null)
  const [items, setItems] = useState<SpaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<ItemType>("note")
  const [titleDraft, setTitleDraft] = useState("")
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const loadSpace = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [spaceResponse, itemsResponse] = await Promise.all([
        fetch(`/api/spaces/${params.id}`),
        fetch(`/api/spaces/${params.id}/items`),
      ])
      const spaceData = await spaceResponse.json()
      const itemsData = await itemsResponse.json()
      if (!spaceResponse.ok) {
        setError(spaceData.error || "Could not load space")
        return
      }
      setSpace(spaceData.space)
      setTitleDraft(spaceData.space.name)
      setDescriptionDraft(spaceData.space.description || "")
      setItems(itemsResponse.ok && Array.isArray(itemsData.items) ? itemsData.items : [])
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (!user || !params.id) return
    rememberSpace(params.id)
    // Flagged by react-hooks/set-state-in-effect: loadSpace is shared with
    // the archive/unarchive handler below, which needs the reload after.
    loadSpace()
  }, [params.id, user, loadSpace])

  const saveSpace = async () => {
    if (!space || !titleDraft.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/spaces/${space.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: titleDraft, description: descriptionDraft }),
      })
      const data = await response.json()
      if (response.ok) setSpace(data.space)
    } finally {
      setSaving(false)
    }
  }

  const removeItem = async (item: SpaceItem) => {
    if (!space) return
    const response = await fetch(`/api/spaces/${space.id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_type: item.item_type, item_id: item.item_id }),
    })
    if (response.ok) loadSpace()
  }

  const grouped = useMemo(() => {
    return tabs.reduce((acc, tab) => {
      acc[tab.value] = items.filter((item) => item.item_type === tab.value)
      return acc
    }, {} as Record<ItemType, SpaceItem[]>)
  }, [items])

  return (
    <DashboardLayout title="Space" subtitle="A workspace container for related LifeSort records">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <Button type="button" variant="ghost" className="gap-2" onClick={() => router.push("/spaces")}>
          <ArrowLeft className="h-4 w-4" />
          Back to spaces
        </Button>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        ) : error ? (
          <AppEmptyState icon={FolderKanban} title="Space unavailable" hint={error} primaryAction={{ label: "Open Spaces", href: "/spaces" }} />
        ) : space ? (
          <>
            <section className="surface-card rounded-lg border bg-card/95 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{space.item_count || items.length} linked items</Badge>
                    {space.archived_at && <Badge variant="secondary">Archived</Badge>}
                  </div>
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={saveSpace}
                    className="h-auto border-transparent bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:border-ring sm:text-3xl"
                    aria-label="Space title"
                  />
                  <Textarea
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    onBlur={saveSpace}
                    placeholder="Describe what belongs here..."
                    className="min-h-20 resize-none border-transparent bg-transparent px-0 text-sm shadow-none focus-visible:border-ring"
                    aria-label="Space description"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={saveSpace} disabled={saving || !titleDraft.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add existing
                  </Button>
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Create inside
                  </Button>
                </div>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ItemType)} className="space-y-4">
              <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="min-w-max flex-1 sm:flex-none">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="space-y-4">
                  <ItemList type={tab.value} items={grouped[tab.value] || []} empty={tab.empty} onRemove={removeItem} />
                </TabsContent>
              ))}
            </Tabs>

            <AddExistingDialog open={addOpen} onOpenChange={setAddOpen} spaceId={space.id} defaultType={activeTab} onChanged={loadSpace} />
            <CreateInsideDialog open={createOpen} onOpenChange={setCreateOpen} spaceId={space.id} defaultType={activeTab} onChanged={loadSpace} />
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}

function ItemList({
  type,
  items,
  empty,
  onRemove,
}: {
  type: ItemType
  items: SpaceItem[]
  empty: string
  onRemove: (item: SpaceItem) => void
}) {
  const tab = tabs.find((item) => item.value === type) || tabs[0]
  const Icon = tab.icon
  if (!items.length) {
    return <AppEmptyState icon={Icon} title={`No ${tab.label.toLowerCase()} yet`} hint={empty} className="border-dashed bg-background/70" />
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id} className={cn("surface-card", item.missing && "border-dashed opacity-80")}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {item.missing ? item.title : (
                    <Link href={item.href} className="hover:text-primary">
                      {item.title}
                    </Link>
                  )}
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2">{item.subtitle}</CardDescription>
              </div>
              <Badge variant={item.missing ? "outline" : "secondary"}>{tab.label.replace("Pages/", "")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{item.updated_at ? `Updated ${formatDate(item.updated_at)}` : "Linked item"}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item)} aria-label="Remove from space">
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function typeLabel(type: ItemType) {
  return tabs.find((tab) => tab.value === type)?.label || type
}

async function fetchSourceItems(type: ItemType): Promise<SourceItem[]> {
  const endpoint: Record<ItemType, string> = {
    note: "/api/notes",
    whiteboard: "/api/whiteboards",
    task: "/api/tasks",
    link: "/api/links",
    project: "/api/projects",
    custom_section: "/api/custom-sections",
  }
  const response = await fetch(endpoint[type])
  if (!response.ok) return []
  const data = await response.json()
  const rows = Array.isArray(data) ? data : Array.isArray(data.boards) ? data.boards : []
  return rows.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    title: String(item.title || item.name || "Untitled"),
    subtitle: String(item.description || item.url || item.status || typeLabel(type)),
  }))
}

function AddExistingDialog({
  open,
  onOpenChange,
  spaceId,
  defaultType,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  spaceId: string
  defaultType: ItemType
  onChanged: () => void
}) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [sourceItems, setSourceItems] = useState<SourceItem[]>([])
  const [itemId, setItemId] = useState("")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: this dialog instance is
    // reused across opens and needs to reset the type each time it opens.
    if (open) setType(defaultType)
  }, [defaultType, open])

  useEffect(() => {
    if (!open) return
    // Flagged by react-hooks/set-state-in-effect: re-runs when the dialog
    // opens or the source type changes and needs the loading indicator on.
    setItemId("")
    setLoading(true)
    fetchSourceItems(type)
      .then(setSourceItems)
      .finally(() => setLoading(false))
  }, [open, type])

  const add = async () => {
    if (!itemId) return
    setBusy(true)
    try {
      const response = await fetch(`/api/spaces/${spaceId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: type, item_id: itemId }),
      })
      if (response.ok) {
        onOpenChange(false)
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add existing item</DialogTitle>
          <DialogDescription>Link an existing LifeSort record without duplicating it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId} disabled={loading || sourceItems.length === 0}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={loading ? "Loading..." : "Choose an item"} />
              </SelectTrigger>
              <SelectContent>
                {sourceItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && sourceItems.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No existing items found for this type.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={add} disabled={busy || !itemId}>Add to space</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateInsideDialog({
  open,
  onOpenChange,
  spaceId,
  defaultType,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  spaceId: string
  defaultType: ItemType
  onChanged: () => void
}) {
  const [type, setType] = useState<ItemType>(defaultType)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    // Flagged by react-hooks/set-state-in-effect: this dialog instance is
    // reused across opens and needs to reset its form each time it opens.
    setType(defaultType)
    setTitle("")
    setDescription("")
    setUrl("")
  }, [defaultType, open])

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const response = await fetch(`/api/spaces/${spaceId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: type, create_new: true, title, description, url }),
      })
      if (response.ok) {
        onOpenChange(false)
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create inside space</DialogTitle>
          <DialogDescription>Create a real LifeSort record and link it to this space.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="new-space-item-title">Title</Label>
            <Input id="new-space-item-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" />
          </div>
          {type === "link" && (
            <div>
              <Label htmlFor="new-space-item-url">URL</Label>
              <Input id="new-space-item-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="mt-2" />
            </div>
          )}
          <div>
            <Label htmlFor="new-space-item-description">Description</Label>
            <Textarea id="new-space-item-description" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={create} disabled={busy || !title.trim()}>Create and link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
