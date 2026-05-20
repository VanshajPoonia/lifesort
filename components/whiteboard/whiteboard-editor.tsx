"use client"

import { LiveObject } from "@liveblocks/client"
import {
  useCanRedo,
  useCanUndo,
  useMutation,
  useOthers,
  useRedo,
  useSelf,
  useStatus,
  useStorage,
  useUndo,
  useUpdateMyPresence,
} from "@liveblocks/react"
import {
  Circle,
  Eraser,
  Hand,
  Minus,
  MousePointer2,
  PenLine,
  Redo2,
  Save,
  Share2,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type { WhiteboardElement, WhiteboardPoint, WhiteboardTool } from "@/liveblocks.config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type BoardSummary = {
  id: string
  title: string
  liveblocks_room_id: string
  role: "owner" | "editor" | "viewer"
}

const tools: Array<{ id: WhiteboardTool; label: string; icon: React.ElementType }> = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "pan", label: "Pan", icon: Hand },
  { id: "pen", label: "Pen", icon: PenLine },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "line", label: "Line", icon: Minus },
  { id: "text", label: "Text", icon: Type },
  { id: "sticky", label: "Sticky", icon: StickyNote },
  { id: "eraser", label: "Erase", icon: Eraser },
]

const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#111827"]

type OtherPresence = {
  connectionId: number
  presence: {
    cursor: WhiteboardPoint | null
    color?: string
  }
  info?: {
    name?: string
    color?: string
  }
}

function toElementArray(value: unknown): WhiteboardElement[] {
  if (!value) return []
  if (value instanceof Map) return Array.from(value.values()) as WhiteboardElement[]
  if (typeof value === "object") return Object.values(value as Record<string, WhiteboardElement>)
  return []
}

function pointToPath(points: WhiteboardPoint[]) {
  if (points.length === 0) return ""
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
}

function boundsFor(element: WhiteboardElement) {
  if (element.type === "path" && element.points?.length) {
    const xs = element.points.map((point) => point.x)
    const ys = element.points.map((point) => point.y)
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }
  return {
    x: Math.min(element.x, element.x + (element.width || 0)),
    y: Math.min(element.y, element.y + (element.height || 0)),
    width: Math.abs(element.width || 120),
    height: Math.abs(element.height || 80),
  }
}

function hitTest(element: WhiteboardElement, point: WhiteboardPoint) {
  const bounds = boundsFor(element)
  const padding = Math.max(10, element.strokeWidth + 6)
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  )
}

function moveElement(element: WhiteboardElement, dx: number, dy: number): WhiteboardElement {
  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
    points: element.points?.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    updatedAt: Date.now(),
  }
}

function makeElement({
  tool,
  point,
  color,
  strokeWidth,
  userId,
}: {
  tool: WhiteboardTool
  point: WhiteboardPoint
  color: string
  strokeWidth: number
  userId: string
}): WhiteboardElement {
  const now = Date.now()
  const id = crypto.randomUUID()
  if (tool === "text") {
    return {
      id,
      type: "text",
      x: point.x,
      y: point.y,
      width: 220,
      height: 48,
      text: "Double-click to edit",
      color,
      strokeWidth,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }
  }
  if (tool === "sticky") {
    return {
      id,
      type: "sticky",
      x: point.x,
      y: point.y,
      width: 220,
      height: 140,
      text: "New sticky note",
      color: "#92400e",
      fill: "#fef3c7",
      strokeWidth: 1,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    }
  }
  const elementType =
    tool === "pen"
      ? "path"
      : tool === "rectangle" || tool === "ellipse" || tool === "line"
        ? tool
        : "path"

  return {
    id,
    type: elementType,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    points: tool === "pen" ? [point] : undefined,
    color,
    strokeWidth,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  }
}

