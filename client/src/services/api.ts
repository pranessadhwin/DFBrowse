import axios from 'axios';
import { User, AllowedSite, StudySession, NavigationLog, ProxyCheckResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dfbrowse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const unlockToken = sessionStorage.getItem('dfbrowse_unlock_token');
  if (unlockToken) {
    config.headers['x-unlock-token'] = unlockToken;
  }
  return config;
});

export const authService = {
  async register(data: { email: string; name: string; password: string; featurePassword?: string }): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/register', data);
    if (res.data.token) {
      localStorage.setItem('dfbrowse_token', res.data.token);
    }
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/login', data);
    if (res.data.token) {
      localStorage.setItem('dfbrowse_token', res.data.token);
    }
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await api.get('/auth/me');
    return res.data.user;
  },

  async setFeaturePassword(currentPassword?: string, newPassword?: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/auth/feature-password/set', { currentPassword, newPassword });
    return res.data;
  },

  async verifyFeaturePassword(password?: string): Promise<{ unlocked: boolean; unlockToken: string; hasPassword: boolean }> {
    const res = await api.post('/auth/feature-password/verify', { password });
    if (res.data.unlockToken) {
      sessionStorage.setItem('dfbrowse_unlock_token', res.data.unlockToken);
    }
    return res.data;
  },

  logout() {
    localStorage.removeItem('dfbrowse_token');
    sessionStorage.removeItem('dfbrowse_unlock_token');
  },
};

export const allowlistService = {
  async getSites(): Promise<AllowedSite[]> {
    const res = await api.get('/allowlist');
    return res.data.sites;
  },

  async addSite(site: string, unlockToken?: string): Promise<{ success: boolean; site: AllowedSite; sites: AllowedSite[] }> {
    const res = await api.post('/allowlist', { site, unlockToken });
    return res.data;
  },

  async deleteSite(id: string, unlockToken?: string): Promise<{ success: boolean; deletedId: string; sites: AllowedSite[] }> {
    const res = await api.delete(`/allowlist/${id}`, { params: { unlockToken } });
    return res.data;
  },

  async resetSites(unlockToken?: string): Promise<{ success: boolean; sites: AllowedSite[] }> {
    const res = await api.post('/allowlist/reset', { unlockToken });
    return res.data;
  },
};

export const studyService = {
  async getSessions(): Promise<StudySession[]> {
    const res = await api.get('/study/sessions');
    return res.data.sessions;
  },

  async createSession(title: string, durationSeconds: number, startedAt: string, endedAt: string): Promise<{ success: boolean; sessionId: string }> {
    const res = await api.post('/study/sessions', { title, durationSeconds, startedAt, endedAt });
    return res.data;
  },

  async getLogs(): Promise<NavigationLog[]> {
    const res = await api.get('/study/logs');
    return res.data.logs;
  },

  async getNotes(): Promise<string> {
    const res = await api.get('/study/notes');
    return res.data.content;
  },

  async saveNotes(content: string): Promise<{ success: boolean }> {
    const res = await api.put('/study/notes', { content });
    return res.data;
  },

  async checkUrl(url: string): Promise<ProxyCheckResponse> {
    const res = await api.get('/proxy/check', { params: { url } });
    return res.data;
  },
};
