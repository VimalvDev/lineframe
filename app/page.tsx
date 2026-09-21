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
  getProjectSnapshot,
  defaultPaper,
  defaultGrid,
  defaultImage,
  type FitMode,
  type Dpi
} from '@/store/useGridStore';
import ViewportCanvas from '@/components/ViewportCanvas';
import CanvasControls from '@/components/CanvasControls';
import UnitInput from '@/components/UnitInput';
import { handleExport } from '@/lib/export';
import { formatUnit, type MeasurementUnit } from '@/lib/units';
import { useViewportStore } from '@/store/useViewportStore';
import { useProjectStore } from '@/store/useProjectStore';

type Tab = 'image' | 'grid' | 'paper' | 'adjustments' | 'projects' | 'settings';

const NavItem = ({ id, icon: Icon, label, activeTab, onClick }: { id: Tab, icon: React.ElementType, label: string, activeTab: Tab, onClick: () => void }) => {
  const isActive = activeTab === id;
  return (
    <button
      onClick={onClick}
      className={`flex lg:flex-row flex-col items-center gap-1 lg:gap-3 lg:w-full lg:px-4 lg:py-3 transition-all duration-150 ease-out group ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
      aria-label={label}
    >
      <div className={`relative flex items-center justify-center p-1.5 lg:p-2 rounded-[var(--radius-control)] transition-all duration-150 ease-out ${isActive ? 'bg-[var(--color-accent-soft)]' : 'group-hover:bg-[var(--color-app-surface-raised)]'}`}>
        <Icon size={18} className="lg:w-5 lg:h-5" />
      </div>
      <span className={`text-[9px] lg:text-[11px] font-medium transition-colors duration-150 ease-out ${isActive ? 'text-[var(--color-text-primary)]' : ''}`}>{label}</span>
    </button>
  );
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf' | 'print'>('png');
  const [exportContent, setExportContent] = useState<'ref' | 'blank'>('ref');
  const [exportCalibration, setExportCalibration] = useState(false);
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

  const pastStates = useTemporalGridStore((s) => s.pastStates);
  const futureStates = useTemporalGridStore((s) => s.futureStates);

  const { widthPx, heightPx } = getCanvasPixelSize(activePaper, customPresets, dpi);
  const { cellWidthMm, cellHeightMm } = getCellSizeMm(activePaper, customPresets, grid);
  const { widthMm, heightMm, name: paperName } = getEffectivePaperDimensions(activePaper, customPresets);
  const imageAspect = image.widthMm / image.heightMm;
  const paperAspect = widthMm / heightMm;
  const imageMatchesPaperAspect = !image.src || Math.abs(imageAspect - paperAspect) < 0.01;

  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const createProject = useProjectStore((s) => s.createProject);
  const saveCurrentProject = useProjectStore((s) => s.saveCurrentProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImageFile(file);
    }
  };

  useEffect(() => {

    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    const timeout = setTimeout(() => {
      const state = useGridStore.getState();
      const snap = getProjectSnapshot(state);
      saveCurrentProject(snap, snap.image.src || undefined);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [activeProjectId, activePaper, customPresets, dpi, measurementUnit, image, grid, saveCurrentProject]);

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

  async function doExport(type: 'png-ref' | 'png-blank' | 'pdf' | 'print', calibrationLine?: boolean) {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      await handleExport({
        activePaper,
        customPresets,
        dpi,
        grid,
        image,
        type,
        calibrationLine
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
          <div className="flex flex-col">
            {/* SOURCE */}
            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">SOURCE</h3>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              
              {!image.src ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-[var(--color-panel-border)] bg-transparent px-3 py-6 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-app-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Upload size={16} /> 
                  <span>Upload or Paste</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-transparent p-0 transition-colors">
                    <div 
                      className="w-10 h-10 bg-[var(--color-app-bg)] rounded-[var(--radius-control)] border border-[var(--color-panel-border-subtle)] bg-cover bg-center shrink-0 transition-colors" 
                      style={{ backgroundImage: `url(${image.src})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-[var(--color-text-primary)] truncate transition-colors">{image.filename || 'Pasted Image'}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] transition-colors">{image.naturalWidthPx} × {image.naturalHeightPx} px</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] transition-colors">{(image.naturalWidthPx / image.naturalHeightPx).toFixed(2)}:1</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-1 text-[10px] bg-transparent border border-[var(--color-panel-border-subtle)] hover:bg-[var(--color-app-surface-raised)] rounded-[var(--radius-button)] text-[var(--color-text-primary)] transition-colors">Replace</button>
                     <button onClick={clearImage} className="flex-1 py-1 text-[10px] bg-transparent border border-red-900/30 text-[var(--color-danger)] hover:bg-red-950/20 rounded-[var(--radius-button)] transition-colors">Remove</button>
                  </div>
                </div>
              )}
            </div>

            {image.src && (
              <>
                {/* FIT & CROP */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">FIT & CROP</h3>
                  <select
                    value={image.fitMode}
                    onChange={(e) => setFitMode(e.target.value as FitMode)}
                    className="w-full bg-transparent border border-[var(--color-panel-border)] hover:border-[var(--color-panel-border-subtle)] rounded-[var(--radius-control)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] cursor-pointer outline-none transition-colors"
                  >
                    <option value="original">Free Crop</option>
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="crop-to-paper">Crop to Paper</option>
                  </select>

                  {!imageMatchesPaperAspect && image.fitMode === 'crop-to-paper' && (
                    <div className="mt-2 text-[9px] text-amber-500/80 leading-tight transition-colors">
                      Image aspect ratio does not match paper.
                    </div>
                  )}
                </div>

                {/* TRANSFORM */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">TRANSFORM</h3>
                  <div className="flex gap-1 bg-[var(--color-input)] p-0.5 rounded-[var(--radius-control)] border border-[var(--color-input-border)] transition-colors">
                    <button onClick={() => rotateImage('left')} className="flex-1 flex items-center justify-center py-1 rounded-[var(--radius-control)] bg-transparent hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Rotate Left"><RotateCcw size={14}/></button>
                    <button onClick={() => rotateImage('right')} className="flex-1 flex items-center justify-center py-1 rounded-[var(--radius-control)] bg-transparent hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Rotate Right"><RotateCw size={14}/></button>
                    <button onClick={() => flipImage('h')} className="flex-1 flex items-center justify-center py-1 rounded-[var(--radius-control)] bg-transparent hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Flip Horizontal"><FlipHorizontal size={14}/></button>
                    <button onClick={() => flipImage('v')} className="flex-1 flex items-center justify-center py-1 rounded-[var(--radius-control)] bg-transparent hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Flip Vertical"><FlipVertical size={14}/></button>
                  </div>
                </div>

                {/* IMAGE SCALE */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">IMAGE SCALE</h3>
                  <div className="flex items-end gap-2 mb-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Width</label>
                      <UnitInput 
                        unit={measurementUnit} dpi={dpi} min={1} 
                        valueMm={image.scale * (image.naturalWidthPx / 3.7795)} 
                        onChangeMm={(v) => {
                          const newScale = v / (image.naturalWidthPx / 3.7795);
                          updateImage({ scale: newScale });
                        }} 
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" 
                      />
                    </div>
                    <button 
                      onClick={() => updateImage({ isAspectRatioLocked: !image.isAspectRatioLocked })} 
                      className={`mb-[1px] rounded-[var(--radius-control)] p-1 transition-colors ${image.isAspectRatioLocked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      data-tooltip="Lock Aspect Ratio"
                    >
                      <Link2 size={14} />
                    </button>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Height</label>
                      <UnitInput 
                        unit={measurementUnit} dpi={dpi} min={1} 
                        valueMm={image.scale * (image.naturalHeightPx / 3.7795)} 
                        onChangeMm={(v) => {
                          const newScale = v / (image.naturalHeightPx / 3.7795);
                          updateImage({ scale: newScale });
                        }} 
                        disabled={image.isAspectRatioLocked} 
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors" 
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={image.isAspectRatioLocked}
                      onChange={(e) => updateImage({ isAspectRatioLocked: e.target.checked })}
                      className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors"
                    />
                    Maintain aspect ratio
                  </label>
                </div>

                {/* POSITION */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">POSITION</h3>
                  <div className="flex gap-2 items-end mb-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">X</label>
                      <UnitInput 
                        unit={measurementUnit} dpi={dpi} 
                        valueMm={image.panXMm} 
                        onChangeMm={(v) => updateImage({ panXMm: v })} 
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Y</label>
                      <UnitInput 
                        unit={measurementUnit} dpi={dpi} 
                        valueMm={image.panYMm} 
                        onChangeMm={(v) => updateImage({ panYMm: v })} 
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-[10px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" 
                      />
                    </div>
                  </div>
                  <button 
                     onClick={() => updateImage({ panXMm: 0, panYMm: 0 })}
                     className="w-full py-1 text-[10px] bg-[var(--color-app-surface-raised)] hover:bg-[var(--color-panel-border)] rounded-[var(--radius-button)] text-[var(--color-text-primary)] transition-colors"
                  >
                     Center Image
                  </button>
                </div>

                {/* SNAPPING */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">SNAPPING</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                      <input type="checkbox" checked={grid.snapToGrid} onChange={(e) => updateGrid({ snapToGrid: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                      Snap to grid
                    </label>
                    <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                      <input type="checkbox" checked={grid.snapToPaper} onChange={(e) => updateGrid({ snapToPaper: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                      Snap to paper edges
                    </label>
                  </div>
                </div>

                {/* RESET */}
                <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
                  <button 
                     onClick={() => updateImage({ scale: 1, panXMm: 0, panYMm: 0, rotation: 0, flipH: false, flipV: false, fitMode: 'contain' })}
                     className="w-full py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-panel-border-subtle)] hover:bg-[var(--color-app-surface-raised)] rounded-[var(--radius-button)] transition-colors"
                  >
                     Reset Image
                  </button>
                </div>
              </>
            )}
          </div>
        );
      case 'grid':
        return (
          <div className="flex flex-col">
            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors">GRID</h3>
                <div className="flex bg-[var(--color-input)] p-0.5 rounded-[var(--radius-control)] border border-[var(--color-input-border)] transition-colors">
                  <button onClick={() => useGridStore.getState().setGridMode('count')} className={`px-2 py-1 text-[10px] rounded-[var(--radius-control)] transition-colors ${grid.mode === 'count' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>Count</button>
                  <button onClick={() => useGridStore.getState().setGridMode('size')} className={`px-2 py-1 text-[10px] rounded-[var(--radius-control)] transition-colors ${grid.mode === 'size' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>Size</button>
                </div>
              </div>

              {grid.mode === 'count' ? (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Columns</label>
                    <input type="number" min={1} max={100} value={grid.columns} onChange={(e) => setColumns(Number(e.target.value))} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mt-4 rounded-[var(--radius-control)] p-1 transition-colors ${grid.linked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`} data-tooltip="Link Dimensions"><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Rows</label>
                    <input type="number" min={1} max={100} value={grid.rows} disabled={grid.linked} onChange={(e) => setRows(Number(e.target.value))} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Width</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellWidthMm} onChangeMm={(v) => useGridStore.getState().setCellSize(v, grid.cellHeightMm)} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mt-4 rounded-[var(--radius-control)] p-1 transition-colors ${grid.linked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`} data-tooltip="Link Dimensions"><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] text-[var(--color-text-muted)] transition-colors">Height</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellHeightMm} disabled={grid.linked || grid.forceSquare} onChangeMm={(v) => useGridStore.getState().setCellSize(grid.cellWidthMm, v)} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              )}
              
              <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer mt-3 mb-4 transition-colors">
                <input type="checkbox" checked={grid.forceSquare} onChange={useGridStore.getState().toggleForceSquare} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                Square cells
              </label>

              <div className="pt-3 border-t border-[var(--color-panel-border-subtle)] transition-colors">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold mb-1 transition-colors">Cell Size</div>
                <div className="text-xl font-medium tracking-tight text-[var(--color-text-primary)] transition-colors">
                  {formatUnit(cellWidthMm, measurementUnit, dpi)} <span className="text-[var(--color-text-muted)] font-normal mx-1 transition-colors">×</span> {formatUnit(cellHeightMm, measurementUnit, dpi)} <span className="text-xs text-[var(--color-text-muted)] ml-1 transition-colors">{measurementUnit}</span>
                </div>
                {grid.mode === 'size' && (
                  <div className="text-[9px] text-[var(--color-text-muted)] mt-1 transition-colors">
                    Fills ~{((widthMm - activePaper.margins.left - activePaper.margins.right) / cellWidthMm).toFixed(1)} × ~{((heightMm - activePaper.margins.top - activePaper.margins.bottom) / cellHeightMm).toFixed(1)} cells
                  </div>
                )}
                {grid.mode === 'count' && grid.forceSquare && (
                  <div className="text-[9px] text-[var(--color-text-muted)] mt-1 transition-colors">
                    Unused vertical space: {formatUnit((heightMm - activePaper.margins.top - activePaper.margins.bottom) - (cellHeightMm * grid.rows), measurementUnit, dpi)} {measurementUnit}
                  </div>
                )}
              </div>
            </div>

            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors">Appearance</h3>
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer transition-colors">
                  <input type="checkbox" checked={grid.visible} onChange={(e) => updateGrid({ visible: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                  Visible
                </label>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-7 h-7 rounded-[var(--radius-control)] border border-[var(--color-panel-border-subtle)] overflow-hidden shrink-0 transition-colors">
                    <input type="color" value={grid.lineColor} onChange={(e) => updateGrid({ lineColor: e.target.value })} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1.5 text-[10px] text-[var(--color-text-muted)] transition-colors">
                      <span>Opacity</span>
                      <span>{Math.round(grid.opacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.05" value={grid.opacity} 
                      onPointerDown={() => useGridStore.temporal.getState().pause()}
                      onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                      onChange={(e) => updateGrid({ opacity: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] h-1 bg-[var(--color-input)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[var(--color-text-primary)] [&::-webkit-slider-thumb]:rounded-full transition-colors" />
                  </div>
                </div>
                
                <div>
                  <label className="flex justify-between mb-1.5 text-[10px] text-[var(--color-text-muted)] transition-colors">
                    <span>Line Thickness</span>
                    <span>{grid.lineWidth} px</span>
                  </label>
                  <input type="range" min="0.5" max="5" step="0.5" value={grid.lineWidth} 
                    onPointerDown={() => useGridStore.temporal.getState().pause()}
                    onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                    onChange={(e) => updateGrid({ lineWidth: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] h-1 bg-[var(--color-input)] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[var(--color-text-primary)] [&::-webkit-slider-thumb]:rounded-full transition-colors" />
                </div>

                <div className="pt-4 mt-2 border-t border-[var(--color-panel-border-subtle)] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-[var(--color-text-primary)] transition-colors">Major lines</span>
                    <select value={grid.majorLineFrequency} onChange={(e) => updateGrid({ majorLineFrequency: Number(e.target.value) })} className="bg-transparent border border-transparent hover:border-[var(--color-panel-border)] rounded-[var(--radius-control)] px-1 py-0.5 text-[10px] text-[var(--color-text-primary)] cursor-pointer outline-none transition-colors">
                      <option value="0">Off</option>
                      <option value="5">Every 5</option>
                      <option value="10">Every 10</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                    <input type="checkbox" checked={grid.centerLines} onChange={(e) => updateGrid({ centerLines: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                    Center crosshair
                  </label>
                </div>
              </div>
            </div>

            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors">Labels</h3>
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer transition-colors">
                  <input type="checkbox" checked={grid.showLabels} onChange={(e) => updateGrid({ showLabels: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                  Show labels
                </label>
              </div>
              
              {grid.showLabels && (
                <div className="flex gap-1 bg-[var(--color-input)] p-0.5 rounded-[var(--radius-control)] border border-[var(--color-input-border)] mt-3 transition-colors">
                  <button onClick={() => updateGrid({ labelPosition: 'top-left' })} className={`flex-1 py-1 text-[9px] rounded-[var(--radius-control)] transition-colors ${grid.labelPosition === 'top-left' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Top Left</button>
                  <button onClick={() => updateGrid({ labelPosition: 'center' })} className={`flex-1 py-1 text-[9px] rounded-[var(--radius-control)] transition-colors ${grid.labelPosition === 'center' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Center</button>
                  <button onClick={() => updateGrid({ labelPosition: 'bottom-right' })} className={`flex-1 py-1 text-[9px] rounded-[var(--radius-control)] transition-colors ${grid.labelPosition === 'bottom-right' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>Bottom Right</button>
                </div>
              )}
            </div>

            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">Snapping</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                  <input type="checkbox" checked={grid.snapToGrid} onChange={(e) => updateGrid({ snapToGrid: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                  Snap image to grid
                </label>
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-primary)] cursor-pointer transition-colors">
                  <input type="checkbox" checked={grid.snapToPaper} onChange={(e) => updateGrid({ snapToPaper: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-input)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                  Snap to paper edges
                </label>
              </div>
            </div>

            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors">Unit</h3>
                <select 
                  value={measurementUnit} 
                  onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
                  className="bg-transparent border border-transparent hover:border-[var(--color-panel-border)] rounded-[var(--radius-control)] px-1 py-0.5 text-[10px] text-[var(--color-text-primary)] cursor-pointer outline-none transition-colors"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                  <option value="px">px</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 'paper':
        return (
          <div className="flex flex-col">
            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">Document Size</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Preset</label>
              <select
                value={activePaper.presetId}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors mb-3"
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
                <div className="space-y-3 mb-3 pt-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Width ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customWidthMm || 210}
                        onChangeMm={(v) => setCustomPaper(v, activePaper.customHeightMm || 297, activePaper.customName)}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Height ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customHeightMm || 297}
                        onChangeMm={(v) => setCustomPaper(activePaper.customWidthMm || 210, v, activePaper.customName)}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => saveCustomPreset(prompt('Name for custom preset?', 'My Preset') || 'Custom')}
                    className="w-full py-1 rounded-[var(--radius-button)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium transition-colors"
                  >
                    Save as Preset
                  </button>
                </div>
              )}

              {/* Orientation Toggle */}
              <div className="flex items-center gap-1 bg-[var(--color-app-surface)] p-1 rounded-[var(--radius-control)] border border-[var(--color-panel-border)] mt-1 transition-colors">
                 <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 py-1 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors ${activePaper.orientation === 'portrait' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                 >
                   Portrait
                 </button>
                 <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 py-1 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors ${activePaper.orientation === 'landscape' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                 >
                   Landscape
                 </button>
              </div>
            </div>
            
            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">Margins</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Top ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.top}
                    onChangeMm={(v) => setMargins({ top: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Bottom ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.bottom}
                    onChangeMm={(v) => setMargins({ bottom: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Left ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.left}
                    onChangeMm={(v) => setMargins({ left: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Right ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.right}
                    onChangeMm={(v) => setMargins({ right: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pb-5 mb-5 border-b border-[var(--color-panel-border-subtle)] last:border-b-0 last:pb-0 last:mb-0 transition-colors">
              <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-3 transition-colors">Export Settings</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)]  transition-colors">Resolution</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as Dpi)}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
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
          <div className="flex flex-col">
            {!image.src ? (
              <div className="p-4 bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] rounded-[var(--radius-panel)] text-center transition-colors">
                <SlidersHorizontal size={24} className="mx-auto text-[var(--color-text-muted)] mb-2 transition-colors" />
                <p className="text-[10px] text-[var(--color-text-muted)] transition-colors">Load an image to apply adjustments.</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-[var(--color-text-primary)]  transition-colors">Black & White</h3>
                    <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer  transition-colors">
                      <input type="checkbox" checked={image.blackAndWhite} onChange={(e) => updateImage({ blackAndWhite: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                      Enable
                    </label>
                  </div>
                  
                  {image.blackAndWhite && (
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-[var(--color-text-muted)]  transition-colors">
                          <span>Threshold</span>
                          <span>{image.threshold}</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.threshold} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ threshold: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] cursor-ew-resize" />
                      </div>
                    </div>
                  )}
                </div>

                {!image.blackAndWhite && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--color-text-primary)]  mb-3 transition-colors">Color Adjustments</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-[var(--color-text-muted)]  transition-colors">
                          <span>Brightness</span>
                          <span>{image.brightness}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.brightness} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ brightness: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] cursor-ew-resize" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-1 text-[10px] text-[var(--color-text-muted)]  transition-colors">
                          <span>Contrast</span>
                          <span>{image.contrast}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={image.contrast} 
                          onPointerDown={() => useGridStore.temporal.getState().pause()}
                          onPointerUp={() => { useGridStore.temporal.getState().resume(); updateImage({}); }}
                          onChange={(e) => updateImage({ contrast: Number(e.target.value) })} className="w-full accent-[var(--color-accent)] cursor-ew-resize" />
                      </div>
                      
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors">
                          <input type="checkbox" checked={image.grayscale} onChange={(e) => updateImage({ grayscale: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                          Grayscale
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--color-panel-border)] transition-colors">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors mb-4">
                    <input type="checkbox" checked={image.invert} onChange={(e) => updateImage({ invert: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                    Invert Image
                  </label>
                  
                  <button 
                    onClick={() => useGridStore.getState().resetAdjustments()}
                    className="w-full py-2 rounded-[var(--radius-button)] bg-[var(--color-app-surface-raised)] hover:bg-[var(--color-panel-border)] border border-[var(--color-panel-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[10px] uppercase font-bold tracking-wider transition-colors"
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
                useGridStore.setState({ activePaper: defaultPaper, grid: defaultGrid, image: defaultImage });
                const snapshot = getProjectSnapshot(useGridStore.getState());
                await createProject('Untitled Project', snapshot, undefined);
              }}
              className="w-full py-2 rounded-[var(--radius-button)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] text-xs font-medium transition-colors mb-6 shadow-sm"
            >
              New Project
            </button>

            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)]  transition-colors">Recent Projects</h3>
              <button 
                onClick={async () => {
                  const state = useGridStore.getState();
                  const snap = getProjectSnapshot(state);
                  await saveCurrentProject(snap, snap.image.src || undefined);
                }}
                disabled={!activeProjectId}
                className="text-[10px] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
              >
                Save Current
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-panel-border)] rounded-[var(--radius-panel)] bg-[var(--color-app-surface)] transition-colors">
                No local projects yet.
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={p.id} className={`p-2 rounded-[var(--radius-panel)] border transition-colors group ${activeProjectId === p.id ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]' : 'bg-[var(--color-app-surface)] border-[var(--color-panel-border)] hover:border-[var(--color-panel-border-subtle)]'}`}>
                    <div className="flex gap-3">
                      <div 
                        className="w-12 h-12 bg-[var(--color-app-bg)] rounded-[var(--radius-control)] border border-[var(--color-panel-border-subtle)] flex-shrink-0 cursor-pointer overflow-hidden bg-contain bg-center bg-no-repeat transition-transform hover:scale-105 transition-colors"
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
                            className="bg-transparent text-xs font-medium text-[var(--color-text-primary)] outline-none w-full truncate border-b border-transparent focus:border-[var(--color-accent)] transition-colors"
                          />
                        </div>
                        <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5 transition-colors">
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => duplicateProject(p.id)} className="p-1 rounded-[var(--radius-button)] hover:bg-[var(--color-panel-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Duplicate"><Copy size={12}/></button>
                        <button onClick={() => deleteProject(p.id)} className="p-1 rounded-[var(--radius-button)] hover:bg-red-950/50 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors" data-tooltip="Delete"><Trash2 size={12}/></button>
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
          <div className="flex h-full items-center justify-center text-center transition-colors">
            <p className="text-xs text-neutral-600 max-w-[150px] transition-colors">
              Settings coming soon.
            </p>
          </div>
        );
    }
  };



  return (
    <div className="flex flex-col h-[100dvh] bg-neutral-950 text-neutral-200 overflow-hidden font-sans transition-colors">
      {/* Top Toolbar */}
      <header className="h-11 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0 bg-neutral-950 z-20 transition-colors">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-neutral-200 transition-colors">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center hidden sm:flex transition-colors">
              <GridIcon size={12} className="text-white transition-colors" strokeWidth={3} />
            </div>
            <span className="text-xs font-semibold tracking-tight hidden sm:block transition-colors">GridSketch</span>
          </div>
          <div className="h-4 w-px bg-neutral-800 hidden sm:block transition-colors"></div>
          <div className="flex items-center gap-2">
            <Folder size={12} className="text-neutral-500 sm:hidden transition-colors" />
            <span className="text-xs text-neutral-300 font-medium truncate max-w-[120px] sm:max-w-[200px] transition-colors">
              {activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : 'Untitled Project'}
            </span>
            <select 
              value={measurementUnit} 
              onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
              className="sm:hidden bg-transparent border border-transparent hover:border-[var(--color-panel-border)] rounded-[var(--radius-control)] px-1 py-0.5 text-[10px] text-[var(--color-text-primary)] cursor-pointer outline-none ml-1 transition-colors"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="in">in</option>
              <option value="px">px</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => useGridStore.temporal.getState().undo()}
            disabled={pastStates.length === 0}
            className="hidden sm:flex p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors"
            data-tooltip="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={() => useGridStore.temporal.getState().redo()}
            disabled={futureStates.length === 0}
            className="hidden sm:flex p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors"
            data-tooltip="Redo"
          >
            <Redo2 size={16} />
          </button>
          <div className="h-4 w-px bg-neutral-800 mx-1 hidden sm:block transition-colors"></div>
          <div className="hidden sm:flex items-center">
            <select
              value={measurementUnit}
              onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
              className="bg-transparent text-xs text-neutral-400 outline-none hover:text-neutral-200 cursor-pointer appearance-none pr-4 font-medium transition-colors"
              style={{ background: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E") no-repeat right 0.15rem center/0.4rem` }}
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="in">in</option>
              <option value="px">px</option>
            </select>
          </div>
          <div className="h-4 w-px bg-neutral-800 mx-1 transition-colors"></div>
          <button onClick={() => doExport('print')} disabled={isExporting} className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 disabled:opacity-30 transition-colors hidden sm:block" data-tooltip="Print at 100% Actual Size">
            <Printer size={16} />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="ml-1 flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
            
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-72 bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] rounded-[var(--radius-panel)] shadow-2xl z-50 p-4 flex flex-col gap-4 transition-colors">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--color-panel-border)] transition-colors">
                    <h2 className="text-xs font-semibold text-[var(--color-text-primary)]  transition-colors">Export</h2>
                    <button onClick={() => setExportMenuOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors" data-tooltip="Close"><X size={14} /></button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[var(--color-text-muted)]  mb-1.5 transition-colors">Format</label>
                      <select 
                        value={exportFormat} 
                        onChange={(e) => setExportFormat(e.target.value as 'png' | 'pdf' | 'print')}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                      >
                        <option value="png">PNG (Image Export)</option>
                        <option value="pdf">PDF (Print-Ready Document)</option>
                        <option value="print">Print (Direct to Printer)</option>
                      </select>
                    </div>

                    {exportFormat === 'png' && (
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--color-text-muted)]  mb-1.5 transition-colors">Content</label>
                        <select 
                          value={exportContent} 
                          onChange={(e) => setExportContent(e.target.value as 'ref' | 'blank')}
                          className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                        >
                          <option value="ref">Reference + Grid</option>
                          <option value="blank">Blank Grid Only</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-medium text-[var(--color-text-muted)]  mb-1.5 transition-colors">Resolution</label>
                      <select
                        value={dpi}
                        onChange={(e) => setDpi(Number(e.target.value) as Dpi)}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                      >
                        <option value={72}>72 DPI (Web)</option>
                        <option value={150}>150 DPI (Draft Print)</option>
                        <option value={300}>300 DPI (Standard Print)</option>
                        <option value={600}>600 DPI (High Res Print)</option>
                      </select>
                    </div>

                    {(exportFormat === 'pdf' || exportFormat === 'print') && (
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors">
                          <input type="checkbox" checked={exportCalibration} onChange={(e) => setExportCalibration(e.target.checked)} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-colors" />
                          Add 100mm Calibration Line
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="bg-[var(--color-app-surface-raised)] border border-[var(--color-panel-border)] p-3 rounded-[var(--radius-control)] transition-colors">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[10px] text-[var(--color-text-muted)]  transition-colors">Paper</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)] transition-colors">{paperName} {activePaper.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] text-[var(--color-text-muted)]  transition-colors">Output</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)] transition-colors">
                        {exportFormat === 'png' ? `${widthPx} × ${heightPx} px` : `${widthMm} × ${heightMm} mm`}
                      </span>
                    </div>
                    {(exportFormat === 'pdf' || exportFormat === 'print') && (
                      <p className="mt-2 text-[9px] text-amber-500/80 leading-tight transition-colors">
                        Print at 100% / Actual Size.<br/>Do not use Fit to Page.
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      const typeMap = {
                        'png': exportContent === 'ref' ? 'png-ref' : 'png-blank',
                        'pdf': 'pdf',
                        'print': 'print'
                      } as const;
                      doExport(typeMap[exportFormat], exportCalibration);
                    }}
                    className="w-full py-2 rounded-[var(--radius-button)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-accent-fg)] text-[10px] uppercase font-bold tracking-wider transition-colors"
                  >
                    {isExporting ? 'Exporting...' : 'Export'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden relative pb-14 lg:pb-0">
        {/* Canvas - main content */}
        <main 
          className="flex-1 bg-[var(--color-canvas-bg)] lg:order-2 flex items-center justify-center overflow-hidden relative transition-colors" 
          onClick={() => setIsInspectorOpen(false)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <ViewportCanvas />
          <CanvasControls />
        </main>

        {/* Left Rail / Bottom Nav */}
        <nav className="fixed bottom-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] lg:static lg:h-full lg:w-14 border-t lg:border-t-0 lg:border-r border-[var(--color-panel-border)] bg-[var(--color-panel-bg)]/95 backdrop-blur-md flex lg:flex-col items-center justify-around lg:justify-start lg:py-4 shrink-0 z-40 transition-colors">
          <NavItem id="image" icon={ImageIcon} label="Image" activeTab={activeTab} onClick={() => { if (activeTab === 'image' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('image'); setIsInspectorOpen(true); } }} />
          <NavItem id="grid" icon={GridIcon} label="Grid" activeTab={activeTab} onClick={() => { if (activeTab === 'grid' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('grid'); setIsInspectorOpen(true); } }} />
          <NavItem id="paper" icon={File} label="Paper" activeTab={activeTab} onClick={() => { if (activeTab === 'paper' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('paper'); setIsInspectorOpen(true); } }} />
          <NavItem id="adjustments" icon={SlidersHorizontal} label="Adjust" activeTab={activeTab} onClick={() => { if (activeTab === 'adjustments' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('adjustments'); setIsInspectorOpen(true); } }} />
          <div className="hidden lg:block h-px w-8 bg-[var(--color-panel-border)] my-2 transition-colors"></div>
          <NavItem id="projects" icon={Folder} label="Projects" activeTab={activeTab} onClick={() => { if (activeTab === 'projects' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('projects'); setIsInspectorOpen(true); } }} />
          <div className="lg:mt-auto"></div>
          <NavItem id="settings" icon={Settings} label="Settings" activeTab={activeTab} onClick={() => { if (activeTab === 'settings' && isInspectorOpen) setIsInspectorOpen(false); else { setActiveTab('settings'); setIsInspectorOpen(true); } }} />
        </nav>

        {/* Backdrop for mobile */}
        <div 
          className={`fixed inset-0 bg-black/20 z-30 transition-opacity lg:hidden ${isInspectorOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
          onClick={() => setIsInspectorOpen(false)} 
        />
        {/* Right Inspector / Bottom Sheet */}
        <aside className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-[var(--color-panel-bg)] border-t border-[var(--color-panel-border)] z-40 rounded-t-[var(--radius-panel)] transform transition-transform duration-200 ease-out shadow-[0_-10px_40px_rgba(0,0,0,0.5)] h-[65dvh] flex flex-col
                          ${isInspectorOpen ? 'translate-y-0' : 'translate-y-full'}
                          lg:static lg:translate-y-0 lg:h-full lg:w-[280px] lg:border-t-0 lg:border-l lg:rounded-none lg:shadow-none lg:shrink-0`}>
          <div className="flex items-center justify-between p-3.5 border-b border-[var(--color-panel-border)] transition-colors">
            <span className="text-xs font-semibold  text-[var(--color-text-primary)] transition-colors">
              {activeTab}
            </span>
            <button 
              onClick={() => setIsInspectorOpen(false)}
              className="lg:hidden p-2 -mr-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              data-tooltip="Close Panel"
            >
              <X size={16} />
            </button>
          </div>
          <div key={activeTab} className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-8 lg:pb-4 animate-panel-in">
            {renderInspector()}
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-7 border-t border-[var(--color-panel-border)] hidden sm:flex items-center justify-between px-4 text-[10px] text-[var(--color-text-muted)] tracking-wide shrink-0 bg-[var(--color-app-bg)] z-20 transition-colors">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[var(--color-text-primary)] font-medium transition-colors">
            <File size={10} /> 
            {paperName} {activePaper.orientation.charAt(0).toUpperCase() + activePaper.orientation.slice(1)}
          </span>
          <span className="hidden sm:inline">{formatUnit(widthMm, measurementUnit, dpi)} × {formatUnit(heightMm, measurementUnit, dpi)} {measurementUnit}</span>
          <div className="h-3 w-px bg-[var(--color-panel-border)] hidden md:block transition-colors"></div>
          <span className="hidden md:flex items-center gap-1.5">
            <GridIcon size={10} />
            {grid.columns} × {grid.rows}
          </span>
          <span className="hidden lg:inline text-[var(--color-text-secondary)] transition-colors">
            Cell: {formatUnit(cellWidthMm, measurementUnit, dpi)} × {formatUnit(cellHeightMm, measurementUnit, dpi)} {measurementUnit}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>{widthPx} × {heightPx} px @ {dpi} DPI</span>
          <span className="flex items-center gap-1 hover:text-[var(--color-text-primary)] cursor-pointer transition-colors" onClick={() => useViewportStore.getState().resetView()}><ZoomIn size={12} /> Fit</span>
        </div>
      </footer>
    </div>
  );
}
