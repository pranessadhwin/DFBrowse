import React, { useRef, useEffect, useState } from 'react';

interface ProxyWebViewProps {
  url: string;
  onBackToHome: () => void;
}

export const ProxyWebView: React.FC<ProxyWebViewProps> = ({ url }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect if running inside Electron Chromium environment
    if (
      typeof window !== 'undefined' &&
      (window.navigator.userAgent.includes('Electron') || (window as any).studyBrowser !== undefined)
    ) {
      setIsElectron(true);
    } else {
      setIsElectron(false);
    }
  }, []);

  const proxyUrl = `/api/proxy/view?url=${encodeURIComponent(url)}`;

  return (
    <div
      className="webview-wrapper"
      style={{
        display: 'flex',
        flex: 1,
        width: '100%',
        height: '100%',
        background: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isElectron ? (
        // Electron Native Chromium Webview Mode — loads official websites natively without iframe restrictions
        // @ts-ignore - webview is a Chromium custom element in Electron
        <webview
          src={url}
          partition="persist:study"
          allowpopups={true}
          useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      ) : (
        // Web Application Proxy Mode — streams official website HTML via Express reverse-proxy
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
      )}
    </div>
  );
};
