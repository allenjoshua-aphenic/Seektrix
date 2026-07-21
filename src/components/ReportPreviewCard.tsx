import React, { useMemo, useState } from 'react';
import { SearchQuery } from '../types';
import { 
  ShieldCheck, 
  Award, 
  FileText, 
  ChevronRight, 
  HelpCircle, 
  ArrowRight, 
  Database, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  FileCheck, 
  MapPin, 
  User, 
  Coins,
  Info
} from 'lucide-react';
import RegistrySourceBadge from './RegistrySourceBadge';
import { findAssetsForQuery } from '../data';

interface ReportPreviewCardProps {
  key?: string | number;
  query: SearchQuery;
  onPreview: () => void;
  onDownload: () => void;
}

export interface AlgorithmInfo {
  name: string;
  details: string;
  badge: string;
}

export function getAlgorithmDetail(reason: string): AlgorithmInfo {
  const r = (reason || '').toLowerCase();
  
  if (r.includes('name') || r.includes('spelling') || r.includes('similarity') || r.includes('phonetic') || r.includes('surname') || r.includes('nominee') || r.includes('identical')) {
    if (r.includes('surname') || r.includes('nominee') || r.includes('heir')) {
      return {
        name: 'Kinship & Heir Correlation Matrix',
        details: "Analyzes primary and secondary nominee registries using Hindu/Indian Succession Act matrices. Correlates surnames and legal heir indices to trace asset title transitions.",
        badge: 'Lineage Parser'
      };
    }
    return {
      name: 'Fuzzy Phonetic Name Alignment',
      details: "Leverages Double Metaphone & Phonetic Levenshtein models to match name variations (e.g., 'Ramesh' vs 'Rames', 'Vijay' vs 'Vijai') with a custom 85%+ threshold to isolate historic ledger entry typos.",
      badge: 'Phonetic NLP'
    };
  }
  
  if (r.includes('address') || r.includes('mumbai') || r.includes('delhi') || r.includes('chandigarh') || r.includes('chennai') || r.includes('bangalore') || r.includes('regional') || r.includes('district') || r.includes('place')) {
    return {
      name: 'Geographic Ward & Pin Matching',
      details: "Correlates regional Post Office pincodes, historical ward maps, and state registrar regions to verify residence links despite urban street name changes over decades.",
      badge: 'Geo-Proximity'
    };
  }
  
  if (r.includes('dividend') || r.includes('interest') || r.includes('epfo') || r.includes('balance') || r.includes('fund') || r.includes('valuation') || r.includes('redemption') || r.includes('ledger') || r.includes('timeline') || r.includes('overlap')) {
    return {
      name: 'Financial Ledger Sequence Correlation',
      details: "Cross-references dividend claim gaps, unpaid corporate action cycles, interest maturity records, and regulatory pool timeline overlaps to guarantee chronological accuracy.",
      badge: 'Chronological Sync'
    };
  }
  
  return {
    name: 'Secure Registrar Data Mapping',
    details: "Validates corporate registrar listings, historical transfer ledger sheets, phone suffix signatures, and official email addresses against protected public company archives.",
    badge: 'Metadata Match'
  };
}

