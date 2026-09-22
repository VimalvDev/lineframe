import sys

with open('components/ViewportCanvas.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { useGridStore, getEffectivePaperDimensions, getCellSizeMm } from '@/store/useGridStore';",
    "import { useGridStore, getEffectivePaperDimensions, getCellSizeMm, getSnapLines } from '@/store/useGridStore';"
)

# 2. showRulers check
content = content.replace(
    "if (grid.showRulers) {\n        drawRulers(",
    "if (grid.showRulers !== false) {\n        drawRulers("
)

# 3. Add pointerRef to top
content = content.replace(
    "const requestRef = useRef<number>(0);",
    "const requestRef = useRef<number>(0);\n  const pointerRef = useRef<{ x: number | null, y: number | null }>({ x: null, y: null });"
)

# 4. Fix pointer tracking variables
tracking_vars_orig = """    let isDraggingImage = false;
    let isResizingImage = false;
    let resizeHandleIndex = -1; // 0-7 for 8 handles (TL, TC, TR, MR, BR, BC, BL, ML)
    let resizeStartImage = { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };
    let resizeStartClientX = 0;
    let resizeStartClientY = 0;

    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartImage = { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };"""
tracking_vars_new = """    let isDraggingImage = false;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartImage = { ...useGridStore.getState().image };

    let isResizingImage = false;
    let resizeHandleIndex = -1;
    let resizeStartClientX = 0;
    let resizeStartClientY = 0;
    let resizeStartImage = { ...useGridStore.getState().image };"""
content = content.replace(tracking_vars_orig, tracking_vars_new)

# 5. Fix interaction mode bug (setting dragStartClient for move tool correctly)
move_bug_orig = """      if (interactionMode === 'move' && state.image.src) {
        isDraggingImage = true;
        dragStartClientX = e.clientX;
        dragStartClientY = e.clientY;
        dragStartImage = { ...state.image };
        canvas.style.cursor = 'move';
        return;
      }"""
move_bug_new = ""
content = content.replace(move_bug_orig, move_bug_new)

# also fix hitTestImageBox block to store the full image
hitTest_orig = """        if (hitTestImageBox(e.clientX, e.clientY)) {
          isDraggingImage = true;
          lastClientX = e.clientX;
          lastClientY = e.clientY;
          canvas.style.cursor = 'move';
          return;
        }"""
hitTest_new = """        if (hitTestImageBox(e.clientX, e.clientY)) {
          isDraggingImage = true;
          dragStartClientX = e.clientX;
          dragStartClientY = e.clientY;
          dragStartImage = { ...state.image };
          canvas.style.cursor = 'move';
          return;
        }"""
content = content.replace(hitTest_orig, hitTest_new)

# 6. Replace onPointerMove logic
on_move_orig = """    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const dx = e.clientX - lastClientX;
        const dy = e.clientY - lastClientY;
        const { panX, panY } = useViewportStore.getState();
        useViewportStore.getState().setPan(panX + dx, panY + dy);
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      } else if (isResizingImage) {
        const { zoom } = useViewportStore.getState();
        const dxPx = e.clientX - resizeStartClientX;
        const dyPx = e.clientY - resizeStartClientY;
        const dxMm = (dxPx / zoom) / MM_TO_PX;
        const dyMm = (dyPx / zoom) / MM_TO_PX;

        const s = resizeStartImage;"""
on_move_new = """    const onPointerMove = (e: PointerEvent) => {
      let { mmX, mmY } = clientToPaperMm(e.clientX, e.clientY);
      
      const gridState = useGridStore.getState();
      if (!isDraggingImage && !isResizingImage && !isDragging && gridState.grid.snapToGrid) {
         const { snapLinesX, snapLinesY } = getSnapLines(gridState.activePaper, gridState.customPresets, gridState.grid);
         const snapRadiusMm = 2;
         
         let minDistanceX = snapRadiusMm;
         let minDistanceY = snapRadiusMm;
         let snapX = mmX;
         let snapY = mmY;
         
         for (const lineX of snapLinesX) {
            const dist = Math.abs(mmX - lineX);
            if (dist < minDistanceX) {
               minDistanceX = dist;
               snapX = lineX;
            }
         }
         for (const lineY of snapLinesY) {
            const dist = Math.abs(mmY - lineY);
            if (dist < minDistanceY) {
               minDistanceY = dist;
               snapY = lineY;
            }
         }
         mmX = snapX;
         mmY = snapY;
      }
      
      pointerRef.current.x = mmX;
      pointerRef.current.y = mmY;

      if (isDragging) {
        const dx = e.clientX - lastClientX;
        const dy = e.clientY - lastClientY;
        const { panX, panY } = useViewportStore.getState();
        useViewportStore.getState().setPan(panX + dx, panY + dy);
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      } else if (isResizingImage) {
        const start = clientToPaperMm(resizeStartClientX, resizeStartClientY);
        const current = clientToPaperMm(e.clientX, e.clientY);
        
        const dxMm = current.mmX - start.mmX;
        const dyMm = current.mmY - start.mmY;

        const s = resizeStartImage;"""
