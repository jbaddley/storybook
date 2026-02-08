import React, { useState, useMemo } from 'react';
import { useBookStore } from '../stores/bookStore';
import { ChapterNote, generateId } from '../../shared/types';

// Icons
const NoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const CancelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface NotesPanelProps {
  onClose?: () => void;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ onClose }) => {
  const { 
    book, 
    activeChapterId,
    addNote,
    updateNote,
    deleteNote,
  } = useBookStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  const activeChapter = useMemo(() => {
    return book.chapters.find(c => c.id === activeChapterId);
  }, [book.chapters, activeChapterId]);

  const notes = useMemo(() => {
    if (!activeChapter) return [];
    return (activeChapter.notes || []).sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    );
  }, [activeChapter]);

  const handleStartEdit = (note: ChapterNote) => {
    setEditingId(note.id);
    setEditingText(note.text);
  };

  const handleSaveEdit = () => {
    if (editingId && activeChapterId && editingText.trim()) {
      updateNote(activeChapterId, editingId, { text: editingText.trim() });
      setEditingId(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewNoteText('');
  };

  const handleSaveAdd = () => {
    if (activeChapterId && newNoteText.trim()) {
      const newNote: ChapterNote = {
        id: generateId(),
        text: newNoteText.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addNote(activeChapterId, newNote);
      setIsAdding(false);
      setNewNoteText('');
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewNoteText('');
  };

  const handleDelete = (noteId: string) => {
    if (activeChapterId && confirm('Delete this note? This cannot be undone.')) {
      deleteNote(activeChapterId, noteId);
    }
  };

  if (!activeChapter) {
    return (
      <div className="notes-panel">
        <div className="notes-panel-header">
          <h3><NoteIcon /> Notes</h3>
        </div>
        <div className="notes-empty">
          <p>Select a chapter to view notes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-panel">
      <div className="notes-panel-header">
        <h3><NoteIcon /> Notes</h3>
        <span className="note-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add Note Button */}
      <div className="notes-actions">
        {!isAdding ? (
          <button 
            className="btn-add-note"
            onClick={handleStartAdd}
          >
            <PlusIcon /> Add Note
          </button>
        ) : (
          <div className="note-edit-form">
            <textarea
              className="note-textarea"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Enter your note..."
              rows={3}
              autoFocus
            />
            <div className="note-edit-actions">
              <button 
                className="btn-save"
                onClick={handleSaveAdd}
                disabled={!newNoteText.trim()}
              >
                <SaveIcon /> Save
              </button>
              <button 
                className="btn-cancel"
                onClick={handleCancelAdd}
              >
                <CancelIcon /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="notes-list">
        {notes.length === 0 && !isAdding ? (
          <div className="notes-empty">
            <p>No notes yet</p>
            <small>Click "Add Note" to create your first note about this chapter</small>
          </div>
        ) : (
          notes.map((note) => {
            const isEditing = editingId === note.id;
            const createdAt = new Date(note.createdAt);
            const updatedAt = new Date(note.updatedAt || note.createdAt);
            const wasEdited = updatedAt.getTime() > createdAt.getTime() + 1000; // 1 second threshold

            return (
              <div key={note.id} className="note-item">
                {isEditing ? (
                  <div className="note-edit-form">
                    <textarea
                      className="note-textarea"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      placeholder="Enter your note..."
                      rows={3}
                      autoFocus
                    />
                    <div className="note-edit-actions">
                      <button 
                        className="btn-save"
                        onClick={handleSaveEdit}
                        disabled={!editingText.trim()}
                      >
                        <SaveIcon /> Save
                      </button>
                      <button 
                        className="btn-cancel"
                        onClick={handleCancelEdit}
                      >
                        <CancelIcon /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="note-content">
                      <p className="note-text">{note.text}</p>
                      <div className="note-meta">
                        <span className="note-date">
                          {wasEdited 
                            ? `Updated ${updatedAt.toLocaleDateString()} ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : `Created ${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          }
                        </span>
                      </div>
                    </div>
                    <div className="note-actions">
                      <button 
                        className="note-action edit"
                        onClick={() => handleStartEdit(note)}
                        title="Edit note"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="note-action delete"
                        onClick={() => handleDelete(note.id)}
                        title="Delete note"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
