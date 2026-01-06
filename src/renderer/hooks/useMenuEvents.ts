import { useEffect } from 'react';

interface MenuEventHandlers {
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  onSettings?: () => void;
  onToggleChapters?: () => void;
  onToggleAI?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onImportGoogleDocs?: () => void;
  onExportGoogleDocs?: () => void;
  onSyncGoogleDocs?: () => void;
}

// Check if running in Electron
const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

export function useMenuEvents(handlers: MenuEventHandlers) {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Only set up IPC listeners if running in Electron
    if (isElectron()) {
      if (handlers.onNew) {
        cleanups.push(window.electronAPI.onMenuNew(handlers.onNew));
      }
      if (handlers.onOpen) {
        cleanups.push(window.electronAPI.onMenuOpen(handlers.onOpen));
      }
      if (handlers.onSave) {
        cleanups.push(window.electronAPI.onMenuSave(handlers.onSave));
      }
      if (handlers.onSaveAs) {
        cleanups.push(window.electronAPI.onMenuSaveAs(handlers.onSaveAs));
      }
      if (handlers.onExportDocx) {
        cleanups.push(window.electronAPI.onMenuExportDocx(handlers.onExportDocx));
      }
      if (handlers.onExportPdf) {
        cleanups.push(window.electronAPI.onMenuExportPdf(handlers.onExportPdf));
      }
      if (handlers.onSettings) {
        cleanups.push(window.electronAPI.onMenuSettings(handlers.onSettings));
      }
      if (handlers.onImportGoogleDocs && window.electronAPI.onMenuImportGoogleDocs) {
        cleanups.push(window.electronAPI.onMenuImportGoogleDocs(handlers.onImportGoogleDocs));
      }
      if (handlers.onExportGoogleDocs && window.electronAPI.onMenuExportGoogleDocs) {
        cleanups.push(window.electronAPI.onMenuExportGoogleDocs(handlers.onExportGoogleDocs));
      }
      if (handlers.onSyncGoogleDocs && window.electronAPI.onMenuSyncGoogleDocs) {
        cleanups.push(window.electronAPI.onMenuSyncGoogleDocs(handlers.onSyncGoogleDocs));
      }
    }

    // Keyboard shortcuts for zoom (work in both browser and Electron)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handlers.onZoomIn?.();
      } else if (isMod && e.key === '-') {
        e.preventDefault();
        handlers.onZoomOut?.();
      } else if (isMod && e.key === '0') {
        e.preventDefault();
        handlers.onZoomReset?.();
      } else if (isMod && e.key === '1') {
        e.preventDefault();
        handlers.onToggleChapters?.();
      } else if (isMod && e.key === '2') {
        e.preventDefault();
        handlers.onToggleAI?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    cleanups.push(() => window.removeEventListener('keydown', handleKeyDown));

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [handlers]);
}

