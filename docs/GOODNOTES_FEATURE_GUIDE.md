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

---

## 1. Overview & Philosophy

CollabBoard X brings the tactile, expressive, and structured digital notebook experience of GoodNotes 5 into a real-time, low-latency, LAN-based multi-user collaboration environment.

Every feature adheres to three fundamental engineering invariants:
1. **Server-Authoritative Consistency:** Every operation is validated, deduplicated, monotonically sequenced, and persisted in SQLite WAL storage before broadcast.
2. **Zero External Internet Dependencies:** Operates completely offline or on isolated LANs with zero-configuration peer discovery and P2P WebRTC voice meshes.
3. **Double-Buffered 60 FPS Canvas:** Utilizes high-DPI retina rendering with subpixel anti-aliasing and Catmull-Rom spline curve interpolation.

---

## 2. Basic Editing Features

- **Undo (`Ctrl+Z` / `Cmd+Z`)**: Reverses the most recent canvas mutation. If the element was server-persisted, a compensating inverse operation is dispatched.
- **Redo (`Ctrl+Y` / `Cmd+Y` or `Ctrl+Shift+Z`)**: Restores an operation from the local history stack.
- **Duplicate (`Ctrl+D` / `Cmd+D`)**: Creates an exact clone of the currently selected element, placed with a +20px offset to make newly created items immediately discernible.
- **Delete (`Delete` / `Backspace`)**: Removes selected elements.
- **Select All (`Ctrl+A` / `Cmd+A`)**: Selects all non-locked elements residing on the active notebook page.
- **Infinite Pan & Zoom**:
  - Pan by holding `Space` or dragging with middle mouse button.
  - Smooth zoom from 10% to 500% with the mouse wheel or the zoom controls in the floating toolbar.
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
- **Partial-Stroke Erasing:** Slices and trims vector polylines dynamically. Points falling within the eraser radius (which scales with the active stroke width) are excised, splitting strokes into multiple sub-segments or trimming the ends.

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
1. Draw a rough hand-drawn circle, rectangle, arrow, triangle, or straight line using the regular Pen tool.
2. Upon pointer release, the engine evaluates the polyline using the **Ramer-Douglas-Peucker (RDP)** algorithm to identify salient inflection corners, circularity ratios, and aspect proportions.
3. If recognized as a geometric shape, the rough stroke is automatically replaced by a clean, mathematically precise vector shape!

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
- Drag the bounding box to move all selected objects en masse.
- Quick action pills appear in the toolbar:
  - **Chevrons Up:** Bring selection to Front.
  - **Chevrons Down:** Send selection to Back.
  - **Lock / Unlock:** Prevent or permit modifications.
  - **Duplicate (`Ctrl+D`):** Clone selection.
  - **Delete (`Del`):** Delete selection.

---

## 10. Multi-Page Notebook System

At the bottom of the canvas, the **Page Navigation Bar** controls the document hierarchy:
- Navigate between pages with the `<` and `>` buttons or view the current page index (`Page 1 / 4`).
- **Add Page (`+`):** Opens a template menu to append a new page with a chosen paper style:
  - **Ruled Paper:** Horizontal lined paper with a classic red left margin.
  - **Math Grid:** Metric grid paper for mathematics, geometry, and plotting.
  - **Dotted Paper:** Subtle dot matrix for bullet journaling and schematics.
  - **Blank Paper:** Clean, unlined canvas.
  - **PDF Background:** Custom imported document page.
- **Duplicate Page:** Clones the active page along with all contained annotations and strokes.
- **Delete Page:** Deletes the active page. The server cascades this deletion to remove all contained elements atomically.
- **Thumbnails Drawer:** Opens a left-side drawer with live thumbnails of all notebook pages for rapid jump navigation.

---

## 11. PDF Import, Annotation & Vector Export

Open the **Thumbnails Drawer** (grid icon in bottom bar):
- **Import PDF:** Select any multi-page PDF document. Using `pdfjs-dist`, every page is rendered into high-resolution canvas backgrounds and mapped into notebook pages. You can annotate, write, highlight, and draw directly over the imported document.
- **Export Multi-Page PDF:** Click "Export as PDF" to generate a complete vector PDF document containing every notebook page, background template, and annotation using `jspdf`.

---

## 12. Presentation Mode & Laser Pointer

Select the **Laser Pointer Tool** in the toolbar:
- As you draw or point on the canvas, a glowing neon pointer appears with an ephemeral comet tail that gracefully fades away after 1.2 seconds.
- Laser movements are broadcast over peer presence channels at 40ms intervals, allowing remote attendees on the LAN to see exactly what you are emphasizing during lectures or presentations.

---

## 13. Precision Drafting Ruler

Click the **Ruler** icon (compass symbol) in the toolbar:
- An interactive, rotatable drafting ruler appears on-screen in world coordinates.
- Drag the ruler body to reposition it.
- Drag the angle compass wheel to rotate the ruler to any degree angle (with a live angle degree readout).
- While the ruler is visible, strokes drawn within 15px of the ruler edge automatically snap onto the ruler's guide line, enabling perfectly straight technical drafting lines.

---

## 14. Elements & Sticker Collections

Click the **Sparkles** icon in the toolbar to open the **Stickers & Elements Drawer**:
Contains 5 categorized libraries of pre-rendered stamps, symbols, and notes:
1. **Sticky Notes:** Pastel yellow, blue, green, pink, purple, and orange sticky notes.
2. **Math & Equations:** Common formulas including $\sum_{i=1}^n$, $\int f(x)dx$, $\sqrt{a^2+b^2}$, quadratic formula $x=\frac{-b\pm\sqrt{\Delta}}{2a}$, and Euler's identity $e^{i\pi}+1=0$.
3. **Science & Engineering:** Benzene ring ($\text{C}_6\text{H}_6$), Bohr atom, DNA double helix, resistor ($R$), capacitor ($C$), and $\text{H}_2\text{O}$.
4. **Flowcharts & Diagrams:** Start/End terminal, Process block, Decision fork, Database cylinder, and Cloud service.
5. **Badges & Stamps:** APPROVED, URGENT, DRAFT, VERIFIED, and QUESTION badges.
- **Custom Sticker Creator:** Choose a color and type custom text to instantly stamp a personalized sticky note onto the active page.

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
