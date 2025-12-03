import React from 'react';
import { useAnalysisStore } from '../../stores/analysisStore';
import './Sidebar.css';

const PlotPanel: React.FC = () => {
  const { plotHoles } = useAnalysisStore();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#cc0000';
      case 'major':
        return '#ff9900';
      case 'minor':
        return '#0066cc';
      default:
        return '#666';
    }
  };

  return (
    <div className="plot-panel">
      <div className="panel-header">
        <h3>Plot Analysis</h3>
      </div>
      <div className="panel-content">
        {plotHoles.length === 0 ? (
          <div className="empty-state">No plot holes detected</div>
        ) : (
          plotHoles.map((hole, idx) => (
            <div key={idx} className="plot-hole-item">
              <div className="plot-hole-header">
                <span
                  className="plot-hole-severity"
                  style={{ color: getSeverityColor(hole.severity) }}
                >
                  {hole.severity.toUpperCase()}
                </span>
                <span className="plot-hole-type">{hole.type}</span>
              </div>
              <div className="plot-hole-description">{hole.description}</div>
              {hole.location && (
                <div className="plot-hole-location">Location: {hole.location}</div>
              )}
              {hole.suggestion && (
                <div className="plot-hole-suggestion">
                  <strong>Suggestion:</strong> {hole.suggestion}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlotPanel;

