"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Palette, Plus, Search, Share2, Trash2, Users } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

type Whiteboard = {
  id: string
  title: string
  description: string | null
  visibility: "private" | "shared" | "public_link"
  role: "owner" | "editor" | "viewer"
  collaborator_count: number
  updated_at: string
  last_opened_at: string | null
}

export default function WhiteboardIndexPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [boards, setBoards] = useState<Whiteboard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  useEffect(() => {
    if (!user) return
    loadBoards()
  }, [user])

  const loadBoards = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/whiteboards")
      if (response.ok) {
        const data = await response.json()
        setBoards(Array.isArray(data.boards) ? data.boards : [])
      }
    } finally {
      setLoading(false)
    }
  }

  const createBoard = async (template = "blank") => {
    setCreating(true)
    try {
      const response = await fetch("/api/whiteboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled whiteboard", template }),
      })
      const data = await response.json()
      if (response.ok && data.board?.id) {
        router.push(`/whiteboard/${data.board.id}${template === "blank" ? "" : `?template=${template}`}`)
      }
    } finally {
      setCreating(false)
    }
  }

  const archiveBoard = async (id: string) => {
    const response = await fetch(`/api/whiteboards/${id}`, { method: "DELETE" })
    if (response.ok) setBoards((current) => current.filter((board) => board.id !== id))
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return boards
    return boards.filter((board) => `${board.title} ${board.description || ""}`.toLowerCase().includes(text))
  }, [boards, query])

  const recent = filtered.filter((board) => board.role === "owner")
  const shared = filtered.filter((board) => board.role !== "owner")

  return (
    <DashboardLayout title="Whiteboard" subtitle="Sketch plans, maps, workflows, and ideas together.">
      <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
        <section className="surface-card rounded-lg border bg-card/95 p-4 sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Whiteboard</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Sketch ideas into something shareable</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Brainstorm life plans, map goals, plan projects, sketch workflows, organize study notes, or collaborate on home planning.
              </p>
            </div>
            <Button type="button" onClick={() => createBoard()} disabled={creating}>
              <Plus className="h-4 w-4" />
              New board
            </Button>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Blank board", "blank"],
            ["Weekly plan", "weekly_plan"],
            ["Goal map", "goal_map"],
            ["Project brainstorm", "project_brainstorm"],
            ["Budget map", "budget_map"],
          ].map(([label, template]) => (
            <Button key={template} type="button" variant="outline" className="justify-start" onClick={() => createBoard(template)} disabled={creating}>
              <Palette className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search whiteboards..." className="pl-9" />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={Palette}
            title="No whiteboards yet"
            hint="Start sketching an idea, plan, or workflow."
            primaryAction={{ label: "Create whiteboard", onClick: () => createBoard() }}
            className="border-dashed bg-background/70"
          />
        ) : (
          <div className="space-y-6">
            <BoardSection title="Recent boards" boards={recent} onArchive={archiveBoard} />
            {shared.length > 0 && <BoardSection title="Shared with me" boards={shared} onArchive={archiveBoard} />}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

function BoardSection({
  title,
  boards,
  onArchive,
}: {
  title: string
  boards: Whiteboard[]
  onArchive: (id: string) => void
}) {
  if (boards.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} onArchive={onArchive} />
        ))}
      </div>
    </section>
  )
}

function BoardCard({ board, onArchive }: { board: Whiteboard; onArchive: (id: string) => void }) {
  const router = useRouter()
  return (
    <Card className="surface-card interactive-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{board.title}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{board.description || "Collaborative canvas"}</CardDescription>
          </div>
          <Badge variant={board.role === "owner" ? "secondary" : "outline"} className="capitalize">
            {board.role}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {board.collaborator_count || 1}
          </span>
          <span className="inline-flex items-center gap-1 capitalize">
            <Share2 className="h-3.5 w-3.5" />
            {board.visibility.replace("_", " ")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(board.last_opened_at || board.updated_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={() => router.push(`/whiteboard/${board.id}`)}>
            Open
          </Button>
          {board.role === "owner" && (
            <Button type="button" variant="outline" size="icon" onClick={() => onArchive(board.id)} aria-label="Archive board">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
