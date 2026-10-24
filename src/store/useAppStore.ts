import { create } from 'zustand';
import { User, SearchQuery, AppView, PipelineStep, PipelineLog, ToastNotification, AppPayment } from '../types';
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
  updateSearchProgress: (
    id: string,
    progressPercent: number,
    status: PipelineStep,
    matchedCount?: number,
    totalMatchedValue?: number,
    confidenceScore?: number,
    logs?: PipelineLog[],
    extra?: { engine?: string; degraded?: boolean; degradedReason?: string }
  ) => void;
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

  updateSearchProgress: (id, progressPercent, status, matchedCount, totalMatchedValue, confidenceScore, logs, extra) => set((state) => {
    const existing = state.searchHistory.find((item) => item.id === id);
    const wasCompletedOrFailed = existing ? (existing.status === 'completed' || existing.status === 'failed') : true;
    const isTransitioningToCompleted = !wasCompletedOrFailed && status === 'completed';

    // Merge whatever the real API response provided
    const patch: Partial<SearchQuery> = {
      progressPercent,
      status,
      ...(matchedCount !== undefined && { matchedCount }),
      ...(totalMatchedValue !== undefined && { totalMatchedValue }),
      ...(confidenceScore !== undefined && { confidenceScore }),
      ...(logs !== undefined && { logs }),
      ...(extra?.engine !== undefined && { engine: extra.engine }),
      ...(extra?.degraded !== undefined && { degraded: extra.degraded }),
      ...(extra?.degradedReason !== undefined && { degradedReason: extra.degradedReason }),
    };

    const updatedHistory = state.searchHistory.map((item) => (item.id === id ? { ...item, ...patch } : item));
    const updatedActive = state.activeSearch?.id === id ? { ...state.activeSearch, ...patch } : state.activeSearch;

    let updatedToasts = [...state.toasts];
    if (isTransitioningToCompleted && existing) {
      // Use the NEW numbers from this update, not the stale ones on the old record
      const count = matchedCount ?? existing.matchedCount;
      const value = totalMatchedValue ?? existing.totalMatchedValue;
      const formattedVal = value > 0 ? `₹${value.toLocaleString('en-IN')}` : '';
      const toastMessage = count > 0
        ? `Search complete for ${existing.fullName}: ${count} matching record${count === 1 ? '' : 's'} found${formattedVal ? ` (unclaimed amount on record ${formattedVal})` : ''}.`
        : `Search complete for ${existing.fullName}: no matching records in the registries loaded so far.`;

      const completedToast: ToastNotification = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: extra?.degraded ? 'Search Completed (partial)' : 'Search Completed',
        message: toastMessage,
        type: extra?.degraded ? 'warning' : 'success',
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

