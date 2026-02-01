import { useRef, useEffect } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { nord } from '@milkdown/theme-nord'
import { replaceAll, $prose } from '@milkdown/utils'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { prism } from '@milkdown/plugin-prism'
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import type { EditorView, NodeView } from '@milkdown/prose/view'

import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { DragDropEvent } from '@tauri-apps/api/webview'
import { join } from '@tauri-apps/api/path'
import { readFile } from '@tauri-apps/plugin-fs'

import { importImageToMedia } from '../utils/fileSystem'

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
  notesDirectory: string | null
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

function isRemoteUrl(src: string): boolean {
  return /^(https?:)?\/\//.test(src)
}

function isAbsoluteFilePath(src: string): boolean {
  // Windows drive, or Unix absolute
  return /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/')
}

function isRelativeImageSrc(src: string): boolean {
  if (!src) return false
  if (src.startsWith('data:') || src.startsWith('blob:')) return false
  if (isRemoteUrl(src)) return false
  if (isAbsoluteFilePath(src)) return false
  return true
}

function mimeFromPath(path: string): string {
  const clean = path.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : ''

  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

const imageSrcResolverPlugin = (getNotesDirectory: () => string | null) =>
  $prose(() => {
    return new Plugin({
      key: new PluginKey('image-src-resolver'),
      props: {
        nodeViews: {
          image(node): NodeView {
            const img = document.createElement('img')
            img.draggable = false

            let currentSrc: string | null = null
            let currentObjectUrl: string | null = null
            let loadToken = 0

            const cleanupObjectUrl = () => {
              if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl)
                currentObjectUrl = null
              }
            }

            const setSrc = async (src: string) => {
              if (src === currentSrc) return
              currentSrc = src
              const token = ++loadToken

              cleanupObjectUrl()

              // Remote/data/blob URLs work as-is
              if (!src || src.startsWith('data:') || src.startsWith('blob:') || isRemoteUrl(src)) {
                if (src) img.src = src
                return
              }

              // Resolve to absolute filesystem path
              let absPath: string | null = null

              if (isRelativeImageSrc(src)) {
                const notesDir = getNotesDirectory()
                if (!notesDir) {
                  img.src = src
                  return
                }

                const normalized = src.startsWith('./') ? src.slice(2) : src
                absPath = await join(notesDir, normalized)
              } else if (isAbsoluteFilePath(src)) {
                absPath = src
              } else {
                // Unknown scheme; best effort.
                img.src = src
                return
              }

              try {
                const bytes = await readFile(absPath)
                const blob = new Blob([bytes], { type: mimeFromPath(absPath) })
                const url = URL.createObjectURL(blob)

                // If src changed while we were loading, discard.
                if (token !== loadToken) {
                  URL.revokeObjectURL(url)
                  return
                }

                currentObjectUrl = url
                img.src = url
              } catch (err) {
                console.error('Failed to load image for preview:', err)
                img.src = src
              }
            }

            img.alt = (node.attrs.alt as string | undefined) ?? ''
            if (typeof node.attrs.title === 'string') {
              img.title = node.attrs.title
            }
            void setSrc((node.attrs.src as string | undefined) ?? '')

            return {
              dom: img,
              update(updatedNode) {
                if (updatedNode.type !== node.type) return false

                img.alt = (updatedNode.attrs.alt as string | undefined) ?? ''
                if (typeof updatedNode.attrs.title === 'string') {
                  img.title = updatedNode.attrs.title
                }
                void setSrc((updatedNode.attrs.src as string | undefined) ?? '')
                return true
              },
              destroy() {
                cleanupObjectUrl()
              }
            }
          },
        }
      }
    })
  })

export function MilkdownEditor({ content, onChange, notesDirectory, disabled }: MilkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null)
  const isUpdatingRef = useRef(false)
  const lastContentRef = useRef(content)
  const notesDirectoryRef = useRef<string | null>(notesDirectory)

  // Note: we intentionally only create/destroy the editor when `disabled` flips.
  // Content changes are applied via `replaceAll` below.
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
      .use(imageSrcResolverPlugin(() => notesDirectoryRef.current))

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  // Keep latest notes directory for image resolution + drag/drop.
  useEffect(() => {
    notesDirectoryRef.current = notesDirectory
  }, [notesDirectory])

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

  useEffect(() => {
    if (disabled) return

    // Prevent the webview default drop behavior (e.g. opening the file).
    const el = editorRef.current
    if (!el) return

    const prevent = (e: DragEvent) => {
      e.preventDefault()
    }

    el.addEventListener('dragover', prevent)
    el.addEventListener('drop', prevent)

    return () => {
      el.removeEventListener('dragover', prevent)
      el.removeEventListener('drop', prevent)
    }
  }, [disabled])

  useEffect(() => {
    if (disabled) return

    let unlisten: (() => void) | null = null

    const insertImageAtCursor = (view: EditorView, src: string, alt: string) => {
      const imageType = view.state.schema.nodes.image
      if (!imageType) {
        // Fallback: insert markdown text
        view.dispatch(view.state.tr.insertText(`![](${src})`).scrollIntoView())
        return
      }

      const imageNode = imageType.create({ src, alt, title: '' })
      let tr = view.state.tr.replaceSelectionWith(imageNode)

      const paragraphType = view.state.schema.nodes.paragraph
      if (paragraphType) {
        tr = tr.insert(tr.selection.to, paragraphType.create())
      }

      view.dispatch(tr.scrollIntoView())
    }

    async function start() {
      try {
        const webview = getCurrentWebview()
        unlisten = await webview.onDragDropEvent(async (event) => {
          const payload = event.payload as DragDropEvent
          if (payload.type !== 'drop') return

          const notesDir = notesDirectoryRef.current
          const editorInstance = editorInstanceRef.current
          if (!notesDir || !editorInstance) return

          const imported = [] as { relativePath: string; alt: string }[]

          for (const path of payload.paths) {
            try {
              const media = await importImageToMedia(notesDir, path)
              imported.push({ relativePath: media.relativePath, alt: media.filename })
            } catch (err) {
              console.error('Failed to import dropped image:', err)
            }
          }

          if (imported.length === 0) return

          editorInstance.action((ctx) => {
            const view = ctx.get(editorViewCtx) as EditorView
            view.focus()
            for (const img of imported) {
              insertImageAtCursor(view, img.relativePath, img.alt)
            }
          })
        })
      } catch (err) {
        // Likely not running inside Tauri (e.g. web preview). Ignore.
        console.warn('Drag-drop events unavailable:', err)
      }
    }

    start()

    return () => {
      void unlisten?.()
    }
  }, [disabled])

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
