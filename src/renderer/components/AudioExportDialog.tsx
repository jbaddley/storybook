import React, { useState, useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';
import { openAIService } from '../services/openaiService';
import { googleDocsService, GoogleDriveFile } from '../services/googleDocsService';
import { googleAuthService } from '../services/googleAuthService';
import { audioQueueService, AudioQueueItem } from '../services/audioQueueService';
import { TTSVoice, TipTapContent } from '../../shared/types';

// localStorage key for audio export settings
const AUDIO_SETTINGS_KEY = 'audio-export-settings';

// Settings interface
interface AudioExportSettings {
  voice: TTSVoice;
  uploadToGoogleDrive: boolean;
  googleDriveFolderId?: string;
  googleDriveFolderPath?: string;
  createNewFolder: boolean;
}

// Folder path for breadcrumb navigation
interface FolderPath {
  id: string;
  name: string;
}

// Default settings
const DEFAULT_SETTINGS: AudioExportSettings = {
  voice: 'nova',
  uploadToGoogleDrive: false,
  createNewFolder: false,
};

// Load settings from localStorage (exported for menu "Export all audio")
export function loadAudioSettings(): AudioExportSettings {
  try {
    const stored = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load audio settings:', e);
  }
  return DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveAudioSettings(settings: Partial<AudioExportSettings>): void {
  try {
    const current = loadAudioSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save audio settings:', e);
  }
}

// Current export folder when "Create new folder" is used for local save (shared across Save clicks in this session)
let currentExportFolderPath: string | null = null;
// When "Create new folder" + Google Drive: ID of the timestamped folder we created on Drive (shared across uploads in this session)
let currentGoogleDriveExportFolderId: string | null = null;

/** Clear the current export folder(s) so the next export can choose/create new ones. Call when dialog opens. */
export function clearAudioExportFolder(): void {
  currentExportFolderPath = null;
  currentGoogleDriveExportFolderId = null;
}

/**
 * Ensure the local export folder exists (when "Create new folder" is used).
 * Prompts for parent directory once per session, creates timestamped subfolder.
 * Returns the folder path to save into, or null if user cancels or settings don't use createNewFolder.
 */
export async function ensureLocalExportFolder(): Promise<string | null> {
  const settings = loadAudioSettings();
  if (!settings.createNewFolder) return null;
  if (currentExportFolderPath) return currentExportFolderPath;
  const bookTitle = useBookStore.getState().book?.title ?? '';
  const folderName = getExportFolderName(bookTitle);
  const path = await window.electronAPI.pickDirAndCreateSubfolder(folderName);
  if (!path) return null;
  currentExportFolderPath = path;
  return path;
}

/** Generate a safe folder name: Book Title + timestamp (e.g. "My_Book_2025-02-03_14-30-52") */
function getExportFolderName(bookTitle: string): string {
  const safeTitle = (bookTitle || 'Audio_Export')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return (safeTitle || 'Audio_Export') + '_' + timestamp;
}

/**
 * When "Create new folder" + Google Drive: ensure a timestamped folder exists inside the given parent on Drive.
 * Returns the folder ID to upload to, or null if creation failed.
 */
export async function ensureGoogleDriveExportFolder(parentFolderId: string): Promise<string | null> {
  if (currentGoogleDriveExportFolderId) return currentGoogleDriveExportFolderId;
  try {
    const bookTitle = useBookStore.getState().book?.title ?? '';
    const folderName = getExportFolderName(bookTitle);
    const { folderId } = await googleDocsService.createFolder(folderName, parentFolderId);
    currentGoogleDriveExportFolderId = folderId;
    return folderId;
  } catch (err) {
    console.error('[AudioExport] Failed to create Google Drive folder:', err);
    return null;
  }
}

/**
 * Save audio to file (local only). If settings have createNewFolder, uses a timestamped folder (prompts once per session).
 * Returns the path where the file was saved, or null if cancelled/failed.
 */
export async function saveAudioToFile(base64: string, fileName: string): Promise<string | null> {
  const settings = loadAudioSettings();
  if (settings.createNewFolder) {
    if (!currentExportFolderPath) {
      const bookTitle = useBookStore.getState().book?.title ?? '';
      const folderName = getExportFolderName(bookTitle);
      const path = await window.electronAPI.pickDirAndCreateSubfolder(folderName);
      if (!path) return null;
      currentExportFolderPath = path;
    }
    const written = await window.electronAPI.writeMp3ToPath(base64, currentExportFolderPath, fileName);
    return written;
  }
  return await window.electronAPI.exportMp3(base64, fileName);
}

// Icons
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const GoogleDriveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const LoadingSpinner = () => (
  <div className="spinner" style={{ width: '16px', height: '16px' }} />
);

interface AudioExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, dialog is in "export all chapters" mode (e.g. from File menu). Otherwise single chapter by chapterId. */
  chapterId: string;
  exportAll?: boolean;
}

// Voice options with descriptions
const VOICE_OPTIONS: { value: TTSVoice; label: string; description: string }[] = [
  { value: 'nova', label: 'Nova', description: 'Female, warm and natural' },
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
  { value: 'echo', label: 'Echo', description: 'Male, measured' },
  { value: 'fable', label: 'Fable', description: 'Expressive, British accent' },
  { value: 'onyx', label: 'Onyx', description: 'Deep male voice' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft female voice' },
];

// Helper to extract text from TipTap content (exported for menu "Export all audio")
export function extractTextFromContent(content: TipTapContent): string {
  if (!content?.content) return '';
  
  const extractFromNode = (node: any): string => {
    if (node.text) return node.text;
    if (node.content) {
      return node.content.map(extractFromNode).join(node.type === 'paragraph' ? '\n' : '');
    }
    return '';
  };
  
  return content.content.map(extractFromNode).join('\n\n');
}

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Helper to estimate audio duration (rough estimate: ~150 words per minute)
function estimateDuration(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 150);
  if (minutes < 1) return 'Less than 1 minute';
  if (minutes === 1) return '~1 minute';
  return `~${minutes} minutes`;
}

// Store pending audio buffers for background tasks (keyed by task ID)
const pendingAudioBuffers = new Map<string, ArrayBuffer>();

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    )
  );
}

