"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, FolderKanban, Grid2X2, List, Plus, Search, Star, StarOff } from "lucide-react"

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
  activity_at: string | null
  item_count: number
}

const RECENTS_KEY = "lifesort:recent-spaces"

const colorOptions = [
  { label: "Purple", value: "primary", className: "bg-primary" },
  { label: "Blue", value: "blue", className: "bg-blue-500" },
  { label: "Teal", value: "teal", className: "bg-teal-500" },
  { label: "Green", value: "green", className: "bg-green-500" },
  { label: "Amber", value: "amber", className: "bg-amber-500" },
  { label: "Rose", value: "rose", className: "bg-rose-500" },
]

function colorClass(color: string) {
  return colorOptions.find((item) => item.value === color)?.className || "bg-primary"
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No activity yet"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function readRecentIds() {
  if (typeof window === "undefined") return []
  try {
    const value = window.localStorage.getItem(RECENTS_KEY)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

export default function SpacesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [sort, setSort] = useState<"recent" | "name" | "favorites">("recent")
  const [showArchived, setShowArchived] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [recents, setRecents] = useState<string[]>([])

  useEffect(() => {
    setRecents(readRecentIds())
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
    if (!authLoading && user) loadSpaces()
    if (!authLoading && !user) setLoading(false)
  }, [authLoading, router, user, showArchived])

  const loadSpaces = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/spaces${showArchived ? "?archived=true" : ""}`)
      const data = await response.json()
      if (response.ok) setSpaces(Array.isArray(data.spaces) ? data.spaces : [])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    const base = spaces.filter((space) => {
      if (!showArchived && space.archived_at) return false
      return !text || `${space.name} ${space.description || ""}`.toLowerCase().includes(text)
    })
    return [...base].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "favorites") return Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)
      return new Date(b.activity_at || b.updated_at).getTime() - new Date(a.activity_at || a.updated_at).getTime()
    })
  }, [query, showArchived, sort, spaces])

  const favorites = filtered.filter((space) => space.favorite)
  const recentlyOpened = recents.map((id) => spaces.find((space) => space.id === id)).filter(Boolean) as Space[]

  const toggleFavorite = async (space: Space) => {
    const response = await fetch(`/api/spaces/${space.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !space.favorite }),
    })
    if (response.ok) loadSpaces()
  }

  const archiveSpace = async (space: Space) => {
    const response = await fetch(`/api/spaces/${space.id}`, { method: "DELETE" })
    if (response.ok) loadSpaces()
  }

  return (
    <DashboardLayout title="Spaces" subtitle="Group related notes, boards, tasks, links, projects, and systems.">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <section className="surface-card rounded-lg border bg-card/95 p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Spaces for the parts of your life</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Build hubs for Work Projects, YouTube, Family/Home, Finance, Learning, research, or any system that needs multiple LifeSort records together.
              </p>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create space
            </Button>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search spaces..." className="pl-9" />
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
            <SelectTrigger className="md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => setShowArchived((value) => !value)}>
            <Archive className="h-4 w-4" />
            {showArchived ? "Hide archived" : "Archived"}
          </Button>
          <div className="flex rounded-lg border p-1">
            <Button type="button" variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")} aria-label="Grid view">
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button type="button" variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")} aria-label="List view">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={FolderKanban}
            title="No spaces yet"
            hint="Create a space for a life area, project cluster, research hub, or home system."
            primaryAction={{ label: "Create space", onClick: () => setCreateOpen(true) }}
            className="border-dashed bg-background/70"
          />
        ) : (
          <div className="space-y-6">
            {favorites.length > 0 && <SpaceSection title="Favorites" spaces={favorites} view={view} onArchive={archiveSpace} onToggleFavorite={toggleFavorite} />}
            {recentlyOpened.length > 0 && <SpaceSection title="Recently opened" spaces={recentlyOpened} view={view} onArchive={archiveSpace} onToggleFavorite={toggleFavorite} />}
            <SpaceSection title={showArchived ? "All spaces" : "Spaces"} spaces={filtered} view={view} onArchive={archiveSpace} onToggleFavorite={toggleFavorite} />
          </div>
        )}

        <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={loadSpaces} />
      </div>
    </DashboardLayout>
  )
}

function SpaceSection({
  title,
  spaces,
  view,
  onArchive,
  onToggleFavorite,
}: {
  title: string
  spaces: Space[]
  view: "grid" | "list"
  onArchive: (space: Space) => void
  onToggleFavorite: (space: Space) => void
}) {
  if (!spaces.length) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3")}>
        {spaces.map((space) => (
          <SpaceCard key={`${title}-${space.id}`} space={space} view={view} onArchive={onArchive} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    </section>
  )
}

function SpaceCard({
  space,
  view,
  onArchive,
  onToggleFavorite,
}: {
  space: Space
  view: "grid" | "list"
  onArchive: (space: Space) => void
  onToggleFavorite: (space: Space) => void
}) {
  return (
    <Card className={cn("surface-card interactive-card", view === "list" && "sm:flex sm:items-center sm:justify-between")}>
      <CardHeader className={cn(view === "list" && "sm:flex-1")}>
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white", colorClass(space.color))}>
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              <Link href={`/spaces/${space.id}`} className="hover:text-primary">
                {space.name}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{space.description || "A LifeSort workspace"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", view === "list" && "sm:w-80")}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{space.item_count || 0} items</Badge>
          <span>Updated {formatDate(space.activity_at || space.updated_at)}</span>
          {space.archived_at && <Badge variant="secondary">Archived</Badge>}
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/spaces/${space.id}`}>Open</Link>
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onToggleFavorite(space)} aria-label={space.favorite ? "Unfavorite space" : "Favorite space"}>
            {space.favorite ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          </Button>
          {!space.archived_at && (
            <Button type="button" variant="outline" size="icon" onClick={() => onArchive(space)} aria-label="Archive space">
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CreateSpaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("primary")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const response = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      })
      if (response.ok) {
        setName("")
        setDescription("")
        setColor("primary")
        onOpenChange(false)
        onCreated()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create space</DialogTitle>
          <DialogDescription>Start a container for related work, notes, plans, links, and boards.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="space-name">Name</Label>
            <Input id="space-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Work Projects" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="space-description">Description</Label>
            <Textarea id="space-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What belongs in this space?" className="mt-2" />
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {colorOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn("h-8 w-8 rounded-full border-2", item.className, color === item.value ? "border-foreground" : "border-transparent")}
                  onClick={() => setColor(item.value)}
                  aria-label={`Use ${item.label}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={create} disabled={busy || !name.trim()}>Create space</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
