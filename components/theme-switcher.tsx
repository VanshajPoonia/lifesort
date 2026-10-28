"use client"

import { Moon, Sun, Palette } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Theme = "light" | "dark" | "ocean" | "forest" | "sunset" | "rose" | "midnight"

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove("dark")
    root.removeAttribute("data-theme")

    // Apply new theme
    if (newTheme === "dark") {
      root.classList.add("dark")
    } else if (newTheme === "midnight") {
      root.classList.add("dark")
      root.setAttribute("data-theme", "midnight")
    } else if (newTheme !== "light") {
      root.setAttribute("data-theme", newTheme)
    }
  }, [])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: mounted starts false so the
    // trigger shows a neutral icon until the client hydrates (rendering it
    // always keeps the header from shifting); applyTheme is also shared with
    // changeTheme below.
    setMounted(true)
    const savedTheme = localStorage.getItem("theme") as Theme | null
    if (savedTheme) {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    } else {
      // Default to light theme, don't use system preference
      const initialTheme = "light"
      setTheme(initialTheme)
      localStorage.setItem("theme", initialTheme)
      applyTheme(initialTheme)
    }
  }, [applyTheme])

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    applyTheme(newTheme)
  }

  const lightThemes: { value: Theme; label: string; swatch: string }[] = [
    { value: "light", label: "Light", swatch: "bg-[#F7F5F1] ring-1 ring-inset ring-black/10" },
    { value: "ocean", label: "Ocean", swatch: "bg-gradient-to-br from-blue-400 to-cyan-500" },
    { value: "forest", label: "Forest", swatch: "bg-gradient-to-br from-green-400 to-emerald-500" },
    { value: "sunset", label: "Sunset", swatch: "bg-gradient-to-br from-orange-400 to-rose-500" },
    { value: "rose", label: "Rose", swatch: "bg-gradient-to-br from-rose-400 to-pink-500" },
  ]
  const darkThemes: { value: Theme; label: string; swatch: string }[] = [
    { value: "dark", label: "Dark", swatch: "bg-[#1B1A1E] ring-1 ring-inset ring-white/15" },
    { value: "midnight", label: "Midnight", swatch: "bg-gradient-to-br from-blue-600 to-indigo-700" },
  ]
  const TriggerIcon = !mounted || theme === "light" ? Sun : theme === "dark" ? Moon : Palette

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Change theme" title="Theme">
          <TriggerIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => changeTheme(value as Theme)}>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Light</DropdownMenuLabel>
          {lightThemes.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="gap-2">
              <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${option.swatch}`} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Dark</DropdownMenuLabel>
          {darkThemes.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="gap-2">
              <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${option.swatch}`} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
