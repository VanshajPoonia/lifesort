"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Search, 
  Quote, 
  Laugh, 
  Gamepad2, 
  Calendar,
  Settings2,
  Sparkles,
  Filter,
  Play,
  Trophy,
  Brain,
  Dices,
  HelpCircle,
} from "lucide-react"
import { WordleGame } from "@/components/games/wordle-game"
import { SnakeGame } from "@/components/games/snake-game"

interface ContentItem {
  id: number
  content_type: string
  category: string
  content: string
  extra_data: {
    punchline?: string
    answer?: string
    options?: string[]
    author?: string
    score?: number
    won?: boolean
    attempts?: number
    result?: string
  }
  shown_at: string
}

interface ContentPreferences {
  quote_types: string[]
  joke_types: string[]
  show_quotes: boolean
  show_jokes: boolean
  show_games: boolean
}

export default function DailyContentPage() {
  const [history, setHistory] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<string | null>(null)
  const [preferences, setPreferences] = useState<ContentPreferences>({
    quote_types: ["motivational"],
    joke_types: ["funny"],
    show_quotes: true,
    show_jokes: true,
    show_games: true,
  })

  useEffect(() => {
    fetchHistory()
    fetchPreferences()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchHistory()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, filterType])

  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set("search", searchQuery)
      if (filterType && filterType !== "all") params.set("type", filterType)
      
      const response = await fetch(`/api/daily-content/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error("[v0] Error fetching history:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/profile")
      if (response.ok) {
        const data = await response.json()
        if (data.content_preferences) {
          setPreferences(data.content_preferences)
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching preferences:", error)
    }
  }

  const savePreferences = async () => {
    try {
      const response = await fetch("/api/daily-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })
      if (response.ok) {
        setIsSettingsOpen(false)
      }
    } catch (error) {
      console.error("[v0] Error saving preferences:", error)
    }
  }

  const saveGameResult = async (gameType: string, content: string, extraData: Record<string, unknown>) => {
    try {
      await fetch("/api/daily-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: gameType,
          content,
          extra_data: extraData
        })
      })
      fetchHistory()
    } catch (error) {
      console.error("[v0] Error saving game:", error)
    }
  }

  const toggleQuoteType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      quote_types: prev.quote_types.includes(type)
        ? prev.quote_types.filter(t => t !== type)
        : [...prev.quote_types, type]
    }))
  }

  const toggleJokeType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      joke_types: prev.joke_types.includes(type)
        ? prev.joke_types.filter(t => t !== type)
        : [...prev.joke_types, type]
    }))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "quote":
        return <Quote className="h-5 w-5 text-primary" />
      case "joke":
        return <Laugh className="h-5 w-5 text-amber-500" />
      case "wordle":
        return <Brain className="h-5 w-5 text-green-500" />
      case "snake":
        return <Gamepad2 className="h-5 w-5 text-purple-500" />
      case "trivia":
      case "riddle":
        return <HelpCircle className="h-5 w-5 text-blue-500" />
      default:
        return <Sparkles className="h-5 w-5 text-primary" />
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    })
  }

  const games = [
    { id: "wordle", name: "Wordle", icon: Brain, color: "bg-green-500", description: "Guess the 5-letter word in 6 tries" },
    { id: "snake", name: "Snake", icon: Gamepad2, color: "bg-purple-500", description: "Classic snake game - eat and grow!" },
  ]

  return (
    <DashboardLayout
      title="Daily Quotes & Games"
      subtitle="Your collection of daily inspiration, jokes, and brain teasers"
    >
      <div className="space-y-6">
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
            <TabsTrigger value="history">
              <Calendar className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="games">
              <Gamepad2 className="h-4 w-4 mr-2" />
              Play Games
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* Header with Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="quote">Quotes</SelectItem>
                    <SelectItem value="joke">Jokes</SelectItem>
                    <SelectItem value="wordle">Wordle</SelectItem>
                    <SelectItem value="snake">Snake</SelectItem>
                    <SelectItem value="trivia">Trivia</SelectItem>
                    <SelectItem value="riddle">Riddles</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Preferences
                </Button>
              </div>
            </div>

            {/* Content Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-6">
                      <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                      <div className="h-16 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : history.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No content yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Your daily quotes, jokes, and game results will appear here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Play some games or wait for your daily popup to start building your history!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getIcon(item.content_type)}
                          <Badge variant="secondary" className="text-xs capitalize">
                            {item.category || item.content_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.shown_at)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {item.content_type === "quote" && (
                        <div className="space-y-2">
                          <blockquote className="text-sm italic border-l-2 border-primary/30 pl-3">
                            "{item.content}"
                          </blockquote>
                          {item.extra_data?.author && (
                            <p className="text-xs text-muted-foreground text-right">
                              - {item.extra_data.author}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {item.content_type === "joke" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{item.content}</p>
                          {item.extra_data?.punchline && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              {item.extra_data.punchline}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {item.content_type === "wordle" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{item.content}</p>
                          {item.extra_data?.result && (
                            <p className={`text-sm ${item.extra_data.won ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {item.extra_data.result}
                            </p>
                          )}
                        </div>
                      )}

                      {item.content_type === "snake" && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{item.content}</p>
                          {item.extra_data?.score !== undefined && (
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-amber-500" />
                              <p className="text-sm text-amber-600 dark:text-amber-400">
                                Score: {item.extra_data.score}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {(item.content_type === "trivia" || item.content_type === "riddle") && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{item.content}</p>
                          {item.extra_data?.answer && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              Answer: {item.extra_data.answer}
                            </p>
                          )}
                        </div>
                      )}

                      {!["quote", "joke", "wordle", "snake", "trivia", "riddle"].includes(item.content_type) && (
                        <div className="space-y-2">
                          <p className="text-sm">{item.content}</p>
                          {item.extra_data?.result && (
                            <p className="text-sm text-muted-foreground">{item.extra_data.result}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Games Tab */}
          <TabsContent value="games" className="space-y-6">
            {activeGame ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize">{activeGame}</CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setActiveGame(null)}>
                      Back to Games
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeGame === "wordle" && (
                    <WordleGame 
                      onComplete={(won, attempts) => {
                        saveGameResult("wordle", `Wordle ${won ? "Won" : "Lost"}`, { 
                          won, 
                          attempts,
                          result: won ? `Solved in ${attempts} attempts` : "Failed to solve"
                        })
                      }} 
                    />
                  )}
                  {activeGame === "snake" && (
                    <SnakeGame 
                      onComplete={(score) => {
                        saveGameResult("snake", `Snake Game - Score: ${score}`, { 
                          score,
                          result: `Final score: ${score} points`
                        })
                      }} 
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <Card 
                    key={game.id} 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                    onClick={() => setActiveGame(game.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className={`${game.color} w-16 h-16 rounded-2xl mx-auto flex items-center justify-center`}>
                          <game.icon className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{game.name}</h3>
                          <p className="text-sm text-muted-foreground">{game.description}</p>
                        </div>
                        <Button className="w-full">
                          <Play className="h-4 w-4 mr-2" />
                          Play Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Preferences Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Content Preferences</DialogTitle>
            <DialogDescription>
              Customize what type of content you want to see each day
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Content Types */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Content Types</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="show_quotes"
                    checked={preferences.show_quotes}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, show_quotes: !!checked }))
                    }
                  />
                  <label htmlFor="show_quotes" className="flex items-center gap-2 cursor-pointer">
                    <Quote className="h-4 w-4 text-primary" />
                    Show Quotes
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="show_jokes"
                    checked={preferences.show_jokes}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, show_jokes: !!checked }))
                    }
                  />
                  <label htmlFor="show_jokes" className="flex items-center gap-2 cursor-pointer">
                    <Laugh className="h-4 w-4 text-amber-500" />
                    Show Jokes
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="show_games"
                    checked={preferences.show_games}
                    onCheckedChange={(checked) => 
                      setPreferences(prev => ({ ...prev, show_games: !!checked }))
                    }
                  />
                  <label htmlFor="show_games" className="flex items-center gap-2 cursor-pointer">
                    <Gamepad2 className="h-4 w-4 text-green-500" />
                    Show Games & Riddles
                  </label>
                </div>
              </div>
            </div>

            {/* Quote Types */}
            {preferences.show_quotes && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Quote Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {["motivational", "religious", "philosophical", "stoic", "funny", "love", "success"].map(type => (
                    <Button
                      key={type}
                      variant={preferences.quote_types.includes(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleQuoteType(type)}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Joke Types */}
            {preferences.show_jokes && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Joke Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {["funny", "dank", "dad", "dark", "tech", "pun", "oneliners"].map(type => (
                    <Button
                      key={type}
                      variant={preferences.joke_types.includes(type) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleJokeType(type)}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={savePreferences} className="w-full">
              Save Preferences
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
