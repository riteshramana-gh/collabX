# CollabBoard X — GoodNotes 5 Complete Feature Guide

**Document Version:** 1.0.0  
**Target Platform:** CollabBoard X (LAN Collaborative Whiteboard & Digital Notebook)

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Basic Editing Features](#2-basic-editing-features)
3. [Handwriting & Pen Engine](#3-handwriting--pen-engine)
4. [Eraser Suite](#4-eraser-suite)
5. [Highlighter Suite](#5-highlighter-suite)
6. [Typography & Text Engine](#6-typography--text-engine)
7. [Shapes & Geometric Recognition](#7-shapes--geometric-recognition)
8. [Images & Photos](#8-images--photos)
9. [Lasso Selection & Transformations](#9-lasso-selection--transformations)
10. [Multi-Page Notebook System](#10-multi-page-notebook-system)
11. [PDF Import, Annotation & Vector Export](#11-pdf-import-annotation--vector-export)
12. [Presentation Mode & Laser Pointer](#12-presentation-mode--laser-pointer)
13. [Precision Drafting Ruler](#13-precision-drafting-ruler)
14. [Elements & Sticker Collections](#14-elements--sticker-collections)
15. [Note-Synchronized Audio Recording](#15-note-synchronized-audio-recording)
16. [Keyboard Shortcuts Quick Reference](#16-keyboard-shortcuts-quick-reference)
17. [Workstation Organization, Permissions & Moderation](#17-workstation-organization-permissions--moderation)
18. [Mobile & Touchscreen Responsive Workstation Layout](#18-mobile--touchscreen-responsive-workstation-layout)

---

## 1. Overview & Philosophy

CollabBoard X brings the tactile, expressive, and structured digital notebook experience of GoodNotes 5 into a real-time, low-latency, LAN-based multi-user collaboration environment.

Every feature adheres to three fundamental engineering invariants:
1. **Server-Authoritative Consistency:** Every operation is validated, deduplicated, monotonically sequenced, and persisted in SQLite WAL storage before broadcast.
2. **Zero External Internet Dependencies:** Operates completely offline or on isolated LANs with zero-configuration peer discovery and P2P WebRTC voice meshes.
3. **Double-Buffered 60 FPS Canvas:** Utilizes high-DPI retina rendering with subpixel anti-aliasing and Catmull-Rom spline curve interpolation.

---

## 2. Basic Editing Features & Compound Undo/Redo Engine

CollabBoard X features an enterprise-grade transactional undo/redo architecture (`CanvasStore.ts`):

- **Compound Transaction Engine (`beginTransaction()` / `endTransaction()`)**:
  - Complex user gestures (such as continuous eraser swipes across multiple vector objects or multi-element deletions) are bundled into atomic transaction blocks (`undoStack: CanvasOperation[][]`).
  - Pressing `Ctrl+Z` reverses the **entire user stroke or action** in a single tap instead of requiring 50+ clicks for each coordinate slice.
- **Deep-Cloned Snapshot State**:
  - Vector element models, polyline points arrays, and property patches are deeply cloned (`deepClone<T>()`) before committing to history.
  - Eliminates shallow reference corruption where subsequent drawings or point updates could inadvertently mutate past history snapshots.
- **Compensating Network Reversals**:
  - Reversals generate compensating operations broadcast to the server, ensuring local rollbacks stay synchronized across all remote participants.
- **Undo (`Ctrl+Z` / `Cmd+Z`)**: Reverses the most recent compound gesture or atomic canvas mutation.
- **Redo (`Ctrl+Y` / `Cmd+Y` or `Ctrl+Shift+Z`)**: Reapplies the next compound operation from the redo stack.
- **Duplicate (`Ctrl+D` / `Cmd+D`)**: Creates an exact clone of the selected element with an automatic +20px offset.
- **Delete (`Delete` / `Backspace`)**: Removes selected elements in an atomic batch.
- **Select All (`Ctrl+A` / `Cmd+A`)**: Selects all non-locked elements residing on the active notebook page.
- **Infinite Pan & Zoom**:
  - Pan by holding `Space` or dragging with middle mouse button.
  - Smooth cursor-centered zoom from 10% to 500% via mouse wheel or the floating zoom controls.
  - Reset View button restores view to 100% zoom centered at $(0, 0)$.

---

## 3. Handwriting & Pen Engine

Click the **Pen Tool** or press `P`. Clicking the pen tool a second time opens the **Pen Style Selector**:

### 3.1 Pen Styles
- **Ballpoint Pen:** Produces a uniform, consistent stroke weight regardless of drawing speed or stylus pressure. Ideal for crisp note-taking, drafting, and diagrams.
- **Fountain Pen:** Varies stroke width dynamically based on writing speed and pointer pressure (`e.pressure`). As strokes accelerate or pressure increases, the ink subtly swells and tapers at the ends.
- **Brush Pen:** Highly expressive calligraphic inking where width scales sharply with velocity and pressure, creating artistic brush-stroke dynamics.

### 3.2 Colors & Thickness Presets
- 9 curated quick-access swatches: Black, Royal Blue, Crimson Red, Emerald Green, Amber, Violet, Pink, Slate, and White.
- Native HTML5 color picker allows choosing any arbitrary 24-bit RGB/HEX color.
- 5 stroke width presets: 1px (fine drafting), 2px (standard note writing), 4px (bold header), 8px (marker), and 16px (heavy marker).

---

## 4. Eraser Suite

Click the **Eraser Tool** or press `E`. Clicking the eraser icon a second time opens the **Eraser Options**:

### 4.1 Eraser Modes
- **Whole-Stroke Erasing (Default):** Touching any point on an inking stroke or shape instantly removes the entire element.
- **Partial-Stroke Erasing:** Segment-based vector trimming. Points within the eraser radius are excised, and the remaining contiguous point sequences are cleanly divided into independent sub-strokes with identical styling, completely eliminating phantom connector lines.

### 4.2 Erase Highlighter Only
When this toggle is enabled in the Eraser menu, the eraser selectively targets only elements of type `HIGHLIGHTER`. Ink handwriting, text boxes, and diagrams remain untouched, allowing you to wipe away highlight annotations without destroying notes.

---

## 5. Highlighter Suite

Click the **Highlighter Tool** or press `H`:
- **Translucent Highlighting:** Highlighters are rendered with an opacity of $38\%$ (`rgba(..., 0.38)`) and stack below or multiply into existing ink. Underlying text and diagrams remain completely visible.
- **Straight-Line Snapping:** Holding `Shift` while dragging locks the highlighter to perfectly straight horizontal or vertical lines for highlighting lines of text.

---

## 6. Typography & Text Engine

Click the **Text Tool** or press `T`:
- Click anywhere on the notebook page to spawn a typed-text block.
- Type rich annotations, headings, or summaries with full multiline text support.
- Fully styled with configurable font size, font family (Sans-serif, Serif, Monospace), bold, italic, text color, and alignment (left, center, right).

---

## 7. Shapes & Geometric Recognition

### 7.1 Built-in Shape Primitives
Access the Shapes dropdown in the toolbar to draw:
- **Rectangle / Square**
- **Circle / Ellipse**
- **Straight Line**
- **Directional Arrow & Double Arrow**
- **Triangle**

### 7.2 Intelligent Shape Recognition
CollabBoard X includes an integrated geometric recognizer (`ShapeRecognizer.ts`):
1. **Toggleable Control:** Smart shape recognition is **disabled by default** to preserve natural freehand sketching and handwriting. Enable it anytime using the toolbar toggle button (`[ ✨ Shapes: ON/OFF ]`).
2. When active, draw a rough hand-drawn circle, rectangle, arrow, triangle, or straight line using the regular Pen tool.
3. Upon pointer release, the engine evaluates the polyline using the **Ramer-Douglas-Peucker (RDP)** algorithm to identify salient inflection corners, circularity ratios, and aspect proportions.
4. If recognized as a geometric shape, the rough stroke is automatically replaced by a clean, mathematically precise vector shape!

---

## 8. Images & Photos

- Click the **Image** icon in the toolbar.
- Choose any standard image (`.png`, `.jpg`, `.webp`, `.svg`).
- The image is placed onto the active page with bounding transform handles for movement and aspect-ratio resizing.
- Support for **Object Locking** and **Z-Ordering** (Bring to Front / Send to Back).

---

## 9. Lasso Selection & Transformations

Click the **Lasso Tool** or press `L`:
- Draw a freeform loop around any combination of ink strokes, text boxes, shapes, or images.
- A **ray-casting point-in-polygon containment test** computes all enclosed elements and groups them into an active selection box.
- **Instant Move Tool Switch:** Upon releasing the pointer, the app automatically switches to the Select / Move tool, allowing immediate drag repositioning, rotation, and resizing without extra toolbar clicks.
- Drag the bounding box to move all selected objects en masse.
- Quick action pills appear in the toolbar:
  - **Chevrons Up:** Bring selection to Front.
  - **Chevrons Down:** Send selection to Back.
  - **Lock / Unlock:** Prevent or permit modifications.
  - **Duplicate (`Ctrl+D`):** Clone selection.
  - **Delete (`Del`):** Delete selection.

---

## 10. Multi-Page Notebook System & Paper Themes

At the bottom of the canvas, the **Page Navigation Bar** controls the document hierarchy:
- Navigate between pages with the `<` and `>` buttons or view the current page index (`Page 1 / 4`).
- **Paper Background & Palette Selector:** Click `[ 📄 Paper ]` in the toolbar to change the background pattern or paper shade for the current page in real time:
  - **Patterns:** Blank (unlined), Ruled (lined paper with red margin), Math Grid, and Dotted.
  - **Paper Colors:** White, Ivory, Slate Dark, Chalkboard, and Soft Gray (with adaptive grid/line contrast).
- **Add Page (`+`):** Opens a template menu to append a new page with a chosen paper style.
- **Duplicate Page:** Clones the active page along with all contained annotations and strokes.
- **Delete Page:** Deletes the active page. The server cascades this deletion to remove all contained elements atomically.
- **Thumbnails Drawer:** Opens a left-side drawer with live thumbnails of all notebook pages for rapid jump navigation.

---

## 11. PDF Import, Annotation & Vector Export

Open the **Thumbnails Drawer** (grid icon in bottom bar):
- **Import PDF:** Select any multi-page PDF document. Using `pdfjs-dist`, every page is rendered into high-resolution canvas backgrounds and mapped into notebook pages. You can annotate, write, highlight, and draw directly over the imported document.
- **Export Multi-Page PDF:** Click "Export as PDF" to generate a complete vector PDF document containing every notebook page, background template, and annotation using `jspdf`.

---

## 12. Professional Viewport Navigation & Presentation Mode

- **Cursor-Centered Wheel Zoom:** Zoom smoothly in and out around the exact pixel where your cursor is positioned.
- **Touchpad Pan & Pinch Gestures:** Smooth 2-finger panning and native pinch-to-zoom (`ctrlKey`).
- **Floating Zoom Widget:** Located in the bottom-left corner with `[ - ]`, `[ 100% ]`, `[ + ]`, and `[ ⛶ Fit to Page ]` centering.
- **Decluttered Canvas:** The drafting ruler was eliminated to give precedence to clean, unobstructed note-taking and smart shape recognition.
- **Laser Pointer Tool:** A glowing neon pointer with an ephemeral comet tail that gracefully fades away after 1.2 seconds, broadcast to peers over presence channels.

---

## 13. Elements & Sticker Collections with In-Place Note Editing

Click the **Sparkles** icon in the toolbar to open the **Stickers & Elements Drawer**:
Features categorized visual tabs with 1-click center placement, auto-selection, and automatic switch to the Move tool:
1. **Sticky Notes:** Pastel yellow, blue, green, pink, purple, and orange with multi-line text and adhesive strip styling.
2. **Reaction Emojis:** Quick reaction grid (👍, ❤️, 🚀, 🔥, 💡, 🎯, 👏, 🎉, 💯, ⚠️, ❓, 🏆) for instant non-verbal feedback.
3. **Rubber Stamps & Badges:** Official APPROVED, CONFIDENTIAL, REVIEWED, DRAFT, and URGENT stamps.
4. **Flowcharts & Diagrams:** Start/End terminal, Process block, Decision fork, Database cylinder, and Cloud service.
5. **Math & Science:** $\sum_{i=1}^n$, $\int f(x)dx$, $\sqrt{a^2+b^2}$, Benzene ring ($\text{C}_6\text{H}_6$), Bohr atom, DNA helix, and Resistor.

### 13.1 In-Place Double-Click / Tap Sticky Note Editing
Sticky notes are fully dynamic and editable at any time after being placed onto the board:
- **Double-Click or Double-Tap to Edit:** Double-clicking any sticky note or text box directly opens an inline editing dialog overlay with instant keyboard autofocus.
- **Floating Canvas Badge:** When any sticky note is selected, an intuitive floating badge (`[ ✏️ Edit Note Text ]`) hovers immediately above the element for 1-click access.
- **Toolbar Action & Pastel Color Swatches:** Selecting a sticky note displays an **`[ ✏️ Edit Text ]`** button in the floating toolbar alongside 6 instant pastel color swatches:
  - 🟡 Canary Lemon (`#fef08a`)
  - 🟢 Mint Green (`#bbf7d0`)
  - 🔵 Sky Blue (`#bae6fd`)
  - 🌸 Bubblegum Pink (`#fbcfe8`)
  - 🟣 Soft Lavender (`#e9d5ff`)
  - 🟠 Warm Peach (`#fed7aa`)
- **Word Wrapping & Empty State Guidance:** Sticky note text automatically wraps with generous padding. Empty sticky notes display a soft italic placeholder (`(Double-click to write note...)`), making collaboration obvious to first-time users.
- **Keyboard Shortcuts:** Press `Enter` to save changes immediately, `Shift + Enter` for a new line, or `Escape` to cancel.

---

## 15. Note-Synchronized Audio Recording

Located at the top right of the room interface:
1. Click **Record Audio** to begin recording via the browser's `MediaRecorder` API.
2. An elapsed recording timer (`00:42`) and recording pulse indicator appear.
3. Pause, resume, or stop the recording at any time.
4. When stopped, an audio playback bar appears with a timeline scrubber:
   - Play and pause recorded discussions.
   - **Note Synchronization:** As you scrub through the audio recording, the engine cross-references the playback timestamp against the `last_modified_at` timestamps of canvas elements. Elements created or edited during that window are automatically spotlighted on the board!
   - Export recorded audio as a `.webm` file.

---

## 16. Keyboard Shortcuts Quick Reference

| Category | Shortcut | Function |
|---|---|---|
| **History** | `Ctrl + Z` | Undo |
| | `Ctrl + Y` or `Ctrl + Shift + Z` | Redo |
| **Selection** | `Ctrl + D` | Duplicate selected element |
| | `Delete` / `Backspace` | Delete selected element |
| | `Ctrl + A` | Select all elements on page |
| | `Escape` | Clear selection |
| **Tools** | `V` | Select / Move tool |
| | `P` | Pen tool |
| | `H` | Highlighter tool |
| | `E` | Eraser tool |
| | `L` | Lasso selection tool |
| | `T` | Text tool |
| **Navigation** | `Space + Drag` | Pan canvas viewport |
| | `Mouse Wheel` | Smooth zoom in / out |

---

## 17. Workstation Organization, Permissions & Moderation

CollabBoard X delivers an uncluttered, modern workstation layout designed for classrooms, engineering reviews, and multi-user brainstorms:

### 17.1 Specialized Workstation Tabs & Docked Side Chat
- **`🎨 Whiteboard & Notebook`**: Clean, edge-to-edge drawing viewport with the GoodNotes floating toolbar, bottom page navigation bar, top-right audio recording bar, and bottom-left zoom presets. Canvas state and zoom level are continuously preserved in memory when switching tabs.
- **`👥 Meeting & Controls`**: Dedicated full-page administration center with the Master Board Access card, participants permission matrix (`HOST`, `EDITOR`, `VIEWER`), individual pointer visibility toggles, voice muting controls, and snapshot backup tools.
- **`💬 Docked Whiteboard Chat (Side Panel)`**: Slide-out chat drawer directly accessible over the whiteboard with granular audience targeting (`👥 Everyone`, `👑 Room Host Private`, or `🔒 Particular Participant Direct 1-on-1`). Unread notification count badges appear on the header chat toggle button.

### 17.2 Pixel-Exact Drawing Coordinates
The canvas engine calculates drawing coordinates using `clientX - rect.left` and `clientY - rect.top` relative to the bounding box of the HTML `<canvas>` element. This guarantees that pen strokes, highlighters, shapes, and eraser paths match the physical cursor tip with zero offset or drift across any screen resolution and zoom level.

### 17.3 Master Board Access Locking
When a teacher, lecturer, or meeting leader needs everyone's attention:
- The Host clicks **`[ 🔒 Board Access: Disabled ]`** in the top header.
- All non-host participants immediately enter Read-Only mode with a warning banner (`"🔒 BOARD ACCESS DISABLED BY HOST"`).
- Non-host drawing toolbars are hidden and pointer dragging switches smoothly to safe viewport panning.
- The server authoritatively blocks any non-host mutation requests with `BOARD_ACCESS_DISABLED`.

### 17.4 Clutter-Free Presentation & Host-Moderated Pointer Sharing
In collaborative sessions with 10+ participants, broadcasting everyone's cursor clutters the board:
- **Host Cursor (`👑 Host`)**: Always broadcast and highlighted with a golden crown badge.
- **Viewer Suppression**: Users in `VIEWER` mode never broadcast pointers.
- **Pointer Request**: Non-host editors can click **`[Share Pointer]`** in the top header. The Host receives an interactive header notification pill (`[Allow] / [Deny]`). Only approved pointers are visible to the room.

---

## 18. Mobile & Touchscreen Responsive Workstation Layout

CollabBoard X includes first-class responsive styling tailored for smartphones (iPhone, Android) and tablets (iPad, Galaxy Tab):

### 18.1 Header Auto-Compaction (< 768px Screens)
- **Brand Title Truncation:** On narrow screens, verbose labels (`CollabBoard`, `Room:`, participant usernames, and role text strings) are automatically hidden, leaving prominent icon badges (`👑`, `👁️`, `✏️`).
- **One-Tap Action Triggers:** Quick Mic toggle, Share Pointer, QR Code, and Chat Drawer buttons remain immediately reachable as streamlined 34px touch icons with zero horizontal page blowout.

### 18.2 Floating GoodNotes Toolbar Mobile Docking
- Toolbar width automatically constrains to `max-width: calc(100vw - 16px)` with silent horizontal touch scrolling.
- Redundant desktop zoom buttons are hidden in the top toolbar to preserve screen real estate, delegating zoom to the dedicated bottom-left touch widget.

### 18.3 Non-Colliding Audio & Navigation Widgets
- **Audio Recorder Bar:** On mobile, shifts dynamically to `top: 58px; right: 8px` with a compact $0.9\times$ scaling factor, completely clearing the top-centered floating drawing toolbar.
- **Page Navigation Bar:** Automatically re-anchors to the bottom-right corner (`bottom: 12px; right: 8px`), fully separating from the bottom-left zoom widget (`bottom: 12px; left: 8px`) and eliminating touch overlap.

### 18.4 Touch & Stylus Optimization
- Native touch event prevention eliminates accidental page scrolling or elastic bounce when drawing with a finger or Apple Pencil / stylus.
- Double-tap gesture support enables effortless in-place editing of sticky notes and text annotations on touchscreens.
