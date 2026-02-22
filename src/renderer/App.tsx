import React, { useEffect, useState, useRef } from 'react';
import { useBookStore } from './stores/bookStore';
import { ChapterList, ChapterListHeaderActions } from './components/ChapterList';
import { Editor } from './components/Editor';
import { AIPanel, AIPanelHeaderActions } from './components/AIPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { Toolbar } from './components/Toolbar';
import { SettingsDialog } from './components/SettingsDialog';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { DocumentTabViewer } from './components/DocumentTabViewer';
import { AutosaveIndicator } from './components/AutosaveIndicator';
import { GoogleDocsImportDialog } from './components/GoogleDocsImportDialog';
import { GoogleDocsExportDialog } from './components/GoogleDocsExportDialog';
import { GoogleDocsSyncDialog } from './components/GoogleDocsSyncDialog';
import { GoogleDriveBackupDialog } from './components/GoogleDriveBackupDialog';
import { PdfExportDialog } from './components/PdfExportDialog';
import { RecoveryTool } from './components/RecoveryTool';
import { ToastContainer } from './components/ToastNotification';
import { BackgroundTaskIndicator } from './components/BackgroundTaskIndicator';
import { AudioExportDialog } from './components/AudioExportDialog';
import { OpenFromCloudDialog } from './components/OpenFromCloudDialog';
import { useFileOperations } from './hooks/useFileOperations';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutosave } from './hooks/useAutosave';
import { useDbPullWhenNewer } from './hooks/useDbPullWhenNewer';
import { DEFAULT_TIPTAP_CONTENT, DocumentTab } from '../shared/types';
import './styles/app.css';

const PANEL_SETTINGS_KEY = 'panel-settings';

function getPanelSettingsKey(userId: string | null): string {
  return userId ? `${PANEL_SETTINGS_KEY}:${userId}` : PANEL_SETTINGS_KEY;
}

