"use client"

import * as React from "react"

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide"

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return "mobile"
  if (width < 1024) return "tablet"
  if (width <= 1600) return "desktop"
  return "wide"
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>("desktop")

  React.useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(getBreakpoint(window.innerWidth))
    }

    updateBreakpoint()
    window.addEventListener("resize", updateBreakpoint)

    return () => window.removeEventListener("resize", updateBreakpoint)
  }, [])

  return {
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
    isWide: breakpoint === "wide",
  }
}
