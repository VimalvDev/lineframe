import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal, type TemporalState } from 'zundo';
import { useStore } from 'zustand';
import type { MeasurementUnit } from '@/lib/units';

export type Orientation = 'portrait' | 'landscape';

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PaperSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: PaperSize[] = [
  { id: 'A0', label: 'A0', widthMm: 841, heightMm: 1189 },
  { id: 'A1', label: 'A1', widthMm: 594, heightMm: 841 },
  { id: 'A2', label: 'A2', widthMm: 420, heightMm: 594 },
  { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
  { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210 },
  { id: 'A6', label: 'A6', widthMm: 105, heightMm: 148 },
  { id: 'letter', label: 'US Letter', widthMm: 216, heightMm: 279 },
];

export interface ActivePaperState {
  presetId: string;
  orientation: Orientation;
  margins: Margins;
  isCustom: boolean;
  customName?: string;
  customWidthMm?: number;
  customHeightMm?: number;
}

export type Dpi = 72 | 150 | 300 | 600;

export type FitMode = 'original' | 'contain' | 'cover' | 'crop-to-paper' | 'free-crop';

export interface ImageState {
  src: string | null;
  filename: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
  
  // Crop box bounding coordinates on the paper (in mm)
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  
  // Transform of the image *inside* the crop box
  scale: number;
  panXMm: number;
  panYMm: number;
  isAspectRatioLocked: boolean;
  
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  snapEnabled: boolean;
  
  brightness: number;
  contrast: number;
  grayscale: boolean;
  blackAndWhite: boolean;
  threshold: number;
  invert: boolean;
  
  fitMode: FitMode;
}

export type GridMode = 'count' | 'size';

export interface GridConfig {
  mode: GridMode;
  columns: number;
  rows: number;
  cellWidthMm: number;
  cellHeightMm: number;
  linked: boolean;
  forceSquare: boolean;

  style: 'lines' | 'intersections';
  lineColor: string;
  lineWidth: number;
  opacity: number;
  visible: boolean;

  showLabels: boolean;
  labelPosition: 'top-left' | 'center' | 'bottom-right';
  
  majorLineFrequency: number;
  centerLines: boolean;
  snapToGrid: boolean;
  snapToPaper: boolean;
}

export interface GridStore {
  activePaper: ActivePaperState;
  customPresets: PaperSize[];
  dpi: Dpi;
  measurementUnit: MeasurementUnit;
  image: ImageState;
  grid: GridConfig;

  // Actions
  setPreset: (presetId: string) => void;
  setOrientation: (orientation: Orientation) => void;
  setMargins: (margins: Partial<Margins>) => void;
  setCustomPaper: (widthMm: number, heightMm: number, name?: string) => void;
  saveCustomPreset: (name: string) => void;
  removeCustomPreset: (id: string) => void;
  
  setDpi: (dpi: Dpi) => void;
  setMeasurementUnit: (unit: MeasurementUnit) => void;

  setImageSrc: (src: string, filename: string, naturalWidthPx: number, naturalHeightPx: number) => void;
  loadImageFile: (file: File) => void;
  updateImage: (patch: Partial<ImageState>) => void;
  setFitMode: (mode: FitMode) => void;
  rotateImage: (dir: 'left' | 'right') => void;
  flipImage: (axis: 'h' | 'v') => void;
  clearImage: () => void;
  resetAdjustments: () => void;

  setColumns: (n: number) => void;
  setRows: (n: number) => void;
  setCellSize: (w: number, h: number) => void;
  setGridMode: (mode: GridMode) => void;
  toggleLinked: () => void;
  toggleForceSquare: () => void;
  updateGrid: (patch: Partial<GridConfig>) => void;
  loadSnapshot: (snapshot: Partial<GridStore>) => void;
}

export type SerializableProjectState = Pick<GridStore, 'activePaper' | 'customPresets' | 'dpi' | 'measurementUnit' | 'image' | 'grid'>;

export function getProjectSnapshot(state: GridStore): SerializableProjectState {
  return {
    activePaper: state.activePaper,
    customPresets: state.customPresets,
    dpi: state.dpi,
    measurementUnit: state.measurementUnit,
    image: state.image,
    grid: state.grid
  };
}

export const defaultImage: ImageState = {
  src: null,
  filename: '',
  naturalWidthPx: 0,
  naturalHeightPx: 0,
  xMm: 0,
  yMm: 0,
  widthMm: 0,
  heightMm: 0,
  scale: 1,
  panXMm: 0,
  panYMm: 0,
  isAspectRatioLocked: true,
  rotation: 0,
  flipH: false,
  flipV: false,
  snapEnabled: true,
  brightness: 100,
  contrast: 100,
  grayscale: false,
  blackAndWhite: false,
  threshold: 100,
  invert: false,
  fitMode: 'contain',
};

export const defaultGrid: GridConfig = {
  mode: 'count',
  columns: 5,
  rows: 5,
  cellWidthMm: 20,
  cellHeightMm: 20,
  linked: true,
  forceSquare: false,
  style: 'lines',
  lineColor: '#FF4545',
  lineWidth: 1,
  opacity: 1,
  visible: true,
  showLabels: false,
  labelPosition: 'top-left',
  majorLineFrequency: 0,
  centerLines: false,
  snapToGrid: false,
  snapToPaper: true,
};

export const defaultPaper: ActivePaperState = {
  presetId: 'A4',
  orientation: 'portrait',
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  isCustom: false,
};

export function getEffectivePaperDimensions(paper: ActivePaperState, presets: PaperSize[]) {
  let w = 0;
  let h = 0;
  let name = '';

  if (paper.isCustom) {
    w = paper.customWidthMm || 210;
    h = paper.customHeightMm || 297;
    name = paper.customName || 'Custom';
  } else {
    const p = presets.find(p => p.id === paper.presetId) || PAPER_SIZES.find(p => p.id === paper.presetId) || PAPER_SIZES[4]; // Default A4
    w = p.widthMm;
    h = p.heightMm;
    name = p.label;
  }

  // Swap if landscape
  if (paper.orientation === 'landscape') {
    return { widthMm: h, heightMm: w, name };
  }
  return { widthMm: w, heightMm: h, name };
}

function computeFitLayout(image: ImageState, paper: ActivePaperState, presets: PaperSize[], mode: FitMode): Partial<ImageState> {
  const isRotated = image.rotation === 90 || image.rotation === 270;
  const natW = isRotated ? image.naturalHeightPx : image.naturalWidthPx;
  const natH = isRotated ? image.naturalWidthPx : image.naturalHeightPx;
  if (natW === 0 || natH === 0) return {};

  const aspect = natW / natH;
  const { widthMm: paperW, heightMm: paperH } = getEffectivePaperDimensions(paper, presets);
  const paperAspect = paperW / paperH;

  let widthMm = 0;
  let heightMm = 0;
  let scale = 1;

  switch (mode) {
    case 'contain':
    case 'free-crop':
      if (aspect > paperAspect) {
        widthMm = paperW;
        heightMm = widthMm / aspect;
      } else {
        heightMm = paperH;
        widthMm = heightMm * aspect;
      }
      return {
        xMm: (paperW - widthMm) / 2,
        yMm: (paperH - heightMm) / 2,
        widthMm,
        heightMm,
        scale: 1,
        panXMm: 0,
        panYMm: 0,
        fitMode: mode,
      };

    case 'crop-to-paper':
    case 'cover':
      widthMm = paperW;
      heightMm = paperH;
      if (aspect > paperAspect) {
        const targetW = paperH * aspect;
        scale = targetW / widthMm;
      } else {
        const targetH = paperW / aspect;
        scale = targetH / heightMm;
      }
      return {
        xMm: 0,
        yMm: 0,
        widthMm: paperW,
        heightMm: paperH,
        scale,
        panXMm: 0,
        panYMm: 0,
        fitMode: mode,
      };

    case 'original':
      // Map pixels directly to mm (e.g. 10 px per mm -> 254 DPI)
      // Let's use 10px = 1mm for a baseline physical representation
      widthMm = natW / 10;
      heightMm = natH / 10;
      return {
        xMm: (paperW - widthMm) / 2,
        yMm: (paperH - heightMm) / 2,
        widthMm,
        heightMm,
        scale: 1,
        panXMm: 0,
        panYMm: 0,
        fitMode: mode,
      };
  }
}

export const useGridStore = create<GridStore>()(
  persist(
    temporal(
      (set, get) => ({
        activePaper: defaultPaper,
        customPresets: [],
        dpi: 300,
        measurementUnit: 'cm',
        image: defaultImage,
        grid: defaultGrid,

        setPreset: (presetId) => {
          const { activePaper } = get();
          const nextPaper = { ...activePaper, presetId, isCustom: false };
          set({ activePaper: nextPaper });
        },

        setOrientation: (orientation) => {
          const { activePaper } = get();
          const nextPaper = { ...activePaper, orientation };
          set({ activePaper: nextPaper });
        },

        setMargins: (margins) => {
          const { activePaper } = get();
          set({ activePaper: { ...activePaper, margins: { ...activePaper.margins, ...margins } } });
        },

        setCustomPaper: (widthMm, heightMm, name) => {
          const { activePaper } = get();
          const nextPaper: ActivePaperState = {
            ...activePaper,
            isCustom: true,
            presetId: 'custom',
            customWidthMm: widthMm,
            customHeightMm: heightMm,
            customName: name || 'Custom',
          };
          set({ activePaper: nextPaper });
        },

        saveCustomPreset: (name) => {
          const { activePaper, customPresets } = get();
          if (!activePaper.isCustom) return;
          const newId = `custom-${Date.now()}`;
          const newPreset: PaperSize = {
            id: newId,
            label: name,
            widthMm: activePaper.customWidthMm || 210,
            heightMm: activePaper.customHeightMm || 297,
          };
          set({
            customPresets: [...customPresets, newPreset],
            activePaper: { ...activePaper, isCustom: false, presetId: newId },
          });
        },
        
        removeCustomPreset: (id) => {
          const { customPresets, activePaper } = get();
          set({ customPresets: customPresets.filter(p => p.id !== id) });
          if (activePaper.presetId === id) {
            get().setPreset('A4');
          }
        },

        setDpi: (dpi) => set({ dpi }),
        setMeasurementUnit: (measurementUnit) => set({ measurementUnit }),

        setImageSrc: (src, filename, naturalWidthPx, naturalHeightPx) => {
          const { activePaper, customPresets } = get();
          const img: ImageState = { ...defaultImage, src, filename, naturalWidthPx, naturalHeightPx, fitMode: 'contain' };
          const layout = computeFitLayout(img, activePaper, customPresets, 'contain');
          set({ image: { ...img, ...layout } });
        },

        loadImageFile: (file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) return;
            
            const img = new Image();
            img.onload = () => {
              get().setImageSrc(dataUrl, file.name, img.naturalWidth, img.naturalHeight);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        },

        updateImage: (patch) => set((s) => ({ image: { ...s.image, ...patch } })),
        
        setFitMode: (mode) => {
          const { image, activePaper, customPresets } = get();
          if (!image.src) return;
          set({ image: { ...image, ...computeFitLayout(image, activePaper, customPresets, mode) } });
        },
        
        rotateImage: (dir) => {
          const { image, activePaper, customPresets } = get();
          if (!image.src) return;
          const nextRot = (image.rotation + (dir === 'right' ? 90 : -90) + 360) % 360;
          const tempImg = { ...image, rotation: nextRot };
          set({ image: { ...tempImg, ...computeFitLayout(tempImg, activePaper, customPresets, tempImg.fitMode) } });
        },
        
        flipImage: (axis) => {
          const { image } = get();
          if (!image.src) return;
          if (axis === 'h') set({ image: { ...image, flipH: !image.flipH } });
          else set({ image: { ...image, flipV: !image.flipV } });
        },

        clearImage: () => set({ image: defaultImage }),
        
        resetAdjustments: () => {
          const { image } = get();
          if (!image.src) return;
          set({ image: { ...image, brightness: 100, contrast: 100, grayscale: false, blackAndWhite: false, threshold: 100, invert: false } });
        },

        setColumns: (n) => {
          const { grid } = get();
          set({ grid: { ...grid, columns: n, rows: grid.linked ? n : grid.rows } });
        },

        setRows: (n) => {
          const { grid } = get();
          set({ grid: { ...grid, rows: n, columns: grid.linked ? n : grid.columns } });
        },
        
        setCellSize: (w, h) => {
          const { grid } = get();
          if (grid.forceSquare) {
             set({ grid: { ...grid, cellWidthMm: w, cellHeightMm: w } });
          } else if (grid.linked) {
             // If linked, keep the same aspect ratio or just set both? 
             // "Linked" usually implies matching. Let's make it match for size too if square wasn't selected but linked is.
             // Actually, "linked rows/columns" might just mean w = h. Let's use forceSquare for that explicitly.
             set({ grid: { ...grid, cellWidthMm: w, cellHeightMm: h } });
          } else {
             set({ grid: { ...grid, cellWidthMm: w, cellHeightMm: h } });
          }
        },
        
        setGridMode: (mode) => {
           set((s) => ({ grid: { ...s.grid, mode } }));
        },

        toggleLinked: () => {
          const { grid } = get();
          const nextLinked = !grid.linked;
          set({ grid: { ...grid, linked: nextLinked, rows: nextLinked ? grid.columns : grid.rows, cellHeightMm: nextLinked ? grid.cellWidthMm : grid.cellHeightMm } });
        },
        
        toggleForceSquare: () => {
           const { grid } = get();
           const forceSquare = !grid.forceSquare;
           set({ grid: { ...grid, forceSquare, cellHeightMm: forceSquare ? grid.cellWidthMm : grid.cellHeightMm } });
        },

        updateGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),
        
        loadSnapshot: (snapshot) => set((s) => ({ ...s, ...snapshot })),
      }),
      { limit: 60 }
    ),
    {
      name: 'grid-sketch-storage',
      version: 2,
      partialize: (state) => ({
        activePaper: state.activePaper,
        customPresets: state.customPresets,
        dpi: state.dpi,
        grid: state.grid,
        // Persist image settings but NOT the src data URL (it's multi-MB base64 that blocks the main thread on rehydration)
        image: { ...state.image, src: null },
      }),
      // Merge persisted state with defaults so new fields are populated and stale values are handled
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          // Reset grid to defaults on major version change (fixes stale white lineColor, missing style field, etc.)
          const oldGrid = state.grid as Record<string, unknown> | undefined;
          state.grid = { ...defaultGrid, ...(oldGrid || {}), lineColor: defaultGrid.lineColor, style: 'lines' as const };
          
          if (state.measurementUnit === 'mm') {
            state.measurementUnit = 'cm';
          }
        }
        return state;
      },
      merge: (persisted: unknown, current: GridStore) => {
        const p = persisted as Partial<GridStore> | undefined;
        if (!p) return current;
        return {
          ...current,
          ...p,
          grid: { ...defaultGrid, ...p.grid, style: p.grid?.style || 'lines' },
          image: { ...current.image, ...p.image, src: null },
        };
      },
    }
  )
);

