import React, { useState, useEffect } from 'react';
import { StudySession, NavigationLog } from '../types';
import { studyService } from '../services/api';

interface StudyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudyStatsModal: React.FC<StudyStatsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs');
  const [logs, setLogs] = useState<NavigationLog[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([studyService.getLogs(), studyService.getSessions()])
        .then(([lData, sData]) => {
          setLogs(lData || []);
          setSessions(sData || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load study stats:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <h2>PostgreSQL Study Analytics & Audit Logs</h2>
            <p>Persistent database records of navigation attempts & focus timers</p>
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
            className={activeTab === 'logs' ? 'primary tiny' : 'secondary tiny'}
            onClick={() => setActiveTab('logs')}
          >
            Navigation Audit Logs ({logs.length})
          </button>
          <button
            className={activeTab === 'sessions' ? 'primary tiny' : 'secondary tiny'}
            onClick={() => setActiveTab('sessions')}
          >
            Study Sessions ({sessions.length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
            Loading database analytics...
          </div>
        ) : activeTab === 'logs' ? (
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Hostname</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {formatDate(log.timestamp)}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{log.hostname || log.requested_url}</td>
                    <td>
                      <span className={`status-badge ${log.status.toLowerCase()}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)' }}>
                      No navigation logs recorded yet. Try browsing allowed or blocked sites!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Duration</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess.id}>
                    <td><strong>{sess.title}</strong></td>
                    <td>{formatDuration(sess.duration_seconds)}</td>
                    <td style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {formatDate(sess.ended_at)}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)' }}>
                      No completed study sessions yet. Start a 25 min focus timer in the sidebar!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
