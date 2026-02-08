import { useEffect, useCallback } from 'react';
import { useBookStore } from '../stores/bookStore';

interface KeyboardShortcutsOptions {
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onNew: () => void;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  onShowShortcuts?: () => void;
  onFormatDocument?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const { 
    setZoom, 
    ui,
    addChapter,
    deleteChapter,
    activeChapterId,
    book,
    setActiveChapter,
  } = useBookStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    // File operations
    if (modifier && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      options.onSave();
      return;
    }

    if (modifier && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      options.onSaveAs();
      return;
    }

    if (modifier && !e.shiftKey && e.key === 'o') {
      e.preventDefault();
      options.onOpen();
      return;
    }

    if (modifier && !e.shiftKey && e.key === 'n') {
      e.preventDefault();
      options.onNew();
      return;
    }

    // Export shortcuts
    if (modifier && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      if (options.onExportDocx) {
        options.onExportDocx();
      }
      return;
    }

    // Zoom controls
    if (modifier && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      const newZoom = Math.min(ui.zoom + 10, 200);
      setZoom(newZoom);
      return;
    }

    if (modifier && e.key === '-') {
      e.preventDefault();
      const newZoom = Math.max(ui.zoom - 10, 50);
      setZoom(newZoom);
      return;
    }

    if (modifier && e.key === '0') {
      e.preventDefault();
      setZoom(100);
      return;
    }

    // Chapter navigation
    if (modifier && e.key === 'ArrowDown') {
      e.preventDefault();
      navigateChapter('next');
      return;
    }

    if (modifier && e.key === 'ArrowUp') {
      e.preventDefault();
      navigateChapter('prev');
      return;
    }

    // Add new chapter
    if (modifier && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      addChapter();
      return;
    }

    // Delete chapter (with confirmation via the UI, not directly)
    // We won't add a direct delete shortcut for safety

    // Format document (Cmd+Option+L / Ctrl+Alt+L — avoid Cmd+Shift+L which opens browser/Google)
    if (modifier && e.altKey && e.code === 'KeyL') {
      e.preventDefault();
      options.onFormatDocument?.();
      return;
    }

    // Show keyboard shortcuts dialog (? or F1)
    if (e.key === 'F1' || e.key === '?' || (e.shiftKey && e.key === '/')) {
      // Don't trigger ? if user is typing in an input/textarea (but F1 should always work)
      const activeElement = document.activeElement;
      const isEditing = activeElement?.tagName === 'INPUT' || 
                       activeElement?.tagName === 'TEXTAREA' ||
                       (activeElement as HTMLElement)?.isContentEditable;
      
      if ((e.key === 'F1' || !isEditing) && options.onShowShortcuts) {
        e.preventDefault();
        options.onShowShortcuts();
      }
      return;
    }

  }, [options, ui.zoom, setZoom, addChapter, book.chapters, activeChapterId, setActiveChapter]);

  const navigateChapter = useCallback((direction: 'next' | 'prev') => {
    const chapters = [...book.chapters].sort((a, b) => a.order - b.order);
    const currentIndex = chapters.findIndex(c => c.id === activeChapterId);
    
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'next') {
      newIndex = Math.min(currentIndex + 1, chapters.length - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex) {
      setActiveChapter(chapters[newIndex].id);
    }
  }, [book.chapters, activeChapterId, setActiveChapter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// Export a component that displays keyboard shortcuts
export const KEYBOARD_SHORTCUTS = [
  { category: 'File', shortcuts: [
    { keys: ['Ctrl', 'S'], mac: ['⌘', 'S'], action: 'Save' },
    { keys: ['Ctrl', 'Shift', 'S'], mac: ['⌘', '⇧', 'S'], action: 'Save As' },
    { keys: ['Ctrl', 'O'], mac: ['⌘', 'O'], action: 'Open' },
    { keys: ['Ctrl', 'N'], mac: ['⌘', 'N'], action: 'New Book' },
    { keys: ['Ctrl', 'Shift', 'E'], mac: ['⌘', '⇧', 'E'], action: 'Export DOCX' },
  ]},
  { category: 'Edit', shortcuts: [
    { keys: ['Ctrl', 'Z'], mac: ['⌘', 'Z'], action: 'Undo' },
    { keys: ['Ctrl', 'Y'], mac: ['⌘', '⇧', 'Z'], action: 'Redo' },
    { keys: ['Ctrl', 'A'], mac: ['⌘', 'A'], action: 'Select All' },
    { keys: ['Ctrl', 'C'], mac: ['⌘', 'C'], action: 'Copy' },
    { keys: ['Ctrl', 'X'], mac: ['⌘', 'X'], action: 'Cut' },
    { keys: ['Ctrl', 'V'], mac: ['⌘', 'V'], action: 'Paste' },
  ]},
  { category: 'Formatting', shortcuts: [
    { keys: ['Ctrl', 'Alt', 'L'], mac: ['⌘', '⌥', 'L'], action: 'Format Document' },
    { keys: ['Ctrl', 'B'], mac: ['⌘', 'B'], action: 'Bold' },
    { keys: ['Ctrl', 'I'], mac: ['⌘', 'I'], action: 'Italic' },
    { keys: ['Ctrl', 'U'], mac: ['⌘', 'U'], action: 'Underline' },
    { keys: ['Ctrl', 'Shift', 'X'], mac: ['⌘', '⇧', 'X'], action: 'Strikethrough' },
    { keys: ['Ctrl', 'Shift', '7'], mac: ['⌘', '⇧', '7'], action: 'Numbered List' },
    { keys: ['Ctrl', 'Shift', '8'], mac: ['⌘', '⇧', '8'], action: 'Bullet List' },
  ]},
  { category: 'View', shortcuts: [
    { keys: ['Ctrl', '+'], mac: ['⌘', '+'], action: 'Zoom In' },
    { keys: ['Ctrl', '-'], mac: ['⌘', '-'], action: 'Zoom Out' },
    { keys: ['Ctrl', '0'], mac: ['⌘', '0'], action: 'Reset Zoom' },
  ]},
  { category: 'Navigation', shortcuts: [
    { keys: ['Ctrl', '↑'], mac: ['⌘', '↑'], action: 'Previous Chapter' },
    { keys: ['Ctrl', '↓'], mac: ['⌘', '↓'], action: 'Next Chapter' },
    { keys: ['Ctrl', 'Shift', 'N'], mac: ['⌘', '⇧', 'N'], action: 'New Chapter' },
  ]},
];

