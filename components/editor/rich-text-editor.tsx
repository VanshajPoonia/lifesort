"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mic,
  MicOff,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { normalizeRichTextForEditor } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type RichTextMode = "standard" | "journal" | "compact"

type RichTextEditorProps = {
  value?: string | null
  onChange: (html: string) => void
  placeholder?: string
  mode?: RichTextMode
  disabled?: boolean
  ariaLabel?: string
  debounceMs?: number
  className?: string
  editorClassName?: string
  aiRefineEnabled?: boolean
  dictationEnabled?: boolean
  dictationLabel?: string
}

type AiRefineAction = "improve_grammar" | "rephrase" | "make_shorter" | "make_longer" | "simplify_language" | "change_tone"

const aiRefineActions: Array<{ value: AiRefineAction; label: string }> = [
  { value: "improve_grammar", label: "Improve grammar" },
  { value: "rephrase", label: "Rephrase" },
  { value: "make_shorter", label: "Make shorter" },
  { value: "make_longer", label: "Make longer" },
  { value: "simplify_language", label: "Simplify language" },
  { value: "change_tone", label: "Change tone" },
]

type RefineSelection = { from: number; to: number; text: string }
type RefineState =
  | { status: "idle" }
  | { status: "loading"; action: AiRefineAction; label: string }
  | { status: "ready"; selection: RefineSelection; refinedText: string }
  | { status: "error"; message: string }

type SpeechRecognitionAlternativeLike = { transcript: string }
type SpeechRecognitionResultLike = {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}
type SpeechRecognitionResultListLike = {
  length: number
  [index: number]: SpeechRecognitionResultLike
}
type SpeechRecognitionEventLike = {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}
type SpeechRecognitionErrorEventLike = {
  error?: string
  message?: string
}
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike
  }
}

