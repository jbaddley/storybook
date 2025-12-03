import React, { useState } from 'react';
import { useStoryElementsStore } from '../../stores/storyElementsStore';
import { StoryElement } from '@shared/types';
import './Sidebar.css';

const StoryElementsPanel: React.FC = () => {
  const { characters, locations, dates, themes, removeElement, updateElement } =
    useStoryElementsStore();
  const [selectedTab, setSelectedTab] = useState<'characters' | 'locations' | 'dates' | 'themes'>('characters');
  const [searchTerm, setSearchTerm] = useState('');

  const getCurrentElements = (): StoryElement[] => {
    switch (selectedTab) {
      case 'characters':
        return characters;
      case 'locations':
        return locations;
      case 'dates':
        return dates;
      case 'themes':
        return themes;
      default:
        return [];
    }
  };

  const filteredElements = getCurrentElements().filter((el) =>
    el.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="story-elements-panel">
      <div className="panel-header">
        <h3>Story Elements</h3>
      </div>
      <div className="panel-tabs">
        <button
          className={selectedTab === 'characters' ? 'active' : ''}
          onClick={() => setSelectedTab('characters')}
        >
          Characters ({characters.length})
        </button>
        <button
          className={selectedTab === 'locations' ? 'active' : ''}
          onClick={() => setSelectedTab('locations')}
        >
          Locations ({locations.length})
        </button>
        <button
          className={selectedTab === 'dates' ? 'active' : ''}
          onClick={() => setSelectedTab('dates')}
        >
          Dates ({dates.length})
        </button>
        <button
          className={selectedTab === 'themes' ? 'active' : ''}
          onClick={() => setSelectedTab('themes')}
        >
          Themes ({themes.length})
        </button>
      </div>
      <div className="panel-search">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="panel-content">
        {filteredElements.length === 0 ? (
          <div className="empty-state">No {selectedTab} found</div>
        ) : (
          filteredElements.map((element) => (
            <div key={element.id} className="element-item">
              <div className="element-header">
                <strong>{element.name}</strong>
                <button
                  className="delete-button"
                  onClick={() => removeElement(element.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
              {element.description && (
                <div className="element-description">{element.description}</div>
              )}
              {element.metadata && Object.keys(element.metadata).length > 0 && (
                <div className="element-metadata">
                  {Object.entries(element.metadata).map(([key, value]) => (
                    <div key={key} className="metadata-item">
                      <span className="metadata-key">{key}:</span>
                      <span className="metadata-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StoryElementsPanel;

