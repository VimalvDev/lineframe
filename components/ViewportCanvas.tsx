'use client';

import { useEffect, useRef, useState } from 'react';
import { useGridStore, getEffectivePaperDimensions } from '@/store/useGridStore';
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

  const { zoom, panX, panY, setZoom, setPan } = useViewportStore();

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

    let initialTouchDistance = 0;
    let initialTouchMidX = 0;
    let initialTouchMidY = 0;
    let initialZoom = 1;
    let initialPanX = 0;
    let initialPanY = 0;

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
      const { isPanMode, zoom, panX, panY } = useViewportStore.getState();
      const state = useGridStore.getState();
      
      if (e.button === 1 || e.button === 2 || isPanMode || e.shiftKey) {
        isDragging = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        canvas.style.cursor = 'grabbing';
        return;
      }
      
      if (state.image.src) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const worldX = (screenX - panX) / zoom;
        const worldY = (screenY - panY) / zoom;
        
        const mmX = worldX / MM_TO_PX;
        const mmY = worldY / MM_TO_PX;
        
        const img = state.image;
        if (mmX >= img.xMm && mmX <= img.xMm + img.widthMm &&
            mmY >= img.yMm && mmY <= img.yMm + img.heightMm) {
          isDraggingImage = true;
          lastClientX = e.clientX;
          lastClientY = e.clientY;
          canvas.style.cursor = 'move';
        }
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
      } else if (isDraggingImage) {
        const dx = e.clientX - lastClientX;
        const dy = e.clientY - lastClientY;
        const { zoom } = useViewportStore.getState();
        
        const dxMm = (dx / zoom) / MM_TO_PX;
        const dyMm = (dy / zoom) / MM_TO_PX;
        
        const img = useGridStore.getState().image;
        useGridStore.getState().updateImage({ 
          panXMm: img.panXMm + dxMm, 
          panYMm: img.panYMm + dyMm 
        });
        lastClientX = e.clientX;
        lastClientY = e.clientY;
      } else {
        const { isPanMode } = useViewportStore.getState();
        if (isPanMode) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      isDraggingImage = false;
      const { isPanMode } = useViewportStore.getState();
      canvas.style.cursor = isPanMode ? 'grab' : 'default';
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
        useViewportStore.getState().setPanMode(true);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        useViewportStore.getState().setPanMode(false);
        if (canvasRef.current) canvasRef.current.style.cursor = 'default';
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
