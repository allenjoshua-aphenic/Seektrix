import React from 'react';
import { Landmark, Shield, Mail, Phone, ExternalLink, Lock, Key } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function Footer() {
  const { logout, setView, currentUser, addToast } = useAppStore();

  return (
    <footer className="bg-white/40 border-t border-white/50 backdrop-blur-xs py-10 px-4 sm:px-6 lg:px-8 mt-auto text-xs text-slate-gray">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Brand Info */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-cofounder-blue to-[#1f1f29] text-white flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="font-serif-intellectual font-semibold tracking-wider text-[#171717] text-md">SEEKTRIX</span>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed font-sans max-w-sm">
            SEEKTRIX is an independent compliance and fintech auditing platform. We aggregate and index publicly available unclaimed asset rosters from official registers across India to help investors recover legacy wealth.
          </p>
          <div className="flex items-center space-x-2.5 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded w-fit font-semibold border border-emerald-100">
            <Shield className="w-3.5 h-3.5" />
            <span>Designed with ISO 27001 aligned security practices & audit-ready workflows</span>
          </div>
        </div>

        {/* Links */}
        <div className="md:col-span-4 grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-mono text-[10px] uppercase font-bold text-dark-charcoal tracking-wider mb-2">Platform</h3>
            <ul className="space-y-1.5 font-medium text-[11px]">
              <li><a href="#how-it-works" className="hover:text-cofounder-blue transition-colors">Methodology</a></li>
              <li><a href="#pipeline-viz" className="hover:text-cofounder-blue transition-colors">Audit Pipeline</a></li>
              <li><span className="text-gray-400">SaaS API Integration (Coming soon)</span></li>
            </ul>
          </div>
          <div>
            <h3 className="font-mono text-[10px] uppercase font-bold text-dark-charcoal tracking-wider mb-2">Legal</h3>
            <ul className="space-y-1.5 font-medium text-[11px]">
              <li>
                <a 
                  href="#privacy" 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-cofounder-blue cursor-pointer transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="#terms" 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-cofounder-blue cursor-pointer transition-colors"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a 
                  href="#compliance-disclaimer" 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-cofounder-blue cursor-pointer transition-colors"
                >
                  Compliance Disclaimer
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Support hub */}
        <div className="md:col-span-3 space-y-3 font-medium">
          <h3 className="font-mono text-[10px] uppercase font-bold text-dark-charcoal tracking-wider">Support Hub</h3>
          <p className="text-[11px] leading-relaxed text-gray-500">
            Bengaluru Registrar Operations Hub:
          </p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center space-x-2">
              <Mail className="w-3.5 h-3.5 text-cofounder-blue shrink-0" />
              <span>compliance@seektrix.in</span>
            </div>
            <div className="flex items-center space-x-2">
              <Phone className="w-3.5 h-3.5 text-cofounder-blue shrink-0" />
              <span>+91 (80) 4920-4100</span>
            </div>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto border-t border-gray-200/50 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-400">
        <p>© 2026 SEEKTRIX Technologies Private Limited. All rights registered.</p>
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex items-center space-x-1">
            <span>Disclaimer: We are an independent facilitation provider.</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </p>
          <span className="hidden sm:inline text-gray-300">|</span>
          {currentUser?.role === 'admin' ? (
            <button 
              onClick={() => {
                logout();
                addToast(
                  'Console Key Revoked',
                  'Secure auditor session has been terminated.',
                  'info'
                );
              }}
              className="text-red-500 hover:text-red-600 flex items-center space-x-1 cursor-pointer font-mono text-[10px] uppercase font-bold transition-colors"
              id="footer-admin-console-btn"
              title="Click to automatically terminate secure session"
            >
              <Key className="w-3.5 h-3.5 shrink-0 rotate-180 transition-transform" />
              <span>Admin Console (Logout)</span>
            </button>
          ) : (
            <button 
              onClick={() => setView('admin-login')}
              className="hover:text-cofounder-blue text-gray-400 flex items-center space-x-1 cursor-pointer font-mono text-[10px] uppercase font-bold"
              id="footer-auditor-portal-btn"
            >
              <Lock className="w-3 h-3 text-gray-400 shrink-0" />
              <span>Auditor Portal</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
