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
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ type: "all" })
  const [showSidebar, setShowSidebar] = useState(true)
  const [folderDraft, setFolderDraft] = useState("")
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState("")
  const [tagDraft, setTagDraft] = useState("")

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingPatchRef = useRef<Record<string, unknown>>({})
  const pendingNoteIdRef = useRef<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const applyUpdatedNote = useCallback((rawNote: Record<string, unknown>) => {
    const updated = normalizeNote(rawNote)

    setNotes((prev) =>
      prev
        .map((note) => (note.id === updated.id ? updated : note))
        .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    )
    setSelectedNote((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const updateLocalNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...patch } : note)))
    setSelectedNote((prev) => (prev?.id === id ? { ...prev, ...patch } : prev))
  }, [])

  const fetchNotesAndFolders = useCallback(async () => {
    setLoading(true)
    setLoadError("")

    try {
      const [notesResponse, foldersResponse] = await Promise.all([
        fetch("/api/notes"),
        fetch("/api/note-folders"),
      ])

      if (!notesResponse.ok || !foldersResponse.ok) {
        throw new Error("Failed to load notes")
      }

      const [notesData, foldersData] = await Promise.all([
        notesResponse.json(),
        foldersResponse.json(),
      ])
      const nextNotes = Array.isArray(notesData) ? notesData.map(normalizeNote) : []
      const nextFolders = Array.isArray(foldersData) ? sortFolders(foldersData.map(normalizeFolder)) : []

      setNotes(nextNotes)
      setFolders(nextFolders)
      setSelectedNote((prev) => {
        if (!prev) return nextNotes[0] || null
        return nextNotes.find((note) => note.id === prev.id) || nextNotes[0] || null
      })
    } catch (error) {
      console.error("[v0] Error fetching notes:", error)
      setLoadError("Notes could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotesAndFolders()
    }
  }, [fetchNotesAndFolders, user])

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "note") {
        fetchNotesAndFolders()
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [fetchNotesAndFolders, user])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const saveNotePatch = useCallback(
    async (noteId: string, patch: Record<string, unknown>) => {
      setSaveState("saving")

      try {
        const response = await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: noteId, ...patch }),
        })

        if (!response.ok) {
          throw new Error("Failed to save note")
        }

        const updated = await response.json()
        applyUpdatedNote(updated)
        setSaveState("saved")
      } catch (error) {
        console.error("[v0] Error saving note:", error)
        setSaveState("error")
      }
    },
    [applyUpdatedNote]
  )

  const queueAutoSave = useCallback(
    (noteId: string, patch: Record<string, unknown>) => {
      pendingNoteIdRef.current = noteId
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch }
      setSaveState("saving")

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        const pendingNoteId = pendingNoteIdRef.current
        const pendingPatch = pendingPatchRef.current

        pendingNoteIdRef.current = null
        pendingPatchRef.current = {}

        if (pendingNoteId) {
          saveNotePatch(pendingNoteId, pendingPatch)
        }
      }, 600)
    },
    [saveNotePatch]
  )

  const allTags = useMemo(
    () => Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b)),
    [notes]
  )

  const filteredNotes = useMemo(() => {
    const now = Date.now()

    return notes.filter((note) => {
      const matchesFilter =
        activeFilter.type === "all" ||
        (activeFilter.type === "pinned" && note.is_pinned) ||
        (activeFilter.type === "recent" && now - new Date(note.updated_at).getTime() <= RECENT_WINDOW_MS) ||
        (activeFilter.type === "folder" && note.folder_id === activeFilter.value) ||
        (activeFilter.type === "tag" && note.tags.includes(activeFilter.value))

      return matchesFilter && noteMatchesSearch(note, searchQuery)
    })
  }, [activeFilter, notes, searchQuery])

  const folderCounts = useMemo(() => {
    return notes.reduce<Record<string, number>>((counts, note) => {
      if (note.folder_id) {
        counts[note.folder_id] = (counts[note.folder_id] || 0) + 1
      }
      return counts
    }, {})
  }, [notes])

  const tagCounts = useMemo(() => {
    return notes.reduce<Record<string, number>>((counts, note) => {
      note.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
      return counts
    }, {})
  }, [notes])

  const createNewNote = async () => {
    setCreatingNote(true)

    try {
      const selectedFolderId = activeFilter.type === "folder" ? activeFilter.value : null
      const selectedTag = activeFilter.type === "tag" ? activeFilter.value : null
      const selectedFolder = folders.find((folder) => folder.id === selectedFolderId)
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled Note",
          content: "",
          folder_id: selectedFolderId,
          tags: selectedTag ? [selectedTag] : [],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create note")
      }

      const newNote = normalizeNote(await response.json())
      const noteWithFolder = {
        ...newNote,
        folder_name: newNote.folder_name || selectedFolder?.name || null,
      }

      setNotes((prev) => [noteWithFolder, ...prev])
      setSelectedNote(noteWithFolder)
      setSaveState("saved")
      setTimeout(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      }, 100)
    } catch (error) {
      console.error("[v0] Error creating note:", error)
      setSaveState("error")
    } finally {
      setCreatingNote(false)
    }
  }

  const handleTitleChange = (title: string) => {
    if (!selectedNote) return

    updateLocalNote(selectedNote.id, { title })
    queueAutoSave(selectedNote.id, { title })
  }

  const handleContentChange = (content: string) => {
    if (!selectedNote) return

    updateLocalNote(selectedNote.id, { content })
    queueAutoSave(selectedNote.id, { content })
  }

  const togglePinned = async (note: Note) => {
    const isPinned = !note.is_pinned
    updateLocalNote(note.id, { is_pinned: isPinned })
    await saveNotePatch(note.id, { is_pinned: isPinned })
  }

  const handleFolderChange = async (folderId: string) => {
    if (!selectedNote) return

    const nextFolderId = folderId === "none" ? null : folderId
    const folder = folders.find((item) => item.id === nextFolderId)
    updateLocalNote(selectedNote.id, {
      folder_id: nextFolderId,
      folder_name: folder?.name || null,
    })
    await saveNotePatch(selectedNote.id, { folder_id: nextFolderId })
  }

  const addTagToSelectedNote = async () => {
    if (!selectedNote) return

    const nextTags = normalizeTags([...selectedNote.tags, tagDraft])
    setTagDraft("")
    updateLocalNote(selectedNote.id, { tags: nextTags })
    await saveNotePatch(selectedNote.id, { tags: nextTags })
  }

  const removeTagFromSelectedNote = async (tag: string) => {
    if (!selectedNote) return

    const nextTags = selectedNote.tags.filter((item) => item !== tag)
    updateLocalNote(selectedNote.id, { tags: nextTags })
    await saveNotePatch(selectedNote.id, { tags: nextTags })
  }

  const deleteNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      const response = await fetch("/api/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete note")
      }

      const updatedNotes = notes.filter((note) => note.id !== id)
      setNotes(updatedNotes)
      if (selectedNote?.id === id) {
        setSelectedNote(updatedNotes[0] || null)
      }
    } catch (error) {
      console.error("[v0] Error deleting note:", error)
    }
  }

  const createFolder = async () => {
    const name = folderDraft.trim()
    if (!name) return

    try {
      const response = await fetch("/api/note-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error("Failed to create folder")
      }

      const newFolder = normalizeFolder(await response.json())
      setFolders((prev) => sortFolders([...prev, newFolder]))
      setFolderDraft("")
      setShowFolderInput(false)
      setActiveFilter({ type: "folder", value: newFolder.id })
    } catch (error) {
      console.error("[v0] Error creating folder:", error)
    }
  }

  const saveFolderRename = async (folderId: string) => {
    const name = editingFolderName.trim()
    if (!name) return

    try {
      const response = await fetch("/api/note-folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId, name }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename folder")
      }

      const updatedFolder = normalizeFolder(await response.json())
      setFolders((prev) => sortFolders(prev.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder))))
      setNotes((prev) =>
        prev.map((note) => (note.folder_id === updatedFolder.id ? { ...note, folder_name: updatedFolder.name } : note))
      )
      setSelectedNote((prev) =>
        prev?.folder_id === updatedFolder.id ? { ...prev, folder_name: updatedFolder.name } : prev
      )
      setEditingFolderId(null)
      setEditingFolderName("")
    } catch (error) {
      console.error("[v0] Error renaming folder:", error)
    }
  }

  const deleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder? Notes in it will stay unfiled.")) return

    try {
      const response = await fetch("/api/note-folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete folder")
      }

      setFolders((prev) => prev.filter((folder) => folder.id !== folderId))
      setNotes((prev) =>
        prev.map((note) => (note.folder_id === folderId ? { ...note, folder_id: null, folder_name: null } : note))
      )
      setSelectedNote((prev) =>
        prev?.folder_id === folderId ? { ...prev, folder_id: null, folder_name: null } : prev
      )
      if (activeFilter.type === "folder" && activeFilter.value === folderId) {
        setActiveFilter({ type: "all" })
      }
    } catch (error) {
      console.error("[v0] Error deleting folder:", error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getPreviewText = (content: string) => {
    const text = content.replace(/<[^>]*>/g, "").trim()
    return text.slice(0, 100) || "No content"
  }

  const getFilterTitle = () => {
    if (activeFilter.type === "all") return "All notes"
    if (activeFilter.type === "pinned") return "Pinned notes"
    if (activeFilter.type === "recent") return "Recently updated"
    if (activeFilter.type === "folder") {
      return folders.find((folder) => folder.id === activeFilter.value)?.name || "Folder"
    }
    return `#${activeFilter.value}`
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Notes" subtitle="Your personal note-taking space">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={`${firstName}'s Notes`} subtitle="Your personal note-taking space">
      <div className="flex h-[calc(100vh-200px)] gap-4">
        <Card className={`${showSidebar ? "w-80" : "w-0 overflow-hidden"} flex-shrink-0 transition-all duration-300`}>
          <CardContent className="flex h-full flex-col p-0">
            <div className="space-y-3 border-b border-border p-4">
              <Button onClick={createNewNote} disabled={creatingNote} className="w-full gap-2">
                {creatingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                New Note
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-4 p-3">
                <div className="space-y-1">
                  <FilterButton active={activeFilter.type === "all"} onClick={() => setActiveFilter({ type: "all" })}>
                    <FileText className="h-4 w-4" />
                    <span>All notes</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{notes.length}</Badge>
                  </FilterButton>
                  <FilterButton active={activeFilter.type === "pinned"} onClick={() => setActiveFilter({ type: "pinned" })}>
                    <Pin className="h-4 w-4" />
                    <span>Pinned</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{notes.filter((note) => note.is_pinned).length}</Badge>
                  </FilterButton>
                  <FilterButton active={activeFilter.type === "recent"} onClick={() => setActiveFilter({ type: "recent" })}>
                    <Clock className="h-4 w-4" />
                    <span>Recently updated</span>
                  </FilterButton>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Folder className="h-3.5 w-3.5" />
                      Folders
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFolderInput((value) => !value)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {showFolderInput && (
                    <div className="flex gap-2">
                      <Input
                        value={folderDraft}
                        onChange={(event) => setFolderDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") createFolder()
                        }}
                        placeholder="Folder name"
                        className="h-8"
                      />
                      <Button size="sm" onClick={createFolder}>Add</Button>
                    </div>
                  )}

                  {folders.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">No folders yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {folders.map((folder) => (
                        <div key={folder.id}>
                          {editingFolderId === folder.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editingFolderName}
                                onChange={(event) => setEditingFolderName(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") saveFolderRename(folder.id)
                                  if (event.key === "Escape") setEditingFolderId(null)
                                }}
                                className="h-8"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => saveFolderRename(folder.id)}>Save</Button>
                            </div>
                          ) : (
                            <div className="group flex items-center gap-1">
                              <FilterButton
                                active={activeFilter.type === "folder" && activeFilter.value === folder.id}
                                onClick={() => setActiveFilter({ type: "folder", value: folder.id })}
                              >
                                <Folder className="h-4 w-4" />
                                <span className="truncate">{folder.name}</span>
                                <Badge variant="secondary" className="ml-auto text-xs">{folderCounts[folder.id] || 0}</Badge>
                              </FilterButton>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingFolderId(folder.id)
                                      setEditingFolderName(folder.name)
                                    }}
                                  >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteFolder(folder.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </div>
                  {allTags.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">No tags yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allTags.map((tag) => (
                        <button key={tag} type="button" onClick={() => setActiveFilter({ type: "tag", value: tag })}>
                          <Badge variant={activeFilter.type === "tag" && activeFilter.value === tag ? "default" : "outline"} className="gap-1">
                            #{tag}
                            <span className="text-[10px] opacity-70">{tagCounts[tag]}</span>
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-medium text-muted-foreground">{getFilterTitle()}</p>
                    <span className="text-xs text-muted-foreground">{filteredNotes.length}</span>
                  </div>

                  {loadError ? (
                    <Empty className="py-8">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><AlertCircle className="h-5 w-5" /></EmptyMedia>
                        <EmptyTitle>Could not load notes</EmptyTitle>
                        <EmptyDescription>{loadError}</EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button variant="outline" onClick={fetchNotesAndFolders}>Try again</Button>
                      </EmptyContent>
                    </Empty>
                  ) : filteredNotes.length === 0 ? (
                    <Empty className="py-8">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><FileText className="h-5 w-5" /></EmptyMedia>
                        <EmptyTitle>{notes.length === 0 ? "No notes yet" : "No notes found"}</EmptyTitle>
                        <EmptyDescription>
                          {notes.length === 0 ? "Create your first note." : "Try another search or filter."}
                        </EmptyDescription>
                      </EmptyHeader>
                      {notes.length === 0 && (
                        <EmptyContent>
                          <Button onClick={createNewNote} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create note
                          </Button>
                        </EmptyContent>
                      )}
                    </Empty>
                  ) : (
                    <div className="space-y-1">
                      {filteredNotes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => setSelectedNote(note)}
                          className={`group rounded-lg p-3 transition-all ${
                            selectedNote?.id === note.id ? "bg-primary text-primary-foreground" : "cursor-pointer hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {note.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0" />}
                                <h3 className="truncate text-sm font-medium">{note.title}</h3>
                              </div>
                              <p className={`mt-1 truncate text-xs ${selectedNote?.id === note.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {getPreviewText(note.content)}
                              </p>
                              <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-xs ${selectedNote?.id === note.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                <Clock className="h-3 w-3" />
                                {formatDate(note.updated_at)}
                                {note.folder_name && (
                                  <>
                                    <span>/</span>
                                    <Folder className="h-3 w-3" />
                                    <span className="truncate">{note.folder_name}</span>
                                  </>
                                )}
                              </div>
                              {note.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {note.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant={selectedNote?.id === note.id ? "secondary" : "outline"} className="px-1.5 py-0 text-[10px]">
                                      #{tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 opacity-0 group-hover:opacity-100 ${
                                    selectedNote?.id === note.id ? "text-primary-foreground hover:bg-primary-foreground/20" : ""
                                  }`}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    togglePinned(note)
                                  }}
                                >
                                  <Pin className="mr-2 h-4 w-4" />
                                  {note.is_pinned ? "Unpin" : "Pin"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    deleteNote(note.id)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="flex h-full flex-col p-0">
            {selectedNote ? (
              <>
                <div className="border-b border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-1 items-center gap-3">
                      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(!showSidebar)}>
                        <ChevronLeft className={`h-4 w-4 transition-transform ${!showSidebar ? "rotate-180" : ""}`} />
                      </Button>
                      <Input
                        ref={titleInputRef}
                        value={selectedNote.title}
                        onChange={(event) => handleTitleChange(event.target.value)}
                        className="h-auto border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                        placeholder="Note title..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <SaveStatus state={saveState} />
                      <Button
                        variant={selectedNote.is_pinned ? "secondary" : "ghost"}
                        size="icon"
                        onClick={() => togglePinned(selectedNote)}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
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
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Note
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                    <Select value={selectedNote.folder_id || "none"} onValueChange={handleFolderChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="No folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {selectedNote.tags.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No tags</span>
                      ) : (
                        selectedNote.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1">
                            #{tag}
                            <button type="button" onClick={() => removeTagFromSelectedNote(tag)}>
                              <X className="h-3 w-3" />
                              <span className="sr-only">Remove {tag}</span>
                            </button>
                          </Badge>
                        ))
                      )}
                      <div className="flex min-w-[180px] flex-1 gap-2">
                        <Input
                          value={tagDraft}
                          onChange={(event) => setTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault()
                              addTagToSelectedNote()
                            }
                          }}
                          placeholder="Add tag"
                          className="h-8"
                        />
                        <Button size="sm" variant="outline" onClick={addTagToSelectedNote} disabled={!tagDraft.trim()}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <Textarea
                    value={selectedNote.content}
                    onChange={(event) => handleContentChange(event.target.value)}
                    placeholder="Start writing your note..."
                    className="min-h-full w-full resize-none border-none text-base leading-relaxed shadow-none focus-visible:ring-0"
                    style={{ minHeight: "calc(100vh - 430px)" }}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                  <span>Last edited {formatDate(selectedNote.updated_at)}</span>
                  <span>{selectedNote.content.length} characters</span>
                </div>
              </>
            ) : (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FileText className="h-6 w-6" /></EmptyMedia>
                  <EmptyTitle>No note selected</EmptyTitle>
                  <EmptyDescription>Select a note from the sidebar or create a new one.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={createNewNote} disabled={creatingNote} className="gap-2">
                    {creatingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create New Note
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    )
  }

  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3 w-3" />
        Saved
      </span>
    )
  }

  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Not saved
      </span>
    )
  }

  return null
}
