'use client';

import { useRef, useState, useEffect } from 'react';
import { 
  Undo2, Redo2, Trash2, Upload, Download, Image as ImageIcon, Grid as GridIcon, 
  File, SlidersHorizontal, Folder, Settings, ZoomIn, Printer, X, Link2,
  RotateCcw, RotateCw, FlipHorizontal, FlipVertical, Copy, Crop, AlertTriangle
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
import { useViewportStore } from '@/store/useViewportStore';
import { useProjectStore, type Project } from '@/store/useProjectStore';

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
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Source</h3>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              
              {!image.src ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-[var(--color-panel-border)] bg-[var(--color-app-surface)] px-3 py-6 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-app-surface-raised)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Upload size={20} /> 
                  <span>Upload or Paste</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-[var(--radius-panel)] bg-[var(--color-app-surface)] p-2 border border-[var(--color-panel-border)]">
                    <div 
                      className="w-12 h-12 bg-[var(--color-app-bg)] rounded-[var(--radius-control)] border border-[var(--color-panel-border-subtle)] bg-cover bg-center" 
                      style={{ backgroundImage: `url(${image.src})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--color-text-primary)] truncate">{image.filename || 'Pasted Image'}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{image.naturalWidthPx} × {image.naturalHeightPx} px</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{(image.naturalWidthPx / image.naturalHeightPx).toFixed(2)}:1</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-1.5 text-[10px] uppercase font-medium bg-[var(--color-app-surface-raised)] hover:bg-[var(--color-panel-border)] rounded-[var(--radius-button)] text-[var(--color-text-primary)] transition-colors">Replace</button>
                     <button onClick={clearImage} className="flex-1 py-1.5 text-[10px] uppercase font-medium bg-red-950/30 text-[var(--color-danger)] hover:bg-red-950/50 rounded-[var(--radius-button)] transition-colors border border-red-900/30">Remove</button>
                  </div>
                </div>
              )}
            </div>

            {image.src && (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Image Tools</h3>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    <button onClick={() => rotateImage('left')} className="flex items-center justify-center p-2 rounded-[var(--radius-control)] bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" title="Rotate Left"><RotateCcw size={16}/></button>
                    <button onClick={() => rotateImage('right')} className="flex items-center justify-center p-2 rounded-[var(--radius-control)] bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" title="Rotate Right"><RotateCw size={16}/></button>
                    <button onClick={() => flipImage('h')} className="flex items-center justify-center p-2 rounded-[var(--radius-control)] bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" title="Flip Horizontal"><FlipHorizontal size={16}/></button>
                    <button onClick={() => flipImage('v')} className="flex items-center justify-center p-2 rounded-[var(--radius-control)] bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" title="Flip Vertical"><FlipVertical size={16}/></button>
                    <button onClick={() => useViewportStore.getState().setInteractionMode('crop')} className={`flex items-center justify-center p-2 rounded-[var(--radius-control)] border transition-colors ${useViewportStore.getState().interactionMode === 'crop' ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent-hover)]' : 'bg-[var(--color-app-surface)] border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface-raised)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`} title="Crop Tool"><Crop size={16}/></button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Image Fit</h3>
                  <select
                    value={image.fitMode}
                    onChange={(e) => setFitMode(e.target.value as FitMode)}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors mb-2"
                  >
                    <option value="original">Original Size</option>
                    <option value="contain">Contain (Fit within bounds)</option>
                    <option value="cover">Cover (Fill completely)</option>
                    <option value="crop-to-paper">Crop to Paper</option>
                  </select>
                  {image.fitMode === 'crop-to-paper' && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Matches the reference image to the selected paper aspect ratio.</p>
                  )}
                  {image.fitMode === 'original' && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-3">Preserves exact physical dimensions. Drag to reposition.</p>
                  )}

                  {!imageMatchesPaperAspect && (
                    <div className="mt-3 p-3 rounded-[var(--radius-panel)] bg-amber-950/20 border border-amber-900/30 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <AlertTriangle className="text-amber-500 shrink-0" size={14} />
                        <span className="text-[10px] text-amber-500 font-medium">Image crop does not match document aspect ratio.</span>
                      </div>
                      <button 
                        onClick={() => setFitMode('crop-to-paper')}
                        className="py-1.5 px-3 rounded-[var(--radius-button)] bg-amber-950/40 hover:bg-amber-950/60 text-amber-500 text-[10px] uppercase font-bold tracking-wider transition-colors border border-amber-900/30 w-full"
                      >
                        Crop to Paper
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Transform</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Width ({measurementUnit})</label>
                        <UnitInput 
                          unit={measurementUnit} dpi={dpi} min={1} 
                          valueMm={image.scale * (image.naturalWidthPx / 3.7795)} 
                          onChangeMm={(v) => {
                            const newScale = v / (image.naturalWidthPx / 3.7795);
                            updateImage({ scale: newScale });
                          }} 
                          className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]" 
                        />
                      </div>
                      <button 
                        onClick={() => updateImage({ isAspectRatioLocked: !image.isAspectRatioLocked })} 
                        className={`mb-[1px] rounded-[var(--radius-control)] px-1.5 py-1.5 text-xs transition-colors ${image.isAspectRatioLocked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                      >
                        <Link2 size={14} />
                      </button>
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Height ({measurementUnit})</label>
                        <UnitInput 
                          unit={measurementUnit} dpi={dpi} min={1} 
                          valueMm={image.scale * (image.naturalHeightPx / 3.7795)} 
                          onChangeMm={(v) => {
                            const newScale = v / (image.naturalHeightPx / 3.7795);
                            updateImage({ scale: newScale });
                          }} 
                          disabled={image.isAspectRatioLocked} 
                          className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50" 
                        />
                      </div>
                    </div>
                    
                    <div>
                       <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={image.isAspectRatioLocked}
                          onChange={(e) => updateImage({ isAspectRatioLocked: e.target.checked })}
                          className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                        />
                        Maintain aspect ratio
                      </label>
                    </div>

                    <div className="pt-2 border-t border-[var(--color-panel-border)]">
                      <div className="flex gap-2 items-end mt-2">
                        <div className="flex-1">
                          <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Position X ({measurementUnit})</label>
                          <UnitInput 
                            unit={measurementUnit} dpi={dpi} 
                            valueMm={image.panXMm} 
                            onChangeMm={(v) => updateImage({ panXMm: v })} 
                            className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Position Y ({measurementUnit})</label>
                          <UnitInput 
                            unit={measurementUnit} dpi={dpi} 
                            valueMm={image.panYMm} 
                            onChangeMm={(v) => updateImage({ panYMm: v })} 
                            className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]" 
                          />
                        </div>
                      </div>
                      <button 
                         onClick={() => updateImage({ panXMm: 0, panYMm: 0 })}
                         className="mt-3 w-full py-1.5 text-[10px] uppercase font-medium bg-[var(--color-app-surface-raised)] hover:bg-[var(--color-panel-border)] rounded-[var(--radius-button)] text-[var(--color-text-primary)] transition-colors"
                      >
                         Center Image
                      </button>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-panel-border)]">
                      <button 
                         onClick={() => updateImage({ scale: 1, panXMm: 0, panYMm: 0, rotation: 0, flipH: false, flipV: false, fitMode: 'contain' })}
                         className="w-full py-1.5 text-[10px] uppercase font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-panel-border)] hover:bg-[var(--color-app-surface)] rounded-[var(--radius-button)] transition-colors"
                      >
                         Reset Image
                      </button>
                    </div>
                  </div>
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
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Mode</h3>
                <div className="flex items-center gap-1 bg-[var(--color-app-surface)] p-1 rounded-[var(--radius-control)] border border-[var(--color-panel-border)]">
                  <button onClick={() => useGridStore.getState().setGridMode('count')} className={`px-2 py-1 text-[10px] uppercase font-medium rounded transition-colors ${grid.mode === 'count' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>By Count</button>
                  <button onClick={() => useGridStore.getState().setGridMode('size')} className={`px-2 py-1 text-[10px] uppercase font-medium rounded transition-colors ${grid.mode === 'size' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>By Size</button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Layout</h3>
              
              {grid.mode === 'count' ? (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Columns</label>
                    <input type="number" min={1} max={100} value={grid.columns} onChange={(e) => setColumns(Number(e.target.value))} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mb-[1px] rounded-[var(--radius-control)] px-1.5 py-1.5 text-xs transition-colors ${grid.linked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Rows</label>
                    <input type="number" min={1} max={100} value={grid.rows} disabled={grid.linked} onChange={(e) => setRows(Number(e.target.value))} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2 mb-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Width ({measurementUnit})</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellWidthMm} onChangeMm={(v) => useGridStore.getState().setCellSize(v, grid.cellHeightMm)} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors" />
                  </div>
                  <button onClick={toggleLinked} className={`mb-[1px] rounded-[var(--radius-control)] px-1.5 py-1.5 text-xs transition-colors ${grid.linked ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}><Link2 size={14} /></button>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Height ({measurementUnit})</label>
                    <UnitInput unit={measurementUnit} dpi={dpi} valueMm={grid.cellHeightMm} disabled={grid.linked || grid.forceSquare} onChangeMm={(v) => useGridStore.getState().setCellSize(grid.cellWidthMm, v)} className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors" />
                  </div>
                </div>
              )}
              
              <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer mt-3">
                <input type="checkbox" checked={grid.forceSquare} onChange={useGridStore.getState().toggleForceSquare} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                Force perfectly square cells
              </label>

              <div className="mt-5 p-4 rounded-[var(--radius-panel)] bg-[var(--color-app-surface)] border border-[var(--color-panel-border)] text-center shadow-inner">
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold mb-2">Exact Cell Size</div>
                <div className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {formatUnit(cellWidthMm, measurementUnit, dpi)} <span className="text-[var(--color-text-muted)] font-normal mx-1">×</span> {formatUnit(cellHeightMm, measurementUnit, dpi)} <span className="text-sm text-[var(--color-text-muted)] ml-1">{measurementUnit}</span>
                </div>
                {grid.mode === 'size' && (
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 font-medium bg-[var(--color-app-bg)] py-1 px-2 rounded-[var(--radius-control)] inline-block">
                    Grid fills ~{((widthMm - activePaper.margins.left - activePaper.margins.right) / cellWidthMm).toFixed(1)} × ~{((heightMm - activePaper.margins.top - activePaper.margins.bottom) / cellHeightMm).toFixed(1)} cells
                  </div>
                )}
                {grid.mode === 'count' && grid.forceSquare && (
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 font-medium bg-[var(--color-app-bg)] py-1 px-2 rounded-[var(--radius-control)] inline-block">
                    Unused vertical space: {formatUnit((heightMm - activePaper.margins.top - activePaper.margins.bottom) - (cellHeightMm * grid.rows), measurementUnit, dpi)} {measurementUnit}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Appearance</h3>
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer uppercase tracking-wider font-medium">
                  <input type="checkbox" checked={grid.visible} onChange={(e) => updateGrid({ visible: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                  Visible
                </label>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input type="color" value={grid.lineColor} onChange={(e) => updateGrid({ lineColor: e.target.value })} className="h-8 w-12 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-panel-border)] bg-[var(--color-app-surface)] p-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                      <span>Opacity</span>
                      <span>{Math.round(grid.opacity * 100)}%</span>
                    </div>
                    <input type="range" min="0.1" max="1" step="0.05" value={grid.opacity} 
                      onPointerDown={() => useGridStore.temporal.getState().pause()}
                      onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                      onChange={(e) => updateGrid({ opacity: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                  </div>
                </div>
                
                <div>
                  <label className="flex justify-between mb-1.5 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    <span>Line Thickness</span>
                    <span>{grid.lineWidth}x</span>
                  </label>
                  <input type="range" min="0.5" max="5" step="0.5" value={grid.lineWidth} 
                    onPointerDown={() => useGridStore.temporal.getState().pause()}
                    onPointerUp={() => { useGridStore.temporal.getState().resume(); updateGrid({}); }}
                    onChange={(e) => updateGrid({ lineWidth: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
                </div>
                
                <div className="pt-3 border-t border-[var(--color-panel-border)] space-y-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
                    <input type="checkbox" checked={grid.centerLines} onChange={(e) => updateGrid({ centerLines: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                    Center crosshairs
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Major Lines</span>
                    <select value={grid.majorLineFrequency} onChange={(e) => updateGrid({ majorLineFrequency: Number(e.target.value) })} className="bg-[var(--color-input)] border border-[var(--color-input-border)] rounded-[var(--radius-control)] px-2 py-1 text-xs text-[var(--color-text-primary)]">
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
                <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Labels</h3>
                <label className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)] cursor-pointer uppercase tracking-wider font-medium">
                  <input type="checkbox" checked={grid.showLabels} onChange={(e) => updateGrid({ showLabels: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                  Visible
                </label>
              </div>
              {grid.showLabels && (
                <div className="flex gap-2">
                  <button onClick={() => updateGrid({ labelPosition: 'top-left' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors border ${grid.labelPosition === 'top-left' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] border-[var(--color-accent)]' : 'bg-[var(--color-app-surface)] text-[var(--color-text-muted)] border-[var(--color-panel-border)] hover:text-[var(--color-text-primary)]'}`}>Top L</button>
                  <button onClick={() => updateGrid({ labelPosition: 'center' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors border ${grid.labelPosition === 'center' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] border-[var(--color-accent)]' : 'bg-[var(--color-app-surface)] text-[var(--color-text-muted)] border-[var(--color-panel-border)] hover:text-[var(--color-text-primary)]'}`}>Center</button>
                  <button onClick={() => updateGrid({ labelPosition: 'bottom-right' })} className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors border ${grid.labelPosition === 'bottom-right' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-hover)] border-[var(--color-accent)]' : 'bg-[var(--color-app-surface)] text-[var(--color-text-muted)] border-[var(--color-panel-border)] hover:text-[var(--color-text-primary)]'}`}>Bot R</button>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Snap Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
                  <input type="checkbox" checked={grid.snapToGrid} onChange={(e) => updateGrid({ snapToGrid: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                  Snap image to grid lines & intersections
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
                  <input type="checkbox" checked={grid.snapToPaper} onChange={(e) => updateGrid({ snapToPaper: e.target.checked })} className="rounded border-[var(--color-panel-border)] bg-[var(--color-app-surface)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                  Snap to paper edges & center
                </label>
              </div>
            </div>
          </div>
        );
      case 'paper':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Document Size</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Preset</label>
              <select
                value={activePaper.presetId}
                onChange={(e) => setPreset(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors mb-3"
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
                <div className="space-y-3 mb-3 p-3 rounded-[var(--radius-panel)] bg-[var(--color-app-surface-raised)] border border-[var(--color-panel-border)]">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Width ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customWidthMm || 210}
                        onChangeMm={(v) => setCustomPaper(v, activePaper.customHeightMm || 297, activePaper.customName)}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Height ({measurementUnit})</label>
                      <UnitInput
                        unit={measurementUnit} dpi={dpi} min={1} valueMm={activePaper.customHeightMm || 297}
                        onChangeMm={(v) => setCustomPaper(activePaper.customWidthMm || 210, v, activePaper.customName)}
                        className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => saveCustomPreset(prompt('Name for custom preset?', 'My Preset') || 'Custom')}
                    className="w-full py-1.5 rounded-[var(--radius-button)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium transition-colors"
                  >
                    Save as Preset
                  </button>
                </div>
              )}

              {/* Orientation Toggle */}
              <div className="flex items-center gap-1 bg-[var(--color-app-surface)] p-1 rounded-[var(--radius-control)] border border-[var(--color-panel-border)] mt-1">
                 <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors ${activePaper.orientation === 'portrait' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                 >
                   Portrait
                 </button>
                 <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 py-1.5 text-[10px] uppercase font-medium rounded-[var(--radius-control)] transition-colors ${activePaper.orientation === 'landscape' ? 'bg-[var(--color-app-surface-raised)] text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                 >
                   Landscape
                 </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Margins</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Top ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.top}
                    onChangeMm={(v) => setMargins({ top: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Bottom ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.bottom}
                    onChangeMm={(v) => setMargins({ bottom: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Left ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.left}
                    onChangeMm={(v) => setMargins({ left: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Right ({measurementUnit})</label>
                  <UnitInput
                    unit={measurementUnit} dpi={dpi} min={0} valueMm={activePaper.margins.right}
                    onChangeMm={(v) => setMargins({ right: v })}
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">Export Settings</h3>
              <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Resolution</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) as Dpi)}
                className="w-full rounded-[var(--radius-control)] border border-[var(--color-input-border)] bg-[var(--color-input)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
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
      <footer className="h-7 border-t border-[var(--color-panel-border)] hidden sm:flex items-center justify-between px-4 text-[10px] text-[var(--color-text-muted)] tracking-wide shrink-0 bg-[var(--color-app-bg)] z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[var(--color-text-primary)] font-medium">
            <File size={10} /> 
            {paperName} {activePaper.orientation.charAt(0).toUpperCase() + activePaper.orientation.slice(1)}
          </span>
          <span className="hidden sm:inline">{formatUnit(widthMm, measurementUnit, dpi)} × {formatUnit(heightMm, measurementUnit, dpi)} {measurementUnit}</span>
          <div className="h-3 w-px bg-[var(--color-panel-border)] hidden md:block"></div>
          <span className="hidden md:flex items-center gap-1.5">
            <GridIcon size={10} />
            {grid.columns} × {grid.rows}
          </span>
          <span className="hidden lg:inline text-[var(--color-text-secondary)]">
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
