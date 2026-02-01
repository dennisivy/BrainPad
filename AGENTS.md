# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository overview
Brain Pad is a local-first markdown note-taking desktop app:
- Frontend: React + TypeScript + Vite.
- Desktop shell: Tauri 2.
- Notes: plain `.md` files stored in a user-selected folder.
- App settings: stored via `@tauri-apps/plugin-store` (see `src/utils/fileSystem.ts`).

## Common commands

### Install
```bash
npm install
```
(There is a `package-lock.json`, so `npm ci` also works for clean installs.)

### Run (web)
Runs the Vite dev server at `http://127.0.0.1:5173` (see `vite.config.ts`).
```bash
npm run dev
```

### Run (desktop / Tauri)
Starts the desktop app in dev mode. This will run Vite automatically via Tauri’s `beforeDevCommand` (`src-tauri/tauri.conf.json`).
```bash
npm run tauri dev
```

### Build
Builds the frontend to `dist/` (TypeScript project build + Vite build).
```bash
npm run build
```

Builds the production desktop bundle.
```bash
npm run tauri build
```

### Preview a production build (web)
```bash
npm run preview
```

### Build outputs (desktop)
Tauri bundles are emitted under `src-tauri/target/release/bundle/` (platform-specific subfolders like `dmg/`, `msi/`, `appimage/`, `deb/`).

### Lint
```bash
npm run lint
```

### Tests
There is no JavaScript/TypeScript test runner configured in `package.json`.
If you add a test runner later, document its commands here.

Rust-side (from `src-tauri/`):
```bash
cd src-tauri
cargo test
# run a single Rust test by name
cargo test <test_name>
```

## High-level architecture

### Frontend (React)
- App entry: `src/main.tsx` mounts `App`.
- Top-level orchestration: `src/App.tsx`
  - Loads persisted settings on startup (`loadSettings`) and stores:
    - `notesDirectory` (where `.md` files live)
    - `lastOpenedNote` (re-open after launch)
  - Handles global keyboard shortcuts:
    - `Cmd/Ctrl+N` → new note modal
    - `Cmd/Ctrl+S` → manual save
  - Renders the main layout: `Sidebar` + `MilkdownEditor` + modals.

#### State + data flow
- Note model: `src/types.ts` (`Note`, `AppSettings`).
- Notes state machine: `src/hooks/useNotes.ts`
  - `loadNotes()` uses `scanNotesFolder()` to list `.md` files.
  - `selectNote(path)` reads file contents and sets `activeNote`.
  - `createNote/renameNote/deleteNote` call filesystem helpers and update in-memory state.
  - Persists the “last opened note” via `saveSettings({ lastOpenedNote })`.
- Autosave: `src/hooks/useAutoSave.ts`
  - Debounced (default 500ms) `saveNote(filePath, content)`.
  - Skips saves when switching notes by tracking the last file path/content.

#### Editing experience
- Primary editor: `src/components/MilkdownEditor.tsx`
  - Milkdown-based markdown editor with CommonMark + GFM presets.
  - Prism highlighting enabled.
  - Contains custom ProseMirror plugins:
    - Code block language picker UI on hover.
    - “Exit code block” behaviors (Mod+Enter / Enter at end).
    - Ensures a trailing paragraph at the end of the document.
  - Parent → editor updates happen via `replaceAll(content)` when switching notes.
  - Editor → parent updates happen via `listenerCtx.markdownUpdated`.

### Platform / filesystem integration (Tauri plugins)
- All filesystem + dialog + settings store logic lives in `src/utils/fileSystem.ts`.
  - Folder selection: `@tauri-apps/plugin-dialog`.
  - File operations: `@tauri-apps/plugin-fs` (`readDir`, `readTextFile`, `writeTextFile`, `rename`, `remove`, `exists`).
  - Settings persistence: `@tauri-apps/plugin-store` (`settings.json`).

If you add new OS-level capabilities (new plugins, new file locations, etc.), update:
- `src-tauri/src/lib.rs` (plugin initialization)
- `src-tauri/capabilities/default.json` (permissions)

### Tauri (Rust)
- Entry point: `src-tauri/src/main.rs` calls `brain_pad_lib::run()`.
- App setup: `src-tauri/src/lib.rs`
  - Initializes Tauri plugins (fs/dialog/store; log in debug builds).
  - No custom `#[tauri::command]` APIs are currently exposed; the frontend interacts via Tauri plugins.
- Tauri config: `src-tauri/tauri.conf.json`
  - `frontendDist`: `dist/`
  - `devUrl`: `http://localhost:5173`
  - `beforeDevCommand`: `npm run dev`
  - `beforeBuildCommand`: `npm run build`
