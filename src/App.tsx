import { useEffect, useState, useCallback } from 'react'
import './App.css'
import { FolderPicker } from './components/FolderPicker'
import { Sidebar } from './components/Sidebar'
import { MilkdownEditor } from './components/MilkdownEditor'
import { NewNoteModal } from './components/NewNoteModal'
import { RenameNoteModal } from './components/RenameNoteModal'
import { useNotes } from './hooks/useNotes'
import { useAutoSave } from './hooks/useAutoSave'
import { loadSettings, saveNote, selectFolder, saveSettings } from './utils/fileSystem'

function App() {
  const [notesDirectory, setNotesDirectory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastOpenedNote, setLastOpenedNote] = useState<string | null>(null)
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false)
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; path: string; currentName: string }>({
    isOpen: false,
    path: '',
    currentName: ''
  })

  const {
    notes,
    activeNote,
    isLoading: notesLoading,
    error,
    loadNotes,
    selectNote,
    updateNoteContent,
    createNote,
    renameNote,
    deleteNote,
    clearError,
  } = useNotes(notesDirectory)

  const { isSaving } = useAutoSave({
    content: activeNote?.content ?? '',
    filePath: activeNote?.path ?? null,
    delay: 500,
  })

  // Load settings on mount
  useEffect(() => {
    async function init() {
      try {
        const settings = await loadSettings()
        setNotesDirectory(settings.notesDirectory)
        setLastOpenedNote(settings.lastOpenedNote)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Load notes when directory is set
  useEffect(() => {
    if (notesDirectory) {
      loadNotes()
    }
  }, [notesDirectory, loadNotes])

  // Open last note after notes are loaded
  useEffect(() => {
    if (lastOpenedNote && notes.length > 0 && !activeNote) {
      const noteExists = notes.some(n => n.path === lastOpenedNote)
      if (noteExists) {
        selectNote(lastOpenedNote)
      }
      setLastOpenedNote(null) // Only try once
    }
  }, [notes, lastOpenedNote, activeNote, selectNote])

  // Keyboard shortcuts
  const handleNewNote = useCallback(() => {
    setIsNewNoteModalOpen(true)
  }, [])

  const handleOpenRenameModal = useCallback((path: string, currentName: string) => {
    setRenameModal({ isOpen: true, path, currentName })
  }, [])

  const handleRenameNote = useCallback((newFilename: string) => {
    if (renameModal.path) {
      renameNote(renameModal.path, newFilename)
    }
  }, [renameModal.path, renameNote])

  const handleManualSave = useCallback(async () => {
    if (activeNote?.path && activeNote?.content !== undefined) {
      try {
        await saveNote(activeNote.path, activeNote.content)
      } catch (err) {
        console.error('Failed to save:', err)
      }
    }
  }, [activeNote])

  const handleChangeFolder = useCallback(async () => {
    try {
      const path = await selectFolder()
      if (path) {
        await saveSettings({ notesDirectory: path })
        setNotesDirectory(path)
      }
    } catch (err) {
      console.error('Failed to change folder:', err)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'n') {
        e.preventDefault()
        handleNewNote()
      } else if (isMod && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewNote, handleManualSave])

  if (isLoading) {
    return (
      <div className="folder-picker">
        <div className="folder-picker-content">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!notesDirectory) {
    return <FolderPicker onFolderSelected={setNotesDirectory} />
  }

  return (
    <div className="app">
      <div className="titlebar" data-tauri-drag-region />
      <Sidebar
        notes={notes}
        activeNotePath={activeNote?.path ?? null}
        onSelectNote={selectNote}
        onNewNote={handleNewNote}
        onOpenRenameModal={handleOpenRenameModal}
        onDeleteNote={deleteNote}
        onRefresh={loadNotes}
        onChangeFolder={handleChangeFolder}
        isLoading={notesLoading}
      />
      <MilkdownEditor
        content={activeNote?.content ?? ''}
        onChange={updateNoteContent}
        disabled={!activeNote}
        notesDirectory={notesDirectory}
        notePath={activeNote?.path ?? null}
      />
      {isSaving && <div className="save-indicator">Saving...</div>}
      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}
      <NewNoteModal
        isOpen={isNewNoteModalOpen}
        onClose={() => setIsNewNoteModalOpen(false)}
        onSubmit={createNote}
      />
      <RenameNoteModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        onClose={() => setRenameModal({ isOpen: false, path: '', currentName: '' })}
        onSubmit={handleRenameNote}
      />
    </div>
  )
}

export default App
