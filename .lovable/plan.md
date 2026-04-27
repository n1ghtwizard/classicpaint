I’ll correct the shape/text workflow and rebuild the shape handling so it behaves much closer to MS Paint.

Plan:

1. Fix shape placement to be one-time only
- Choosing a shape from the shapes dropdown will put the app into a temporary “place this one shape” mode.
- The canvas will show a clear placement cursor/ghost preview so users know exactly where the object will appear.
- After the user places that shape, the app will exit placement mode. To add another shape, they must open the shapes dropdown and choose a shape again.
- This same placement behavior will apply to text boxes.

2. Fix distorted/thick-edge shape rendering
- Rework shape drawing so outlines are rendered in screen/canvas pixels instead of being distorted by `ctx.scale()`.
- This will make rectangles have straight, even borders and prevent some edges from looking thicker than others.
- Use normalized point/curve definitions converted to real canvas coordinates, instead of scaling the whole canvas context including stroke width.
- Increase the default shape size and clamp minimum resize dimensions so shapes never spawn tiny or collapse into broken outlines.

3. Make shapes editable after placement
- Store placed shapes as editable objects in app state rather than immediately flattening them permanently into pixels.
- Render saved shapes onto the preview/object layer, then flatten them when exporting or when needed for pixel tools.
- Add double-click hit testing: double-clicking a placed shape selects it again and shows the resize/rotate/move confirmation box.
- While selected, users can move, rotate, resize, recolor, and adjust stroke size, then press Enter/click away to confirm.

4. Improve the transformer box
- Make the bounding box line up cleanly with the selected shape.
- Keep resize handles stable and prevent inverted/warped resize behavior.
- Add better visual handles so it feels intentional and easy to grab.

5. Add MS Paint-style text controls
- When placing/editing text, show top-bar controls for:
  - font family
  - font size
  - bold
  - italic
  - underline
- Text boxes will use the same one-time placement cursor behavior.
- Text boxes will also be selectable by double-clicking and editable/manipulable again.

6. Add paste support
- Listen for clipboard paste events.
- If the clipboard contains an image, paste it as a floating draggable layer on the canvas.
- The pasted image can be moved before confirming, similar to the existing selection layer.
- Support common image clipboard cases from screenshots/copy image flows.

7. Expand shapes carefully
- Add more MS Paint-style shapes that are missing, but prioritize fixing quality and interaction first.
- Keep the shapes dropdown clean and icon-based.

Technical details:
- Main changes will be in `src/components/paint/PaintApp.tsx`, `src/components/paint/shapes.ts`, `src/components/paint/ShapeTransformer.tsx`, and likely a small reusable object/selection component.
- I’ll introduce shape/text object state so objects remain selectable by double-click instead of becoming immediately unrecoverable pixels.
- Export will composite the white canvas, drawings, editable shapes/text, selections, and pasted images into one PNG/JPG output.
- Undo/redo will be updated to include both pixel history and object changes where practical, so object edits do not feel disconnected from canvas history.