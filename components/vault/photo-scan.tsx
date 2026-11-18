"use client"

import { useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"

import { localToday } from "@/components/kits/kit-icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { defaultChoices, emptyDraft, renewalAnchor, VAULT_CATEGORIES, type PhotoDraft } from "@/lib/photo-scan"

const CATEGORY_LABELS: Record<(typeof VAULT_CATEGORIES)[number], string> = {
  documents: "Documents",
  subscriptions: "Subscriptions",
  warranty: "Warranty",
  insurance: "Insurance",
  vehicle: "Vehicle",
  home: "Home",
  medical: "Medical",
  education: "Education",
  work: "Work",
  other: "Other",
}

const MAX_SIDE = 1600
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024

type Choices = { remind: boolean; budget: boolean; task: boolean }

// Shrinks the photo for the AI. Browsers that can't decode it (some HEIC files) send the original.
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

async function uploadPhoto(vaultItemId: number, file: File): Promise<boolean> {
  const start = await fetch("/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      item_type: "vault_item",
      item_id: vaultItemId,
      file_name: file.name || "photo.jpg",
      file_size: file.size,
      mime_type: file.type || "image/jpeg",
    }),
  })
  if (!start.ok) return false
  const { attachment, upload_url: uploadUrl } = await start.json()
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/jpeg" }, body: file }).catch(() => null)
  if (put?.ok) return true
  await fetch(`/api/attachments/${attachment.id}`, { method: "DELETE" })
  return false
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

// "Scan a photo": the AI drafts a Vault entry and what goes with it, the person checks and saves.
export function PhotoScanButton({ label, onSaved }: { label?: string; onSaved?: () => void }) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<PhotoDraft>(emptyDraft)
  const [choices, setChoices] = useState<Choices>({ remind: false, budget: false, task: false })
  const [saving, setSaving] = useState(false)

  const today = localToday()
  const anchor = renewalAnchor(draft)
  const set = <K extends keyof PhotoDraft>(key: K, value: PhotoDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const close = () => {
    setOpen(false)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
  }

  const scan = async (picked: File) => {
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    setDraft(emptyDraft())
    setNotice(null)
    setOpen(true)
    setReading(true)
    try {
      const small = await shrinkPhoto(picked)
      const body = new FormData()
      body.append("photo", small, "photo.jpg")
      body.append("today", today)
      const response = await fetch("/api/ai/photo", { method: "POST", body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Couldn't read that photo. You can fill it in yourself.")
      setDraft(data.draft)
      setChoices(defaultChoices(data.draft, today))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't read that photo. You can fill it in yourself.")
      setChoices({ remind: false, budget: false, task: false })
    } finally {
      setReading(false)
    }
  }

  const save = async () => {
    if (!file || !draft.title.trim()) return
    setSaving(true)
    try {
      const response = await fetch("/api/vault/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          today,
          title: draft.title.trim(),
          category: draft.category,
          summary: draft.summary,
          issuer: draft.issuer,
          reference: draft.reference,
          document_date: draft.documentDate,
          start_date: draft.startDate,
          expiry_date: draft.expiryDate,
          renewal_date: draft.renewalDate,
          due_date: draft.dueDate,
          amount: draft.amount,
          currency: draft.currency,
          due_action: draft.dueAction,
          remind: choices.remind && Boolean(anchor && anchor >= today),
          budget: choices.budget && Boolean(draft.amount),
          task: choices.task && Boolean(draft.dueDate),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Couldn't save that. Try again.")

      const kept = data.storage_ready && file.size <= MAX_ORIGINAL_BYTES ? await uploadPhoto(data.vault_item_id, file) : false
      const extras = [
        data.tasks_added ? plural(data.tasks_added, "task") : null,
        data.spending_added ? "a budget line" : null,
      ].filter(Boolean)
      toast({
        title: "Saved to your Vault",
        description: [
          extras.length ? `Also added ${extras.join(" and ")}.` : null,
          kept ? null : "The photo itself wasn't kept, because file storage isn't ready.",
        ].filter(Boolean).join(" ") || undefined,
      })
      close()
      onSaved?.()
    } catch (error) {
      toast({ title: "Not saved", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const picked = event.target.files?.[0]
          event.target.value = ""
          if (picked) void scan(picked)
        }}
      />
      {label ? (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="gap-2">
          <Camera className="h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => inputRef.current?.click()}
          aria-label="Snap a bill, policy or ID"
          title="Snap a bill, policy or ID"
          className="shrink-0"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>File this photo</DialogTitle>
            <DialogDescription>
              {reading ? "Reading your photo..." : "Check the details. Nothing is saved until you tap Save."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
              <img src={preview} alt="Your photo" className="h-24 w-20 shrink-0 rounded-md border object-cover" />
            )}
            <p className="text-xs text-muted-foreground">
              {reading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> This can take up to a minute.</span>
              ) : notice ?? "Google's Gemini read this photo to fill in the form. Change anything that's wrong."}
            </p>
          </div>

          {!reading && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="photo-title">Name</Label>
                <Input id="photo-title" value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Car insurance" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="photo-category">Vault section</Label>
                  <Select value={draft.category} onValueChange={(value) => set("category", value as PhotoDraft["category"])}>
                    <SelectTrigger id="photo-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VAULT_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{CATEGORY_LABELS[category]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="photo-amount">Amount{draft.currency ? ` (${draft.currency})` : ""}</Label>
                  <Input
                    id="photo-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draft.amount ?? ""}
                    onChange={(event) => {
                      const value = Number.parseFloat(event.target.value)
                      set("amount", Number.isFinite(value) && value > 0 ? value : null)
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="photo-expiry">Expires</Label>
                  <Input id="photo-expiry" type="date" value={draft.expiryDate ?? ""} onChange={(event) => set("expiryDate", event.target.value || null)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="photo-renewal">Renews</Label>
                  <Input id="photo-renewal" type="date" value={draft.renewalDate ?? ""} onChange={(event) => set("renewalDate", event.target.value || null)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="photo-due">Something due by</Label>
                  <Input id="photo-due" type="date" value={draft.dueDate ?? ""} onChange={(event) => set("dueDate", event.target.value || null)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo-summary">Notes</Label>
                <Textarea id="photo-summary" rows={2} value={draft.summary ?? ""} onChange={(event) => set("summary", event.target.value || null)} />
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Also add</p>
                {anchor && anchor >= today && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={choices.remind} onCheckedChange={(value) => setChoices((current) => ({ ...current, remind: value === true }))} />
                    <span>A reminder to renew, two weeks before {anchor}</span>
                  </label>
                )}
                {draft.dueDate && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={choices.task} onCheckedChange={(value) => setChoices((current) => ({ ...current, task: value === true }))} />
                    <span>A task: {draft.dueAction || `Deal with ${draft.title || "this"}`}, due {draft.dueDate < today ? "today" : draft.dueDate}</span>
                  </label>
                )}
                {draft.amount && (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox checked={choices.budget} onCheckedChange={(value) => setChoices((current) => ({ ...current, budget: value === true }))} />
                    <span>{draft.currency ? `${draft.currency} ` : ""}{draft.amount} as spending in Money</span>
                  </label>
                )}
                {!(anchor && anchor >= today) && !draft.dueDate && !draft.amount && (
                  <p className="text-xs text-muted-foreground">Add a date or an amount to get a reminder, a task or a budget line.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={reading || saving || !draft.title.trim()} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
