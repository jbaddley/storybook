import React, { useState } from 'react';
import { useBookStore } from '../stores/bookStore';
import { Character, Location, TimelineEvent, DocumentTab, StoryCraftChapterFeedback, StoryCraftChecklistItem, Theme, Motif, Symbol } from '../../shared/types';

// Icons
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    width="16" 
    height="16"
    style={{ 
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease',
    }}
  >
    <polyline points="9,6 15,12 9,18"/>
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const CancelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

interface DocumentTabViewerProps {
  tab: DocumentTab;
}

export const DocumentTabViewer: React.FC<DocumentTabViewerProps> = ({ tab }) => {
  switch (tab.tabType) {
    case 'characters':
      return <CharactersView />;
    case 'locations':
      return <LocationsView />;
    case 'timeline':
      return <TimelineView />;
    case 'summaries':
      return <SummariesView />;
    case 'storycraft':
      return <StoryCraftView />;
    case 'themes':
      return <ThemesView />;
    case 'custom':
      return <CustomTabView tab={tab} />;
    default:
      return <div>Unknown tab type</div>;
  }
};

// Character Edit Form Component
const CharacterEditForm: React.FC<{
  character: Character;
  onSave: (updates: Partial<Character>) => void;
  onCancel: () => void;
}> = ({ character, onSave, onCancel }) => {
  const [name, setName] = useState(character.name);
  const [aliases, setAliases] = useState(character.aliases.join(', '));
  const [description, setDescription] = useState(character.description || '');

  const handleSave = () => {
    onSave({
      name: name.trim(),
      aliases: aliases.split(',').map(a => a.trim()).filter(a => a),
      description: description.trim(),
    });
  };

  return (
    <div className="edit-form">
      <div className="edit-form-field">
        <label>Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="Character name"
        />
      </div>
      <div className="edit-form-field">
        <label>Aliases (comma-separated)</label>
        <input 
          type="text" 
          value={aliases} 
          onChange={(e) => setAliases(e.target.value)}
          placeholder="Nickname, Other Name"
        />
      </div>
      <div className="edit-form-field">
        <label>Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Character description..."
          rows={3}
        />
      </div>
      <div className="edit-form-actions">
        <button className="btn-save" onClick={handleSave}>
          <SaveIcon /> Save
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          <CancelIcon /> Cancel
        </button>
      </div>
    </div>
  );
};

