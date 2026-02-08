import React, { useState, useEffect } from 'react';
import { useBookStore } from '../stores/bookStore';
import { audioQueueService, AudioQueueItem } from '../services/audioQueueService';

// Spinner Icon
const SpinnerIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    width="16" 
    height="16"
    className="spinner-icon"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

// Audio Icon
const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </svg>
);

// Queue Icon
const QueueIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

// Check Icon
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Close/X Icon
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export const BackgroundTaskIndicator: React.FC = () => {
  const { backgroundTasks } = useBookStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  
  // Subscribe to audio queue
  useEffect(() => {
    const unsubscribe = audioQueueService.subscribe(setAudioQueue);
    return unsubscribe;
  }, []);
  
  // Filter to only show active tasks
  const activeTasks = backgroundTasks.filter(
    task => task.status === 'pending' || task.status === 'processing'
  );
  
  // Get queued and processing audio items
  const activeAudioItems = audioQueue.filter(
    item => item.status === 'queued' || item.status === 'processing'
  );
  
  const totalActive = activeAudioItems.length;
  
  if (totalActive === 0) return null;
  
  const processingItems = audioQueue.filter(item => item.status === 'processing');
  const queuedItems = audioQueue.filter(item => item.status === 'queued');

  return (
    <div className="background-task-indicator">
      <button 
        className="background-task-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`${totalActive} audio task${totalActive > 1 ? 's' : ''} (${processingItems.length} processing, ${queuedItems.length} waiting)`}
      >
        <SpinnerIcon />
        <span className="task-count">{totalActive}</span>
      </button>
      
      {showDropdown && (
        <>
          <div 
            className="background-task-overlay" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="background-task-dropdown">
            <div className="background-task-dropdown-header">
              <span>Audio Queue</span>
              {(processingItems.length > 0 || queuedItems.length > 0) && (
                <span className="queue-count">
                  {processingItems.length > 0 && `${processingItems.length} processing`}
                  {processingItems.length > 0 && queuedItems.length > 0 && ' · '}
                  {queuedItems.length > 0 && `${queuedItems.length} waiting`}
                </span>
              )}
            </div>
            <div className="background-task-list">
              {/* All currently processing (up to 5 in parallel) */}
              {processingItems.map((item) => (
                <div key={item.id} className="background-task-item processing">
                  <div className="background-task-icon">
                    <AudioIcon />
                  </div>
                  <div className="background-task-info">
                    <div className="background-task-title">{item.chapterTitle}</div>
                    <div className="background-task-progress">
                      <div 
                        className="background-task-progress-bar"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <div className="background-task-status">
                      {item.progress}% complete
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Queued items */}
              {queuedItems.map((item, index) => (
                <div key={item.id} className="background-task-item queued">
                  <div className="background-task-icon">
                    <QueueIcon />
                  </div>
                  <div className="background-task-info">
                    <div className="background-task-title">{item.chapterTitle}</div>
                    <div className="background-task-status queued-status">
                      #{index + 1} in queue
                    </div>
                  </div>
                  <button 
                    className="background-task-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      audioQueueService.removeFromQueue(item.id);
                    }}
                    title="Remove from queue"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
              
              {/* Empty state */}
              {totalActive === 0 && (
                <div className="background-task-empty">
                  No audio tasks in progress
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
