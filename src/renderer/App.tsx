import React, { useState, useEffect } from 'react';
import DualModeEditor from './components/Editor/DualModeEditor';
import Toolbar from './components/Toolbar/Toolbar';
import Sidebar from './components/Sidebar/Sidebar';
import ChapterList from './components/Chapters/ChapterList';
import SettingsModal from './components/Settings/SettingsModal';
import { useFileOperations } from './hooks/useFileOperations';
import { useStoryElementExtraction } from './hooks/useStoryElementExtraction';
import { useAnalysis } from './hooks/useAnalysis';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { exportDocument } from './services/export/exportService';
import { initializeLLMProviders } from './utils/initializeLLM';
import './App.css';

const App: React.FC = () => {
  const { saveProject, openProject, newProject } = useFileOperations();
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  useEffect(() => {
    initializeLLMProviders();
  }, []);

  useProjectPersistence(); // Auto-load and auto-save project
  useStoryElementExtraction(); // Start automatic extraction
  useAnalysis(); // Start automatic analysis

  const handleExport = async () => {
    // Show format selection (simplified - in production, use a modal)
    const format = window.confirm('Export as HTML? (Cancel for PDF)') ? 'html' : 'pdf';
    try {
      await exportDocument(format);
    } catch (error) {
      console.error('Export failed:', error);
      // Don't show alert for DOCX not implemented error
      if ((error as Error).message !== 'DOCX export not implemented') {
        alert('Export failed. Please try again.');
      }
    }
  };

  return (
    <div className="app">
      <Toolbar
        onSave={saveProject}
        onOpen={openProject}
        onNew={newProject}
        onExport={handleExport}
        onSettings={() => setSettingsOpen(true)}
      />
      <div className="app-content">
        <ChapterList />
        <DualModeEditor />
        <Sidebar />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default App;
