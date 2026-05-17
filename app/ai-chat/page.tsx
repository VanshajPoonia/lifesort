"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Send, Sparkles, Loader2, Trash2, Bot, Brain, ExternalLink, CheckCircle2 } from "lucide-react"
import type { ModelInfo } from "@/lib/ai-models"

const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free"

// Provider colour accents
const PROVIDER_COLORS: Record<string, string> = {
  Google: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  OpenAI: "bg-green-500/10 text-green-600 border-green-500/20",
  Anthropic: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Meta: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  DeepSeek: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  Mistral: "bg-pink-500/10 text-pink-600 border-pink-500/20",
}

type ContextMode = {
  id: string
  label: string
  description: string
}

type CoachCitation = {
  citation_id: string
  type: string
  id: string
  title: string
  href: string
  subtitle: string | null
  date: string | null
  life_area_name: string | null
}

type CoachContextPreview = {
  mode: string
  mode_label: string
  citations: CoachCitation[]
  unavailable: string[]
  summary: {
    citation_count: number
    unavailable_count: number
    source_count: number
  }
}

type DraftTask = {
  title: string
  description: string
  priority: "low" | "medium" | "high"
  life_area_id: number | null
}

const DEFAULT_CONTEXT_MODES: ContextMode[] = [
  { id: "today", label: "Today", description: "Today, overdue items, and urgent follow-ups" },
  { id: "this_week", label: "This week", description: "This week's tasks, events, habits, and review" },
  { id: "goals", label: "Goals", description: "Active, stale, and at-risk goals" },
  { id: "projects", label: "Projects", description: "Active projects, progress, and next actions" },
  { id: "finance", label: "Finance", description: "Budget, income, investments, and finance review signals" },
  { id: "full", label: "Full LifeSort summary", description: "Compact cross-app summary across LifeSort" },
]

const ACTION_BLOCK_PATTERN = /```lifesort-actions\s*([\s\S]*?)```/i

function getPartText(parts: Array<{ type: string; text?: string }>) {
  return parts.filter((part) => part.type === "text").map((part) => part.text ?? "").join("")
}

function cleanAssistantText(text: string) {
  return text.replace(ACTION_BLOCK_PATTERN, "").trim()
}

function parseDraftTasks(text: string): DraftTask[] {
  const match = text.match(ACTION_BLOCK_PATTERN)
  if (!match?.[1]) return []

  try {
    const parsed = JSON.parse(match[1].trim())
    const tasks: unknown[] = Array.isArray(parsed?.tasks) ? parsed.tasks : []
    return tasks
      .map((task: unknown): DraftTask | null => {
        if (typeof task !== "object" || task === null) return null
        const raw = task as Record<string, unknown>
        const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 180) : ""
        if (!title) return null
        const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 800) : ""
        const priority = raw.priority === "low" || raw.priority === "high" ? raw.priority : "medium"
        const lifeAreaId =
          typeof raw.life_area_id === "number" && Number.isInteger(raw.life_area_id)
            ? raw.life_area_id
            : typeof raw.life_area_id === "string" && /^\d+$/.test(raw.life_area_id)
              ? Number(raw.life_area_id)
              : null
        return { title, description, priority, life_area_id: lifeAreaId }
      })
      .filter((task): task is DraftTask => task !== null)
      .slice(0, 3)
  } catch {
    return []
  }
}

function matchedCitations(text: string, citations: CoachCitation[]) {
  const ids = new Set(Array.from(text.matchAll(/\[([a-z_]+:\d+)\]/g)).map((match) => match[1]))
  return citations.filter((citation) => ids.has(citation.citation_id)).slice(0, 8)
}

