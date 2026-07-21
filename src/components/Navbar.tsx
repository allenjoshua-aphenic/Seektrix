import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Landmark, Menu, X, Settings, LogOut, ChevronRight, User, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView } from '../types';

export default function Navbar() {
  const { currentView, setView, currentUser, logout } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAssetTypes, setShowAssetTypes] = useState(false);
  const [mobileAssetTypesOpen, setMobileAssetTypesOpen] = useState(false);

  const assetTypes = [
    { name: 'Shares + Dividends (IEPF)', status: 'active' },
    { name: 'Mutual Funds', status: 'coming' },
    { name: 'Bank A/c & FDs', status: 'coming' },
    { name: 'EPF', status: 'coming' },
    { name: 'PPF', status: 'coming' },
    { name: 'Insurance', status: 'coming' }
  ];

  const handleNavClick = (view: AppView, onClickAnchor?: string) => {
    if (window.location.hash) {
      window.history.pushState("", document.title, window.location.pathname + window.location.search);
    }
    setView(view);
    setMobileMenuOpen(false);
    if (onClickAnchor) {
      setTimeout(() => {
        const element = document.getElementById(onClickAnchor);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8 text-[#171717]">
      <div className="max-w-7xl mx-auto navbar-glass rounded-full transition-all">
        <div className="px-8 h-16 flex items-center justify-between">
          
          {/* Logo and Brand */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => handleNavClick('landing')}
            id="navbar-logo"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavClick('landing');
              }
            }}
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-cofounder-blue to-[#1f1f29] text-white shadow-md">
              <Landmark className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-full border border-white/20 group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <div className="font-serif-intellectual text-2xl font-bold tracking-widest text-[#171717] flex items-center leading-tight">
                SEEKTRIX
              </div>
              <p className="text-[10px] text-cofounder-blue font-mono tracking-widest uppercase font-bold -mt-0.5 group-hover:text-dark-charcoal transition-colors">
                Asset Auditing Console
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8 text-[15px] font-bold" aria-label="Main Navigation">
            <button 
              onClick={() => handleNavClick('landing')} 
              className="text-[#333333] hover:text-cofounder-blue transition-colors cursor-pointer tracking-tight focus:outline-none"
            >
              Home
            </button>

            {/* Asset Types Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setShowAssetTypes(true)}
              onMouseLeave={() => setShowAssetTypes(false)}
            >
              <button 
                onClick={() => setShowAssetTypes(!showAssetTypes)}
                className="flex items-center gap-1 text-[#333333] hover:text-cofounder-blue transition-colors cursor-pointer tracking-tight focus:outline-none"
              >
                <span>Asset Types</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAssetTypes ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showAssetTypes && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] border border-slate-100 p-2.5 z-50 space-y-1 text-left"
                  >
                    {assetTypes.map((type) => (
                      <div
                        key={type.name}
                        onClick={() => {
                          if (type.status === 'active') {
                            handleNavClick('landing');
                            setTimeout(() => {
                              document.getElementById('search-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }
                          setShowAssetTypes(false);
                        }}
                        className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                          type.status === 'active'
                            ? 'hover:bg-slate-50 cursor-pointer text-[#171717]'
                            : 'text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-[13px] font-bold tracking-tight">{type.name}</span>
                        {type.status === 'coming' && (
                          <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-450 px-2.5 py-0.5 rounded-full font-bold select-none tracking-wide">
                            Coming soon
                          </span>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => handleNavClick('landing', 'how-it-works')} 
              className="text-[#333333] hover:text-cofounder-blue transition-colors cursor-pointer tracking-tight focus:outline-none"
            >
              Methodology
            </button>
            <button 
              onClick={() => handleNavClick('landing', 'pipeline-viz')} 
              className="text-[#333333] hover:text-cofounder-blue transition-colors cursor-pointer tracking-tight focus:outline-none"
            >
              Auditing Process
            </button>


            {currentUser?.isAuthenticated && (
              <button 
                onClick={() => handleNavClick('dashboard')} 
                className={`transition-colors cursor-pointer tracking-tight ${currentView === 'dashboard' ? 'text-cofounder-blue font-extrabold underline decoration-2 underline-offset-4' : 'text-[#333333] hover:text-cofounder-blue'}`}
                id="navbar-item-workspace"
              >
                Asset Workspace
              </button>
            )}

            {currentUser?.isAuthenticated && currentUser.role === 'admin' && (
              <button 
                onClick={() => handleNavClick('admin')} 
                className={`transition-colors cursor-pointer text-xs font-mono uppercase border border-cofounder-blue px-2.5 py-1 rounded bg-cofounder-blue/5 ${currentView === 'admin' ? 'text-[#171717] border-[#171717] font-semibold' : 'text-cofounder-blue hover:bg-cofounder-blue/10'}`}
                id="navbar-item-admin"
              >
                Control Unit
              </button>
            )}
          </nav>

          {/* Action Controls */}
          <div className="hidden md:flex items-center space-x-4">
            <AnimatePresence mode="wait">
              {!currentUser?.isAuthenticated && (
                <div key="unauthed" className="flex items-center">
                  <button
                    onClick={() => {
                      handleNavClick('landing');
                      setTimeout(() => {
                        document.getElementById('search-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className="px-6 py-2.5 text-xs rounded-full bg-gradient-to-r from-cofounder-blue via-[#1785be] to-action-azure hover:scale-[1.03] text-white shadow-[0_8px_20px_rgba(0,129,192,0.18)] transition-all duration-200 cursor-pointer font-bold uppercase tracking-widest border border-white/20"
                    id="navbar-signup-btn"
                  >
                    Launch Search
                  </button>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Navigation Trigger */}
          <div className="flex md:hidden items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#646464] hover:text-[#171717] focus:outline-none focus:ring-1 focus:ring-cofounder-blue rounded-lg border border-steel-gray/30 cursor-pointer"
              aria-label="Toggle Menu"
              aria-expanded={mobileMenuOpen}
              id="navbar-mobile-trigger"
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
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="md:hidden navbar-glass overflow-hidden rounded-b-2xl mt-1 shadow-lg"
              id="navbar-mobile-drawer"
            >
              <div className="px-4 py-6 space-y-4">
                <button
                  onClick={() => handleNavClick('landing')}
                  className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2 cursor-pointer focus:outline-none font-bold"
                >
                  Home
                </button>

                {/* Mobile Asset Types Accordion */}
                <div className="space-y-1">
                  <button
                    onClick={() => setMobileAssetTypesOpen(!mobileAssetTypesOpen)}
                    className="flex items-center justify-between w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2 cursor-pointer focus:outline-none font-bold"
                  >
                    <span>Asset Types</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileAssetTypesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileAssetTypesOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-3 space-y-1 border-l border-slate-100 overflow-hidden"
                      >
                        {assetTypes.map((type) => (
                          <div
                            key={type.name}
                            onClick={() => {
                              if (type.status === 'active') {
                                setMobileMenuOpen(false);
                                handleNavClick('landing');
                                setTimeout(() => {
                                  document.getElementById('search-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 150);
                              }
                            }}
                            className={`flex items-center justify-between py-2.5 text-xs font-bold ${
                              type.status === 'active'
                                ? 'text-slate-800 cursor-pointer'
                                : 'text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <span>{type.name}</span>
                            {type.status === 'coming' && (
                              <span className="text-[9px] bg-slate-50 border border-slate-100 text-slate-450 px-2.5 py-0.5 rounded-full font-bold">
                                Coming soon
                              </span>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => handleNavClick('landing', 'how-it-works')}
                  className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2 cursor-pointer focus:outline-none"
                >
                  Methodology
                </button>
                <button
                  onClick={() => handleNavClick('landing', 'pipeline-viz')}
                  className="block w-full text-left text-sm text-[#646464] hover:text-[#171717] py-2 cursor-pointer focus:outline-none"
                >
                  Process
                </button>


                {currentUser?.isAuthenticated ? (
                  <>
                    <div className="h-[1px] bg-steel-gray/20 my-2" />
                    <button
                      onClick={() => handleNavClick('dashboard')}
                      className="block w-full text-left text-sm text-[#171717] py-2 font-medium flex items-center justify-between cursor-pointer"
                    >
                      <span>Workspace Console</span>
                      <ChevronRight className="w-4 h-4 text-cofounder-blue" />
                    </button>
                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => handleNavClick('admin')}
                        className="block w-full text-left text-sm text-cofounder-blue font-mono py-2 flex items-center justify-between cursor-pointer"
                      >
                        <span>CONTROL UNIT</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-[1px] bg-steel-gray/20 my-2" />
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleNavClick('landing');
                          setTimeout(() => {
                            document.getElementById('search-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 150);
                        }}
                        className="w-full text-center text-sm py-3 rounded-xl text-white bg-gradient-to-r from-cofounder-blue to-action-azure hover:opacity-95 font-bold cursor-pointer shadow-[0_4px_12px_rgba(0,129,192,0.15)] uppercase tracking-wider"
                      >
                        Launch Registry Search
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
