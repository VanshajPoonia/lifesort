"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Sparkles } from "lucide-react"

import { CoachChat } from "@/components/coach/coach-chat"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// Coach as a side panel any page can open from the header (AI_BUILD_PLAN.md Part 0, Stage 1 step 7).
// The chat only mounts while the panel is open, so closed pages make no Coach requests.
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
