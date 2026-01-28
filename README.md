# Brain Pad

A local-first markdown note-taking desktop app. Your notes are stored as plain `.md` files on your filesystem — no cloud, no database, fully offline.

## Features

- **Local-first storage** — Notes are plain `.md` files you own and control
- **Live markdown preview** — See your formatted text as you type
- **Auto-save** — Changes are automatically saved after 500ms of inactivity
- **Keyboard shortcuts** — `Cmd/Ctrl + N` for new note, `Cmd/Ctrl + S` for manual save
- **Dark theme** — Easy on the eyes
- **Context menu** — Right-click notes to rename or delete
- **Folder selection** — Choose any folder on your system to store notes
- **Cross-platform** — Works on macOS, Windows, and Linux

## Planned Features

- **AI integration** — Chat with your files and folders using AI
- **Inline markdown preview** — Better editing experience with live inline formatting
- **Code syntax highlighting** — Improved code block rendering with syntax colors
- **Mobile app** — Native iOS and Android versions

## Installation

### Option 1: Download Pre-built App (Easiest)

| Platform | Download |
|----------|----------|
| **macOS (Apple Silicon)** | [Brain Pad_0.1.0_aarch64.dmg](https://github.com/dennisivy/BrainPad/releases/download/v0.1.0/Brain.Pad_0.1.0_aarch64.dmg) |
| **macOS (Intel)** | [Brain Pad_0.1.0_x64.dmg](https://github.com/dennisivy/BrainPad/releases/download/v0.1.0/Brain.Pad_0.1.0_x64.dmg) |
| **Windows** | Coming soon |
| **Linux** | Coming soon |

Or browse all releases: [Releases Page](https://github.com/dennisivy/BrainPad/releases)

#### macOS Installation

1. Download the `.dmg` file from the link above
2. Double-click the `.dmg` file to open it
3. Drag the **Brain Pad** app to your **Applications** folder
4. Open Brain Pad from Applications (you may need to right-click → Open the first time due to macOS security)

#### Windows Installation

1. Download the `.msi` installer from the releases page
2. Double-click the installer and follow the prompts
3. Launch Brain Pad from the Start menu

#### Linux Installation

1. Download the `.AppImage` or `.deb` file from the releases page
2. For AppImage: Make it executable (`chmod +x`) and run it
3. For .deb: Install with `sudo dpkg -i Brain_Pad_x.x.x_amd64.deb`

---

### Option 2: Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform

#### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/dennisivy/BrainPad.git
   cd Brain-Pad
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode (for testing):
   ```bash
   npm run tauri dev
   ```

4. Build the production app:
   ```bash
   npm run tauri build
   ```

5. Find your built app:
   - **macOS**: `src-tauri/target/release/bundle/dmg/Brain Pad_0.1.0_aarch64.dmg`
   - **Windows**: `src-tauri/target/release/bundle/msi/`
   - **Linux**: `src-tauri/target/release/bundle/appimage/` or `deb/`

## Usage

1. **First launch**: Select a folder where you want to store your notes
2. **Create a note**: Click the `+` button or press `Cmd/Ctrl + N`
3. **Edit**: Type in the left panel, see the preview on the right
4. **Save**: Notes auto-save, or press `Cmd/Ctrl + S` to save immediately
5. **Manage notes**: Right-click any note in the sidebar to rename or delete

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Desktop Shell**: Tauri 2
- **Markdown Rendering**: react-markdown

## Project Structure

```
brain-pad/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Tauri API utilities
│   └── App.tsx             # Main app component
├── src-tauri/              # Tauri backend
│   ├── src/                # Rust source
│   ├── capabilities/       # Permission configuration
│   └── tauri.conf.json     # Tauri configuration
└── package.json
```

## License

MIT
