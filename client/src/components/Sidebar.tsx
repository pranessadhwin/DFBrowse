import React, { useState, useEffect, useRef } from 'react';
import { AllowedSite } from '../types';
import { studyService } from '../services/api';

interface SidebarProps {
  allowedSites: AllowedSite[];
  onOpenManager: () => void;
  onNavigate: (url: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  allowedSites,
  onOpenManager,
  onNavigate,
}) => {
  // Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'Focus' | 'Break'>('Focus');
  const timerRef = useRef<number | null>(null);

  // Notes State
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Load notes from database
    studyService.getNotes().then((data) => {
      setNotes(data || '');
    }).catch((err) => {
      console.error('Failed to load notes:', err);
    });
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = window.setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      // Record completed session
      studyService.createSession(
        `${mode} Session`,
        mode === 'Focus' ? 25 * 60 : 5 * 60,
        new Date(Date.now() - (mode === 'Focus' ? 25 * 60 * 1000 : 5 * 60 * 1000)).toISOString(),
        new Date().toISOString()
      ).catch(console.error);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, timeLeft, mode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'Focus' ? 25 * 60 : 5 * 60);
  };

  const setPreset = (mins: number, presetMode: 'Focus' | 'Break') => {
    setIsRunning(false);
    setMode(presetMode);
    setTimeLeft(mins * 60);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    setNotesSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      studyService.saveNotes(value).then(() => {
        setNotesSaving(false);
      }).catch((err) => {
        console.error('Failed to save notes:', err);
        setNotesSaving(false);
      });
    }, 1000);
  };

  const clearNotes = () => {
    setNotes('');
    studyService.saveNotes('').catch(console.error);
  };

  return (
    <aside className="sidebar" aria-label="Study tools">
      <div className="brand">
        <div className="logo" aria-hidden="true">
          D
        </div>
        <div>
          <h1>DFBrowse</h1>
          <p>Focused allowlist mode</p>
        </div>
      </div>

      <section className="panel timer-panel" aria-label="Focus timer">
        <div className="panel-title-row">
          <h2>Focus timer</h2>
          <span id="timerMode" className="pill">
            {mode}
          </span>
        </div>
        <div id="timerDisplay" className="timer-display">
          {formatTime(timeLeft)}
        </div>
        <div className="timer-actions">
          <button id="timerStart" className="secondary" onClick={startTimer}>
            Start
          </button>
          <button id="timerPause" className="secondary" onClick={pauseTimer}>
            Pause
          </button>
          <button id="timerReset" className="secondary" onClick={resetTimer}>
            Reset
          </button>
        </div>
        <div className="timer-actions small-actions">
          <button id="focus25" className="ghost" onClick={() => setPreset(25, 'Focus')}>
            25 min
          </button>
          <button id="break5" className="ghost" onClick={() => setPreset(5, 'Break')}>
            5 min
          </button>
        </div>
      </section>

      <section className="panel" aria-label="Allowed websites">
        <div className="panel-title-row">
          <h2>Allowed only</h2>
          <button id="manageSites" className="tiny" onClick={onOpenManager}>
            Manage
          </button>
        </div>
        <div id="siteList" className="site-list">
          {allowedSites.map((site) => (
            <div
              key={site.id}
              className="site-item"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate(`https://${site.hostname}`)}
              title={`Study on ${site.hostname}`}
            >
              <span>{site.hostname}</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>↗</span>
            </div>
          ))}
          {allowedSites.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center', padding: '12px 0' }}>
              No sites in allowlist.
            </div>
          )}
        </div>
      </section>

      <section className="panel notes-panel" aria-label="Study notes">
        <div className="panel-title-row">
          <h2>
            Quick notes {notesSaving && <span style={{ fontSize: '10px', opacity: 0.7 }}>(saving...)</span>}
          </h2>
          <button id="clearNotes" className="tiny danger-text" onClick={clearNotes}>
            Clear
          </button>
        </div>
        <textarea
          id="notes"
          spellCheck={true}
          placeholder="Write study notes here. Automatically saved to PostgreSQL."
          value={notes}
          onChange={handleNotesChange}
        />
      </section>
    </aside>
  );
};
