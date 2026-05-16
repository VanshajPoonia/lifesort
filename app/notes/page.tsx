"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FileText,
  Folder,
  Loader2,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface NoteFolder {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface Note {
  id: string
  title: string
  content: string
  folder_id: string | null
  folder_name: string | null
  tags: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
}

type ActiveFilter =
  | { type: "all" }
  | { type: "pinned" }
  | { type: "recent" }
  | { type: "folder"; value: string }
  | { type: "tag"; value: string }

type SaveState = "idle" | "saving" | "saved" | "error"

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .flatMap((tag) => tag.split(","))
        .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean)
    )
  )
}

function normalizeNote(raw: Partial<Note> & Record<string, unknown>): Note {
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "Untitled",
    content: typeof raw.content === "string" ? raw.content : "",
    folder_id: raw.folder_id ? String(raw.folder_id) : null,
    folder_name: typeof raw.folder_name === "string" ? raw.folder_name : null,
    tags: normalizeTags(raw.tags),
    is_pinned: Boolean(raw.is_pinned),
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  }
}

function normalizeFolder(raw: Partial<NoteFolder> & Record<string, unknown>): NoteFolder {
  return {
    id: String(raw.id),
    name: typeof raw.name === "string" ? raw.name : "Untitled folder",
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  }
}

function sortFolders(folders: NoteFolder[]) {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name))
}

function noteMatchesSearch(note: Note, query: string) {
  if (!query) return true

  const haystack = [
    note.title,
    note.content,
    note.folder_name || "",
    ...note.tags,
  ].join(" ").toLowerCase()

  return haystack.includes(query.toLowerCase())
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<NoteFolder[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [creatingNote, setCreatingNote] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [searchQuery, setSearchQuery] = useState("")
  const [showSidebar, setShowSidebar] = useState(true)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchNotes()
    }
  }, [user])

  const fetchNotes = async () => {
    try {
      const response = await fetch('/api/notes')
      if (response.ok) {
        const data = await response.json()
        setNotes(data)
        if (data.length > 0 && !selectedNote) {
          setSelectedNote(data[0])
        }
      }
    } catch (error) {
      console.error('[v0] Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "note") {
        fetchNotes()
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [user])

  const createNewNote = async () => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          content: '',
        }),
      })

      if (response.ok) {
        const newNote = await response.json()
        setNotes([newNote, ...notes])
        setSelectedNote(newNote)
        // Focus title input after a short delay
        setTimeout(() => {
          titleInputRef.current?.focus()
          titleInputRef.current?.select()
        }, 100)
      }
    } catch (error) {
      console.error('[v0] Error creating note:', error)
    }
  }

  const autoSave = useCallback(async (noteId: string, field: 'title' | 'content', value: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        const response = await fetch('/api/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: noteId,
            [field]: value,
          }),
        })

        if (response.ok) {
          const updated = await response.json()
          setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
        }
      } catch (error) {
        console.error('[v0] Error saving note:', error)
      } finally {
        setSaving(false)
      }
    }, 500)
  }, [])

  const handleTitleChange = (title: string) => {
    if (!selectedNote) return
    setSelectedNote({ ...selectedNote, title })
    autoSave(selectedNote.id, 'title', title)
  }

  const handleContentChange = (content: string) => {
    if (!selectedNote) return
    setSelectedNote({ ...selectedNote, content })
    autoSave(selectedNote.id, 'content', content)
  }

  const deleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return
    
    try {
      const response = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (response.ok) {
        const updatedNotes = notes.filter(n => n.id !== id)
        setNotes(updatedNotes)
        if (selectedNote?.id === id) {
          setSelectedNote(updatedNotes[0] || null)
        }
      }
    } catch (error) {
      console.error('[v0] Error deleting note:', error)
    }
  }

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getPreviewText = (content: string) => {
    // Strip HTML tags and get first 100 chars
    const text = content.replace(/<[^>]*>/g, '').trim()
    return text.slice(0, 100) || 'No content'
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Notes" subtitle="Your personal note-taking space">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={`${firstName}'s Notes`} subtitle="Your personal note-taking space">
      <div className="flex h-[calc(100vh-200px)] gap-4">
        {/* Notes Sidebar */}
        <Card className={`${showSidebar ? 'w-80' : 'w-0 overflow-hidden'} transition-all duration-300 flex-shrink-0`}>
          <CardContent className="p-0 h-full flex flex-col">
            {/* Search and New Note */}
            <div className="p-4 border-b border-border space-y-3">
              <Button onClick={createNewNote} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                New Note
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Notes List */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No notes found' : 'No notes yet'}
                    </p>
                    {!searchQuery && (
                      <Button onClick={createNewNote} variant="link" className="mt-2">
                        Create your first note
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      className={`group p-3 rounded-lg cursor-pointer transition-all mb-1 ${
                        selectedNote?.id === note.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate text-sm">{note.title}</h3>
                          <p className={`text-xs mt-1 truncate ${
                            selectedNote?.id === note.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {getPreviewText(note.content)}
                          </p>
                          <div className={`flex items-center gap-1 mt-2 text-xs ${
                            selectedNote?.id === note.id ? 'text-primary-foreground/60' : 'text-muted-foreground'
                          }`}>
                            <Clock className="h-3 w-3" />
                            {formatDate(note.updated_at)}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 opacity-0 group-hover:opacity-100 ${
                                selectedNote?.id === note.id ? 'text-primary-foreground hover:bg-primary-foreground/20' : ''
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNote(note.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="flex-1">
          <CardContent className="p-0 h-full flex flex-col">
            {selectedNote ? (
              <>
                {/* Editor Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setShowSidebar(!showSidebar)}
                    >
                      <ChevronLeft className={`h-4 w-4 transition-transform ${!showSidebar ? 'rotate-180' : ''}`} />
                    </Button>
                    <Input
                      ref={titleInputRef}
                      value={selectedNote.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="text-xl font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                      placeholder="Note title..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {saving && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteNote(selectedNote.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Note
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Content Editor */}
                <div className="flex-1 p-4 overflow-auto">
                  <Textarea
                    value={selectedNote.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Start writing your note...

Tips:
- Use this space to capture your thoughts
- Notes auto-save as you type
- Press Enter for new paragraphs"
                    className="min-h-full w-full resize-none border-none shadow-none focus-visible:ring-0 text-base leading-relaxed"
                    style={{ minHeight: 'calc(100vh - 400px)' }}
                  />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>Last edited {formatDate(selectedNote.updated_at)}</span>
                  <span>{selectedNote.content.length} characters</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No note selected</h3>
                <p className="text-muted-foreground mb-4">
                  Select a note from the sidebar or create a new one
                </p>
                <Button onClick={createNewNote} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Note
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
