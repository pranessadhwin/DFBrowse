import React, { useState } from 'react';
import { User } from '../types';
import { authService } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUserChanged: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserChanged,
}) => {
  const [tab, setTab] = useState<'profile' | 'login' | 'register'>('profile');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [featurePassword, setFeaturePassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await authService.login({ email, password });
      onUserChanged(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await authService.register({
        email,
        name,
        password,
        featurePassword: featurePassword || undefined,
      });
      onUserChanged(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleDemoLogin = async () => {
    setErrorMsg('');
    try {
      const res = await authService.login({
        email: 'student@dfbrowse.com',
        password: 'study123',
      });
      onUserChanged(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to switch to Demo Student');
    }
  };

  const handleLogout = () => {
    authService.logout();
    authService.getMe().then((demoUser) => {
      onUserChanged(demoUser);
      onClose();
    }).catch(() => {
      onClose();
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>Study Account & Profiles (PostgreSQL)</h2>
            <p>Multi-user SaaS study management</p>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '10px',
          }}
        >
          <button
            className={tab === 'profile' ? 'primary tiny' : 'secondary tiny'}
            onClick={() => {
              setTab('profile');
              setErrorMsg('');
            }}
          >
            Current Profile
          </button>
          <button
            className={tab === 'login' ? 'primary tiny' : 'secondary tiny'}
            onClick={() => {
              setTab('login');
              setErrorMsg('');
            }}
          >
            Sign In
          </button>
          <button
            className={tab === 'register' ? 'primary tiny' : 'secondary tiny'}
            onClick={() => {
              setTab('register');
              setErrorMsg('');
            }}
          >
            Create Account
          </button>
        </div>

        {tab === 'profile' && (
          <div className="modal-section">
            <div
              style={{
                background: 'var(--panel-2)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>ACTIVE USER</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '4px' }}>
                {user ? user.name : 'Guest'}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--blue)', marginTop: '2px', fontFamily: 'monospace' }}>
                {user ? user.email : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                Feature Password Protection:{' '}
                <strong style={{ color: user?.hasFeaturePassword ? 'var(--green)' : 'var(--yellow)' }}>
                  {user?.hasFeaturePassword ? 'ENABLED (4321)' : 'DISABLED'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button className="secondary" style={{ flex: 1 }} onClick={handleDemoLogin}>
                Switch to Demo Student
              </button>
              <button className="secondary danger-text" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        )}

        {tab === 'login' && (
          <form className="modal-section" onSubmit={handleLogin}>
            <label htmlFor="loginEmail">Email Address</label>
            <input
              id="loginEmail"
              type="email"
              placeholder="student@dfbrowse.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="loginPw">Password</label>
            <input
              id="loginPw"
              type="password"
              placeholder="study123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="primary full">
              Sign In to Account
            </button>
            <p className="hint">
              Demo account credentials: <strong>student@dfbrowse.com</strong> / password: <strong>study123</strong>
            </p>
          </form>
        )}

        {tab === 'register' && (
          <form className="modal-section" onSubmit={handleRegister}>
            <label htmlFor="regName">Full Name</label>
            <input
              id="regName"
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <label htmlFor="regEmail">Email Address</label>
            <input
              id="regEmail"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="regPw">Password</label>
            <input
              id="regPw"
              type="password"
              placeholder="Account login password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label htmlFor="regFpw">Feature Password (Optional)</label>
            <input
              id="regFpw"
              type="password"
              placeholder="PIN to protect your study allowlist"
              value={featurePassword}
              onChange={(e) => setFeaturePassword(e.target.value)}
            />
            <button type="submit" className="primary full">
              Create Study Account
            </button>
          </form>
        )}

        {errorMsg && <p className="modal-error" role="alert">{errorMsg}</p>}
      </div>
    </div>
  );
};
