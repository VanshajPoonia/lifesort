"use client"

import { Moon, Sun, Palette } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Theme = "light" | "dark" | "ocean" | "forest" | "sunset" | "rose" | "midnight"

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
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
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    // Remove all theme classes
    root.classList.remove("dark")
    root.removeAttribute("data-theme")
    
    // Apply new theme
    if (newTheme === "dark") {
      root.classList.add("dark")
    } else if (newTheme !== "light") {
      root.setAttribute("data-theme", newTheme)
    }
  }

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    applyTheme(newTheme)
  }

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-transparent">
          {theme === "light" && <Sun className="h-5 w-5" />}
          {theme === "dark" && <Moon className="h-5 w-5" />}
          {theme !== "light" && theme !== "dark" && <Palette className="h-5 w-5" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Light Themes</div>
        <DropdownMenuItem onClick={() => changeTheme("light")}>
          <Sun className="mr-2 h-4 w-4 text-yellow-500" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("ocean")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
          Ocean
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("forest")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500" />
          Forest
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("sunset")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-orange-400 to-rose-500" />
          Sunset
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("rose")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-rose-400 to-pink-500" />
          Rose
        </DropdownMenuItem>
        <div className="my-1 h-px bg-border" />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Dark Themes</div>
        <DropdownMenuItem onClick={() => changeTheme("dark")}>
          <Moon className="mr-2 h-4 w-4 text-purple-400" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("midnight")}>
          <div className="mr-2 h-4 w-4 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700" />
          Midnight
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
