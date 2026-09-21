'use client';

import { useRef, useState, useEffect } from 'react';
import { 
  Undo2, Redo2, Trash2, Upload, Download, Image as ImageIcon, Grid as GridIcon, 
  File, SlidersHorizontal, Folder, Settings, ZoomIn, Printer, X, Link2,
  RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Copy
} from 'lucide-react';
import {
  useGridStore,
  useTemporalGridStore,
  PAPER_SIZES,
  getCellSizeMm,
  getCanvasPixelSize,
  getEffectivePaperDimensions,
  type FitMode,
  type Orientation,
  type Dpi
} from '@/store/useGridStore';
import ViewportCanvas from '@/components/ViewportCanvas';
import CanvasControls from '@/components/CanvasControls';
import UnitInput from '@/components/UnitInput';
import { handleExport } from '@/lib/export';
import { formatUnit, type MeasurementUnit } from '@/lib/units';
import { useProjectStore } from '@/store/useProjectStore';

type Tab = 'image' | 'grid' | 'paper' | 'adjustments' | 'projects' | 'settings';

const NavItem = ({ id, icon: Icon, label, activeTab, onClick }: { id: Tab, icon: React.ElementType, label: string, activeTab: Tab, onClick: () => void }) => {
  const isActive = activeTab === id;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 w-full lg:w-10 lg:h-10 rounded transition-colors group relative ${
        isActive ? 'text-blue-500' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
      }`}
      aria-label={label}
      title={label}
    >
      <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
      <span className="text-[9px] font-medium lg:hidden">{label}</span>
    </button>
  );
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const activePaper = useGridStore((s) => s.activePaper);

  const customPresets = useGridStore((s) => s.customPresets);
  const dpi = useGridStore((s) => s.dpi);
  const measurementUnit = useGridStore((s) => s.measurementUnit);
  const grid = useGridStore((s) => s.grid);
  const image = useGridStore((s) => s.image);

  const setPreset = useGridStore((s) => s.setPreset);
  const setOrientation = useGridStore((s) => s.setOrientation);
  const setMargins = useGridStore((s) => s.setMargins);
  const setCustomPaper = useGridStore((s) => s.setCustomPaper);
  const saveCustomPreset = useGridStore((s) => s.saveCustomPreset);
  const removeCustomPreset = useGridStore((s) => s.removeCustomPreset);
  const setDpi = useGridStore((s) => s.setDpi);
  const setMeasurementUnit = useGridStore((s) => s.setMeasurementUnit);
  const setColumns = useGridStore((s) => s.setColumns);
  const setRows = useGridStore((s) => s.setRows);
  const toggleLinked = useGridStore((s) => s.toggleLinked);
  const updateGrid = useGridStore((s) => s.updateGrid);
  const loadImageFile = useGridStore((s) => s.loadImageFile);
  const updateImage = useGridStore((s) => s.updateImage);
  const clearImage = useGridStore((s) => s.clearImage);
  const setFitMode = useGridStore((s) => s.setFitMode);
  const rotateImage = useGridStore((s) => s.rotateImage);
  const flipImage = useGridStore((s) => s.flipImage);

  const undo = useTemporalGridStore((s) => s.undo);
  const redo = useTemporalGridStore((s) => s.redo);
  const pastStates = useTemporalGridStore((s) => s.pastStates);
  const futureStates = useTemporalGridStore((s) => s.futureStates);

  const { widthPx, heightPx } = getCanvasPixelSize(activePaper, customPresets, dpi);
  const { cellWidthMm, cellHeightMm } = getCellSizeMm(activePaper, customPresets, grid);
  const { widthMm, heightMm, name: paperName } = getEffectivePaperDimensions(activePaper, customPresets);

  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFile(file);
      setActiveTab('grid');
    }
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            loadImageFile(file);
            setActiveTab('grid');
          }
          break;
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        // Don't interfere with standard input undo if focused
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        if (e.shiftKey) {
          useGridStore.temporal.getState().redo();
        } else {
          useGridStore.temporal.getState().undo();
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loadImageFile]);

  async function doExport(type: 'png-ref' | 'png-blank' | 'pdf' | 'print') {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      await handleExport({
        activePaper,
        customPresets,
        dpi,
        grid,
        image,
        type
      });
    } catch (e) {
      console.error(e);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  const renderInspector = () => {
    switch(activeTab) {
      case 'image':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Source</h3>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              
              {!image.src ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-700 bg-neutral-900 px-3 py-6 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
                >
                  <Upload size={20} /> 
                  <span>Upload or Paste</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded bg-neutral-900 p-2 border border-neutral-800">
                    <div 
                      className="w-12 h-12 bg-neutral-950 rounded border border-neutral-700 bg-cover bg-center" 
                      style={{ backgroundImage: `url(${image.src})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-200 truncate">{image.filename || 'Pasted Image'}</div>
                      <div className="text-[10px] text-neutral-500">{image.naturalWidthPx} × {image.naturalHeightPx} px</div>
                      <div className="text-[10px] text-neutral-500">{(image.naturalWidthPx / image.naturalHeightPx).toFixed(2)}:1</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-1.5 text-[10px] uppercase font-medium bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 transition-colors">Replace</button>
                     <button onClick={clearImage} className="flex-1 py-1.5 text-[10px] uppercase font-medium bg-red-950/30 text-red-400 hover:bg-red-950/50 rounded transition-colors border border-red-900/30">Remove</button>
                  </div>
                </div>
              )}
            </div>

            {image.src && (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Fit & Crop</h3>
                  <select
                    value={image.fitMode}
                    onChange={(e) => setFitMode(e.target.value as FitMode)}
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 transition-colors mb-3"
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="crop-to-paper">Crop to Paper</option>
                    <option value="original">Original Size</option>
                    <option value="free-crop">Free Crop</option>
                  </select>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Transform</h3>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <button onClick={() => rotateImage('left')} className="flex items-center justify-center p-2 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors" title="Rotate Left"><RotateCcw size={16}/></button>
                    <button onClick={() => rotateImage('right')} className="flex items-center justify-center p-2 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors" title="Rotate Right"><RotateCw size={16}/></button>
                    <button onClick={() => flipImage('h')} className="flex items-center justify-center p-2 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors" title="Flip Horizontal"><FlipHorizontal size={16}/></button>
                    <button onClick={() => flipImage('v')} className="flex items-center justify-center p-2 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors" title="Flip Vertical"><FlipVertical size={16}/></button>
                  </div>
                  
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={image.snapEnabled}
                      onChange={(e) => updateImage({ snapEnabled: e.target.checked })}
                      className="rounded border-neutral-700 bg-neutral-900 text-blue-600 focus:ring-blue-600/50"
                    />
                    Snap to edges & center
                  </label>
                </div>
              </>
            )}
          </div>
        );
      case 'grid':
        return (
          <div className="space-y-6">
             <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Mode</h3>
                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded border border-neutral-800">
                  <button onClick={() => useGridStore.getState().setGridMode('count')} className={`px-2 py-1 text-[10px] uppercase font-medium rounded ${grid.mode === 'count' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}>By Count</button>
                  <button onClick={() => useGridStore.getState().setGridMode('size')} className={`px-2 py-1 text-[10px] uppercase font-medium rounded ${grid.mode === 'size' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}>By Size</button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Layout</h3>
              
              {grid.mode === 'count' ? (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Columns</label>
                    <input type="number" min={1} max={100} value={grid.columns} onChange={(e) => setColumns(Number(e.target.value))} className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mb-[1px] rounded px-1.5 py-1.5 text-xs transition-colors ${grid.linked ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-600 hover:text-neutral-400'}`}><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Rows</label>
                    <input type="number" min={1} max={100} value={grid.rows} disabled={grid.linked} onChange={(e) => setRows(Number(e.target.value))} className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Width ({measurementUnit})</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellWidthMm} onChangeMm={(v) => useGridStore.getState().setCellSize(v, grid.cellHeightMm)} className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mb-[1px] rounded px-1.5 py-1.5 text-xs transition-colors ${grid.linked ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-600 hover:text-neutral-400'}`}><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Height ({measurementUnit})</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellHeightMm} disabled={grid.linked || grid.forceSquare} onChangeMm={(v) => useGridStore.getState().setCellSize(grid.cellWidthMm, v)} className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              )}
              
              <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                <input type="checkbox" checked={grid.forceSquare} onChange={useGridStore.getState().toggleForceSquare} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                Force perfectly square cells
              </label>

              <div className="mt-4 p-3 rounded bg-blue-950/20 border border-blue-900/30 text-center">
                <div className="text-[10px] text-blue-400/80 uppercase tracking-widest font-medium mb-1">Exact Cell Size</div>
                <div className="text-xl font-medium tracking-tight text-blue-100">
                  {formatUnit(cellWidthMm, measurementUnit, dpi)} <span className="text-blue-500">×</span> {formatUnit(cellHeightMm, measurementUnit, dpi)} <span className="text-sm text-blue-400/70">{measurementUnit}</span>
                </div>
                {grid.mode === 'size' && (
                  <div className="text-[10px] text-blue-400/60 mt-1">
                    Grid fits ~{((widthMm - activePaper.margins.left - activePaper.margins.right) / cellWidthMm).toFixed(1)} × ~{((heightMm - activePaper.margins.top - activePaper.margins.bottom) / cellHeightMm).toFixed(1)} cells
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Appearance</h3>
                <label className="flex items-center gap-2 text-[10px] text-neutral-400 cursor-pointer uppercase tracking-wider">
                  <input type="checkbox" checked={grid.visible} onChange={(e) => updateGrid({ visible: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                  Visible
                </label>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input type="color" value={grid.lineColor} onChange={(e) => updateGrid({ lineColor: e.target.value })} className="h-8 w-12 cursor-pointer rounded border border-neutral-800 bg-neutral-900 p-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                      <span>Opacity</span>
                      <span>{Math.round(grid.opacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.05" value={grid.opacity} 
                      onPointerDown={() => useGridStore.temporal.getState().pause()}
                      onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                      onChange={(e) => updateGrid({ opacity: Number(e.target.value) })} className="w-full accent-blue-500" />
                  </div>
                </div>
                
                <div>
                  <label className="flex justify-between mb-1.5 text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                    <span>Line Thickness</span>
                    <span>{grid.lineWidth}x</span>
                  </label>
                  <input type="range" min="0.5" max="5" step="0.5" value={grid.lineWidth} 
                    onPointerDown={() => useGridStore.temporal.getState().pause()}
                    onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                    onChange={(e) => updateGrid({ lineWidth: Number(e.target.value) })} className="w-full accent-blue-500" />
                </div>
                
                <div className="pt-2 border-t border-neutral-800 space-y-3">
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                    <input type="checkbox" checked={grid.centerLines} onChange={(e) => updateGrid({ centerLines: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                    Show center crosshairs
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Major Lines</span>
                    <select value={grid.majorLineFrequency} onChange={(e) => updateGrid({ majorLineFrequency: Number(e.target.value) })} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-300">
                      <option value="0">Off</option>
                      <option value="2">Every 2 cells</option>
                      <option value="4">Every 4 cells</option>
                      <option value="5">Every 5 cells</option>
                      <option value="10">Every 10 cells</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Labels</h3>
                <label className="flex items-center gap-2 text-[10px] text-neutral-400 cursor-pointer uppercase tracking-wider">
                  <input type="checkbox" checked={grid.showLabels} onChange={(e) => updateGrid({ showLabels: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                  Visible
                </label>
              </div>
              {grid.showLabels && (
                <div className="flex gap-2">
                  <button onClick={() => updateGrid({ labelPosition: 'top-left' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded transition-colors border ${grid.labelPosition === 'top-left' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-400'}`}>Top L</button>
                  <button onClick={() => updateGrid({ labelPosition: 'center' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded transition-colors border ${grid.labelPosition === 'center' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-400'}`}>Center</button>
                  <button onClick={() => updateGrid({ labelPosition: 'bottom-right' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded transition-colors border ${grid.labelPosition === 'bottom-right' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-400'}`}>Bot R</button>
                </div>
              )}
            </div>
          </div>
        );
      case 'paper':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Document Size</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Preset</label>
              <select
                value={activePaper.presetId}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 transition-colors mb-3"
              >
                <optgroup label="Standard">
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({formatUnit(p.widthMm, measurementUnit, dpi)} × {formatUnit(p.heightMm, measurementUnit, dpi)} {measurementUnit})
                    </option>
                  ))}
                </optgroup>
                {customPresets.length > 0 && (
                  <optgroup label="Custom">
                    {customPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({formatUnit(p.widthMm, measurementUnit, dpi)} × {formatUnit(p.heightMm, measurementUnit, dpi)} {measurementUnit})
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="custom">New Custom Size...</option>
              </select>

              {activePaper.isCustom && (
                <div className="space-y-3 mb-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Width ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customWidthMm || 210}
                        onChangeMm={(v) => setCustomPaper(v, activePaper.customHeightMm || 297, activePaper.customName)}
                        className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Height ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customHeightMm || 297}
                        onChangeMm={(v) => setCustomPaper(activePaper.customWidthMm || 210, v, activePaper.customName)}
                        className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => saveCustomPreset(prompt('Name for custom preset?', 'My Preset') || 'Custom')}
                    className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Save as Preset
                  </button>
                </div>
              )}

              {/* Orientation Toggle */}
              <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded border border-neutral-800">
                 <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded transition-colors ${activePaper.orientation === 'portrait' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}
                 >
                   Portrait
                 </button>
                 <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded transition-colors ${activePaper.orientation === 'landscape' ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:text-neutral-400'}`}
                 >
                   Landscape
                 </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Margins</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Top ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.top}
                    onChangeMm={(v) => setMargins({ top: v })}
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Bottom ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.bottom}
                    onChangeMm={(v) => setMargins({ bottom: v })}
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Left ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.left}
                    onChangeMm={(v) => setMargins({ left: v })}
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Right ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.right}
                    onChangeMm={(v) => setMargins({ right: v })}
                    className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Export Settings</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-neutral-500 uppercase tracking-wider">Resolution</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as Dpi)}
                className="w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-600 transition-colors"
              >
                <option value={72}>72 DPI (Web)</option>
                <option value={150}>150 DPI (Draft Print)</option>
                <option value={300}>300 DPI (Standard Print)</option>
                <option value={600}>600 DPI (High Detail)</option>
              </select>
            </div>
          </div>
        );
      case 'adjustments':
        return (
          <div className="space-y-6">
            {!image.src ? (
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-center">
                <SlidersHorizontal size={24} className="mx-auto text-neutral-600 mb-2" />
                <p className="text-[10px] text-neutral-400">Load an image to apply adjustments.</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Black & White</h3>
                    <label className="flex items-center gap-2 text-[10px] text-neutral-400 cursor-pointer uppercase tracking-wider">
                      <input type="checkbox" checked={image.blackAndWhite} onChange={(e) => updateImage({ blackAndWhite: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                      Enable
                    </label>
                  </div>
                  
                  {image.blackAndWhite && (
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                          <span>Threshold</span>
                          <span>{image.threshold}</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.threshold} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ threshold: Number(e.target.value) })} className="w-full accent-blue-500" />
                      </div>
                    </div>
                  )}
                </div>

                {!image.blackAndWhite && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">Color Adjustments</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                          <span>Brightness</span>
                          <span>{image.brightness}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.brightness} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ brightness: Number(e.target.value) })} className="w-full accent-blue-500" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-neutral-500 uppercase tracking-wider">
                          <span>Contrast</span>
                          <span>{image.contrast}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.contrast} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ contrast: Number(e.target.value) })} className="w-full accent-blue-500" />
                      </div>
                      
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                          <input type="checkbox" checked={image.grayscale} onChange={(e) => updateImage({ grayscale: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                          Grayscale
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-neutral-800">
                  <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer mb-4">
                    <input type="checkbox" checked={image.invert} onChange={(e) => updateImage({ invert: e.target.checked })} className="rounded border-neutral-700 bg-neutral-900 text-blue-600" />
                    Invert Image
                  </label>
                  
                  <button 
                    onClick={() => useGridStore.getState().resetAdjustments()}
                    className="w-full py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-[10px] uppercase font-medium transition-colors"
                  >
                    Reset Adjustments
                  </button>
                </div>
              </>
            )}
          </div>
        );
      case 'projects':
        return (
          <div className="space-y-4">
            <button 
              onClick={async () => {
                const snapshot = useGridStore.getState();
                const tn = snapshot.image.src || undefined;
                await createProject('Untitled Project', snapshot, tn);
              }}
              className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors mb-4"
            >
              New Project
            </button>

            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Recent Projects</h3>
              <button 
                onClick={async () => {
                  const snapshot = useGridStore.getState();
                  await saveCurrentProject(snapshot, snapshot.image.src || undefined);
                }}
                disabled={!activeProjectId}
                className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                Save Current
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                No local projects yet.
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id} className={`p-2 rounded border transition-colors group ${activeProjectId === p.id ? 'bg-neutral-800 border-neutral-600' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'}`}>
                    <div className="flex gap-3">
                      <div 
                        className="w-12 h-12 bg-neutral-950 rounded border border-neutral-800 flex-shrink-0 cursor-pointer overflow-hidden bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: p.thumbnail ? `url(${p.thumbnail})` : 'none' }}
                        onClick={async () => {
                          const snapshot = await loadProject(p.id);
                          if (snapshot) useGridStore.getState().loadSnapshot(snapshot);
                        }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <input 
                            type="text" 
                            defaultValue={p.name}
                            onBlur={(e) => {
                              if (e.target.value !== p.name) renameProject(p.id, e.target.value);
                            }}
                            className="bg-transparent text-xs text-neutral-200 outline-none w-full truncate border-b border-transparent focus:border-neutral-600"
                          />
                        </div>
                        <div className="text-[9px] text-neutral-500 mt-0.5">
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => duplicateProject(p.id)} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200" title="Duplicate"><Copy size={12}/></button>
                        <button onClick={() => deleteProject(p.id)} className="p-1 rounded hover:bg-red-900/30 text-neutral-500 hover:text-red-400" title="Delete"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-xs text-neutral-600 max-w-[150px]">
              Settings coming soon.
            </p>
          </div>
        );
    }
  };



  return (
    <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200 overflow-hidden font-sans">
      {/* Top Toolbar */}
      <header className="h-11 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 bg-neutral-950 z-20">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-neutral-200">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center hidden sm:flex">
              <GridIcon size={12} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-xs font-semibold tracking-tight hidden sm:block">GridSketch</span>
          </div>
          <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <Folder size={12} className="text-neutral-500 sm:hidden" />
            <span className="text-xs text-neutral-300 font-medium truncate max-w-[120px] sm:max-w-[200px]">
              {activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'Untitled Project'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => useGridStore.temporal.getState().undo()}
            disabled={pastStates.length === 0}
            className="hidden sm:flex p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => useGridStore.temporal.getState().redo()}
            disabled={futureStates.length === 0}
            className="hidden sm:flex p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block"></div>
          <div className="hidden sm:flex items-center">
            <select
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
              className="bg-transparent text-xs text-neutral-400 outline-none hover:text-neutral-200 cursor-pointer appearance-none pr-4 font-medium"
              style={{ background: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 0.15rem center/0.4rem` }}
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="in">in</option>
              <option value="px">px</option>
            </select>
          </div>
          <div className="h-4 w-px bg-neutral-800 mx-1"></div>
          <button onClick={() => doExport('print')} disabled={isExporting} className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors hidden sm:block" title="Print at 100% Actual Size">
            <Printer size={16} />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="ml-1 flex items-center gap-2 rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
            
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded shadow-xl z-50 py-1 flex flex-col">
                  <div className="px-3 py-2 border-b border-neutral-800">
                    <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Format Options</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">{dpi} DPI Output</div>
                  </div>
                  <button onClick={() => doExport('png-ref')} className="text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors">
                    PNG (Image + Grid)
                  </button>
                  <button onClick={() => doExport('png-blank')} className="text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors">
                    PNG (Blank Grid Only)
                  </button>
                  <button onClick={() => doExport('pdf')} className="text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors border-t border-neutral-800">
                    Print-Ready PDF
                  </button>
                  <button onClick={() => doExport('print')} className="text-left px-3 py-2 text-xs text-neutral-200 hover:bg-neutral-800 transition-colors">
                    Print (100% Actual Size)
                  </button>
                  <div className="px-3 py-2 bg-neutral-950 mt-1 border-t border-neutral-800">
                    <p className="text-[9px] text-neutral-500 leading-tight">
                      For physical accuracy, use PDF/Print and ensure &quot;Fit to Page&quot; is disabled in your printer settings.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden relative pb-14 lg:pb-0">
        {/* Canvas - main content */}
        <main className="flex-1 bg-[var(--color-canvas-bg)] lg:order-2 flex items-center justify-center overflow-hidden relative" onClick={() => setIsInspectorOpen(false)}>
          <ViewportCanvas />
          <CanvasControls />
        </main>

        {/* Left Rail / Bottom Nav */}
        <nav className="fixed bottom-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] lg:static lg:h-full lg:w-14 border-t lg:border-t-0 lg:border-r border-neutral-800 bg-neutral-950/95 backdrop-blur-md flex lg:flex-col items-center justify-around lg:justify-start lg:py-4 shrink-0 z-40">
          <NavItem id="image" icon={ImageIcon} label="Image" activeTab={activeTab} onClick={() => { setActiveTab('image'); setIsInspectorOpen(true); }} />
          <NavItem id="grid" icon={GridIcon} label="Grid" activeTab={activeTab} onClick={() => { setActiveTab('grid'); setIsInspectorOpen(true); }} />
          <NavItem id="paper" icon={File} label="Paper" activeTab={activeTab} onClick={() => { setActiveTab('paper'); setIsInspectorOpen(true); }} />
          <NavItem id="adjustments" icon={SlidersHorizontal} label="Adjust" activeTab={activeTab} onClick={() => { setActiveTab('adjustments'); setIsInspectorOpen(true); }} />
          <div className="hidden lg:block h-px w-8 bg-neutral-800 my-2"></div>
          <NavItem id="projects" icon={Folder} label="Projects" activeTab={activeTab} onClick={() => { setActiveTab('projects'); setIsInspectorOpen(true); }} />
          <div className="lg:mt-auto"></div>
          <NavItem id="settings" icon={Settings} label="Settings" activeTab={activeTab} onClick={() => { setActiveTab('settings'); setIsInspectorOpen(true); }} />
        </nav>

        {/* Right Inspector / Bottom Sheet */}
        <aside className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-neutral-950 border-t border-neutral-800 z-30 rounded-t-2xl transform transition-transform duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[65dvh] flex flex-col
                          ${isInspectorOpen ? 'translate-y-0' : 'translate-y-full'}
                          lg:static lg:translate-y-0 lg:h-full lg:w-[280px] lg:border-t-0 lg:border-l lg:rounded-none lg:shadow-none lg:shrink-0`}>
          <div className="flex items-center justify-between p-3.5 border-b border-neutral-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              {activeTab}
            </span>
            <button 
              onClick={() => setIsInspectorOpen(false)}
              className="lg:hidden p-2 -mr-2 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-8 lg:pb-4">
            {renderInspector()}
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-7 border-t border-neutral-800 hidden sm:flex items-center justify-between px-4 text-[10px] text-neutral-500 tracking-wide shrink-0 bg-neutral-950 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <File size={10} /> 
            {paperName} {activePaper.orientation.charAt(0).toUpperCase() + activePaper.orientation.slice(1)}
          </span>
          <span className="hidden sm:inline">{formatUnit(widthMm, measurementUnit, dpi)} × {formatUnit(heightMm, measurementUnit, dpi)} {measurementUnit}</span>
          <span className="hidden md:inline">Cell: {formatUnit(cellWidthMm, measurementUnit, dpi)} × {formatUnit(cellHeightMm, measurementUnit, dpi)} {measurementUnit}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{widthPx} × {heightPx} px @ {dpi} DPI</span>
          <span className="flex items-center gap-1"><ZoomIn size={12} /> Fit</span>
        </div>
      </footer>
    </div>
  );
}
