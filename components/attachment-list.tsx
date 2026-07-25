"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export type AttachmentItemType = "task" | "goal" | "project" | "note" | "vault_item"

type Attachment = {
  id: number
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Generic attachments panel for any item type the /api/attachments route supports.
// Files upload directly to Cloudflare R2 via a presigned URL -- the bytes never pass
// through our own API. See lib/r2.ts and app/api/attachments for the server side.
export function AttachmentList({ itemType, itemId }: { itemType: AttachmentItemType; itemId: number }) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/attachments?item_type=${itemType}&item_id=${itemId}`)
      if (!response.ok) return
      const data = await response.json()
      setAttachments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load attachments:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: fetchAttachments is shared
    // with the upload/delete handlers below that need the reload afterward.
    fetchAttachments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemType, itemId])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const response = await fetch("/api/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_type: itemType,
            item_id: itemId,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
          }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not start upload")

        const uploadResponse = await fetch(data.upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        })
        if (!uploadResponse.ok) throw new Error(`Could not upload ${file.name}`)

        setAttachments((prev) => [data.attachment, ...prev])
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
      fetchAttachments()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not open file")
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast({
        title: "Could not open file",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (attachment: Attachment) => {
    setBusyId(attachment.id)
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Could not delete file")
      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
    } catch (error) {
      toast({
        title: "Could not delete file",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          Attachments{attachments.length > 0 ? ` (${attachments.length})` : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Uploading..." : "Add file"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => handleUpload(event.target.files)}
          disabled={uploading}
        />
      </div>
      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => handleDownload(attachment)}
                className="min-w-0 flex-1 truncate text-left hover:underline"
              >
                {attachment.file_name}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</span>
              <button
                type="button"
                onClick={() => handleDelete(attachment)}
                disabled={busyId === attachment.id}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${attachment.file_name}`}
              >
                {busyId === attachment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
