/**
 * Audio Queue Service
 * Manages a queue of audio export requests, processing up to CONCURRENT_LIMIT in parallel
 */

import { openAIService } from './openaiService';
import { googleDocsService } from './googleDocsService';
import { useBookStore } from '../stores/bookStore';
import { saveAudioToFile, ensureGoogleDriveExportFolder, loadAudioSettings } from '../components/AudioExportDialog';
import { TTSVoice } from '../../shared/types';

const CONCURRENT_LIMIT = 5;
/** Max completed/errored items to keep in queue (avoids unbounded growth of chapterText in memory) */
const MAX_QUEUE_ITEMS = 50;
/** Max in-memory audio buffers to keep for "Save" action (each can be several MB) */
const MAX_PENDING_AUDIO_BUFFERS = 5;

export interface AudioQueueItem {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterText: string;
  /** 1-based chapter number for exported filename (e.g. "Chapter 3 - Title.mp3") */
  chapterNumber?: number;
  /** Book ID when item was queued; used when persisting export path so it stays correct if user switches books */
  bookId?: string;
  /** When set, save MP3 directly to this folder when ready (no "Click to save" toast). */
  saveDirectory?: string;
  voice: TTSVoice;
  uploadToGoogleDrive: boolean;
  googleDriveFolderId?: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
  addedAt: string;
  startedAt?: string;
  completedAt?: string;
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(
    new Uint8Array(buffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    )
  );
}

// Helper to generate safe filename: "Chapter N - title.mp3" when chapterNumber provided
function generateSafeFilename(title: string, chapterNumber?: number): string {
  const base = chapterNumber != null
    ? `Chapter ${chapterNumber} - ${title}`
    : title;
  return base
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80) + '.mp3';
}

