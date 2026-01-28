import { useState } from 'react'
import { selectFolder, saveSettings } from '../utils/fileSystem'

interface FolderPickerProps {
  onFolderSelected: (path: string) => void
}

export function FolderPicker({ onFolderSelected }: FolderPickerProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  async function handleSelectFolder() {
    setIsSelecting(true)
    try {
      const path = await selectFolder()
      if (path) {
        setSelectedPath(path)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    } finally {
      setIsSelecting(false)
    }
  }

  async function handleConfirm() {
    if (selectedPath) {
      await saveSettings({ notesDirectory: selectedPath })
      onFolderSelected(selectedPath)
    }
  }

  return (
    <div className="folder-picker">
      <div className="folder-picker-content">
        <h1>Markdown Notes</h1>
        <p>Select a folder to store your notes.</p>
        <p className="folder-picker-hint">
          Notes are stored as plain .md files that you can access anytime.
        </p>

        {selectedPath ? (
          <div className="folder-picker-selected">
            <span className="folder-picker-path">{selectedPath}</span>
            <div className="folder-picker-actions">
              <button onClick={handleSelectFolder} disabled={isSelecting}>
                Change
              </button>
              <button onClick={handleConfirm} className="primary">
                Open Folder
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSelectFolder}
            disabled={isSelecting}
            className="primary large"
          >
            {isSelecting ? 'Selecting...' : 'Select Folder'}
          </button>
        )}
      </div>
    </div>
  )
}
