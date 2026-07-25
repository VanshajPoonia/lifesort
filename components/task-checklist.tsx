"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, ListChecks, Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { SortableList } from "@/components/sortable-list"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { TaskChecklistItem } from "@/lib/types"

// Self-contained subtasks/checklist panel for one task. Collapsed by default
// so dense task lists don't get taller for tasks that don't use it.
export function TaskChecklist({ taskId }: { taskId: number }) {
  const { toast } = useToast()
  const [items, setItems] = useState<TaskChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/checklist-items`)
      if (!response.ok) return null
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error("Failed to load checklist items:", error)
      return null
    }
  }, [taskId])

  useEffect(() => {
    let cancelled = false
    fetchItems().then((data) => {
      if (cancelled) return
      if (data) setItems(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchItems])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/checklist-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not add item")
      setItems((prev) => [...prev, data])
      setNewTitle("")
    } catch (error) {
      toast({
        title: "Could not add checklist item",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (item: TaskChecklistItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !item.completed } : i)))
    try {
      const response = await fetch(`/api/tasks/${taskId}/checklist-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, completed: !item.completed }),
      })
      if (!response.ok) throw new Error("Could not update item")
    } catch (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: item.completed } : i)))
      toast({
        title: "Could not update checklist item",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (item: TaskChecklistItem) => {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/tasks/${taskId}/checklist-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      if (!response.ok) throw new Error("Could not delete item")
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (error) {
      toast({
        title: "Could not delete checklist item",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleReorder = async (nextItems: TaskChecklistItem[]) => {
    setItems(nextItems)
    try {
      await fetch(`/api/tasks/${taskId}/checklist-items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextItems.map((item) => item.id) }),
      })
    } catch (error) {
      console.error("Failed to reorder checklist items:", error)
    }
  }

  if (loading) return null

  const completedCount = items.filter((item) => item.completed).length

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <ListChecks className="h-3.5 w-3.5" />
        Checklist{items.length > 0 ? ` (${completedCount}/${items.length})` : ""}
      </button>

      {expanded && (
        <div className="space-y-2 pl-1">
          {items.length > 0 && (
            <SortableList
              items={items}
              getLabel={(item) => item.title}
              onReorder={handleReorder}
              className="space-y-1"
              renderItem={(item, { dragHandle }) => (
                <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  {dragHandle}
                  <Checkbox checked={item.completed} onCheckedChange={() => handleToggle(item)} />
                  <span className={cn("min-w-0 flex-1 truncate", item.completed && "text-muted-foreground line-through")}>
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={busyId === item.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${item.title}`}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            />
          )}

          <div className="flex items-center gap-2">
            <Input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleAdd()
                }
              }}
              placeholder="Add checklist item..."
              className="h-8 text-sm"
              disabled={adding}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs"
              disabled={adding || !newTitle.trim()}
              onClick={handleAdd}
            >
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
