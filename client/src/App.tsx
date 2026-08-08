import React, { useState, useEffect, useCallback } from 'react';
import { User, AllowedSite } from './types';
import { authService, allowlistService, studyService } from './services/api';
import { BrowserToolbar } from './components/BrowserToolbar';
import { Sidebar } from './components/Sidebar';
import { HomeScreen } from './components/HomeScreen';
import { ProxyWebView } from './components/ProxyWebView';
import { BlockedPage } from './components/BlockedPage';
import { AllowlistModal } from './components/AllowlistModal';
import { AuthModal } from './components/AuthModal';
import { StudyStatsModal } from './components/StudyStatsModal';

export const App: React.FC = () => {
  // Global State
  const [user, setUser] = useState<User | null>(null);
  const [allowedSites, setAllowedSites] = useState<AllowedSite[]>([]);
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(false);

  // Navigation / Browser State
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [status, setStatus] = useState<'Ready' | 'Allowed' | 'Blocked' | 'Focus Mode'>('Ready');
  const [blockedReason, setBlockedReason] = useState<string>('');

  // Modals
  const [showAllowlistModal, setShowAllowlistModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);

  // Load user profile & allowlist on startup
  const loadUserData = useCallback(async () => {
    try {
      const u = await authService.getMe();
      setUser(u);
      const sites = await allowlistService.getSites();
      setAllowedSites(sites);
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Navigate function
  const navigate = async (urlInput: string) => {
    let target = urlInput.trim();
    if (!target) return;

    if (!target.includes('://')) {
      target = 'https://' + target;
    }

    try {
      const check = await studyService.checkUrl(target);
      setCurrentUrl(check.targetUrl);
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), check.targetUrl]);
      setHistoryIndex((prev) => prev + 1);

      if (check.allowed) {
        setStatus('Allowed');
        setBlockedReason('');
      } else {
        setStatus('Blocked');
        setBlockedReason(check.reason || 'This website is not on your study allowlist.');
      }
    } catch (err: any) {
      console.error('Navigation check failed:', err);
      setCurrentUrl(target);
      setStatus('Blocked');
      setBlockedReason('Error checking URL allowlist policy.');
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevUrl = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCurrentUrl(prevUrl);
      studyService.checkUrl(prevUrl).then((check) => {
        setStatus(check.allowed ? 'Allowed' : 'Blocked');
        setBlockedReason(check.reason || '');
      }).catch(() => {
        setStatus('Allowed');
      });
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextUrl = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCurrentUrl(nextUrl);
      studyService.checkUrl(nextUrl).then((check) => {
        setStatus(check.allowed ? 'Allowed' : 'Blocked');
        setBlockedReason(check.reason || '');
      }).catch(() => {
        setStatus('Allowed');
      });
    }
  };

  const handleReload = () => {
    if (currentUrl) {
      navigate(currentUrl);
    }
  };

  const handleHome = () => {
    setCurrentUrl('');
    setStatus('Ready');
  };

  return (
    <div className={`shell ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
      <Sidebar
        allowedSites={allowedSites}
        onOpenManager={() => setShowAllowlistModal(true)}
        onNavigate={navigate}
      />

      <main className="browser">
        <BrowserToolbar
          currentUrl={currentUrl}
          onNavigate={navigate}
          onBack={handleBack}
          onForward={handleForward}
          onReload={handleReload}
          onHome={handleHome}
          onToggleSidebar={() => setSidebarHidden(!sidebarHidden)}
          status={status}
          user={user}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenStats={() => setShowStatsModal(true)}
        />

        <div id="contentArea" className="content-area">
          {!currentUrl ? (
            <HomeScreen
              allowedSites={allowedSites}
              onNavigate={navigate}
              onOpenManager={() => setShowAllowlistModal(true)}
            />
          ) : status === 'Blocked' ? (
            <BlockedPage
              url={currentUrl}
              reason={blockedReason}
              onBackToHome={handleHome}
              onOpenManager={() => setShowAllowlistModal(true)}
            />
          ) : (
            <ProxyWebView url={currentUrl} onBackToHome={handleHome} />
          )}
        </div>
      </main>

      <AllowlistModal
        isOpen={showAllowlistModal}
        onClose={() => setShowAllowlistModal(false)}
        allowedSites={allowedSites}
        onSitesUpdated={(sites) => setAllowedSites(sites)}
        user={user}
        onUserUpdated={(u) => setUser(u)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={user}
        onUserChanged={(u) => {
          setUser(u);
          allowlistService.getSites().then(setAllowedSites).catch(console.error);
        }}
      />

      <StudyStatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
      />
    </div>
  );
};

export default App;
