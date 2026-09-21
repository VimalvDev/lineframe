import { create } from 'zustand';

interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  isPanMode: boolean;

  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setPanMode: (isPanMode: boolean) => void;
  resetView: () => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanMode: false,

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setPanMode: (isPanMode) => set({ isPanMode }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
}));
