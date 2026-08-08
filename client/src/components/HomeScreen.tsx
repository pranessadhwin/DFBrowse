import React from 'react';
import { AllowedSite } from '../types';

interface HomeScreenProps {
  allowedSites: AllowedSite[];
  onNavigate: (url: string) => void;
  onOpenManager: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  allowedSites,
  onNavigate,
  onOpenManager,
}) => {
  return (
    <div id="homeScreen" className="home-screen">
      <div className="hero-card">
        <div className="hero-badge">No extensions · Strict allowlist · Password protected</div>
        <h2>Stay on study websites only.</h2>
        <p>
          This browser blocks every HTTP/HTTPS domain except your allowed study list. Add or remove websites only
          with the feature password.
        </p>
        <div id="quickLinks" className="quick-links">
          {allowedSites.map((site) => (
            <button
              key={site.id}
              className="quick-link-btn"
              onClick={() => onNavigate(`https://${site.hostname}`)}
            >
              <span style={{ fontSize: '16px' }}>↗</span>
              <span>{site.hostname}</span>
            </button>
          ))}
          <button className="quick-link-btn" style={{ borderStyle: 'dashed' }} onClick={onOpenManager}>
            <span style={{ fontSize: '16px' }}>+</span>
            <span>Manage study allowlist...</span>
          </button>
        </div>
      </div>
    </div>
  );
};
