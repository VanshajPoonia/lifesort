"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ReminderSettings } from "@/components/reminder-settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { X, Calendar, Target, MessageSquare, Plus, Trash2 } from "lucide-react"
import { EditableText } from "@/components/editable-text"
import gsap from "gsap"

interface Comment {
  id: string
  text: string
  author: string
  timestamp: string
}

interface Goal {
  id: string
  title: string
  description: string
  category: string
  progress: number
  deadline: string
  target_date?: string
  status: "active" | "completed" | "paused"
  notes?: string
  comments?: Comment[]
  email_reminder?: boolean
  reminder_days?: number
  target_value?: number | null
  current_value?: number | null
  value_unit?: string | null
}

interface GoalModalProps {
  goal: Goal | null
  open: boolean
  onClose: () => void
  onUpdate: (goal: Goal) => void
  onDelete?: (id: string) => void
}

export function GoalModal({ goal, open, onClose, onUpdate, onDelete }: GoalModalProps) {
  const [localGoal, setLocalGoal] = useState<Goal | null>(goal)
  const [newComment, setNewComment] = useState("")
  const [comments, setComments] = useState<Comment[]>(goal?.comments || [])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitialized = useRef(false)

  const handleUpdate = (updates: Partial<Goal>) => {
    const updated = { ...localGoal, ...updates }
    setLocalGoal(updated)
    onUpdate(updated)
  }

  useEffect(() => {
    if (goal) {
      // Calculate progress from current/target if available
      let calculatedProgress = goal.progress ?? 0
      if (goal.target_value && goal.target_value > 0 && goal.current_value != null) {
        calculatedProgress = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
      }
      
      setLocalGoal({ ...goal, progress: calculatedProgress })
      setComments(goal?.comments || [])
      hasInitialized.current = true
    }
  }, [goal]) // Only re-initialize when goal changes

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  if (!localGoal) return null

  // Local update without triggering parent - for fast typing
  const handleLocalUpdate = (updates: Partial<Goal>) => {
    setLocalGoal(prev => prev ? { ...prev, ...updates } : prev)
  }

  // Debounced update to parent - syncs after user stops typing
  const handleDebouncedUpdate = (updates: Partial<Goal>) => {
    const updated = { ...localGoal, ...updates }
    setLocalGoal(updated)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      onUpdate(updated)
    }, 500) // 500ms debounce
  }

  // Immediate update to parent - for important changes like progress slider release
  const handleImmediateUpdate = (updates: Partial<Goal>) => {
    const updated = { ...localGoal, ...updates }
    setLocalGoal(updated)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    onUpdate(updated)
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment,
      author: "You",
      timestamp: new Date().toISOString(),
    }

    const updatedComments = [...comments, comment]
    setComments(updatedComments)
    handleImmediateUpdate({ comments: updatedComments })
    setNewComment("")
  }

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = comments.filter((c) => c.id !== commentId)
    setComments(updatedComments)
    handleImmediateUpdate({ comments: updatedComments })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="goal-modal-content max-w-4xl max-h-[85vh] overflow-hidden p-0 bg-background border border-border shadow-2xl [&>button]:hidden">
        <div className="flex flex-col h-full max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Badge variant="outline">{localGoal.category}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this goal?")) {
                      onDelete(localGoal.id)
                      onClose()
                    }
                  }} 
                  className="hover:bg-destructive/10 hover:text-destructive rounded-full"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
            {/* Title */}
            <div>
              <EditableText
                value={localGoal.title}
                onSave={(value) => handleUpdate({ title: value })}
                className="text-3xl font-bold text-foreground"
                placeholder="Goal title..."
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Description</label>
              <EditableText
                value={localGoal.description}
                onSave={(value) => handleUpdate({ description: value })}
                className="text-base text-foreground"
                placeholder="Add a description..."
                multiline
              />
            </div>

            {/* Progress */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Progress</label>
                <span className="text-sm font-bold text-primary">{localGoal.progress}%</span>
              </div>
              <Progress value={localGoal.progress} className="h-3" />
              
              {/* Numeric Value Tracking */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground">Track with numbers</label>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Current</label>
                    <Input
                      type="number"
                      min="0"
                      value={localGoal.current_value ?? ""}
                      onChange={(e) => {
                        const current = e.target.value ? parseFloat(e.target.value) : null
                        const target = localGoal.target_value
                        let progress = localGoal.progress
                        
                        if (current !== null && target && target > 0) {
                          progress = Math.min(100, Math.round((current / target) * 100))
                        }
                        
                        handleDebouncedUpdate({ current_value: current, progress })
                      }}
                      placeholder="0"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Target</label>
                    <Input
                      type="number"
                      min="1"
                      value={localGoal.target_value ?? ""}
                      onChange={(e) => {
                        const target = e.target.value ? parseFloat(e.target.value) : null
                        const current = localGoal.current_value
                        let progress = localGoal.progress
                        
                        if (current !== null && target && target > 0) {
                          progress = Math.min(100, Math.round((current / target) * 100))
                        }
                        
                        handleDebouncedUpdate({ target_value: target, progress })
                      }}
                      placeholder="100"
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                    <Input
                      type="text"
                      value={localGoal.value_unit ?? ""}
                      onChange={(e) => handleDebouncedUpdate({ value_unit: e.target.value || null })}
                      placeholder="e.g. pages, km"
                      className="h-9"
                    />
                  </div>
                </div>
                
                {localGoal.target_value != null && localGoal.target_value > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {localGoal.current_value ?? 0} / {localGoal.target_value}{localGoal.value_unit ? ` ${localGoal.value_unit}` : ""} completed
                  </p>
                )}
              </div>
              
              {/* Manual Percentage Slider */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Or set percentage manually</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localGoal.progress}
                  onChange={(e) => {
                    const progress = parseInt(e.target.value)
                    const updates: Partial<Goal> = { progress }
                    
                    // Update current_value if target is set
                    if (localGoal.target_value) {
                      updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                    }
                    
                    handleLocalUpdate(updates)
                  }}
                  onMouseUp={(e) => {
                    // Save on mouse release
                    const progress = parseInt((e.target as HTMLInputElement).value)
                    const updates: Partial<Goal> = { progress }
                    if (localGoal.target_value) {
                      updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                    }
                    handleImmediateUpdate(updates)
                  }}
                  onTouchEnd={(e) => {
                    // Save on touch release for mobile
                    const progress = parseInt((e.target as HTMLInputElement).value)
                    const updates: Partial<Goal> = { progress }
                    if (localGoal.target_value) {
                      updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                    }
                    handleImmediateUpdate(updates)
                  }}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Deadline</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={localGoal.deadline || ""}
                  onChange={(e) => handleImmediateUpdate({ deadline: e.target.value, target_date: e.target.value } as Partial<Goal>)}
                  className="flex-1"
                />
              </div>
              
              {/* Email Reminder Option */}
              {localGoal.deadline && (
                <div className="mt-3">
                <ReminderSettings
                  enabled={localGoal.email_reminder ?? false}
                  reminderDays={localGoal.reminder_days ?? 3}
                    onEnabledChange={(enabled) => handleImmediateUpdate({ email_reminder: enabled })}
                    onReminderDaysChange={(days) => handleImmediateUpdate({ reminder_days: days })}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Notes Section */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Notes</label>
              <Textarea
                value={localGoal.notes || ""}
                onChange={(e) => handleDebouncedUpdate({ notes: e.target.value })}
                placeholder="Add your notes here..."
                className="min-h-[120px] resize-none"
              />
            </div>

            <Separator />

            {/* Comments Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">
                  Comments ({comments.length})
                </label>
              </div>

              {/* Comment List */}
              <div className="space-y-4 mb-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{comment.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{comment.author}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.timestamp).toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Comment */}
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                />
                <Button onClick={handleAddComment} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
