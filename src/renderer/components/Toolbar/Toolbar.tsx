import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useEditorStore } from '../../stores/editorStore';
import './Toolbar.css';

interface ToolbarProps {
  onSave: () => void;
  onOpen: () => void;
  onNew: () => void;
  onExport: () => void;
  onSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onSave,
  onOpen,
  onNew,
  onExport,
  onSettings,
}) => {
  const { currentFilePath } = useProjectStore();

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button onClick={onNew} className="toolbar-button">
          New
        </button>
        <button onClick={onOpen} className="toolbar-button">
          Open
        </button>
        <button onClick={onSave} className="toolbar-button">
          {currentFilePath ? 'Save' : 'Save As'}
        </button>
      </div>
      <div className="toolbar-section">
        <button onClick={onExport} className="toolbar-button">
          Export
        </button>
        <button onClick={onSettings} className="toolbar-button">
          Settings
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

