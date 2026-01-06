import { useCallback, useEffect, useRef } from 'react';
import { useBookStore } from '../stores/bookStore';
import { fileService } from '../services/fileService';
import { exportService } from '../services/exportService';

// Check if running in Electron
const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

// Storage key for last opened file
const LAST_FILE_KEY = 'storybook-last-file';

// Helper to save last file path
async function saveLastFilePath(filePath: string) {
  if (isElectron()) {
    try {
      await window.electronAPI.storeSet(LAST_FILE_KEY, filePath);
    } catch (e) {
      localStorage.setItem(LAST_FILE_KEY, filePath);
    }
  } else {
    localStorage.setItem(LAST_FILE_KEY, filePath);
  }
}

// Helper to get last file path
async function getLastFilePath(): Promise<string | null> {
  if (isElectron()) {
    try {
      const path = await window.electronAPI.storeGet(LAST_FILE_KEY);
      return path as string | null;
    } catch (e) {
      return localStorage.getItem(LAST_FILE_KEY);
    }
  }
  return localStorage.getItem(LAST_FILE_KEY);
}

// Helper to clear last file path
async function clearLastFilePath() {
  if (isElectron()) {
    try {
      await window.electronAPI.storeSet(LAST_FILE_KEY, '');
    } catch (e) {
      localStorage.removeItem(LAST_FILE_KEY);
    }
  } else {
    localStorage.removeItem(LAST_FILE_KEY);
  }
}

export function useFileOperations() {
  const { 
    book, 
    setBook, 
    newBook, 
    ui, 
    setDirty, 
    setCurrentFilePath 
  } = useBookStore();

  const handleNew = useCallback(async () => {
    if (ui.isDirty) {
      const shouldSave = confirm('You have unsaved changes. Would you like to save before creating a new book?');
      if (shouldSave) {
        await handleSave();
      }
    }
    newBook();
  }, [ui.isDirty, newBook]);

  const handleOpen = useCallback(async () => {
    if (!isElectron()) {
      alert('File operations require running in Electron.');
      return;
    }
    
    try {
      const result = await window.electronAPI.openFile();
      if (result) {
        const loadedBook = await fileService.loadBook(result.data);
        setBook(loadedBook);
        setCurrentFilePath(result.filePath);
        
        // Remember this file as the last opened
        await saveLastFilePath(result.filePath);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Failed to open file. Please make sure it is a valid .sbk file.');
    }
  }, [setBook, setCurrentFilePath]);

  // Open a specific file by path
  const openFilePath = useCallback(async (filePath: string) => {
    if (!isElectron()) return false;
    
    try {
      const data = await window.electronAPI.readFile(filePath);
      if (data) {
        const loadedBook = await fileService.loadBook(data);
        setBook(loadedBook);
        setCurrentFilePath(filePath);
        console.log('Opened last file:', filePath);
        return true;
      }
    } catch (error) {
      console.error('Error opening file:', error);
      // Clear the last file if it can't be opened
      clearLastFilePath();
    }
    return false;
  }, [setBook, setCurrentFilePath]);

  const handleSave = useCallback(async () => {
    if (!isElectron()) {
      // In browser mode, save to localStorage as a demo
      try {
        const data = await fileService.saveBook(book);
        localStorage.setItem('storybook-autosave', data);
        setDirty(false);
        console.log('Saved to localStorage');
      } catch (error) {
        console.error('Error saving:', error);
      }
      return;
    }
    
    try {
      const data = await fileService.saveBook(book);
      const filePath = await window.electronAPI.saveFile(data, ui.currentFilePath || undefined);
      
      if (filePath) {
        setCurrentFilePath(filePath);
        setDirty(false);
        // Remember this file as the last opened
        await saveLastFilePath(filePath);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Failed to save file.');
    }
  }, [book, ui.currentFilePath, setCurrentFilePath, setDirty]);

  const handleSaveAs = useCallback(async () => {
    if (!isElectron()) {
      alert('Save As requires running in Electron.');
      return;
    }
    
    try {
      const data = await fileService.saveBook(book);
      const filePath = await window.electronAPI.saveFileAs(data);
      
      if (filePath) {
        setCurrentFilePath(filePath);
        setDirty(false);
        // Remember this file as the last opened
        await saveLastFilePath(filePath);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert('Failed to save file.');
    }
  }, [book, setCurrentFilePath, setDirty]);

  const handleExportDocx = useCallback(async () => {
    if (!isElectron()) {
      // In browser mode, download as blob
      try {
        const data = await exportService.exportToDocx(book);
        const blob = new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], 
          { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${book.title}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting DOCX:', error);
        alert('Failed to export DOCX.');
      }
      return;
    }
    
    try {
      const data = await exportService.exportToDocx(book);
      await window.electronAPI.exportDocx(data);
    } catch (error) {
      console.error('Error exporting DOCX:', error);
      alert('Failed to export DOCX.');
    }
  }, [book]);

  const handleExportPdf = useCallback(async () => {
    if (!isElectron()) {
      alert('PDF export requires running in Electron.');
      return;
    }
    
    try {
      const data = await exportService.exportToPdf(book);
      await window.electronAPI.exportPdf(data);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF.');
    }
  }, [book]);

  // Track if we've attempted to load the last file
  const hasAttemptedLastFile = useRef(false);

  // Load the last opened file on startup
  useEffect(() => {
    if (hasAttemptedLastFile.current) return;
    hasAttemptedLastFile.current = true;

    const loadLastFile = async () => {
      const lastPath = await getLastFilePath();
      if (lastPath) {
        console.log('Attempting to open last file:', lastPath);
        await openFilePath(lastPath);
      }
    };

    // Small delay to let the app initialize
    setTimeout(loadLastFile, 100);
  }, [openFilePath]);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleExportDocx,
    handleExportPdf,
    openFilePath,
  };
}

