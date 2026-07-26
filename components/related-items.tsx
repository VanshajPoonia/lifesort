"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, FileText, FolderKanban, Link2, Loader2, Plus, Target, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { ItemRelationship, ItemRelationshipType } from "@/lib/types"

type LinkableType = "task" | "goal" | "project" | "note" | "life_area"
type DirectedRelationship = ItemRelationship & { direction: "incoming" | "outgoing"; label: string | null }
type CandidateOption = { id: string; label: string }

const LINKABLE_TYPES: { type: LinkableType; label: string; endpoint: string; titleKey: string; icon: typeof Target }[] = [
  { type: "task", label: "Task", endpoint: "/api/tasks", titleKey: "title", icon: Link2 },
  { type: "goal", label: "Goal", endpoint: "/api/goals", titleKey: "title", icon: Target },
  { type: "project", label: "Project", endpoint: "/api/projects", titleKey: "title", icon: FolderKanban },
  { type: "note", label: "Note", endpoint: "/api/notes", titleKey: "title", icon: FileText },
  { type: "life_area", label: "Domain", endpoint: "/api/life-areas", titleKey: "name", icon: Target },
]

const TYPE_META = Object.fromEntries(LINKABLE_TYPES.map(({ type, label, icon }) => [type, { label, icon }])) as Record<
  string,
  { label: string; icon: typeof Target }
>

// Self-contained "related items" panel, backed by the generic item_relationships
// table (relation: 'related') -- see AI_BUILD_PLAN.md A6 / Phase 1 "Relationships UI".
// Distinct from TaskDependencies (relation: 'depends_on', task-to-task only, ordered
// waiting-on/blocks semantics): this is symmetric, cross-type, and purely informational.
// Candidate lists are fetched lazily per type (only when that type is picked in the
// "add" dropdown) rather than eagerly, since this panel can mount many times per page
// (e.g. once per task card) and eagerly loading all 5 lists on every mount would be
// wasteful. Display labels for existing relationships are resolved server-side by the
// API instead, which is the cheap direction since it's bounded by relationship count.
export function RelatedItems({ itemType, itemId }: { itemType: ItemRelationshipType; itemId: string | number }) {
  const { toast } = useToast()
  const selfId = String(itemId)
  const [relationships, setRelationships] = useState<DirectedRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [linkType, setLinkType] = useState<LinkableType | "">("")
  const [linkId, setLinkId] = useState("")
  const [optionsByType, setOptionsByType] = useState<Partial<Record<LinkableType, CandidateOption[]>>>({})
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchRelationships = useCallback(async () => {
    try {
      const response = await fetch(`/api/item-relationships?item_type=${itemType}&item_id=${selfId}`)
      if (!response.ok) return null
      const data = await response.json()
      const rows = Array.isArray(data.relationships) ? data.relationships : []
      return rows.filter((row: DirectedRelationship) => row.relation === "related")
    } catch (error) {
      console.error("Failed to load related items:", error)
      return null
    }
  }, [itemType, selfId])

  useEffect(() => {
    let cancelled = false
    fetchRelationships().then((data) => {
      if (cancelled) return
      if (data) setRelationships(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchRelationships])

  const handleTypeChange = async (value: string) => {
    const type = value as LinkableType
    setLinkType(type)
    setLinkId("")
    if (optionsByType[type]) return

    setOptionsLoading(true)
    try {
      const config = LINKABLE_TYPES.find((entry) => entry.type === type)
      if (!config) return
      const response = await fetch(config.endpoint)
      const data = await response.json()
      const list = Array.isArray(data) ? data : []
      const options: CandidateOption[] = list.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        label: String(row[config.titleKey] ?? "Untitled"),
      }))
      setOptionsByType((prev) => ({ ...prev, [type]: options }))
    } catch (error) {
      console.error("Failed to load link options:", error)
    } finally {
      setOptionsLoading(false)
    }
  }

  const excludedIds = new Set(
    relationships
      .filter((row) => (row.direction === "outgoing" ? row.to_type : row.from_type) === linkType)
      .map((row) => (row.direction === "outgoing" ? row.to_id : row.from_id)),
  )
  if (linkType === itemType) excludedIds.add(selfId)
  const pickerOptions = (linkType ? optionsByType[linkType] ?? [] : []).filter((option) => !excludedIds.has(option.id))

  const handleAdd = async () => {
    if (!linkType || !linkId) return
    setAdding(true)
    try {
      const response = await fetch("/api/item-relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_type: itemType,
          from_id: selfId,
          to_type: linkType,
          to_id: linkId,
          relation: "related",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not add related item")
      const label = optionsByType[linkType]?.find((option) => option.id === linkId)?.label ?? null
      setRelationships((prev) => [...prev, { ...data.relationship, direction: "outgoing", label }])
      setLinkId("")
    } catch (error) {
      toast({
        title: "Could not add related item",
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
      if (!response.ok) throw new Error("Could not remove related item")
      setRelationships((prev) => prev.filter((row) => row.id !== relationship.id))
    } catch (error) {
      toast({
        title: "Could not remove related item",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return null

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Link2 className="h-3.5 w-3.5" />
        Related items{relationships.length > 0 ? ` (${relationships.length})` : ""}
      </button>

      {expanded && (
        <div className="space-y-3 pl-1">
          {relationships.length > 0 && (
            <div className="space-y-1">
              {relationships.map((relationship) => {
                const otherType = relationship.direction === "outgoing" ? relationship.to_type : relationship.from_type
                const meta = TYPE_META[otherType]
                const Icon = meta?.icon ?? Link2
                return (
                  <div key={relationship.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{relationship.label ?? "Deleted item"}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(relationship)}
                      disabled={busyId === relationship.id}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove related item"
                    >
                      {busyId === relationship.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Select value={linkType} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 w-28 shrink-0 text-sm">
                <SelectValue placeholder="Type..." />
              </SelectTrigger>
              <SelectContent>
                {LINKABLE_TYPES.map((entry) => (
                  <SelectItem key={entry.type} value={entry.type}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linkId} onValueChange={setLinkId} disabled={!linkType || optionsLoading}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue placeholder={optionsLoading ? "Loading..." : "Pick an item..."} />
              </SelectTrigger>
              <SelectContent>
                {pickerOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 px-2 text-xs"
              disabled={adding || !linkType || !linkId}
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
