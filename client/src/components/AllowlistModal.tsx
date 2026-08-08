import React, { useState, useEffect } from 'react';
import { AllowedSite, User } from '../types';
import { allowlistService, authService } from '../services/api';

interface AllowlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowedSites: AllowedSite[];
  onSitesUpdated: (sites: AllowedSite[]) => void;
  user: User | null;
  onUserUpdated: (user: User) => void;
}

export const AllowlistModal: React.FC<AllowlistModalProps> = ({
  isOpen,
  onClose,
  allowedSites,
  onSitesUpdated,
  user,
  onUserUpdated,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockToken, setUnlockToken] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Setup / Change Feature Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setErrorMsg('');
      setSuccessMsg('');
      if (!user.hasFeaturePassword) {
        // No feature password set, unlock immediately
        authService.verifyFeaturePassword().then((res) => {
          setIsUnlocked(true);
          setUnlockToken(res.unlockToken || '');
        }).catch(() => {
          setIsUnlocked(true);
        });
      } else {
        // Check if session has stored valid token
        const stored = sessionStorage.getItem('dfbrowse_unlock_token');
        if (stored) {
          setIsUnlocked(true);
          setUnlockToken(stored);
        } else {
          setIsUnlocked(false);
        }
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await authService.verifyFeaturePassword(passwordInput);
      setIsUnlocked(true);
      setUnlockToken(res.unlockToken || '');
      setPasswordInput('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Incorrect feature password.');
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!siteInput.trim()) return;

    try {
      const res = await allowlistService.addSite(siteInput.trim(), unlockToken);
      onSitesUpdated(res.sites);
      setSiteInput('');
      setSuccessMsg(`Added ${res.site.hostname} to allowlist.`);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to add site.');
    }
  };

  const handleDeleteSite = async (id: string, hostname: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await allowlistService.deleteSite(id, unlockToken);
      onSitesUpdated(res.sites);
      setSuccessMsg(`Removed ${hostname} from allowlist.`);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to remove site.');
    }
  };

  const handleResetSites = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await allowlistService.resetSites(unlockToken);
      onSitesUpdated(res.sites);
      setSuccessMsg('Reset allowlist to default study sites.');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset allowlist.');
    }
  };

  const handleSetFeaturePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 4) {
      setErrorMsg('Feature password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    try {
      await authService.setFeaturePassword(
        user?.hasFeaturePassword ? currentPassword : undefined,
        newPassword
      );
      setSuccessMsg('Feature password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowChangePassword(false);
      if (user) {
        onUserUpdated({ ...user, hasFeaturePassword: true });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to update feature password.');
    }
  };

  const handleLockManager = () => {
    sessionStorage.removeItem('dfbrowse_unlock_token');
    setIsUnlocked(false);
    setUnlockToken('');
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 id="modalTitle">Manage allowed websites</h2>
            <p id="modalSubtitle">
              {user?.hasFeaturePassword
                ? 'Unlock with the feature password to edit the study list.'
                : 'Configure your study allowlist policies.'}
            </p>
          </div>
          <button id="closeModal" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {!isUnlocked && user?.hasFeaturePassword ? (
          <form className="modal-section" onSubmit={handleUnlock}>
            <label htmlFor="passwordInput">Feature password</label>
            <input
              id="passwordInput"
              type="password"
              placeholder="Enter feature password (default demo: 4321)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            <button id="unlockButton" type="submit" className="primary full">
              Unlock site manager
            </button>
          </form>
        ) : (
          <div className="modal-section">
            <form className="add-row" onSubmit={handleAddSite}>
              <input
                id="siteInput"
                type="text"
                placeholder="example.com"
                value={siteInput}
                onChange={(e) => setSiteInput(e.target.value)}
              />
              <button id="addSite" type="submit" className="primary">
                Add
              </button>
            </form>
            <p className="hint">
              Subdomains are allowed automatically. Example: allowing github.com also allows gist.github.com.
            </p>

            <div className="manager-list">
              {allowedSites.map((site) => (
                <div key={site.id} className="manager-item">
                  <span>{site.hostname}</span>
                  <div className="manager-item-actions">
                    {site.is_default && (
                      <span
                        style={{
                          fontSize: '10px',
                          background: 'rgba(87,166,255,0.2)',
                          color: 'var(--blue)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        Default
                      </span>
                    )}
                    <button
                      className="tiny danger-text"
                      onClick={() => handleDeleteSite(site.id, site.hostname)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {allowedSites.length === 0 && (
                <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
                  No sites on allowlist.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button className="secondary tiny" style={{ flex: 1 }} onClick={handleResetSites}>
                ↻ Reset to default study sites
              </button>
            </div>

            <div className="password-section">
              <div className="password-section-header">
                <h3>{user?.hasFeaturePassword ? 'Change feature password' : 'Create feature password'}</h3>
                <button
                  className="ghost tiny"
                  onClick={() => setShowChangePassword((prev) => !prev)}
                >
                  {showChangePassword ? 'Hide' : user?.hasFeaturePassword ? 'Change' : 'Set Password'}
                </button>
              </div>

              {showChangePassword && (
                <form className="change-password-form" onSubmit={handleSetFeaturePassword}>
                  {user?.hasFeaturePassword && (
                    <>
                      <label htmlFor="currentPassword">Current password</label>
                      <input
                        id="currentPassword"
                        type="password"
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </>
                  )}
                  <label htmlFor="changeNewPassword">New feature password</label>
                  <input
                    id="changeNewPassword"
                    type="password"
                    placeholder="At least 4 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <label htmlFor="changeConfirmPassword">Confirm new password</label>
                  <input
                    id="changeConfirmPassword"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <div className="change-password-actions">
                    <button type="submit" className="primary">
                      {user?.hasFeaturePassword ? 'Update password' : 'Create password'}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setShowChangePassword(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            <button id="lockManager" className="secondary full" onClick={handleLockManager}>
              Lock manager
            </button>
          </div>
        )}

        {errorMsg && <p className="modal-error" role="alert">{errorMsg}</p>}
        {successMsg && (
          <p
            style={{
              color: 'var(--green)',
              fontSize: '13px',
              margin: '12px 0 0',
              textAlign: 'center',
            }}
            role="status"
          >
            {successMsg}
          </p>
        )}
      </div>
    </div>
  );
};
