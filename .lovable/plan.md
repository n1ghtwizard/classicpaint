I found the main causes:

- Zoom is currently changing the same element that `resizeCanvas()` measures, so zoom feeds back into the canvas bitmap size. That makes the painted bitmap, preview layer, and DOM overlays drift apart.
- Several overlay tools use raw screen-pixel pointer deltas. Once zoomed, those deltas are wrong unless converted back into canvas-local coordinates.
- Copy/paste relies mostly on the browser image clipboard API, which is restricted and can silently fail. There is no dependable in-app fallback, and Ctrl+V is not wired into the keyboard shortcut handler.
- Right-click pan is attached to the scroll area, but it needs stronger pointer capture/prevent-default behavior and should only pan when the right-click starts inside the canvas box.

Plan to fix it:

1. Rebuild zoom around a stable logical canvas size
   - Keep the real canvas bitmap size based only on the logical canvas dimensions and device pixel ratio.
   - Stop observing/measuring the zoomed canvas wrapper as the source of truth.
   - Add a separate zoom frame:

```text
scroll area
  zoom frame: width = canvasWidth * zoom, height = canvasHeight * zoom
    logical canvas surface: width = canvasWidth, height = canvasHeight, transform: scale(zoom)
      bitmap canvas
      preview canvas
      selection/shape/crop/polyline/text overlays
```

   - This makes the canvas box grow/shrink for scrolling, while the painting and every overlay scale together as one surface.

2. Fix pointer coordinate conversion everywhere
   - Use one coordinate conversion helper that maps browser pointer coordinates back into logical canvas coordinates using the element's actual rendered rect.
   - Apply it to:
     - brush/eraser/fill/picker/text/shape drawing
     - selection dragging
     - shape resizing/rotation/moving
     - crop overlay creation/moving
     - bendable/polyline tools
   - This prevents strokes, handles, selections, and crop boxes from drifting at zoom levels above/below 100%.

3. Fix right-click pan
   - Start pan only when right mouse down begins inside the canvas surface.
   - Capture the pointer and prevent browser-native right-click behavior during a drag.
   - Scroll the canvas area by the drag delta.
   - If the right-click does not move past the drag threshold, show the custom context menu instead.
   - If the right-click does move, suppress the context menu.

4. Make copy/paste actually reliable
   - Add an internal app clipboard ref that stores copied image data from the current selection or flattened canvas.
   - Copy will always save into the internal clipboard, then also try the system clipboard when the browser allows it.
   - Paste will first use the internal clipboard, so copy/paste works inside NeoPaint even when the browser blocks image clipboard APIs.
   - Add Ctrl/Cmd+V handling in the keyboard shortcut effect.
   - Keep the existing external image paste support from the browser paste event for screenshots/images copied from outside the app.
   - Add success/error toasts so failures are visible instead of silent.

5. Ensure copy/cut content matches what the user sees
   - Copy full canvas from a flattened render, including bitmap canvas plus placed/active shapes.
   - Copy selection from the lifted selection image data.
   - Cut only removes the floating selection after a successful internal copy.
   - Paste creates a draggable floating selection centered on the canvas.

6. Verify manually after implementation
   - Draw at 100%, zoom in, draw again: strokes must land under the pointer and stay attached to the canvas.
   - Zoom out/in repeatedly: existing painting, preview canvas, selections, shape handles, crop box, and text editor must remain aligned.
   - Right-click drag inside the canvas: scroll/pan must move the canvas area.
   - Right-click without dragging: custom menu must open.
   - Copy/paste via context menu and Ctrl/Cmd+C/V must work within the app.
   - External image paste should still work when the browser provides image data.

Files to update after approval:
- `src/components/paint/PaintApp.tsx`
- `src/components/paint/SelectionLayer.tsx`
- `src/components/paint/ShapeTransformer.tsx`
- `src/components/paint/CropOverlay.tsx`
- `src/components/paint/PolylineEditor.tsx`

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>