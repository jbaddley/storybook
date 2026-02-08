import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { DocumentTab, DEFAULT_TIPTAP_CONTENT } from '../../shared/types';

// Icons
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
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

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

interface DocumentTabsProps {
  onTabSelect?: (tabId: string) => void;
}

export const DocumentTabs: React.FC<DocumentTabsProps> = ({ onTabSelect }) => {
  const { 
    book, 
    ui,
    setActiveDocumentTab,
    addDocumentTab,
    deleteDocumentTab,
    updateDocumentTab,
    setActiveChapter,
    updateBookMetadata,
  } = useBookStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabTitle, setNewTabTitle] = useState('');

  // Define all permanent tabs - these ALWAYS exist regardless of saved state
  const permanentTabDefs: Array<{ id: string; title: string; icon: string; tabType: DocumentTab['tabType'] }> = [
    { id: 'characters-tab', title: 'Characters', icon: '👤', tabType: 'characters' },
    { id: 'locations-tab', title: 'Locations', icon: '📍', tabType: 'locations' },
    { id: 'timeline-tab', title: 'Timeline', icon: '📅', tabType: 'timeline' },
    { id: 'storycraft-tab', title: 'Story Craft', icon: '🎭', tabType: 'storycraft' },
    { id: 'themes-tab', title: 'Themes & Motifs', icon: '🎨', tabType: 'themes' },
    { id: 'plotanalysis-tab', title: 'Plot Analysis', icon: '🔍', tabType: 'plotanalysis' },
  ];
  
  const now = new Date().toISOString();
  
  // Create permanent tabs from definitions (always show all 6)
  const permanentTabs: DocumentTab[] = permanentTabDefs.map(pt => {
    // Check if we have saved content for this tab type
    const existingTab = (book.documentTabs || []).find(t => t.tabType === pt.tabType);
    return {
      id: existingTab?.id || pt.id,
      title: pt.title,
      icon: pt.icon,
      tabType: pt.tabType,
      content: existingTab?.content || DEFAULT_TIPTAP_CONTENT,
      isPermanent: true,
      createdAt: existingTab?.createdAt || now,
      updatedAt: existingTab?.updatedAt || now,
    };
  });
  
  // Get custom tabs from saved state
  const customTabs = (book.documentTabs || []).filter(t => !t.isPermanent);
  
  // Combined for total count
  const documentTabs = [...permanentTabs, ...customTabs];
  
  // Debug: log what we're rendering
  console.log('[DocumentTabs] permanentTabs:', permanentTabs.length, permanentTabs.map(t => t.title));
  console.log('[DocumentTabs] customTabs:', customTabs.length, customTabs.map(t => t.title));
  console.log('[DocumentTabs] total:', documentTabs.length);

  const handleTabClick = (tab: DocumentTab) => {
    setActiveDocumentTab(tab.id);
    onTabSelect?.(tab.id);
  };

  const handleStartEdit = (tab: DocumentTab) => {
    if (tab.isPermanent) return; // Can't rename permanent tabs
    setEditingId(tab.id);
    setEditTitle(tab.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      updateDocumentTab(editingId, { title: editTitle.trim() });
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

  const handleDelete = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document tab?')) {
      deleteDocumentTab(tabId);
    }
  };

  const handleAddTab = () => {
    if (newTabTitle.trim()) {
      addDocumentTab(newTabTitle.trim());
      setNewTabTitle('');
      setIsAddingTab(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTab();
    } else if (e.key === 'Escape') {
      setIsAddingTab(false);
      setNewTabTitle('');
    }
  };

  const getItemCount = (tab: DocumentTab): string => {
    switch (tab.tabType) {
      case 'characters':
        return `${book.extracted.characters?.length || 0}`;
      case 'locations':
        return `${book.extracted.locations?.length || 0}`;
      case 'timeline':
        return `${book.extracted.timeline?.length || 0}`;
      case 'storycraft':
        return `${book.extracted.storyCraftFeedback?.length || 0}`;
      case 'themes':
        const themes = book.extracted.themesAndMotifs;
        if (!themes) return '0';
        return `${(themes.themes?.length || 0) + (themes.motifs?.length || 0) + (themes.symbols?.length || 0)}`;
      default:
        return '';
    }
  };

  const renderTab = (tab: DocumentTab, index: number) => {
    const isActive = ui.activeDocumentTabId === tab.id;
    const itemCount = getItemCount(tab);

    return (
      <li
        key={tab.id}
        className={`chapter-item ${isActive ? 'active' : ''}`}
        onClick={() => handleTabClick(tab)}
        style={{
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '16px', marginRight: '8px' }}>
          {tab.icon || <DocumentIcon />}
        </span>
        
        {editingId === tab.id ? (
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
            <span className="chapter-item-title">{tab.title}</span>
            {itemCount && (
              <span className="chapter-item-words" style={{ marginLeft: '8px' }}>
                {itemCount}
              </span>
            )}
            {!tab.isPermanent && (
              <div 
                className="chapter-item-actions"
                style={{ 
                  display: 'flex', 
                  gap: '4px', 
                  marginLeft: '8px',
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <button
                  className="toolbar-btn"
                  style={{ width: '24px', height: '24px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(tab);
                  }}
                  title="Rename"
                >
                  <EditIcon />
                </button>
                <button
                  className="toolbar-btn"
                  style={{ width: '24px', height: '24px', color: 'var(--accent-error)' }}
                  onClick={(e) => handleDelete(tab.id, e)}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </>
        )}
      </li>
    );
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Reference Documents Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        padding: '0 4px',
      }}>
        <span style={{ 
          fontSize: '11px', 
          fontWeight: 600, 
          color: 'var(--text-muted)', 
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Reference Documents
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {documentTabs.length} tabs
        </span>
      </div>

      {/* Permanent Tabs */}
      <ul className="chapter-list" style={{ marginBottom: '8px' }}>
        {permanentTabs.map((tab, index) => renderTab(tab, index))}
      </ul>

      {/* Divider if there are custom tabs */}
      {customTabs.length > 0 && (
        <div style={{ 
          height: '1px', 
          background: 'var(--border-color)', 
          margin: '8px 0',
        }} />
      )}

      {/* Custom Tabs */}
      {customTabs.length > 0 && (
        <ul className="chapter-list" style={{ marginBottom: '8px' }}>
          {customTabs.map((tab, index) => renderTab(tab, index))}
        </ul>
      )}

      {/* Add New Tab */}
      {isAddingTab ? (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          padding: '4px',
        }}>
          <input
            type="text"
            value={newTabTitle}
            onChange={(e) => setNewTabTitle(e.target.value)}
            onKeyDown={handleAddKeyDown}
            onBlur={() => {
              if (!newTabTitle.trim()) {
                setIsAddingTab(false);
              }
            }}
            placeholder="Tab name..."
            autoFocus
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleAddTab}
            style={{ padding: '8px 12px' }}
          >
            Add
          </button>
        </div>
      ) : (
        <button 
          className="chapter-add-btn" 
          onClick={() => setIsAddingTab(true)}
          style={{ marginTop: '4px' }}
        >
          <PlusIcon />
          <span>Add Document Tab</span>
        </button>
      )}
    </div>
  );
};

