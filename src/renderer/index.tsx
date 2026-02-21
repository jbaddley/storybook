import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

/** Catches render errors so we don't stay stuck on "Loading..." */
class RenderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          margin: 0,
          minHeight: '100%',
          background: '#1e1e2e',
          color: '#cdd6f4',
          fontFamily: 'monospace',
          fontSize: 14,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <strong style={{ color: '#f38ba8' }}>Something went wrong</strong>
          <pre style={{ marginTop: 12 }}>{this.state.error.message}</pre>
          <pre style={{ marginTop: 8, color: '#a6adc8', fontSize: 12 }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(container);
try {
  root.render(
    <React.StrictMode>
      <RenderErrorBoundary>
        <App />
      </RenderErrorBoundary>
    </React.StrictMode>
  );
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : '';
  container.innerHTML = `
    <div style="padding:24px;margin:0;min-height:100%;background:#1e1e2e;color:#cdd6f4;font-family:monospace;font-size:14px;white-space:pre-wrap;">
      <strong style="color:#f38ba8">Startup error</strong>
      <pre style="margin-top:12px">${msg}</pre>
      <pre style="margin-top:8px;color:#a6adc8;font-size:12px">${stack}</pre>
    </div>
  `;
  console.error('Startup error:', err);
}

