"use client"

import { useEffect } from "react"

// Imported for its side effect: it starts listening for the install prompt.
import "@/components/pwa/install-prompt"

// Registers public/sw.js. Skipped in dev so cached files never hide code changes.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("[pwa] Service worker registration failed:", error)
    })
  }, [])

  return null
}
