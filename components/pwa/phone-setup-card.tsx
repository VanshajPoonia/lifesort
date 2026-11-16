"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { BellRing, CheckCircle2, Download, Loader2, Share } from "lucide-react"

import { canPromptInstall, promptInstall, subscribeToInstallPrompt } from "@/components/pwa/install-prompt"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

type PushState = "checking" | "unsupported" | "needs-install" | "not-configured" | "blocked" | "off" | "on"

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const noop = () => () => {}

function subscribeToDisplayMode(listener: () => void) {
  const query = window.matchMedia("(display-mode: standalone)")
  query.addEventListener("change", listener)
  return () => query.removeEventListener("change", listener)
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

async function currentPushState(): Promise<PushState> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  if (!supported) return isIos() && !isStandalone() ? "needs-install" : "unsupported"
  if (!vapidPublicKey) return "not-configured"
  if (Notification.permission === "denied") return "blocked"
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return "unsupported"
  return (await registration.pushManager.getSubscription()) ? "on" : "off"
}

// Settings > Notifications: install LifeSort on the home screen and turn on push for this device.
export function PhoneSetupCard() {
  const { toast } = useToast()
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false)
  const ios = useSyncExternalStore(noop, isIos, () => false)
  const installable = useSyncExternalStore(subscribeToInstallPrompt, canPromptInstall, () => false)
  const [pushState, setPushState] = useState<PushState>("checking")
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let cancelled = false
    currentPushState()
      .then((state) => {
        if (!cancelled) setPushState(state)
      })
      .catch((error) => {
        console.error("[pwa] Could not read push state:", error)
        if (!cancelled) setPushState("unsupported")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const install = async () => {
    const outcome = await promptInstall()
    if (outcome === "accepted") toast({ title: "LifeSort is on your home screen" })
  }

  const turnOn = async () => {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setPushState(permission === "denied" ? "blocked" : "off")
      return
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    })
    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    })
    if (!response.ok) {
      await subscription.unsubscribe()
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || "Couldn't turn on push for this device.")
    }
    setPushState("on")
    toast({ title: "Push reminders are on", description: "Send a test to see one." })
  }

  const turnOff = async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      await subscription.unsubscribe()
    }
    setPushState("off")
  }

  const togglePush = async (checked: boolean) => {
    setBusy(true)
    try {
      await (checked ? turnOn() : turnOff())
    } catch (error) {
      toast({
        title: "Push didn't change",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      const response = await fetch("/api/push/test", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't send a test push.")
      toast({ title: "Test sent", description: "It should arrive in a few seconds." })
    } catch (error) {
      toast({ title: "No test push", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setTesting(false)
    }
  }

  const pushHint: Record<PushState, string> = {
    checking: "Checking this device...",
    unsupported: "This browser can't show push reminders. Email reminders still work.",
    "needs-install": "On iPhone, add LifeSort to your Home Screen first. Then open it from there and turn this on.",
    "not-configured": "Push isn't set up on this server yet.",
    blocked: "Notifications are blocked for LifeSort. Allow them in your browser or phone settings, then come back.",
    off: "A nudge each morning when something is due soon, next to the reminder email.",
    on: "On for this device. You'll get a nudge each morning when something is due soon.",
  }

  return (
    <section aria-labelledby="phone-setup" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="phone-setup" className="text-lg font-semibold tracking-tight text-foreground">
        LifeSort on your phone
      </h2>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Home screen</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {standalone
              ? "Installed. You're using LifeSort as an app."
              : installable
                ? "Add LifeSort to your home screen for one-tap capture."
                : ios
                  ? "In Safari, tap Share, then Add to Home Screen."
                  : "Open LifeSort in Chrome on Android or Safari on iPhone to add it to your home screen."}
          </p>
        </div>
        {standalone ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        ) : installable ? (
          <Button size="sm" className="w-fit shrink-0 gap-2" onClick={() => void install()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Install
          </Button>
        ) : ios ? (
          <Share className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Label htmlFor="push-toggle" className="text-sm font-medium text-foreground">
            Push reminders on this device
          </Label>
          <p className="mt-0.5 text-sm text-muted-foreground">{pushHint[pushState]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {pushState === "on" && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void sendTest()} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BellRing className="h-4 w-4" aria-hidden="true" />}
              Send a test
            </Button>
          )}
          <Switch
            id="push-toggle"
            checked={pushState === "on"}
            disabled={busy || (pushState !== "on" && pushState !== "off")}
            onCheckedChange={(checked) => void togglePush(checked)}
          />
        </div>
      </div>
    </section>
  )
}