// Helper to generate safe filename
function generateSafeFilename(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50) + '.mp3';
}

// Function to upload audio to Google Drive
async function uploadToGoogleDriveHelper(
  base64Audio: string,
  fileName: string,
  folderId: string | undefined,
  addToast: (toast: any) => string
): Promise<boolean> {
  try {
    const result = await googleDocsService.uploadAudioFile(base64Audio, fileName, folderId);
    addToast({
      type: 'success',
      title: 'Uploaded to Google Drive',
      message: fileName,
      duration: 5000,
    });
    return true;
  } catch (err) {
    console.error('[GoogleDrive] Upload error:', err);
    addToast({
      type: 'error',
      title: 'Google Drive upload failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    return false;
  }
}

// Function to process a background audio export
export async function processBackgroundAudioExport(
  taskId: string,
  chapterText: string,
  chapterTitle: string,
  voice: TTSVoice,
  uploadToGoogleDriveEnabled: boolean = false,
  googleDriveFolderId?: string
) {
  const { updateBackgroundTask, removeBackgroundTask, addToast } = useBookStore.getState();
  
  try {
    // Generate speech
    const audioBuffer = await openAIService.generateSpeech(
      chapterText,
      voice,
      (progress) => {
        updateBackgroundTask(taskId, { progress, status: 'processing' });
      }
    );
    
    // Convert to base64 for both local save and Google Drive
    const base64Audio = arrayBufferToBase64(audioBuffer);
    const fileName = generateSafeFilename(chapterTitle);
    
    // If Google Drive upload is enabled, upload automatically
    if (uploadToGoogleDriveEnabled) {
      updateBackgroundTask(taskId, { 
        status: 'processing', 
        progress: 95,
      });
      
      const uploaded = await uploadToGoogleDriveHelper(base64Audio, fileName, googleDriveFolderId, addToast);
      
      // Update task as complete
      updateBackgroundTask(taskId, { 
        status: 'complete', 
        progress: 100,
        completedAt: new Date().toISOString()
      });
      
      if (uploaded) {
        addToast({
          type: 'success',
          title: `Audio complete: ${chapterTitle}`,
          message: 'Saved to Google Drive',
          duration: 5000,
        });
      }
      
      // Clean up
      removeBackgroundTask(taskId);
    } else {
      // Store the buffer for later save (original behavior)
      pendingAudioBuffers.set(taskId, audioBuffer);
      
      // Update task as complete
      updateBackgroundTask(taskId, { 
        status: 'complete', 
        progress: 100,
        completedAt: new Date().toISOString()
      });
      
      // Show success toast with save action
      addToast({
        type: 'success',
        title: `Audio ready: ${chapterTitle}`,
        message: 'Click to save the MP3 file',
        duration: 10000, // Longer duration for action toasts
        action: {
          label: 'Save',
          onClick: async () => {
            const buffer = pendingAudioBuffers.get(taskId);
            if (buffer) {
              const base64 = arrayBufferToBase64(buffer);
              const filePath = await saveAudioToFile(base64, fileName);
              if (filePath) {
                addToast({
                  type: 'success',
                  title: 'Audio saved',
                  message: filePath.split(/[/\\]/).pop(),
                });
              }
              pendingAudioBuffers.delete(taskId);
              removeBackgroundTask(taskId);
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('[BackgroundAudio] Error:', err);
    
    updateBackgroundTask(taskId, { 
      status: 'error', 
      error: err instanceof Error ? err.message : 'Failed to generate audio'
    });
    
    addToast({
      type: 'error',
      title: 'Audio generation failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    
    // Clean up after a delay
    setTimeout(() => {
      removeBackgroundTask(taskId);
    }, 5000);
  }
}

export const AudioExportDialog: React.FC<AudioExportDialogProps> = ({
  isOpen,
  onClose,
  chapterId,
  exportAll = false,
}) => {
  const { getChapterById, book } = useBookStore();
  const chapter = exportAll ? null : getChapterById(chapterId);
  
  // Voice and Google Drive settings
  const [selectedVoice, setSelectedVoice] = useState<TTSVoice>('nova');
  const [uploadToGoogleDrive, setUploadToGoogleDrive] = useState(false);
  const [createNewFolder, setCreateNewFolder] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  
  // Folder browser state
  const [folders, setFolders] = useState<GoogleDriveFile[]>([]);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([{ id: 'root', name: 'My Drive' }]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  
  // Queue state
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  const [isInQueue, setIsInQueue] = useState(false);
  
  // Export-all: which chapters are selected for export
  const [selectedExportChapterIds, setSelectedExportChapterIds] = useState<Set<string>>(new Set());
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Subscribe to queue updates
  useEffect(() => {
    const unsubscribe = audioQueueService.subscribe((queue) => {
      setAudioQueue(queue);
      setIsInQueue(chapterId ? audioQueueService.isInQueue(chapterId) : false);
    });
    return unsubscribe;
  }, [chapterId, exportAll]);

  // Load folders from Google Drive
  const loadFolders = useCallback(async (parentId?: string) => {
    setIsLoadingFolders(true);
    try {
      const foldersResult = await googleDocsService.listFolders(parentId === 'root' ? undefined : parentId);
      setFolders(foldersResult);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  }, []);

  // Navigate into a folder
  const handleNavigateIntoFolder = (folder: GoogleDriveFile) => {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFolderId(folder.id);
    saveAudioSettings({ googleDriveFolderId: folder.id, googleDriveFolderPath: [...folderPath, { id: folder.id, name: folder.name }].map(f => f.name).join(' / ') });
    loadFolders(folder.id);
  };

  // Navigate back up
  const handleNavigateUp = () => {
    if (folderPath.length <= 1) return;
    
    const newPath = folderPath.slice(0, -1);
    setFolderPath(newPath);
    const parentId = newPath[newPath.length - 1].id;
    setSelectedFolderId(parentId === 'root' ? undefined : parentId);
    saveAudioSettings({ 
      googleDriveFolderId: parentId === 'root' ? undefined : parentId, 
      googleDriveFolderPath: newPath.map(f => f.name).join(' / ') 
    });
    loadFolders(parentId === 'root' ? undefined : parentId);
  };

  // Navigate to specific path item
  const handleNavigateToPath = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    const targetId = newPath[newPath.length - 1].id;
    setSelectedFolderId(targetId === 'root' ? undefined : targetId);
    saveAudioSettings({ 
      googleDriveFolderId: targetId === 'root' ? undefined : targetId, 
      googleDriveFolderPath: newPath.map(f => f.name).join(' / ') 
    });
    loadFolders(targetId === 'root' ? undefined : targetId);
  };

  // Reset state and load settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      clearAudioExportFolder();
      // Reset error state
      setError(null);
      
      // Export-all: pre-select all eligible chapters (have content, not already in queue)
      if (exportAll) {
        const queue = audioQueueService.getQueue();
        const inQueue = new Set(
          queue.filter(i => i.status === 'queued' || i.status === 'processing').map(i => i.chapterId)
        );
        const sorted = [...book.chapters].sort((a, b) => a.order - b.order);
        const eligible = sorted.filter(ch => {
          const text = extractTextFromContent(ch.content);
          return text.trim().length > 0 && !inQueue.has(ch.id);
        });
        setSelectedExportChapterIds(new Set(eligible.map(c => c.id)));
      }
      
      // Load saved settings
      const settings = loadAudioSettings();
      setSelectedVoice(settings.voice);
      setUploadToGoogleDrive(settings.uploadToGoogleDrive);
      setCreateNewFolder(settings.createNewFolder ?? false);
      
      // Restore folder path if saved
      if (settings.googleDriveFolderPath && settings.googleDriveFolderId) {
        // Parse the saved path back into FolderPath array
        const pathParts = settings.googleDriveFolderPath.split(' / ');
        const restoredPath: FolderPath[] = [{ id: 'root', name: 'My Drive' }];
        // We only know the final folder ID, so we'll just show the path display
        if (pathParts.length > 1) {
          // Add intermediate paths (we don't have their IDs, but it's for display)
          for (let i = 1; i < pathParts.length - 1; i++) {
            restoredPath.push({ id: `unknown-${i}`, name: pathParts[i] });
          }
          // Add the final folder with known ID
          restoredPath.push({ id: settings.googleDriveFolderId, name: pathParts[pathParts.length - 1] });
        }
        setFolderPath(restoredPath);
        setSelectedFolderId(settings.googleDriveFolderId);
      } else {
        setFolderPath([{ id: 'root', name: 'My Drive' }]);
        setSelectedFolderId(undefined);
      }
      
      // Check Google auth - restore session which handles token refresh
      const checkGoogleAuth = async () => {
        const isAuth = await googleAuthService.restoreSession();
        setIsGoogleAuthenticated(isAuth);
        return isAuth;
      };
      
      checkGoogleAuth().then((isAuth) => {
        // Load folders if Google Drive is enabled and authenticated
        if (settings.uploadToGoogleDrive && isAuth) {
          loadFolders(settings.googleDriveFolderId);
        }
      });
    }
  }, [isOpen, exportAll, book.chapters, loadFolders]);

  // Handle voice change
  const handleVoiceChange = (voice: TTSVoice) => {
    setSelectedVoice(voice);
    saveAudioSettings({ voice });
  };

  // Handle Google Drive toggle
  const handleGoogleDriveToggle = (enabled: boolean) => {
    setUploadToGoogleDrive(enabled);
    saveAudioSettings({ uploadToGoogleDrive: enabled });
    
    // Load folders when enabled
    if (enabled && isGoogleAuthenticated) {
      loadFolders(selectedFolderId);
    }
  };

  if (!isOpen) return null;
  if (!exportAll && !chapter) return null;

  // Single-chapter mode: derive text and stats
  const chapterText = exportAll ? '' : extractTextFromContent(chapter!.content);
  const wordCount = countWords(chapterText);
  const estimatedTime = estimateDuration(wordCount);

  // Export-all mode: all chapters in order, eligible = have content and not in queue
  const sortedChapters = exportAll
    ? [...book.chapters].sort((a, b) => a.order - b.order)
    : [];
  const eligibleChapters = exportAll
    ? sortedChapters.filter((ch) => {
        const text = extractTextFromContent(ch.content);
        return text.trim().length > 0 && !audioQueueService.isInQueue(ch.id);
      })
    : [];
  const chaptersToExport = exportAll
    ? eligibleChapters.filter((ch) => selectedExportChapterIds.has(ch.id))
    : [];
  const totalWordsExportAll = exportAll
    ? chaptersToExport.reduce((sum, ch) => sum + countWords(extractTextFromContent(ch.content)), 0)
    : 0;

  const isEligible = (ch: { id: string; content: TipTapContent }) => {
    const text = extractTextFromContent(ch.content);
    return text.trim().length > 0 && !audioQueueService.isInQueue(ch.id);
  };

  const toggleExportChapter = (id: string) => {
    const ch = sortedChapters.find(c => c.id === id);
    if (!ch || !isEligible(ch)) return;
    setSelectedExportChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedExportChapterIds(new Set(eligibleChapters.map(c => c.id)));
  };

  const deselectAllExportChapters = () => {
    setSelectedExportChapterIds(new Set());
  };

  // Generate audio - add to queue (single chapter or all chapters)
  const handleGenerate = async () => {
    if (exportAll) {
      const isGoogleAuthenticated = uploadToGoogleDrive ? await googleAuthService.restoreSession() : false;
      const uploadToDrive = uploadToGoogleDrive && isGoogleAuthenticated;
      // If saving locally with "Create new folder", choose folder once now so files auto-save there (no per-item toasts).
      let saveDirectory: string | null = null;
      if (!uploadToDrive && createNewFolder) {
        saveDirectory = await ensureLocalExportFolder();
        if (saveDirectory === null) {
          const { addToast } = useBookStore.getState();
          addToast({ type: 'info', title: 'Export cancelled', message: 'No folder selected.' });
          return;
        }
      }
      for (const ch of chaptersToExport) {
        const text = extractTextFromContent(ch.content);
        if (!text.trim() || audioQueueService.isInQueue(ch.id)) continue;
        audioQueueService.addToQueue({
          chapterId: ch.id,
          chapterTitle: ch.title,
          chapterText: text,
          chapterNumber: ch.order,
          bookId: book?.id,
          saveDirectory: saveDirectory ?? undefined,
          voice: selectedVoice,
          uploadToGoogleDrive: uploadToDrive,
          googleDriveFolderId: selectedFolderId,
        });
      }
      const { addToast } = useBookStore.getState();
      if (chaptersToExport.length > 0) {
        addToast({
          type: 'success',
          title: 'Audio export',
          message: saveDirectory
            ? `Added ${chaptersToExport.length} chapter(s). Files will save to the chosen folder as each is ready.`
            : `Added ${chaptersToExport.length} chapter(s) to the audio queue.`,
          duration: 5000,
        });
      } else {
        addToast({
          type: 'info',
          title: 'Nothing to add',
          message: 'No chapters with content to add, or all are already in the queue.',
          duration: 5000,
        });
      }
      onClose();
      return;
    }

    if (!chapterText.trim()) {
      setError('Chapter has no content to convert to audio.');
      return;
    }
    if (audioQueueService.isInQueue(chapter!.id)) {
      setError('This chapter is already in the audio queue.');
      return;
    }
    const uploadToDrive = uploadToGoogleDrive && isGoogleAuthenticated;
    let saveDirectory: string | null = null;
    if (!uploadToDrive && createNewFolder) {
      saveDirectory = await ensureLocalExportFolder();
      if (saveDirectory === null) {
        setError('No folder selected.');
        return;
      }
    }
    audioQueueService.addToQueue({
      chapterId: chapter!.id,
      chapterTitle: chapter!.title,
      chapterText,
      chapterNumber: chapter!.order,
      bookId: book?.id,
      saveDirectory: saveDirectory ?? undefined,
      voice: selectedVoice,
      uploadToGoogleDrive: uploadToDrive,
      googleDriveFolderId: selectedFolderId,
    });
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="audio-export-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="audio-export-header">
          <div className="audio-export-title">
            <AudioIcon />
            <h2>{exportAll ? 'Export all chapters as audio' : 'Export as Audio'}</h2>
          </div>
          <button 
            className="dialog-close-btn" 
            onClick={handleClose}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="audio-export-content">
          {/* Chapter / All chapters info */}
          <div className="audio-export-info">
            {exportAll ? (
              <div className="audio-export-section">
                <label className="audio-export-label">Chapters to export</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={selectAllEligible}
                    disabled={eligibleChapters.length === 0 || selectedExportChapterIds.size === eligibleChapters.length}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={deselectAllExportChapters}
                    disabled={selectedExportChapterIds.size === 0}
                  >
                    Deselect all
                  </button>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {chaptersToExport.length} selected
                    {chaptersToExport.length > 0 && (
                      <> · {totalWordsExportAll.toLocaleString()} words · {estimateDuration(totalWordsExportAll)}</>
                    )}
                  </span>
                </div>
                <div
                  className="chapter-selection-list"
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    padding: '8px',
                  }}
                >
                  {sortedChapters.map((ch) => {
                    const eligible = isEligible(ch);
                    const checked = selectedExportChapterIds.has(ch.id);
                    return (
                      <label
                        key={ch.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          cursor: eligible ? 'pointer' : 'default',
                          borderRadius: '4px',
                          opacity: eligible ? 1 : 0.6,
                        }}
                        onMouseEnter={(e) => eligible && (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExportChapter(ch.id)}
                          disabled={!eligible}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={{ flex: 1 }}>
                          Chapter {ch.order}: {ch.title}
                        </span>
                        {!eligible && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {extractTextFromContent(ch.content).trim().length === 0 ? 'Empty' : 'In queue'}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="audio-chapter-title">{chapter!.title}</div>
                <div className="audio-chapter-stats">
                  <span>{wordCount.toLocaleString()} words</span>
                  <span className="audio-stats-divider">•</span>
                  <span>{estimatedTime}</span>
                </div>
              </>
            )}
          </div>

          {/* Voice Selection */}
          <div className="audio-export-section">
            <label className="audio-export-label">Voice</label>
            <div className="voice-options">
              {VOICE_OPTIONS.map((voice) => (
                <label
                  key={voice.value}
                  className={`voice-option ${selectedVoice === voice.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="voice"
                    value={voice.value}
                    checked={selectedVoice === voice.value}
                    onChange={() => handleVoiceChange(voice.value)}
                  />
                  <div className="voice-option-content">
                    <span className="voice-name">{voice.label}</span>
                    <span className="voice-description">{voice.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Create new folder (Book Title + timestamp) */}
          <div className="audio-export-section">
            <label
              className={`google-drive-option ${createNewFolder ? 'enabled' : ''}`}
              title="Save all audio files into a new folder named after the book and export time"
            >
              <div className={`google-drive-checkbox ${createNewFolder ? 'checked' : ''}`}>
                {createNewFolder && <CheckIcon />}
              </div>
              <input
                type="checkbox"
                checked={createNewFolder}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCreateNewFolder(checked);
                  saveAudioSettings({ createNewFolder: checked });
                }}
                style={{ display: 'none' }}
              />
              <FolderIcon />
              <span className="google-drive-label">
                Create new folder (Book Title + timestamp) for this export
              </span>
            </label>
            {createNewFolder && (
              <p className="audio-folder-hint" style={{ marginTop: '6px', marginBottom: 0 }}>
                {uploadToGoogleDrive && isGoogleAuthenticated
                  ? 'A new folder (Book Title + timestamp) will be created inside your selected Google Drive folder; all audio will be saved there.'
                  : 'When you save locally, you’ll choose a location and a folder will be created. All audio from this export will go into that folder.'}
              </p>
            )}
          </div>

          {/* Google Drive Option */}
          <div className="audio-export-section">
            <label 
              className={`google-drive-option ${!isGoogleAuthenticated ? 'disabled' : ''} ${uploadToGoogleDrive && isGoogleAuthenticated ? 'enabled' : ''}`}
              title={!isGoogleAuthenticated ? 'Sign in with Google first via Google Docs import/export' : 'Automatically upload to Google Drive'}
            >
              <div className={`google-drive-checkbox ${uploadToGoogleDrive && isGoogleAuthenticated ? 'checked' : ''}`}>
                {uploadToGoogleDrive && isGoogleAuthenticated && <CheckIcon />}
              </div>
              <input
                type="checkbox"
                checked={uploadToGoogleDrive && isGoogleAuthenticated}
                onChange={(e) => handleGoogleDriveToggle(e.target.checked)}
                disabled={!isGoogleAuthenticated}
                style={{ display: 'none' }}
              />
              <GoogleDriveIcon />
              <span className="google-drive-label">
                Save to Google Drive
                {!isGoogleAuthenticated && (
                  <span className="google-drive-hint"> (sign in required)</span>
                )}
              </span>
            </label>
          </div>

          {/* Folder Browser (shown when Google Drive is enabled) */}
          {uploadToGoogleDrive && isGoogleAuthenticated && (
            <div className="audio-export-section audio-folder-browser">
              <label className="audio-export-label">Save Location</label>
              
              {/* Breadcrumb */}
              <div className="audio-folder-breadcrumb">
                {folderPath.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 && <span className="breadcrumb-separator">/</span>}
                    <button
                      onClick={() => handleNavigateToPath(index)}
                      className={`breadcrumb-item ${index === folderPath.length - 1 ? 'current' : ''}`}
                    >
                      {item.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Folder list */}
              <div className="audio-folder-list">
                {folderPath.length > 1 && (
                  <div className="audio-folder-item audio-folder-up" onClick={handleNavigateUp}>
                    <BackIcon />
                    <span>Go up</span>
                  </div>
                )}

                {isLoadingFolders ? (
                  <div className="audio-folder-loading">
                    <LoadingSpinner />
                    <span>Loading folders...</span>
                  </div>
                ) : folders.length === 0 ? (
                  <div className="audio-folder-empty">
                    No folders here. Audio will be saved in current location.
                  </div>
                ) : (
                  folders.map(folder => (
                    <div
                      key={folder.id}
                      className="audio-folder-item"
                      onDoubleClick={() => handleNavigateIntoFolder(folder)}
                    >
                      <span className="folder-icon"><FolderIcon /></span>
                      <span className="folder-name">{folder.name}</span>
                    </div>
                  ))
                )}
              </div>
              <p className="audio-folder-hint">
                Double-click a folder to open it. Audio will be saved in the current location.
              </p>
            </div>
          )}

          {/* Queue Status */}
          {audioQueue.length > 0 && (
            <div className="audio-queue-status">
              <QueueStatusIcon />
              <span>
                {audioQueue.filter(i => i.status === 'processing').length > 0 
                  ? `Processing audio (${audioQueue.filter(i => i.status === 'queued').length} waiting)`
                  : `${audioQueue.filter(i => i.status === 'queued').length} items in queue`
                }
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="audio-export-error">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="audio-export-actions">
          <button
            className="btn-cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="btn-export"
            onClick={handleGenerate}
            disabled={exportAll ? chaptersToExport.length === 0 : !chapterText.trim() || isInQueue}
          >
            <PlayIcon />
            {exportAll
              ? (chaptersToExport.length === 0 ? 'Nothing to add' : `Add all ${chaptersToExport.length} to Queue`)
              : isInQueue
                ? 'Already in Queue'
                : 'Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Queue status icon
const QueueStatusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
