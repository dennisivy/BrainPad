import { useRef, useEffect } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { nord } from '@milkdown/theme-nord'
import { replaceAll, $prose } from '@milkdown/utils'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'

import '@milkdown/theme-nord/style.css'

// Supported languages for the dropdown
const SUPPORTED_LANGUAGES = [
  { value: '', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'yaml', label: 'YAML' },
]

// Plugin to show language picker for code blocks on hover
const codeBlockLanguagePlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('code-block-language'),
    view(editorView: EditorView) {
      // Create dropdown and append to body for proper layering
      const dropdown = document.createElement('div')
      dropdown.className = 'code-block-language-picker'
      dropdown.style.display = 'none'

      const select = document.createElement('select')
      select.className = 'language-select'

      SUPPORTED_LANGUAGES.forEach(lang => {
        const option = document.createElement('option')
        option.value = lang.value
        option.textContent = lang.label
        select.appendChild(option)
      })

      dropdown.appendChild(select)
      document.body.appendChild(dropdown)

      let currentPre: HTMLElement | null = null
      let currentPos: number | null = null

      // Find all code block positions in the document
      function findCodeBlockPositions(): Map<HTMLElement, number> {
        const positions = new Map<HTMLElement, number>()
        const { doc } = editorView.state

        doc.descendants((node, pos) => {
          if (node.type.name === 'code_block') {
            try {
              const dom = editorView.nodeDOM(pos)
              if (dom instanceof HTMLElement) {
                positions.set(dom, pos)
              }
            } catch {
              // Ignore errors
            }
          }
          return true
        })

        return positions
      }

      function positionDropdown(pre: HTMLElement) {
        const rect = pre.getBoundingClientRect()
        dropdown.style.position = 'fixed'
        dropdown.style.top = `${rect.top + 8}px`
        dropdown.style.right = `${window.innerWidth - rect.right + 8}px`
        dropdown.style.display = 'block'
      }

      // Handle language change
      select.addEventListener('change', () => {
        if (currentPos === null) return

        const node = editorView.state.doc.nodeAt(currentPos)
        if (node && node.type.name === 'code_block') {
          const tr = editorView.state.tr.setNodeMarkup(currentPos, undefined, {
            ...node.attrs,
            language: select.value
          })
          editorView.dispatch(tr)
        }
      })

      // Keep dropdown open while interacting
      let isInteracting = false
      select.addEventListener('mousedown', () => { isInteracting = true })
      select.addEventListener('change', () => { isInteracting = false })
      select.addEventListener('blur', () => {
        isInteracting = false
        dropdown.style.display = 'none'
        currentPre = null
      })

      // Show dropdown on hover
      const handleMouseOver = (e: Event) => {
        if (isInteracting) return

        const target = e.target as HTMLElement
        const pre = target.closest('pre') as HTMLElement | null

        if (pre && pre !== currentPre) {
          const positions = findCodeBlockPositions()
          const pos = positions.get(pre)

          if (pos !== undefined) {
            const node = editorView.state.doc.nodeAt(pos)
            if (node) {
              currentPos = pos
              currentPre = pre
              select.value = node.attrs.language || ''
              positionDropdown(pre)
            }
          }
        }
      }

      const handleMouseOut = (e: Event) => {
        if (isInteracting) return

        const target = e.target as HTMLElement
        const relatedTarget = (e as MouseEvent).relatedTarget as HTMLElement | null

        // Check if we're leaving the pre element
        const pre = target.closest('pre')
        if (pre && relatedTarget && !pre.contains(relatedTarget) && !dropdown.contains(relatedTarget)) {
          dropdown.style.display = 'none'
          currentPre = null
        }
      }

      // Keep visible when hovering the dropdown itself
      dropdown.addEventListener('mouseenter', () => { isInteracting = true })
      dropdown.addEventListener('mouseleave', () => {
        if (!select.matches(':focus')) {
          isInteracting = false
          dropdown.style.display = 'none'
          currentPre = null
        }
      })

      editorView.dom.addEventListener('mouseover', handleMouseOver)
      editorView.dom.addEventListener('mouseout', handleMouseOut)

      return {
        update() {
          if (currentPos !== null && currentPre !== null && dropdown.style.display !== 'none') {
            const positions = findCodeBlockPositions()
            const newPos = positions.get(currentPre)
            if (newPos !== undefined) {
              currentPos = newPos
              const node = editorView.state.doc.nodeAt(currentPos)
              if (node && node.type.name === 'code_block') {
                const lang = node.attrs.language || ''
                if (select.value !== lang) {
                  select.value = lang
                }
              }
              positionDropdown(currentPre)
            }
          }
        },
        destroy() {
          editorView.dom.removeEventListener('mouseover', handleMouseOver)
          editorView.dom.removeEventListener('mouseout', handleMouseOut)
          dropdown.remove()
        }
      }
    }
  })
})

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
      .use(prism)
      .use(exitCodeBlockPlugin)
      .use(trailingParagraphPlugin)
      .use(codeBlockLanguagePlugin)

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
