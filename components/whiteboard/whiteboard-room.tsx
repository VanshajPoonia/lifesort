"use client"

import { LiveMap } from "@liveblocks/client"
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react"

import type { WhiteboardTool } from "@/liveblocks.config"
import { AppEmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle } from "lucide-react"

export function WhiteboardRoom({
  roomId,
  userColor,
  children,
}: {
  roomId: string
  userColor: string
  children: React.ReactNode
}) {
  const initialTool: WhiteboardTool = "select"

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <RoomProvider
        id={roomId}
        initialPresence={{
          cursor: null,
          selectedTool: initialTool,
          color: userColor,
          selection: null,
        }}
        initialStorage={{ elements: new LiveMap() }}
      >
        <ClientSideSuspense fallback={<WhiteboardLoading />}>{() => children}</ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  )
}

export function WhiteboardLoading() {
  return (
    <div className="grid h-[70vh] gap-3">
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  )
}

export function WhiteboardSetupError() {
  return (
    <AppEmptyState
      icon={AlertTriangle}
      title="Liveblocks is not configured"
      hint="Add LIVEBLOCKS_SECRET_KEY in Vercel or your local environment to open collaborative whiteboards."
      className="min-h-[50vh] border-dashed bg-background"
    />
  )
}
