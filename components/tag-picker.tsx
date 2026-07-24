"use client"

import { useEffect, useState } from "react"
import { Check, Plus, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type Tag = { id: number; name: string; color: string }

const TAG_COLORS = ["#64748B", "#2563EB", "#059669", "#DC2626", "#EA580C", "#7C3AED", "#DB2777", "#0891B2"]

// Shared tag picker for the generic tags system (tasks/goals/projects). See app/api/tags,
// app/api/item-tags. Fetches the user's full tag list once and lets the caller manage which
// tags are attached to one item via onChange -- the caller owns persistence.
export function TagPicker({
  selected,
  onChange,
}: {
  selected: Tag[]
  onChange: (tags: Tag[]) => void
}) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch("/api/tags")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setAllTags(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Failed to load tags:", error))
  }, [])

  const toggleTag = (tag: Tag) => {
    const isSelected = selected.some((item) => item.id === tag.id)
    onChange(isSelected ? selected.filter((item) => item.id !== tag.id) : [...selected, tag])
  }

  const createTag = async () => {
    const name = search.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const color = TAG_COLORS[allTags.length % TAG_COLORS.length]
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      })
      if (!response.ok) throw new Error("Failed to create tag")
      const tag = await response.json()
      setAllTags((prev) => (prev.some((item) => item.id === tag.id) ? prev : [...prev, tag]))
      onChange([...selected, { id: tag.id, name: tag.name, color: tag.color }])
      setSearch("")
    } catch (error) {
      console.error("Failed to create tag:", error)
    } finally {
      setCreating(false)
    }
  }

  const filteredTags = allTags.filter((tag) => tag.name.toLowerCase().includes(search.toLowerCase()))
  const exactMatch = allTags.some((tag) => tag.name.toLowerCase() === search.trim().toLowerCase())

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((tag) => (
        <Badge key={tag.id} variant="outline" className="gap-1 pr-1 text-xs">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
          <button type="button" onClick={() => toggleTag(tag)} className="ml-0.5 text-muted-foreground hover:text-destructive" aria-label={`Remove ${tag.name}`}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
            <Plus className="h-3 w-3" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search or create..."
            className="h-8 text-sm"
            autoFocus
          />
          <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {filteredTags.map((tag) => {
              const isSelected = selected.some((item) => item.id === tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
            {search.trim() && !exactMatch && (
              <button
                type="button"
                onClick={createTag}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Create &quot;{search.trim()}&quot;
              </button>
            )}
            {filteredTags.length === 0 && !search.trim() && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Type to search or create a tag.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
