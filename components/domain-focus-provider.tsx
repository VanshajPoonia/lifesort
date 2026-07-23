"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

export type DomainFocus = {
  id: string
  name: string
  color: string
  icon: string
}

type DomainFocusContextType = {
  focus: DomainFocus | null
  setFocus: (domain: DomainFocus) => void
  clearFocus: () => void
}

const STORAGE_KEY = "lifesort-domain-focus"

const DomainFocusContext = createContext<DomainFocusContextType | undefined>(undefined)

// Converts the domain's stored hex accent into the "H S% L%" triplet format
// app/globals.css uses for its CSS custom properties (e.g. --accent).
function hexToHslTriplet(hex: string): string | null {
  const clean = hex.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function DomainFocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocusState] = useState<DomainFocus | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) setFocusState(JSON.parse(raw))
    } catch {
      // ignore malformed/blocked storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const hsl = focus?.color ? hexToHslTriplet(focus.color) : null
    if (hsl) {
      document.documentElement.style.setProperty("--accent", hsl)
    } else {
      document.documentElement.style.removeProperty("--accent")
    }
  }, [focus, hydrated])

  const setFocus = useCallback((domain: DomainFocus) => {
    setFocusState(domain)
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(domain))
    } catch {
      // ignore
    }
  }, [])

  const clearFocus = useCallback(() => {
    setFocusState(null)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return (
    <DomainFocusContext.Provider value={{ focus, setFocus, clearFocus }}>{children}</DomainFocusContext.Provider>
  )
}

export function useDomainFocus() {
  const context = useContext(DomainFocusContext)
  if (!context) throw new Error("useDomainFocus must be used within a DomainFocusProvider")
  return context
}