export function useTemporalGridStore<T>(selector: (state: TemporalState<GridStore>) => T) {
  return useStore(useGridStore.temporal, selector);
}

export function getCellSizeMm(paper: ActivePaperState, presets: PaperSize[], grid: GridConfig) {
  const { widthMm, heightMm } = getEffectivePaperDimensions(paper, presets);
  const { top, right, bottom, left } = paper.margins;
  
  const usableW = Math.max(1, widthMm - left - right);
  const usableH = Math.max(1, heightMm - top - bottom);

  if (grid.mode === 'size') {
     return {
       cellWidthMm: grid.cellWidthMm || 20,
       cellHeightMm: grid.forceSquare ? (grid.cellWidthMm || 20) : (grid.cellHeightMm || 20),
       usableW,
       usableH
     };
  }

  const cellW = usableW / Math.max(1, grid.columns);
  let cellH = usableH / Math.max(1, grid.rows);
  
  if (grid.forceSquare) {
     // Force square takes the width, or we can just force cellH = cellW
     cellH = cellW;
  }

  return {
    cellWidthMm: cellW,
    cellHeightMm: cellH,
    usableW,
    usableH
  };
}

export function getCanvasPixelSize(paper: ActivePaperState, presets: PaperSize[], dpi: Dpi) {
  const MM_TO_INCH = 1 / 25.4;
  const { widthMm, heightMm } = getEffectivePaperDimensions(paper, presets);
  
  return {
    widthPx: Math.round(widthMm * MM_TO_INCH * dpi),
    heightPx: Math.round(heightMm * MM_TO_INCH * dpi),
  };
}
