"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, Palette } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { WhiteboardEditor } from "@/components/whiteboard/whiteboard-editor"
import { WhiteboardRoom, WhiteboardSetupError } from "@/components/whiteboard/whiteboard-room"
import { WhiteboardShareDialog } from "@/components/whiteboard/share-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Board = {
  id: string
  title: string
  description: string | null
  liveblocks_room_id: string
  visibility: "private" | "shared" | "public_link"
  share_token: string | null
  role: "owner" | "editor" | "viewer"
}

type Collaborator = {
  id: string
  user_id: string | null
  email: string | null
  role: "owner" | "editor" | "viewer"
  name?: string | null
}

function colorFor(seed: string) {
  const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5"]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

export default function WhiteboardDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const loadBoard = useCallback(async () => {
    try {
      const response = await fetch(`/api/whiteboards/${params.id}`)
      const data = await response.json()
      if (!response.ok) {
        return { board: null, error: data.error || "Could not load whiteboard" }
      }
      return {
        board: data.board as Board,
        collaborators: Array.isArray(data.collaborators) ? data.collaborators : [],
        configured: data.liveblocks_configured !== false,
        error: "",
      }
    } catch {
      return { board: null, error: "Could not load whiteboard" }
    }
  }, [params.id])

  useEffect(() => {
    if (!user || !params.id) return
    let cancelled = false
    loadBoard().then((result) => {
      if (cancelled) return
      if (result.board) {
        setBoard(result.board)
        setCollaborators(result.collaborators ?? [])
        setConfigured(result.configured ?? true)
      } else {
        setError(result.error)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [params.id, user, loadBoard])

  const rename = async (title: string) => {
    if (!board) return
    const response = await fetch(`/api/whiteboards/${board.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (response.ok) {
      const data = await response.json()
      setBoard(data.board)
    }
  }

  return (
    <DashboardLayout title="Whiteboard" subtitle="Realtime visual planning">
      <div className="space-y-4">
        <Button type="button" variant="ghost" className="gap-2" onClick={() => router.push("/whiteboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back to whiteboards
        </Button>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[70vh] w-full" />
          </div>
        ) : error ? (
          <AppEmptyState icon={AlertTriangle} title="Whiteboard unavailable" hint={error} primaryAction={{ label: "Back to whiteboards", href: "/whiteboard" }} />
        ) : !board ? (
          <AppEmptyState icon={Palette} title="Whiteboard not found" hint="This board may have been archived or you may not have access." />
        ) : !configured ? (
          <WhiteboardSetupError />
        ) : (
          <>
            <WhiteboardRoom roomId={board.liveblocks_room_id} userColor={colorFor(user?.id || board.id)}>
              <WhiteboardEditor
                board={board}
                canEdit={board.role === "owner" || board.role === "editor"}
                initialTemplate={searchParams.get("template") || "blank"}
                onShare={() => setShareOpen(true)}
                onRename={rename}
              />
            </WhiteboardRoom>
            <WhiteboardShareDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              board={board}
              collaborators={collaborators}
              onChanged={loadBoard}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
