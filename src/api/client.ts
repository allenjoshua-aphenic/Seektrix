// hi this is the client side api for the search pipeline. It connects to the local express/fastapi backend server and handles the search submission and status polling.
import { SearchQuery, UnclaimedAsset, PipelineStep, PipelineLog } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export const searchApi = {
  /**
   * Submits a search parameters query to the index compliance pipeline.
   * Connects to the local Express/FastAPI backend server.
   */
  async submitSearch(fullName: string, city: string, email: string): Promise<ApiResponse<SearchQuery>> {
    // Basic compliance check validation for input
    if (!fullName.trim() || !city.trim() || !email.trim()) {
      return {
        data: null,
        error: 'Invalid parameters. Target name, city scope, and secure contact email are mandatory.',
        status: 400
      };
    }

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, city, email })
      });
      if (!response.ok) throw new Error(`Gateway Error (${response.status})`);
      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'Error executing secure search submission.', status: 502 };
    }
  },

  /**
   * Fetches the current status of an active search pipeline.
   * Returns full query data including matchedCount and totalMatchedValue.
   */
  async getStatus(id: string, progress: number): Promise<ApiResponse<{ 
    progressPercent: number; 
    status: PipelineStep; 
    logs: PipelineLog[];
    matchedCount: number;
    totalMatchedValue: number;
    confidenceScore: number;
  }>> {
    try {
      const response = await fetch(`/api/search/${id}/status`);
      if (!response.ok) throw new Error(`Gateway status poll failed (${response.status})`);
      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message, status: 500 };
    }
  }
};
