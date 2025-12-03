import { Chapter } from '@shared/types';

export interface ProjectData {
  content?: string; // Legacy support
  metadata: {
    title?: string;
    author?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  storyElements?: {
    characters: any[];
    locations: any[];
    dates: any[];
    themes: any[];
  };
  htmlContent?: string; // Legacy support
  chapters?: Chapter[]; // New chapter-based structure
}

declare global {
  interface Window {
    electronAPI: {
      saveProject: (filePath: string, data: ProjectData) => Promise<void>;
      loadProject: (filePath: string) => Promise<ProjectData>;
      showSaveDialog: () => Promise<string | undefined>;
      showOpenDialog: () => Promise<string | undefined>;
    };
  }
}

export const electronAPI = window.electronAPI;

