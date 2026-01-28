import { useState } from 'react'
import type { Note } from '../types'

interface SidebarProps {
  notes: Note[]
  activeNotePath: string | null
  onSelectNote: (path: string) => void
  onNewNote: () => void
  onRenameNote: (path: string, newFilename: string) => void
  onDeleteNote: (path: string) => void
  onRefresh: () => void
  onChangeFolder: () => void
  isLoading: boolean
}

export function Sidebar({
  notes,
  activeNotePath,
  onSelectNote,
  onNewNote,
  onRenameNote,
  onDeleteNote,
  onRefresh,
  onChangeFolder,
  isLoading,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null)

  function handleContextMenu(e: React.MouseEvent, path: string) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, path })
  }

  function handleRename() {
    if (!contextMenu) return
    const note = notes.find(n => n.path === contextMenu.path)
    if (!note) return

    const newName = prompt('Rename note:', note.filename.replace('.md', ''))
    if (newName && newName.trim()) {
      onRenameNote(contextMenu.path, newName.trim())
    }
    setContextMenu(null)
  }

  function handleDelete() {
    if (!contextMenu) return
    const note = notes.find(n => n.path === contextMenu.path)
    if (!note) return

    if (confirm(`Delete "${note.filename}"? This cannot be undone.`)) {
      onDeleteNote(contextMenu.path)
    }
    setContextMenu(null)
  }

  function handleCloseContextMenu() {
    setContextMenu(null)
  }

  return (
    <>
      <aside className="sidebar" onClick={handleCloseContextMenu}>
        <div className="sidebar-header">
          <h2>Notes</h2>
          <div className="sidebar-actions">
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh() }}
              disabled={isLoading}
              title="Refresh notes"
              className="icon-button"
            >
              ↻
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNewNote() }}
              disabled={isLoading}
              title="New note"
              className="icon-button"
            >
              +
            </button>
          </div>
        </div>
        <div className="sidebar-content">
          {isLoading ? (
            <p className="placeholder">Loading...</p>
          ) : notes.length === 0 ? (
            <p className="placeholder">No notes yet</p>
          ) : (
            <ul className="notes-list">
              {notes.map((note) => (
                <li
                  key={note.path}
                  className={`note-item ${note.path === activeNotePath ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onSelectNote(note.path) }}
                  onContextMenu={(e) => handleContextMenu(e, note.path)}
                >
                  <span className="note-name">{note.filename.replace('.md', '')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sidebar-footer">
          <button
            onClick={(e) => { e.stopPropagation(); onChangeFolder() }}
            className="change-folder-button"
            title="Change notes folder"
          >
            Change Folder
          </button>
        </div>
      </aside>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleRename}>Rename</button>
          <button onClick={handleDelete} className="danger">Delete</button>
        </div>
      )}
    </>
  )
}
