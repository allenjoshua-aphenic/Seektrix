import React from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import LandingSections from './components/LandingSections';
import AuthScreens from './components/AuthScreens';
import Dashboard from './components/Dashboard';
import ProcessingStatus from './components/ProcessingStatus';
import ReportView from './components/ReportView';
import PricingSection from './components/PricingSection';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import SettingsPanel from './components/SettingsPanel';
import { SystemTimeoutError } from './components/SystemStates';
import Footer from './components/Footer';
import LegalPages from './components/LegalPages';
import ToastContainer from './components/ToastContainer';

import { useAppStore } from './store/useAppStore';
import { generatePipelineLogs } from './data';
import { AppView, PipelineStep, SearchQuery } from './types';
import { useSearchPolling } from './hooks/useSearchPolling';
import { searchApi } from './api/client';

const ALL_VIEWS: AppView[] = ['landing', 'auth', 'dashboard', 'status', 'pricing', 'admin', 'admin-login', 'settings', 'privacy', 'terms', 'compliance-disclaimer'];
const LEGAL_VIEWS: AppView[] = ['privacy', 'terms', 'compliance-disclaimer'];

export default function App() {
  // Mount the real compliance query progress polling agent
  useSearchPolling();

  const {
    currentUser,
    currentView,
    searchHistory,
    activeSearch,
    selectedReport,
    isErrorState,
    setView,
    login,
    logout,
    clearHistory,
    addSearchQuery,
    setActiveSearch,
    setSelectedReport,
    setErrorState,
    updateSearchProgress
  } = useAppStore();

  const handleLoginSuccess = (name: string, email: string, city: string, role?: 'user' | 'admin') => {
    login(name, email, city, role);
  };

  const handleLogout = () => {
    logout();
  };

  // Search Submission Flow
  const handleLaunchSearch = async (fullName: string, city: string, email: string, state?: string) => {
    if (!currentUser) {
      // Name or email may be empty now; never show a blank identity in the navbar.
      login(fullName || email.split('@')[0] || 'Guest', email, city || state || '', 'user');
    }

    const res = await searchApi.submitSearch(fullName, city, email, state || '');
    if (res.error || !res.data) {
      alert(res.error || 'Failed to initiate secure registry lookup.');
      return;
    }

    addSearchQuery(res.data);
    setActiveSearch(res.data);
    setView('status');
  };

  // Simulate empty clean search
  const handleSimulateEmpty = (fullName: string, city: string, email: string, state?: string) => {
    if (!currentUser) {
      login(fullName, email, city, 'user');
    }

    const randomId = `REQ-${1000 + Math.floor(Math.random() * 9000)}`;
    const newQuery: SearchQuery = {
      id: randomId,
      fullName,
      city,
      state: state || city.split(',')[1]?.trim() || 'TAMIL NADU',
      email,
      submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'queued',
      progressPercent: 0,
      estimatedCompletionMinutes: 1,
      matchedCount: 0,
      confidenceScore: 99,
      totalMatchedValue: 0,
      logs: generatePipelineLogs(fullName)
    };

    addSearchQuery(newQuery);
    setView('status');
  };

  const handleSimulateError = () => {
    setErrorState(true);
    setView('landing');
  };

  const handleScanFinished = () => {
    if (activeSearch) {
      updateSearchProgress(activeSearch.id, 100, 'completed' as PipelineStep);
    }
  };

  const handleOpenReport = (query: SearchQuery) => {
    setSelectedReport(query);
    setView('dashboard');
  };

  const handleJoinWaitlist = () => {
    alert('Thank you! An inquiry specialist from our Bengaluru compliance hub will contact you shortly.');
  };

  // Synchronize state with URL hashes for Privacy Policy, Terms of Service and Compliance Disclaimer
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#privacy') {
        setView('privacy');
      } else if (hash === '#terms') {
        setView('terms');
      } else if (hash === '#compliance-disclaimer') {
        setView('compliance-disclaimer');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [setView]);

  // ── Browser history ↔ views ────────────────────────────────────────────────
  // Views live in the store, not in the URL, so without this the browser's Back
  // button left the site entirely. Every view change now records a history entry;
  // Back/Forward restore the view. Finishing a search REPLACES the progress page
  // with the results page, so Back from the results returns to the landing page.
  const popNavRef = React.useRef(false);
  const prevViewRef = React.useRef<AppView>(currentView);

  React.useEffect(() => {
    const stateView = window.history.state && (window.history.state as any).view;
    if (!stateView) {
      window.history.replaceState({ view: currentView }, '');
    }
    const onPop = (e: PopStateEvent) => {
      const v = e.state && (e.state as any).view;
      const target: AppView = ALL_VIEWS.includes(v) ? v : 'landing';
      if (useAppStore.getState().currentView === target) return;
      popNavRef.current = true;
      setView(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setView]);

  React.useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = currentView;
    if (popNavRef.current) { popNavRef.current = false; return; }
    if (prev === currentView) return;
    const stateView = window.history.state && (window.history.state as any).view;
    if (stateView === currentView) return;
    const entry = { view: currentView };
    const url = LEGAL_VIEWS.includes(currentView)
      ? `#${currentView}`
      : window.location.pathname + window.location.search;
    if ((prev === 'status' && currentView === 'dashboard') || !stateView) {
      window.history.replaceState(entry, '', url);
    } else {
      window.history.pushState(entry, '', url);
    }
  }, [currentView]);

  // Reset scroll position to top whenever navigating to another view
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView]);

  return (
    <div className="min-h-screen relative overflow-x-clip bg-gradient-to-b from-[#e3eefd] via-[#f7fbf4] to-[#fef8e7] flex flex-col font-sans select-none selection:bg-[#0081c0]/20 selection:text-dark-charcoal">
      
      {/* Background radial gradient maps */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute -top-[5%] left-[-5%] w-[650px] h-[650px] rounded-full bg-emerald-400/15 blur-[120px] opacity-95" />
        <div className="absolute top-[20%] left-[-15%] w-[550px] h-[550px] rounded-full bg-orange-400/15 blur-[110px] opacity-90" />
        <div className="absolute -top-[5%] left-[20%] w-[800px] h-[800px] rounded-full bg-[#0081c0]/20 blur-[140px] opacity-95" />
        <div className="absolute -top-[5%] right-[-5%] w-[650px] h-[650px] rounded-full bg-amber-400/15 blur-[120px] opacity-95" />
        <div className="absolute top-[40%] right-[5%] w-[750px] h-[750px] rounded-full bg-indigo-500/10 blur-[140px] opacity-90" />
        <div className="absolute bottom-[10%] left-[-5%] w-[720px] h-[720px] rounded-full bg-[#10b981]/10 blur-[130px] opacity-95" />
        <div className="absolute bottom-[-5%] right-[-10%] w-[750px] h-[750px] rounded-full bg-amber-400/10 blur-[140px] opacity-95" />
      </div>

      {/* Persistent SaaS Navbar */}
      <Navbar />

      {/* Global Toast Notifications */}
      <ToastContainer />

      {/* Main Switcher */}
      <main className="flex-grow">
        {isErrorState ? (
          <SystemTimeoutError
            onRetry={() => {
              setErrorState(false);
              setView('dashboard');
            }}
            setView={(view) => {
              setErrorState(false);
              setView(view as any);
            }}
          />
        ) : (
          (() => {
            switch (currentView) {
              case 'landing':
                return (
                  <>
                    <HeroSection 
                      onLaunchSearch={handleLaunchSearch}
                      isAuthenticated={!!currentUser?.isAuthenticated}
                    />
                    <LandingSections 
                      onJoinWaitlist={handleJoinWaitlist}
                      setView={setView}
                    />
                  </>
                );
              
              case 'auth':
                return (
                  <AuthScreens
                    onLoginSuccess={(user) => handleLoginSuccess(user.name, user.email, user.city, user.role)}
                    setView={setView}
                  />
                );

              case 'dashboard':
                return (
                  <Dashboard
                    currentUser={currentUser}
                    history={searchHistory}
                    onStartSearch={handleLaunchSearch}
                    onOpenReport={handleOpenReport}
                    setView={setView}
                    onSimulateError={handleSimulateError}
                    onSimulateEmpty={handleSimulateEmpty}
                  />
                );

              case 'status':
                return (
                  <ProcessingStatus
                    currentSearch={activeSearch}
                    onScanComplete={handleScanFinished}
                    setView={setView}
                  />
                );

              case 'pricing':
                return (
                  <PricingSection
                    currentView={currentView}
                    setView={setView}
                  />
                );

              case 'admin':
                return currentUser?.role === 'admin' ? (
                  <AdminPanel
                    currentUser={currentUser}
                    onStartSearch={handleLaunchSearch}
                    onSimulateError={handleSimulateError}
                    onSimulateEmpty={handleSimulateEmpty}
                  />
                ) : (
                  <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl glass-panel-light text-center font-mono shadow-md">
                    <p className="text-red-600 font-bold">UNAUTHORIZED EXCEPTION</p>
                    <p className="text-xs text-dark-charcoal/80 mt-2">Admin credentials required to mount Control Unit.</p>
                  </div>
                );

              case 'admin-login':
                return (
                  <AdminLogin />
                );

              case 'settings':
                return (
                  <SettingsPanel
                    currentUser={currentUser}
                    onClearHistory={clearHistory}
                    setView={setView}
                  />
                );

              case 'privacy':
              case 'terms':
              case 'compliance-disclaimer':
                return (
                  <LegalPages
                    activeDoc={currentView as any}
                    onBack={() => {
                      setView(currentUser?.isAuthenticated ? 'dashboard' : 'landing');
                      window.location.hash = '';
                    }}
                    setView={setView}
                  />
                );

              default:
                return (
                  <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl glass-panel-light text-center text-xs font-mono shadow-md">
                    <p className="text-red-500 font-bold">Error 404</p>
                    <p className="text-dark-charcoal/80 mt-2">System redirection parameters lost.</p>
                  </div>
                );
            }
          })()
        )}
      </main>

      {/* Beautiful standalone footer if on views outside of landing & admin-login */}
      {currentView !== 'landing' && currentView !== 'admin-login' && <Footer />}

    </div>
  );
}
