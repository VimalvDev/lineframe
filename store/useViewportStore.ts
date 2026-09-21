import { create } from 'zustand';

export type InteractionMode = 'pan' | 'move' | 'crop';

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  interactionMode: InteractionMode;
  spacebarPanActive: boolean;
  activeSnapLines: { x: number | null, y: number | null };

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setSpacebarPanActive: (active: boolean) => void;
  setActiveSnapLines: (lines: { x: number | null, y: number | null }) => void;
  resetView: () => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  interactionMode: 'pan',
  spacebarPanActive: false,
  activeSnapLines: { x: null, y: null },

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setSpacebarPanActive: (active) => set({ spacebarPanActive: active }),
  setActiveSnapLines: (lines) => set({ activeSnapLines: lines }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
}));
