"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  CalendarDays,
  Target,
  CheckSquare,
  Wallet,
  FileText,
  Heart,
  TrendingUp,
  DollarSign,
  Link2,
  FolderPlus,
  Sparkles,
  Timer,
  Zap,
  ChevronRight,
  ChevronLeft,
  Settings,
  Quote,
  Gamepad2,
} from "lucide-react"

interface OnboardingModalProps {
  isOpen: boolean
  onComplete: () => void
}

const FEATURES = [
  { id: "dashboard", label: "Dashboard", icon: Target, description: "Overview of your day" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, description: "Schedule events and reminders" },
  { id: "goals", label: "Goals", icon: Target, description: "Track long-term goals" },
  { id: "tasks", label: "Daily Tasks", icon: CheckSquare, description: "To-do lists and task management" },
  { id: "budget", label: "Budget", icon: Wallet, description: "Track income and expenses" },
  { id: "notes", label: "Notes", icon: FileText, description: "Quick notes and ideas" },
  { id: "wishlist", label: "Wishlist", icon: Heart, description: "Track items you want" },
  { id: "investments", label: "Investments", icon: TrendingUp, description: "Track your portfolio" },
  { id: "income", label: "Income", icon: DollarSign, description: "Track income sources" },
  { id: "links", label: "My Links", icon: Link2, description: "Save links and images" },
  { id: "custom_sections", label: "Custom Sections", icon: FolderPlus, description: "Create custom lists" },
  { id: "daily_content", label: "Daily Quotes & Games", icon: Sparkles, description: "Fun daily activities" },
  { id: "pomodoro", label: "Pomodoro Timer", icon: Timer, description: "Focus sessions" },
  { id: "nuke", label: "Nuke Goal", icon: Zap, description: "Intense goal focus" },
  { id: "ai_assistant", label: "AI Assistant", icon: Sparkles, description: "AI-powered help" },
]

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1)
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(["dashboard", "calendar", "tasks", "notes"])
  )
  const [dailyPopupEnabled, setDailyPopupEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const totalSteps = 3

  const toggleFeature = (id: string) => {
    const newSelected = new Set(selectedFeatures)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedFeatures(newSelected)
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      // Build sidebar preferences from selected features
      const sidebarPrefs: Record<string, boolean> = {}
      FEATURES.forEach((f) => {
        sidebarPrefs[f.id] = selectedFeatures.has(f.id)
      })

      const appPrefs = {
        daily_popup_enabled: dailyPopupEnabled,
        onboarding_date: new Date().toISOString(),
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_preferences: appPrefs,
          sidebar_preferences: sidebarPrefs,
        }),
      })

      if (!response.ok) {
        alert("Failed to save preferences. Please try again or contact support.")
        return
      }

      onComplete()
    } catch (error) {
      console.error("Error saving onboarding:", error)
      alert("Failed to save preferences. Please check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (saving) return
    
    setSaving(true)
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_preferences: { daily_popup_enabled: true },
          sidebar_preferences: {},
        }),
      })
      
      if (!response.ok) {
        alert("Failed to skip onboarding. Please try again or contact support.")
        return
      }

      onComplete()
    } catch (error) {
      console.error("Error skipping onboarding:", error)
      alert("Failed to skip onboarding. Please check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        {/* Progress bar */}
        <div className="px-6 pt-6">
          <div className="flex items-center gap-4 mb-2">
            <Progress value={(step / totalSteps) * 100} className="h-2 flex-1" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSkip}
              className="shrink-0 text-xs bg-transparent"
              disabled={saving}
            >
              {saving ? "Saving..." : "Skip"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Step {step} of {totalSteps}</p>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Your Personal Dashboard!</h2>
              <p className="text-muted-foreground">
                Let's set up your workspace. We'll customize the app based on what you need.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold">Here's what you can do:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Settings className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Customize your sidebar</strong> - Show only the features you need</span>
                </li>
                <li className="flex items-start gap-2">
                  <Quote className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Daily quotes & games</strong> - Get inspired with quotes, jokes, or play mini-games every 2 hours</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Choose your themes</strong> - Pick motivational, religious, funny content and more</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground/70 pt-2 border-t">
                You can change all these settings anytime in <strong>Settings</strong> (cog icon in sidebar)
              </p>
            </div>

            <Button className="w-full" onClick={() => setStep(2)}>
              Let's Get Started
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Feature Selection */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">What would you like to use?</h2>
              <p className="text-sm text-muted-foreground">
                Select the features you want in your sidebar. You can change this later in Settings.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFeatures(new Set(FEATURES.map(f => f.id)))}
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFeatures(new Set())}
                className="text-xs"
              >
                Deselect All
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[350px] overflow-y-auto pr-2">
              {FEATURES.map((feature) => {
                const Icon = feature.icon
                const isSelected = selectedFeatures.has(feature.id)

                return (
                  <Card
                    key={feature.id}
                    className={`cursor-pointer transition-all ${
                      isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => toggleFeature(feature.id)}
                  >
                    <CardContent className="p-3 flex items-start gap-2">
                      <Checkbox checked={isSelected} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{feature.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Daily Content Preferences */}
        {step === 3 && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Daily Fun Activity</h2>
              <p className="text-sm text-muted-foreground">
                Would you like to receive daily quotes, jokes, or mini-games?
              </p>
            </div>

            <Card
              className={`cursor-pointer transition-all ${
                dailyPopupEnabled ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setDailyPopupEnabled(!dailyPopupEnabled)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox checked={dailyPopupEnabled} />
                <div>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">Enable Daily Popup</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Get a random quote, joke, or mini-game every 2 hours when you use the app.
                    Includes Wordle, Snake, riddles, trivia, and more!
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <h4 className="font-semibold">Quick Tips:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Customize quote/joke themes in <strong>Settings &gt; Content Preferences</strong></li>
                <li>• Hide/show sidebar sections in <strong>Settings &gt; Sidebar</strong></li>
                <li>• Your game scores are saved in <strong>Daily Quotes & Games</strong></li>
                <li>• Need help? Check the <strong>FAQs</strong> in your Profile settings</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1" onClick={handleComplete} disabled={saving}>
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                ) : null}
                Complete Setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
