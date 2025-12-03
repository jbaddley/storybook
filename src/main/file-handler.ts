import { dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectData {
  content: string;
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
}

export async function saveProject(filePath: string, data: ProjectData): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function loadProject(filePath: string): Promise<ProjectData> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function showSaveDialog(): Promise<string | undefined> {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'Storybook Project', extensions: ['sbk'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'untitled.sbk'
  });

  if (result.canceled) {
    return undefined;
  }

  return result.filePath;
}

export async function showOpenDialog(): Promise<string | undefined> {
  const result = await dialog.showOpenDialog({
    filters: [
      { name: 'Storybook Project', extensions: ['sbk'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return undefined;
  }

  return result.filePaths[0];
}