export default function AIChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [contextMode, setContextMode] = useState("today")
  const [contextModes, setContextModes] = useState<ContextMode[]>(DEFAULT_CONTEXT_MODES)
  const [contextPreview, setContextPreview] = useState<CoachContextPreview | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextError, setContextError] = useState("")
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelError, setModelError] = useState("")
  const [providerAvailable, setProviderAvailable] = useState(true)
  const [createdDrafts, setCreatedDrafts] = useState<Set<string>>(new Set())
  const [creatingDraftId, setCreatingDraftId] = useState<string | null>(null)

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: { modelId: selectedModel, contextMode },
    })
  }, [selectedModel, contextMode])

  const { messages, sendMessage, status, setMessages, error, clearError } = useChat({
    id: selectedModel,
    transport,
  })

  const isLoading = status === "submitted" || status === "streaming"

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setModelsLoading(true)
    setModelError("")

    fetch("/api/chat")
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login")
          return null
        }

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(data?.error || "Could not load AI models")
        }
        return data
      })
      .then((data) => {
        if (!data || cancelled) return
        setModels(data.models ?? [])
        if (Array.isArray(data.contextModes) && data.contextModes.length > 0) {
          setContextModes(data.contextModes)
        }
        setProviderAvailable(data.available !== false)
        if (data.default && typeof data.default === "string") {
          setSelectedModel(data.default)
        }
        if (data.available === false) {
          setModelError("AI chat is not configured yet. Add OPENROUTER_API_KEY to enable responses.")
        }
      })
      .catch((err) => {
        if (cancelled) return
        setModelError(err instanceof Error ? err.message : "Could not load AI models")
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [router, user])

  useEffect(() => {
    if (!user) return

    let cancelled = false
    setContextLoading(true)
    setContextError("")

    fetch(`/api/chat/context?mode=${encodeURIComponent(contextMode)}`)
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login")
          return null
        }

        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(data?.error || "Could not load LifeSort context")
        }
        return data
      })
      .then((data) => {
        if (!data || cancelled) return
        setContextPreview(data.context ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setContextPreview(null)
        setContextError(err instanceof Error ? err.message : "Could not load LifeSort context")
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [contextMode, router, user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading || !providerAvailable) return
    clearError()
    sendMessage({ role: "user", parts: [{ type: "text", text }] })
    setInput("")
  }

  const handleClear = () => {
    setMessages([])
    setCreatedDrafts(new Set())
  }

  const handleCreateDraftTask = async (draftKey: string, task: DraftTask) => {
    const confirmed = window.confirm(`Create this task?\n\n${task.title}`)
    if (!confirmed) return

    setCreatingDraftId(draftKey)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          life_area_id: task.life_area_id,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Could not create task")
      }
      setCreatedDrafts((prev) => {
        const next = new Set(prev)
        next.add(draftKey)
        return next
      })
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Could not create task")
    } finally {
      setCreatingDraftId(null)
    }
  }

  const activeModel = models.find(m => m.id === selectedModel)
  const firstName = user?.name?.split(" ")[0] || ""
  const activeContextMode = contextModes.find((mode) => mode.id === contextMode)

  if (loading || !user) {
    return (
      <DashboardLayout title="LifeSort Coach" subtitle="App-aware coaching from your LifeSort data">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="LifeSort Coach" subtitle={`Hey ${firstName}, ask about your actual tasks, goals, projects, and reviews.`}>
      <div className="flex h-[calc(100vh-11rem)] flex-col gap-3">

        {/* Model selector bar */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 lg:flex-row lg:items-center">
          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Model:</span>

            <Select
              value={selectedModel}
              disabled={modelsLoading || models.length === 0}
              onValueChange={(val) => {
                setSelectedModel(val)
                clearError()
                setMessages([])
                setCreatedDrafts(new Set())
              }}
            >
              <SelectTrigger className="h-8 w-full text-sm sm:w-64">
                <SelectValue placeholder={modelsLoading ? "Loading models..." : "Select model"} />
              </SelectTrigger>
              <SelectContent>
                {models.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      {m.free && (
                        <Badge variant="outline" className="h-4 px-1 text-[10px] text-green-600 border-green-500/30">
                          free
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Context:</span>
            <Select
              value={contextMode}
              onValueChange={(val) => {
                setContextMode(val)
                clearError()
                setMessages([])
                setCreatedDrafts(new Set())
              }}
            >
              <SelectTrigger className="h-8 w-full text-sm sm:w-56">
                <SelectValue placeholder="Select context" />
              </SelectTrigger>
              <SelectContent>
                {contextModes.map(mode => (
                  <SelectItem key={mode.id} value={mode.id}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeModel && (
            <div className="hidden min-w-0 items-center gap-2 xl:flex">
              <Badge
                variant="outline"
                className={`text-xs ${PROVIDER_COLORS[activeModel.provider] ?? ""}`}
              >
                {activeModel.provider}
              </Badge>
              <span className="truncate text-xs text-muted-foreground">{activeModel.description}</span>
            </div>
          )}

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              title="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {(modelError || error) && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              {error?.message || modelError}
            </div>
            {error && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-destructive hover:text-destructive"
                onClick={clearError}
              >
                Dismiss
              </Button>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                {contextLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Brain className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Context used: {contextPreview?.mode_label ?? activeContextMode?.label ?? "Today"}</p>
                  {contextPreview && (
                    <Badge variant="outline" className="text-xs">
                      {contextPreview.summary.citation_count} items
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {contextError || activeContextMode?.description || "LifeSort context is gathered server-side for this chat."}
                </p>
                {contextPreview?.unavailable.length ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Partial context: {contextPreview.unavailable.slice(0, 5).join(", ")}
                    {contextPreview.unavailable.length > 5 ? "..." : ""}
                  </p>
                ) : null}
              </div>
            </div>

            {contextPreview?.citations.length ? (
              <div className="flex max-w-full flex-wrap gap-2 lg:max-w-[48%] lg:justify-end">
                {contextPreview.citations.slice(0, 8).map((item) => (
                  <a
                    key={item.citation_id}
                    href={item.href}
                    className="inline-flex max-w-48 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    title={`${item.citation_id}: ${item.title}`}
                  >
                    <span className="truncate">{item.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Messages */}
        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="mb-2 text-xl font-semibold">How can I help you today?</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Ask about what to focus on, what is overdue, which goals are at risk, or how your week is going.
                  </p>
                  {activeModel && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Using <span className="font-medium">{activeModel.name}</span> by {activeModel.provider}
                      {activeModel.free && <span className="ml-1 text-green-600">(free)</span>}
                    </p>
                  )}
                </div>
              )}

              {messages.map((message) => {
                const rawText = getPartText(message.parts)
                const displayText = message.role === "assistant" ? cleanAssistantText(rawText) : rawText
                const draftTasks = message.role === "assistant" ? parseDraftTasks(rawText) : []
                const citations = message.role === "assistant" && contextPreview
                  ? matchedCitations(rawText, contextPreview.citations)
                  : []

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Sparkles className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={`max-w-[86%] space-y-2 ${message.role === "user" ? "items-end" : "items-start"}`}>
                      <Card className={`p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card"
                      }`}>
                        <p className="whitespace-pre-wrap text-sm">
                          {displayText || (message.role === "assistant" ? "Thinking..." : "")}
                        </p>
                      </Card>

                      {citations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {citations.map((item) => (
                            <a
                              key={`${message.id}-${item.citation_id}`}
                              href={item.href}
                              className="inline-flex max-w-56 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                              title={`${item.citation_id}: ${item.title}`}
                            >
                              <span className="font-mono text-[10px]">{item.citation_id}</span>
                              <span className="truncate">{item.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}

                      {draftTasks.length > 0 && (
                        <div className="space-y-2">
                          {draftTasks.map((task, index) => {
                            const draftKey = `${message.id}:${index}`
                            const created = createdDrafts.has(draftKey)
                            return (
                              <div key={draftKey} className="rounded-lg border border-border bg-background p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline" className="text-xs">Draft task</Badge>
                                      <Badge variant="secondary" className="text-xs">{task.priority}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm font-medium">{task.title}</p>
                                    {task.description && (
                                      <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={created ? "secondary" : "default"}
                                    disabled={created || creatingDraftId === draftKey}
                                    onClick={() => handleCreateDraftTask(draftKey, task)}
                                    className="shrink-0 gap-2"
                                  >
                                    {created ? (
                                      <CheckCircle2 className="h-4 w-4" />
                                    ) : creatingDraftId === draftKey ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                    {created ? "Created" : "Create task"}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                          {user.name?.charAt(0).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )
              })}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="p-3 bg-card">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {activeModel?.name ?? "AI"} is thinking…
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${activeModel?.name ?? "LifeSort Coach"} about ${activeContextMode?.label.toLowerCase() ?? "today"}…`}
            className="flex-1"
            disabled={isLoading || !providerAvailable}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim() || !providerAvailable} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </div>
    </DashboardLayout>
  )
}
