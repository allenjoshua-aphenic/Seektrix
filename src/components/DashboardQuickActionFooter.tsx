import React, { useState } from 'react';
import { 
  Landmark, FileText, Shield, ArrowUpRight, ChevronRight, 
  BookOpen, Scale, Award, CheckCircle, Download, ExternalLink, X, HelpCircle, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView } from '../types';

interface DashboardQuickActionFooterProps {
  setView: (view: AppView) => void;
  resultsCount: number;
}

export default function DashboardQuickActionFooter({ setView, resultsCount }: DashboardQuickActionFooterProps) {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'iepf' | 'rbi'>('iepf');
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    'iepf-1': false,
    'iepf-2': false,
    'iepf-3': false,
    'iepf-4': false,
    'iepf-5': false,
    'rbi-1': false,
    'rbi-2': false,
    'rbi-3': false,
    'rbi-4': false,
  });

  const toggleChecklist = (id: string) => {
    setChecklist(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDownloadChecklist = () => {
    alert('Compliance Checklist PDF generated. Verification stamp: VER-2026-SEEK-IEPF.');
  };

  return (
    <div className="w-full mt-10 border-t border-slate-200/70 pt-10 font-sans" id="dashboard-compliance-footer">
      {/* Footer Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#0081c0] font-extrabold">
              Regulatory Compliance Standard
            </span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-dark-charcoal">
            Claiming & Compliance Resource Hub
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Verify active legal charters, learn recovery steps, or access institutional claim filing processes in full compliance with the Ministry of Corporate Affairs, Securities & Exchange Board of India (SEBI), and Reserve Bank of India (RBI) unclaimed deposits rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 select-none">
          <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            IEPF MCA-5 COMPLIANT
          </span>
          <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            RBI UDGAM INTEGRATION
          </span>
        </div>
      </div>

      {/* Grid of Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Interactive Claiming Process */}
        <div 
          onClick={() => setShowClaimModal(true)}
          className="p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#fffbeb] to-[#fef3c7]/65 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
        >
          <div className="space-y-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 w-fit rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-amber-950 uppercase tracking-wide">
              Claiming Process Guide
            </h3>
            <p className="text-[10.5px] text-amber-900/85 leading-relaxed font-semibold">
              Step-by-step procedural breakdown for recovering stocks, dividends, and dormant deposit accounts.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 pt-3 border-t border-amber-200/40">
            <span>Launch Guide Assistant</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Compliance Disclaimer */}
        <div 
          onClick={() => {
            setView('compliance-disclaimer');
            window.location.hash = 'compliance-disclaimer';
          }}
          className="p-5 rounded-2xl border border-slate-200/70 bg-white shadow-3xs hover:shadow-md hover:scale-[1.02] hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
        >
          <div className="space-y-2">
            <div className="p-2 bg-slate-100 text-slate-700 w-fit rounded-xl">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-850 uppercase tracking-wide">
              Compliance Charter
            </h3>
            <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium">
              Read our technical standard alignment under Clause 39 of SEBI and the Digital Personal Data Protection Act.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 pt-3 border-t border-slate-100">
            <span>View SEBI Charter</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 3: Privacy Policy */}
        <div 
          onClick={() => {
            setView('privacy');
            window.location.hash = 'privacy';
          }}
          className="p-5 rounded-2xl border border-slate-200/70 bg-white shadow-3xs hover:shadow-md hover:scale-[1.02] hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
        >
          <div className="space-y-2">
            <div className="p-2 bg-slate-100 text-slate-700 w-fit rounded-xl">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-850 uppercase tracking-wide">
              Privacy Policy
            </h3>
            <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium">
              Understand how search inputs and cached ledger files are permanently protected and purged on demand.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 pt-3 border-t border-slate-100">
            <span>Read Privacy Policy</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 4: Terms of Service */}
        <div 
          onClick={() => {
            setView('terms');
            window.location.hash = 'terms';
          }}
          className="p-5 rounded-2xl border border-slate-200/70 bg-white shadow-3xs hover:shadow-md hover:scale-[1.02] hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
        >
          <div className="space-y-2">
            <div className="p-2 bg-slate-100 text-slate-700 w-fit rounded-xl">
              <Scale className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-850 uppercase tracking-wide">
              Terms of Service
            </h3>
            <p className="text-[10.5px] text-slate-500 leading-relaxed font-medium">
              Legal guidelines governing independent physical share tracing assistance and IEPF verification.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 pt-3 border-t border-slate-100">
            <span>Review Legal Terms</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Trust Ledger Summary Strips */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50/65 border border-slate-200/80 text-[11px] font-sans text-slate-600">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold text-slate-750">
            Found {resultsCount} verifiable public registries matching search parameters.
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase text-slate-400 select-none">
          <span>IEPF.GOV.IN REGISTER GATEWAY STATUS:</span>
          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">ONLINE</span>
        </div>
      </div>

      {/* Claim Guide Modal (AnimatePresence) */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" id="claim-guide-backdrop">
            {/* Backdrop blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" 
              onClick={() => setShowClaimModal(false)}
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-[0_30px_90px_-10px_rgba(0,0,0,0.35)] border border-slate-200 overflow-hidden relative z-10 text-left flex flex-col max-h-[85vh]"
              id="claim-guide-container"
            >
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-[#0081c0]/10 border border-[#0081c0]/20 rounded-lg text-[#0081c0]">
                    <Landmark className="w-5 h-5 text-[#0081c0]" />
                  </div>
                  <div>
                    <h3 className="font-sans font-extrabold text-sm text-[#171717] tracking-tight uppercase">
                      Official Claim Procedure Guide
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Procedural instructions in compliance with IEPF & RBI frameworks</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowClaimModal(false)}
                  className="p-1.5 hover:bg-slate-200/85 text-slate-400 hover:text-slate-700 transition-colors rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-Tabs Selector */}
              <div className="bg-white border-b border-slate-150 px-6 py-3.5 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('iepf')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'iepf'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  IEPF Shares & Dividends Claim (MCA)
                </button>
                <button
                  onClick={() => setActiveTab('rbi')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'rbi'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  RBI Unclaimed Bank Deposits (UDGAM)
                </button>
              </div>

              {/* Body Content with Scroll */}
              <div className="overflow-y-auto p-6 space-y-6 flex-grow text-xs sm:text-sm text-slate-700">
                {activeTab === 'iepf' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Overview of IEPF Rule 7 Claim Procedure
                      </h4>
                      <p className="text-slate-600 leading-relaxed font-sans font-medium text-[11.5px]">
                        Any shares or unpaid dividends remaining unclaimed for 7 consecutive years are transferred to the Government of India's IEPF Authority under Section 124(6) of the Companies Act, 2013. The original claimant can recover them using the following online and offline procedure.
                      </p>
                    </div>

                    {/* Step-by-Step interactive process */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-mono tracking-widest text-slate-400 font-bold uppercase">
                        Interactive Claim Roadmap
                      </h5>

                      <div className="space-y-3">
                        {/* Step 1 */}
                        <div 
                          onClick={() => toggleChecklist('iepf-1')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['iepf-1'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['iepf-1']}
                            onChange={() => {}} // toggled by outer click
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block font-sans">
                              Step 1: Check Folio Records & Current Valuation
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Extract the verified Folio Number, Company Name, Registrar address, and Share count from your Seektrix PDF Dossier.
                            </span>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div 
                          onClick={() => toggleChecklist('iepf-2')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['iepf-2'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['iepf-2']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 2: Complete Demat & KYC Prerequisites
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Ensure your PAN card, Aadhaar card, and current demat account are active, mapped, and linked with correct name configurations.
                            </span>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div 
                          onClick={() => toggleChecklist('iepf-3')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['iepf-3'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['iepf-3']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 3: Online filing of Web Form IEPF-5
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Log in to the MCA Portal (mca.gov.in), fill the online web form IEPF-5 with bank/demat coordinates, pay the zero fee, and download the auto-generated acknowledgement receipt.
                            </span>
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div 
                          onClick={() => toggleChecklist('iepf-4')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['iepf-4'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['iepf-4']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 4: Send Physical Claim Package to Nodal Officer
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Send a physical set consisting of: Printed IEPF-5 form, Original Share Certificates, Notarized Indemnity Bond on non-judicial stamp paper, and self-attested KYC copies directly to the concerned company's registered Nodal Officer.
                            </span>
                          </div>
                        </div>

                        {/* Step 5 */}
                        <div 
                          onClick={() => toggleChecklist('iepf-5')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['iepf-5'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['iepf-5']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 5: Corporate Review & Authority Approval
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              The company verifies and submits an online Verification Report to the IEPF Authority. The Authority then reviews, sanctions, and transfers the shares/refund directly to your demat and bank account.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Overview of RBI Unclaimed Deposits Framework
                      </h4>
                      <p className="text-slate-600 leading-relaxed font-sans font-medium text-[11.5px]">
                        Savings or current bank accounts that remain inoperative for 10 years, or fixed/recurring deposits unclaimed for 10 years from the maturity date, are classified as "Unclaimed Deposits" and transferred to RBI's Depositor Education and Awareness (DEA) Fund. Claimants can recover these funds securely.
                      </p>
                    </div>

                    {/* Step-by-Step interactive process */}
                    <div className="space-y-4">
                      <h5 className="text-[11px] font-mono tracking-widest text-slate-400 font-bold uppercase">
                        Interactive Claim Roadmap
                      </h5>

                      <div className="space-y-3">
                        {/* RBI Step 1 */}
                        <div 
                          onClick={() => toggleChecklist('rbi-1')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['rbi-1'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['rbi-1']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 1: Check Bank Name & Account Details
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Note down the bank branch, account folder, and approximate outstanding deposit value from your search results.
                            </span>
                          </div>
                        </div>

                        {/* RBI Step 2 */}
                        <div 
                          onClick={() => toggleChecklist('rbi-2')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['rbi-2'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['rbi-2']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 2: Search Verification on RBI UDGAM Portal
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Access RBI's centralized portal "UDGAM" (Unclaimed Deposits Gateway to Access Information) to generate an official verification slip.
                            </span>
                          </div>
                        </div>

                        {/* RBI Step 3 */}
                        <div 
                          onClick={() => toggleChecklist('rbi-3')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['rbi-3'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['rbi-3']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 3: File Bank Claim Application
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Visit the parent bank's branch or access their NRI/Domestic unclaimed deposit form online. Fill claimant details, nominee details (if applicable), and bank account where credits are desired.
                            </span>
                          </div>
                        </div>

                        {/* RBI Step 4 */}
                        <div 
                          onClick={() => toggleChecklist('rbi-4')}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            checklist['rbi-4'] ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checklist['rbi-4']}
                            onChange={() => {}}
                            className="w-4 h-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="space-y-1 select-none">
                            <span className="text-[11px] font-extrabold text-slate-900 block">
                              Step 4: KYC Verification & Payout
                            </span>
                            <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed block">
                              Submit valid physical KYC (PAN card, Aadhaar card, current photographs) and legacy documents (old passbook, matured FD receipt, or death certificate if claiming as legal heir). The bank resolves the claim and credits your active account within 15-30 days.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-medium select-none">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified with Ministry of Corporate Affairs (MCA) & RBI Guidelines</span>
                </div>
                
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handleDownloadChecklist}
                    className="flex items-center justify-center space-x-1.5 text-xs font-bold px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 transition-all rounded-xl text-slate-700 shadow-sm cursor-pointer w-full sm:w-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Checklist</span>
                  </button>
                  <button
                    onClick={() => setShowClaimModal(false)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer w-full sm:w-auto"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