content = content.replace(on_move_orig, on_move_new)

# 7. Replace drag image math
drag_math_orig = """      } else if (isDraggingImage) {
        const dxPx = e.clientX - dragStartClientX;
        const dyPx = e.clientY - dragStartClientY;
        const { zoom } = useViewportStore.getState();
        
        const dxMm = (dxPx / zoom) / MM_TO_PX;
        const dyMm = (dyPx / zoom) / MM_TO_PX;
        
        const gridState = useGridStore.getState();
        const img = dragStartImage;
        
        // Move the bounding box position
        let newXMm = img.xMm + dxMm;
        let newYMm = img.yMm + dyMm;

        // --- Magnetic Snapping ---
        const { snapToGrid, snapToPaper } = gridState.grid;
        if (snapToGrid || snapToPaper) {
          const snapRadiusMm = 2;
          const { widthMm, heightMm } = getEffectivePaperDimensions(gridState.activePaper, gridState.customPresets);
          const { top, right, bottom, left } = gridState.activePaper.margins;
          
          let snapTargetX: number | null = null;
          let snapTargetY: number | null = null;
          let minDistanceX = snapRadiusMm;
          let minDistanceY = snapRadiusMm;

          const snapLinesX: number[] = [];
          const snapLinesY: number[] = [];

          if (snapToPaper) {
             snapLinesX.push(0, widthMm / 2, widthMm);
             snapLinesY.push(0, heightMm / 2, heightMm);
          }

          if (snapToGrid) {
             const { cellWidthMm, cellHeightMm, usableW, usableH } = getCellSizeMm(gridState.activePaper, gridState.customPresets, gridState.grid);
             
             if (usableW > 0 && usableH > 0 && cellWidthMm > 0 && cellHeightMm > 0) {
                snapLinesX.push(left, widthMm - right);
                snapLinesY.push(top, heightMm - bottom);
                
                for (let x = cellWidthMm; x < usableW - 0.1; x += cellWidthMm) {
                   snapLinesX.push(left + x);
                }
                for (let y = cellHeightMm; y < usableH - 0.1; y += cellHeightMm) {
                   snapLinesY.push(top + y);
                }
                
                if (gridState.grid.centerLines) {
                   snapLinesX.push(left + usableW / 2);
                   snapLinesY.push(top + usableH / 2);
                }
             }
          }
          
          // Center of the bounding box
          const imgCenterX = newXMm + img.widthMm / 2;
          const imgCenterY = newYMm + img.heightMm / 2;

          for (const lineX of snapLinesX) {
             const dist = Math.abs(imgCenterX - lineX);
             if (dist < minDistanceX) {
                minDistanceX = dist;
                snapTargetX = lineX;
             }
          }
          
          for (const lineY of snapLinesY) {
             const dist = Math.abs(imgCenterY - lineY);
             if (dist < minDistanceY) {
                minDistanceY = dist;
                snapTargetY = lineY;
             }
          }"""

drag_math_new = """      } else if (isDraggingImage) {
        const start = clientToPaperMm(dragStartClientX, dragStartClientY);
        const current = clientToPaperMm(e.clientX, e.clientY);
        
        const dxMm = current.mmX - start.mmX;
        const dyMm = current.mmY - start.mmY;
        
        const gridState = useGridStore.getState();
        const img = dragStartImage;
        
        // Move the bounding box position
        let newXMm = img.xMm + dxMm;
        let newYMm = img.yMm + dyMm;

        // --- Magnetic Snapping ---
        const { snapToGrid, snapToPaper } = gridState.grid;
        if (snapToGrid || snapToPaper) {
          const snapRadiusMm = 2;
          const { snapLinesX, snapLinesY } = getSnapLines(gridState.activePaper, gridState.customPresets, gridState.grid);
          
          let snapTargetX: number | null = null;
          let snapTargetY: number | null = null;
          let minDistanceX = snapRadiusMm;
          let minDistanceY = snapRadiusMm;
          
          // Center of the bounding box
          const imgCenterX = newXMm + img.widthMm / 2;
          const imgCenterY = newYMm + img.heightMm / 2;

          for (const lineX of snapLinesX) {
             const dist = Math.abs(imgCenterX - lineX);
             if (dist < minDistanceX) {
                minDistanceX = dist;
                snapTargetX = lineX;
             }
          }
          
          for (const lineY of snapLinesY) {
             const dist = Math.abs(imgCenterY - lineY);
             if (dist < minDistanceY) {
                minDistanceY = dist;
                snapTargetY = lineY;
             }
          }"""
content = content.replace(drag_math_orig, drag_math_new)

# 8. Add onPointerLeave listener
listener_orig = """    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);"""
listener_new = """    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerLeave = () => {
      pointerRef.current.x = null;
      pointerRef.current.y = null;
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);"""
content = content.replace(listener_orig, listener_new)

cleanup_orig = """    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);"""
cleanup_new = """    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);"""
content = content.replace(cleanup_orig, cleanup_new)

with open('components/ViewportCanvas.tsx', 'w') as f:
    f.write(content)

print("Replaced successfully! Length of file is now", len(content.splitlines()))
