"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  X, 
  Quote, 
  Laugh, 
  Gamepad2, 
  Sparkles,
  ChevronRight,
  Check,
  RefreshCw,
  ThumbsUp,
  Lightbulb,
  HelpCircle,
  Brain,
  Trophy
} from "lucide-react"
import { WordleGame } from "@/components/games/wordle-game"
import { SnakeGame } from "@/components/games/snake-game"

interface DailyContent {
  id?: number
  content_type: string
  category?: string
  content: string
  extra_data?: {
    punchline?: string
    answer?: string
    options?: string[]
    option_a?: string
    option_b?: string
    fact?: string
    author?: string
  }
}

const CONTENT_TYPES = [
  { type: "quote", icon: Quote, label: "Quote", color: "text-primary" },
  { type: "joke", icon: Laugh, label: "Joke", color: "text-amber-500" },
  { type: "riddle", icon: HelpCircle, label: "Riddle", color: "text-purple-500" },
  { type: "trivia", icon: Brain, label: "Trivia", color: "text-blue-500" },
  { type: "would_you_rather", icon: ThumbsUp, label: "Would You Rather", color: "text-pink-500" },
  { type: "fun_fact", icon: Lightbulb, label: "Fun Fact", color: "text-green-500" },
  { type: "wordle", icon: Gamepad2, label: "Wordle", color: "text-emerald-500" },
  { type: "snake", icon: Trophy, label: "Snake", color: "text-orange-500" },
]

