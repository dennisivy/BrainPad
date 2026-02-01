# Image click-to-reveal markdown + paste-to-image (cleanup drag/drop code)

## Problem statement
Users want to click an image in the editor to reveal its markdown syntax (for copy/paste), and when that markdown is pasted back into the editor it should render as an image. We also want to remove leftover/abandoned drag/drop “reordering” experiments so we don’t keep dead code.

## Current state
- Dragging an image file into an open note copies it into `<notesDirectory>/media/` and inserts an image node.
- Local images are rendered via `readFile(...) -> Blob -> URL.createObjectURL(...)` in the image node view.
- Drag/drop reordering attempts introduced custom drag/drop code inside `src/components/MilkdownEditor.tsx`.

## Decisions (confirmed)
- The revealed markdown should match what the file contains (plain markdown image syntax).
- Copy should be easy (auto-select and/or copy button).
- Pasting that syntax back should render as an image.

## Proposed changes

### 1) Cleanup drag/drop reordering code
In `src/components/MilkdownEditor.tsx`:
- Remove custom internal drag/drop handling for reordering.
- Keep only OS-file-drop prevention (so the webview doesn’t try to open dropped files) and the existing Tauri `onDragDropEvent` import flow.

### 2) Click image to reveal markdown syntax
Extend the existing image node view so clicking an image:
- Opens a small popover near the image (similar to the existing code-block language picker UI).
- Shows the exact markdown string: `![alt](src)` or `![alt](src "title")`.
- Auto-selects the text and provides a “Copy” button.
- Dismisses on Escape or click outside.

### 3) Paste handler: markdown image syntax -> image node(s)
Add a ProseMirror plugin (in `MilkdownEditor.tsx`) with `handlePaste` that:
- Reads pasted plain text.
- Detects one or multiple markdown image patterns.
- Replaces the selection with image node(s) (and optional trailing space/paragraph) rather than plain text.

This ensures copy/paste works even though input rules do not reliably run on paste.

### 4) Styling
Add minimal styles in `src/index.css` for the popover (dark theme, small input, copy button).

## Verification
- Drag-drop an image file into a note (existing behavior should still work).
- Click the rendered image → popover shows markdown and copies.
- Paste the copied markdown back into the editor → it renders as an image.
- Confirm no extra drag/drop reordering code remains.

---

# Copy→Paste to reposition image (auto-delete original)

## Problem statement
When repositioning an image inside a note, users currently have to copy/paste the image markdown and then manually delete the original image. We want a smoother flow: click **Copy** on an image → show a toast “Image copied, paste to reposition” → when the user pastes, the image is inserted at the cursor and the original image node is deleted automatically.

## Current state
- Images are inserted as Milkdown/ProseMirror `image` nodes and stored as markdown `![alt](src "title")`.
- There is already an image click popover with a **Copy** button and a paste handler that converts pasted markdown image syntax into image nodes.

## Proposed changes

### 1) Track a “pending move” after Copy
When the user clicks **Copy** on an image:
- Write the image markdown to clipboard (current behavior).
- Record a `pendingMove` object in the editor plugin state:
  - `noteKey` (the active note path) so we only auto-delete when pasting into the same note.
  - `pos` (the image node position via `getPos()` from the node view).
  - `attrs` (`src`, `alt`, `title`) and `markdown`.
- Show a non-blocking toast: “Image copied — paste to reposition (Esc to cancel)”.
- If the user copies another image, overwrite `pendingMove`.
- Allow cancel by pressing Escape (clears `pendingMove`).

### 2) On paste, “move” instead of “duplicate” when it matches pendingMove
In the existing `handlePaste`:
- Parse pasted plain text. If it’s exactly one image markdown and matches `pendingMove.markdown` (or matching attrs), and `noteKey` matches:
  - Compute insertion position from the current selection.
  - Delete the original image node at `pendingMove.pos` (only if it still exists and matches attrs; otherwise clear pendingMove and fall back to normal paste behavior).
  - Insert the image node at the cursor.
  - Clear `pendingMove`.
  - Show toast: “Image moved”.
- If paste doesn’t match `pendingMove`, behave as today (convert markdown → image node(s), no deletion).

### 3) Keep OS file drop behavior intact
Continue preventing ProseMirror from handling OS file drops (to avoid the webview trying to open dropped files). Tauri `onDragDropEvent` continues to import images into `media/`.

### 4) Implementation notes
- Update the image node view signature to `image(node, view, getPos)` so we can store the correct node position on Copy.
- Store `pendingMove` in plugin state and map `pos` through transactions using `tr.mapping` so it remains valid across edits.
- If `pendingMove.pos` becomes invalid (node deleted/changed), automatically clear `pendingMove`.

## UX
- Toast appears after Copy.
- Escape cancels the pending move.
- Pasting anywhere in the same note performs the move.
- Pasting into another note will not delete the original.

## Verification
- Drag-drop an image into a note (still works).
- Click image → Copy → toast appears.
- Paste elsewhere in the same note → image appears at cursor and original disappears.
- Paste into a different note → image is inserted, original remains.
- Copy an image, then delete it, then paste → paste inserts image but no deletion occurs (and pendingMove clears).
