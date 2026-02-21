import React, { useCallback, useEffect, useState } from 'react';
import { useBookStore } from '../stores/bookStore';
import { databaseService } from '../services/databaseService';
import { fileService } from '../services/fileService';
import type { DbBookSummary } from '../services/databaseService';

const CLOUD_BOOK_PATHS_KEY = 'cloud-book-paths';

export interface OpenFromCloudDialogProps {
  open: boolean;
  onClose: () => void;
}

export const OpenFromCloudDialog: React.FC<OpenFromCloudDialogProps> = ({ open, onClose }) => {
  const { ui, setBook, setCurrentFilePath, setDirty } = useBookStore();
  const [books, setBooks] = useState<DbBookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = ui.currentUserId;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (!userId) {
      setBooks([]);
      return;
    }
    setLoading(true);
    databaseService
      .getBooksByUser(userId)
      .then(setBooks)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load books');
        setBooks([]);
      })
      .finally(() => setLoading(false));
  }, [open, userId]);

  const handleSelectBook = useCallback(
    async (bookId: string) => {
      if (!userId || !window.electronAPI) return;
      setOpening(true);
      setError(null);
      try {
        const book = await databaseService.loadBookFromDatabase(bookId);
        if (!book) {
          setError('Book not found');
          return;
        }
        const pathsRaw = await window.electronAPI.storeGet(CLOUD_BOOK_PATHS_KEY);
        const paths: Record<string, string> =
          pathsRaw && typeof pathsRaw === 'object' && !Array.isArray(pathsRaw)
            ? (pathsRaw as Record<string, string>)
            : {};
        const existingPath = paths[bookId];
        const data = await fileService.saveBook(book);
        let filePath: string | null = null;
        if (existingPath) {
          filePath = await window.electronAPI.saveFile(data, existingPath);
        }
        if (!filePath) {
          filePath = await window.electronAPI.saveFileAs(data);
          if (filePath) {
            await window.electronAPI.storeSet(CLOUD_BOOK_PATHS_KEY, {
              ...paths,
              [bookId]: filePath,
            });
          }
        }
        if (filePath) {
          setBook(book);
          setCurrentFilePath(filePath);
          setDirty(false);
          onClose();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open book');
      } finally {
        setOpening(false);
      }
    },
    [userId, setBook, setCurrentFilePath, setDirty, onClose]
  );

  if (!open) return null;

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog open-from-cloud-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Open from cloud</h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dialog-content">
        {!userId ? (
          <p className="open-from-cloud-message">
            Sign in with Google first to open books from the cloud (use the profile button or
            Google Docs sync to sign in).
          </p>
        ) : loading ? (
          <p>Loading books…</p>
        ) : error ? (
          <p className="open-from-cloud-error">{error}</p>
        ) : books.length === 0 ? (
          <p className="open-from-cloud-message">No books in the cloud yet.</p>
        ) : (
          <ul className="open-from-cloud-list">
            {books.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => handleSelectBook(b.id)}
                  disabled={opening}
                  className="open-from-cloud-item"
                >
                  <span className="open-from-cloud-title">{b.title}</span>
                  {b.author && (
                    <span className="open-from-cloud-meta"> — {b.author}</span>
                  )}
                  <span className="open-from-cloud-meta">
                    {' '}
                    · {b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
        <div className="dialog-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
