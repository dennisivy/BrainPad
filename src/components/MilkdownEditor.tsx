import { useRef, useEffect } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { nord } from '@milkdown/theme-nord'
import { replaceAll, $prose } from '@milkdown/utils'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'

import '@milkdown/theme-nord/style.css'

interface MilkdownEditorProps {
  content: string
  onChange: (content: string) => void
  disabled?: boolean
}

// Plugin to exit code block with Mod+Enter or Enter at end of block
const exitCodeBlockPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('exit-code-block'),
    props: {
      handleKeyDown(view, event) {
        const { state } = view
        const { selection } = state
        const { $from } = selection

        // Check if we're in a code block
        const node = $from.node($from.depth)
        if (node.type.name !== 'code_block') return false

        // Mod+Enter to exit code block
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          const endPos = $from.end($from.depth - 1)
          const tr = state.tr.insert(endPos, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(endPos + 1)))
          view.dispatch(tr)
          return true
        }

        // Enter at the end of an empty last line exits the block
        if (event.key === 'Enter' && !event.shiftKey) {
          const textContent = node.textContent
          const lines = textContent.split('\n')
          const lastLine = lines[lines.length - 1]

          // If the last line is empty and cursor is at the very end
          if (lastLine === '' && $from.pos === $from.end()) {
            const endPos = $from.end($from.depth - 1)

            // Remove the trailing newline and insert paragraph after
            const tr = state.tr
            tr.delete($from.pos - 1, $from.pos) // Remove the empty line
            tr.insert(endPos - 1, state.schema.nodes.paragraph.create())
            tr.setSelection(TextSelection.near(tr.doc.resolve(endPos)))
            view.dispatch(tr)
            return true
          }
        }

        return false
      }
    }
  })
})

// Plugin to ensure there's always a paragraph at the end of the document
const trailingParagraphPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('trailing-paragraph'),
    appendTransaction(_transactions, _oldState, newState) {
      const lastNode = newState.doc.lastChild
      if (lastNode && lastNode.type.name !== 'paragraph') {
        const tr = newState.tr
        tr.insert(newState.doc.content.size, newState.schema.nodes.paragraph.create())
        return tr
      }
      return null
    }
  })
})

export function MilkdownEditor({ content, onChange, disabled }: MilkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null)
  const isUpdatingRef = useRef(false)
  const lastContentRef = useRef(content)

  useEffect(() => {
    if (disabled || !editorRef.current) return

    const editor = Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.current!)
        ctx.set(defaultValueCtx, content)
      })
      .use(listener)
      .use(commonmark)
      .use(gfm)
      .use(exitCodeBlockPlugin)
      .use(trailingParagraphPlugin)

    editor.create().then((instance) => {
      editorInstanceRef.current = instance
      lastContentRef.current = content

      // Set up listener after editor is created
      instance.action((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          // Only trigger onChange if this wasn't a programmatic update
          if (!isUpdatingRef.current && markdown !== lastContentRef.current) {
            lastContentRef.current = markdown
            onChange(markdown)
          }
        })
      })
    })

    return () => {
      editorInstanceRef.current?.destroy()
      editorInstanceRef.current = null
    }
  }, [disabled])

  // Update content when switching notes (from parent)
  useEffect(() => {
    if (editorInstanceRef.current && content !== lastContentRef.current) {
      isUpdatingRef.current = true
      lastContentRef.current = content
      editorInstanceRef.current.action(replaceAll(content))
      // Reset flag after a tick
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }, [content])

  if (disabled) {
    return (
      <main className="editor milkdown-wrapper">
        <div className="editor-empty">
          <p>Select a note from the sidebar</p>
          <p className="hint">or press <kbd>Cmd</kbd>+<kbd>N</kbd> to create a new note</p>
        </div>
      </main>
    )
  }

  return (
    <main className="editor milkdown-wrapper">
      <div ref={editorRef} className="milkdown-editor" />
    </main>
  )
}
