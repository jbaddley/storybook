/**
 * useAutosave Hook
 * Automatically saves book to the .sbk file with debouncing
 * Also syncs to database when user is authenticated
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { fileService } from '../services/fileService';
import { dbSyncService, ConflictWithResolution } from '../services/dbSyncService';

// Check if running in Electron
const isElectron = () => typeof window !== 'undefined' && window.electronAPI !== undefined;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'no-file' | 'syncing' | 'conflict';

interface UseAutosaveOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number;
  /** Interval for periodic saves in milliseconds (default: 30000) */
  intervalMs?: number;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutosaveReturn {
  status: AutosaveStatus;
  lastSaved: Date | null;
  forceSave: () => void;
  filePath: string | null;
  pendingConflicts: ConflictWithResolution[];
  resolveConflicts: (resolutions: Map<string, 'keep_db' | 'keep_file' | 'keep_both'>) => Promise<void>;
  dbSyncEnabled: boolean;
}

export function useAutosave(options: UseAutosaveOptions = {}): UseAutosaveReturn {
  const {
    debounceMs = 2000,
    intervalMs = 30000,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<ConflictWithResolution[]>([]);
  const [dbSyncEnabled, setDbSyncEnabled] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  const isSaving = useRef(false);
  const lastBookHash = useRef<string>('');

  const { book, ui, setDirty, setBook } = useBookStore();
  const currentFilePath = ui.currentFilePath;

  // Generate a simple hash of book content to detect changes
  const getBookHash = useCallback(() => {
    return JSON.stringify({
      title: book.title,
      chapters: book.chapters.map(c => ({ id: c.id, content: c.content, title: c.title })),
      documentTabs: book.documentTabs?.map(t => ({ id: t.id, content: t.content })),
      updatedAt: book.updatedAt,
    });
  }, [book]);

  // Perform the actual save to .sbk file and sync to database
  const performSave = useCallback(async () => {
    // Don't save if:
    // - Not enabled
    // - Already saving
    // - No file path (user hasn't saved the file yet)
    // - Not running in Electron
    if (!enabled || isSaving.current || !currentFilePath || !isElectron()) {
      if (!currentFilePath && enabled) {
        setStatus('no-file');
      }
      return;
    }

    // Check if book actually changed since last save
    const currentHash = getBookHash();
    if (currentHash === lastBookHash.current) {
      return; // No changes, skip save
    }

    isSaving.current = true;
    setStatus('saving');
    
    try {
      // Save book to .sbk format
      const data = await fileService.saveBook(book);
      
      // Write to file via Electron IPC
      const savedPath = await window.electronAPI.saveFile(data, currentFilePath);
      
      if (savedPath) {
        lastBookHash.current = currentHash;
        console.log(`[Autosave] Saved to ${savedPath}`);
        
        // Now sync to database if user is authenticated
        if (dbSyncEnabled && dbSyncService.getCurrentUserId()) {
          setStatus('syncing');
          
          const syncResult = await dbSyncService.syncBook(book);
          
          if (syncResult.success) {
            console.log('[Autosave] Synced to database');
            setStatus('saved');
            setLastSaved(new Date());
            setDirty(false);
          } else if (syncResult.conflicts && syncResult.conflicts.length > 0) {
            // There are conflicts that need user resolution
            console.log('[Autosave] Database sync has conflicts:', syncResult.conflicts);
            setPendingConflicts(syncResult.conflicts);
            setStatus('conflict');
            setLastSaved(new Date()); // File was still saved
            setDirty(false);
          } else {
            // Sync failed but file was saved
            console.warn('[Autosave] Database sync failed:', syncResult.error);
            setStatus('saved');
            setLastSaved(new Date());
            setDirty(false);
          }
        } else {
          // No database sync, just file save
          setStatus('saved');
          setLastSaved(new Date());
          setDirty(false);
        }
        
        // Reset status after a short delay (unless there are conflicts)
        if (status !== 'conflict') {
          setTimeout(() => {
            if (pendingConflicts.length === 0) {
              setStatus('idle');
            }
          }, 2000);
        }
      } else {
        // This shouldn't happen since we're providing the file path
        setStatus('error');
        console.error('[Autosave] Save returned no path');
      }
    } catch (error) {
      console.error('[Autosave] Error:', error);
      setStatus('error');
      // Reset error status after a delay
      setTimeout(() => setStatus('idle'), 5000);
    } finally {
      isSaving.current = false;
    }
  }, [book, currentFilePath, enabled, getBookHash, setDirty, dbSyncEnabled, status, pendingConflicts.length]);

  // Debounced save - triggers after changes
  const debouncedSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);
  }, [performSave, debounceMs]);

  // Watch for changes and trigger debounced save
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Initialize the hash on first render
      lastBookHash.current = getBookHash();
      return;
    }

    if (!enabled || !currentFilePath) return;

    // Skip if book is empty/new
    if (book.chapters.length === 0 && !book.title) return;

    debouncedSave();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [book, debouncedSave, enabled, currentFilePath, getBookHash]);

  // Periodic save interval (as backup)
  useEffect(() => {
    if (!enabled || !currentFilePath) return;

    intervalTimerRef.current = setInterval(() => {
      performSave();
    }, intervalMs);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [performSave, intervalMs, enabled, currentFilePath]);

  // Force an immediate save
  const forceSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    performSave();
  }, [performSave]);

  // Save before page unload (best effort)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (enabled && currentFilePath && ui.isDirty) {
        // Trigger a save - note this may not complete before the page closes
        // but at least we tried
        performSave();
        
        // Show browser's "unsaved changes" warning if dirty
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, currentFilePath, ui.isDirty, performSave]);

  // Update status when file path changes
  useEffect(() => {
    if (!currentFilePath && enabled) {
      setStatus('no-file');
    } else if (currentFilePath && status === 'no-file') {
      setStatus('idle');
    }
  }, [currentFilePath, enabled, status]);

  // Check if database sync should be enabled
  useEffect(() => {
    const checkDbConnection = async () => {
      const userId = dbSyncService.getCurrentUserId();
      const isConnected = userId ? await dbSyncService.isDatabaseAvailable() : false;
      const shouldEnable = isConnected && !!userId;
      
      if (shouldEnable !== dbSyncEnabled) {
        console.log('[Autosave] Database sync enabled:', shouldEnable, 'userId:', userId);
      }
      setDbSyncEnabled(shouldEnable);
    };
    
    checkDbConnection();
    
    // Re-check more frequently to catch sign-in quickly
    const interval = setInterval(checkDbConnection, 5000);
    return () => clearInterval(interval);
  }, [dbSyncEnabled]);

  // Resolve conflicts callback
  const resolveConflicts = useCallback(async (
    resolutions: Map<string, 'keep_db' | 'keep_file' | 'keep_both'>
  ) => {
    if (pendingConflicts.length === 0) return;
    
    setStatus('syncing');
    
    try {
      const result = await dbSyncService.resolveConflicts(book, resolutions);
      
      if (result.success) {
        setPendingConflicts([]);
        setStatus('saved');
        
        // If we kept DB versions for any chapters, we need to reload
        const keptDbVersions = [...resolutions.values()].includes('keep_db');
        if (keptDbVersions) {
          // Reload book from sync service's merged state
          const dbBook = await dbSyncService.loadBookFromDatabase(book.id);
          if (dbBook) {
            setBook(dbBook);
          }
        }
        
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        console.error('[Autosave] Failed to resolve conflicts:', result.error);
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('[Autosave] Error resolving conflicts:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  }, [book, pendingConflicts.length, setBook]);

  return {
    status,
    lastSaved,
    forceSave,
    filePath: currentFilePath,
    pendingConflicts,
    resolveConflicts,
    dbSyncEnabled,
  };
}