function templateElements(template: string, userId: string): WhiteboardElement[] {
  const now = Date.now()
  const base = (id: string, overrides: Partial<WhiteboardElement>): WhiteboardElement => ({
    id,
    type: "sticky",
    x: 120,
    y: 120,
    width: 220,
    height: 130,
    text: "",
    color: "#92400e",
    fill: "#fef3c7",
    strokeWidth: 1,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })

  switch (template) {
    case "weekly_plan":
      return [
        base(crypto.randomUUID(), { x: 120, y: 100, text: "Must do" }),
        base(crypto.randomUUID(), { x: 380, y: 100, text: "Should do" }),
        base(crypto.randomUUID(), { x: 640, y: 100, text: "Could do" }),
        base(crypto.randomUUID(), { type: "text", x: 120, y: 40, width: 420, height: 44, text: "Weekly plan", color: "#7c3aed", fill: undefined, strokeWidth: 2 }),
      ]
    case "goal_map":
      return [
        base(crypto.randomUUID(), { type: "ellipse", x: 360, y: 160, width: 260, height: 120, text: undefined, color: "#7c3aed", fill: undefined, strokeWidth: 4 }),
        base(crypto.randomUUID(), { type: "text", x: 390, y: 200, width: 220, height: 44, text: "Main goal", color: "#7c3aed", fill: undefined, strokeWidth: 2 }),
        base(crypto.randomUUID(), { x: 100, y: 120, text: "Milestone" }),
        base(crypto.randomUUID(), { x: 680, y: 120, text: "Next action" }),
      ]
    case "project_brainstorm":
      return [
        base(crypto.randomUUID(), { x: 120, y: 120, text: "Ideas" }),
        base(crypto.randomUUID(), { x: 380, y: 120, text: "Risks" }),
        base(crypto.randomUUID(), { x: 640, y: 120, text: "Decisions" }),
      ]
    case "budget_map":
      return [
        base(crypto.randomUUID(), { x: 120, y: 120, text: "Income" }),
        base(crypto.randomUUID(), { x: 380, y: 120, text: "Needs" }),
        base(crypto.randomUUID(), { x: 640, y: 120, text: "Savings" }),
      ]
    case "study_board":
      return [
        base(crypto.randomUUID(), { x: 120, y: 120, text: "Key concepts" }),
        base(crypto.randomUUID(), { x: 380, y: 120, text: "Questions" }),
        base(crypto.randomUUID(), { x: 640, y: 120, text: "Practice" }),
      ]
    default:
      return []
  }
}

