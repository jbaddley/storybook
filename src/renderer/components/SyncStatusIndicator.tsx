import React from 'react';
import { useBookStore } from '../stores/bookStore';

export const SyncStatusIndicator: React.FC = () => {
  const { ui, clearSyncStatus } = useBookStore();
  const { syncStatus } = ui;

  // Don't show anything if there's no sync activity
  if (!syncStatus.isSyncing && !syncStatus.success && !syncStatus.error) {
    return null;
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        marginRight: '8px',
        background: syncStatus.error 
          ? 'rgba(243, 139, 168, 0.2)' 
          : syncStatus.success 
            ? 'rgba(166, 227, 161, 0.2)'
            : 'rgba(137, 180, 250, 0.2)',
        color: syncStatus.error 
          ? '#f38ba8' 
          : syncStatus.success 
            ? '#a6e3a1'
            : '#89b4fa',
        border: `1px solid ${syncStatus.error 
          ? 'rgba(243, 139, 168, 0.3)' 
          : syncStatus.success 
            ? 'rgba(166, 227, 161, 0.3)'
            : 'rgba(137, 180, 250, 0.3)'}`,
        cursor: (syncStatus.success || syncStatus.error) ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (syncStatus.success || syncStatus.error) {
          clearSyncStatus();
        }
      }}
      title={syncStatus.success || syncStatus.error ? 'Click to dismiss' : undefined}
    >
      {/* Sync Icon */}
      {syncStatus.isSyncing && (
        <svg 
          viewBox="0 0 24 24" 
          width="14" 
          height="14" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ 
            animation: 'spin 1s linear infinite',
          }}
        >
          <path d="M21.5 2v6h-6"/>
          <path d="M2.5 22v-6h6"/>
          <path d="M2 11.5a10 10 0 0 1 18.8-4.3"/>
          <path d="M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
      )}
      
      {/* Success Icon */}
      {syncStatus.success && !syncStatus.isSyncing && (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      
      {/* Error Icon */}
      {syncStatus.error && !syncStatus.isSyncing && (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      )}

      {/* Status Text */}
      <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {syncStatus.isSyncing && (
          <>
            {syncStatus.direction === 'push' ? '⬆️' : '⬇️'} {syncStatus.progress || 'Syncing...'}
          </>
        )}
        {syncStatus.success && !syncStatus.isSyncing && syncStatus.success}
        {syncStatus.error && !syncStatus.isSyncing && `Error: ${syncStatus.error}`}
      </span>

      {/* Close button for success/error */}
      {(syncStatus.success || syncStatus.error) && !syncStatus.isSyncing && (
        <svg 
          viewBox="0 0 24 24" 
          width="12" 
          height="12" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          style={{ opacity: 0.7, marginLeft: '4px' }}
        >
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      )}

      {/* Add keyframes for spin animation via style tag */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

