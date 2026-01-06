/**
 * useAutosave Hook
 * Automatically saves book state to IndexedDB/localStorage with debouncing
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import {
  saveAutosave,
  loadAutosave,
  hasAutosave as checkHasAutosave,
  clearAutosave,
  getAutosaveTimestamp,
  formatBytes,
} from '../services/storageService';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type StorageType = 'indexeddb' | 'localstorage';

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
  hasRecoveryData: boolean;
  recoverData: () => Promise<boolean>;
  dismissRecovery: () => void;
  forceSave: () => void;
  clearSavedData: () => void;
  storageType: StorageType | null;
  lastSaveSize: number | null;
}

export function useAutosave(options: UseAutosaveOptions = {}): UseAutosaveReturn {
  const {
    debounceMs = 2000,
    intervalMs = 30000,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(getAutosaveTimestamp());
  const [hasRecoveryData, setHasRecoveryData] = useState(false);
  const [storageType, setStorageType] = useState<StorageType | null>(null);
  const [lastSaveSize, setLastSaveSize] = useState<number | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);
  const isSaving = useRef(false);

  const { book, ai, activeChapterId, setBook, setAISummaries, setActiveChapter } = useBookStore();

  // Check for recovery data on mount - auto-recover silently
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      
      checkHasAutosave().then(async (hasData) => {
        if (hasData) {
          const timestamp = getAutosaveTimestamp();
          console.log(`Found autosaved data from ${timestamp?.toLocaleString()}, auto-recovering...`);
          
          // Auto-recover silently instead of showing dialog
          try {
            const data = await loadAutosave();
            if (data) {
              setBook(data.book);
              if (data.ai?.summaries) {
                // Convert Record to Map if needed
                const summariesMap = data.ai.summaries instanceof Map 
                  ? data.ai.summaries 
                  : new Map(Object.entries(data.ai.summaries));
                setAISummaries(summariesMap);
              }
              if (data.activeChapterId) {
                setActiveChapter(data.activeChapterId);
              }
              console.log('Successfully auto-recovered data');
            }
          } catch (error) {
            console.error('Failed to auto-recover:', error);
          }
        }
        // Never show the recovery dialog
        setHasRecoveryData(false);
      });
    }
  }, [setBook, setAISummaries, setActiveChapter]);

  // Perform the actual save
  const performSave = useCallback(async () => {
    if (!enabled || isSaving.current) return;

    isSaving.current = true;
    setStatus('saving');
    
    try {
      const result = await saveAutosave(book, ai, activeChapterId);
      
      if (result.success) {
        setStatus('saved');
        setLastSaved(new Date());
        setStorageType(result.storage);
        setLastSaveSize(result.size);
        
        // Log size for debugging large books
        if (result.size > 1024 * 1024) { // > 1MB
          console.log(`Autosave size: ${formatBytes(result.size)} (using ${result.storage})`);
        }
        
        // Reset status after a short delay
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('error');
        console.error('Autosave failed');
      }
    } catch (error) {
      console.error('Autosave error:', error);
      setStatus('error');
    } finally {
      isSaving.current = false;
    }
  }, [book, ai, activeChapterId, enabled]);

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
    if (!enabled || isFirstRender.current) return;

    // Skip if book is empty/new and unchanged
    if (book.chapters.length === 0 && !book.title) return;

    debouncedSave();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [book, ai.summaries, ai.suggestions, debouncedSave, enabled]);

  // Periodic save interval
  useEffect(() => {
    if (!enabled) return;

    intervalTimerRef.current = setInterval(() => {
      performSave();
    }, intervalMs);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
      }
    };
  }, [performSave, intervalMs, enabled]);

  // Recover data from storage
  const recoverData = useCallback(async (): Promise<boolean> => {
    try {
      const data = await loadAutosave();
      if (!data) return false;

      // Restore book state
      setBook(data.book);
      
      // Restore AI state (summaries)
      if (data.ai && data.ai.summaries) {
        const summariesMap = new Map(Object.entries(data.ai.summaries));
        setAISummaries(summariesMap);
      }
      
      // Restore active chapter
      if (data.activeChapterId) {
        setActiveChapter(data.activeChapterId);
      }

      setHasRecoveryData(false);
      console.log('Successfully recovered autosaved data');
      return true;
    } catch (error) {
      console.error('Failed to recover data:', error);
      return false;
    }
  }, [setBook, setAISummaries, setActiveChapter]);

  // Dismiss recovery prompt without recovering
  const dismissRecovery = useCallback(() => {
    clearAutosave();
    setHasRecoveryData(false);
  }, []);

  // Force an immediate save
  const forceSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    performSave();
  }, [performSave]);

  // Clear saved data (call after manual file save)
  const clearSavedData = useCallback(() => {
    clearAutosave();
    setLastSaved(null);
  }, []);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabled) {
        // Synchronous save attempt using localStorage as fallback
        // (IndexedDB is async and may not complete before page closes)
        try {
          const data = {
            id: 'current_session',
            book,
            ai: {
              summaries: Object.fromEntries(ai.summaries),
              suggestions: ai.suggestions,
            },
            activeChapterId,
            timestamp: new Date().toISOString(),
            version: 2,
          };
          localStorage.setItem('storybook_autosave', JSON.stringify(data));
          localStorage.setItem('storybook_autosave_timestamp', data.timestamp);
        } catch (e) {
          console.warn('Could not save on unload:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [book, ai, activeChapterId, enabled]);

  return {
    status,
    lastSaved,
    hasRecoveryData,
    recoverData,
    dismissRecovery,
    forceSave,
    clearSavedData,
    storageType,
    lastSaveSize,
  };
}
