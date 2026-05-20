import type { JsonObject, LiveMap, LiveObject } from "@liveblocks/client"

export type WhiteboardTool = "select" | "pen" | "rectangle" | "ellipse" | "line" | "text" | "sticky" | "eraser" | "pan"

export type WhiteboardPoint = {
  x: number
  y: number
}

export type WhiteboardElementType = "path" | "rectangle" | "ellipse" | "line" | "arrow" | "text" | "sticky"

export type WhiteboardElement = JsonObject & {
  id: string
  type: WhiteboardElementType
  x: number
  y: number
  width?: number
  height?: number
  points?: WhiteboardPoint[]
  text?: string
  color: string
  fill?: string
  strokeWidth: number
  createdBy: string
  createdAt: number
  updatedAt: number
}

declare global {
  interface Liveblocks {
    Presence: {
      cursor: WhiteboardPoint | null
      selectedTool: WhiteboardTool
      color: string
      selection: string | null
    }
    Storage: {
      elements: LiveMap<string, LiveObject<WhiteboardElement>>
    }
    UserMeta: {
      id: string
      info: {
        name: string
        avatar?: string
        color: string
      }
    }
  }
}
