import { create } from 'zustand';
import { User, SearchQuery, AppView, PipelineStep, ToastNotification, AppPayment } from '../types';
import { MOCK_HISTORY } from '../data';

interface AppState {
  // Authentication
  currentUser: User | null;
  login: (name: string, email: string, city: string, role?: 'user' | 'admin') => void;
  logout: () => void;

  // View Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Search History & Active Queries
  searchHistory: SearchQuery[];
  activeSearch: SearchQuery | null;
  selectedReport: SearchQuery | null;
  isErrorState: boolean;
  
  // Toast Notifications System
  toasts: ToastNotification[];
  addToast: (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  dismissToast: (id: string) => void;
  
  // Actions
  setErrorState: (isError: boolean) => void;
  setSearchHistory: (history: SearchQuery[]) => void;
  clearHistory: () => void;
  setActiveSearch: (query: SearchQuery | null) => void;
  setSelectedReport: (query: SearchQuery | null) => void;
  addSearchQuery: (query: SearchQuery) => void;
  updateSearchProgress: (id: string, progressPercent: number, status: PipelineStep, matchedCount?: number, totalMatchedValue?: number, confidenceScore?: number) => void;
  toggleStarQuery: (id: string) => void;
  toggleArchiveQuery: (id: string) => void;
  retryQuery: (id: string) => void;

  // Payments / Unlocked assets
  unlockedAssetIds: string[];
  unlockAsset: (id: string) => void;
  payments: AppPayment[];
  recordPayment: (amount: number, description: string) => void;
}

const getInitialUnlockedAssets = (): string[] => {
  try {
    const stored = localStorage.getItem('unlocked_asset_ids');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const getInitialPayments = (): AppPayment[] => {
  try {
    const stored = localStorage.getItem('app_payments_log');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const useAppStore = create<AppState>((set) => ({
  currentUser: null,
  currentView: 'landing',
  searchHistory: MOCK_HISTORY,
  activeSearch: null,
  selectedReport: null,
  isErrorState: false,
  toasts: [],
  unlockedAssetIds: getInitialUnlockedAssets(),
  payments: getInitialPayments(),

  recordPayment: (amount, description) => set((state) => {
    const newPayment: AppPayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      amount,
      timestamp: new Date().toISOString(),
      description
    };
    const updated = [newPayment, ...state.payments];
    try {
      localStorage.setItem('app_payments_log', JSON.stringify(updated));
    } catch (e) {}
    return { payments: updated };
  }),

  unlockAsset: (id) => set((state) => {
    const updated = [...state.unlockedAssetIds];
    if (!updated.includes(id)) {
      updated.push(id);
    }
    try {
      localStorage.setItem('unlocked_asset_ids', JSON.stringify(updated));
    } catch (e) {
      // Ignore storage errors
    }
    return { unlockedAssetIds: updated };
  }),

  login: (name, email, city, role = 'user') => set({
    currentUser: {
      name,
      email,
      city,
      isAuthenticated: true,
      role
    }
  }),

  logout: () => set({
    currentUser: null,
    currentView: 'landing'
  }),

  setView: (view) => set({ currentView: view, isErrorState: false }),

  setErrorState: (isError) => set({ isErrorState: isError }),

  setSearchHistory: (history) => set({ searchHistory: history }),

  clearHistory: () => set({ searchHistory: [] }),

  setActiveSearch: (query) => set({ activeSearch: query }),

  setSelectedReport: (query) => set({ selectedReport: query }),

  addToast: (title, message, type) => set((state) => {
    const newToast: ToastNotification = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title,
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    return { toasts: [newToast, ...state.toasts] };
  }),

  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  })),

  addSearchQuery: (query) => set((state) => ({
    searchHistory: [query, ...state.searchHistory],
    activeSearch: query,
    isErrorState: false
  })),

  updateSearchProgress: (id, progressPercent, status, matchedCount, totalMatchedValue, confidenceScore) => set((state) => {
    const existing = state.searchHistory.find((item) => item.id === id);
    const wasCompletedOrFailed = existing ? (existing.status === 'completed' || existing.status === 'failed') : true;
    
    const isTransitioningToCompleted = !wasCompletedOrFailed && status === 'completed';

    // Merge match data if provided (from real API response)
    const matchPatch = {
      ...(matchedCount !== undefined && { matchedCount }),
      ...(totalMatchedValue !== undefined && { totalMatchedValue }),
      ...(confidenceScore !== undefined && { confidenceScore }),
    };

    const updatedHistory = state.searchHistory.map((item) =>
      item.id === id ? { ...item, progressPercent, status, ...matchPatch } : item
    );

    const updatedActive = state.activeSearch?.id === id 
      ? { ...state.activeSearch, progressPercent, status, ...matchPatch }
      : state.activeSearch;

    let updatedToasts = [...state.toasts];
    if (isTransitioningToCompleted && existing) {
      const matchedCount = existing.matchedCount;
      const matchedVal = existing.totalMatchedValue;
      const formattedVal = matchedVal > 0 
        ? `₹${matchedVal.toLocaleString('en-IN')}` 
        : '0';

      const toastMessage = matchedCount > 0
        ? `Asset discovery scan complete for ${existing.fullName}. Identified ${matchedCount} unclaimed asset matches worth ${formattedVal}!`
        : `Asset discovery scan complete for ${existing.fullName}. No unclaimed matches detected in the processed records.`;

      const completedToast: ToastNotification = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: 'Scan Completed Successfully',
        message: toastMessage,
        type: 'success',
        timestamp: new Date().toLocaleTimeString(),
      };
      
      updatedToasts = [completedToast, ...updatedToasts];
    }

    return {
      searchHistory: updatedHistory,
      activeSearch: updatedActive,
      toasts: updatedToasts
    };
  }),

  toggleStarQuery: (id) => set((state) => ({
    searchHistory: state.searchHistory.map((item) =>
      item.id === id ? { ...item, isStarred: !item.isStarred } : item
    )
  })),

  toggleArchiveQuery: (id) => set((state) => ({
    searchHistory: state.searchHistory.map((item) =>
      item.id === id ? { ...item, isArchived: !item.isArchived } : item
    )
  })),

  retryQuery: (id) => set((state) => {
    const originalQuery = state.searchHistory.find((item) => item.id === id);
    if (!originalQuery) return {};
    
    const restartedQuery: SearchQuery = {
      ...originalQuery,
      status: 'queued',
      progressPercent: 0,
      isArchived: false,
      submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };

    return {
      searchHistory: state.searchHistory.map((item) =>
        item.id === id ? restartedQuery : item
      ),
      activeSearch: restartedQuery,
      currentView: 'status',
      isErrorState: false
    };
  })
}));