export function DailyPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState<DailyContent | null>(null)
  const [showPunchline, setShowPunchline] = useState(false)
  const [userAnswer, setUserAnswer] = useState("")
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [wyrChoice, setWyrChoice] = useState<"a" | "b" | null>(null)
  const [activeGame, setActiveGame] = useState<"wordle" | "snake" | null>(null)

  useEffect(() => {
    checkDailyContent()
  }, [])

  const checkDailyContent = async () => {
    try {
      // Check if popup was shown within the last 2 hours
      const lastShownTime = localStorage.getItem("daily_popup_last_shown")
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000 // 2 hours in milliseconds
      
      if (lastShownTime) {
        const timeSinceLastShown = Date.now() - parseInt(lastShownTime)
        if (timeSinceLastShown < TWO_HOURS_MS) {
          setLoading(false)
          return
        }
      }

      // Random pick between quote, joke, or game each session
      const mainTypes = ["quote", "joke", "game"]
      const randomType = mainTypes[Math.floor(Math.random() * mainTypes.length)]
      
      // Map "game" to a specific game type
      let contentType = randomType
      if (randomType === "game") {
        const gameTypes = ["riddle", "trivia", "would_you_rather", "fun_fact", "wordle", "snake"]
        contentType = gameTypes[Math.floor(Math.random() * gameTypes.length)]
      }

      // Generate fresh AI content
      await fetchAIContent(contentType)
      localStorage.setItem("daily_popup_last_shown", Date.now().toString())
      setIsOpen(true)
    } catch (error) {
      console.error("[v0] Error fetching daily content:", error)
      // Fallback to static content
      setContent({
        content_type: "quote",
        content: "The only way to do great work is to love what you do.",
        extra_data: { author: "Steve Jobs" }
      })
      localStorage.setItem("daily_popup_last_shown", Date.now().toString())
      setIsOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchAIContent = async (specificType?: string) => {
    setLoading(true)
    resetState()

    try {
      // Get user preferences
      const prefs = localStorage.getItem("content_preferences")
      const preferences = prefs ? JSON.parse(prefs) : {
        quotes: ["motivational"],
        jokes: ["funny"],
        games: true
      }

      // Decide content type
      let contentType = specificType
      if (!contentType) {
        const types: string[] = []
        if (preferences.quotes?.length > 0) types.push("quote")
        if (preferences.jokes?.length > 0) types.push("joke")
        if (preferences.games !== false) {
          types.push("riddle", "trivia", "would_you_rather", "fun_fact")
          // 20% chance for actual games
          if (Math.random() < 0.2) types.push("wordle", "snake")
        }
        contentType = types[Math.floor(Math.random() * types.length)] || "quote"
      }

      // Handle game types
      if (contentType === "wordle") {
        setActiveGame("wordle")
        setContent({ content_type: "wordle", content: "" })
        setLoading(false)
        return
      }
      if (contentType === "snake") {
        setActiveGame("snake")
        setContent({ content_type: "snake", content: "" })
        setLoading(false)
        return
      }

      setActiveGame(null)

      // Get category based on preferences
      const category = contentType === "quote" 
        ? preferences.quotes?.[Math.floor(Math.random() * preferences.quotes.length)]
        : contentType === "joke"
          ? preferences.jokes?.[Math.floor(Math.random() * preferences.jokes.length)]
          : undefined

      const response = await fetch("/api/daily-content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: contentType, category })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Transform AI response to our format
        const transformed: DailyContent = {
          content_type: data.type,
          category: data.category,
          content: data.content.content || data.content.setup || data.content.question || data.content.fact || "",
          extra_data: {
            punchline: data.content.punchline,
            answer: data.content.answer || data.content.correct_answer,
            options: data.content.options,
            option_a: data.content.option_a,
            option_b: data.content.option_b,
            author: data.content.author,
            fact: data.content.fact
          }
        }
        setContent(transformed)
        
        // Save to history for quotes and jokes
        if (["quote", "joke", "riddle", "trivia", "would_you_rather", "fun_fact"].includes(transformed.content_type)) {
          saveContentToHistory(transformed)
        }
      } else {
        throw new Error("Failed to generate content")
      }
    } catch (error) {
      console.error("[v0] Error generating AI content:", error)
      // Fallback content
      const fallbacks: DailyContent[] = [
        { content_type: "quote", content: "Success is not final, failure is not fatal: it is the courage to continue that counts.", extra_data: { author: "Winston Churchill" } },
        { content_type: "joke", content: "Why don't scientists trust atoms?", extra_data: { punchline: "Because they make up everything!" } },
        { content_type: "riddle", content: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", extra_data: { answer: "A map" } },
        { content_type: "would_you_rather", content: "Would you rather...", extra_data: { option_a: "Be able to fly", option_b: "Be able to read minds" } },
        { content_type: "fun_fact", content: "", extra_data: { fact: "A group of flamingos is called a 'flamboyance'!" } }
      ]
      const fallbackContent = fallbacks[Math.floor(Math.random() * fallbacks.length)]
      setContent(fallbackContent)
      saveContentToHistory(fallbackContent)
    }

    setLoading(false)
  }

  const saveContentToHistory = async (contentItem: DailyContent) => {
    try {
      await fetch("/api/daily-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentItem.content_type,
          content: contentItem.content || contentItem.extra_data?.fact || "",
          extra_data: contentItem.extra_data
        })
      })
    } catch (error) {
      console.error("[v0] Error saving content to history:", error)
    }
  }

  const saveGameToHistory = async (gameType: string, content: string, extraData: Record<string, unknown>) => {
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
    } catch (error) {
      console.error("[v0] Error saving game to history:", error)
    }
  }

  const resetState = () => {
    setShowPunchline(false)
    setShowAnswer(false)
    setUserAnswer("")
    setIsCorrect(null)
    setWyrChoice(null)
    setActiveGame(null)
  }

  const handleClose = () => {
    setIsOpen(false)
    resetState()
  }

  const checkAnswer = () => {
    if (!content?.extra_data?.answer) return
    const correct = userAnswer.toLowerCase().trim() === content.extra_data.answer.toLowerCase().trim()
    setIsCorrect(correct)
    setShowAnswer(true)
  }

  const getContentTypeInfo = () => {
    return CONTENT_TYPES.find(t => t.type === content?.content_type)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Generating something special...</p>
        </div>
      )
    }

    if (!content) return null

    // Games
    if (activeGame === "wordle") {
      return (
        <div className="py-2">
          <WordleGame onComplete={(won, attempts) => {
            saveGameToHistory("wordle", `Wordle ${won ? "Won" : "Lost"}`, { 
              won, 
              attempts,
              result: won ? `Solved in ${attempts} attempts` : "Failed to solve"
            })
          }} />
        </div>
      )
    }

    if (activeGame === "snake") {
      return (
        <div className="py-2">
          <SnakeGame onComplete={(score) => {
            saveGameToHistory("snake", `Snake Game - Score: ${score}`, { 
              score,
              result: `Final score: ${score} points`
            })
          }} />
        </div>
      )
    }

    // Quote
    if (content.content_type === "quote") {
      return (
        <div className="space-y-4">
          <blockquote className="text-lg italic text-foreground/90 leading-relaxed border-l-4 border-primary/30 pl-4">
            "{content.content}"
          </blockquote>
          {content.extra_data?.author && (
            <p className="text-right text-muted-foreground">— {content.extra_data.author}</p>
          )}
        </div>
      )
    }

    // Joke
    if (content.content_type === "joke") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-medium">{content.content}</p>
          {!showPunchline ? (
            <Button variant="outline" className="w-full bg-transparent" onClick={() => setShowPunchline(true)}>
              Reveal Punchline <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                {content.extra_data?.punchline}
              </p>
            </div>
          )}
        </div>
      )
    }

    // Riddle
    if (content.content_type === "riddle") {
      return (
        <div className="space-y-4">
          <p className="text-lg font-medium">{content.content}</p>
          <Input
            placeholder="Type your answer..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !showAnswer && checkAnswer()}
            disabled={showAnswer}
            className="text-foreground"
          />
          {!showAnswer ? (
            <Button className="w-full" onClick={checkAnswer} disabled={!userAnswer}>
              Check Answer
            </Button>
          ) : (
            <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={`font-semibold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isCorrect ? "Correct!" : `The answer was: ${content.extra_data?.answer}`}
              </p>
            </div>
          )}
        </div>
      )
    }

    // Trivia
    if (content.content_type === "trivia" && content.extra_data?.options) {
      return (
        <div className="space-y-4">
          <p className="text-lg font-medium">{content.content}</p>
          <div className="grid grid-cols-2 gap-2">
            {content.extra_data.options.map((option) => (
              <Button
                key={option}
                variant={showAnswer ? (option === content.extra_data?.answer ? "default" : userAnswer === option ? "destructive" : "outline") : userAnswer === option ? "secondary" : "outline"}
                className={`h-auto py-3 ${showAnswer && option === content.extra_data?.answer ? "bg-green-500 hover:bg-green-600" : ""}`}
                onClick={() => !showAnswer && setUserAnswer(option)}
                disabled={showAnswer}
              >
                {option}
                {showAnswer && option === content.extra_data?.answer && <Check className="ml-2 h-4 w-4" />}
              </Button>
            ))}
          </div>
          {!showAnswer ? (
            <Button className="w-full" onClick={() => { setIsCorrect(userAnswer === content.extra_data?.answer); setShowAnswer(true) }} disabled={!userAnswer}>
              Check Answer
            </Button>
          ) : (
            <p className={`text-center font-semibold ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
              {isCorrect ? "Correct!" : `The answer was: ${content.extra_data?.answer}`}
            </p>
          )}
        </div>
      )
    }

    // Would You Rather
    if (content.content_type === "would_you_rather" && content.extra_data?.option_a) {
      const handleWyrChoice = (choice: "a" | "b") => {
        setWyrChoice(choice)
        // Auto-close after showing the confirmation briefly
        setTimeout(() => {
          handleClose()
        }, 1000)
      }
      
      return (
        <div className="space-y-4">
          <p className="text-lg font-bold text-center">Would You Rather...</p>
          <Button
            variant={wyrChoice === "a" ? "default" : "outline"}
            className={`w-full p-4 h-auto text-wrap ${wyrChoice === "a" ? "bg-pink-500 hover:bg-pink-600" : ""}`}
            onClick={() => handleWyrChoice("a")}
            disabled={wyrChoice !== null}
          >
            {content.extra_data.option_a}
          </Button>
          <p className="text-center text-muted-foreground text-sm">OR</p>
          <Button
            variant={wyrChoice === "b" ? "default" : "outline"}
            className={`w-full p-4 h-auto text-wrap ${wyrChoice === "b" ? "bg-rose-500 hover:bg-rose-600" : ""}`}
            onClick={() => handleWyrChoice("b")}
            disabled={wyrChoice !== null}
          >
            {content.extra_data.option_b}
          </Button>
          {wyrChoice && (
            <p className="text-center text-green-500 text-sm font-medium">Great choice! Closing...</p>
          )}
        </div>
      )
    }

    // Fun Fact
    if (content.content_type === "fun_fact") {
      return (
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Did You Know?</p>
          <p className="text-lg">{content.extra_data?.fact || content.content}</p>
        </div>
      )
    }

    return null
  }

  const typeInfo = getContentTypeInfo()
  const Icon = typeInfo?.icon || Sparkles

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-0 shadow-none">
        <Card className="relative overflow-hidden border-2 border-primary/20">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />

          <CardContent className="pt-8 pb-6 px-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-card border border-border shadow-sm">
                <Icon className={`h-8 w-8 ${typeInfo?.color || "text-primary"}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{typeInfo?.label || "Daily Inspiration"}</h3>
                {content?.category && (
                  <Badge variant="secondary" className="mt-1 text-xs capitalize">
                    {content.category}
                  </Badge>
                )}
              </div>
            </div>

            {renderContent()}

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={() => fetchAIContent()} disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  New
                </Button>
                <div className="flex gap-1 overflow-x-auto">
                  {CONTENT_TYPES.map(({ type, icon: TypeIcon, color }) => (
                    <Button
                      key={type}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => fetchAIContent(type)}
                      title={type}
                    >
                      <TypeIcon className={`h-4 w-4 ${color}`} />
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Link href="/daily-content" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  View all in Daily Quotes & Games
                </Link>
                <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-center mt-2">
                This is a fun daily activity. You can disable it in Settings &gt; Content Preferences.
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
