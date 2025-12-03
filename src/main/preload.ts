import { contextBridge, ipcRenderer } from 'electron';
import { ProjectData } from './file-handler';

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (filePath: string, data: ProjectData) =>
    ipcRenderer.invoke('save-project', filePath, data),
  loadProject: (filePath: string) =>
    ipcRenderer.invoke('load-project', filePath),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
});

