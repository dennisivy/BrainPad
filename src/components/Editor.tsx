interface EditorProps {
  content: string
  onChange: (content: string) => void
  disabled?: boolean
}

export function Editor({ content, onChange, disabled }: EditorProps) {
  if (disabled) {
    return (
      <main className="editor">
        <div className="editor-empty">
          <p>Select a note from the sidebar</p>
          <p className="hint">or press <kbd>Cmd</kbd>+<kbd>N</kbd> to create a new note</p>
        </div>
      </main>
    )
  }

  return (
    <main className="editor">
      <textarea
        className="editor-textarea"
        placeholder="Start writing..."
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </main>
  )
}
