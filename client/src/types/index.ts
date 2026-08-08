export interface User {
  id: string;
  email: string;
  name: string;
  hasFeaturePassword: boolean;
}

export interface AllowedSite {
  id: string;
  hostname: string;
  is_default: boolean;
  added_at: string;
}

export interface StudySession {
  id: string;
  title: string;
  duration_seconds: number;
  started_at: string;
  ended_at: string;
}

export interface NavigationLog {
  id: string;
  requested_url: string;
  hostname: string;
  status: 'ALLOWED' | 'BLOCKED';
  timestamp: string;
}

export interface ProxyCheckResponse {
  allowed: boolean;
  hostname: string;
  targetUrl: string;
  reason: string;
}
