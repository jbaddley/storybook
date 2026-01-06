import React from 'react';
import { KEYBOARD_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const KeyboardShortcutsDialog: React.FC<KeyboardShortcutsDialogProps> = ({ onClose }) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle Escape key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-overlay" onClick={handleOverlayClick}>
      <div className="dialog shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Keyboard Shortcuts</h2>
          <button className="dialog-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="dialog-content shortcuts-content">
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.category} className="shortcuts-category">
              <h3 className="shortcuts-category-title">{category.category}</h3>
              <div className="shortcuts-list">
                {category.shortcuts.map((shortcut) => (
                  <div key={shortcut.action} className="shortcut-item">
                    <span className="shortcut-action">{shortcut.action}</span>
                    <div className="shortcut-keys">
                      {(isMac ? shortcut.mac : shortcut.keys).map((key, index) => (
                        <React.Fragment key={index}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {index < (isMac ? shortcut.mac : shortcut.keys).length - 1 && (
                            <span className="shortcut-plus">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="dialog-footer">
          <span className="shortcuts-hint">
            Press <kbd>?</kbd> to show this dialog
          </span>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Add styles for shortcuts dialog
const shortcutsStyles = `
.shortcuts-dialog {
  width: 600px;
  max-width: 90vw;
}

.shortcuts-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

@media (max-width: 600px) {
  .shortcuts-content {
    grid-template-columns: 1fr;
  }
}

.shortcuts-category {
  background: var(--bg-input);
  border-radius: 8px;
  padding: 16px;
}

.shortcuts-category-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.shortcut-action {
  font-size: 13px;
  color: var(--text-secondary);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-panel);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.shortcut-plus {
  font-size: 10px;
  color: var(--text-muted);
}

.shortcuts-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.shortcuts-hint kbd {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = shortcutsStyles;
  document.head.appendChild(styleEl);
}

