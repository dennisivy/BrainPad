import { open } from '@tauri-apps/plugin-dialog'
import { readDir, readTextFile, writeTextFile, exists, rename, remove, copyFile, mkdir } from '@tauri-apps/plugin-fs'
import { Store } from '@tauri-apps/plugin-store'
import { join } from '@tauri-apps/api/path'
import type { Note, AppSettings } from '../types'

const SETTINGS_FILE = 'settings.json'
let store: Store | null = null

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

function basenameFromPath(path: string): string {
  // Normalize Windows paths coming from drag/drop
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

function splitNameAndExt(filename: string): { name: string; ext: string } {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return { name: filename, ext: '' }
  }
  return {
    name: filename.slice(0, lastDot),
    ext: filename.slice(lastDot + 1).toLowerCase(),
  }
}

function sanitizeFilename(name: string): string {
  const sanitized = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')

  return sanitized.length > 0 ? sanitized : 'image'
}

export interface ImportedMedia {
  filename: string
  relativePath: string
  absolutePath: string
}

export async function importImageToMedia(notesDirectory: string, sourcePath: string): Promise<ImportedMedia> {
  const mediaDir = await join(notesDirectory, 'media')
  await mkdir(mediaDir, { recursive: true })

  const original = basenameFromPath(sourcePath)
  const { name, ext } = splitNameAndExt(original)

  if (!ext || !IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported image type: ${ext || 'unknown'}`)
  }

  const safeBase = sanitizeFilename(name)

  let i = 0
  // Ensure we don't overwrite an existing file
  while (true) {
    const candidate = i === 0 ? `${safeBase}.${ext}` : `${safeBase}-${i}.${ext}`
    const destPath = await join(mediaDir, candidate)

    if (!(await exists(destPath))) {
      await copyFile(sourcePath, destPath)
      return {
        filename: candidate,
        relativePath: `media/${candidate}`,
        absolutePath: destPath,
      }
    }

    i++
  }
}

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(SETTINGS_FILE)
  }
  return store
}

export async function selectFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Notes Folder',
  })
  return selected as string | null
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = await getStore()
    const notesDirectory = await s.get<string>('notesDirectory')
    const lastOpenedNote = await s.get<string>('lastOpenedNote')
    return {
      notesDirectory: notesDirectory ?? null,
      lastOpenedNote: lastOpenedNote ?? null,
    }
  } catch {
    return {
      notesDirectory: null,
      lastOpenedNote: null,
    }
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const s = await getStore()
  if (settings.notesDirectory !== undefined) {
    await s.set('notesDirectory', settings.notesDirectory)
  }
  if (settings.lastOpenedNote !== undefined) {
    await s.set('lastOpenedNote', settings.lastOpenedNote)
  }
  await s.save()
}

export async function scanNotesFolder(directory: string): Promise<Note[]> {
  try {
    const entries = await readDir(directory)
    const notes: Note[] = []

    for (const entry of entries) {
      if (entry.name && entry.name.endsWith('.md')) {
        const path = await join(directory, entry.name)
        notes.push({
          filename: entry.name,
          path,
          content: '',
          lastModified: Date.now(),
        })
      }
    }

    return notes.sort((a, b) => a.filename.localeCompare(b.filename))
  } catch (error) {
    console.error('Failed to scan notes folder:', error)
    return []
  }
}

export async function readNoteContent(path: string): Promise<string> {
  try {
    return await readTextFile(path)
  } catch (error) {
    console.error('Failed to read note:', error)
    throw error
  }
}

export async function saveNote(path: string, content: string): Promise<void> {
  try {
    await writeTextFile(path, content)
  } catch (error) {
    console.error('Failed to save note:', error)
    throw error
  }
}

export async function createNote(directory: string, filename: string): Promise<Note> {
  let name = filename.trim()
  if (!name.endsWith('.md')) {
    name += '.md'
  }

  const path = await join(directory, name)
  await writeTextFile(path, '')

  return {
    filename: name,
    path,
    content: '',
    lastModified: Date.now(),
  }
}

export async function renameNote(oldPath: string, directory: string, newFilename: string): Promise<Note> {
  let name = newFilename.trim()
  if (!name.endsWith('.md')) {
    name += '.md'
  }

  const newPath = await join(directory, name)
  await rename(oldPath, newPath)

  return {
    filename: name,
    path: newPath,
    content: '',
    lastModified: Date.now(),
  }
}

export async function deleteNote(path: string): Promise<void> {
  await remove(path)
}

export async function noteExists(path: string): Promise<boolean> {
  try {
    return await exists(path)
  } catch {
    return false
  }
}
