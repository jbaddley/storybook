import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editor: any; // TipTap editor instance
}

// Icons
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export const SearchDialog: React.FC<SearchDialogProps> = ({ isOpen, onClose, editor }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Clear highlights when closing
  useEffect(() => {
    if (!isOpen && editor) {
      clearHighlights();
    }
  }, [isOpen, editor]);

  // Helper to get all text content from editor
  const getDocumentText = useCallback((): string => {
    if (!editor) return '';
    return editor.getText();
  }, [editor]);

  // Find all matches
  const findMatches = useCallback((term: string): { from: number; to: number }[] => {
    if (!editor || !term) return [];
    
    const doc = editor.state.doc;
    const matches: { from: number; to: number }[] = [];
    const searchText = caseSensitive ? term : term.toLowerCase();
    
    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const text = caseSensitive ? node.text : node.text.toLowerCase();
        let index = 0;
        while ((index = text.indexOf(searchText, index)) !== -1) {
          matches.push({
            from: pos + index,
            to: pos + index + term.length,
          });
          index += 1;
        }
      }
    });
    
    return matches;
  }, [editor, caseSensitive]);

  // Scroll to current selection (runs in rAF so DOM is updated)
  const scrollToSelection = useCallback(() => {
    if (!editor) return;
    const { view } = editor;
    const { from } = editor.state.selection;
    const coords = view.coordsAtPos(from);
    const scrollContainer = document.querySelector('.editor-scroll-area') as HTMLElement | null;
    if (!scrollContainer || !coords) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollTop = scrollContainer.scrollTop;
    const selectionTop = coords.top - containerRect.top + scrollTop;
    const margin = 80;
    if (coords.top < containerRect.top + margin || coords.top > containerRect.bottom - margin) {
      const targetScroll = selectionTop - containerRect.height / 2;
      scrollContainer.scrollTop = Math.max(0, targetScroll);
    }
  }, [editor]);

  // Highlight matches: set selection to first match and scroll (do NOT focus – user is typing)
  const highlightMatches = useCallback((term: string) => {
    if (!editor || !term) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const matches = findMatches(term);
    setMatchCount(matches.length);
    
    if (matches.length > 0) {
      setCurrentMatch(1);
      const range = matches[0];
      editor.chain().setTextSelection(range).run();
      requestAnimationFrame(() => scrollToSelection());
    } else {
      setCurrentMatch(0);
    }
  }, [editor, findMatches, scrollToSelection]);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    // TipTap doesn't have built-in highlight, just deselect
    if (editor) {
      editor.commands.blur();
    }
  }, [editor]);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (!editor || matchCount === 0) return;
    const matches = findMatches(searchTerm);
    const nextIndex = currentMatch >= matches.length ? 0 : currentMatch;
    if (matches[nextIndex]) {
      editor.chain().setTextSelection(matches[nextIndex]).focus().run();
      setCurrentMatch(nextIndex + 1);
      requestAnimationFrame(() => scrollToSelection());
    }
  }, [editor, searchTerm, matchCount, currentMatch, findMatches, scrollToSelection]);

  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    if (!editor || matchCount === 0) return;
    const matches = findMatches(searchTerm);
    const prevIndex = currentMatch <= 1 ? matches.length - 1 : currentMatch - 2;
    if (matches[prevIndex]) {
      editor.chain().setTextSelection(matches[prevIndex]).focus().run();
      setCurrentMatch(prevIndex + 1);
      requestAnimationFrame(() => scrollToSelection());
    }
  }, [editor, searchTerm, matchCount, currentMatch, findMatches, scrollToSelection]);

  // Replace current match
  const replaceCurrent = useCallback(() => {
    if (!editor || matchCount === 0) return;
    
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain()
        .deleteRange({ from, to })
        .insertContent(replaceTerm)
        .run();
      
      // Re-search after replace
      setTimeout(() => highlightMatches(searchTerm), 50);
    }
  }, [editor, replaceTerm, searchTerm, matchCount, highlightMatches]);

  // Replace all matches
  const replaceAll = useCallback(() => {
    if (!editor || matchCount === 0) return;
    
    const matches = findMatches(searchTerm);
    
    // Replace from end to start to preserve positions
    for (let i = matches.length - 1; i >= 0; i--) {
      editor.chain()
        .setTextSelection(matches[i])
        .deleteRange(matches[i])
        .insertContent(replaceTerm)
        .run();
    }
    
    // Clear search
    setMatchCount(0);
    setCurrentMatch(0);
  }, [editor, searchTerm, replaceTerm, matchCount, findMatches]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    highlightMatches(term);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-dialog" onKeyDown={handleKeyDown}>
      <div className="search-row">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Find in document..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {searchTerm && (
            <span className="search-count">
              {matchCount > 0 ? `${currentMatch} of ${matchCount}` : 'No results'}
            </span>
          )}
        </div>
        
        <div className="search-buttons">
          <button 
            className="search-btn" 
            onClick={goToPrevMatch}
            disabled={matchCount === 0}
            title="Previous match (Shift+Enter)"
          >
            <ChevronUpIcon />
          </button>
          <button 
            className="search-btn" 
            onClick={goToNextMatch}
            disabled={matchCount === 0}
            title="Next match (Enter)"
          >
            <ChevronDownIcon />
          </button>
          <button 
            className={`search-btn search-btn-toggle ${showReplace ? 'active' : ''}`}
            onClick={() => setShowReplace(!showReplace)}
            title="Toggle replace"
          >
            Replace
          </button>
          <button 
            className={`search-btn search-btn-toggle ${caseSensitive ? 'active' : ''}`}
            onClick={() => {
              setCaseSensitive(!caseSensitive);
              highlightMatches(searchTerm);
            }}
            title="Case sensitive"
          >
            Aa
          </button>
          <button 
            className="search-btn search-btn-close" 
            onClick={onClose}
            title="Close (Escape)"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      
      {showReplace && (
        <div className="search-row replace-row">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input replace-input"
              placeholder="Replace with..."
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
            />
          </div>
          <div className="search-buttons">
            <button 
              className="search-btn replace-btn"
              onClick={replaceCurrent}
              disabled={matchCount === 0}
              title="Replace current"
            >
              Replace
            </button>
            <button 
              className="search-btn replace-btn"
              onClick={replaceAll}
              disabled={matchCount === 0}
              title="Replace all"
            >
              All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const searchStyles = `
.search-dialog {
  position: absolute;
  top: 8px;
  right: 16px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 400px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.replace-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 10px;
}

.search-input-wrapper svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-count {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.search-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.search-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.search-btn-toggle {
  width: auto;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
}

.search-btn-toggle.active {
  background: var(--accent-primary);
  color: var(--bg-app);
}

.search-btn-close:hover {
  background: var(--accent-error);
  color: white;
}

.replace-input {
  padding-left: 0;
}

.replace-btn {
  width: auto;
  padding: 0 12px;
  font-size: 12px;
}

/* Highlight current search selection in editor */
.ProseMirror .search-highlight {
  background: rgba(255, 235, 59, 0.5);
  border-radius: 2px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = searchStyles;
  document.head.appendChild(styleEl);
}


