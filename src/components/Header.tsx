import React, { useState } from 'react';
import { User, AppView } from '../types';
import { Shield, Menu, X, Landmark, Cpu, Database, Award, Settings, LogOut, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  currentUser: User | null;
  onLogout: () => void;
}

export default function Header({ currentView, setView, currentUser, onLogout }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { label: string; view: AppView; requireAuth?: boolean; role?: string }[] = [
    { label: 'How It Works', view: 'landing' },
    { label: 'Pricing', view: 'pricing' },
    { label: 'Asset Workspace', view: 'dashboard', requireAuth: true },
    { label: 'Control Unit', view: 'admin', requireAuth: true, role: 'admin' },
  ];

  const handleNavClick = (view: AppView, onClickAnchor?: string) => {
    setView(view);
    setMobileMenuOpen(false);
    if (onClickAnchor) {
      setTimeout(() => {
        const element = document.getElementById(onClickAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  return (
    <header className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8 text-[#171717]">
      <div className="max-w-7xl mx-auto glass-panel-light shadow-[0_20px_50px_rgba(0,0,0,0.08),inset_0_1px_1.5px_rgba(255,255,255,0.85)] border-white/70 rounded-2xl transition-all">
        <div className="px-6 h-18 flex items-center justify-between">
        {/* Logo and Brand */}
        <div 
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => handleNavClick('landing')}
          id="brand-logo"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-cofounder-blue to-[#1f1f29] text-off-white shadow-md">
            <Landmark className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-lg border border-canvas-white/20 group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="font-serif-intellectual text-xl font-semibold tracking-wider text-[#171717] flex items-center">
              SEEKTRIX
            </div>
            <p className="text-[10px] text-cofounder-blue font-mono tracking-widest uppercase -mt-1 group-hover:text-dark-charcoal transition-colors">
              Asset Recovery Engine
            </p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <button 
            onClick={() => handleNavClick('landing', 'how-it-works')} 
            className="text-[#646464] hover:text-[#171717] transition-colors cursor-pointer"
          >
            How It Works
          </button>
          <button 
            onClick={() => handleNavClick('landing', 'pipeline-viz')} 
            className="text-[#646464] hover:text-[#171717] transition-colors cursor-pointer"
          >
            Retrieval Engine
          </button>
          <button 
            onClick={() => handleNavClick('pricing')} 
            className={`transition-colors cursor-pointer ${currentView === 'pricing' ? 'text-cofounder-blue font-semibold' : 'text-[#646464] hover:text-[#171717]'}`}
          >
            Pricing
          </button>

          {currentUser?.isAuthenticated && (
            <button 
              onClick={() => handleNavClick('dashboard')} 
              className={`transition-colors cursor-pointer ${currentView === 'dashboard' ? 'text-cofounder-blue font-semibold' : 'text-[#646464] hover:text-[#171717]'}`}
            >
              Workspace
            </button>
          )}

          {currentUser?.isAuthenticated && currentUser.role === 'admin' && (
            <button 
              onClick={() => handleNavClick('admin')} 
              className={`transition-colors cursor-pointer text-xs font-mono uppercase border border-cofounder-blue px-2.5 py-1 rounded bg-cofounder-blue/5 ${currentView === 'admin' ? 'text-[#171717] border-[#171717] font-semibold' : 'text-cofounder-blue hover:bg-cofounder-blue/10'}`}
            >
              Control Unit
            </button>
          )}
        </nav>

        {/* Action Controls */}
        <div className="hidden md:flex items-center space-x-4">
          <AnimatePresence mode="wait">
            {currentUser?.isAuthenticated ? (
              <div key="authed" className="flex items-center space-x-4">
                <div 
                  className="flex items-center space-x-2 text-xs text-[#646464] cursor-pointer hover:text-[#171717]"
                  onClick={() => setView('settings')}
                >
                  <Settings className="w-4 h-4 text-cofounder-blue" />
                  <span className="font-mono">{currentUser.email}</span>
                </div>
                 <button
                  onClick={onLogout}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-white/60 hover:border-red-500/40 text-xs text-[#646464] hover:text-red-600 bg-white/40 backdrop-blur-xs cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.02)] transition-all"
                  id="header-logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <div key="unauthed" className="flex items-center space-x-3">
                <button
                  onClick={() => setView('auth')}
                  className="text-sm text-[#646464] hover:text-[#171717] transition-colors cursor-pointer px-3 py-1.5"
                  id="header-signin-btn"
                >
                  Sign In
                </button>
                <button
                  onClick={() => setView('auth')}
                  className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-[#0081c0]/95 to-[#41a1cf]/95 text-white shadow-[0_8px_20px_rgba(0,129,192,0.15),inset_0_1px_0.5px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_28px_rgba(0,129,192,0.22)] border border-white/30 backdrop-blur-md transition-all cursor-pointer font-semibold tracking-tight"
                  id="header-signup-btn"
                >
                  Get Started
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Navigation Trigger */}
        <div className="flex md:hidden items-center space-x-3">
          {currentUser?.isAuthenticated && (
            <button 
              onClick={() => setView('settings')}
              className="p-1.5 text-[#646464] hover:text-[#171717] rounded-lg border border-steel-gray/30"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#646464] hover:text-[#171717] focus:outline-none focus:ring-1 focus:ring-cofounder-blue rounded-lg border border-steel-gray/30"
            aria-label="Toggle Menu"
            id="mobile-menu-trigger"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden border border-steel-gray/30 glass-panel-light overflow-hidden rounded-b-2xl mt-1 shadow-lg"
            id="mobile-navigation-drawer"
          >
            <div className="px-4 py-6 space-y-4">
              <button
                onClick={() => handleNavClick('landing', 'how-it-works')}
                className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2"
              >
                How It Works
              </button>
              <button
                onClick={() => handleNavClick('landing', 'pipeline-viz')}
                className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2"
              >
                Retrieval Engine
              </button>
              <button
                onClick={() => handleNavClick('pricing')}
                className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2"
              >
                Pricing Structure
              </button>

              {currentUser?.isAuthenticated ? (
                <>
                  <div className="h-[1px] bg-steel-gray/20 my-2" />
                  <button
                    onClick={() => handleNavClick('dashboard')}
                    className="block w-full text-left text-sm text-[#171717] py-2 font-medium flex items-center justify-between"
                  >
                    <span>Asset Workspace</span>
                    <ChevronRight className="w-4 h-4 text-cofounder-blue" />
                  </button>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleNavClick('admin')}
                      className="block w-full text-left text-sm text-cofounder-blue font-mono py-2 flex items-center justify-between"
                    >
                      <span>SYSTEM CONTROL PANEL</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleNavClick('settings')}
                    className="block w-full text-left text-sm text-[#646464] py-2"
                  >
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="block w-full text-left text-sm text-red-500 py-2"
                  >
                    Logout Account
                  </button>
                </>
              ) : (
                <>
                  <div className="h-[1px] bg-steel-gray/20 my-2" />
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => handleNavClick('auth')}
                      className="w-full text-center text-sm border border-steel-gray/30 py-2 rounded text-[#646464] hover:text-[#171717] bg-[#f9faf7]"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => handleNavClick('auth')}
                      className="w-full text-center text-sm py-2 rounded text-off-white bg-cofounder-blue hover:bg-action-azure"
                    >
                      Register Now
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </header>
  );
}
