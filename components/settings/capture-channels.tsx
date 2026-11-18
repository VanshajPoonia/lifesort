"use client"

import { useEffect, useState } from "react"
import { Copy, Loader2, Mail, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { waMeLink } from "@/lib/capture-links"

type Channels = {
  email: { ready: boolean; address: string | null }
  whatsapp: { ready: boolean; number: string | null; linked: boolean; phoneEnding: string | null; linkCode: string | null }
}

// Settings > Account: a private email address and a linked WhatsApp number that both drop
// what you send into Inbox. Each says "not set up yet" until the server has its keys.
export function CaptureChannels() {
  const { toast } = useToast()
  const [channels, setChannels] = useState<Channels | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/capture/channels")
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!cancelled && response.ok && data) setChannels(data)
      })
      .catch(() => {
        if (!cancelled) toast({ title: "Couldn't load capture settings", variant: "destructive" })
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const act = async (action: "reset_email" | "link_whatsapp" | "unlink_whatsapp") => {
    setBusy(action)
    const response = await fetch("/api/capture/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const data = await response.json().catch(() => null)
    setBusy(null)
    if (!response.ok || !data) {
      toast({ title: "That didn't work", description: data?.error ?? "Try again.", variant: "destructive" })
      return
    }
    setChannels(data)
    if (action === "reset_email") toast({ title: "New address made", description: "The old one stops working now." })
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied" })
    } catch {
      toast({ title: "Couldn't copy", description: "Select it and copy it yourself.", variant: "destructive" })
    }
  }

  return (
    <section aria-labelledby="capture-channels" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="capture-channels" className="text-lg font-semibold tracking-tight text-foreground">
        Send things to your Inbox
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Forward an email or send a WhatsApp message, and it waits in Inbox for you to sort.</p>

      {!channels ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading</p>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" aria-hidden="true" /> Email</p>
            {channels.email.ready && channels.email.address ? (
              <>
                <div className="mt-2 flex gap-2">
                  <Input readOnly value={channels.email.address} aria-label="Your Inbox email address" onFocus={(event) => event.currentTarget.select()} />
                  <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={() => void copy(channels.email.address ?? "")}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copy
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The subject becomes the title. Keep this address private; anyone who has it can add to your Inbox.{" "}
                  <button type="button" className="underline underline-offset-2" disabled={busy !== null} onClick={() => void act("reset_email")}>
                    Make a new address
                  </button>
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Not set up yet.</p>
            )}
          </div>

          <div>
            <p className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp</p>
            {!channels.whatsapp.ready ? (
              <p className="mt-1 text-sm text-muted-foreground">Not set up yet.</p>
            ) : channels.whatsapp.linked ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Linked to your number ending {channels.whatsapp.phoneEnding}. Text {channels.whatsapp.number} and it lands in Inbox.
                </p>
                <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void act("unlink_whatsapp")}>Unlink</Button>
              </div>
            ) : channels.whatsapp.linkCode ? (
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p>
                  Send <span className="font-mono font-semibold text-foreground">{channels.whatsapp.linkCode}</span> to {channels.whatsapp.number} on
                  WhatsApp from your phone. The code works for 30 minutes.
                </p>
                <Button asChild size="sm" variant="outline">
                  <a href={waMeLink(channels.whatsapp.number ?? "", channels.whatsapp.linkCode)} target="_blank" rel="noreferrer">Open WhatsApp</a>
                </Button>
              </div>
            ) : (
              <Button className="mt-2" size="sm" variant="outline" disabled={busy !== null} onClick={() => void act("link_whatsapp")}>
                Link my WhatsApp
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
