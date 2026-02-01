import { useState, useEffect, useRef } from 'react'

interface RenameNoteModalProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onSubmit: (newFilename: string) => void
}

export function RenameNoteModal({ isOpen, currentName, onClose, onSubmit }: RenameNoteModalProps) {
  const [filename, setFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Defer state updates to avoid synchronous setState-in-effect warnings.
    setTimeout(() => {
      // Remove .md extension for editing
      setFilename(currentName.replace('.md', ''))
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [isOpen, currentName])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (filename.trim() && filename.trim() !== currentName.replace('.md', '')) {
      onSubmit(filename.trim())
      onClose()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h3>Rename Note</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Note name"
            autoFocus
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={!filename.trim() || filename.trim() === currentName.replace('.md', '')}>Rename</button>
          </div>
        </form>
      </div>
    </div>
  )
}
