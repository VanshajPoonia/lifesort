"use client"

import { useState } from "react"
import { BookOpenText, BriefcaseBusiness, CheckSquare, ChevronLeft, ChevronRight, Target } from "lucide-react"

import { KitIcon, localToday } from "@/components/kits/kit-icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { addDaysToDate } from "@/lib/date-math"
import { LIFE_KITS } from "@/lib/life-kits"

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

const planningStyles = [
  { id: "light", label: "Light", description: "A short list and gentle reminders." },
  { id: "structured", label: "Structured", description: "Clear must-do work and regular reviews." },
  { id: "flexible", label: "Flexible", description: "Loose priorities that can adapt during the day." },
]

type PickedKit = { date: string; label: string }

async function bestEffortWrite(url: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: url.includes("/journal/") ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return response.ok
  } catch (error) {
    console.warn("Optional onboarding write failed:", error)
    return false
  }
}

// Onboarding starts with "What's going on in your life right now?" (AI_BUILD_PLAN.md
// Part 0, Stage 3). Picked kits are set up on finish, so Today has real steps at once.
// Domains are no longer chosen here; every account already gets the default set.
export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1)
  const [picked, setPicked] = useState<Record<string, PickedKit>>({})
  const [planningStyle, setPlanningStyle] = useState("light")
  const [workStart, setWorkStart] = useState("09:00")
  const [workEnd, setWorkEnd] = useState("17:00")
  const [firstTask, setFirstTask] = useState("")
  const [firstGoal, setFirstGoal] = useState("")
  const [firstGratitude, setFirstGratitude] = useState("")
  const [saving, setSaving] = useState(false)
  const [kitError, setKitError] = useState("")

  const totalSteps = 3
  const today = localToday()

  const toggleKit = (key: string, defaultOffset: number) => {
    setPicked((current) => {
      const next = { ...current }
      if (next[key]) delete next[key]
      else next[key] = { date: addDaysToDate(today, defaultOffset), label: "" }
      return next
    })
  }

  const updateKit = (key: string, patch: Partial<PickedKit>) => {
    setPicked((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  const completeOnboarding = async (skipped = false) => {
    if (saving) return
    setSaving(true)
    setKitError("")

    try {
      const startedKits: string[] = []
      if (!skipped) {
        // One at a time: two kits can share a domain (New job and Job search both use Work).
        for (const [key, kit] of Object.entries(picked)) {
          const ok = await bestEffortWrite("/api/kits", {
            kit_key: key,
            anchor_date: kit.date,
            today,
            label: kit.label.trim() || null,
          })
          if (ok) startedKits.push(key)
        }

        const optionalWrites = []
        if (firstTask.trim()) {
          optionalWrites.push(bestEffortWrite("/api/tasks", { title: firstTask.trim(), priority: "medium", due_date: today }))
        }
        if (firstGoal.trim()) {
          optionalWrites.push(bestEffortWrite("/api/goals", { title: firstGoal.trim(), priority: "medium", status: "active" }))
        }
        if (firstGratitude.trim()) {
          optionalWrites.push(
            bestEffortWrite(`/api/journal/${today}`, {
              mood: null,
              gratitude: [firstGratitude.trim(), "", ""],
              affirmation_text: null,
              affirmation_pinned_until: null,
              work_todo: [],
              personal_todo: [],
              family_todo: [],
              what_went_well: null,
              what_could_be_better: null,
              notes_from_today: null,
              how_to_make_tomorrow_better: null,
              work_stars: null,
              work_stars_note: null,
              personal_stars: null,
              personal_stars_note: null,
              family_stars: null,
              family_stars_note: null,
              tomorrow_focus: null,
              tomorrow_avoid: null,
              energy_level: null,
              tags: ["onboarding"],
            }),
          )
        }
        await Promise.allSettled(optionalWrites)
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_preferences: {
            onboarding_date: new Date().toISOString(),
            onboarding_skipped: skipped,
            kits_started: startedKits,
            planning_style: planningStyle,
            work_hours_start: workStart,
            work_hours_end: workEnd,
          },
          sidebar_preferences: {},
        }),
      })

      if (!response.ok) {
        setKitError("Couldn't save your setup. Check your connection and try again.")
        return
      }
      onComplete()
    } catch (error) {
      console.error("Error saving onboarding:", error)
      setKitError("Couldn't save your setup. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const pickedCount = Object.keys(picked).length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && completeOnboarding(true)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[680px] [&>button]:hidden">
        <div className="sticky top-0 z-10 border-b bg-background/95 px-6 pt-6 backdrop-blur">
          <div className="mb-2 flex items-center gap-4">
            <Progress value={(step / totalSteps) * 100} className="h-2 flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => completeOnboarding(true)}
              className="shrink-0 bg-transparent text-xs"
              disabled={saving}
            >
              {saving ? "Saving..." : "Skip"}
            </Button>
          </div>
          <p className="pb-4 text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>

        {step === 1 && (
          <div className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">What&apos;s going on in your life right now?</h2>
              <p className="text-muted-foreground">Tick anything that fits. LifeSort sets up the steps, a goal and habits for each one.</p>
            </div>

            <ul className="space-y-2">
              {LIFE_KITS.map((kit) => {
                const choice = picked[kit.key]
                const checkboxId = `onboarding-kit-${kit.key}`
                return (
                  <li key={kit.key} className={`rounded-lg border p-3 transition-colors ${choice ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox id={checkboxId} checked={Boolean(choice)} onCheckedChange={() => toggleKit(kit.key, kit.defaultDateOffset)} className="mt-1" />
                      <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <KitIcon name={kit.icon} className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block font-medium">{kit.name}</span>
                          <span className="block text-sm text-muted-foreground">{kit.summary}</span>
                        </span>
                      </label>
                    </div>
                    {choice && (
                      <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`${checkboxId}-date`}>{kit.dateLabel}</Label>
                          <Input id={`${checkboxId}-date`} type="date" value={choice.date} onChange={(event) => updateKit(kit.key, { date: event.target.value })} />
                        </div>
                        {kit.labelPrompt && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`${checkboxId}-label`}>{kit.labelPrompt.question}</Label>
                            <Input
                              id={`${checkboxId}-label`}
                              value={choice.label}
                              maxLength={60}
                              placeholder={kit.labelPrompt.placeholder}
                              onChange={(event) => updateKit(kit.key, { label: event.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <Button className="w-full gap-2" onClick={() => setStep(2)}>
              {pickedCount === 0 ? "Nothing big right now" : "Continue"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">How should Today feel?</h2>
              <p className="text-muted-foreground">Pick a planning style and your usual work window.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {planningStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  className={`interactive-card rounded-lg border p-4 text-left transition-colors ${
                    planningStyle === style.id ? "border-primary bg-primary/5" : "hover:bg-secondary"
                  }`}
                  onClick={() => setPlanningStyle(style.id)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    {style.label}
                  </span>
                  <span className="mt-2 block text-sm text-muted-foreground">{style.description}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="work-start">Work starts</Label>
                <Input id="work-start" type="time" value={workStart} onChange={(event) => setWorkStart(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="work-end">Work ends</Label>
                <Input id="work-end" type="time" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setStep(3)}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Anything else for today?</h2>
              <p className="text-muted-foreground">All optional. Leave these blank and finish.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-task" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  A task for today
                </Label>
                <Input id="first-task" value={firstTask} onChange={(event) => setFirstTask(event.target.value)} placeholder="Call the dentist" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-goal" className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  A goal
                </Label>
                <Input id="first-goal" value={firstGoal} onChange={(event) => setFirstGoal(event.target.value)} placeholder="Build a calm morning routine" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-gratitude" className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4 text-amber-600" />
                Something you&apos;re thankful for
              </Label>
              <Input id="first-gratitude" value={firstGratitude} onChange={(event) => setFirstGratitude(event.target.value)} placeholder="A slow breakfast" />
            </div>

            {kitError && <p className="text-sm text-destructive">{kitError}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1" onClick={() => completeOnboarding(false)} disabled={saving}>
                {saving && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />}
                {pickedCount > 0 ? `Set up ${pickedCount} ${pickedCount === 1 ? "kit" : "kits"} and finish` : "Finish"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