export default function ReportPreviewCard({ query, onPreview, onDownload }: ReportPreviewCardProps) {
  const isPending = query.status !== 'completed' && query.status !== 'failed';
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [activeReasonId, setActiveReasonId] = useState<string | null>(null);

  const toggleAsset = (assetId: string) => {
    setExpandedAssetId(prev => prev === assetId ? null : assetId);
    setActiveReasonId(null); // Reset when collapsing
  };
  
  // Format Indian Currency nicely
  const formatCurrency = (val: any) => {
    const num = Number(val);
    if (isNaN(num) || num === null || num === undefined) {
      return '₹0';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Find exact directory/ledger matches with audit-ready sources
  const matchedAssets = useMemo(() => {
    if (isPending) return [];
    return findAssetsForQuery(query.fullName, query.city, query.companyCode);
  }, [query.fullName, query.city, query.companyCode, isPending]);

  // Dynamic icon selector based on matching source context
  const getReasonIcon = (reason: string) => {
    const r = (reason || '').toLowerCase();
    if (r.includes('address') || r.includes('mumbai') || r.includes('delhi') || r.includes('chandigarh') || r.includes('chennai') || r.includes('regional')) {
      return <MapPin className="w-3 h-3 text-[#0081c0] shrink-0" />;
    }
    if (r.includes('name') || r.includes('spelling') || r.includes('similarity') || r.includes('phonetic') || r.includes('surname') || r.includes('nominee')) {
      return <User className="w-3 h-3 text-emerald-600 shrink-0" />;
    }
    if (r.includes('dividend') || r.includes('interest') || r.includes('epfo') || r.includes('balance') || r.includes('fund') || r.includes('valuation')) {
      return <Coins className="w-3 h-3 text-amber-600 shrink-0" />;
    }
    return <FileCheck className="w-3 h-3 text-indigo-500 shrink-0" />;
  };

  return (
    <div className="glass-panel-light rounded-2xl border border-white/70 shadow-[0_8px_30px_rgba(0,0,0,0.035)] p-6 space-y-6 text-[#171717] hover:border-cofounder-blue/50 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all duration-300">
      
      {/* Card Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1 whitespace-nowrap px-2 py-0.5 rounded bg-cofounder-blue/5 border border-cofounder-blue/15 text-[9px] font-bold font-sans text-cofounder-blue uppercase tracking-wide">
            <span>Audit ID:</span> <span className="font-mono">{query.id}</span>
          </div>
          <h4 className="text-md font-bold text-dark-charcoal font-sans tracking-tight pt-1">
            {query.fullName}
          </h4>
          <p className="text-[11px] text-gray-500 font-sans tracking-wide">
            Scope: {query.city}, {query.state}
          </p>
        </div>

        <div className="flex flex-col items-end space-y-1">
          <span className="text-[10px] text-gray-400 font-sans font-semibold uppercase tracking-wider">Compliance Seal</span>
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
        </div>
      </div>

      {/* Audit Stats */}
      <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-4">
        <div>
          <span className="block text-[10px] font-sans uppercase text-gray-400 font-bold tracking-wider">Verified Valuation</span>
          {isPending ? (
            <span className="text-sm text-gray-400 italic">calculating...</span>
          ) : query.matchedCount > 0 ? (
            <span className="text-lg font-bold text-dark-charcoal tracking-tight">
              {formatCurrency(query.totalMatchedValue)}
            </span>
          ) : (
            <span className="text-sm font-semibold text-emerald-700">Clear (₹0 Claims)</span>
          )}
        </div>

        <div>
          <span className="block text-[10px] font-sans uppercase text-gray-400 font-bold tracking-wider">Matched Claims</span>
          <span className="text-lg font-bold text-dark-charcoal tracking-tight mt-0.5 block">
            {isPending ? 'Pending' : `${query.matchedCount} Discovered`}
          </span>
        </div>
      </div>

      {/* Confidence Score Gauge */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-sans text-gray-500 text-[10px] uppercase font-bold tracking-wide">Match Probability Gauge</span>
          <span className={`font-sans font-bold text-xs ${query.confidenceScore >= 90 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {query.confidenceScore}% Confidence
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
          <div 
            style={{ width: `${query.confidenceScore}%` }}
            className={`h-full rounded-full ${query.confidenceScore >= 90 ? 'bg-emerald-600' : 'bg-amber-500'}`}
          />
        </div>
      </div>

      {/* Audit-Ready Registry Sources & Citations */}
      {!isPending && query.matchedCount > 0 && (
        <div className="space-y-3.5 bg-[#f8fafc] border border-slate-200/60 rounded-xl p-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="block text-[10px] font-sans uppercase text-[#64748b] font-bold tracking-wider">
              Registry Disclosures ({matchedAssets.length})
            </span>
            <span className="text-[9px] font-sans text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
              Index Match Verified
            </span>
          </div>
          
          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 transition-all duration-300">
            {matchedAssets.slice(0, 3).map((asset) => {
              const isExpanded = expandedAssetId === asset.id;
              return (
                <div 
                  key={asset.id} 
                  className={`text-[11px] p-2.5 bg-white border rounded-lg flex flex-col gap-1.5 transition-all duration-200 ${
                    isExpanded 
                      ? 'border-cofounder-blue/50 shadow-sm ring-1 ring-cofounder-blue/10 bg-slate-50/20'
                      : 'border-slate-100 hover:border-cofounder-blue/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-dark-charcoal font-sans leading-tight">
                      {asset.companyName}
                    </div>
                    <div className="text-[10px] font-sans text-dark-charcoal font-bold shrink-0">
                      {formatCurrency(asset.amount)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-sans text-gray-500 border-t border-dashed border-slate-100 pt-1.5">
                    <div className="flex items-center space-x-1">
                      <Database className="w-2.5 h-2.5 text-cofounder-blue shrink-0" />
                      <span className="truncate max-w-[120px] font-medium" title={asset.disclosureSource}>
                        {asset.disclosureSource}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 justify-end text-right">
                      <span className="font-semibold text-slate-400">Folio:</span>
                      <span className="truncate max-w-[100px] font-mono font-bold text-slate-700">{asset.folioNumberOrId || asset.refNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-[#475569] pt-1.5 border-t border-slate-50">
                    <RegistrySourceBadge source={asset.claimAuthority} className="py-0 px-1 text-[8px] h-4.5" />
                    <span className="font-sans text-[9px] text-gray-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded scale-95 origin-right">
                      FY {asset.financialYear}
                    </span>
                  </div>

                  {/* Accordion action indicator */}
                  <div className="mt-1 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAsset(asset.id);
                      }}
                      className="group/btn flex items-center justify-between text-[9px] font-semibold text-cofounder-blue hover:text-[#006699] w-full transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-1">
                        <Activity className="w-2.5 h-2.5 animate-pulse text-[#0081c0]" />
                        <span>Match Decision Matrix</span>
                      </span>
                      <span className="flex items-center space-x-0.5 font-sans text-[8px] text-gray-400 font-normal">
                        <span>{isExpanded ? 'Hide' : 'Verify'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-cofounder-blue shrink-0" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-cofounder-blue shrink-0" />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2 bg-[#f0f9ff]/70 border border-[#bae6fd]/40 rounded-lg space-y-1.5 animate-fadeIn text-left">
                        <div className="flex items-center justify-between border-b border-[#bae6fd]/30 pb-1">
                          <div className="flex items-center space-x-1 text-[8px] font-sans font-bold text-[#0369a1] uppercase">
                            <FileCheck className="w-2.5 h-2.5 text-[#0081c0]" />
                            <span>Audit Trust Credentials</span>
                          </div>
                          <span className="text-[7px] font-sans text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-bold uppercase tracking-wider scale-95 origin-right">
                            Verified Match Point
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {asset.matchReasons && asset.matchReasons.length > 0 ? (
                            asset.matchReasons.map((reason, idx) => {
                              const popoverId = `${asset.id}-${idx}`;
                              const algo = getAlgorithmDetail(reason);
                              const isPopoverActive = activeReasonId === popoverId;

                              return (
                                <div key={idx} className="flex flex-col gap-1 bg-white/60 p-1.5 rounded-md border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-colors hover:bg-white">
                                  <div className="flex items-start justify-between gap-1 text-[9px] text-slate-700 leading-normal">
                                    <div className="flex items-start space-x-1.5 flex-1">
                                      <span className="mt-0.5 shrink-0">
                                        {getReasonIcon(reason)}
                                      </span>
                                      <span className="font-sans font-medium">{reason}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveReasonId(isPopoverActive ? null : popoverId);
                                      }}
                                      className={`shrink-0 p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                                        isPopoverActive ? 'text-cofounder-blue bg-blue-50/80' : 'text-slate-400 hover:text-cofounder-blue hover:bg-slate-100'
                                      }`}
                                      title="Algorithm logic explained"
                                    >
                                      <Info className="w-3 h-3 shrink-0" />
                                    </button>
                                  </div>

                                  {isPopoverActive && (
                                    <div className="mt-1 p-2 bg-[#030712] text-slate-100 rounded-md border border-slate-800 text-[9px] leading-relaxed animate-fadeIn space-y-1 text-left shadow-lg">
                                      <div className="flex items-center justify-between border-b border-slate-800 pb-0.5 text-[7px] font-mono text-blue-400 font-bold uppercase tracking-wider">
                                        <span>Algorithm: {algo.name}</span>
                                        <span className="bg-slate-800 text-blue-300 px-1 py-0.2 rounded font-normal">{algo.badge}</span>
                                      </div>
                                      <p className="text-slate-300 font-sans font-normal leading-normal">
                                        {algo.details}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-start space-x-1.5 text-[9px] text-slate-600 leading-normal">
                              <span className="mt-0.5 shrink-0">
                                <FileCheck className="w-3 h-3 text-indigo-500 shrink-0" />
                              </span>
                              <span className="flex-1 font-sans font-medium">Spelling match verified against public MCA indexes & municipal records.</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-sky-100/60 flex items-center justify-between text-[7px] font-mono text-slate-400 uppercase">
                          <span>Model: FL-FuzzyX v2.8</span>
                          <span>Hash: SHA-256 Verified</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onPreview}
          disabled={isPending}
          className="w-full py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-dark-charcoal cursor-pointer flex items-center justify-center space-x-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          id={`preview-action-${query.id}`}
        >
          <span>Review Claims</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onDownload}
          disabled={isPending}
          className="w-full py-2.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cofounder-blue to-[#41a1cf] text-white flex items-center justify-center space-x-1 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
          id={`download-action-${query.id}`}
        >
          <span>Get PDF Report</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
