import React from 'react';

interface BlockedPageProps {
  url: string;
  reason?: string;
  onBackToHome: () => void;
  onOpenManager: () => void;
}

export const BlockedPage: React.FC<BlockedPageProps> = ({
  url,
  reason,
  onBackToHome,
  onOpenManager,
}) => {
  return (
    <div id="blockedScreen" className="blocked-screen">
      <div className="blocked-card">
        <div className="blocked-icon">⛔</div>
        <h2>Website blocked</h2>
        <p id="blockedMessage">
          {reason || 'This website is not on the study allowlist.'}
        </p>
        {url && (
          <div
            style={{
              background: '#10233a',
              color: '#e6edf7',
              padding: '8px 16px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '13px',
              display: 'inline-block',
              marginBottom: '20px',
              wordBreak: 'break-all',
            }}
          >
            {url}
          </div>
        )}
        <div className="blocked-actions">
          <button id="backToHome" className="primary" onClick={onBackToHome}>
            Back to study home
          </button>
          <button id="openManagerFromBlocked" className="secondary" onClick={onOpenManager}>
            Manage allowlist
          </button>
        </div>
      </div>
    </div>
  );
};
