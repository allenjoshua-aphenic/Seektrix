import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Mail, Key, Shield, Landmark, ArrowLeft, AlertCircle, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminLogin() {
  const { login, setView, addToast } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (email.trim() === 'discoverinseektrix@gmail.com' && password === 'Serena@123') {
        login('Serena Admin', 'discoverinseektrix@gmail.com', 'Bengaluru HQ', 'admin');
        setView('admin');
        addToast(
          'Authority Handshake Completed',
          'Administrator console unlocked and initialized successfully.',
          'success'
        );
      } else {
        setError('Invalid administrative security key or password signature.');
      }
    }, 800);
  };

  const handleQuickDemoLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login('Chief Compliance Auditor', 'discoverinseektrix@gmail.com', 'New Delhi HQ', 'admin');
      setView('admin');
      addToast(
        'Sandbox Session Initialized',
        'Logged in as Chief Compliance Auditor.',
        'success'
      );
    }, 600);
  };

  return (
    <section className="min-h-[85vh] flex items-center justify-center bg-transparent text-[#171717] pt-8 pb-20 px-4 relative overflow-hidden" id="admin-login-page">
      {/* Decorative radial gradients */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cofounder-blue/5 blur-[130px] pointer-events-none -top-10 -right-10" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none -bottom-20 -left-10" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Navigation back */}
        <button 
          onClick={() => setView('landing')}
          className="flex items-center space-x-2 text-xs font-mono text-slate-gray hover:text-dark-charcoal transition-colors cursor-pointer group"
          id="admin-login-back-btn"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Return to Seektrix Home</span>
        </button>

        {/* Branding header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-cofounder-blue to-[#1f1f29] flex items-center justify-center text-white shadow-xl">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="font-serif-intellectual text-2xl font-bold tracking-tight text-dark-charcoal">
              Auditor Command Center
            </h1>
            <p className="text-xs text-medium-gray font-sans font-medium">
              Institutional verification node for compliance, registry and treasury audits.
            </p>
          </div>
        </div>

        {/* Card Panel */}
        <div className="glass-panel-light p-6 sm:p-8 rounded-3xl border border-white/70 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.05),inset_0_1px_2.5px_rgba(255,255,255,0.9)] relative">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cofounder-blue via-action-azure to-cofounder-blue rounded-t-3xl" />

          {/* Verification Badge */}
          <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-wider text-cofounder-blue font-bold mb-6 bg-cofounder-blue/5 border border-cofounder-blue/10 px-3 py-1.5 rounded-xl w-fit">
            <Shield className="w-3.5 h-3.5 text-cofounder-blue" />
            <span>ISO 27001 Cryptographic Handshake</span>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-800 text-[11px] font-mono flex items-start space-x-2 mb-4"
              id="admin-login-error"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-gray font-bold block">
                Security Email Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input 
                  type="email"
                  required
                  placeholder="discoverinseektrix@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#f9faf8] border border-[#dee2df] rounded-xl py-3 pl-10 pr-4 text-xs text-dark-charcoal placeholder-gray-400 focus:bg-white focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-mono"
                  id="admin-page-email-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-gray font-bold block">
                Console Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Key className="w-4 h-4" />
                </div>
                <input 
                  type="password"
                  required
                  placeholder="Serena@123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f9faf8] border border-[#dee2df] rounded-xl py-3 pl-10 pr-4 text-xs text-dark-charcoal placeholder-gray-400 focus:bg-white focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-mono"
                  id="admin-page-password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cofounder-blue hover:bg-action-azure transition-all duration-200 text-white rounded-xl text-xs font-mono font-bold tracking-wider flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-cofounder-blue/15 mt-2 disabled:opacity-50"
              id="admin-page-login-submit-btn"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>AUTHENTICATE CONSOLE</span>
                </>
              )}
            </button>
          </form>

          {/* Quick sandbox access block */}
          <div className="mt-6 pt-5 border-t border-gray-200/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-gray font-bold">
                Institutional Sandbox
              </span>
              <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-semibold">
                Available
              </span>
            </div>
            <p className="text-[11px] text-[#646464] font-sans leading-relaxed">
              If you are testing or reviewing the Auditor Panel, bypass physical keys with the sandbox override link below.
            </p>
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="w-full py-2 border border-dashed border-cofounder-blue/30 hover:border-cofounder-blue bg-cofounder-blue/5 hover:bg-cofounder-blue/10 text-cofounder-blue transition-all duration-200 rounded-xl text-[10px] font-mono font-bold tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer"
              id="admin-page-sandbox-btn"
            >
              <span>BYPASS AUTH WITH DEMO KEYS</span>
            </button>
          </div>

        </div>

        {/* Administrative notice */}
        <div className="flex items-start space-x-2 text-[10px] text-slate-gray bg-white/40 p-4 rounded-2xl border border-white/50 backdrop-blur-xs">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-sans font-light">
            SEEKTRIX commands are logged and audited. Unauthorized attempts to interface with IEPF registers or treasury ledgers are subject to standard verification protocols.
          </p>
        </div>

      </div>
    </section>
  );
}
