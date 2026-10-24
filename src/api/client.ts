/**
 * Browser-side API client for the Seektrix search pipeline.
 *
 * Every call accepts an optional AbortSignal so React components can cancel
 * stale requests (debounced type-ahead, unmounted dashboards, superseded
 * polls). Cancelled requests resolve with `aborted: true` instead of throwing.
 */
import { SearchQuery, PipelineStep, PipelineLog, MatchesResponse, SuggestResponse } from '../types';

// When the frontend is hosted separately (Vercel) point this at the Render backend.
const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/+$/, '');

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  /** True when the request was cancelled through its AbortSignal. */
  aborted?: boolean;
}

export interface StatusResponse {
  id: string;
  status: PipelineStep;
  progressPercent: number;
  estimatedCompletionMinutes: number;
  matchedCount: number;
  totalMatchedValue: number;
  confidenceScore: number;
  logs: PipelineLog[];
  engine?: string;
  degraded?: boolean;
  degradedReason?: string;
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal });
    let body: any = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok && response.status !== 202) {
      const message = body?.error || `Gateway error (${response.status})`;
      return { data: null, error: message, status: response.status };
    }
    return { data: body as T, error: null, status: response.status };
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      return { data: null, error: null, status: 0, aborted: true };
    }
    return { data: null, error: err?.message || 'Network error while contacting the search server.', status: 502 };
  }
}

export const searchApi = {
  /** Submit a full search. The server starts working immediately and returns the job. */
  async submitSearch(fullName: string, city: string, email: string, state = '', signal?: AbortSignal): Promise<ApiResponse<SearchQuery>> {
    if (!fullName.trim() && !email.trim()) {
      return { data: null, error: 'Enter your full name or your email address to search. State and city are optional.', status: 400 };
    }
    return request<SearchQuery>('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName.trim(), city: city.trim(), email: email.trim(), state: state.trim() }),
    }, signal);
  },

  /** Poll a running job. */
  async getStatus(id: string, signal?: AbortSignal): Promise<ApiResponse<StatusResponse>> {
    return request<StatusResponse>(`/api/search/${encodeURIComponent(id)}/status`, {}, signal);
  },

  /** Fetch the ranked matches. HTTP 202 means the job is still running. */
  async getMatches(id: string, signal?: AbortSignal): Promise<ApiResponse<MatchesResponse>> {
    return request<MatchesResponse>(`/api/search/${encodeURIComponent(id)}/matches`, {}, signal);
  },

  /** Type-ahead preview. Always pass the AbortSignal so superseded keystrokes are cancelled. */
  async suggest(name: string, state: string, signal?: AbortSignal): Promise<ApiResponse<SuggestResponse>> {
    const params = new URLSearchParams({ name: name.trim(), state: state.trim() });
    return request<SuggestResponse>(`/api/suggest?${params.toString()}`, {}, signal);
  },
};
