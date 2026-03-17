"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  CheckCircle2,
  Timer,
  Settings,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SessionType = "focus" | "shortBreak" | "longBreak"

interface Session {
  id: string
  type: SessionType
  duration: number
  completedAt: string
}

export default function PomodoroPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [sessionType, setSessionType] = useState<SessionType>("focus")
  const [isRunning, setIsRunning] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const [history, setHistory] = useState<Session[]>([])
  const [showSettings, setShowSettings] = useState(false)
  
  // Customizable durations (in minutes)
  const [customDurations, setCustomDurations] = useState({
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
  })
  
  const durations: Record<SessionType, number> = {
    focus: customDurations.focus * 60,
    shortBreak: customDurations.shortBreak * 60,
    longBreak: customDurations.longBreak * 60,
  }
  
  const [timeLeft, setTimeLeft] = useState(durations.focus)

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSessionComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, timeLeft])

  const handleSessionComplete = () => {
    setIsRunning(false)
    const newSession: Session = {
      id: Date.now().toString(),
      type: sessionType,
      duration: durations[sessionType] / 60,
      completedAt: new Date().toISOString(),
    }
    setHistory([newSession, ...history])

    if (sessionType === "focus") {
      setSessionsCompleted((prev) => prev + 1)
    }

    // Auto-switch to break after focus session
    if (sessionType === "focus") {
      const nextType = sessionsCompleted % 4 === 3 ? "longBreak" : "shortBreak"
      handleSessionTypeChange(nextType)
    }
  }

  const handleSessionTypeChange = (type: SessionType) => {
    setSessionType(type)
    setTimeLeft(durations[type])
    setIsRunning(false)
  }

  const handleReset = () => {
    setIsRunning(false)
    setTimeLeft(durations[sessionType])
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getSessionIcon = (type: SessionType) => {
    switch (type) {
      case "focus":
        return <Brain className="h-4 w-4" />
      case "shortBreak":
        return <Coffee className="h-4 w-4" />
      case "longBreak":
        return <Coffee className="h-4 w-4" />
    }
  }

  const getSessionColor = (type: SessionType) => {
    switch (type) {
      case "focus":
        return "text-primary"
      case "shortBreak":
        return "text-success"
      case "longBreak":
        return "text-accent"
    }
  }

  const progress = ((durations[sessionType] - timeLeft) / durations[sessionType]) * 100

  const stats = {
    focusSessions: history.filter((s) => s.type === "focus").length,
    totalMinutes: history.reduce((acc, s) => acc + s.duration, 0),
    todaySessions: history.filter((s) => {
      const sessionDate = new Date(s.completedAt).toDateString()
      const today = new Date().toDateString()
      return sessionDate === today
    }).length,
  }

  return (
    <DashboardLayout title="Pomodoro Timer" subtitle="Focus and productivity technique">
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Sessions</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todaySessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Focus Sessions</CardTitle>
              <Brain className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.focusSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
              <Timer className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMinutes}</div>
            </CardContent>
          </Card>
        </div>

        {/* Timer Card */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <Tabs value={sessionType} onValueChange={(value) => handleSessionTypeChange(value as SessionType)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="focus">Focus</TabsTrigger>
                <TabsTrigger value="shortBreak">Short Break</TabsTrigger>
                <TabsTrigger value="longBreak">Long Break</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center py-8">
              <div
                className="relative flex h-64 w-64 items-center justify-center rounded-full border-8 border-primary/20"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${progress}%, transparent ${progress}%)`,
                }}
              >
                <div className="flex h-56 w-56 items-center justify-center rounded-full bg-card">
                  <div className="text-center">
                    <div className="text-6xl font-bold tabular-nums text-foreground">
                      {formatTime(timeLeft)}
                    </div>
                    <p className="mt-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      {sessionType === "focus" ? "Focus Time" : sessionType === "shortBreak" ? "Short Break" : "Long Break"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Counter */}
              <div className="mt-6 flex items-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      i < sessionsCompleted % 4 ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => setIsRunning(!isRunning)}
                disabled={timeLeft === 0}
                className="gap-2 px-8"
              >
                {isRunning ? (
                  <>
                    <Pause className="h-5 w-5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Start
                  </>
                )}
              </Button>
              <Button size="lg" variant="outline" onClick={handleReset} className="gap-2 bg-transparent">
                <RotateCcw className="h-5 w-5" />
                Reset
              </Button>
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="gap-2 bg-transparent">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Timer Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="focus-time">Focus Time (minutes)</Label>
                      <Input
                        id="focus-time"
                        type="number"
                        min="1"
                        max="120"
                        value={customDurations.focus}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 25
                          setCustomDurations({ ...customDurations, focus: val })
                          if (sessionType === "focus" && !isRunning) {
                            setTimeLeft(val * 60)
                          }
                        }}
                        className="text-foreground"
                      />
                    </div>
                    <div>
                      <Label htmlFor="short-break">Short Break (minutes)</Label>
                      <Input
                        id="short-break"
                        type="number"
                        min="1"
                        max="30"
                        value={customDurations.shortBreak}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 5
                          setCustomDurations({ ...customDurations, shortBreak: val })
                          if (sessionType === "shortBreak" && !isRunning) {
                            setTimeLeft(val * 60)
                          }
                        }}
                        className="text-foreground"
                      />
                    </div>
                    <div>
                      <Label htmlFor="long-break">Long Break (minutes)</Label>
                      <Input
                        id="long-break"
                        type="number"
                        min="1"
                        max="60"
                        value={customDurations.longBreak}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 15
                          setCustomDurations({ ...customDurations, longBreak: val })
                          if (sessionType === "longBreak" && !isRunning) {
                            setTimeLeft(val * 60)
                          }
                        }}
                        className="text-foreground"
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Session History */}
        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
            <CardDescription>Your recent Pomodoro sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sessions completed yet. Start your first Pomodoro!
              </div>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-secondary ${getSessionColor(session.type)}`}>
                        {getSessionIcon(session.type)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {session.type === "focus"
                            ? "Focus Session"
                            : session.type === "shortBreak"
                              ? "Short Break"
                              : "Long Break"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(session.completedAt).toLocaleTimeString()} - {session.duration} minutes
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{session.duration}m</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
