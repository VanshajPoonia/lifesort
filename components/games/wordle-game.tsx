"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Delete, CornerDownLeft } from "lucide-react"

const WORDS = [
  "APPLE", "BEACH", "CHAIR", "DANCE", "EAGLE", "FLAME", "GRAPE", "HOUSE", "IVORY", "JAZZY",
  "KNACK", "LEMON", "MANGO", "NOBLE", "OCEAN", "PIANO", "QUEEN", "RIVER", "STORM", "TIGER",
  "ULTRA", "VIVID", "WATCH", "XENON", "YOUTH", "ZEBRA", "BRAIN", "CLOUD", "DREAM", "FABLE",
  "GIANT", "HAPPY", "IMAGE", "JOINT", "KIOSK", "LIGHT", "MUSIC", "NIGHT", "OLIVE", "PEACE",
  "QUEST", "RADIO", "SMILE", "TRAIN", "UNITY", "VOTER", "WORLD", "XEROX", "YEARN", "ZESTY"
]

interface WordleGameProps {
  onComplete?: (won: boolean, attempts: number) => void
}

export function WordleGame({ onComplete }: WordleGameProps) {
  const [targetWord, setTargetWord] = useState("")
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState("")
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)

  useEffect(() => {
    // Pick a random word
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)]
    setTargetWord(randomWord)
  }, [])

  const handleKeyPress = useCallback((key: string) => {
    if (gameOver) return

    if (key === "ENTER") {
      if (currentGuess.length === 5) {
        const newGuesses = [...guesses, currentGuess]
        setGuesses(newGuesses)
        
        if (currentGuess === targetWord) {
          setWon(true)
          setGameOver(true)
          onComplete?.(true, newGuesses.length)
        } else if (newGuesses.length >= 6) {
          setGameOver(true)
          onComplete?.(false, 6)
        }
        
        setCurrentGuess("")
      }
    } else if (key === "DELETE") {
      setCurrentGuess(prev => prev.slice(0, -1))
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key)
    }
  }, [currentGuess, guesses, targetWord, gameOver, onComplete])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleKeyPress("ENTER")
      } else if (e.key === "Backspace") {
        handleKeyPress("DELETE")
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase())
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyPress])

  const getLetterStatuses = (guess: string): string[] => {
    const statuses: string[] = Array(5).fill("bg-muted text-muted-foreground border-muted")
    const targetLetterCounts: Record<string, number> = {}
    
    // Count letters in target word
    for (const letter of targetWord) {
      targetLetterCounts[letter] = (targetLetterCounts[letter] || 0) + 1
    }
    
    // First pass: mark correct positions (green)
    for (let i = 0; i < 5; i++) {
      if (guess[i] === targetWord[i]) {
        statuses[i] = "bg-green-500 text-white border-green-500"
        targetLetterCounts[guess[i]]--
      }
    }
    
    // Second pass: mark wrong positions (yellow) only if letter still available
    for (let i = 0; i < 5; i++) {
      if (statuses[i] === "bg-muted text-muted-foreground border-muted") {
        if (targetLetterCounts[guess[i]] > 0) {
          statuses[i] = "bg-yellow-500 text-white border-yellow-500"
          targetLetterCounts[guess[i]]--
        }
      }
    }
    
    return statuses
  }

  const keyboard = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DELETE"]
  ]

  const getKeyStatus = (key: string) => {
    if (key === "ENTER" || key === "DELETE") return "bg-secondary"
    
    let bestStatus = "bg-secondary"
    
    for (const guess of guesses) {
      const statuses = getLetterStatuses(guess)
      for (let i = 0; i < 5; i++) {
        if (guess[i] === key) {
          if (statuses[i].includes("green")) {
            return "bg-green-500 text-white" // Green is best, return immediately
          } else if (statuses[i].includes("yellow")) {
            bestStatus = "bg-yellow-500 text-white"
          } else if (bestStatus === "bg-secondary") {
            bestStatus = "bg-muted-foreground/30"
          }
        }
      }
    }
    return bestStatus
  }

  const resetGame = () => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)]
    setTargetWord(randomWord)
    setGuesses([])
    setCurrentGuess("")
    setGameOver(false)
    setWon(false)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Game Grid */}
      <div className="grid gap-1">
        {[...Array(6)].map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            {[...Array(5)].map((_, colIdx) => {
              const letter = rowIdx < guesses.length 
                ? guesses[rowIdx][colIdx] 
                : rowIdx === guesses.length 
                  ? currentGuess[colIdx] || ""
                  : ""
              
              const status = rowIdx < guesses.length
                ? getLetterStatuses(guesses[rowIdx])[colIdx]
                : "border-2 border-border"

              return (
                <div
                  key={colIdx}
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-lg sm:text-xl font-bold rounded ${status} transition-all`}
                >
                  {letter}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Result */}
      {gameOver && (
        <Card className="p-4 text-center">
          {won ? (
            <p className="text-green-500 font-bold">Congratulations! You won in {guesses.length} attempts!</p>
          ) : (
            <p className="text-destructive font-bold">Game Over! The word was: {targetWord}</p>
          )}
          <Button onClick={resetGame} className="mt-2">Play Again</Button>
        </Card>
      )}

      {/* Keyboard */}
      <div className="flex flex-col gap-1 mt-2">
        {keyboard.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-1">
            {row.map(key => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className={`${getKeyStatus(key)} ${key.length > 1 ? "px-1.5 sm:px-2 text-[10px] sm:text-xs" : "w-7 h-9 sm:w-8 sm:h-10 text-sm"} touch-manipulation`}
                onClick={() => handleKeyPress(key)}
              >
                {key === "DELETE" ? <Delete className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : key === "ENTER" ? <CornerDownLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : key}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
