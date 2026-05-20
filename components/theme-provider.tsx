"use client"

import React, { useEffect } from "react"

function applyStoredTheme(theme: string) {
  const root = document.documentElement

  root.classList.remove("dark")
  root.removeAttribute("data-theme")

  if (theme === "dark") {
    root.classList.add("dark")
  } else if (theme === "midnight") {
    root.classList.add("dark")
    root.setAttribute("data-theme", "midnight")
  } else if (theme !== "light") {
    root.setAttribute("data-theme", theme)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme immediately on mount to prevent flashing
    const savedTheme = localStorage.getItem("theme")
    
    if (savedTheme) {
      applyStoredTheme(savedTheme)
    } else {
      // Set default light theme if no theme is saved
      localStorage.setItem("theme", "light")
      applyStoredTheme("light")
    }
  }, [])

  return <>{children}</>
}
