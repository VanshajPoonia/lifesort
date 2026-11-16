"use client"

// Chrome and Edge fire beforeinstallprompt once, early in the page load. This module is
// imported from the root layout so the event is caught before any page asks for it.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    deferredPrompt = event as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    emit()
  })
}

export function subscribeToInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function canPromptInstall() {
  return deferredPrompt !== null
}

export async function promptInstall() {
  if (!deferredPrompt) return "unavailable" as const
  const prompt = deferredPrompt
  deferredPrompt = null
  emit()
  await prompt.prompt()
  return (await prompt.userChoice).outcome
}
