import React, { useRef } from 'react';

interface ProxyWebViewProps {
  url: string;
  onBackToHome: () => void;
}

export const ProxyWebView: React.FC<ProxyWebViewProps> = ({ url }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const proxyUrl = `/api/proxy/view?url=${encodeURIComponent(url)}`;

  return (
    <div className="webview-wrapper" style={{ display: 'flex', flex: 1, width: '100%', height: '100%', background: '#fff', position: 'relative', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={proxyUrl}
        title={`Browser view for ${url}`}
        className="webview-container"
        allow="clipboard-read; clipboard-write; fullscreen; autoplay; camera; microphone"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          margin: 0,
          padding: 0,
        }}
      />
    </div>
  );
};
