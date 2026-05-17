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
import { AlertCircle, Send, Sparkles, Loader2, Trash2, Bot } from "lucide-react"
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

export default function AIChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelError, setModelError] = useState("")
  const [providerAvailable, setProviderAvailable] = useState(true)

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: { modelId: selectedModel },
    })
  }, [selectedModel])

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
  }

  const activeModel = models.find(m => m.id === selectedModel)
  const firstName = user?.name?.split(" ")[0] || ""

  if (loading || !user) {
    return (
      <DashboardLayout title="AI Assistant" subtitle="Your personal productivity coach">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="AI Assistant" subtitle={`Hey ${firstName}, how can I help you today?`}>
      <div className="flex h-[calc(100vh-11rem)] flex-col gap-3">

        {/* Model selector bar */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">Model:</span>

          <Select
            value={selectedModel}
            disabled={modelsLoading || models.length === 0}
            onValueChange={(val) => {
              setSelectedModel(val)
              clearError()
              setMessages([])   // clear history when switching models
            }}
          >
            <SelectTrigger className="h-8 w-64 text-sm">
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

          {activeModel && (
            <div className="hidden sm:flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${PROVIDER_COLORS[activeModel.provider] ?? ""}`}
              >
                {activeModel.provider}
              </Badge>
              <span className="text-xs text-muted-foreground">{activeModel.description}</span>
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
                    Ask me about productivity, goal setting, time management, or anything about organising your life.
                  </p>
                  {activeModel && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Using <span className="font-medium">{activeModel.name}</span> by {activeModel.provider}
                      {activeModel.free && <span className="ml-1 text-green-600">(free)</span>}
                    </p>
                  )}
                </div>
              )}

              {messages.map((message) => (
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

                  <Card className={`max-w-[80%] p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">
                      {message.parts.filter(p => p.type === "text").map(p => p.text).join("")}
                    </p>
                  </Card>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {user.name?.charAt(0).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

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
            placeholder={`Message ${activeModel?.name ?? "AI"}…`}
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
