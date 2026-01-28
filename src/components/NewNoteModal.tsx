import { useState, useEffect, useRef } from 'react'

interface NewNoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (filename: string) => void
}

export function NewNoteModal({ isOpen, onClose, onSubmit }: NewNoteModalProps) {
  const [filename, setFilename] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setFilename('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (filename.trim()) {
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
        <h3>New Note</h3>
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
            <button type="submit" disabled={!filename.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}
