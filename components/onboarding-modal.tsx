"use client"

import { useState } from "react"
import { BookOpenText, BriefcaseBusiness, CheckSquare, ChevronLeft, ChevronRight, Heart, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

const LIFE_AREAS = [
  "Health",
  "Work",
  "Money",
  "Relationships",
  "Home",
  "Learning",
  "Admin",
  "Fun",
]

const planningStyles = [
  { id: "light", label: "Light", description: "A short list and gentle reminders." },
  { id: "structured", label: "Structured", description: "Clear must-do work and regular reviews." },
  { id: "flexible", label: "Flexible", description: "Loose priorities that can adapt during the day." },
]

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 10)
}

async function bestEffortWrite(url: string, body: unknown) {
  try {
    await fetch(url, {
      method: url.includes("/journal/") ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch (error) {
    console.warn("Optional onboarding write failed:", error)
  }
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1)
  const [selectedLifeAreas, setSelectedLifeAreas] = useState<Set<string>>(new Set(["Work", "Health", "Money"]))
  const [planningStyle, setPlanningStyle] = useState("light")
  const [workStart, setWorkStart] = useState("09:00")
  const [workEnd, setWorkEnd] = useState("17:00")
  const [firstTask, setFirstTask] = useState("")
  const [firstGoal, setFirstGoal] = useState("")
  const [firstGratitude, setFirstGratitude] = useState("")
  const [dailyPopupEnabled, setDailyPopupEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const totalSteps = 4

  const toggleLifeArea = (area: string) => {
    setSelectedLifeAreas((current) => {
      const next = new Set(current)
      if (next.has(area)) {
        next.delete(area)
      } else {
        next.add(area)
      }
      return next
    })
  }

  const completeOnboarding = async (skipped = false) => {
    if (saving) return
    setSaving(true)

    try {
      if (!skipped) {
        const optionalWrites = []

        if (firstTask.trim()) {
          optionalWrites.push(bestEffortWrite("/api/tasks", { title: firstTask.trim(), priority: "medium" }))
        }

        if (firstGoal.trim()) {
          optionalWrites.push(bestEffortWrite("/api/goals", { title: firstGoal.trim(), priority: "medium", status: "active" }))
        }

        if (firstGratitude.trim()) {
          optionalWrites.push(
            bestEffortWrite(`/api/journal/${localDateString()}`, {
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
            daily_popup_enabled: dailyPopupEnabled,
            onboarding_date: new Date().toISOString(),
            onboarding_skipped: skipped,
            important_life_areas: Array.from(selectedLifeAreas),
            planning_style: planningStyle,
            work_hours_start: workStart,
            work_hours_end: workEnd,
          },
          sidebar_preferences: {},
        }),
      })

      if (!response.ok) {
        alert("Failed to save setup. Please try again or contact support.")
        return
      }

      onComplete()
    } catch (error) {
      console.error("Error saving onboarding:", error)
      alert("Failed to save setup. Please check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

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
              <h2 className="text-2xl font-bold">Set up your LifeSort focus</h2>
              <p className="text-muted-foreground">Choose the Life Areas you want LifeSort to keep close at hand.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {LIFE_AREAS.map((area) => {
                const selected = selectedLifeAreas.has(area)
                return (
                  <Card
                    key={area}
                    className={`interactive-card cursor-pointer transition-colors ${
                      selected ? "border-primary bg-primary/5" : "hover:bg-secondary"
                    }`}
                    onClick={() => toggleLifeArea(area)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <Checkbox checked={selected} aria-label={`Use ${area} as an important Life Area`} />
                      <span className="font-medium">{area}</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Button className="w-full gap-2" onClick={() => setStep(2)}>
              Continue
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
              <h2 className="text-2xl font-bold">Create your first anchors</h2>
              <p className="text-muted-foreground">Optional, but helpful: one task and one goal to make the app feel yours.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-task" className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  First task
                </Label>
                <Input
                  id="first-task"
                  value={firstTask}
                  onChange={(event) => setFirstTask(event.target.value)}
                  placeholder="Example: Plan tomorrow morning"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first-goal" className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  First goal
                </Label>
                <Input
                  id="first-goal"
                  value={firstGoal}
                  onChange={(event) => setFirstGoal(event.target.value)}
                  placeholder="Example: Build a calm routine"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={() => setStep(4)}>
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 p-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold">Start gently</h2>
              <p className="text-muted-foreground">Add one gratitude note and choose whether to keep daily content on.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="first-gratitude" className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4 text-amber-600" />
                First journal gratitude
              </Label>
              <Input
                id="first-gratitude"
                value={firstGratitude}
                onChange={(event) => setFirstGratitude(event.target.value)}
                placeholder="I am thankful for..."
              />
            </div>

            <Card
              className={`interactive-card cursor-pointer transition-colors ${
                dailyPopupEnabled ? "border-primary bg-primary/5" : "hover:bg-secondary"
              }`}
              onClick={() => setDailyPopupEnabled((enabled) => !enabled)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Checkbox checked={dailyPopupEnabled} aria-label="Enable daily content" />
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Heart className="h-4 w-4 text-primary" />
                    Keep daily quotes, jokes, and games on
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You can always change this later in Settings.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1" onClick={() => completeOnboarding(false)} disabled={saving}>
                {saving && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />}
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
