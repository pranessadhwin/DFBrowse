import React, { useState } from 'react';
import { User } from '../types';

interface BrowserToolbarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onHome: () => void;
  onToggleSidebar: () => void;
  status: 'Ready' | 'Allowed' | 'Blocked' | 'Focus Mode';
  user: User | null;
  onOpenAuth: () => void;
  onOpenStats: () => void;
}

export const BrowserToolbar: React.FC<BrowserToolbarProps> = ({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onHome,
  onToggleSidebar,
  status,
  user,
  onOpenAuth,
  onOpenStats,
}) => {
  const [inputValue, setInputValue] = useState(currentUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onNavigate(inputValue.trim());
    }
  };

  React.useEffect(() => {
    setInputValue(currentUrl);
  }, [currentUrl]);

  const getStatusClass = () => {
    if (status === 'Allowed') return 'status-pill allowed';
    if (status === 'Blocked') return 'status-pill blocked';
    return 'status-pill';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="toolbar" aria-label="Browser toolbar">
      <button
        id="sidebarToggle"
        className="nav-btn sidebar-toggle"
        title="Toggle sidebar"
        onClick={onToggleSidebar}
      >
        ☰
      </button>
      <button id="backBtn" className="nav-btn" title="Back" onClick={onBack}>
        ←
      </button>
      <button id="forwardBtn" className="nav-btn" title="Forward" onClick={onForward}>
        →
      </button>
      <button id="reloadBtn" className="nav-btn" title="Reload" onClick={onReload}>
        ↻
      </button>
      <button id="homeBtn" className="nav-btn" title="Home" onClick={onHome}>
        ⌂
      </button>
      <form id="addressForm" className="address-form" onSubmit={handleSubmit}>
        <input
          id="addressInput"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter an allowed study URL (e.g., leetcode.com, claude.ai, github.com)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button className="go-btn" type="submit">
          Go
        </button>
      </form>
      <div id="statusPill" className={getStatusClass()}>
        {status}
      </div>
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="secondary tiny"
          style={{
            marginLeft: '4px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            color: '#fff',
            background: '#2563eb',
            borderColor: '#57a6ff',
          }}
          title={`Open official ${currentUrl} in browser tab`}
        >
          ↗ Open Official Tab
        </a>
      )}
      <button
        className="secondary tiny"
        style={{ marginLeft: '4px' }}
        onClick={onOpenStats}
        title="View PostgreSQL study logs & sessions"
      >
        📊 Study Logs
      </button>
      <div className="user-badge" onClick={onOpenAuth} title="User account">
        <div className="user-avatar">
          {user ? getInitials(user.name) : '??'}
        </div>
        <span>{user ? user.name : 'Guest'}</span>
      </div>
    </nav>
  );
};
