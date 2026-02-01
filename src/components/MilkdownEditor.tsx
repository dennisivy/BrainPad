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
import { Fragment, Slice } from '@milkdown/prose/model'

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
  notePath: string | null
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

type PendingMove = {
  notePath: string
  pos: number
  attrs: { src: string; alt: string; title: string }
  markdown: string
}

type ImageEnhancementsMeta =
  | { type: 'setPendingMove'; pendingMove: PendingMove }
  | { type: 'clearPendingMove' }

const imageEnhancementsKey = new PluginKey<PendingMove | null>('image-enhancements')

const imageSrcResolverPlugin = (getNotesDirectory: () => string | null, getNotePath: () => string | null) =>
  $prose(() => {
    const isFileDrop = (e: DragEvent) => {
      const dt = e.dataTransfer
      if (!dt) return false
      if (dt.files && dt.files.length > 0) return true
      if (dt.items) {
        for (const item of Array.from(dt.items)) {
          if (item.kind === 'file') return true
        }
      }
      return false
    }

    const buildImageMarkdown = (attrs: { src?: string; alt?: string; title?: string }) => {
      const src = attrs.src ?? ''
      const alt = attrs.alt ?? ''
      const title = attrs.title ?? ''

      if (title) {
        return `![${alt}](${src} "${title}")`
      }

      return `![${alt}](${src})`
    }

    const parseImagesFromText = (text: string) => {
      // Minimal markdown image syntax parser for our copy/paste use-case.
      // Matches: ![alt](src) and ![alt](src "title")
      const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g
      const matches: Array<{ alt: string; src: string; title: string }> = []

      for (const m of text.matchAll(re)) {
        matches.push({
          alt: m[1] ?? '',
          src: m[2] ?? '',
          title: m[3] ?? '',
        })
      }

      // Only convert when the pasted content is *just* image markdown + whitespace.
      const remainder = text.replace(re, '').trim()
      if (matches.length === 0 || remainder.length > 0) return null

      return matches
    }

    let toastFadeTimer: number | null = null
    let toastRemoveTimer: number | null = null

    const showToast = (message: string, durationMs = 2200) => {
      let toast = document.querySelector<HTMLDivElement>('.image-toast')
      if (!toast) {
        toast = document.createElement('div')
        toast.className = 'image-toast'
        document.body.appendChild(toast)
      }

      if (toastFadeTimer) window.clearTimeout(toastFadeTimer)
      if (toastRemoveTimer) window.clearTimeout(toastRemoveTimer)

      toast.textContent = message
      toast.style.opacity = '1'

      toastFadeTimer = window.setTimeout(() => {
        toast.style.opacity = '0'
      }, Math.max(0, durationMs - 250))

      toastRemoveTimer = window.setTimeout(() => {
        toast.remove()
      }, durationMs)
    }

    // Popover state (single popover for the whole editor instance)
    let popover: HTMLDivElement | null = null
    let popoverCleanup: (() => void) | null = null

    const closePopover = () => {
      popoverCleanup?.()
      popoverCleanup = null
      popover?.remove()
      popover = null
    }

    const openPopover = (rect: DOMRect, markdown: string, onCopyRequested: (input: HTMLInputElement) => void) => {
      closePopover()

      const wrapper = document.createElement('div')
      wrapper.className = 'image-markdown-popover'
      wrapper.style.position = 'fixed'
      wrapper.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`
      wrapper.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 120)}px`

      const input = document.createElement('input')
      input.type = 'text'
      input.readOnly = true
      input.value = markdown
      input.className = 'image-markdown-input'

      const actions = document.createElement('div')
      actions.className = 'image-markdown-actions'

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.textContent = 'Copy'
      copyBtn.className = 'image-markdown-copy'

      actions.appendChild(copyBtn)
      wrapper.appendChild(input)
      wrapper.appendChild(actions)
      document.body.appendChild(wrapper)

      // Auto-select for easy copy
      setTimeout(() => {
        input.focus()
        input.select()
      }, 0)

      const onDocMouseDown = (e: MouseEvent) => {
        const target = e.target as Node | null
        if (!target) return
        if (wrapper.contains(target)) return
        closePopover()
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closePopover()
      }

      const onCopy = () => {
        onCopyRequested(input)
      }

      copyBtn.addEventListener('click', onCopy)
      document.addEventListener('mousedown', onDocMouseDown)
      window.addEventListener('keydown', onKeyDown)

      popover = wrapper
      popoverCleanup = () => {
        copyBtn.removeEventListener('click', onCopy)
        document.removeEventListener('mousedown', onDocMouseDown)
        window.removeEventListener('keydown', onKeyDown)
      }
    }

    return new Plugin({
      key: imageEnhancementsKey,
      state: {
        init(): PendingMove | null {
          return null
        },
        apply(tr, prev: PendingMove | null, _oldState, newState): PendingMove | null {
          const meta = tr.getMeta(imageEnhancementsKey) as ImageEnhancementsMeta | undefined
          if (meta?.type === 'setPendingMove') return meta.pendingMove
          if (meta?.type === 'clearPendingMove') return null

          if (!prev) return null

          // Map position through document changes.
          if (tr.docChanged) {
            const mapped = tr.mapping.mapResult(prev.pos)
            if (mapped.deleted) return null

            const node = newState.doc.nodeAt(mapped.pos)
            if (!node || node.type.name !== 'image') return null

            const attrs = node.attrs as { src?: string; alt?: string; title?: string }
            if ((attrs.src ?? '') !== prev.attrs.src) return null
            if ((attrs.alt ?? '') !== prev.attrs.alt) return null
            if ((attrs.title ?? '') !== prev.attrs.title) return null

            return { ...prev, pos: mapped.pos }
          }

          return prev
        },
      },
      props: {
        handleDOMEvents: {
          // Block ProseMirror + webview default handling for OS file drops.
          // Tauri will emit `onDragDropEvent` which we handle separately.
          dragover(_view, event) {
            const e = event as DragEvent
            if (isFileDrop(e)) {
              e.preventDefault()
            }
            return false
          },
          drop(_view, event) {
            const e = event as DragEvent
            if (isFileDrop(e)) {
              e.preventDefault()
              return true
            }
            return false
          },
        },
        handleKeyDown(view, event) {
          if (event.key !== 'Escape') return false

          const pending = imageEnhancementsKey.getState(view.state)
          if (!pending) return false

          view.dispatch(view.state.tr.setMeta(imageEnhancementsKey, { type: 'clearPendingMove' } satisfies ImageEnhancementsMeta))
          showToast('Canceled image move')
          return true
        },
        handlePaste(view, event) {
          // Don’t transform paste inside code blocks.
          if (view.state.selection.$from.parent.type.name === 'code_block') return false

          const text = event.clipboardData?.getData('text/plain')
          if (!text) return false

          const images = parseImagesFromText(text)
          if (!images) return false

          const imageType = view.state.schema.nodes.image
          if (!imageType) return false

          const pending = imageEnhancementsKey.getState(view.state)
          const notePath = getNotePath()

          // If user just copied an image and pastes the exact same markdown in the same note,
          // treat this as a move (delete original, insert at cursor).
          if (
            pending &&
            notePath &&
            pending.notePath === notePath &&
            images.length === 1 &&
            pending.markdown === buildImageMarkdown(images[0])
          ) {
            const { from, to } = view.state.selection
            const nodeAtPos = view.state.doc.nodeAt(pending.pos)

            if (nodeAtPos && nodeAtPos.type.name === 'image') {
              let tr = view.state.tr

              // Delete original image
              tr = tr.delete(pending.pos, pending.pos + nodeAtPos.nodeSize)

              // Insert at current selection (mapped after deletion)
              const mappedFrom = tr.mapping.map(from)
              const mappedTo = tr.mapping.map(to)
              const newNode = imageType.create({
                src: images[0].src,
                alt: images[0].alt,
                title: images[0].title,
              })

              tr = tr.replaceRangeWith(mappedFrom, mappedTo, newNode)
              tr = tr.setMeta(imageEnhancementsKey, { type: 'clearPendingMove' } satisfies ImageEnhancementsMeta)

              view.dispatch(tr.scrollIntoView().setMeta('uiEvent', 'paste'))
              event.preventDefault()
              showToast('Image moved')
              return true
            }

            // If original no longer exists, clear pending move and fall back to normal paste behavior.
            view.dispatch(view.state.tr.setMeta(imageEnhancementsKey, { type: 'clearPendingMove' } satisfies ImageEnhancementsMeta))
          }

          const nodes = images.flatMap((img, idx) => {
            const node = imageType.create({ src: img.src, alt: img.alt, title: img.title })
            const spacer = idx === images.length - 1 ? [] : [view.state.schema.text(' ')]
            return [node, ...spacer]
          })

          const slice = new Slice(Fragment.fromArray(nodes), 0, 0)
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView().setMeta('uiEvent', 'paste'))
          event.preventDefault()
          return true
        },
        nodeViews: {
          image(node, view, getPos): NodeView {
            const img = document.createElement('img')
            img.dataset.brainpadImage = '1'
            img.draggable = false
            img.style.cursor = 'pointer'

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
                img.src = src
                return
              }

              try {
                const bytes = await readFile(absPath)
                const blob = new Blob([bytes], { type: mimeFromPath(absPath) })
                const url = URL.createObjectURL(blob)

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

            let currentAttrs = {
              src: (node.attrs.src as string | undefined) ?? '',
              alt: (node.attrs.alt as string | undefined) ?? '',
              title: (node.attrs.title as string | undefined) ?? '',
            }

            const onClick = (e: MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()

              const markdown = buildImageMarkdown(currentAttrs)

              const onCopyRequested = async (input: HTMLInputElement) => {
                try {
                  await navigator.clipboard.writeText(markdown)
                } catch {
                  input.focus()
                  input.select()
                  try {
                    document.execCommand('copy')
                  } catch {
                    // ignore
                  }
                }

                const pos = typeof getPos === 'function' ? getPos() : null
                const notePath = getNotePath()
                if (typeof pos === 'number' && notePath) {
                  view.dispatch(
                    view.state.tr.setMeta(imageEnhancementsKey, {
                      type: 'setPendingMove',
                      pendingMove: {
                        notePath,
                        pos,
                        attrs: currentAttrs,
                        markdown,
                      },
                    } satisfies ImageEnhancementsMeta)
                  )

                  showToast('Image copied — paste to reposition (Esc to cancel)', 2600)
                } else {
                  showToast('Image copied')
                }
              }

              openPopover(img.getBoundingClientRect(), markdown, onCopyRequested)
            }

            img.addEventListener('click', onClick)

            img.alt = (node.attrs.alt as string | undefined) ?? ''
            if (typeof node.attrs.title === 'string') {
              img.title = node.attrs.title
            }
            void setSrc((node.attrs.src as string | undefined) ?? '')

            return {
              dom: img,
              update(updatedNode) {
                if (updatedNode.type !== node.type) return false

                // Close popover when image updates (prevents stale markdown)
                closePopover()

                currentAttrs = {
                  src: (updatedNode.attrs.src as string | undefined) ?? '',
                  alt: (updatedNode.attrs.alt as string | undefined) ?? '',
                  title: (updatedNode.attrs.title as string | undefined) ?? '',
                }

                img.alt = currentAttrs.alt
                img.title = currentAttrs.title
                void setSrc(currentAttrs.src)
                return true
              },
              destroy() {
                img.removeEventListener('click', onClick)
                cleanupObjectUrl()
                closePopover()
              }
            }
          },
        }
      }
    })
  })

export function MilkdownEditor({ content, onChange, notesDirectory, notePath, disabled }: MilkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstanceRef = useRef<Editor | null>(null)
  const isUpdatingRef = useRef(false)
  const lastContentRef = useRef(content)
  const notesDirectoryRef = useRef<string | null>(notesDirectory)
  const notePathRef = useRef<string | null>(notePath)

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
      .use(imageSrcResolverPlugin(
        () => notesDirectoryRef.current,
        () => notePathRef.current,
      ))

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

  // Keep latest notes directory + note path for image resolution and copy/paste move behavior.
  useEffect(() => {
    notesDirectoryRef.current = notesDirectory
    notePathRef.current = notePath
  }, [notesDirectory, notePath])

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