// Characters View - Single document format for easy reading
const CharactersView: React.FC = () => {
  const { book, getChapterById, updateCharacter, deleteCharacter } = useBookStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sort characters by total mentions (most prominent first)
  const sortedCharacters = [...book.extracted.characters].sort((a, b) => {
    const aMentions = a.mentions.reduce((sum, m) => sum + m.count, 0);
    const bMentions = b.mentions.reduce((sum, m) => sum + m.count, 0);
    return bMentions - aMentions;
  });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete character "${name}"? This cannot be undone.`)) {
      deleteCharacter(id);
    }
  };

  if (sortedCharacters.length === 0) {
    return (
      <EmptyState 
        icon="👤" 
        title="No Characters Extracted"
        description="Use the 'Extract' feature in the AI Assistant panel to find characters in your chapters."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Character Guide</h2>
        <p className="text-muted">{sortedCharacters.length} character{sortedCharacters.length !== 1 ? 's' : ''} in your story</p>
      </div>
      
      <div className="characters-document">
        {sortedCharacters.map((character, index) => {
          const totalMentions = character.mentions.reduce((sum, m) => sum + m.count, 0);
          const sortedMentions = [...character.mentions].sort((a, b) => {
            const chapterA = getChapterById(a.chapterId);
            const chapterB = getChapterById(b.chapterId);
            return (chapterA?.order || 0) - (chapterB?.order || 0);
          });
          const isEditing = editingId === character.id;
          
          return (
            <div key={character.id} className="character-entry">
              {isEditing ? (
                <CharacterEditForm
                  character={character}
                  onSave={(updates) => {
                    updateCharacter(character.id, updates);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  {/* Header with name and actions */}
                  <div className="entry-header">
                    <h3 className="character-name">{character.name}</h3>
                    <div className="entry-actions">
                      <button 
                        className="btn-icon" 
                        onClick={() => setEditingId(character.id)}
                        title="Edit character"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="btn-icon btn-danger" 
                        onClick={() => handleDelete(character.id, character.name)}
                        title="Delete character"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                  
                  {/* Aliases */}
                  {character.aliases.length > 0 && (
                    <div className="character-aliases">
                      <span className="label">Also known as:</span> {character.aliases.join(', ')}
                    </div>
                  )}
                  
                  {/* Description */}
                  {character.description ? (
                    <p className="character-description">{character.description}</p>
                  ) : (
                    <p className="character-description text-muted italic">
                      No description yet. Click edit to add one.
                    </p>
                  )}
                  
                  {/* Chapter Appearances */}
                  <div className="character-chapters">
                    <span className="label">Appears in ({totalMentions} mention{totalMentions !== 1 ? 's' : ''}):</span>
                    <div className="chapter-list">
                      {sortedMentions.map((mention) => {
                        const chapter = getChapterById(mention.chapterId);
                        return (
                          <span key={mention.chapterId} className="chapter-tag">
                            {chapter?.title || 'Unknown'}
                            {mention.count > 1 && <span className="mention-badge">{mention.count}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              
              {/* Divider between characters */}
              {index < sortedCharacters.length - 1 && (
                <hr className="character-divider" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Location Edit Form Component
const LocationEditForm: React.FC<{
  location: Location;
  onSave: (updates: Partial<Location>) => void;
  onCancel: () => void;
}> = ({ location, onSave, onCancel }) => {
  const [name, setName] = useState(location.name);
  const [type, setType] = useState(location.type || '');
  const [description, setDescription] = useState(location.description || '');

  const handleSave = () => {
    onSave({
      name: name.trim(),
      type: type.trim() || undefined,
      description: description.trim(),
    });
  };

  return (
    <div className="edit-form">
      <div className="edit-form-field">
        <label>Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          placeholder="Location name"
        />
      </div>
      <div className="edit-form-field">
        <label>Type</label>
        <input 
          type="text" 
          value={type} 
          onChange={(e) => setType(e.target.value)}
          placeholder="City, Building, Region, etc."
        />
      </div>
      <div className="edit-form-field">
        <label>Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Location description..."
          rows={3}
        />
      </div>
      <div className="edit-form-actions">
        <button className="btn-save" onClick={handleSave}>
          <SaveIcon /> Save
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          <CancelIcon /> Cancel
        </button>
      </div>
    </div>
  );
};

// Locations View - Single document format
const LocationsView: React.FC = () => {
  const { book, getChapterById, updateLocation, deleteLocation } = useBookStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Group locations by type
  const locationsByType = book.extracted.locations.reduce((acc, loc) => {
    const type = loc.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(loc);
    return acc;
  }, {} as Record<string, typeof book.extracted.locations>);

  // Sort types and locations within each type
  const sortedTypes = Object.keys(locationsByType).sort();

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete location "${name}"? This cannot be undone.`)) {
      deleteLocation(id);
    }
  };

  if (book.extracted.locations.length === 0) {
    return (
      <EmptyState 
        icon="📍" 
        title="No Locations Extracted"
        description="Use the 'Extract' feature in the AI Assistant panel to find locations in your chapters."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Location Guide</h2>
        <p className="text-muted">{book.extracted.locations.length} location{book.extracted.locations.length !== 1 ? 's' : ''} in your story</p>
      </div>
      
      <div className="locations-document">
        {sortedTypes.map((type, typeIndex) => {
          const locations = locationsByType[type].sort((a, b) => {
            const aMentions = a.mentions.reduce((sum, m) => sum + m.count, 0);
            const bMentions = b.mentions.reduce((sum, m) => sum + m.count, 0);
            return bMentions - aMentions;
          });

          return (
            <div key={type} className="location-type-section">
              <h3 className="location-type-header">{type}</h3>
              
              {locations.map((location, locIndex) => {
                const totalMentions = location.mentions.reduce((sum, m) => sum + m.count, 0);
                const sortedMentions = [...location.mentions].sort((a, b) => {
                  const chapterA = getChapterById(a.chapterId);
                  const chapterB = getChapterById(b.chapterId);
                  return (chapterA?.order || 0) - (chapterB?.order || 0);
                });
                const isEditing = editingId === location.id;

                return (
                  <div key={location.id} className="location-entry">
                    {isEditing ? (
                      <LocationEditForm
                        location={location}
                        onSave={(updates) => {
                          updateLocation(location.id, updates);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="entry-header">
                          <h4 className="location-name">{location.name}</h4>
                          <div className="entry-actions">
                            <button 
                              className="btn-icon" 
                              onClick={() => setEditingId(location.id)}
                              title="Edit location"
                            >
                              <EditIcon />
                            </button>
                            <button 
                              className="btn-icon btn-danger" 
                              onClick={() => handleDelete(location.id, location.name)}
                              title="Delete location"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </div>
                        
                        {location.description ? (
                          <p className="location-description">{location.description}</p>
                        ) : (
                          <p className="location-description text-muted italic">
                            No description yet. Click edit to add one.
                          </p>
                        )}
                        
                        <div className="location-chapters">
                          <span className="label">Mentioned in ({totalMentions} time{totalMentions !== 1 ? 's' : ''}):</span>
                          <div className="chapter-list">
                            {sortedMentions.map((mention) => {
                              const chapter = getChapterById(mention.chapterId);
                              return (
                                <span key={mention.chapterId} className="chapter-tag">
                                  {chapter?.title || 'Unknown'}
                                  {mention.count > 1 && <span className="mention-badge">{mention.count}</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                    
                    {locIndex < locations.length - 1 && (
                      <hr className="location-divider" />
                    )}
                  </div>
                );
              })}
              
              {typeIndex < sortedTypes.length - 1 && (
                <div className="location-type-separator" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Summary Edit Form Component
const SummaryEditForm: React.FC<{
  summary: { summary: string; keyPoints: string[] };
  onSave: (updates: { summary?: string; keyPoints?: string[] }) => void;
  onCancel: () => void;
}> = ({ summary, onSave, onCancel }) => {
  const [summaryText, setSummaryText] = useState(summary.summary);
  const [keyPoints, setKeyPoints] = useState(summary.keyPoints.join('\n'));

  const handleSave = () => {
    onSave({
      summary: summaryText.trim(),
      keyPoints: keyPoints.split('\n').map(p => p.trim()).filter(p => p),
    });
  };

  return (
    <div className="edit-form">
      <div className="edit-form-field">
        <label>Summary</label>
        <textarea 
          value={summaryText} 
          onChange={(e) => setSummaryText(e.target.value)}
          placeholder="Chapter summary..."
          rows={4}
        />
      </div>
      <div className="edit-form-field">
        <label>Key Points (one per line)</label>
        <textarea 
          value={keyPoints} 
          onChange={(e) => setKeyPoints(e.target.value)}
          placeholder="Key point 1&#10;Key point 2&#10;Key point 3"
          rows={4}
        />
      </div>
      <div className="edit-form-actions">
        <button className="btn-save" onClick={handleSave}>
          <SaveIcon /> Save
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          <CancelIcon /> Cancel
        </button>
      </div>
    </div>
  );
};

// Summaries View - displays as a single continuous document
const SummariesView: React.FC = () => {
  const { book, ai, getChapterById, updateSummary, deleteSummary } = useBookStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Get all summaries as an array, sorted by chapter order
  const summaries = Array.from(ai.summaries.entries())
    .map(([chapterId, summary]) => ({
      chapterId,
      summary,
      chapter: getChapterById(chapterId),
    }))
    .filter(s => s.chapter) // Only include summaries for existing chapters
    .sort((a, b) => (a.chapter?.order || 0) - (b.chapter?.order || 0));

  const handleDelete = (chapterId: string, chapterTitle: string) => {
    if (confirm(`Delete summary for "${chapterTitle}"? This cannot be undone.`)) {
      deleteSummary(chapterId);
    }
  };

  if (summaries.length === 0) {
    return (
      <EmptyState 
        icon="📝" 
        title="No Chapter Summaries"
        description="Use the 'Summarize Chapter' feature in the AI Assistant panel to generate summaries for your chapters."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Book Summary</h2>
        <p className="text-muted">{summaries.length} chapter{summaries.length !== 1 ? 's' : ''} summarized</p>
      </div>
      
      <div className="summaries-document">
        {summaries.map(({ chapterId, summary, chapter }, index) => {
          const isEditing = editingId === chapterId;
          
          return (
            <div key={chapterId} className="summary-chapter-section">
              {isEditing ? (
                <>
                  <h3 className="summary-chapter-title">{chapter?.title || 'Unknown Chapter'}</h3>
                  <SummaryEditForm
                    summary={summary}
                    onSave={(updates) => {
                      updateSummary(chapterId, updates);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </>
              ) : (
                <>
                  <div className="entry-header">
                    <h3 className="summary-chapter-title">{chapter?.title || 'Unknown Chapter'}</h3>
                    <div className="entry-actions">
                      <button 
                        className="btn-icon" 
                        onClick={() => setEditingId(chapterId)}
                        title="Edit summary"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="btn-icon btn-danger" 
                        onClick={() => handleDelete(chapterId, chapter?.title || 'Unknown')}
                        title="Delete summary"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </div>
                  
                  <p className="summary-text">{summary.summary}</p>
                  
                  {summary.keyPoints.length > 0 && (
                    <div className="summary-key-points-inline">
                      <strong>Key Points:</strong>
                      <ul>
                        {summary.keyPoints.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              
              {index < summaries.length - 1 && (
                <hr className="summary-divider" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Timeline Edit Form Component
const TimelineEditForm: React.FC<{
  event: TimelineEvent;
  onSave: (updates: Partial<TimelineEvent>) => void;
  onCancel: () => void;
}> = ({ event, onSave, onCancel }) => {
  const [date, setDate] = useState(event.date || '');
  const [description, setDescription] = useState(event.description);
  const [eventType, setEventType] = useState(event.eventType);
  const [dateType, setDateType] = useState(event.dateType || 'unknown');

  const handleSave = () => {
    onSave({
      date: date.trim() || undefined,
      description: description.trim(),
      eventType,
      dateType,
    });
  };

  return (
    <div className="edit-form edit-form-inline">
      <div className="edit-form-row">
        <div className="edit-form-field">
          <label>Date</label>
          <input 
            type="text" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g., Spring 1985, Two years ago"
          />
        </div>
        <div className="edit-form-field">
          <label>Date Type</label>
          <select value={dateType} onChange={(e) => setDateType(e.target.value as any)}>
            <option value="exact">Exact</option>
            <option value="approximate">Approximate</option>
            <option value="relative">Relative</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div className="edit-form-field">
          <label>Event Type</label>
          <select value={eventType} onChange={(e) => setEventType(e.target.value as any)}>
            <option value="present">Present</option>
            <option value="past">Past Reference</option>
            <option value="flashback">Flashback</option>
            <option value="future">Future</option>
          </select>
        </div>
      </div>
      <div className="edit-form-field">
        <label>Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened..."
          rows={2}
        />
      </div>
      <div className="edit-form-actions">
        <button className="btn-save" onClick={handleSave}>
          <SaveIcon /> Save
        </button>
        <button className="btn-cancel" onClick={onCancel}>
          <CancelIcon /> Cancel
        </button>
      </div>
    </div>
  );
};

// Timeline View - Single document format
const TimelineView: React.FC = () => {
  const { book, getSortedTimeline, reorganizeTimeline, getChapterById, updateTimelineEvent, deleteTimelineEvent } = useBookStore();
  const [viewMode, setViewMode] = useState<'narrative' | 'chronological'>('chronological');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const timelineEvents = viewMode === 'chronological' 
    ? getSortedTimeline() 
    : [...book.extracted.timeline].sort((a, b) => a.order - b.order);

  // Check for timeline issues (events out of chronological order in narrative)
  const hasTimelineIssues = book.extracted.timeline.some((event, index) => {
    if (!event.sortDate) return false;
    const nextEvent = book.extracted.timeline[index + 1];
    if (!nextEvent?.sortDate) return false;
    return new Date(event.sortDate) > new Date(nextEvent.sortDate);
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this timeline event? This cannot be undone.')) {
      deleteTimelineEvent(id);
    }
  };

  if (book.extracted.timeline.length === 0) {
    return (
      <EmptyState 
        icon="📅" 
        title="No Timeline Events"
        description="Use the 'Extract' feature in the AI Assistant panel to build a timeline from your chapters."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Story Timeline</h2>
        <p className="text-muted">{book.extracted.timeline.length} event{book.extracted.timeline.length !== 1 ? 's' : ''} tracked</p>
        
        <div className="timeline-controls">
          <div className="view-mode-toggle">
            <button 
              className={`view-mode-btn ${viewMode === 'chronological' ? 'active' : ''}`}
              onClick={() => setViewMode('chronological')}
            >
              Chronological
            </button>
            <button 
              className={`view-mode-btn ${viewMode === 'narrative' ? 'active' : ''}`}
              onClick={() => setViewMode('narrative')}
            >
              Story Order
            </button>
          </div>
          {hasTimelineIssues && (
            <div className="timeline-warning-inline">
              <WarningIcon />
              <span>Timeline has potential inconsistencies</span>
              <button 
                className="btn-small"
                onClick={() => reorganizeTimeline()}
              >
                Fix Order
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="timeline-document">
        {timelineEvents.map((event, index) => {
          const chapter = getChapterById(event.chapter);
          const isFirstOfDate = index === 0 || 
            timelineEvents[index - 1]?.date !== event.date;
          const isEditing = editingId === event.id;
          
          return (
            <div key={event.id} className="timeline-entry">
              {/* Date header for new dates */}
              {isFirstOfDate && event.date && !isEditing && (
                <div className="timeline-date-header">
                  <span className="date-text">{event.date}</span>
                  {event.dateType && event.dateType !== 'exact' && event.dateType !== 'unknown' && (
                    <span className="date-qualifier">({event.dateType})</span>
                  )}
                </div>
              )}
              
              {isEditing ? (
                <TimelineEditForm
                  event={event}
                  onSave={(updates) => {
                    updateTimelineEvent(event.id, updates);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="timeline-event-content">
                  <div className="event-marker" data-type={event.eventType}>
                    {event.eventType === 'past' ? '↩' :
                     event.eventType === 'flashback' ? '⟲' :
                     event.eventType === 'future' ? '→' : '●'}
                  </div>
                  
                  <div className="event-body">
                    <div className="entry-header">
                      <p className="event-description">{event.description}</p>
                      <div className="entry-actions">
                        <button 
                          className="btn-icon" 
                          onClick={() => setEditingId(event.id)}
                          title="Edit event"
                        >
                          <EditIcon />
                        </button>
                        <button 
                          className="btn-icon btn-danger" 
                          onClick={() => handleDelete(event.id)}
                          title="Delete event"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>
                    
                    <div className="event-meta">
                      <span className={`event-type-tag ${event.eventType}`}>
                        {event.eventType === 'past' ? 'Past Reference' :
                         event.eventType === 'flashback' ? 'Flashback' :
                         event.eventType === 'future' ? 'Future Event' : 'Present'}
                      </span>
                      <span className="event-source">
                        from {chapter?.title || event.chapterTitle || 'Unknown Chapter'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {index < timelineEvents.length - 1 && (
                <div className="timeline-connector" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Story Craft Feedback View
const StoryCraftView: React.FC = () => {
  const { book, getChapterById, updateStoryCraftChecklist, setActiveChapter, setActiveDocumentTab } = useBookStore();
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  
  const feedback = book.extracted.storyCraftFeedback || [];
  
  // Sort by chapter order
  const sortedFeedback = [...feedback].sort((a, b) => {
    const chapterA = getChapterById(a.chapterId);
    const chapterB = getChapterById(b.chapterId);
    return (chapterA?.order || 0) - (chapterB?.order || 0);
  });

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  const handleChecklistToggle = (chapterId: string, itemId: string, isCompleted: boolean) => {
    updateStoryCraftChecklist(chapterId, itemId, isCompleted);
  };

  const navigateToChapter = (chapterId: string) => {
    setActiveDocumentTab(null);
    setActiveChapter(chapterId);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'var(--accent-success)';
    if (score >= 3) return 'var(--accent-warning)';
    return 'var(--accent-error)';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 5) return 'Excellent';
    if (score >= 4) return 'Good';
    if (score >= 3) return 'Fair';
    if (score >= 2) return 'Needs Work';
    return 'Poor';
  };

  if (sortedFeedback.length === 0) {
    return (
      <EmptyState 
        icon="🎭" 
        title="No Story Craft Feedback"
        description="Use 'Process All Chapters' in the AI Assistant panel to generate story craft assessments and improvement checklists."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Story Craft Feedback</h2>
        <p className="text-muted">{sortedFeedback.length} chapter{sortedFeedback.length !== 1 ? 's' : ''} assessed</p>
      </div>
      
      <div className="storycraft-document">
        {sortedFeedback.map((item, index) => {
          const chapter = getChapterById(item.chapterId);
          const isExpanded = expandedChapters.has(item.chapterId);
          const completedCount = item.checklist.filter(c => c.isCompleted).length;
          const totalCount = item.checklist.length;
          const assessmentScores = item.assessment;
          const avgScore = assessmentScores 
            ? (assessmentScores.plotProgression.score + 
               assessmentScores.characterDevelopment.score + 
               assessmentScores.themeReinforcement.score + 
               assessmentScores.pacing.score + 
               assessmentScores.conflictTension.score + 
               assessmentScores.hookEnding.score) / 6
            : 0;
          
          return (
            <div key={item.chapterId} className="storycraft-chapter-section">
              {/* Chapter Header - Always visible */}
              <div 
                className="storycraft-chapter-header"
                onClick={() => toggleChapter(item.chapterId)}
              >
                <div className="storycraft-header-left">
                  <ChevronIcon expanded={isExpanded} />
                  <h3 className="storycraft-chapter-title">
                    {chapter?.title || item.chapterTitle || 'Unknown Chapter'}
                  </h3>
                </div>
                <div className="storycraft-header-right">
                  <span 
                    className="storycraft-score-badge"
                    style={{ backgroundColor: getScoreColor(avgScore) }}
                  >
                    {avgScore.toFixed(1)} - {getScoreLabel(avgScore)}
                  </span>
                  <span className="storycraft-checklist-count">
                    {completedCount}/{totalCount} tasks
                  </span>
                </div>
              </div>
              
              {/* Expanded Content */}
              {isExpanded && (
                <div className="storycraft-chapter-content">
                  {/* Assessment Scores */}
                  {assessmentScores && (
                    <div className="storycraft-assessment">
                      <h4>Assessment</h4>
                      <div className="assessment-grid">
                        {[
                          { label: 'Plot Progression', data: assessmentScores.plotProgression },
                          { label: 'Character Development', data: assessmentScores.characterDevelopment },
                          { label: 'Theme Reinforcement', data: assessmentScores.themeReinforcement },
                          { label: 'Pacing', data: assessmentScores.pacing },
                          { label: 'Conflict/Tension', data: assessmentScores.conflictTension },
                          { label: 'Hook/Ending', data: assessmentScores.hookEnding },
                        ].map(({ label, data }) => (
                          <div key={label} className="assessment-item">
                            <div className="assessment-header">
                              <span className="assessment-label">{label}</span>
                              <span 
                                className="assessment-score"
                                style={{ color: getScoreColor(data.score) }}
                              >
                                {data.score}/5
                              </span>
                            </div>
                            <div className="assessment-bar">
                              <div 
                                className="assessment-bar-fill"
                                style={{ 
                                  width: `${(data.score / 5) * 100}%`,
                                  backgroundColor: getScoreColor(data.score)
                                }}
                              />
                            </div>
                            {data.notes && (
                              <p className="assessment-notes">{data.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {assessmentScores.overallNotes && (
                        <div className="assessment-overall">
                          <h5>Overall Notes</h5>
                          <p>{assessmentScores.overallNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Checklist */}
                  {item.checklist.length > 0 && (
                    <div className="storycraft-checklist">
                      <h4>Improvement Checklist</h4>
                      <div className="checklist-items">
                        {item.checklist.map((checkItem) => (
                          <label 
                            key={checkItem.id} 
                            className={`checklist-item ${checkItem.isCompleted ? 'completed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checkItem.isCompleted}
                              onChange={(e) => handleChecklistToggle(item.chapterId, checkItem.id, e.target.checked)}
                            />
                            <span className="checklist-category">[{checkItem.category}]</span>
                            <span className="checklist-text">{checkItem.suggestion}</span>
                            {checkItem.isCompleted && checkItem.completedAt && (
                              <span className="checklist-completed-date">
                                ✓ {new Date(checkItem.completedAt).toLocaleDateString()}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className="btn-navigate-chapter"
                    onClick={() => navigateToChapter(item.chapterId)}
                  >
                    Go to Chapter →
                  </button>
                </div>
              )}
              
              {index < sortedFeedback.length - 1 && <hr className="storycraft-divider" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Themes and Motifs View
const ThemesView: React.FC = () => {
  const { book, getChapterById, setActiveChapter, setActiveDocumentTab } = useBookStore();
  const themesData = book.extracted.themesAndMotifs || { themes: [], motifs: [], symbols: [], lastUpdated: '' };
  
  const navigateToChapter = (chapterId: string) => {
    setActiveDocumentTab(null);
    setActiveChapter(chapterId);
  };

  const isEmpty = themesData.themes.length === 0 && 
                  themesData.motifs.length === 0 && 
                  themesData.symbols.length === 0;

  if (isEmpty) {
    return (
      <EmptyState 
        icon="🎨" 
        title="No Themes & Motifs"
        description="Use 'Process All Chapters' in the AI Assistant panel to extract themes, motifs, and symbols from your story."
      />
    );
  }

  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>Themes & Motifs</h2>
        <p className="text-muted">
          {themesData.themes.length} theme{themesData.themes.length !== 1 ? 's' : ''}, 
          {' '}{themesData.motifs.length} motif{themesData.motifs.length !== 1 ? 's' : ''}, 
          {' '}{themesData.symbols.length} symbol{themesData.symbols.length !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="themes-document">
        {/* Themes Section */}
        {themesData.themes.length > 0 && (
          <div className="themes-section">
            <h3 className="themes-section-title">📚 Themes</h3>
            
            {/* Major Themes */}
            {themesData.themes.filter(t => t.type === 'major').length > 0 && (
              <div className="theme-group">
                <h4 className="theme-group-title">Major Themes</h4>
                {themesData.themes.filter(t => t.type === 'major').map((theme) => (
                  <div key={theme.id} className="theme-entry">
                    <h5 className="theme-name">{theme.name}</h5>
                    <p className="theme-description">{theme.description}</p>
                    {theme.evolutionNotes && (
                      <div className="theme-evolution">
                        <span className="label">Evolution:</span>
                        <p>{theme.evolutionNotes}</p>
                      </div>
                    )}
                    {theme.chapterAppearances.length > 0 && (
                      <div className="theme-appearances">
                        <span className="label">Appears in:</span>
                        <div className="appearance-list">
                          {theme.chapterAppearances.map((app, idx) => (
                            <div key={idx} className="appearance-item">
                              <button 
                                className="chapter-link"
                                onClick={() => navigateToChapter(app.chapterId)}
                              >
                                {app.chapterTitle}
                              </button>
                              {app.manifestation && (
                                <span className="manifestation">— {app.manifestation}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {/* Minor Themes */}
            {themesData.themes.filter(t => t.type === 'minor').length > 0 && (
              <div className="theme-group">
                <h4 className="theme-group-title">Minor Themes</h4>
                {themesData.themes.filter(t => t.type === 'minor').map((theme) => (
                  <div key={theme.id} className="theme-entry minor">
                    <h5 className="theme-name">{theme.name}</h5>
                    <p className="theme-description">{theme.description}</p>
                    {theme.chapterAppearances.length > 0 && (
                      <div className="theme-appearances compact">
                        <span className="label">Chapters:</span>
                        {theme.chapterAppearances.map((app, idx) => (
                          <button 
                            key={idx}
                            className="chapter-tag-link"
                            onClick={() => navigateToChapter(app.chapterId)}
                          >
                            {app.chapterTitle}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Motifs Section */}
        {themesData.motifs.length > 0 && (
          <div className="themes-section">
            <h3 className="themes-section-title">🔄 Recurring Motifs</h3>
            {themesData.motifs.map((motif) => (
              <div key={motif.id} className="motif-entry">
                <h5 className="motif-name">{motif.name}</h5>
                <p className="motif-description">{motif.description}</p>
                {motif.chapterAppearances.length > 0 && (
                  <div className="motif-appearances">
                    <span className="label">Occurrences:</span>
                    <div className="appearance-list">
                      {motif.chapterAppearances.map((app, idx) => (
                        <div key={idx} className="appearance-item">
                          <button 
                            className="chapter-link"
                            onClick={() => navigateToChapter(app.chapterId)}
                          >
                            {app.chapterTitle}
                          </button>
                          {app.context && (
                            <span className="context">— "{app.context}"</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Symbols Section */}
        {themesData.symbols.length > 0 && (
          <div className="themes-section">
            <h3 className="themes-section-title">✨ Symbols</h3>
            {themesData.symbols.map((symbol) => (
              <div key={symbol.id} className="symbol-entry">
                <h5 className="symbol-name">{symbol.name}</h5>
                <div className="symbol-meaning">
                  <span className="label">Meaning:</span> {symbol.meaning}
                </div>
                {symbol.chapterAppearances.length > 0 && (
                  <div className="symbol-appearances">
                    <span className="label">Appears in:</span>
                    <div className="chapter-tags">
                      {symbol.chapterAppearances.map((app, idx) => (
                        <button 
                          key={idx}
                          className="chapter-tag-link"
                          onClick={() => navigateToChapter(app.chapterId)}
                          title={app.context}
                        >
                          {app.chapterTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {themesData.lastUpdated && (
          <div className="themes-footer">
            <span className="text-muted">
              Last updated: {new Date(themesData.lastUpdated).toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom Tab View (editable content)
const CustomTabView: React.FC<{ tab: DocumentTab }> = ({ tab }) => {
  const { updateDocumentTabContent } = useBookStore();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea to fit content
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  };

  React.useEffect(() => {
    autoResize();
  }, []);
  
  return (
    <div className="tab-viewer">
      <div className="tab-viewer-header">
        <h2>{tab.title}</h2>
        <p className="text-muted">Custom document tab</p>
      </div>
      <div className="tab-viewer-content custom-tab-content">
        <textarea
          ref={textareaRef}
          className="custom-tab-editor"
          placeholder="Add your notes here..."
          defaultValue={extractTextFromContent(tab.content)}
          onChange={(e) => {
            autoResize();
            // Convert text back to TipTap content
            updateDocumentTabContent(tab.id, {
              type: 'doc',
              content: e.target.value.split('\n').map(line => ({
                type: 'paragraph',
                content: line ? [{ type: 'text', text: line }] : [],
              })),
            });
          }}
        />
      </div>
    </div>
  );
};

// Empty State Component
const EmptyState: React.FC<{ icon: string; title: string; description: string }> = ({ 
  icon, title, description 
}) => (
  <div className="tab-viewer-empty">
    <span className="empty-icon">{icon}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

// Helper to extract text from TipTap content
function extractTextFromContent(content: any): string {
  if (!content?.content) return '';
  
  return content.content
    .map((node: any) => {
      if (node.text) return node.text;
      if (node.content) return extractTextFromContent(node);
      return '';
    })
    .join('\n');
}

