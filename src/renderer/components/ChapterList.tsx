import React, { useState } from 'react';
import { useBookStore } from '../stores/bookStore';
import { DocumentTabs } from './DocumentTabs';

// Icons
const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chapter-item-icon">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10,9 9,9 8,9"/>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const ListOrderedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="10" y1="6" x2="21" y2="6"/>
    <line x1="10" y1="12" x2="21" y2="12"/>
    <line x1="10" y1="18" x2="21" y2="18"/>
    <path d="M4 6h1v4"/>
    <path d="M4 10h2"/>
    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
  </svg>
);

export const ChapterList: React.FC = () => {
  const { 
    book, 
    activeChapterId, 
    ui,
    setActiveChapter, 
    setActiveDocumentTab,
    addChapter, 
    deleteChapter,
    updateChapter,
    renumberChapters,
    getSortedChapters
  } = useBookStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const chapters = getSortedChapters();

  const handleStartEdit = (chapter: { id: string; title: string }) => {
    setEditingId(chapter.id);
    setEditTitle(chapter.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateChapter(editingId, { title: editTitle.trim() });
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditTitle('');
    }
  };

  const handleDelete = (chapterId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chapters.length > 1) {
      if (confirm('Are you sure you want to delete this chapter?')) {
        deleteChapter(chapterId);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const { reorderChapters } = useBookStore.getState();
      reorderChapters(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const formatWordCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <>
      <div className="panel-header">
        <span>Chapters</span>
        <span className="text-muted" style={{ fontSize: '11px' }}>
          {chapters.length} chapters
        </span>
      </div>
      <div className="panel-content">
        <ul className="chapter-list">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              className={`chapter-item ${chapter.id === activeChapterId && !ui.activeDocumentTabId ? 'active' : ''}`}
              onClick={() => {
                setActiveDocumentTab(null); // Clear document tab selection
                setActiveChapter(chapter.id);
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                opacity: draggedIndex === index ? 0.5 : 1,
              }}
            >
              <DocumentIcon />
              
              {editingId === chapter.id ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '14px',
                  }}
                />
              ) : (
                <>
                  <span className="chapter-item-title">{chapter.title}</span>
                  <span className="chapter-item-words">
                    {formatWordCount(chapter.wordCount)}
                  </span>
                  <div 
                    className="chapter-item-actions"
                    style={{ 
                      display: 'flex', 
                      gap: '4px', 
                      marginLeft: '8px',
                      opacity: chapter.id === activeChapterId ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <button
                      className="toolbar-btn"
                      style={{ width: '24px', height: '24px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(chapter);
                      }}
                      title="Rename"
                    >
                      <EditIcon />
                    </button>
                    {chapters.length > 1 && (
                      <button
                        className="toolbar-btn"
                        style={{ width: '24px', height: '24px', color: 'var(--accent-error)' }}
                        onClick={(e) => handleDelete(chapter.id, e)}
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="chapter-add-btn" onClick={addChapter} style={{ flex: 1 }}>
            <PlusIcon />
            <span>Add Chapter</span>
          </button>
          <button 
            className="chapter-add-btn" 
            onClick={renumberChapters}
            title="Renumber all chapters sequentially (Chapter 1, Chapter 2, etc.)"
            style={{ flex: 0, padding: '10px 12px' }}
          >
            <ListOrderedIcon />
          </button>
        </div>

        {/* Document Tabs (Characters, Locations, Timeline, Custom) */}
        <DocumentTabs />

        {/* Book info */}
        <div style={{ marginTop: '24px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Book Stats
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span className="text-secondary">Total Words</span>
            <span>{chapters.reduce((sum, c) => sum + c.wordCount, 0).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span className="text-secondary">Chapters</span>
            <span>{chapters.length}</span>
          </div>
        </div>
      </div>
    </>
  );
};

