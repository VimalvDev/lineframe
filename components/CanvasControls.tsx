'use client';

import { ZoomIn, ZoomOut, Maximize, Hand } from 'lucide-react';
import { useViewportStore } from '@/store/useViewportStore';
import { useGridStore, getEffectivePaperDimensions } from '@/store/useGridStore';

const MM_TO_PX = 3.7795;

export default function CanvasControls() {
  const { zoom, isPanMode, setZoom, setPan, setPanMode } = useViewportStore();
  const activePaper = useGridStore((s) => s.activePaper);
  const customPresets = useGridStore((s) => s.customPresets);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.1, 5));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.1, 0.1));
  
  const handleFit = () => {
    // Assuming the canvas is the main view area
    const container = document.querySelector('main');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const { widthMm, heightMm } = getEffectivePaperDimensions(activePaper, customPresets);
    const paperW = widthMm * MM_TO_PX;
    const paperH = heightMm * MM_TO_PX;
    
    const padding = 40;
    const fitZoomX = (rect.width - padding * 2) / paperW;
    const fitZoomY = (rect.height - padding * 2) / paperH;
    const newZoom = Math.min(fitZoomX, fitZoomY, 1);
    
    const newPanX = (rect.width - paperW * newZoom) / 2;
    const newPanY = (rect.height - paperH * newZoom) / 2;
    
    setZoom(newZoom);
    setPan(newPanX, newPanY);
  };

  const handlePresetZoom = (preset: number) => {
    const container = document.querySelector('main');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { widthMm, heightMm } = getEffectivePaperDimensions(activePaper, customPresets);
    const paperW = widthMm * MM_TO_PX;
    const paperH = heightMm * MM_TO_PX;
    
    // Center it
    const newPanX = (rect.width - paperW * preset) / 2;
    const newPanY = (rect.height - paperH * preset) / 2;
    
    setZoom(preset);
    setPan(newPanX, newPanY);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl text-neutral-300">
      <button 
        onClick={() => setPanMode(!isPanMode)}
        className={`p-2 rounded transition-colors ${isPanMode ? 'bg-blue-600/20 text-blue-500' : 'hover:bg-neutral-800'}`}
        title="Pan (Hold Space)"
      >
        <Hand size={16} />
      </button>
      
      <div className="w-px h-4 bg-neutral-800 mx-1"></div>

      <button onClick={handleZoomOut} className="p-2 rounded hover:bg-neutral-800 transition-colors" title="Zoom Out">
        <ZoomOut size={16} />
      </button>

      <div className="relative group px-1">
        <span className="text-xs font-mono w-12 text-center inline-block tabular-nums cursor-pointer hover:text-white">
          {Math.round(zoom * 100)}%
        </span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-1 w-24 bg-neutral-900 border border-neutral-800 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col">
          <button onClick={() => handlePresetZoom(0.5)} className="px-3 py-1.5 text-xs text-left hover:bg-neutral-800">50%</button>
          <button onClick={() => handlePresetZoom(1)} className="px-3 py-1.5 text-xs text-left hover:bg-neutral-800">100%</button>
          <button onClick={() => handlePresetZoom(2)} className="px-3 py-1.5 text-xs text-left hover:bg-neutral-800">200%</button>
        </div>
      </div>

      <button onClick={handleZoomIn} className="p-2 rounded hover:bg-neutral-800 transition-colors" title="Zoom In">
        <ZoomIn size={16} />
      </button>

      <div className="w-px h-4 bg-neutral-800 mx-1"></div>

      <button onClick={handleFit} className="p-2 rounded hover:bg-neutral-800 transition-colors" title="Fit to Screen">
        <Maximize size={16} />
      </button>
    </div>
  );
}
