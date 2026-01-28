import { useEffect, useRef, useState } from 'react'
import { saveNote } from '../utils/fileSystem'

interface UseAutoSaveOptions {
  content: string
  filePath: string | null
  delay?: number
  onSaveStart?: () => void
  onSaveComplete?: () => void
  onSaveError?: (error: Error) => void
}

export function useAutoSave({
  content,
  filePath,
  delay = 500,
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseAutoSaveOptions) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const lastContentRef = useRef<string>(content)
  const lastPathRef = useRef<string | null>(filePath)

  useEffect(() => {
    // Skip if no file path or content hasn't changed
    if (!filePath) return

    // If path changed, update refs without triggering save
    if (lastPathRef.current !== filePath) {
      lastPathRef.current = filePath
      lastContentRef.current = content
      return
    }

    // Skip if content hasn't actually changed
    if (lastContentRef.current === content) return

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set up debounced save
    timeoutRef.current = window.setTimeout(async () => {
      setIsSaving(true)
      onSaveStart?.()

      try {
        await saveNote(filePath, content)
        lastContentRef.current = content
        setLastSaved(new Date())
        onSaveComplete?.()
      } catch (error) {
        onSaveError?.(error as Error)
        console.error('Auto-save failed:', error)
      } finally {
        setIsSaving(false)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [content, filePath, delay, onSaveStart, onSaveComplete, onSaveError])

  return { isSaving, lastSaved }
}
