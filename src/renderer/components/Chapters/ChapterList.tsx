import React, { useState } from 'react';
import { useChaptersStore } from '../../stores/chaptersStore';
import { useEditorStore } from '../../stores/editorStore';
import './Chapters.css';

const ChapterList: React.FC = () => {
  const {
    chapters,
    currentChapterId,
    setCurrentChapter,
    deleteChapter,
    reorderChapters,
  } = useChaptersStore();
  const { syncWithChapter } = useEditorStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleChapterClick = (id: string) => {
    if (id === currentChapterId) return; // Already selected
    
    // Save current chapter content before switching
    const currentChapter = useChaptersStore.getState().getCurrentChapter();
    if (currentChapter) {
      const { content, htmlContent } = useEditorStore.getState();
      // Directly update the chapter without triggering editor updates
      useChaptersStore.getState().updateChapter(currentChapter.id, {
        content,
        htmlContent,
      });
    }
    
    // Get the new chapter before switching
    const chapters = useChaptersStore.getState().chapters;
    const newChapter = chapters.find(c => c.id === id);
    
    // Set loading flag to prevent auto-save
    useEditorStore.getState().setLoadingChapter(true);
    
    // Switch to new chapter
    setCurrentChapter(id);
    
    // Load new chapter content
    if (newChapter) {
      useEditorStore.getState().setContent(newChapter.content || '');
      useEditorStore.getState().setHtmlContent(newChapter.htmlContent || '');
    } else {
      useEditorStore.getState().setContent('');
      useEditorStore.getState().setHtmlContent('');
    }
    
    // Clear loading flag after a brief moment
    setTimeout(() => {
      useEditorStore.getState().setLoadingChapter(false);
    }, 100);
  };

  const handleCreateChapter = () => {
    const newChapter = useChaptersStore.getState().addChapter({
      title: `Chapter ${chapters.length + 1}`,
      content: '',
      htmlContent: '',
      order: chapters.length,
    });
    setCurrentChapter(newChapter.id);
    syncWithChapter();
  };

  const handleDeleteChapter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chapter?')) {
      deleteChapter(id);
      syncWithChapter();
    }
  };

  const handleEditStart = (chapter: { id: string; title: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chapter.id);
    setEditTitle(chapter.title);
  };

  const handleEditSave = (id: string) => {
    if (editTitle.trim()) {
      useChaptersStore.getState().updateChapter(id, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div className="chapter-list">
      <div className="chapter-list-header">
        <h3>Chapters</h3>
        <button onClick={handleCreateChapter} className="add-chapter-button" title="Add Chapter">
          +
        </button>
      </div>
      <div className="chapter-items">
        {chapters.length === 0 ? (
          <div className="empty-chapters">
            <p>No chapters yet</p>
            <button onClick={handleCreateChapter} className="create-first-chapter">
              Create First Chapter
            </button>
          </div>
        ) : (
          chapters
            .sort((a, b) => a.order - b.order)
            .map((chapter) => (
              <div
                key={chapter.id}
                className={`chapter-item ${currentChapterId === chapter.id ? 'active' : ''}`}
                onClick={() => handleChapterClick(chapter.id)}
              >
                {editingId === chapter.id ? (
                  <div className="chapter-edit" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleEditSave(chapter.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEditSave(chapter.id);
                        } else if (e.key === 'Escape') {
                          handleEditCancel();
                        }
                      }}
                      autoFocus
                      className="chapter-title-input"
                    />
                  </div>
                ) : (
                  <>
                    <div className="chapter-title">{chapter.title}</div>
                    <div className="chapter-actions">
                      <button
                        onClick={(e) => handleEditStart(chapter, e)}
                        className="edit-button"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => handleDeleteChapter(chapter.id, e)}
                        className="delete-button"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ChapterList;

