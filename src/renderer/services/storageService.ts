/**
 * Storage Service
 * Uses IndexedDB for large data storage with localStorage fallback
 * IndexedDB can handle 50MB+ easily (browser dependent, but much larger than localStorage)
 */

import { Book, ChapterSummary, AISuggestion } from '../../shared/types';

const DB_NAME = 'storybook_db';
const DB_VERSION = 1;
const STORE_NAME = 'autosave';
const AUTOSAVE_KEY = 'current_session';

// Fallback localStorage keys
const LS_AUTOSAVE_KEY = 'storybook_autosave';
const LS_TIMESTAMP_KEY = 'storybook_autosave_timestamp';

export interface AutosaveData {
  book: Book;
  ai: {
    summaries: Record<string, ChapterSummary>;
    suggestions: AISuggestion[];
  };
  activeChapterId: string | null;
  timestamp: string;
  version: number;
}

const CURRENT_VERSION = 2;

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

  return dbInitPromise;
}

/**
 * Save to IndexedDB (primary) with localStorage fallback
 */
export async function saveAutosave(
  book: Book,
  ai: { summaries: Map<string, ChapterSummary>; suggestions: AISuggestion[] },
  activeChapterId: string | null
): Promise<{ success: boolean; storage: 'indexeddb' | 'localstorage'; size: number }> {
  const data: AutosaveData & { id: string } = {
    id: AUTOSAVE_KEY,
    book,
    ai: {
      summaries: Object.fromEntries(ai.summaries),
      suggestions: ai.suggestions,
    },
    activeChapterId,
    timestamp: new Date().toISOString(),
    version: CURRENT_VERSION,
  };

  const serialized = JSON.stringify(data);
  const size = new Blob([serialized]).size;

  // Try IndexedDB first
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => {
        // Also save timestamp to localStorage for quick checking
        try {
          localStorage.setItem(LS_TIMESTAMP_KEY, data.timestamp);
        } catch (e) {
          // Ignore localStorage errors
        }
        resolve({ success: true, storage: 'indexeddb', size });
      };

      request.onerror = () => {
        console.error('IndexedDB save error:', request.error);
        // Fall back to localStorage
        const lsResult = saveToLocalStorage(serialized, data.timestamp);
        resolve({ ...lsResult, size });
      };
    });
  } catch (error) {
    console.warn('IndexedDB not available, using localStorage:', error);
    const lsResult = saveToLocalStorage(serialized, data.timestamp);
    return { ...lsResult, size };
  }
}

/**
 * Fallback: Save to localStorage
 */
function saveToLocalStorage(
  serialized: string,
  timestamp: string
): { success: boolean; storage: 'localstorage' } {
  try {
    localStorage.setItem(LS_AUTOSAVE_KEY, serialized);
    localStorage.setItem(LS_TIMESTAMP_KEY, timestamp);
    return { success: true, storage: 'localstorage' };
  } catch (error) {
    console.error('localStorage save error:', error);
    
    // If quota exceeded, try to clear old data and retry
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded');
    }
    
    return { success: false, storage: 'localstorage' };
  }
}

/**
 * Load autosave from IndexedDB or localStorage
 */
export async function loadAutosave(): Promise<AutosaveData | null> {
  // Try IndexedDB first
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(AUTOSAVE_KEY);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as AutosaveData);
        } else {
          // Try localStorage fallback
          resolve(loadFromLocalStorage());
        }
      };

      request.onerror = () => {
        console.error('IndexedDB load error:', request.error);
        resolve(loadFromLocalStorage());
      };
    });
  } catch (error) {
    console.warn('IndexedDB not available, trying localStorage:', error);
    return loadFromLocalStorage();
  }
}

/**
 * Load from localStorage (fallback)
 */
function loadFromLocalStorage(): AutosaveData | null {
  try {
    const serialized = localStorage.getItem(LS_AUTOSAVE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as AutosaveData;
  } catch (error) {
    console.error('localStorage load error:', error);
    return null;
  }
}

/**
 * Check if autosave exists (quick check using localStorage timestamp)
 */
export async function hasAutosave(): Promise<boolean> {
  // Quick check via localStorage timestamp first
  const timestamp = localStorage.getItem(LS_TIMESTAMP_KEY);
  if (timestamp) return true;
  
  // Fallback: check IndexedDB
  try {
    const data = await loadAutosave();
    return data !== null;
  } catch {
    return false;
  }
}

/**
 * Get autosave timestamp (quick check via localStorage)
 */
export function getAutosaveTimestamp(): Date | null {
  const timestamp = localStorage.getItem(LS_TIMESTAMP_KEY);
  if (!timestamp) return null;
  return new Date(timestamp);
}

/**
 * Clear autosave from both IndexedDB and localStorage
 */
export async function clearAutosave(): Promise<void> {
  // Clear localStorage
  localStorage.removeItem(LS_AUTOSAVE_KEY);
  localStorage.removeItem(LS_TIMESTAMP_KEY);
  
  // Clear IndexedDB
  try {
    const db = await initDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(AUTOSAVE_KEY);
      
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('IndexedDB clear error:', request.error);
        resolve();
      };
    });
  } catch (error) {
    console.warn('Could not clear IndexedDB:', error);
  }
}

/**
 * Get storage usage info
 */
export async function getStorageInfo(): Promise<{
  used: number;
  available: number | null;
  percentage: number | null;
}> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        used,
        available: quota - used,
        percentage: quota > 0 ? Math.round((used / quota) * 100) : null,
      };
    }
  } catch (e) {
    console.warn('Storage estimate not available');
  }
  
  return { used: 0, available: null, percentage: null };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

