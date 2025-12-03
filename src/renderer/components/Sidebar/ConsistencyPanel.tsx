import React from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import './Sidebar.css';

const ConsistencyPanel: React.FC = () => {
  const { consistencyIssues } = useAnalysisStore();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return '#cc0000';
      case 'warning':
        return '#ff9900';
      case 'info':
        return '#0066cc';
      default:
        return '#666';
    }
  };

  return (
    <div className="consistency-panel">
      <div className="panel-header">
        <h3>Consistency Issues</h3>
      </div>
      <div className="panel-content">
        {consistencyIssues.length === 0 ? (
          <div className="empty-state">No consistency issues found</div>
        ) : (
          consistencyIssues.map((issue, idx) => (
            <div key={idx} className="issue-item">
              <div className="issue-header">
                <span
                  className="issue-severity"
                  style={{ color: getSeverityColor(issue.severity) }}
                >
                  {issue.severity.toUpperCase()}
                </span>
                <span className="issue-type">{issue.type}</span>
              </div>
              <div className="issue-message">{issue.message}</div>
              {issue.location && (
                <div className="issue-location">Location: {issue.location}</div>
              )}
              {issue.suggestion && (
                <div className="issue-suggestion">
                  <strong>Suggestion:</strong> {issue.suggestion}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsistencyPanel;

