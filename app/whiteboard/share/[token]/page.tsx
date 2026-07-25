"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Lock, Palette } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type SharedBoard = {
  id: string
  title: string
  description: string | null
  owner_name: string | null
}

export default function WhiteboardSharePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [board, setBoard] = useState<SharedBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState("")

  const loadShare = useCallback(async () => {
    try {
      const response = await fetch(`/api/whiteboards/share/${params.token}`)
      const data = await response.json()
      if (!response.ok) {
        return { board: null, error: data.error || "Share link is unavailable" }
      }
      return { board: data.board as SharedBoard, error: "" }
    } catch {
      return { board: null, error: "Share link is unavailable" }
    }
  }, [params.token])

  useEffect(() => {
    let cancelled = false
    loadShare().then((result) => {
      if (cancelled) return
      if (result.board) setBoard(result.board)
      else setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadShare])

  const accept = async () => {
    setAccepting(true)
    try {
      const response = await fetch(`/api/whiteboards/share/${params.token}/accept`, { method: "POST" })
      const data = await response.json()
      if (response.ok && data.board?.id) {
        router.push(`/whiteboard/${data.board.id}`)
      } else if (response.status === 401) {
        router.push(`/login?next=/whiteboard/share/${params.token}`)
      } else {
        setError(data.error || "Could not join whiteboard")
      }
    } finally {
      setAccepting(false)
    }
  }

  return (
    <DashboardLayout title="Shared Whiteboard" subtitle="Join a collaborative board">
      <div className="mx-auto max-w-2xl">
        {loading ? (
          <Skeleton className="h-72 rounded-lg" />
        ) : error ? (
          <AppEmptyState icon={Palette} title="Share link unavailable" hint={error} primaryAction={{ label: "Open Whiteboards", href: "/whiteboard" }} />
        ) : board ? (
          <Card className="surface-card">
            <CardHeader>
              <div className="rounded-lg bg-primary/10 p-3 text-primary w-fit">
                <Palette className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl">{board.title}</CardTitle>
              <CardDescription>{board.description || `Shared by ${board.owner_name || "a LifeSort user"}`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Lock className="mr-2 inline h-4 w-4" />
                This share link is login-gated. Sign in to join as a viewer.
              </div>
              {authLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : user ? (
                <Button type="button" className="w-full" onClick={accept} disabled={accepting}>
                  Join whiteboard
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <Link href={`/login?next=/whiteboard/share/${params.token}`}>Sign in to join</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
