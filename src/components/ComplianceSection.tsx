import React from 'react';
import { Landmark, ShieldCheck, ClipboardCheck, Server, Shield, Award } from 'lucide-react';

export default function ComplianceSection() {
  const complianceFrameworks = [
    {
      title: 'SEBI Compliance Guidelines',
      desc: 'Formulated in structural alignment with Clause 39 of SEBI (Listing Obligations and Disclosure Requirements) to guarantee transparency in tracing equity positions.',
      icon: LandmarksIcon
    },
    {
      title: 'IEPF Ingestion Framework',
      desc: 'Decodes monthly published MCA registrar tables into standardized digital directories using deterministic regional matching filters.',
      icon: ClipboardChecksIcon
    },
    {
      title: 'Data Custody & Privacy',
      desc: 'Compliant with Indian IT Act Section 43A. Financial searches remain offline-cached during query lifetimes and are permanently purgeable on demand.',
      icon: EnclaveShieldsIcon
    }
  ];

  const certificationBadges = [
    'Designed with ISO 27001 aligned security practices',
    'Compliance-oriented infrastructure',
    'Audit-ready workflows',
    'AES-256 encrypted endpoints'
  ];

  return (
    <section className="space-y-6" id="compliance-frameworks-hub">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-widest text-cofounder-blue font-bold">
            Audit Authenticity Standard
          </span>
          <h3 className="font-serif-intellectual text-xl font-bold text-dark-charcoal font-sans">
            Strict Institutional Custody Protocols.
          </h3>
          <p className="text-xs text-gray-500 font-sans font-light">
            We operate fully under regulatory transparency guidelines without request for access credentials.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {certificationBadges.map((badge, idx) => (
            <span 
              key={idx} 
              className="text-[9px] font-mono font-bold text-[#475569] bg-slate-100 px-2 py-1 rounded-md border border-slate-200"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {complianceFrameworks.map((framework, i) => (
          <div 
            key={i} 
            className="glass-panel-light p-5 rounded-2xl border border-white/60 shadow-[0_4px_15px_rgba(0,0,0,0.015)] space-y-3.5 hover:border-cofounder-blue/40 duration-200 transition-colors"
          >
            <div className="p-2.5 bg-cofounder-blue/5 rounded-xl border border-cofounder-blue/15 text-cofounder-blue w-fit">
              <framework.icon className="w-5 h-5" />
            </div>
            
            <h4 className="text-xs font-bold text-[#171717]">{framework.title}</h4>
            
            <p className="text-[11px] text-gray-500 leading-relaxed font-sans font-medium">
              {framework.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Trust Ledger strip */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans">
        <div className="flex items-center space-x-3 text-[#475569]">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-semibold text-[11px]">Primary Registrar Integrations Synchronized successfully</span>
        </div>
        <div className="flex items-center space-x-1.5 font-mono text-[10px] font-bold text-[#646464] uppercase tracking-wider">
          <span>MCA Gateway API Status</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Live</span>
        </div>
      </div>
    </section>
  );
}

// Custom icons to avoid duplication
function LandmarksIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Landmark className="w-5 h-5 text-cofounder-blue" />;
}

function ClipboardChecksIcon(props: React.SVGProps<SVGSVGElement>) {
  return <ClipboardCheck className="w-5 h-5 text-[#41a1cf]" />;
}

function EnclaveShieldsIcon(props: React.SVGProps<SVGSVGElement>) {
  return <Shield className="w-5 h-5 text-[#2563eb]" />;
}
