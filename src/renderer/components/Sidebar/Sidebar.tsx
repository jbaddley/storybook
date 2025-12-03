import React, { useState } from 'react';
import StoryElementsPanel from './StoryElementsPanel';
import ConsistencyPanel from './ConsistencyPanel';
import PlotPanel from './PlotPanel';
import LLMPanel from './LLMPanel';
import './Sidebar.css';

type SidebarTab = 'elements' | 'llm' | 'consistency' | 'plot';

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('elements');

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'elements' ? 'active' : ''}`}
          onClick={() => setActiveTab('elements')}
        >
          Elements
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'llm' ? 'active' : ''}`}
          onClick={() => setActiveTab('llm')}
        >
          LLM
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'consistency' ? 'active' : ''}`}
          onClick={() => setActiveTab('consistency')}
        >
          Issues
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'plot' ? 'active' : ''}`}
          onClick={() => setActiveTab('plot')}
        >
          Plot
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === 'elements' && <StoryElementsPanel />}
        {activeTab === 'llm' && <LLMPanel />}
        {activeTab === 'consistency' && <ConsistencyPanel />}
        {activeTab === 'plot' && <PlotPanel />}
      </div>
    </div>
  );
};

export default Sidebar;

