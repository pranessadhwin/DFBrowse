import React, { useRef } from 'react';

interface ProxyWebViewProps {
  url: string;
  onBackToHome: () => void;
}

export const ProxyWebView: React.FC<ProxyWebViewProps> = ({ url, onBackToHome }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const proxyUrl = `/api/proxy/view?url=${encodeURIComponent(url)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', background: '#fff' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: '#0e1d31',
          borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
          color: '#e6edf7',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>●</span>
          <span>
            Focused Study Mode: <strong>{url}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="tiny" onClick={handleReload}>
            ↻ Reload
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#10233a',
              color: '#dbeafe',
              border: '1px solid rgba(148, 163, 184, 0.22)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ↗ Open Direct Tab
          </a>
          <button className="tiny" onClick={onBackToHome}>
            ⌂ Back to Home
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={proxyUrl}
        title={`Study view for ${url}`}
        className="webview-container"
        style={{ flex: 1, width: '100%', border: 'none' }}
      />
    </div>
  );
};