export function WhiteboardEditor({
  board,
  canEdit,
  initialTemplate = "blank",
  onShare,
  onRename,
}: {
  board: BoardSummary
  canEdit: boolean
  initialTemplate?: string
  onShare: () => void
  onRename: (title: string) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const cursorFrame = useRef<number | null>(null)
  const lastCursor = useRef<WhiteboardPoint | null>(null)
  const seededTemplate = useRef(false)
  const rawElements = useStorage((root) => root.elements as unknown)
  const others = useOthers() as unknown as OtherPresence[]
  const self = useSelf()
  const updateMyPresence = useUpdateMyPresence()
  const status = useStatus()
  const undo = useUndo()
  const redo = useRedo()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const [tool, setTool] = useState<WhiteboardTool>(canEdit ? "pen" : "pan")
  const [color, setColor] = useState("#7c3aed")
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<WhiteboardElement | null>(null)
  const [dragState, setDragState] = useState<{
    start: WhiteboardPoint
    original: WhiteboardElement
    mode: "move" | "pan"
    panStart?: { x: number; y: number }
  } | null>(null)
  const [titleDraft, setTitleDraft] = useState(board.title)

  const elements = useMemo(() => {
    const committed = toElementArray(rawElements)
    if (!draft) return committed
    return committed.some((element) => element.id === draft.id)
      ? committed.map((element) => (element.id === draft.id ? draft : element))
      : [...committed, draft]
  }, [draft, rawElements])

  const selected = elements.find((element) => element.id === selectedId) || null

  const setElement = useMutation(({ storage }, element: WhiteboardElement) => {
    storage.get("elements").set(element.id, new LiveObject(element))
  }, [])

  const deleteElement = useMutation(({ storage }, id: string) => {
    storage.get("elements").delete(id)
  }, [])

  const seedTemplate = useMutation(({ storage }, template: string, userId: string) => {
    const elementsMap = storage.get("elements")
    if (elementsMap.size > 0) return
    for (const element of templateElements(template, userId)) {
      elementsMap.set(element.id, new LiveObject(element))
    }
  }, [])

  useEffect(() => {
    if (!canEdit || seededTemplate.current || !initialTemplate || initialTemplate === "blank") return
    if (elements.length > 0) return
    seededTemplate.current = true
    seedTemplate(initialTemplate, self?.id || "unknown")
  }, [canEdit, elements.length, initialTemplate, seedTemplate, self?.id])

  const clearSelectionPresence = () => {
    updateMyPresence({ selection: null })
    setSelectedId(null)
  }

  const setToolWithPresence = (nextTool: WhiteboardTool) => {
    setTool(nextTool)
    updateMyPresence({ selectedTool: nextTool })
  }

  const clientPoint = (event: React.PointerEvent<SVGSVGElement>): WhiteboardPoint => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    }
  }

  const updateCursor = (point: WhiteboardPoint) => {
    lastCursor.current = point
    if (cursorFrame.current) return
    cursorFrame.current = window.requestAnimationFrame(() => {
      updateMyPresence({ cursor: lastCursor.current, color, selectedTool: tool, selection: selectedId })
      cursorFrame.current = null
    })
  }

  const findElementAt = (point: WhiteboardPoint) => {
    return [...elements].reverse().find((element) => hitTest(element, point)) || null
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = clientPoint(event)
    updateCursor(point)

    if (tool === "pan" || (!canEdit && tool !== "select")) {
      setDragState({ start: { x: event.clientX, y: event.clientY }, original: elements[0], mode: "pan", panStart: pan })
      return
    }

    if (!canEdit) return

    if (tool === "select") {
      const hit = findElementAt(point)
      if (!hit) {
        clearSelectionPresence()
        return
      }
      setSelectedId(hit.id)
      updateMyPresence({ selection: hit.id })
      setDragState({ start: point, original: hit, mode: "move" })
      return
    }

    if (tool === "eraser") {
      const hit = findElementAt(point)
      if (hit) deleteElement(hit.id)
      return
    }

    const next = makeElement({ tool, point, color, strokeWidth, userId: self?.id || "unknown" })
    setDraft(next)
    setSelectedId(next.id)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = clientPoint(event)
    updateCursor(point)

    if (dragState?.mode === "pan" && dragState.panStart) {
      setPan({
        x: dragState.panStart.x + event.clientX - dragState.start.x,
        y: dragState.panStart.y + event.clientY - dragState.start.y,
      })
      return
    }

    if (dragState?.mode === "move") {
      setDraft(moveElement(dragState.original, point.x - dragState.start.x, point.y - dragState.start.y))
      return
    }

    if (!draft || !canEdit) return

    if (draft.type === "path") {
      setDraft({ ...draft, points: [...(draft.points || []), point], updatedAt: Date.now() })
      return
    }

    setDraft({
      ...draft,
      width: point.x - draft.x,
      height: point.y - draft.y,
      updatedAt: Date.now(),
    })
  }

  const commitDraft = () => {
    if (!draft || !canEdit) return
    const bounds = boundsFor(draft)
    const validPath = draft.type === "path" && (draft.points?.length || 0) > 1
    const validShape = draft.type !== "path" && (bounds.width > 3 || bounds.height > 3 || draft.type === "text" || draft.type === "sticky")
    if (validPath || validShape) setElement(draft)
    setDraft(null)
  }

  const handlePointerUp = () => {
    commitDraft()
    setDragState(null)
  }

  const updateSelectedText = (text: string) => {
    if (!selected || !canEdit) return
    const next = { ...selected, text, updatedAt: Date.now() }
    setElement(next)
  }

  const deleteSelected = () => {
    if (!selectedId || !canEdit) return
    deleteElement(selectedId)
    clearSelectionPresence()
  }

  const fitToScreen = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div className="flex h-[calc(100vh-9.5rem)] min-h-[620px] flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-card/95 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => titleDraft.trim() && titleDraft !== board.title && onRename(titleDraft.trim())}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
            disabled={!canEdit}
            className="h-9 max-w-md border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-border focus-visible:border-ring"
          />
          <Badge variant={canEdit ? "secondary" : "outline"}>{board.role}</Badge>
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <PresenceStack others={others} selfColor={self?.info?.color || color} />
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex gap-2 overflow-x-auto border-b bg-muted/20 p-2 md:w-16 md:flex-col md:overflow-x-visible md:border-b-0 md:border-r">
          {tools.map((item) => {
            const Icon = item.icon
            const disabled = !canEdit && !["select", "pan"].includes(item.id)
            return (
              <Button
                key={item.id}
                type="button"
                variant={tool === item.id ? "default" : "ghost"}
                size="icon"
                disabled={disabled}
                onClick={() => setToolWithPresence(item.id)}
                title={item.label}
                aria-label={item.label}
                className="shrink-0"
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
          <div className="mx-1 h-8 w-px bg-border md:mx-0 md:h-px md:w-full" />
          <Button type="button" variant="ghost" size="icon" disabled={!canUndo || !canEdit} onClick={undo} title="Undo" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={!canRedo || !canEdit} onClick={redo} title="Redo" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" disabled={!selectedId || !canEdit} onClick={deleteSelected} title="Delete selected" aria-label="Delete selected">
            <Trash2 className="h-4 w-4" />
          </Button>
        </aside>

        <main className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted-foreground)/0.16)_1px,transparent_0)] [background-size:24px_24px]">
          <svg
            ref={svgRef}
            className={cn("h-full w-full touch-none", tool === "pan" ? "cursor-grab" : "cursor-crosshair")}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => updateMyPresence({ cursor: null })}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {elements.map((element) => (
                <ElementShape key={element.id} element={element} selected={element.id === selectedId} />
              ))}
              {others.map((other) =>
                other.presence.cursor ? (
                  <g key={other.connectionId} transform={`translate(${other.presence.cursor.x} ${other.presence.cursor.y})`}>
                    <path d="M0 0 L0 18 L5 13 L9 22 L13 20 L9 11 L16 11 Z" fill={other.info?.color || other.presence.color || "#7c3aed"} />
                    <text x="14" y="14" className="select-none text-[12px] font-medium" fill={other.info?.color || other.presence.color || "#7c3aed"}>
                      {other.info?.name || "Collaborator"}
                    </text>
                  </g>
                ) : null,
              )}
            </g>
          </svg>

          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border bg-card/95 p-2 shadow-sm">
            <Button type="button" variant="ghost" size="icon" onClick={() => setZoom((value) => Math.max(0.3, Number((value - 0.1).toFixed(2))))} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center text-xs font-medium">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.1).toFixed(2))))} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={fitToScreen}>
              Fit
            </Button>
          </div>
        </main>

        <aside className="w-full border-t bg-card p-3 md:w-72 md:border-l md:border-t-0">
          <div className="space-y-4">
            <div>
              <Label>Color</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cn("h-7 w-7 rounded-full border-2", color === item ? "border-foreground" : "border-transparent")}
                    style={{ backgroundColor: item }}
                    onClick={() => setColor(item)}
                    aria-label={`Use ${item}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Stroke width</Label>
              <Slider value={[strokeWidth]} min={1} max={16} step={1} onValueChange={(value) => setStrokeWidth(value[0] || 1)} className="mt-3" />
            </div>
            {selected && (selected.type === "text" || selected.type === "sticky") && (
              <div>
                <Label>Selected text</Label>
                <Textarea value={selected.text || ""} onChange={(event) => updateSelectedText(event.target.value)} disabled={!canEdit} className="mt-2 min-h-28" />
              </div>
            )}
            {!canEdit && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                View-only access. You can pan, zoom, and watch collaborators, but edits are disabled.
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Save className="h-3.5 w-3.5" />
              Changes autosave through Liveblocks Storage.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PresenceStack({ others, selfColor }: { others: OtherPresence[]; selfColor: string }) {
  return (
    <div className="flex -space-x-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-semibold text-white" style={{ backgroundColor: selfColor }}>
        You
      </span>
      {others.slice(0, 4).map((other) => (
        <span
          key={other.connectionId}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-semibold text-white"
          style={{ backgroundColor: other.info?.color || other.presence.color || "#7c3aed" }}
          title={other.info?.name || "Collaborator"}
        >
          {(other.info?.name || "?").charAt(0).toUpperCase()}
        </span>
      ))}
    </div>
  )
}

function ElementShape({ element, selected }: { element: WhiteboardElement; selected: boolean }) {
  const bounds = boundsFor(element)
  const common = {
    stroke: element.color,
    strokeWidth: element.strokeWidth,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
  }

  return (
    <g>
      {element.type === "path" && <path d={pointToPath(element.points || [])} {...common} strokeLinecap="round" strokeLinejoin="round" />}
      {element.type === "rectangle" && <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} rx={6} {...common} />}
      {element.type === "ellipse" && <ellipse cx={bounds.x + bounds.width / 2} cy={bounds.y + bounds.height / 2} rx={bounds.width / 2} ry={bounds.height / 2} {...common} />}
      {element.type === "line" && <line x1={element.x} y1={element.y} x2={element.x + (element.width || 0)} y2={element.y + (element.height || 0)} {...common} strokeLinecap="round" />}
      {element.type === "text" && (
        <foreignObject x={bounds.x} y={bounds.y} width={Math.max(120, bounds.width)} height={Math.max(48, bounds.height)}>
          <div className="break-words text-lg font-semibold leading-tight" style={{ color: element.color }}>
            {element.text}
          </div>
        </foreignObject>
      )}
      {element.type === "sticky" && (
        <foreignObject x={bounds.x} y={bounds.y} width={Math.max(160, bounds.width)} height={Math.max(100, bounds.height)}>
          <div className="h-full rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm leading-5 text-amber-950 shadow-sm">
            {element.text}
          </div>
        </foreignObject>
      )}
      {selected && (
        <rect
          x={bounds.x - 6}
          y={bounds.y - 6}
          width={bounds.width + 12}
          height={bounds.height + 12}
          rx={8}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}
