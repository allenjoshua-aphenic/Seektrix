import React from 'react';
import { Check, ShieldCheck, Cpu, Database, ChevronRight, Landmark } from 'lucide-react';
import { motion } from 'motion/react';

interface PricingSectionProps {
  currentView: string;
  setView: (view: any) => void;
}

export default function PricingSection({ currentView, setView }: PricingSectionProps) {
  const tiers = [
    {
      name: 'Standard Search',
      price: '₹0',
      period: 'Introductory check',
      desc: 'Introductory scanning of basic active listed registries for one individual.',
      features: [
        'Single legal name query search',
        'Fuzzy matching on active indices',
        'Basic disclosure table maps',
        'Standard scan priority queue',
        'General support ticket access'
      ],
      buttonText: 'Initialize Standard Scan',
      ctaAction: () => setView('auth'),
      isPopular: false
    },
    {
      name: 'Priority Extraction',
      price: '₹2,499',
      period: 'Per comprehensive scan',
      desc: 'Automated optical character mapping across low-res PDFs and legacy ledger books.',
      features: [
        'Advanced phonetic fuzzy alignment',
        'Scans of low-resolution scanned scrolls',
        'AMFI and EPFO indices extraction',
        'Priority character scanning queue',
        'Assistive step-by-step claims guide',
        'Professional PDF Report downloads'
      ],
      buttonText: 'Commence Priority Scan',
      ctaAction: () => setView('auth'),
      isPopular: true
    },
    {
      name: 'Estate & Heir Search',
      price: '₹9,999',
      period: 'Dedicated family audit',
      desc: 'Specialist algorithms to trace ancestral holdings has belonged to deceased relatives.',
      features: [
        'Multi-name variations recursive maps',
        'Historic scans back to FY 2012',
        'In-depth cross-district searching',
        'Specialist EPFO inoperative database query',
        'Custom Legal letters outline templates',
        'Digital PDF audit certificate signed'
      ],
      buttonText: 'Commission Family Scan',
      ctaAction: () => setView('auth'),
      isPopular: false
    }
  ];

  return (
    <section className="bg-transparent min-h-[85vh] pt-4 pb-16 text-[#171717]" id="pricing-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Pricing page Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cofounder-blue/5 border border-cofounder-blue/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#0081c0] font-mono">
            <Landmark className="w-3.5 h-3.5" />
            <span>FLEXIBLE INSTITUTIONAL PRICING STRUCTURE</span>
          </div>
          <h1 className="font-serif-intellectual text-3xl sm:text-4xl tracking-tight text-dark-charcoal font-semibold">
            Predictable Pricing for Financial Tracing
          </h1>
          <p className="text-xs sm:text-sm text-medium-gray max-w-xl mx-auto font-sans font-light">
            We operate fully secure, low-latency digital indexing systems. Choose a tracing priority suited to your financial audit depth.
          </p>
        </div>

        {/* Pricing Grids */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <div 
              key={index}
              className={`p-6 sm:p-8 rounded-2xl flex flex-col justify-between space-y-6 relative overflow-hidden transition-all ${tier.isPopular ? 'glass-panel-dark text-off-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] scale-[1.03] md:z-10' : 'glass-panel-light shadow-[0_12px_40px_rgba(0,0,0,0.06)]'}`}
            >
              {/* Popular ribbon */}
              {tier.isPopular && (
                <div className="absolute top-0 right-0 bg-[#0081c0] text-off-white font-mono text-[9px] tracking-widest uppercase font-bold py-1.5 px-4 rounded-bl">
                  Recommended Core
                </div>
              )}

              <div className="space-y-4">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${tier.isPopular ? 'text-action-azure font-bold' : 'text-medium-gray font-bold'}`}>
                  {tier.name}
                </span>

                <div className="flex items-baseline space-x-1">
                  <span className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">{tier.price}</span>
                  <span className={`text-xs font-light ${tier.isPopular ? 'text-[#dee2de]/50' : 'text-medium-gray'}`}>{tier.period}</span>
                </div>

                <p className={`text-xs font-light leading-relaxed ${tier.isPopular ? 'text-[#dee2de]/60' : 'text-slate-gray'}`}>
                  {tier.desc}
                </p>

                <div className="h-[1px] bg-steel-gray/20 my-4" />

                {/* Features list */}
                <ul className="space-y-3 text-xs leading-relaxed">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start space-x-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${tier.isPopular ? 'text-action-azure' : 'text-cofounder-blue'}`} />
                      <span className={tier.isPopular ? 'text-[#dee2de]/80' : 'text-slate-gray'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* TTA CTA button */}
              <button
                onClick={tier.ctaAction}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold tracking-wide flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${tier.isPopular ? 'bg-cofounder-blue text-off-white hover:bg-action-azure shadow' : 'bg-white hover:bg-steel-gray/20 text-[#171717] border border-steel-gray shadow-xs'}`}
              >
                <span>{tier.buttonText}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

            </div>
          ))}
        </div>

        {/* Global certification note */}
        <div className="max-w-2xl mx-auto p-5 rounded-2xl glass-panel-light border border-steel-gray/60 text-xs font-sans text-center text-slate-gray font-light shadow-sm">
          <p className="flex items-center justify-center space-x-2 text-[10px] font-mono uppercase tracking-widest text-cofounder-blue font-bold mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>SEEKTRIX REFUND CORNER COVENANT</span>
          </p>
          If your priority scan reports 0 matched indices, your audit results in a signed "Clean Certificate" completely free. You can request priority scanners re-audits for secondary family parameters.
        </div>

      </div>
    </section>
  );
}
