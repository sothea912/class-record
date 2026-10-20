import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Global error handlers to prevent blank screen if unhandled error occurs before React mounts
window.addEventListener('error', event => {
  console.error('[Global Error Caught]:', event.error || event.message);
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-center;padding:24px;font-family:system-ui,sans-serif;background:#fff1f2;color:#9f1239;">
        <div style="max-width:600px;width:100%;background:white;padding:24px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1);border:1px solid #fecdd3;">
          <h2 style="margin:0 0 8px 0;font-size:18px;font-weight:800;color:#e11d48;">Application Startup Error</h2>
          <p style="margin:0 0 16px 0;font-size:13px;color:#475569;">The application encountered an error while initializing:</p>
          <pre style="background:#f8fafc;padding:12px;border-radius:8px;font-size:12px;overflow:auto;color:#0f172a;border:1px solid #e2e8f0;white-space:pre-wrap;">${event.error?.stack || event.message || 'Unknown error'}</pre>
          <button onclick="window.location.reload()" style="margin-top:16px;padding:8px 16px;background:#e11d48;color:white;border:none;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">Reload Application</button>
        </div>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary viewName="Central Academy Application">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

