import React, { useState } from 'react';
import { FAQS } from '../data';
import { 
  Building2, Cpu, FileCheck, ShieldAlert, Binary, Check, 
  HelpCircle, Mail, ArrowUpRight, ChevronDown, Activity, 
  Search, Lock, EyeOff, FileText, Share2, Database, MapPin,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FAQAccordion from './FAQAccordion';
import Footer from './Footer';

interface LandingSectionsProps {
  onJoinWaitlist: () => void;
  setView: (view: any) => void;
}

export default function LandingSections({ onJoinWaitlist, setView }: LandingSectionsProps) {
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  // Trust agencies we list in premium typography
  const securityAgencies = [
    { label: 'IEPF AUTHORITY', sub: 'Ministry of Corporate Affairs' },
    { label: 'EPF REGISTRY', sub: 'Employees Provident Fund Org' },
    { label: 'SEBI DISCLOSURES', sub: 'Securities & Exchange Board' },
    { label: 'AMFI LEDGER', sub: 'Association of Mutual Funds' },
    { label: 'IRDAI DATA', sub: 'Insurance Unclaimed Registers' }
  ];

  // Pipeline steps for visualization section
  const [activePipelineStep, setActivePipelineStep] = useState(0);
  const pipelineSteps = [
    {
      title: 'Data Collection',
      desc: 'Aggregating multi-source public ledger records, including Corporate IEPF, Mutual Fund Registers, inoperative bank accounts, and LIC policies.',
      icon: Database,
      metrics: '3,842 indexed registries'
    },
    {
      title: 'Record Normalization',
      desc: 'Parsing disparate data tables, unstructured legacy documents, and scanned nested PDFs into a standardized enterprise schema.',
      icon: Cpu,
      metrics: 'High Precision Conversion Schema'
    },
    {
      title: 'Name Similarity Matching',
      desc: 'Running high-performance fuzzy matching, phonetic alignments (Soundex/Double Metaphone), and spelling correction algorithms to identify candidate records.',
      icon: Binary,
      metrics: 'Fuzzy similarity threshold >85%'
    },
    {
      title: 'Geographic Verification',
      desc: 'Validating matched profiles by correlating historical residence addresses, pin codes, and regional corporate nodal registration zones.',
      icon: MapPin,
      metrics: 'Geospatial district matching'
    },
    {
      title: 'Result Validation',
      desc: 'Deploying standard business logic filters to eliminate false positives and estimate precise current outstanding securities valuations.',
      icon: FileCheck,
      metrics: '2.1M records processed'
    },
    {
      title: 'Report Generation',
      desc: 'Compiling verified matches into legal-ready claims recovery dossiers, complete with physical IEPF forms and nodal officer instructions.',
      icon: FileText,
      metrics: 'Dossier PDF encrypted & cached'
    }
  ];

  return (
    <div className="bg-transparent text-[#171717] relative z-10">
      
      {/* 1. Trust Banner */}
      <section className="bg-white/10 backdrop-blur-xs border-t border-b border-steel-gray/30 py-8 sm:py-10 text-[#171717]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-[13px] font-mono tracking-widest text-cofounder-blue uppercase font-black">
            RECURSIVELY EXTRACTING DISCLOSURE INDICES FROM PRIMARY AUTHORITIES
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center justify-center opacity-95">
            {securityAgencies.map((agency, i) => (
              <div key={i} className="flex flex-col items-center p-4.5 rounded-xl border border-white/85 bg-white/60 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:bg-white/85 hover:scale-105 hover:border-cofounder-blue hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300">
                <span className="text-sm font-mono font-extrabold text-cofounder-blue tracking-wide text-center">{agency.label}</span>
                <span className="text-[10px] text-slate-700 font-sans tracking-wide text-center mt-1 font-bold">{agency.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Why SEEKTRIX Exists (Editorial Focus Block) */}
      <section className="py-12 sm:py-16 bg-transparent border-b border-steel-gray/15">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-sm uppercase font-mono tracking-widest text-cofounder-blue font-extrabold">The Unclaimed Wealth Epidemic</span>
          <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-[#171717] font-black tracking-tight leading-tight">
            Over ₹1.5 Lakh Crores lies forgotten in Indian legacy accounts.
          </h2>
          <p className="text-base sm:text-lg text-[#2c2c2c] leading-relaxed font-semibold text-left sm:text-center">
            Across India, millions of citizens have shares, mutual funds, EPF accounts, matured savings bonds, and insurance payouts that have gone silent. Typographical errors on folio files, forgotten addresses, relocation across cities, the passing of elderly relatives, or defunct firm consolidations leave these financial assets stagnant in the custody of government bodies like the IEPF and EPFO. 
          </p>
          <p className="text-base sm:text-lg text-[#2c2c2c] leading-relaxed font-medium text-left sm:text-center mt-3">
            SEEKTRIX bridges this institutional gap by deploying advanced document character extraction and phonetic fuzzy database searches, turning scattered public records into actionable financial claims.
          </p>
          <div className="flex justify-center pt-4">
            <div className="h-[3px] w-16 bg-cofounder-blue/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* 2b. Why Asset Recovery Matters (Human Touch Editorial) */}
      <section className="py-14 sm:py-20 bg-transparent border-b border-steel-gray/15 relative overflow-hidden" id="human-story-section">
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            
            {/* Visual Callout */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center space-x-2 bg-[#0081c0]/10 text-[#0081c0] px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wide font-extrabold uppercase border border-[#0081c0]/25">
                <Heart className="w-3.5 h-3.5 fill-[#0081c0]/20 text-[#0081c0] shrink-0" />
                <span>Our Institutional Purpose</span>
              </div>
              <h3 className="font-serif-intellectual text-3xl sm:text-4xl text-dark-charcoal font-bold leading-tight">
                Why Asset Recovery Matters
              </h3>
              <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-semibold">
                Behind every single row of public ledger microfilm, there is a human story. There is a lifetime of hard work, a grandfather's silent hope for his descendants, or a mother's hard-earned savings meant to cover family milestones.
              </p>
              <div className="border-l-4 border-cofounder-blue pl-4 py-2 italic text-sm text-slate-800 bg-slate-100 rounded-r font-medium">
                "Securities are more than mere numeric ledgers; they are legacy funds designed to secure next-generation foundations."
              </div>
            </div>

            {/* Narrative Cards Block */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-6 rounded-2xl bg-white/70 border border-steel-gray/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-cofounder-blue/40 hover:shadow-[0_12px_24px_rgba(0,0,0,0.05)] space-y-3 transition-all duration-300">
                <span className="text-[#0081c0] text-xs font-mono font-black tracking-widest block">THE ACCIDENTAL DRIFT</span>
                <h4 className="text-base font-extrabold text-slate-900">Decades of Lost Track</h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  Families lose track of investments over decades due to relocation, outdated handwritten share registries, corporate name changes, and missed communications. These holdings drift into silent escrow, untouched and forgotten.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/70 border border-steel-gray/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:border-cofounder-blue/40 hover:shadow-[0_12px_24px_rgba(0,0,0,0.05)] space-y-3 transition-all duration-300">
                <span className="text-[#0081c0] text-xs font-mono font-black tracking-widest block">RESTORATION OF LEGACY</span>
                <h4 className="text-base font-extrabold text-slate-900 font-sans">Rediscovering Dormant Capital</h4>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  We specialize in helping users rediscover dormant financial holdings, giving families the modern tools to claim back what is rightfully theirs. Bringing this offline wealth back into daylight can transform a household's financial trajectory.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-14">
          <span className="text-sm font-mono uppercase tracking-widest text-cofounder-blue font-extrabold">DECENTRALIZED WORKFLOW</span>
          <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-dark-charcoal font-black tracking-tight">
            Three Steps to Unclaimed Discovery
          </h2>
          <p className="text-base sm:text-lg text-[#333333] font-bold max-w-xl mx-auto">
            From automated characters scanning to verified recovery report summaries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Secure Parameter Input',
              desc: 'Submit your legal name (including spelling variants), residential cities, and contact details. No tax logins, OTPs, or passwords required.'
            },
            {
              step: '02',
              title: 'Phonetic Search Engine',
              desc: 'Our search engine scans millions of static public documents and corporate records, applying phonetic name-matching algorithms.'
            },
            {
              step: '03',
              title: 'Detailed Verified Report',
              desc: 'Generate a clean, downloadable verified report detailing the discovered assets, ready to submit to the respective financial authorities.'
            }
          ].map((item, index) => (
            <div key={index} className="flex flex-col space-y-4 p-8 rounded-2xl glass-panel border border-white/75 shadow-[0_20px_50px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] relative overflow-hidden group hover:border-cofounder-blue hover:scale-[1.03] hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] transition-all duration-300">
              <span className="text-5xl font-serif font-black text-steel-gray/60 group-hover:text-cofounder-blue transition-colors">{item.step}</span>
              <h3 className="text-base font-extrabold tracking-tight text-dark-charcoal font-sans">{item.title}</h3>
              <p className="text-sm text-slate-800 leading-relaxed font-semibold">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Interactive AI Pipeline Visualization */}
      <section id="pipeline-viz" className="py-14 sm:py-16 md:py-20 bg-transparent text-dark-charcoal overflow-hidden relative border-t border-b border-steel-gray/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Visualizer text */}
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-mono text-cofounder-blue uppercase tracking-widest font-extrabold bg-[#0081c0]/10 px-2.5 py-1 rounded">Active Search Stack</span>
              <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-dark-charcoal font-black tracking-tight leading-tight">
                Under the Hood: The SEEKTRIX Pipeline
              </h2>
              <p className="text-base text-slate-800 leading-relaxed font-semibold">
                Public asset lists are stored in thousands of disorganized index ledgers. Here is how our background system indexes and matches documents:
              </p>

              {/* Interactive Steps List */}
              <div className="space-y-2.5 pt-2">
                {pipelineSteps.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePipelineStep(i)}
                    className={`w-full text-left p-3.5 px-4 rounded-xl border text-sm font-mono transition-all flex items-start space-x-3 cursor-pointer ${activePipelineStep === i ? 'glass-sub-floating border-white shadow-[0_12px_28px_rgba(0,0,0,0.08),inset_0_1px_1.5px_rgba(255,255,255,1)] text-dark-charcoal font-bold scale-[1.01]' : 'border-white/40 bg-white/20 text-slate-700 hover:bg-white/45 hover:border-white/85 shadow-[0_4px_12px_rgba(0,0,0,0.02)]'}`}
                  >
                    <span className="bg-cofounder-blue/10 text-cofounder-blue w-5 h-5 rounded flex items-center justify-center text-[11px] shrink-0 font-black">{i+1}</span>
                    <div className="space-y-0.5">
                      <div className="font-bold tracking-tight text-slate-900">{step.title}</div>
                      <p className="text-[11px] font-sans text-slate-600 sm:block hidden font-medium">{step.desc.slice(0, 52)}...</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Live visual console panel */}
            <div className="lg:col-span-7 glass-panel-light rounded-2xl border border-white/80 p-8 font-mono shadow-[0_30px_70px_-10px_rgba(0,0,0,0.15),0_10px_30px_rgba(0,0,0,0.06),inset_0_1px_2.5px_rgba(255,255,255,0.95)] relative lg:h-[500px] min-h-[420px] flex flex-col justify-between">
              
              <div className="flex items-center justify-between border-b border-steel-gray/25 pb-4 text-[11px] text-cofounder-blue">
                <div className="flex items-center space-x-2">
                  <span className="status-dot shrink-0 animate-pulse" />
                  <span className="font-extrabold">SYS_PIPELINE: STREAMING_INTELLIGENCE_ENCLAVE</span>
                </div>
                <span className="font-black">NODE_VER_2.4</span>
              </div>

              {/* Selected Step Detail view */}
              <div className="my-auto space-y-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePipelineStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-3 text-cofounder-blue">
                      {React.createElement(pipelineSteps[activePipelineStep].icon, { className: 'w-7 h-7' })}
                      <h3 className="text-base font-extrabold text-[#171717] font-mono uppercase tracking-wide">
                        Step 0{activePipelineStep + 1}: {pipelineSteps[activePipelineStep].title}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-900 leading-relaxed font-sans font-semibold">
                      {pipelineSteps[activePipelineStep].desc}
                    </p>
                    <div className="inline-block px-4 py-1.5 bg-white/90 border border-steel-gray/60 rounded-lg text-xs text-cofounder-blue shadow-xs font-bold">
                      CORE METRIC: <span className="text-[#171717] font-black">{pipelineSteps[activePipelineStep].metrics}</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Interactive Console Visual log footer */}
              <div className="border-t border-steel-gray/25 pt-4 text-[10px] text-[#333333] font-bold flex justify-between items-center z-10">
                <span>INDEX_DISCLOSURE_TABLES: 3,842 PRIMARY SOURCE REGISTERS</span>
                <span className="font-black text-emerald-700">SHA-256 CHECK: OK</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Feature Grid / Capabilities */}
      <section id="features" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-16">
          <span className="text-sm font-mono uppercase tracking-widest text-cofounder-blue font-extrabold">SYSTEM CAPABILITIES</span>
          <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-dark-charcoal font-black tracking-tight">
            Engineered for Deep Financial Auditing
          </h2>
          <p className="text-base sm:text-lg text-slate-800 font-bold max-w-lg mx-auto">
            SEEKTRIX goes beyond index listings to deliver a robust, high-trust tracing platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Bento Box 1 */}
          <div className="md:col-span-2 p-8 rounded-2xl glass-panel border border-white/75 flex flex-col justify-between space-y-5 min-h-[240px] shadow-[0_15px_35px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] hover:scale-[1.01] hover:shadow-[0_25px_50px_rgba(0,0,0,0.1)] transition-all duration-300">
            <div className="space-y-3">
              <div className="p-2.5 bg-white/70 backdrop-blur-xs rounded border border-white/60 w-fit shadow-xs">
                <Cpu className="w-5.5 h-5.5 text-cofounder-blue" />
              </div>
              <h3 className="text-lg font-bold text-dark-charcoal tracking-tight font-sans">Structured Ledger Ingestion</h3>
              <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                Most government registries published in India are unstructured scans of old print sheets. Our ingestion engine converts complex column layouts, legacy ledgers, and nested PDFs cleanly into structured entries.
              </p>
            </div>
            <span className="text-xs font-mono uppercase text-[#333333] font-extrabold tracking-widest">Process Rate: ~800 registers per min</span>
          </div>

          {/* Bento Box 2 */}
          <div className="p-8 rounded-2xl glass-panel-light border border-white/75 flex flex-col justify-between space-y-5 min-h-[240px] shadow-[0_15px_35px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] hover:border-cofounder-blue/60 hover:scale-[1.02] hover:shadow-[0_25px_50px_rgba(31,38,135,0.1)] transition-all duration-300">
            <div className="space-y-3">
              <div className="p-2.5 bg-white/70 backdrop-blur-xs rounded border border-white/60 w-fit">
                <Binary className="w-5.5 h-5.5 text-cofounder-blue" />
              </div>
              <h3 className="text-lg font-bold text-dark-charcoal tracking-tight font-sans">Name Alignment Indexing</h3>
              <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                Typos on old bank folders or share cards are incredibly common. Our fuzzy engine resolves phonetic variants to map old spelling errors.
              </p>
            </div>
            <span className="text-xs font-mono uppercase text-cofounder-blue font-extrabold tracking-widest">Phoneme Match Correlation</span>
          </div>

          {/* Bento Box 3 */}
          <div className="p-8 rounded-2xl glass-panel-light border border-white/75 flex flex-col justify-between space-y-5 min-h-[240px] shadow-[0_15px_35px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] hover:border-cofounder-blue/60 hover:scale-[1.02] hover:shadow-[0_25px_50px_rgba(31,38,135,0.1)] transition-all duration-300">
            <div className="space-y-3">
              <div className="p-2.5 bg-white/70 backdrop-blur-xs rounded border border-white/60 w-fit">
                <Lock className="w-5.5 h-5.5 text-cofounder-blue" />
              </div>
              <h3 className="text-lg font-bold text-dark-charcoal tracking-tight font-sans">Zero Credential Exposure</h3>
              <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                We never request your demat passwords, bank logins, OTPs, or Aadhaar credentials. All searches run exclusively on published disclosures.
              </p>
            </div>
            <span className="text-xs font-mono uppercase text-cofounder-blue font-extrabold tracking-widest">100% Secure Tracing</span>
          </div>

          {/* Bento Box 4 */}
          <div className="md:col-span-2 p-8 rounded-2xl glass-panel border border-white/75 flex flex-col justify-between space-y-5 min-h-[240px] shadow-[0_15px_35px_rgba(0,0,0,0.06),inset_0_1px_1.5px_rgba(255,255,255,0.9)] hover:scale-[1.01] hover:shadow-[0_25px_50px_rgba(0,0,0,0.1)] transition-all duration-300">
            <div className="space-y-3">
              <div className="p-2.5 bg-white/70 backdrop-blur-xs rounded border border-white/60 w-fit">
                <FileCheck className="w-5.5 h-5.5 text-cofounder-blue" />
              </div>
              <h3 className="text-lg font-bold text-dark-charcoal tracking-tight font-sans">Institutional Recovery Brief</h3>
              <p className="text-sm text-slate-850 font-semibold leading-relaxed">
                Discovery is only half the battle. Each positive result contains dedicated step-by-step claims advice. We outline the exact physical authority office addresses, recommended legal letter outlines, IEPF filing formulas, or EPFO ledger claiming links needed to initiate reimbursement cleanly.
              </p>
            </div>
            <span className="text-xs font-mono uppercase text-[#333333] font-extrabold tracking-widest">Audit Ready Disclosures</span>
          </div>

        </div>
      </section>

      {/* 6. Security, Encryption & Privacy Section */}
      <section id="security-privacy" className="py-14 sm:py-16 md:py-20 bg-transparent text-dark-charcoal relative border-t border-b border-steel-gray/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="p-2.5 bg-cofounder-blue/10 rounded-xl border border-cofounder-blue/20 w-fit text-cofounder-blue shadow-xs">
                <EyeOff className="w-5.5 h-5.5" />
              </div>
              <span className="text-xs font-mono text-cofounder-blue uppercase tracking-widest font-black bg-cofounder-blue/5 px-2 py-1 rounded">ENCRYPTED DATA ENCLAVE</span>
              <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-dark-charcoal font-black tracking-tight leading-tight">
                We believe your privacy is a legal covenant.
              </h2>
              <p className="text-base sm:text-lg text-slate-800 leading-relaxed font-semibold">
                Financial audits are sensitive. Our engineers design systems to strictly safeguard user query matrices and results:
              </p>
              <ul className="space-y-4 font-mono text-sm text-slate-800 font-bold">
                <li className="flex items-center space-x-2.5">
                  <Check className="w-4 h-4 text-cofounder-blue shrink-0" />
                  <span>SHA-256 secure email PDF hashing</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check className="w-4 h-4 text-cofounder-blue shrink-0" />
                  <span>Self-serve single click Data Wipe</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <Check className="w-4 h-4 text-cofounder-blue shrink-0" />
                  <span>Strictly no third-party marketing brokers</span>
                </li>
              </ul>
            </div>

            <div className="glass-panel p-8 rounded-2xl border border-white/75 text-sm font-mono space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.1),inset_0_1px_1.5px_rgba(255,255,255,0.9)]">
              <div className="flex items-center space-x-2 pb-3 border-b border-white/20">
                <ShieldAlert className="w-4.5 h-4.5 text-cofounder-blue" />
                <span className="text-[#171717] font-extrabold tracking-wide">SEEKTRIX PUBLIC DATA PROTOCOL</span>
              </div>
              <p className="text-slate-800 font-sans leading-relaxed text-sm font-semibold">
                Under SEBI guide sections, the publishing of unclaimed shareholders, policy hold limits, and dormant pension accounts is a mandated public accountability measure. SEEKTRIX only collects search terms to matching indexing trees. At no point do we access private banking accounts or require personal authentication details.
              </p>
              <div className="p-4 bg-cofounder-blue/10 backdrop-blur-xs rounded-xl border border-cofounder-blue/25 text-[11px] text-cofounder-blue leading-relaxed font-black uppercase tracking-wide">
                AUDIT LEDGER SECURE NODE // STATUS CODE 200 // HASH MATRIX CONFIRMED FOR ALL CURRENT INDIA UNION DISTRICTS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Institutional Trust Section */}
      <section className="py-12 bg-transparent border-b border-steel-gray/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-xs font-mono tracking-widest text-cofounder-blue font-black uppercase">
            DESIGNED AND OPERATED UNDER GLOBAL COMPLIANCE VALUES
          </p>
          <div className="flex flex-wrap justify-center gap-10 opacity-90 text-sm font-mono text-[#2c2c2c] pt-2 font-bold">
            <span className="flex items-center space-x-1.5"><Building2 className="w-4 h-4 text-cofounder-blue" /> <span className="font-extrabold">MCA INDIA REPORT COMPLIANT</span></span>
            <span className="flex items-center space-x-1.5"><FileCheck className="w-4 h-4 text-action-azure" /> <span className="font-extrabold">SEBI INITIATED CODE STANDARDS</span></span>
            <span className="flex items-center space-x-1.5"><Activity className="w-4 h-4 text-cofounder-blue" /> <span className="font-extrabold">REAL-TIME RECONCILIATION MONITOR</span></span>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section id="faq" className="py-14 sm:py-20 bg-transparent border-b border-steel-gray/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-14 font-sans">
            <span className="text-sm font-mono uppercase tracking-widest text-cofounder-blue font-extrabold">KNOWLEDGE CENTER</span>
            <h2 className="font-serif-intellectual text-4xl sm:text-5xl text-[#171717] font-black tracking-tight">
              Frequently Queried Topics
            </h2>
            <p className="text-base sm:text-lg text-slate-800 font-bold">
              Understand how our digital engine operates at scale.
            </p>
          </div>

          <FAQAccordion items={FAQS} />
        </div>
      </section>

      {/* 9. CTA Footnote / Navigation Footer */}
      <Footer />

    </div>
  );
}