class AudioQueueService {
  private queue: AudioQueueItem[] = [];
  private listeners: Set<(queue: AudioQueueItem[]) => void> = new Set();
  private pendingAudioBuffers = new Map<string, ArrayBuffer>();

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: AudioQueueItem[]) => void): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener([...this.queue]);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners() {
    const queueCopy = [...this.queue];
    this.listeners.forEach(listener => listener(queueCopy));
  }

  /**
   * Get current queue
   */
  getQueue(): AudioQueueItem[] {
    return [...this.queue];
  }

  /**
   * Get queue position for a chapter (1-based, 0 if not in queue)
   */
  getQueuePosition(chapterId: string): number {
    const index = this.queue.findIndex(item => item.chapterId === chapterId);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Check if a chapter is currently in the queue (queued or processing).
   * Completed or errored items do not count — you can create a new export anytime after one finishes.
   */
  isInQueue(chapterId: string): boolean {
    return this.queue.some(
      item => item.chapterId === chapterId && (item.status === 'queued' || item.status === 'processing')
    );
  }

  /**
   * Add item to the queue
   */
  addToQueue(item: Omit<AudioQueueItem, 'id' | 'status' | 'progress' | 'addedAt'>): string {
    const id = `audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: AudioQueueItem = {
      ...item,
      id,
      status: 'queued',
      progress: 0,
      addedAt: new Date().toISOString(),
    };

    this.queue.push(queueItem);
    // Trim old completed/errored items to cap memory (each holds full chapterText)
    this.trimQueueIfNeeded();
    this.notifyListeners();

    // Also add to background tasks for the indicator
    const { addBackgroundTask } = useBookStore.getState();
    addBackgroundTask({
      type: 'audio-export',
      status: 'pending',
      progress: 0,
      title: `Audio: ${item.chapterTitle}`,
      chapterId: item.chapterId,
      voice: item.voice,
    });

    this.startNextBatch();
    return id;
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index >= 0 && this.queue[index].status === 'queued') {
      const removed = this.queue.splice(index, 1)[0];
      
      // Remove from background tasks too
      const { removeBackgroundTask, backgroundTasks } = useBookStore.getState();
      const bgTask = backgroundTasks.find(t => t.chapterId === removed.chapterId && t.type === 'audio-export');
      if (bgTask) {
        removeBackgroundTask(bgTask.id);
      }
      
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Clear completed/errored items from queue and release their audio buffers from memory
   */
  clearCompleted(): void {
    this.queue
      .filter(item => item.status === 'complete' || item.status === 'error')
      .forEach(item => this.pendingAudioBuffers.delete(item.id));
    this.queue = this.queue.filter(item => 
      item.status === 'queued' || item.status === 'processing'
    );
    this.notifyListeners();
  }

  /**
   * Keep queue length bounded by removing oldest completed/errored items.
   */
  private trimQueueIfNeeded(): void {
    const completedOrError = this.queue.filter(
      item => item.status === 'complete' || item.status === 'error'
    );
    if (completedOrError.length <= MAX_QUEUE_ITEMS) return;
    const toRemove = completedOrError.length - MAX_QUEUE_ITEMS;
    const idsToRemove = new Set(
      completedOrError
        .slice(0, toRemove)
        .map(item => item.id)
    );
    idsToRemove.forEach(id => this.pendingAudioBuffers.delete(id));
    this.queue = this.queue.filter(item => !idsToRemove.has(item.id));
  }

  /**
   * Start up to CONCURRENT_LIMIT workers; called when items are added or when one finishes.
   */
  private startNextBatch(): void {
    const processing = this.queue.filter(item => item.status === 'processing').length;
    const toStart = Math.min(CONCURRENT_LIMIT - processing, this.queue.filter(item => item.status === 'queued').length);
    for (let i = 0; i < toStart; i++) {
      const nextItem = this.queue.find(item => item.status === 'queued');
      if (!nextItem) break;
      this.processOne(nextItem);
    }
  }

  /**
   * Process a single queue item (runs in parallel with others).
   */
  private processOne(nextItem: AudioQueueItem): void {
    nextItem.status = 'processing';
    nextItem.startedAt = new Date().toISOString();
    this.notifyListeners();

    const { updateBackgroundTask, removeBackgroundTask, addToast, backgroundTasks } = useBookStore.getState();
    const bgTask = backgroundTasks.find(t => t.chapterId === nextItem.chapterId && t.type === 'audio-export');

    const onDone = () => {
      this.notifyListeners();
      this.startNextBatch();
    };

    (async () => {
      try {
        const audioBuffer = await openAIService.generateSpeech(
          nextItem.chapterText,
          nextItem.voice,
          (progress) => {
            nextItem.progress = progress;
            this.notifyListeners();
            if (bgTask) {
              updateBackgroundTask(bgTask.id, { progress, status: 'processing' });
            }
          }
        );

        const base64Audio = arrayBufferToBase64(audioBuffer);
        const fileName = generateSafeFilename(nextItem.chapterTitle, nextItem.chapterNumber);

        if (nextItem.uploadToGoogleDrive) {
          nextItem.progress = 95;
          this.notifyListeners();
          if (bgTask) updateBackgroundTask(bgTask.id, { progress: 95 });

          try {
            let targetFolderId = nextItem.googleDriveFolderId;
            const settings = loadAudioSettings();
            if (settings.createNewFolder && nextItem.googleDriveFolderId) {
              const exportFolderId = await ensureGoogleDriveExportFolder(nextItem.googleDriveFolderId);
              targetFolderId = exportFolderId ?? nextItem.googleDriveFolderId;
            }
            await googleDocsService.uploadAudioFile(base64Audio, fileName, targetFolderId);
            addToast({
              type: 'success',
              title: `Audio complete: ${nextItem.chapterTitle}`,
              message: 'Saved to Google Drive',
              duration: 5000,
            });
          } catch (uploadErr) {
            console.error('[AudioQueue] Google Drive upload error:', uploadErr);
            addToast({
              type: 'error',
              title: 'Google Drive upload failed',
              message: uploadErr instanceof Error ? uploadErr.message : 'Unknown error',
            });
          }
          if (bgTask) removeBackgroundTask(bgTask.id);
        } else if (nextItem.saveDirectory && typeof window.electronAPI?.writeMp3ToPath === 'function') {
          // Known save folder: write directly and persist path (no toast "Click to save")
          const filePath = await window.electronAPI.writeMp3ToPath(base64Audio, nextItem.saveDirectory, fileName);
          if (filePath) {
            const bookId = nextItem.bookId ?? useBookStore.getState().book?.id;
            if (bookId && typeof window.electronAPI?.storeSet === 'function') {
              await window.electronAPI.storeSet(`audio-export-path:${bookId}:${nextItem.chapterId}`, filePath);
              window.dispatchEvent(new CustomEvent('audio-export-saved', { detail: { bookId, chapterId: nextItem.chapterId, filePath } }));
            }
            addToast({
              type: 'success',
              title: `Saved: ${nextItem.chapterTitle}`,
              message: filePath.split(/[/\\]/).pop(),
              duration: 5000,
            });
          }
          if (bgTask) removeBackgroundTask(bgTask.id);
        } else {
          // No save folder: keep buffer and show "Click to save" toast
          while (this.pendingAudioBuffers.size >= MAX_PENDING_AUDIO_BUFFERS) {
            const oldestWithBuffer = this.queue.find(
              item => (item.status === 'complete' || item.status === 'error') && this.pendingAudioBuffers.has(item.id)
            );
            if (oldestWithBuffer) this.pendingAudioBuffers.delete(oldestWithBuffer.id);
            else break;
          }
          this.pendingAudioBuffers.set(nextItem.id, audioBuffer);
          addToast({
            type: 'success',
            title: `Audio ready: ${nextItem.chapterTitle}`,
            message: 'Click to save the MP3 file',
            duration: 10000,
            action: {
              label: 'Save',
              onClick: async () => {
                const buffer = this.pendingAudioBuffers.get(nextItem.id);
                if (buffer) {
                  const b64 = arrayBufferToBase64(buffer);
                  const filePath = await saveAudioToFile(b64, fileName);
                  if (filePath) {
                    const bookId = nextItem.bookId ?? useBookStore.getState().book?.id;
                    if (bookId && typeof window.electronAPI?.storeSet === 'function') {
                      window.electronAPI.storeSet(`audio-export-path:${bookId}:${nextItem.chapterId}`, filePath);
                      window.dispatchEvent(new CustomEvent('audio-export-saved', { detail: { bookId, chapterId: nextItem.chapterId, filePath } }));
                    }
                    addToast({
                      type: 'success',
                      title: 'Audio saved',
                      message: filePath.split(/[/\\]/).pop(),
                    });
                  }
                  this.pendingAudioBuffers.delete(nextItem.id);
                }
              }
            }
          });
          if (bgTask) removeBackgroundTask(bgTask.id);
        }

        nextItem.status = 'complete';
        nextItem.progress = 100;
        nextItem.completedAt = new Date().toISOString();
        this.trimQueueIfNeeded();
      } catch (err) {
        console.error('[AudioQueue] Processing error:', err);
        nextItem.status = 'error';
        nextItem.error = err instanceof Error ? err.message : 'Failed to generate audio';
        if (bgTask) {
          updateBackgroundTask(bgTask.id, { status: 'error', error: nextItem.error });
          setTimeout(() => removeBackgroundTask(bgTask.id), 5000);
        }
        addToast({
          type: 'error',
          title: `Audio failed: ${nextItem.chapterTitle}`,
          message: nextItem.error,
        });
      }
      onDone();
    })();
  }

  /**
   * Get number of items ahead in queue for a given item
   */
  getItemsAhead(id: string): number {
    const index = this.queue.findIndex(item => item.id === id);
    if (index < 0) return 0;
    return this.queue.slice(0, index).filter(item => 
      item.status === 'queued' || item.status === 'processing'
    ).length;
  }
}

// Export singleton instance
export const audioQueueService = new AudioQueueService();
