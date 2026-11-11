"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// Coach as a side panel any page can open from the header (AI_BUILD_PLAN.md Part 0, Stage 1 step 7).
// The chat code loads and mounts only when the panel opens. Imported directly, the AI chat
// library added about 60 kB to every page in the app.
const CoachChat = dynamic(() => import("@/components/coach/coach-chat").then((m) => m.CoachChat), {
  loading: () => (
    <div className="flex h-40 items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
    </div>
  ),
})

export function CoachPanelButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-9 gap-2 px-2 sm:px-3"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">Coach</span>
        <span className="sr-only sm:hidden">Open Coach</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-3 p-4 sm:max-w-md">
          <SheetHeader className="space-y-1 pr-8 text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Coach
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-2">
              Ask about your tasks, goals and week.
              <Link href="/ai-chat" className="inline-flex items-center gap-0.5 font-medium text-primary hover:text-primary-hover">
                Full view
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1">{open && <CoachChat variant="panel" />}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