function isAllowedLink(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true

  try {
    const parsed = new URL(trimmed.includes("://") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") ? trimmed : `https://${trimmed}`)
    return ["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

function normalizeLink(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return ""
  return `https://${trimmed}`
}

function plainTextToContent(text: string) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) {
    return { type: "text", text: "" }
  }

  if (paragraphs.length === 1 && !paragraphs[0].includes("\n")) {
    return { type: "text", text: paragraphs[0] }
  }

  return paragraphs.map((paragraph) => {
    const lines = paragraph.split("\n")
    const content = lines.flatMap((line, index) => {
      const nodes: Array<Record<string, unknown>> = []
      if (line) nodes.push({ type: "text", text: line })
      if (index < lines.length - 1) nodes.push({ type: "hardBreak" })
      return nodes
    })
    return { type: "paragraph", content: content.length ? content : undefined }
  })
}

function paragraphContent(text: string) {
  const trimmed = text.trim()
  const lines = trimmed.split("\n")
  const content = trimmed
    ? lines.flatMap((line, index) => {
        const nodes: Array<Record<string, unknown>> = []
        if (line) nodes.push({ type: "text", text: line })
        if (index < lines.length - 1) nodes.push({ type: "hardBreak" })
        return nodes
      })
    : undefined
  return { type: "paragraph", content }
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  mode = "standard",
  disabled = false,
  ariaLabel = "Rich text editor",
  debounceMs = 250,
  className,
  editorClassName,
  aiRefineEnabled = false,
  dictationEnabled = false,
  dictationLabel = "Speak to Note",
}: RichTextEditorProps) {
  const normalizedValue = useMemo(() => normalizeRichTextForEditor(value), [value])
  const onChangeRef = useRef(onChange)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingHtmlRef = useRef<string | null>(null)
  const syncingRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const [refineState, setRefineState] = useState<RefineState>({ status: "idle" })
  const [dictationState, setDictationState] = useState<{
    listening: boolean
    unsupported: boolean
    interim: string
    message: string
  }>({ listening: false, unsupported: false, interim: "", message: "" })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [1, 2] },
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: {
          class: "rich-text-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
        isAllowedUri: (url, ctx) => isAllowedLink(url) && ctx.defaultValidate(url),
      }),
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions,
    content: normalizedValue,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      if (syncingRef.current) return

      const html = activeEditor.isEmpty ? "" : activeEditor.getHTML()
      pendingHtmlRef.current = html

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        pendingHtmlRef.current = null
        onChangeRef.current(html)
      }, debounceMs)
    },
  })

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (pendingHtmlRef.current !== null) onChangeRef.current(pendingHtmlRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      listeningRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    if (normalizedValue === editor.getHTML()) return

    syncingRef.current = true
    editor.commands.setContent(normalizedValue, { emitUpdate: false })
    syncingRef.current = false
  }, [editor, normalizedValue])

  const setLink = () => {
    if (!editor) return

    const previousUrl = String(editor.getAttributes("link").href || "")
    const input = window.prompt("Paste a safe link", previousUrl || "https://")
    if (input === null) return

    const nextUrl = normalizeLink(input)
    if (!nextUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }

    if (!isAllowedLink(nextUrl)) {
      window.alert("Only http, https, mailto, tel, relative, and anchor links are supported.")
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: nextUrl }).run()
  }

  const getSelectedText = (): RefineSelection | null => {
    if (!editor) return null
    const { from, to, empty } = editor.state.selection
    if (empty) return null
    const text = editor.state.doc.textBetween(from, to, "\n").trim()
    if (!text) return null
    return { from, to, text }
  }

  const handleAiRefine = async (action: AiRefineAction, label: string) => {
    if (!editor || disabled || !aiRefineEnabled) return

    const selection = getSelectedText()
    if (!selection) {
      setRefineState({ status: "error", message: "Select text first, then choose an AI refine action." })
      return
    }

    let tone: string | undefined
    if (action === "change_tone") {
      const input = window.prompt("What tone should LifeSort use?", "warmer and clearer")
      if (input === null) return
      tone = input.trim() || undefined
    }

    setRefineState({ status: "loading", action, label })

    try {
      const response = await fetch("/api/ai/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selection.text, action, tone }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not refine the selected text.")
      if (!data?.refined_text) throw new Error("The AI response was empty.")
      setRefineState({ status: "ready", selection, refinedText: String(data.refined_text) })
    } catch (error) {
      setRefineState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not refine the selected text.",
      })
    }
  }

  const replaceRefinedText = () => {
    if (!editor || refineState.status !== "ready") return
    const { selection, refinedText } = refineState
    editor.chain().focus().deleteRange({ from: selection.from, to: selection.to }).insertContentAt(selection.from, plainTextToContent(refinedText)).run()
    setRefineState({ status: "idle" })
  }

  const insertRefinedBelow = () => {
    if (!editor || refineState.status !== "ready") return
    const { selection, refinedText } = refineState
    editor.chain().focus().insertContentAt(selection.to, paragraphContent(refinedText)).run()
    setRefineState({ status: "idle" })
  }

  const getSpeechRecognitionConstructor = () => {
    if (typeof window === "undefined") return null
    return window.SpeechRecognition || window.webkitSpeechRecognition || null
  }

  const appendDictation = (text: string) => {
    const transcript = text.trim()
    if (!editor || !transcript) return
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, paragraphContent(transcript)).run()
  }

  const stopDictation = () => {
    recognitionRef.current?.stop()
    listeningRef.current = false
    setDictationState((current) => ({ ...current, listening: false, interim: "", message: current.message || "Dictation stopped." }))
  }

  const toggleDictation = () => {
    if (!dictationEnabled || disabled) return
    if (listeningRef.current) {
      stopDictation()
      return
    }

    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor()
    if (!SpeechRecognitionConstructor) {
      setDictationState({
        listening: false,
        unsupported: true,
        interim: "",
        message: "Voice dictation is not supported in this browser.",
      })
      return
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ""
        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript.trim()) appendDictation(finalTranscript)
      setDictationState((current) => ({ ...current, interim: interimTranscript.trim(), message: "" }))
    }

    recognition.onerror = (event) => {
      listeningRef.current = false
      setDictationState({
        listening: false,
        unsupported: false,
        interim: "",
        message: event.message || event.error || "Voice dictation stopped.",
      })
    }

    recognition.onend = () => {
      listeningRef.current = false
      recognitionRef.current = null
      setDictationState((current) => ({
        ...current,
        listening: false,
        interim: "",
        message: current.message || "Dictation stopped.",
      }))
    }

    try {
      recognitionRef.current = recognition
      listeningRef.current = true
      setDictationState({ listening: true, unsupported: false, interim: "", message: "Listening..." })
      recognition.start()
    } catch {
      listeningRef.current = false
      recognitionRef.current = null
      setDictationState({
        listening: false,
        unsupported: false,
        interim: "",
        message: "Could not start voice dictation.",
      })
    }
  }

  const rootClass = cn(
    "rich-text-editor flex min-h-0 flex-col rounded-md border bg-background",
    mode === "journal" && "rich-text-editor-journal",
    mode === "compact" && "rich-text-editor-compact",
    disabled && "opacity-75",
    className,
  )

  if (!editor) {
    return (
      <div className={rootClass}>
        <div className="h-10 border-b bg-muted/30" />
        <div className="min-h-40 flex-1 p-4 text-sm text-muted-foreground">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <div className="rich-text-toolbar flex flex-wrap items-center gap-1 border-b bg-muted/30 p-2" aria-label="Rich text toolbar">
        <ToolbarButton label="Paragraph" active={editor.isActive("paragraph")} disabled={disabled} onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Bold" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Strike" active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Ordered list" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Blockquote" active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Horizontal rule" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} disabled={disabled} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Undo" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        {dictationEnabled && (
          <>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
            <ToolbarButton
              label={dictationState.listening ? "Stop dictation" : dictationLabel}
              active={dictationState.listening}
              disabled={disabled}
              onClick={toggleDictation}
            >
              {dictationState.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </ToolbarButton>
          </>
        )}
      </div>

      <BubbleMenu editor={editor} className="rich-text-bubble-menu flex items-center gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <ToolbarButton label="Bold selection" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic selection" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Underline selection" active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link selection" active={editor.isActive("link")} disabled={disabled} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        {aiRefineEnabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5"
                title="Refine selected text with AI"
                disabled={disabled || refineState.status === "loading"}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI Refine
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>AI Refine</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {aiRefineActions.map((action) => (
                <DropdownMenuItem key={action.value} onClick={() => handleAiRefine(action.value, action.label)}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </BubbleMenu>

      {refineState.status === "loading" && (
        <div className="border-b bg-primary/10 px-3 py-2 text-sm text-primary" aria-live="polite">
          Refining selection with {refineState.label.toLowerCase()}...
        </div>
      )}

      {refineState.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-destructive/10 px-3 py-2 text-sm text-destructive" aria-live="polite">
          <span>{refineState.message}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRefineState({ status: "idle" })}>
            Dismiss
          </Button>
        </div>
      )}

      {refineState.status === "ready" && (
        <div className="space-y-2 border-b bg-muted/40 px-3 py-3" aria-live="polite">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI suggestion</div>
          <div className="max-h-32 overflow-auto rounded-md border bg-background p-3 text-sm">{refineState.refinedText}</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={replaceRefinedText}>
              Replace selection
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={insertRefinedBelow}>
              Insert below
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRefineState({ status: "idle" })}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {dictationEnabled && (dictationState.listening || dictationState.unsupported || dictationState.message || dictationState.interim) && (
        <div
          className={cn(
            "border-b px-3 py-2 text-sm",
            dictationState.unsupported ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted/35 text-muted-foreground",
          )}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{dictationState.interim || dictationState.message}</span>
            {dictationState.listening && (
              <Button type="button" size="sm" variant="outline" onClick={stopDictation}>
                Stop
              </Button>
            )}
          </div>
        </div>
      )}

      <EditorContent
        editor={editor}
        className={cn("rich-text-content min-h-0 flex-1 overflow-auto", editorClassName)}
      />
    </div>
  )
}
