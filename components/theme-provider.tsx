"use client"

import React from "react"

import { useEffect } from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply theme immediately on mount to prevent flashing
    const savedTheme = localStorage.getItem("theme")
    const root = document.documentElement
    
    if (savedTheme) {
      // Remove all theme classes first
      root.classList.remove("dark")
      root.removeAttribute("data-theme")
      
      // Apply saved theme
      if (savedTheme === "dark" || savedTheme === "midnight") {
        root.classList.add("dark")
        if (savedTheme === "midnight") {
          root.setAttribute("data-theme", "midnight")
        }
      } else if (savedTheme !== "light") {
        root.setAttribute("data-theme", savedTheme)
      }
    } else {
      // Set default light theme if no theme is saved
      localStorage.setItem("theme", "light")
    }
  }, [])

  return <>{children}</>
}
