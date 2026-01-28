export interface Note {
  filename: string
  path: string
  content: string
  lastModified: number
}

export interface AppSettings {
  notesDirectory: string | null
  lastOpenedNote: string | null
}
