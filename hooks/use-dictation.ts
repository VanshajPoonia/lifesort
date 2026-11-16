"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Browser speech recognition (Web Speech API). No audio leaves the browser through LifeSort.
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

export type DictationState = {
  listening: boolean
  unsupported: boolean
  interim: string
  message: string
}

const idle: DictationState = { listening: false, unsupported: false, interim: "", message: "" }

// onFinal receives each finished phrase. interim holds the words still being heard.
export function useDictation(onFinal: (text: string) => void) {
  const onFinalRef = useRef(onFinal)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listeningRef = useRef(false)
  const [state, setState] = useState<DictationState>(idle)

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      listeningRef.current = false
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    listeningRef.current = false
    setState((current) => ({ ...current, listening: false, interim: "", message: current.message || "Dictation stopped." }))
  }, [])

  const toggle = useCallback(() => {
    if (listeningRef.current) {
      stop()
      return
    }

    const Recognition = typeof window === "undefined" ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!Recognition) {
      setState({ listening: false, unsupported: true, interim: "", message: "Voice dictation is not supported in this browser." })
      return
    }

    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"

    recognition.onresult = (event) => {
      let finalTranscript = ""
      let interimTranscript = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ""
        if (result.isFinal) finalTranscript += transcript
        else interimTranscript += transcript
      }
      if (finalTranscript.trim()) onFinalRef.current(finalTranscript.trim())
      setState((current) => ({ ...current, interim: interimTranscript.trim(), message: "" }))
    }

    recognition.onerror = (event) => {
      listeningRef.current = false
      setState({ listening: false, unsupported: false, interim: "", message: event.message || event.error || "Voice dictation stopped." })
    }

    recognition.onend = () => {
      listeningRef.current = false
      recognitionRef.current = null
      setState((current) => ({ ...current, listening: false, interim: "", message: current.message || "Dictation stopped." }))
    }

    try {
      recognitionRef.current = recognition
      listeningRef.current = true
      setState({ listening: true, unsupported: false, interim: "", message: "Listening..." })
      recognition.start()
    } catch {
      listeningRef.current = false
      recognitionRef.current = null
      setState({ listening: false, unsupported: false, interim: "", message: "Could not start voice dictation." })
    }
  }, [stop])

  return { ...state, toggle, stop }
}
