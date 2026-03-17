"use client"

import React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Play, RotateCcw } from "lucide-react"

const GRID_SIZE = 15
const CELL_SIZE = 18
const BASE_SPEED = 120

interface Position {
  x: number
  y: number
}

interface SnakeGameProps {
  onComplete?: (score: number) => void
}

export function SnakeGame({ onComplete }: SnakeGameProps) {
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }])
  const [food, setFood] = useState<Position>({ x: 5, y: 5 })
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [highScore, setHighScore] = useState(0)
  
  const directionRef = useRef(direction)
  const snakeRef = useRef(snake)
  const foodRef = useRef(food)
  const scoreRef = useRef(score)
  const gameOverRef = useRef(gameOver)
  const lastMoveTime = useRef(0)
  const animationFrameRef = useRef<number>()

  // Sync refs
  useEffect(() => { directionRef.current = direction }, [direction])
  useEffect(() => { snakeRef.current = snake }, [snake])
  useEffect(() => { foodRef.current = food }, [food])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem("snake_high_score")
    if (saved) setHighScore(parseInt(saved))
  }, [])

  const generateFood = useCallback((currentSnake: Position[]) => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      }
    } while (currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y))
    return newFood
  }, [])

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 7, y: 7 }]
    setSnake(initialSnake)
    setFood(generateFood(initialSnake))
    setDirection({ x: 1, y: 0 })
    directionRef.current = { x: 1, y: 0 }
    setGameOver(false)
    setScore(0)
    setIsPlaying(false)
    lastMoveTime.current = 0
  }, [generateFood])

  const startGame = () => {
    resetGame()
    setTimeout(() => setIsPlaying(true), 50)
  }

  const endGame = useCallback((finalScore: number) => {
    setGameOver(true)
    setIsPlaying(false)
    if (finalScore > highScore) {
      setHighScore(finalScore)
      localStorage.setItem("snake_high_score", finalScore.toString())
    }
    onComplete?.(finalScore)
  }, [highScore, onComplete])

  // Main game loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying) return

    const gameLoop = (timestamp: number) => {
      if (gameOverRef.current) return

      const speed = Math.max(BASE_SPEED - Math.floor(scoreRef.current / 50) * 10, 60)
      
      if (timestamp - lastMoveTime.current >= speed) {
        lastMoveTime.current = timestamp

        const currentSnake = snakeRef.current
        const currentDirection = directionRef.current
        const currentFood = foodRef.current

        const newHead = {
          x: (currentSnake[0].x + currentDirection.x + GRID_SIZE) % GRID_SIZE,
          y: (currentSnake[0].y + currentDirection.y + GRID_SIZE) % GRID_SIZE
        }

        // Check self collision
        if (currentSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          endGame(scoreRef.current)
          return
        }

        const newSnake = [newHead, ...currentSnake]

        // Check food collision
        if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
          const newScore = scoreRef.current + 10
          setScore(newScore)
          setFood(generateFood(newSnake))
        } else {
          newSnake.pop()
        }

        setSnake(newSnake)
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, generateFood, endGame])

  const handleDirection = useCallback((newDir: Position) => {
    const current = directionRef.current
    // Prevent 180-degree turns
    if (current.x + newDir.x !== 0 || current.y + newDir.y !== 0) {
      directionRef.current = newDir
      setDirection(newDir)
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return
      
      const keyMap: Record<string, Position> = {
        ArrowUp: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        W: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
        S: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        A: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
        D: { x: 1, y: 0 },
      }

      if (keyMap[e.key]) {
        e.preventDefault()
        handleDirection(keyMap[e.key])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isPlaying, handleDirection])

  // Touch controls for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isPlaying) return

    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y

    if (Math.abs(dx) > Math.abs(dy)) {
      handleDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 })
    } else {
      handleDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 })
    }

    touchStartRef.current = null
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Score */}
      <div className="flex gap-6 text-sm font-medium">
        <span>Score: <span className="text-primary font-bold">{score}</span></span>
        <span className="text-muted-foreground">Best: {highScore}</span>
      </div>

      {/* Game Board */}
      <div 
        className="relative border-2 border-border rounded-lg overflow-hidden bg-card touch-none select-none"
        style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid background */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
          }}
        />

        {/* Snake */}
        {snake.map((segment, idx) => (
          <div
            key={idx}
            className={`absolute rounded-sm ${idx === 0 ? "bg-primary shadow-lg shadow-primary/30" : "bg-primary/70"}`}
            style={{
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              transition: "left 0.05s linear, top 0.05s linear",
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full shadow-lg shadow-red-500/50"
          style={{
            left: food.x * CELL_SIZE + 3,
            top: food.y * CELL_SIZE + 3,
            width: CELL_SIZE - 6,
            height: CELL_SIZE - 6,
            animation: "pulse 1s ease-in-out infinite"
          }}
        />

        {/* Start/Game Over Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            {gameOver ? (
              <>
                <p className="text-lg font-bold text-destructive">Game Over!</p>
                <p className="text-sm text-muted-foreground">Score: {score}</p>
                {score >= highScore && score > 0 && (
                  <p className="text-xs text-amber-500 font-semibold">New High Score!</p>
                )}
                <Button onClick={startGame} size="sm" className="mt-2">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Play Again
                </Button>
              </>
            ) : (
              <>
                <p className="text-base font-bold">Snake Game</p>
                <p className="text-xs text-muted-foreground">Swipe or use arrow keys</p>
                <Button onClick={startGame} size="sm" className="mt-2">
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        <div />
        <Button 
          variant="outline" 
          size="lg"
          className="h-14 w-14 bg-transparent touch-manipulation active:scale-95 transition-transform"
          onClick={() => handleDirection({ x: 0, y: -1 })}
          disabled={!isPlaying}
        >
          <ArrowUp className="h-6 w-6" />
        </Button>
        <div />
        <Button 
          variant="outline" 
          size="lg"
          className="h-14 w-14 bg-transparent touch-manipulation active:scale-95 transition-transform"
          onClick={() => handleDirection({ x: -1, y: 0 })}
          disabled={!isPlaying}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="h-14 w-14 bg-transparent touch-manipulation active:scale-95 transition-transform"
          onClick={() => handleDirection({ x: 0, y: 1 })}
          disabled={!isPlaying}
        >
          <ArrowDown className="h-6 w-6" />
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="h-14 w-14 bg-transparent touch-manipulation active:scale-95 transition-transform"
          onClick={() => handleDirection({ x: 1, y: 0 })}
          disabled={!isPlaying}
        >
          <ArrowRight className="h-6 w-6" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Swipe on mobile or use arrow keys
      </p>
    </div>
  )
}
