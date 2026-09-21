'use client';

import { useEffect, useRef, useState } from 'react';
import { useGridStore, getEffectivePaperDimensions, getCellSizeMm } from '@/store/useGridStore';
import { useViewportStore } from '@/store/useViewportStore';
import { drawSheet } from '@/lib/renderCanvas';
import { Upload } from 'lucide-react';

const MM_TO_PX = 3.7795; // ~96 DPI for the base preview coordinate system

export default function ViewportCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // Image element caching
  const imgElRef = useRef<HTMLImageElement | null>(null);

  const activePaper = useGridStore((s) => s.activePaper);
  const customPresets = useGridStore((s) => s.customPresets);
  const grid = useGridStore((s) => s.grid);
  const image = useGridStore((s) => s.image);
  const loadImageFile = useGridStore((s) => s.loadImageFile);

  const { zoom, panX, panY } = useViewportStore();

  // Load image when src changes
  useEffect(() => {
    if (!image.src) {
      imgElRef.current = null;
      return;
    }
    const el = new Image();
    el.onload = () => {
      imgElRef.current = el;
    };
    el.src = image.src;
  }, [image.src]);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      const displayWidth = Math.floor(rect.width * dpr);
      const displayHeight = Math.floor(rect.height * dpr);
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#171717'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(dpr, dpr);
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      const { widthMm, heightMm } = getEffectivePaperDimensions(activePaper, customPresets);
      const paperW = widthMm * MM_TO_PX;
      const paperH = heightMm * MM_TO_PX;

      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 30 / zoom;
      ctx.shadowOffsetY = 10 / zoom;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, paperW, paperH);
      ctx.shadowColor = 'transparent';

      drawSheet(ctx, paperW, paperH, activePaper, customPresets, grid, image, imgElRef.current);

      const { activeSnapLines } = useViewportStore.getState();
      if (activeSnapLines.x !== null || activeSnapLines.y !== null) {
        ctx.save();
        ctx.strokeStyle = '#ef4444'; // Subtle red/orange for snapping
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        
        const BASELINE_PX_PER_MM = 3.7795;
        if (activeSnapLines.x !== null) {
          ctx.beginPath();
          ctx.moveTo(activeSnapLines.x * BASELINE_PX_PER_MM, -1000);
          ctx.lineTo(activeSnapLines.x * BASELINE_PX_PER_MM, paperH + 1000);
          ctx.stroke();
        }
        
        if (activeSnapLines.y !== null) {
          ctx.beginPath();
          ctx.moveTo(-1000, activeSnapLines.y * BASELINE_PX_PER_MM);
          ctx.lineTo(paperW + 1000, activeSnapLines.y * BASELINE_PX_PER_MM);
          ctx.stroke();
        }
        
        ctx.restore();
      }

      // Draw image selection bounding box + resize handles
      if (image.src && imgElRef.current) {
        const boxX = image.xMm * MM_TO_PX;
        const boxY = image.yMm * MM_TO_PX;
        const boxW = image.widthMm * MM_TO_PX;
        const boxH = image.heightMm * MM_TO_PX;

        ctx.save();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Handle size in screen-space (constant regardless of zoom)
        const hs = 6 / zoom; // half-size of handle square

        const handles = [
          { x: boxX,          y: boxY },            // top-left
          { x: boxX + boxW/2, y: boxY },            // top-center
          { x: boxX + boxW,   y: boxY },            // top-right
          { x: boxX + boxW,   y: boxY + boxH/2 },   // middle-right
          { x: boxX + boxW,   y: boxY + boxH },      // bottom-right
          { x: boxX + boxW/2, y: boxY + boxH },      // bottom-center
          { x: boxX,          y: boxY + boxH },       // bottom-left
          { x: boxX,          y: boxY + boxH/2 },     // middle-left
        ];

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5 / zoom;
        for (const h of handles) {
          ctx.fillRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
          ctx.strokeRect(h.x - hs, h.y - hs, hs * 2, hs * 2);
        }

        ctx.restore();
      }

      ctx.restore();
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current);
  }, [activePaper, customPresets, grid, image, zoom, panX, panY]); 

  // Event Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let lastClientX = 0;
    let lastClientY = 0;
    
    let isDraggingImage = false;
    let isResizingImage = false;
    let resizeHandleIndex = -1; // 0-7 for 8 handles (TL, TC, TR, MR, BR, BC, BL, ML)
    let resizeStartImage = { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };
    let resizeStartClientX = 0;
    let resizeStartClientY = 0;

    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartImage = { xMm: 0, yMm: 0, widthMm: 0, heightMm: 0 };

    let initialTouchDistance = 0;
    let initialTouchMidX = 0;
    let initialTouchMidY = 0;
    let initialZoom = 1;
    let initialPanX = 0;
    let initialPanY = 0;

    // Helper: convert client coords to paper mm coords
    const clientToPaperMm = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const { zoom, panX, panY } = useViewportStore.getState();
      const canvasX = clientX - rect.left;
      const canvasY = clientY - rect.top;
      const paperPxX = (canvasX - panX) / zoom;
      const paperPxY = (canvasY - panY) / zoom;
      return { mmX: paperPxX / MM_TO_PX, mmY: paperPxY / MM_TO_PX };
    };

    // Helper: check if a point hits a resize handle (returns handle index or -1)
    const hitTestHandles = (clientX: number, clientY: number): number => {
      const state = useGridStore.getState();
      const img = state.image;
      if (!img.src) return -1;

      const { zoom, panX, panY } = useViewportStore.getState();
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const boxX = img.xMm * MM_TO_PX;
      const boxY = img.yMm * MM_TO_PX;
      const boxW = img.widthMm * MM_TO_PX;
      const boxH = img.heightMm * MM_TO_PX;

      const handles = [
        { x: boxX,          y: boxY },
        { x: boxX + boxW/2, y: boxY },
        { x: boxX + boxW,   y: boxY },
        { x: boxX + boxW,   y: boxY + boxH/2 },
        { x: boxX + boxW,   y: boxY + boxH },
        { x: boxX + boxW/2, y: boxY + boxH },
        { x: boxX,          y: boxY + boxH },
        { x: boxX,          y: boxY + boxH/2 },
      ];

      const hitRadius = 8 / zoom; // tolerance in paper-pixel space
      for (let i = 0; i < handles.length; i++) {
        const hScreenX = handles[i].x * zoom + panX;
        const hScreenY = handles[i].y * zoom + panY;
        if (Math.abs(cx - hScreenX) < hitRadius * zoom && Math.abs(cy - hScreenY) < hitRadius * zoom) {
          return i;
        }
      }
      return -1;
    };

    // Helper: check if point is inside image bounding box
    const hitTestImageBox = (clientX: number, clientY: number): boolean => {
      const state = useGridStore.getState();
      const img = state.image;
      if (!img.src) return false;
      const { mmX, mmY } = clientToPaperMm(clientX, clientY);
      return mmX >= img.xMm && mmX <= img.xMm + img.widthMm && mmY >= img.yMm && mmY <= img.yMm + img.heightMm;
    };

    const HANDLE_CURSORS = ['nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize'];

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (e.ctrlKey) {
        const zoomDelta = -e.deltaY * 0.01;
        const newZoom = Math.min(Math.max(0.1, useViewportStore.getState().zoom + zoomDelta), 5);
        
        const { zoom: oldZoom, panX: oldPanX, panY: oldPanY } = useViewportStore.getState();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const nextPanX = mouseX - ((mouseX - oldPanX) * (newZoom / oldZoom));
        const nextPanY = mouseY - ((mouseY - oldPanY) * (newZoom / oldZoom));
        
        useViewportStore.getState().setZoom(newZoom);
        useViewportStore.getState().setPan(nextPanX, nextPanY);
      } else {
        const { panX, panY } = useViewportStore.getState();
        useViewportStore.getState().setPan(panX - e.deltaX, panY - e.deltaY);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const { interactionMode, spacebarPanActive } = useViewportStore.getState();
      const state = useGridStore.getState();
      
      const isActualPan = spacebarPanActive || interactionMode === 'pan';
      
      if (e.button === 1 || e.button === 2 || isActualPan || e.shiftKey) {
        isDragging = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        canvas.style.cursor = 'grabbing';
        return;
      }

      // Check resize handles first
      if (state.image.src) {
        const handleIdx = hitTestHandles(e.clientX, e.clientY);
        if (handleIdx >= 0) {
          isResizingImage = true;
          resizeHandleIndex = handleIdx;
          resizeStartImage = {
            xMm: state.image.xMm,
            yMm: state.image.yMm,
            widthMm: state.image.widthMm,
            heightMm: state.image.heightMm,
          };
          resizeStartClientX = e.clientX;
          resizeStartClientY = e.clientY;
          canvas.style.cursor = HANDLE_CURSORS[handleIdx];
          useGridStore.temporal.getState().pause();
          return;
        }

        // Check if clicking inside image box → move image
        if (hitTestImageBox(e.clientX, e.clientY)) {
          isDraggingImage = true;
          lastClientX = e.clientX;
          lastClientY = e.clientY;
          canvas.style.cursor = 'move';
          return;
        }
      }
      if (interactionMode === 'move' && state.image.src) {
        isDraggingImage = true;
        dragStartClientX = e.clientX;
        dragStartClientY = e.clientY;
        dragStartImage = { ...state.image };
        canvas.style.cursor = 'move';
        return;
      }
      
    };

    const onPointerMove = (e: PointerEvent) => {
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

        const s = resizeStartImage;
        const aspect = s.widthMm / s.heightMm;
        let newX = s.xMm, newY = s.yMm, newW = s.widthMm, newH = s.heightMm;

        // Handle index: 0=TL, 1=TC, 2=TR, 3=MR, 4=BR, 5=BC, 6=BL, 7=ML
        switch (resizeHandleIndex) {
          case 0: { // TL - proportional
            const d = (-dxMm + -dyMm) / 2;
            newW = Math.max(5, s.widthMm + d);
            newH = newW / aspect;
            newX = s.xMm + s.widthMm - newW;
            newY = s.yMm + s.heightMm - newH;
            break;
          }
          case 1: { // TC
            newH = Math.max(5, s.heightMm - dyMm);
            newY = s.yMm + s.heightMm - newH;
            break;
          }
          case 2: { // TR - proportional
            const d = (dxMm + -dyMm) / 2;
            newW = Math.max(5, s.widthMm + d);
            newH = newW / aspect;
            newY = s.yMm + s.heightMm - newH;
            break;
          }
          case 3: { // MR
            newW = Math.max(5, s.widthMm + dxMm);
            break;
          }
          case 4: { // BR - proportional
            const d = (dxMm + dyMm) / 2;
            newW = Math.max(5, s.widthMm + d);
            newH = newW / aspect;
            break;
          }
          case 5: { // BC
            newH = Math.max(5, s.heightMm + dyMm);
            break;
          }
          case 6: { // BL - proportional
            const d = (-dxMm + dyMm) / 2;
            newW = Math.max(5, s.widthMm + d);
            newH = newW / aspect;
            newX = s.xMm + s.widthMm - newW;
            break;
          }
          case 7: { // ML
            newW = Math.max(5, s.widthMm - dxMm);
            newX = s.xMm + s.widthMm - newW;
            break;
          }
        }

        useGridStore.getState().updateImage({
          xMm: newX, yMm: newY, widthMm: newW, heightMm: newH,
        });
      } else if (isDraggingImage) {
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
          }

          if (snapTargetX !== null) {
             newXMm = snapTargetX - img.widthMm / 2;
          }
          if (snapTargetY !== null) {
             newYMm = snapTargetY - img.heightMm / 2;
          }
          
          useViewportStore.getState().setActiveSnapLines({ x: snapTargetX, y: snapTargetY });
        } else {
          useViewportStore.getState().setActiveSnapLines({ x: null, y: null });
        }
        
        gridState.updateImage({ 
          xMm: newXMm,
          yMm: newYMm
        });
      } else {
        // Idle: update cursor based on hover
        const state = useGridStore.getState();
        if (state.image.src) {
          const handleIdx = hitTestHandles(e.clientX, e.clientY);
          if (handleIdx >= 0) {
            canvas.style.cursor = HANDLE_CURSORS[handleIdx];
            return;
          }
          if (hitTestImageBox(e.clientX, e.clientY)) {
            canvas.style.cursor = 'move';
            return;
          }
        }
        const { interactionMode, spacebarPanActive } = useViewportStore.getState();
        const isActualPan = spacebarPanActive || interactionMode === 'pan';
        if (isActualPan) {
          canvas.style.cursor = 'grab';
        } else if (interactionMode === 'move') {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    const onPointerUp = () => {
      if (isResizingImage) {
        useGridStore.temporal.getState().resume();
        useGridStore.getState().updateGrid({}); // trigger undo snapshot
      }
      isDragging = false;
      isDraggingImage = false;
      isResizingImage = false;
      resizeHandleIndex = -1;
      useViewportStore.getState().setActiveSnapLines({ x: null, y: null });
      canvas.style.cursor = 'default';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        initialTouchDistance = Math.sqrt(dx * dx + dy * dy);
        
        const rect = canvas.getBoundingClientRect();
        initialTouchMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
        initialTouchMidY = (t1.clientY + t2.clientY) / 2 - rect.top;
        
        const state = useViewportStore.getState();
        initialZoom = state.zoom;
        initialPanX = state.panX;
        initialPanY = state.panY;
      } else if (e.touches.length === 1) {
        // Single finger touch is handled by pointer events, but we prevent default 
        // in touchmove if needed to stop browser scrolling.
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const rect = canvas.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        
        const zoomDelta = distance / initialTouchDistance;
        const newZoom = Math.min(Math.max(0.1, initialZoom * zoomDelta), 5);
        
        const nextPanX = midX - ((initialTouchMidX - initialPanX) * (newZoom / initialZoom));
        const nextPanY = midY - ((initialTouchMidY - initialPanY) * (newZoom / initialZoom));
        
        useViewportStore.getState().setZoom(newZoom);
        useViewportStore.getState().setPan(nextPanX, nextPanY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        // Reset or fallback
      }
    };
    
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []); 
  
  // Center paper on initial load
  useEffect(() => {
    const centerView = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      const { widthMm, heightMm } = getEffectivePaperDimensions(activePaper, customPresets);
      const paperW = widthMm * MM_TO_PX;
      const paperH = heightMm * MM_TO_PX;
      
      const padding = 40;
      const fitZoomX = (rect.width - padding * 2) / paperW;
      const fitZoomY = (rect.height - padding * 2) / paperH;
      const initialZoom = Math.min(fitZoomX, fitZoomY, 1); 
      
      const pX = (rect.width - paperW * initialZoom) / 2;
      const pY = (rect.height - paperH * initialZoom) / 2;
      
      useViewportStore.getState().setZoom(initialZoom);
      useViewportStore.getState().setPan(pX, pY);
    };
    
    setTimeout(centerView, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePaper.presetId, activePaper.orientation, activePaper.isCustom, activePaper.customWidthMm, activePaper.customHeightMm]);

  // Spacebar to pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        useViewportStore.getState().setSpacebarPanActive(true);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        useViewportStore.getState().setSpacebarPanActive(false);
        const { interactionMode } = useViewportStore.getState();
        if (canvasRef.current) canvasRef.current.style.cursor = interactionMode === 'pan' ? 'grab' : 'default';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
      loadImageFile(file);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden outline-none touch-none transition-colors duration-200 ${isDraggingOver ? 'bg-blue-900/20' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block" 
        tabIndex={0}
        style={{ touchAction: 'none' }}
      />
      
      {!image.src && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-neutral-600">
            <Upload size={48} className="mb-4 opacity-50" strokeWidth={1} />
            <h2 className="text-xl font-medium tracking-tight mb-2 text-neutral-400">Drop a reference image here</h2>
            <p className="text-sm">Supports JPG, PNG, and WebP</p>
          </div>
        </div>
      )}
    </div>
  );
}
