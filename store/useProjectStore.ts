import { create } from 'zustand';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import type { GridStore } from './useGridStore';

export interface ProjectMetadata {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail: string; // base64
}

export interface Project extends ProjectMetadata {
  snapshot: Partial<GridStore>;
}

interface ProjectStore {
  projects: ProjectMetadata[];
  activeProjectId: string | null;
  isLoading: boolean;
  
  loadProjects: () => Promise<void>;
  createProject: (name: string, snapshot: Partial<GridStore>, thumbnail?: string) => Promise<string>;
  saveCurrentProject: (snapshot: Partial<GridStore>, thumbnail?: string) => Promise<void>;
  loadProject: (id: string) => Promise<Partial<GridStore> | null>;
  renameProject: (id: string, newName: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const lf = localforage.createInstance({
  name: 'GridSketch',
  storeName: 'projects'
});

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  isLoading: true,

  loadProjects: async () => {
    set({ isLoading: true });
    try {
      const keys = await lf.keys();
      const metadataList: ProjectMetadata[] = [];
      for (const key of keys) {
        const p = await lf.getItem<Project>(key);
        if (p) {
          metadataList.push({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt,
            thumbnail: p.thumbnail,
          });
        }
      }
      // Sort by newest
      metadataList.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ projects: metadataList, isLoading: false });
    } catch (err) {
      console.error('Failed to load projects', err);
      set({ isLoading: false });
    }
  },

  createProject: async (name, snapshot, thumbnail = '') => {
    const id = uuidv4();
    const newProject: Project = {
      id,
      name,
      updatedAt: Date.now(),
      thumbnail,
      snapshot
    };
    await lf.setItem(id, newProject);
    await get().loadProjects();
    set({ activeProjectId: id });
    return id;
  },

  saveCurrentProject: async (snapshot, thumbnail) => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;
    const existing = await lf.getItem<Project>(activeProjectId);
    if (!existing) return;

    const updated: Project = {
      ...existing,
      updatedAt: Date.now(),
      thumbnail: thumbnail !== undefined ? thumbnail : existing.thumbnail,
      snapshot
    };
    await lf.setItem(activeProjectId, updated);
    await get().loadProjects();
  },

  loadProject: async (id) => {
    const p = await lf.getItem<Project>(id);
    if (p) {
      set({ activeProjectId: p.id });
      // touch the updatedAt? No, just load it
      return p.snapshot;
    }
    return null;
  },

  renameProject: async (id, newName) => {
    const p = await lf.getItem<Project>(id);
    if (p) {
      p.name = newName;
      p.updatedAt = Date.now();
      await lf.setItem(id, p);
      await get().loadProjects();
    }
  },

  duplicateProject: async (id) => {
    const p = await lf.getItem<Project>(id);
    if (p) {
      const newId = uuidv4();
      const dup: Project = {
        ...p,
        id: newId,
        name: `${p.name} (Copy)`,
        updatedAt: Date.now()
      };
      await lf.setItem(newId, dup);
      await get().loadProjects();
    }
  },

  deleteProject: async (id) => {
    await lf.removeItem(id);
    if (get().activeProjectId === id) {
      set({ activeProjectId: null });
    }
    await get().loadProjects();
  }
}));