const App: React.FC = () => {
  const { 
    ui, 
    book,
    toggleChaptersPanel, 
    toggleAIPanel,
    setPanelSettings,
    setLeftPanelWidth,
    setRightPanelWidth,
    zoomIn,
    zoomOut,
    resetZoom,
    setSettingsOpen,
    setContentEditorTheme,
  } = useBookStore();

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted content editor theme on init
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.storeGet) {
      window.electronAPI.storeGet('content-editor-theme').then((saved: unknown) => {
        if (saved === 'light' || saved === 'dark') {
          setContentEditorTheme(saved);
        }
      });
    }
  }, [setContentEditorTheme]);

  // Load panel settings on init and when user changes (user-scoped persistence)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.storeGet) return;
    const key = getPanelSettingsKey(ui.currentUserId);
    window.electronAPI.storeGet(key).then((saved: unknown) => {
      const data = saved as { showChaptersPanel?: boolean; showAIPanel?: boolean; leftPanelWidth?: number; rightPanelWidth?: number } | null;
      if (data && typeof data === 'object') {
        setPanelSettings({
          ...(typeof data.showChaptersPanel === 'boolean' && { showChaptersPanel: data.showChaptersPanel }),
          ...(typeof data.showAIPanel === 'boolean' && { showAIPanel: data.showAIPanel }),
          ...(typeof data.leftPanelWidth === 'number' && data.leftPanelWidth >= 180 && data.leftPanelWidth <= 500 && { leftPanelWidth: data.leftPanelWidth }),
          ...(typeof data.rightPanelWidth === 'number' && data.rightPanelWidth >= 280 && data.rightPanelWidth <= 600 && { rightPanelWidth: data.rightPanelWidth }),
        });
      }
    });
  }, [ui.currentUserId, setPanelSettings]);

  // Persist panel settings when they change (debounced, user-scoped)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.storeSet) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const key = getPanelSettingsKey(ui.currentUserId);
      window.electronAPI.storeSet(key, {
        showChaptersPanel: ui.showChaptersPanel,
        showAIPanel: ui.showAIPanel,
        leftPanelWidth: ui.leftPanelWidth,
        rightPanelWidth: ui.rightPanelWidth,
      });
      saveTimeoutRef.current = null;
    }, 300);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [ui.currentUserId, ui.showChaptersPanel, ui.showAIPanel, ui.leftPanelWidth, ui.rightPanelWidth]);
  
  // Get active document tab (if any) - need to compute based on reactive state
  // Permanent tabs might not be in book.documentTabs yet, so we need to check both
  const activeDocumentTab = ui.activeDocumentTabId 
    ? (book.documentTabs?.find(t => t.id === ui.activeDocumentTabId) || 
       // If not found in saved tabs, check if it's a permanent tab and create it
       (() => {
         const permanentTabDefs: Array<{ id: string; title: string; icon: string; tabType: any }> = [
           { id: 'characters-tab', title: 'Characters', icon: '👤', tabType: 'characters' },
           { id: 'locations-tab', title: 'Locations', icon: '📍', tabType: 'locations' },
           { id: 'timeline-tab', title: 'Timeline', icon: '📅', tabType: 'timeline' },
           { id: 'storycraft-tab', title: 'Story Craft', icon: '🎭', tabType: 'storycraft' },
           { id: 'outliner-tab', title: 'Outliner', icon: '📋', tabType: 'outliner' },
           { id: 'themes-tab', title: 'Themes & Motifs', icon: '🎨', tabType: 'themes' },
           { id: 'plotanalysis-tab', title: 'Plot Analysis', icon: '🔍', tabType: 'plotanalysis' },
           { id: 'songs-tab', title: 'Songs', icon: '🎵', tabType: 'songs' },
         ];
         const def = permanentTabDefs.find(pt => pt.id === ui.activeDocumentTabId);
         if (def) {
           // Create a temporary tab object for permanent tabs
           return {
             id: def.id,
             title: def.title,
             icon: def.icon,
             tabType: def.tabType,
             content: book.documentTabs?.find(t => t.tabType === def.tabType)?.content || DEFAULT_TIPTAP_CONTENT,
             isPermanent: true,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
           };
         }
         return undefined;
       })())
    : undefined;
  
  const [isShortcutsOpen, setShortcutsOpen] = useState(false);
  const [isRecoveryOpen, setRecoveryOpen] = useState(false);
  const [isGoogleDocsImportOpen, setGoogleDocsImportOpen] = useState(false);
  const [isGoogleDocsExportOpen, setGoogleDocsExportOpen] = useState(false);
  const [isGoogleDocsSyncOpen, setGoogleDocsSyncOpen] = useState(false);
  const [isGoogleDriveBackupOpen, setGoogleDriveBackupOpen] = useState(false);
  const [isPdfExportOpen, setPdfExportOpen] = useState(false);
  const [isAudioExportAllOpen, setIsAudioExportAllOpen] = useState(false);
  const [isOpenFromCloudOpen, setOpenFromCloudOpen] = useState(false);
  
  // Autosave hook - saves directly to .sbk file
  const { 
    status: autosaveStatus, 
    lastSaved,
    filePath,
  } = useAutosave({ debounceMs: 2000, intervalMs: 30000 });

  // When app gains focus or on interval: if DB has newer content, pull and update the app
  useDbPullWhenNewer();
  
  const { handleNew, handleOpen, handleSave, handleSaveAs, handleExportDocx, handleExportPdf } = useFileOperations();
  
  const triggerFormatDocument = () => {
    window.dispatchEvent(new CustomEvent('storybook:format-document'));
  };

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onOpen: handleOpen,
    onNew: handleNew,
    onExportDocx: handleExportDocx,
    onExportPdf: () => setPdfExportOpen(true),
    onShowShortcuts: () => setShortcutsOpen(true),
    onFormatDocument: triggerFormatDocument,
  });
  
  // Set up menu event listeners
  useMenuEvents({
    onNew: handleNew,
    onOpen: handleOpen,
    onOpenFromCloud: () => setOpenFromCloudOpen(true),
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onExportDocx: handleExportDocx,
    onExportPdf: () => setPdfExportOpen(true),
    onSettings: () => setSettingsOpen(true),
    onToggleChapters: toggleChaptersPanel,
    onToggleAI: toggleAIPanel,
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onZoomReset: resetZoom,
    onImportGoogleDocs: () => setGoogleDocsImportOpen(true),
    onExportGoogleDocs: () => setGoogleDocsExportOpen(true),
    onSyncGoogleDocs: () => setGoogleDocsSyncOpen(true),
    onExportAllAudio: () => setIsAudioExportAllOpen(true),
    onFormatDocument: triggerFormatDocument,
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
      {/* Title bar drag region */}
      <div className="titlebar drag-region">
        <span className="titlebar-title">{book.title}</span>
        <span className="titlebar-book-id" title="Book ID — same in .sbk and database when linked">
          {book.id}
        </span>
        {ui.isDirty && <span className="titlebar-dirty">•</span>}
        <BackgroundTaskIndicator />
        <AutosaveIndicator status={autosaveStatus} lastSaved={lastSaved} filePath={filePath} />
      </div>
      
      {/* Toolbar */}
      <Toolbar 
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowRecovery={() => setRecoveryOpen(true)}
        onImportGoogleDocs={() => setGoogleDocsImportOpen(true)}
        onExportGoogleDocs={() => setGoogleDocsExportOpen(true)}
        onSyncGoogleDocs={() => setGoogleDocsSyncOpen(true)}
        onGoogleDriveBackup={() => setGoogleDriveBackupOpen(true)}
      />
      
      {/* Main content area */}
      <div className="main-content">
        {/* Left panel - Chapters (resizable, closeable) */}
        {ui.showChaptersPanel ? (
          <ResizablePanel
            side="left"
            title="Chapters"
            width={ui.leftPanelWidth}
            minWidth={180}
            maxWidth={500}
            onClose={toggleChaptersPanel}
            onResize={setLeftPanelWidth}
            headerActions={<ChapterListHeaderActions />}
          >
            <ChapterList />
          </ResizablePanel>
        ) : (
          <button
            type="button"
            className="panel-tab"
            onClick={toggleChaptersPanel}
            title="Show Chapters panel"
          >
            Chapters
          </button>
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
        
        {/* Right panel - AI Assistant (resizable, closeable) */}
        {ui.showAIPanel ? (
          <ResizablePanel
            side="right"
            title="AI Assistant"
            width={ui.rightPanelWidth}
            minWidth={280}
            maxWidth={600}
            onClose={toggleAIPanel}
            onResize={setRightPanelWidth}
            headerActions={<AIPanelHeaderActions />}
          >
            <AIPanel />
          </ResizablePanel>
        ) : (
          <button
            type="button"
            className="panel-tab panel-tab-right"
            onClick={toggleAIPanel}
            title="Show AI Assistant panel"
          >
            AI
          </button>
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
      
      {/* Recovery Tool Dialog */}
      {isRecoveryOpen && (
        <RecoveryTool onClose={() => setRecoveryOpen(false)} />
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
      
      {/* Google Drive Backup Dialog */}
      {isGoogleDriveBackupOpen && (
        <GoogleDriveBackupDialog 
          isOpen={isGoogleDriveBackupOpen} 
          onClose={() => setGoogleDriveBackupOpen(false)} 
        />
      )}
      
      {/* PDF Export Dialog */}
      {isPdfExportOpen && (
        <PdfExportDialog onClose={() => setPdfExportOpen(false)} />
      )}
      {isAudioExportAllOpen && (
        <AudioExportDialog
          isOpen={true}
          onClose={() => setIsAudioExportAllOpen(false)}
          chapterId=""
          exportAll
        />
      )}
      
      {/* Open from cloud */}
      {isOpenFromCloudOpen && (
        <OpenFromCloudDialog
          open={isOpenFromCloudOpen}
          onClose={() => setOpenFromCloudOpen(false)}
        />
      )}
      
      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};

export default App;
