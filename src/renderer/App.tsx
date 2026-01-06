import React, { useEffect, useState } from 'react';
import { useBookStore } from './stores/bookStore';
import { ChapterList } from './components/ChapterList';
import { Editor } from './components/Editor';
import { AIPanel } from './components/AIPanel';
import { Toolbar } from './components/Toolbar';
import { SettingsDialog } from './components/SettingsDialog';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { DocumentTabViewer } from './components/DocumentTabViewer';
import { AutosaveIndicator, RecoveryDialog } from './components/AutosaveIndicator';
import { GoogleDocsImportDialog } from './components/GoogleDocsImportDialog';
import { GoogleDocsExportDialog } from './components/GoogleDocsExportDialog';
import { GoogleDocsSyncDialog } from './components/GoogleDocsSyncDialog';
import { useFileOperations } from './hooks/useFileOperations';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutosave } from './hooks/useAutosave';
import { getAutosaveTimestamp } from './services/storageService';
import './styles/app.css';

const App: React.FC = () => {
  const { 
    ui, 
    book,
    toggleChaptersPanel, 
    toggleAIPanel,
    zoomIn,
    zoomOut,
    resetZoom,
    setSettingsOpen,
  } = useBookStore();
  
  // Get active document tab (if any) - need to compute based on reactive state
  const activeDocumentTab = ui.activeDocumentTabId 
    ? book.documentTabs?.find(t => t.id === ui.activeDocumentTabId)
    : undefined;
  
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const [isGoogleDocsImportOpen, setGoogleDocsImportOpen] = useState(false);
  const [isGoogleDocsExportOpen, setGoogleDocsExportOpen] = useState(false);
  const [isGoogleDocsSyncOpen, setGoogleDocsSyncOpen] = useState(false);
  
  // Autosave hook
  const { 
    status: autosaveStatus, 
    lastSaved, 
    hasRecoveryData, 
    recoverData, 
    dismissRecovery,
    clearSavedData,
    storageType,
    lastSaveSize,
  } = useAutosave({ debounceMs: 2000, intervalMs: 30000 });
  
  const { handleNew, handleOpen, handleSave, handleSaveAs, handleExportDocx, handleExportPdf } = useFileOperations();
  
  // Clear autosave data after manual save
  const handleSaveWithClear = () => {
    handleSave();
    // Clear autosave after save attempt - the file service will handle errors
    clearSavedData();
  };
  
  const handleSaveAsWithClear = () => {
    handleSaveAs();
    // Clear autosave after save attempt
    clearSavedData();
  };
  
  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSaveWithClear,
    onSaveAs: handleSaveAsWithClear,
    onOpen: handleOpen,
    onNew: handleNew,
    onExportDocx: handleExportDocx,
    onExportPdf: handleExportPdf,
    onShowShortcuts: () => setShortcutsOpen(true),
  });
  
  // Set up menu event listeners
  useMenuEvents({
    onNew: handleNew,
    onOpen: handleOpen,
    onSave: handleSaveWithClear,
    onSaveAs: handleSaveAsWithClear,
    onExportDocx: handleExportDocx,
    onExportPdf: handleExportPdf,
    onSettings: () => setSettingsOpen(true),
    onToggleChapters: toggleChaptersPanel,
    onToggleAI: toggleAIPanel,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onZoomReset: resetZoom,
    onImportGoogleDocs: () => setGoogleDocsImportOpen(true),
    onExportGoogleDocs: () => setGoogleDocsExportOpen(true),
    onSyncGoogleDocs: () => setGoogleDocsSyncOpen(true),
  });

  // Window title
  useEffect(() => {
    const title = ui.isDirty 
      ? `• ${book.title} - Storybook Editor`
      : `${book.title} - Storybook Editor`;
    document.title = title;
  }, [book.title, ui.isDirty]);

  return (
    <div className="app">
      {/* Recovery Dialog */}
      {hasRecoveryData && (
        <RecoveryDialog 
          timestamp={getAutosaveTimestamp()} 
          onRecover={recoverData} 
          onDiscard={dismissRecovery} 
        />
      )}
      
      {/* Title bar drag region */}
      <div className="titlebar drag-region">
        <span className="titlebar-title">{book.title}</span>
        {ui.isDirty && <span className="titlebar-dirty">•</span>}
        <AutosaveIndicator status={autosaveStatus} lastSaved={lastSaved} storageType={storageType} saveSize={lastSaveSize} />
      </div>
      
      {/* Toolbar */}
      <Toolbar 
        onShowShortcuts={() => setShortcutsOpen(true)} 
        onImportGoogleDocs={() => setGoogleDocsImportOpen(true)}
        onExportGoogleDocs={() => setGoogleDocsExportOpen(true)}
        onSyncGoogleDocs={() => setGoogleDocsSyncOpen(true)}
      />
      
      {/* Main content area */}
      <div className="main-content">
        {/* Left panel - Chapters */}
        {ui.showChaptersPanel && (
          <aside className="panel panel-left">
            <ChapterList />
          </aside>
        )}
        
        {/* Center - Editor or Document Tab Viewer */}
        <main className="editor-container">
          {activeDocumentTab ? (
            <div className="tab-viewer-container">
              <DocumentTabViewer tab={activeDocumentTab} />
            </div>
          ) : (
            <Editor />
          )}
        </main>
        
        {/* Right panel - AI Assistant */}
        {ui.showAIPanel && (
          <aside className="panel panel-right">
            <AIPanel />
          </aside>
        )}
      </div>
      
      {/* Settings Dialog */}
      {ui.isSettingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
      
      {/* Keyboard Shortcuts Dialog */}
      {isShortcutsOpen && (
        <KeyboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />
      )}
      
      {/* Google Docs Import Dialog */}
      {isGoogleDocsImportOpen && (
        <GoogleDocsImportDialog onClose={() => setGoogleDocsImportOpen(false)} />
      )}
      
      {/* Google Docs Export Dialog */}
      {isGoogleDocsExportOpen && (
        <GoogleDocsExportDialog onClose={() => setGoogleDocsExportOpen(false)} />
      )}
      
      {/* Google Docs Sync Dialog */}
      {isGoogleDocsSyncOpen && (
        <GoogleDocsSyncDialog onClose={() => setGoogleDocsSyncOpen(false)} />
      )}
    </div>
  );
};

export default App;

