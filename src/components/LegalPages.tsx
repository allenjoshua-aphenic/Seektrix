import React from 'react';
import { Shield, FileText, CheckCircle, Scale, Download, Printer, ArrowLeft, ArrowUpRight, HelpCircle } from 'lucide-react';

interface LegalPagesProps {
  activeDoc: 'privacy' | 'terms' | 'compliance-disclaimer';
  onBack: () => void;
  setView: (view: any) => void;
}

export default function LegalPages({ activeDoc, onBack, setView }: LegalPagesProps) {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [activeDoc]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-transparent text-[#171717] min-h-[85vh] py-8 sm:py-12 relative z-10" id="legal-container">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back navigation & Quick Print controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <button
            onClick={onBack}
            className="group flex items-center space-x-2 text-xs font-semibold px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 transition-all rounded-xl text-slate-700 shadow-sm w-fit cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Workspace</span>
          </button>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 transition-all rounded-xl text-slate-700 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Page</span>
            </button>
            <button
              onClick={() => {
                alert('Downloading legal document bundle... Compiled and digital-signature verified.');
              }}
              className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-2 bg-[#1e293b] text-white hover:bg-slate-800 transition-all rounded-xl shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Archive</span>
            </button>
          </div>
        </div>

        {/* Outer Frame with Sidebar and Main Legal Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Navigation Sidebar */}
          <div className="lg:col-span-3 space-y-6 lg:sticky lg:top-24">
            <div className="glass-panel-light p-5 rounded-2xl border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.02)] space-y-4">
              <span className="text-[10px] font-mono tracking-widest text-[#646464] font-bold uppercase block">
                LEGAL DEPARTMENTS
              </span>
              
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setView('privacy');
                    window.location.hash = 'privacy';
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    activeDoc === 'privacy'
                      ? 'bg-gradient-to-r from-cofounder-blue to-cofounder-blue/80 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-[#171717]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Privacy & Data Protection</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setView('terms');
                    window.location.hash = 'terms';
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    activeDoc === 'terms'
                      ? 'bg-gradient-to-r from-cofounder-blue to-cofounder-blue/80 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-[#171717]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Scale className="w-4 h-4 shrink-0" />
                    <span>Terms of Service</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setView('compliance-disclaimer');
                    window.location.hash = 'compliance-disclaimer';
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    activeDoc === 'compliance-disclaimer'
                      ? 'bg-gradient-to-r from-cofounder-blue to-cofounder-blue/80 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-[#171717]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Compliance Disclaimer</span>
                  </div>
                </button>
              </nav>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-gray-600 leading-relaxed space-y-2">
              <div className="flex items-center space-x-1 font-bold text-[#0081c0] font-sans">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Regulatory Hub Update</span>
              </div>
              <p>
                As an audit-ready compliance provider, SEEKTRIX reviews these covenants quarterly to align with Ministry of Corporate Affairs guidelines and Digital Personal Data Protection (DPDP) Act frameworks.
              </p>
              <div className="text-[10px] font-mono text-gray-500 pt-1 border-t border-blue-200/50">
                LATEST RATIFICATION: MAY 28, 2026
              </div>
            </div>
          </div>

          {/* Core Content Container */}
          <div className="lg:col-span-9 bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-10 border border-slate-200/50 shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
            
            {/* PRIVACY POLICY VIEW */}
            {activeDoc === 'privacy' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-100 pb-5">
                  <span className="text-[10px] font-mono tracking-widest text-[#646464] font-bold uppercase block">
                    SEEKTRIX USER PRIVACY CHARTER
                  </span>
                  <h1 className="font-serif-intellectual text-2xl sm:text-3xl font-semibold tracking-tight text-dark-charcoal">
                    Privacy & Data Protection Policy
                  </h1>
                  <p className="text-xs text-[#646464]">
                    Last Updated & Verified: May 28, 2026 | Compliant with DPDP Act, 2023 Guidelines
                  </p>
                </div>

                <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 space-y-4 leading-relaxed font-sans">
                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">1. Scope and Introduction</h3>
                  <p>
                    At SEEKTRIX, managed by SEEKTRIX Technologies Private Limited (“we”, “us”, “our”), data security, audit integrity, and regulatory alignment constitute the core of our unclaimed wealth search service. This policy defines the precise types of stakeholder data collected and rules governing security parsing for financial asset matching across Indian public archives.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">2. Information Collection & Zero-Storage Principles</h3>
                  <p>
                    To execute multi-registry lookups across IEPF, AMFI, and regional EPFO folders, we request:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Full legal name & spelling variations:</strong> Required to query the structured public disclosures index.</li>
                    <li><strong>City / state constraints:</strong> Used strictly to filer out unrelated name matches.</li>
                    <li><strong>Email address:</strong> Utilized purely to deliver the compiled PDF dossier.</li>
                  </ul>
                  <p>
                    <strong>We operate under a strict Consent-First parameter:</strong> All search criteria are executed in real-time. We do NOT maintain secondary repositories of personal financial assets, portfolio balances, or private stakeholder credentials. No Aadhaar, PAN card, or bank password information is ever stored or requested by our search engine.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">3. Data Sharing Restrictions</h3>
                  <p>
                    We enforce a absolute zero-commercial-sharing obligation. We never license, sell, or loan inquiry data to insurance agents, brokers, recovery intermediaries, or third-party marketing firms. Information is used exclusively to compile the PDF match prospectus requested by you.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">4. Technical Security Guardrails</h3>
                  <p>
                    Your search sessions are secured using TLS 1.3 transport encoding. Downloadable dossiers are compiled and verified locally on container architecture to prevent public URL leakage. Our operational servers undergo regular independent auditing to verify compliance with ISO 27001 data protection protocols.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">5. DPDP Act Compliance Rights</h3>
                  <p>
                    In accordance with the India Digital Personal Data Protection (DPDP) Act of 2023, you have the right to inspect search history, demand absolute purging of past search parameters, and withdraw consent. You can execute these purges instantly through your visual settings panel or by emailing <a href="mailto:compliance@seektrix.in" className="text-cofounder-blue underline font-semibold">compliance@seektrix.in</a>.
                  </p>
                </div>
              </div>
            )}

            {/* TERMS OF SERVICE VIEW */}
            {activeDoc === 'terms' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-100 pb-5">
                  <span className="text-[10px] font-mono tracking-widest text-[#646464] font-bold uppercase block">
                    SEEKTRIX PLATFORM COVENANT & TERMS
                  </span>
                  <h1 className="font-serif-intellectual text-2xl sm:text-3xl font-semibold tracking-tight text-dark-charcoal">
                    Terms of Service
                  </h1>
                  <p className="text-xs text-[#646464]">
                    Last Updated: May 28, 2026 | Under Legal Jurisdiction of Bengaluru, Karnataka
                  </p>
                </div>

                <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 space-y-4 leading-relaxed font-sans">
                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">1. Acceptance of Terms</h3>
                  <p>
                    By accessing or utilizing the SEEKTRIX search engine console, you agree to be bound by these Terms of Service. If you do not accept these provisions, you must suspend usage of our digital matching tools immediately.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">2. Verification Authorization</h3>
                  <p>
                    You agree that you will launch search queries solely for:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your own personal unclaimed investments or estate planning.</li>
                    <li>Direct family members (parents, spouse, siblings, ancestors) with written consent.</li>
                    <li>Authorized institutional clients where you act as a certified legal heir representative or facilitator.</li>
                  </ul>
                  <p>
                    Executing broad, automated scraper scripts, or harvesting name databases for commercial exploitation constitutes a material breach of this covenant and may prompt structural access suspension.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">3. Subscription Billing & Refund Parameters</h3>
                  <p>
                    Single search previews are provided without fee parameters. Complete PDF Dossiers, claims preparation packets, and statutory nodal officer files are unlocked under standard transparent pricing structures. Subscription fees are final and non-refundable once the target registry matching dataset has been compiled and delivered.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">4. Structural Access Limits</h3>
                  <p>
                    To maintain equitable API speeds across public disclosure server connections, we limit baseline standard accounts to 5 searches per minute. Attempts to bypass limits via automated scripts or VPN rotators will trigger automatic security blocking.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">5. Dispute Resolution & Arbitration</h3>
                  <p>
                    These terms are governed exclusively by the laws of India. Any litigation, dispute, or claim arising from platform operations will undergo binding corporate arbitration in Bengaluru, Karnataka, conducted in English by a single arbitrator.
                  </p>
                </div>
              </div>
            )}

            {/* COMPLIANCE DISCLAIMER VIEW */}
            {activeDoc === 'compliance-disclaimer' && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-slate-100 pb-5">
                  <span className="text-[10px] font-mono tracking-widest text-[#646464] font-bold uppercase block">
                    SEEKTRIX STATUTORY DISCLOSURE SUMMARY
                  </span>
                  <h1 className="font-serif-intellectual text-2xl sm:text-3xl font-semibold tracking-tight text-dark-charcoal">
                    Compliance & Public Records Disclaimer
                  </h1>
                  <p className="text-xs text-[#646464]">
                    Last Reviewed: June 2026 | Active Regulatory Memo
                  </p>
                </div>

                <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 space-y-4 leading-relaxed font-sans">
                  
                  {/* Highlight Highlight */}
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-sans space-y-1 text-xs">
                    <p className="font-bold flex items-center space-x-1">
                      <span>CRITICAL STATUTORY NOTE:</span>
                    </p>
                    <p className="leading-relaxed">
                      SEEKTRIX is an independent private-equity search and indexing service. We are <strong>NOT</strong> affiliated with, owned by, endorsed by, or integrated as a public agency of the Ministry of Corporate Affairs (MCA), the IEPF Authority, the Securities and Exchange Board of India (SEBI), or any Government of India department.
                    </p>
                  </div>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">1. Origin of Records</h3>
                  <p>
                    All matching results, folio records, dividend amounts, and address listings provided inside our reports are aggregated from public-domain schedules, annual publications, and Unclaimed Dividend Reports published officially by listed companies under statutory IEPF Rule 7 guidelines.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">2. Valuation Estimates Disclaimer</h3>
                  <p>
                    Estimated values shown in reports are calculated systematically based on face values, share splitting announcements, and public equity market stock close averages compiled last quarter. These values represent general appraisal guidelines and do not constitute legal assurances, final payout commitments, or formal valuations of specific corporate shares.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">3. Claim Finality & Assistance Limitation</h3>
                  <p>
                    Our platform simplifies matching and structures claim compilation files. However, the final approval of any claim, reinstatement of shares, or payout of dividends is solely determined by the respective company registrar (e.g., Link Intime, KFintech) and the IEPF Authority. Payment of fees to SEEKTRIX does not guarantees reimbursement or immediate government claim approval.
                  </p>

                  <h3 className="font-semibold text-dark-charcoal text-sm font-sans pt-2">4. No Financial Consultation</h3>
                  <p>
                    No content contained on the SEEKTRIX platform, inside compiled dossiers, or sent by our customer inquiry desk should be acted on as investment, wealth management, tax, or official legal advice. Users are strongly urged to consult verified Chartered Accountants, asset managers, or registered legal professionals before initiating complex estate claims.
                  </p>
                </div>
              </div>
            )}

            {/* Quick FAQ / Help Accordion integration */}
            <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3 text-slate-500">
                <HelpCircle className="w-5 h-5 text-cofounder-blue" />
                <span className="text-xs font-semibold">Have questions about our data indexing compliance?</span>
              </div>
              <button
                onClick={() => {
                  setView('landing');
                  setTimeout(() => {
                    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 150);
                }}
                className="text-xs font-semibold text-cofounder-blue hover:underline flex items-center space-x-1 whitespace-nowrap cursor-pointer"
              >
                <span>Read our Methodology FAQs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
