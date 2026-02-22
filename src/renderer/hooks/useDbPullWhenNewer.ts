/**
 * When the app gains focus or on an interval, check if the database has newer
 * content than the current book. If so, pull from DB and update the app.
 * Only runs when there are no unsaved changes (so we don't overwrite local edits).
 */

import { useEffect, useRef } from 'react';
import { useBookStore } from '../stores/bookStore';
import { dbSyncService } from '../services/dbSyncService';

const CHECK_INTERVAL_MS = 60_000; // 1 minute

export function useDbPullWhenNewer(): void {
  const { book, ui } = useBookStore();
  const lastCheckRef = useRef<number>(0);
  const cooldownMs = 2000; // avoid re-running within 2s of last check

  useEffect(() => {
    if (!book?.id || ui.isDirty) return;
    const userId = dbSyncService.getCurrentUserId();
    if (!userId) return;

    const checkAndPull = async () => {
      // Read latest state at check time (e.g. after returning from web)
      const { book: currentBook, ui: currentUi } = useBookStore.getState();
      if (!currentBook?.id || currentUi.isDirty) return;

      const now = Date.now();
      if (now - lastCheckRef.current < cooldownMs) return;
      lastCheckRef.current = now;

      const isConnected = await dbSyncService.isDatabaseAvailable();
      if (!isConnected) return;

      const comparison = await dbSyncService.compareTimestamps(currentBook);
      if (comparison !== 'db_newer') return;

      const dbBook = await dbSyncService.forceSyncFromDatabase(currentBook.id);
      if (dbBook) {
        useBookStore.getState().addToast({
          type: 'info',
          title: 'Book updated',
          message: 'Loaded latest changes from the database.',
          duration: 5000,
        });
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkAndPull();
      }
    };

    // When user switches back to the app window (e.g. from browser after saving on web)
    const onFocus = () => checkAndPull();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const interval = setInterval(checkAndPull, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [book?.id, ui.isDirty]);
}
