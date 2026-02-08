import React, { useCallback, useState } from 'react';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export interface ResizablePanelProps {
  side: 'left' | 'right';
  title: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  onClose: () => void;
  onResize: (width: number) => void;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  side,
  title,
  width,
  minWidth,
  maxWidth,
  onClose,
  onResize,
  children,
  headerActions,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(width);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      setStartX(e.clientX);
      setStartWidth(width);
    },
    [width]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      onResize(newWidth);
    },
    [isDragging, startX, startWidth, side, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const resizeHandle = (
    <div
      className={`resizable-panel-handle resizable-panel-handle-${side} ${isDragging ? 'resizing' : ''}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    />
  );

  return (
    <aside
      className={`panel panel-${side} resizable-panel`}
      style={{ width: `${width}px` }}
    >
      {side === 'right' && resizeHandle}
      <div className="resizable-panel-inner">
        <div className="panel-header resizable-panel-header">
          <span className="resizable-panel-title">{title}</span>
          <div className="resizable-panel-header-actions">
            {headerActions}
            <button
              type="button"
              className="resizable-panel-close"
              onClick={onClose}
              title="Close panel"
              aria-label="Close panel"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="panel-content">{children}</div>
      </div>
      {side === 'left' && resizeHandle}
    </aside>
  );
};
