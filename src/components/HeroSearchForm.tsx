import React, { useState } from 'react';
import { User, MapPin, Mail, ArrowRight, Shield } from 'lucide-react';

interface HeroSearchFormProps {
  onSubmit: (fullName: string, city: string, email: string) => void;
  isLoading?: boolean;
}

export default function HeroSearchForm({ onSubmit, isLoading = false }: HeroSearchFormProps) {
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !city.trim() || !email.trim()) {
      setErrorMsg('All parameters (Full Name, City Scope, Contact Email) are mandatory to query matching registers.');
      return;
    }
    setErrorMsg('');
    onSubmit(fullName.trim(), city.trim(), email.trim());
  };

  return (
    <div className="glass-panel-light p-6 sm:p-8 rounded-2xl shadow-[0_30px_70px_-10px_rgba(0,0,0,0.1),0_10px_30px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.9)] border-white/75 relative text-[#171717]" id="hero-search-form-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Holder Name */}
          <div className="relative">
            <label className="block text-[10px] font-semibold font-mono tracking-wider text-[#646464] uppercase mb-1.5">
              Full Investment Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#646464]/60">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Ramesh Chandra Sen"
                className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-3 pl-10 pr-4 text-sm text-[#171717] placeholder-[#646464]/50 focus:bg-white/85 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                id="search-form-fullname"
              />
            </div>
          </div>

          {/* Regional City Scope */}
          <div className="relative">
            <label className="block text-[10px] font-semibold font-mono tracking-wider text-[#646464] uppercase mb-1.5">
              City / State Scope
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#646464]/60">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Mumbai, Maharashtra"
                className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-3 pl-10 pr-4 text-sm text-[#171717] placeholder-[#646464]/50 focus:bg-white/85 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
                id="search-form-city"
              />
            </div>
          </div>
        </div>

        {/* Audit Verification Email Address */}
        <div className="relative">
          <label className="block text-[10px] font-semibold font-mono tracking-wider text-[#646464] uppercase mb-1.5">
            Audit Notification Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#646464]/60">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="e.g. ramesh.sen@outlook.com"
              className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-xl py-3 pl-10 pr-4 text-sm text-[#171717] placeholder-[#646464]/50 focus:bg-white/85 focus:border-cofounder-blue focus:ring-4 focus:ring-cofounder-blue/10 focus:outline-none transition-all font-sans shadow-[0_4px_12px_rgba(0,0,0,0.015),inset_0_1px_1px_rgba(255,255,255,0.85)]"
              id="search-form-email"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-600 font-medium font-mono" id="search-form-error">{errorMsg}</p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3">
          <div className="flex items-center space-x-2 text-xs text-[#646464]">
            <Shield className="w-4 h-4 text-cofounder-blue shrink-0" />
            <span className="font-sans font-medium text-[#4b5563]">Client-side encryption / AES-256 compliant.</span>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cofounder-blue/90 via-cofounder-blue to-[#41a1cf]/90 backdrop-blur-md hover:from-cofounder-blue hover:to-[#41a1cf] text-white text-sm font-semibold tracking-wide shadow-[0_12px_30px_rgba(0,129,192,0.22),inset_0_1.5px_1px_rgba(255,255,255,0.4)] flex items-center justify-center space-x-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed border border-white/40"
            id="search-form-submit-btn"
          >
            <span>{isLoading ? 'Booting Secure Pipeline...' : 'Search Registries'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>
    </div>
  );
}
