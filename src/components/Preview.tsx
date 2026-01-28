import Markdown from 'react-markdown'

interface PreviewProps {
  content: string
}

export function Preview({ content }: PreviewProps) {
  return (
    <aside className="preview">
      <div className="preview-content markdown-body">
        {content ? (
          <Markdown>{content}</Markdown>
        ) : (
          <p className="placeholder">Start typing to see preview...</p>
        )}
      </div>
    </aside>
  )
}
