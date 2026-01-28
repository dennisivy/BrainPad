import { useState, useCallback } from 'react'
import type { Note } from '../types'
import {
  scanNotesFolder,
  readNoteContent,
  saveSettings,
  createNote as createNoteFile,
  renameNote as renameNoteFile,
  deleteNote as deleteNoteFile,
} from '../utils/fileSystem'

interface UseNotesReturn {
  notes: Note[]
  activeNote: Note | null
  isLoading: boolean
  error: string | null
  loadNotes: () => Promise<void>
  selectNote: (path: string) => Promise<void>
  updateNoteContent: (content: string) => void
  createNote: (filename: string) => Promise<void>
  renameNote: (path: string, newFilename: string) => Promise<void>
  deleteNote: (path: string) => Promise<void>
  clearError: () => void
}

export function useNotes(notesDirectory: string | null): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    if (!notesDirectory) return

    setIsLoading(true)
    setError(null)

    try {
      const loadedNotes = await scanNotesFolder(notesDirectory)
      setNotes(loadedNotes)
    } catch (err) {
      setError('Failed to load notes')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [notesDirectory])

  const selectNote = useCallback(async (path: string) => {
    const note = notes.find((n) => n.path === path)
    if (!note) return

    try {
      const content = await readNoteContent(path)
      const updatedNote = { ...note, content }
      setActiveNote(updatedNote)
      await saveSettings({ lastOpenedNote: path })
    } catch (err) {
      setError('Failed to open note. It may have been deleted.')
      console.error(err)
      // Refresh notes list to reflect current state
      await loadNotes()
    }
  }, [notes, loadNotes])

  const updateNoteContent = useCallback((content: string) => {
    setActiveNote((prev) => (prev ? { ...prev, content } : null))
  }, [])

  const createNote = useCallback(async (filename: string) => {
    if (!notesDirectory) return

    try {
      const newNote = await createNoteFile(notesDirectory, filename)
      setNotes((prev) => [...prev, newNote].sort((a, b) => a.filename.localeCompare(b.filename)))
      setActiveNote(newNote)
      await saveSettings({ lastOpenedNote: newNote.path })
    } catch (err) {
      setError('Failed to create note')
      console.error(err)
    }
  }, [notesDirectory])

  const renameNote = useCallback(async (path: string, newFilename: string) => {
    if (!notesDirectory) return

    try {
      const renamedNote = await renameNoteFile(path, notesDirectory, newFilename)

      // If we have content loaded, preserve it
      const existingNote = notes.find((n) => n.path === path)
      if (existingNote) {
        renamedNote.content = existingNote.content
      }

      setNotes((prev) => {
        const filtered = prev.filter((n) => n.path !== path)
        return [...filtered, renamedNote].sort((a, b) => a.filename.localeCompare(b.filename))
      })

      // Update active note if it was renamed
      if (activeNote?.path === path) {
        setActiveNote(renamedNote)
        await saveSettings({ lastOpenedNote: renamedNote.path })
      }
    } catch (err) {
      setError('Failed to rename note')
      console.error(err)
    }
  }, [notesDirectory, notes, activeNote])

  const deleteNote = useCallback(async (path: string) => {
    try {
      await deleteNoteFile(path)
      setNotes((prev) => prev.filter((n) => n.path !== path))

      // Clear active note if it was deleted
      if (activeNote?.path === path) {
        setActiveNote(null)
        await saveSettings({ lastOpenedNote: null })
      }
    } catch (err) {
      setError('Failed to delete note')
      console.error(err)
    }
  }, [activeNote])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    notes,
    activeNote,
    isLoading,
    error,
    loadNotes,
    selectNote,
    updateNoteContent,
    createNote,
    renameNote,
    deleteNote,
    clearError,
  }
}
