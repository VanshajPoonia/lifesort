"use client"

import { useState, useEffect, useMemo } from "react"
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
  Trophy,
  Eye,
  Zap,
  Target
} from "lucide-react"
import { WordleGame } from "@/components/games/wordle-game"
import { SnakeGame } from "@/components/games/snake-game"

// Fuzzy matching utility - checks if user's answer is close enough to the correct answer
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/^(a|an|the)\s+/i, '') // Remove common articles
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1)
  const s2 = normalizeString(str2)
  
  // Exact match after normalization
  if (s1 === s2) return 1
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9
  
  // Levenshtein distance for fuzzy matching
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  const distance = matrix[s1.length][s2.length]
  const maxLen = Math.max(s1.length, s2.length)
  return maxLen === 0 ? 1 : 1 - distance / maxLen
}

function isAnswerClose(userAnswer: string, correctAnswer: string): { isCorrect: boolean; isClose: boolean } {
  const similarity = calculateSimilarity(userAnswer, correctAnswer)
  return {
    isCorrect: similarity >= 0.85, // 85% similarity = correct
    isClose: similarity >= 0.6 && similarity < 0.85 // 60-85% = close
  }
}

// Generate hint from answer
function generateHint(answer: string, hintLevel: number): string {
  const cleanAnswer = answer.trim()
  const words = cleanAnswer.split(' ')
  
  if (hintLevel === 1) {
    // First hint: show number of letters/words
    if (words.length > 1) {
      return `Hint: ${words.length} words, ${cleanAnswer.replace(/\s/g, '').length} letters total`
    }
    return `Hint: ${cleanAnswer.length} letters`
  } else if (hintLevel === 2) {
    // Second hint: show first letter(s)
    if (words.length > 1) {
      return `Hint: Starts with "${words.map(w => w[0].toUpperCase()).join(' ')}..."`
    }
    return `Hint: Starts with "${cleanAnswer[0].toUpperCase()}"`
  } else {
    // Third hint: show first and last letter with blanks
    if (words.length > 1) {
      const revealed = words.map(w => `${w[0]}${'_'.repeat(Math.max(0, w.length - 2))}${w.length > 1 ? w[w.length - 1] : ''}`).join(' ')
      return `Hint: ${revealed}`
    }
    const first = cleanAnswer[0]
    const last = cleanAnswer[cleanAnswer.length - 1]
    const middle = '_'.repeat(Math.max(0, cleanAnswer.length - 2))
    return `Hint: ${first}${middle}${cleanAnswer.length > 1 ? last : ''}`
  }
}

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
  const [isClose, setIsClose] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wyrChoice, setWyrChoice] = useState<"a" | "b" | null>(null)
  const [activeGame, setActiveGame] = useState<"wordle" | "snake" | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [attempts, setAttempts] = useState(0)

  // Generate current hint based on hint level
  const currentHint = useMemo(() => {
    if (hintLevel === 0 || !content?.extra_data?.answer) return null
    return generateHint(content.extra_data.answer, hintLevel)
  }, [hintLevel, content?.extra_data?.answer])

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
    setIsClose(false)
    setWyrChoice(null)
    setActiveGame(null)
    setHintLevel(0)
    setAttempts(0)
  }

  const handleClose = () => {
    setIsOpen(false)
    resetState()
  }

  const checkAnswer = () => {
    if (!content?.extra_data?.answer) return
    const result = isAnswerClose(userAnswer, content.extra_data.answer)
    setAttempts(prev => prev + 1)
    
    if (result.isCorrect) {
      setIsCorrect(true)
      setIsClose(false)
      setShowAnswer(true)
    } else if (result.isClose) {
      setIsClose(true)
      setIsCorrect(false)
      // Don't show answer yet, let them try again
    } else {
      setIsCorrect(false)
      setIsClose(false)
      // After 3 wrong attempts, show the answer
      if (attempts >= 2) {
        setShowAnswer(true)
      }
    }
  }

  const showHint = () => {
    if (hintLevel < 3) {
      setHintLevel(prev => prev + 1)
    }
  }

  const giveUp = () => {
    setShowAnswer(true)
    setIsCorrect(false)
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
          {/* Riddle question with engaging styling */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/20">
            <Target className="absolute top-3 right-3 h-5 w-5 text-purple-400/50" />
            <p className="text-lg font-medium leading-relaxed pr-6">{content.content}</p>
          </div>

          {/* Hint display */}
          {currentHint && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{currentHint}</p>
            </div>
          )}

          {/* Close answer feedback */}
          {isClose && !showAnswer && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <Zap className="h-4 w-4 text-orange-500" />
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                So close! You&apos;re on the right track. Try again!
              </p>
            </div>
          )}

          {/* Attempt counter */}
          {attempts > 0 && !showAnswer && !isClose && (
            <p className="text-xs text-muted-foreground text-center">
              {attempts === 1 ? "1 attempt" : `${attempts} attempts`} - {3 - attempts > 0 ? `${3 - attempts} more before reveal` : "Last chance!"}
            </p>
          )}

          {/* Answer input */}
          <div className="relative">
            <Input
              placeholder="Type your answer..."
              value={userAnswer}
              onChange={(e) => {
                setUserAnswer(e.target.value)
                setIsClose(false) // Reset close state when typing
              }}
              onKeyDown={(e) => e.key === "Enter" && !showAnswer && userAnswer && checkAnswer()}
              disabled={showAnswer}
              className="text-foreground pr-10"
            />
            {userAnswer && !showAnswer && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Enter</kbd>
              </div>
            )}
          </div>

          {!showAnswer ? (
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={checkAnswer} 
                disabled={!userAnswer}
              >
                <Check className="mr-2 h-4 w-4" />
                Check Answer
              </Button>
              <Button 
                variant="outline" 
                onClick={showHint}
                disabled={hintLevel >= 3}
                className="shrink-0"
                title={hintLevel >= 3 ? "No more hints" : "Get a hint"}
              >
                <Eye className="h-4 w-4" />
                <span className="ml-2 text-xs text-muted-foreground">{3 - hintLevel}</span>
              </Button>
              <Button 
                variant="ghost" 
                onClick={giveUp}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                title="Give up and see the answer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className={`p-4 rounded-xl ${isCorrect ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                {isCorrect ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <HelpCircle className="h-5 w-5 text-red-400" />
                )}
                <p className={`font-bold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect ? "Brilliant!" : "Not quite!"}
                </p>
              </div>
              <p className={`text-sm ${isCorrect ? 'text-green-600/80 dark:text-green-400/80' : 'text-foreground/80'}`}>
                {isCorrect 
                  ? `You got it${attempts === 1 ? " on the first try!" : ` in ${attempts} attempts!`}${hintLevel === 0 ? " Without any hints!" : ""}`
                  : `The answer was: ${content.extra_data?.answer}`
                }
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
          {/* Question with engaging styling */}
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-500/20">
            <Brain className="absolute top-3 right-3 h-5 w-5 text-blue-400/50" />
            <p className="text-lg font-medium leading-relaxed pr-6">{content.content}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {content.extra_data.options.map((option, index) => {
              const isSelected = userAnswer === option
              const isCorrectOption = option === content.extra_data?.answer
              const letters = ['A', 'B', 'C', 'D']
              
              return (
                <Button
                  key={option}
                  variant={showAnswer ? (isCorrectOption ? "default" : isSelected ? "destructive" : "outline") : isSelected ? "secondary" : "outline"}
                  className={`h-auto py-3 px-3 text-left justify-start transition-all ${
                    showAnswer && isCorrectOption ? "bg-green-500 hover:bg-green-600 text-white" : ""
                  } ${!showAnswer && isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  onClick={() => !showAnswer && setUserAnswer(option)}
                  disabled={showAnswer}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-2 shrink-0 ${
                    showAnswer && isCorrectOption 
                      ? "bg-white/20 text-white" 
                      : isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {letters[index]}
                  </span>
                  <span className="line-clamp-2">{option}</span>
                  {showAnswer && isCorrectOption && <Check className="ml-auto h-4 w-4 shrink-0" />}
                </Button>
              )
            })}
          </div>
          
          {!showAnswer ? (
            <Button 
              className="w-full" 
              onClick={() => { 
                setIsCorrect(userAnswer === content.extra_data?.answer)
                setShowAnswer(true)
                setAttempts(prev => prev + 1)
              }} 
              disabled={!userAnswer}
            >
              <Check className="mr-2 h-4 w-4" />
              Lock In Answer
            </Button>
          ) : (
            <div className={`p-4 rounded-xl ${isCorrect ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30' : 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20'}`}>
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <X className="h-5 w-5 text-red-400" />
                )}
                <p className={`font-bold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect ? "Excellent! You got it right!" : `The correct answer was: ${content.extra_data?.answer}`}
                </p>
              </div>
            </div>
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
