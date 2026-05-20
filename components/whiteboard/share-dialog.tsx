"use client"

import { Copy, Link2, Trash2, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Collaborator = {
  id: string
  user_id: string | null
  email: string | null
  role: "owner" | "editor" | "viewer"
  name?: string | null
}

type Board = {
  id: string
  title: string
  visibility: "private" | "shared" | "public_link"
  share_token: string | null
  role: "owner" | "editor" | "viewer"
}

export function WhiteboardShareDialog({
  open,
  onOpenChange,
  board,
  collaborators,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  board: Board
  collaborators: Collaborator[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"viewer" | "editor">("viewer")
  const [shareUrl, setShareUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const isOwner = board.role === "owner"

  useEffect(() => {
    if (typeof window !== "undefined" && board.share_token) {
      setShareUrl(`${window.location.origin}/whiteboard/share/${board.share_token}`)
    }
  }, [board.share_token])

  const enablePublicLink = async (rotate = false) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/whiteboards/${board.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "public_link", rotate }),
      })
      const data = await response.json()
      if (response.ok) {
        setShareUrl(data.share_url)
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  const invite = async () => {
    if (!email.trim()) return
    setBusy(true)
    try {
      const response = await fetch(`/api/whiteboards/${board.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      })
      if (response.ok) {
        setEmail("")
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  const updateRole = async (collaboratorId: string, nextRole: "viewer" | "editor") => {
    const response = await fetch(`/api/whiteboards/${board.id}/collaborators/${collaboratorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    })
    if (response.ok) onChanged()
  }

  const remove = async (collaboratorId: string) => {
    const response = await fetch(`/api/whiteboards/${board.id}/collaborators/${collaboratorId}`, {
      method: "DELETE",
    })
    if (response.ok) onChanged()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share whiteboard</DialogTitle>
          <DialogDescription>Editors can draw and change the board. Viewers can only watch.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Login-gated share link</p>
                <p className="text-sm text-muted-foreground">Anyone with this link must sign in and joins as a viewer.</p>
              </div>
              <Badge variant="outline" className="capitalize">{board.visibility.replace("_", " ")}</Badge>
            </div>
            <div className="mt-3 flex gap-2">
              <Input readOnly value={shareUrl || "Create a share link to copy it"} />
              <Button type="button" variant="outline" disabled={!shareUrl} onClick={() => navigator.clipboard?.writeText(shareUrl)} title="Copy share link">
                <Copy className="h-4 w-4" />
              </Button>
              {isOwner && (
                <Button type="button" onClick={() => enablePublicLink(false)} disabled={busy}>
                  <Link2 className="h-4 w-4" />
                  Enable
                </Button>
              )}
            </div>
            {isOwner && board.share_token && (
              <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs" onClick={() => enablePublicLink(true)} disabled={busy}>
                Rotate share link
              </Button>
            )}
          </div>

          {isOwner && (
            <div className="rounded-lg border p-4">
              <Label>Invite by email</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" type="email" />
                <Select value={role} onValueChange={(value) => setRole(value as "viewer" | "editor")}>
                  <SelectTrigger className="sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={invite} disabled={busy || !email.trim()}>
                  <UserPlus className="h-4 w-4" />
                  Invite
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Email delivery is not enabled yet; access is granted when that email signs in.</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Collaborators</p>
            <div className="divide-y rounded-lg border">
              {collaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{collaborator.name || collaborator.email || collaborator.user_id || "Invited user"}</p>
                    <p className="truncate text-xs text-muted-foreground">{collaborator.email || collaborator.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner && collaborator.role !== "owner" ? (
                      <Select value={collaborator.role} onValueChange={(value) => updateRole(collaborator.id, value as "viewer" | "editor")}>
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize">{collaborator.role}</Badge>
                    )}
                    {isOwner && collaborator.role !== "owner" && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(collaborator.id)} aria-label="Remove collaborator">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
