import React, { useState } from 'react';
import { User, AppView } from '../types';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Key, ShieldCheck, Landmark } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreensProps {
  onLoginSuccess: (user: User) => void;
  setView: (view: AppView) => void;
}

export default function AuthScreens({ onLoginSuccess, setView }: AuthScreensProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate real server login delay with a premium loader
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess({
        name: name || (userRole === 'admin' ? 'Compliance Administrator' : 'Daniel Manoj'),
        email: email || (userRole === 'admin' ? 'admin@seektrix.gov' : 'danielmanoj2004@gmail.com'),
        city: city || 'Chennai',
        isAuthenticated: true,
        role: userRole
      });
      setView('dashboard');
    }, 1200);
  };

  // One-click quick login for testing/demo auditing - highly helpful for users
  const triggerQuickLogin = (role: 'user' | 'admin') => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === 'admin') {
        onLoginSuccess({
          name: 'Chief Compliance Auditor',
          email: 'auditor.delhi@seektrix.gov.in',
          city: 'New Delhi',
          isAuthenticated: true,
          role: 'admin'
        });
        setView('admin');
      } else {
        onLoginSuccess({
          name: 'Daniel Manoj',
          email: 'danielmanoj2004@gmail.com',
          city: 'Chennai',
          isAuthenticated: true,
          role: 'user'
        });
        setView('dashboard');
      }
    }, 700);
  };

  return (
    <section className="min-h-[75vh] flex items-center justify-center bg-transparent text-[#171717] pt-4 pb-16 px-4 relative overflow-hidden">
      
      {/* Background radial highlight */}
      <div className="absolute w-[450px] h-[450px] rounded-full bg-cofounder-blue/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10" id="auth-main-card">
        
        {/* Subtle branding banner */}
        <div className="text-center space-y-2 mb-8">
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-cofounder-blue to-[#1f1f29] flex items-center justify-center text-off-white shadow-lg mb-3">
            <Landmark className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-serif-intellectual text-2xl font-bold tracking-tight text-dark-charcoal">
            Access SEEKTRIX Engine
          </h2>
          <p className="text-xs text-medium-gray font-sans font-light">
            Decentralized unclaimed financial assets scanner portal for India.
          </p>
        </div>

        {/* Auth form Card */}
        <div className="glass-panel-light p-6 sm:p-8 rounded-2xl border border-white/75 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.05),inset_0_1px_2.5px_rgba(255,255,255,0.9)] relative text-[#171717]">
          
          {/* Quick Sandbox Logins */}
          <div className="glass-sub-floating border border-white/80 p-4 rounded-2xl mb-6 space-y-2 text-center shadow-[0_8px_24px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.7)]">
            <div className="text-[10px] uppercase font-mono tracking-wider text-cofounder-blue flex items-center justify-center space-x-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              <span>Sandbox Access Portal</span>
            </div>
            <p className="text-[11px] text-[#646464] font-sans font-medium">
              Select an institutional profile for instant verification:
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => triggerQuickLogin('user')}
                className="px-3 py-2 bg-white/50 backdrop-blur-xs hover:bg-white/85 text-[10px] font-mono rounded-xl text-cofounder-blue font-bold border border-white/85 shadow-[0_4px_10px_rgba(0,0,0,0.015)] transition-all cursor-pointer"
                id="quick-login-user-btn"
              >
                STANDARD USER
              </button>
              <button
                type="button"
                onClick={() => triggerQuickLogin('admin')}
                className="px-3 py-2 bg-gradient-to-r from-cofounder-blue/85 to-action-azure/85 hover:from-cofounder-blue hover:to-action-azure text-[10px] font-mono rounded-xl text-white font-bold border border-white/45 shadow-[0_4px_10px_rgba(0,129,192,0.15)] transition-all cursor-pointer"
                id="quick-login-admin-btn"
              >
                SYS AUDITOR
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/30" />
            </div>
            <span className="relative px-3 bg-white/40 backdrop-blur-xs rounded-lg text-[10px] font-mono tracking-widest text-[#646464] font-bold uppercase border border-white/30">
              OR MANUAL HANDSHAKE
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            
            {isSignUp && (
              <>
                {/* Your Full Name */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#646464] mb-1.5 font-bold">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ramesh Kumar Sen"
                    className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-2.5 px-3 text-sm text-dark-charcoal placeholder-[#646464]/50 focus:bg-white/80 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                  />
                </div>

                {/* Residential City */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-[#646464] mb-1.5 font-bold">
                    Residential City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai, MH"
                    className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-2.5 px-3 text-sm text-dark-charcoal placeholder-[#646464]/50 focus:bg-white/80 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                  />
                </div>
              </>
            )}

            {/* Email field */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#646464] mb-1.5 font-bold">
                Corporate or Personal Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-medium-gray">
                  <Mail className="w-4 h-4 text-[#646464]/70" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@gmail.com"
                  className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-2.5 pl-9 pr-3 text-sm text-dark-charcoal placeholder-[#646464]/50 focus:bg-white/80 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                  id="auth-input-email"
                />
              </div>
            </div>

            {/* Secret key / Pass phrase */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#646464] mb-1.5 font-bold">
                Encrypted Pass-Phrase
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-medium-gray">
                  <Lock className="w-4 h-4 text-[#646464]/70" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-2.5 pl-9 pr-3 text-sm text-dark-charcoal placeholder-[#646464]/50 focus:bg-white/80 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                  id="auth-input-password"
                />
              </div>
            </div>

            {/* User Role toggle  */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 text-[#646464] cursor-pointer">
                <input
                  type="checkbox"
                  checked={userRole === 'admin'}
                  onChange={(e) => setUserRole(e.target.checked ? 'admin' : 'user')}
                  className="rounded border-white/60 text-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10"
                />
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Request Administrative Role</span>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cofounder-blue/90 via-cofounder-blue to-action-azure/80 text-white text-sm font-semibold tracking-wide flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50 mt-4 border border-white/40 shadow-[0_12px_28px_rgba(0,129,192,0.22),inset_0_1.5px_1px_rgba(255,255,255,0.4)]"
              id="auth-submit-btn"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                  <span className="font-mono text-xs">ESTABLISHING CRYPTO ENCLAVE...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'REGISTER ACCOUNT' : 'SECURE SIGN IN'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Screen Toggler */}
          <div className="border-t border-steel-gray/20 mt-6 pt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-cofounder-blue hover:text-dark-charcoal transition-colors cursor-pointer font-semibold underline"
              id="auth-switch-mode-btn"
            >
              {isSignUp ? 'Already registered? System Sign In' : 'Need new secure tracing indices? Create Account'}
            </button>
          </div>

        </div>

        {/* Global Security Subtext */}
        <p className="text-[10px] font-mono text-center text-slate-gray mt-6 uppercase tracking-widest flex items-center justify-center space-x-1.5 font-bold">
          <Shield className="w-3.5 h-3.5 text-cofounder-blue" />
          <span>FIPS 140-2 LEVEL 3 CRYPTO MODULE AUDITED</span>
        </p>

      </div>
    </section>
  );
}
