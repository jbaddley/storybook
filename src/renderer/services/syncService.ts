import { googleAuthService } from './googleAuthService';
import { googleDocsService } from './googleDocsService';
import { useBookStore } from '../stores/bookStore';
import { Chapter, generateId, TipTapContent } from '../../shared/types';

class SyncService {
  private isSyncing = false;

  async pull(
    documentId: string,
    documentName: string
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

    this.isSyncing = true;
    const { setSyncStatus, importFromGoogleDocs } = useBookStore.getState();

    try {
      setSyncStatus({
        isSyncing: true,
        direction: 'pull',
        progress: 'Connecting to Google Docs...',
        error: null,
        success: null,
      });

      // Refresh token if needed
      if (!googleAuthService.isAuthenticated()) {
        setSyncStatus({ progress: 'Refreshing authentication...' });
        await googleAuthService.refreshAccessToken();
      }

      setSyncStatus({ progress: 'Downloading document...' });
      
      const fileInfo = {
        id: documentId,
        name: documentName,
        mimeType: 'application/vnd.google-apps.document',
        modifiedTime: '',
        createdTime: '',
      };
      
      const importResult = await googleDocsService.importDocument(fileInfo);

      setSyncStatus({ progress: 'Updating Storybook...' });
      
      // Convert ImportedChapter to Chapter
      const now = new Date().toISOString();
      const convertedChapters: Chapter[] = importResult.chapters.map((ch, index) => ({
        id: generateId(),
        title: ch.title,
        content: ch.content,
        order: index,
        wordCount: 0,
        comments: [],
        notes: [],
        createdAt: now,
        updatedAt: now,
      }));

      importFromGoogleDocs(convertedChapters, {
        documentId,
        documentName,
      });

      // Autosave will automatically save to .sbk file when changes are detected
      console.log('[Sync] Pulled from Google Docs - autosave will save to .sbk');

      setSyncStatus({
        isSyncing: false,
        progress: '',
        success: `Pulled ${convertedChapters.length} chapters from Google Docs`,
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        const currentStatus = useBookStore.getState().ui.syncStatus;
        if (currentStatus.success && !currentStatus.isSyncing) {
          useBookStore.getState().clearSyncStatus();
        }
      }, 5000);

    } catch (err) {
      console.error('[Sync] Pull failed:', err);
      setSyncStatus({
        isSyncing: false,
        progress: '',
        error: err instanceof Error ? err.message : 'Pull failed',
      });

      // Clear error after 10 seconds
      setTimeout(() => {
        const currentStatus = useBookStore.getState().ui.syncStatus;
        if (currentStatus.error && !currentStatus.isSyncing) {
          useBookStore.getState().clearSyncStatus();
        }
      }, 10000);
    } finally {
      this.isSyncing = false;
    }
  }

  async push(
    documentId: string,
    documentName: string,
    title: string,
    chapters: Array<{ title: string; content: TipTapContent }>,
    references: { characters?: string; locations?: string; timeline?: string; summaries?: string },
    fontSettings: { titleFont: string; titleFontSize: number; bodyFont: string; bodyFontSize: number },
    folderId?: string
  ): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Already syncing, skipping');
      return;
    }

    this.isSyncing = true;
    const { setSyncStatus, setGoogleDocsExport } = useBookStore.getState();

    try {
      setSyncStatus({
        isSyncing: true,
        direction: 'push',
        progress: 'Connecting to Google Docs...',
        error: null,
        success: null,
      });

      // Refresh token if needed
      if (!googleAuthService.isAuthenticated()) {
        setSyncStatus({ progress: 'Refreshing authentication...' });
        await googleAuthService.refreshAccessToken();
      }

      await googleDocsService.syncToGoogleDoc(
        documentId,
        title,
        chapters,
        references,
        (progress) => setSyncStatus({ progress }),
        fontSettings
      );

      // Update export info
      setGoogleDocsExport({
        documentId,
        documentName,
        webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
        folderId,
      });

      // Autosave will automatically save to .sbk file when changes are detected
      console.log('[Sync] Pushed to Google Docs - autosave will save to .sbk');

      setSyncStatus({
        isSyncing: false,
        progress: '',
        success: `Pushed ${chapters.length} chapters to Google Docs`,
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        const currentStatus = useBookStore.getState().ui.syncStatus;
        if (currentStatus.success && !currentStatus.isSyncing) {
          useBookStore.getState().clearSyncStatus();
        }
      }, 5000);

    } catch (err) {
      console.error('[Sync] Push failed:', err);
      setSyncStatus({
        isSyncing: false,
        progress: '',
        error: err instanceof Error ? err.message : 'Push failed',
      });

      // Clear error after 10 seconds
      setTimeout(() => {
        const currentStatus = useBookStore.getState().ui.syncStatus;
        if (currentStatus.error && !currentStatus.isSyncing) {
          useBookStore.getState().clearSyncStatus();
        }
      }, 10000);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();

