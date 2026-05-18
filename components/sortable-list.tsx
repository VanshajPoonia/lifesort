"use client"

import type { ReactNode } from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SortableRenderOptions = {
  dragHandle: ReactNode
  isDragging: boolean
}

type SortableListProps<T> = {
  items: T[]
  getId?: (item: T) => string | number
  getLabel?: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T, options: SortableRenderOptions) => ReactNode
  className?: string
  disabled?: boolean
}

type SortableRowProps<T> = {
  id: UniqueIdentifier
  item: T
  label: string
  renderItem: (item: T, options: SortableRenderOptions) => ReactNode
}

function defaultGetId<T extends { id?: string | number }>(item: T) {
  return item.id ?? ""
}

function SortableRow<T>({ id, item, label, renderItem }: SortableRowProps<T>) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragHandle = (
    <Button
      ref={setActivatorNodeRef}
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
      aria-label={`Drag to reorder ${label}`}
      title={`Drag to reorder ${label}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </Button>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("touch-manipulation", isDragging && "relative z-20")}
    >
      {renderItem(item, { dragHandle, isDragging })}
    </div>
  )
}

export function SortableList<T extends { id?: string | number }>({
  items,
  getId = defaultGetId,
  getLabel,
  onReorder,
  renderItem,
  className,
  disabled = false,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const ids = items.map((item) => String(getId(item)))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    onReorder(arrayMove(items, oldIndex, newIndex))
  }

  if (disabled) {
    return (
      <div className={className}>
        {items.map((item) => (
          <div key={String(getId(item))}>
            {renderItem(item, { dragHandle: null, isDragging: false })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => {
            const id = String(getId(item))
            const label = getLabel?.(item) || "item"
            return (
              <SortableRow key={id} id={id} item={item} label={label} renderItem={renderItem} />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
