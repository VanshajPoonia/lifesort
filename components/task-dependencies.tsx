"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Link2, Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { ItemRelationship } from "@/lib/types"

type TaskOption = { id: number | string; title: string }
type DirectedRelationship = ItemRelationship & { direction: "incoming" | "outgoing" }

// Self-contained "depends on" panel for one task, backed by the generic
// item_relationships table (relation: 'depends_on', task-to-task) rather than
// a new task_dependencies table -- see AI_DECISIONS.md. Collapsed by default,
// matching TaskChecklist's pattern. Purely informational: no automatic
// blocking of completion and no cycle detection, both deliberate scope calls.
export function TaskDependencies({ taskId, allTasks }: { taskId: number; allTasks: TaskOption[] }) {
  const { toast } = useToast()
  const [relationships, setRelationships] = useState<DirectedRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [pickerTaskId, setPickerTaskId] = useState("")
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchRelationships = async () => {
    try {
      const response = await fetch(`/api/item-relationships?item_type=task&item_id=${taskId}`)
      if (!response.ok) return
      const data = await response.json()
      setRelationships(Array.isArray(data.relationships) ? data.relationships : [])
    } catch (error) {
      console.error("Failed to load task dependencies:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRelationships()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const dependsOn = relationships.filter((r) => r.relation === "depends_on" && r.direction === "outgoing")
  const blocks = relationships.filter((r) => r.relation === "depends_on" && r.direction === "incoming")

  const titleFor = (id: string) => allTasks.find((task) => String(task.id) === id)?.title || `Task #${id}`

  const excludedIds = new Set([String(taskId), ...dependsOn.map((r) => r.to_id)])
  const pickerOptions = allTasks.filter((task) => !excludedIds.has(String(task.id)))

  const handleAdd = async () => {
    if (!pickerTaskId) return
    setAdding(true)
    try {
      const response = await fetch("/api/item-relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_type: "task",
          from_id: String(taskId),
          to_type: "task",
          to_id: pickerTaskId,
          relation: "depends_on",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not add dependency")
      setRelationships((prev) => [...prev, { ...data.relationship, direction: "outgoing" }])
      setPickerTaskId("")
    } catch (error) {
      toast({
        title: "Could not add dependency",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (relationship: DirectedRelationship) => {
    setBusyId(relationship.id)
    try {
      const response = await fetch("/api/item-relationships", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: relationship.id }),
      })
      if (!response.ok) throw new Error("Could not remove dependency")
      setRelationships((prev) => prev.filter((r) => r.id !== relationship.id))
    } catch (error) {
      toast({
        title: "Could not remove dependency",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return null

  const total = dependsOn.length + blocks.length

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Link2 className="h-3.5 w-3.5" />
        Depends on{total > 0 ? ` (${total})` : ""}
      </button>

      {expanded && (
        <div className="space-y-3 pl-1">
          {dependsOn.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Waiting on</p>
              {dependsOn.map((relationship) => (
                <div key={relationship.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate">{titleFor(relationship.to_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(relationship)}
                    disabled={busyId === relationship.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove dependency"
                  >
                    {busyId === relationship.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {blocks.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Blocks</p>
              {blocks.map((relationship) => (
                <div key={relationship.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{titleFor(relationship.from_id)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(relationship)}
                    disabled={busyId === relationship.id}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove dependency"
                  >
                    {busyId === relationship.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {pickerOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={pickerTaskId} onValueChange={setPickerTaskId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Add a dependency..." />
                </SelectTrigger>
                <SelectContent>
                  {pickerOptions.map((task) => (
                    <SelectItem key={String(task.id)} value={String(task.id)}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 px-2 text-xs"
                disabled={adding || !pickerTaskId}
                onClick={handleAdd}
              >
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
