import React from 'react';
import { Landmark, FileText, Verified, Sparkles, Building2 } from 'lucide-react';

interface RegistrySourceBadgeProps {
  source: string;
  className?: string;
}

export default function RegistrySourceBadge({ source, className = '' }: RegistrySourceBadgeProps) {
  const normalized = (source || '').toLowerCase();

  const getSourceConfig = () => {
    if (normalized.includes('iepf') || normalized.includes('corporate affairs')) {
      return {
        label: 'MCA // IEPF Registry',
        colors: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Landmark className="w-3 h-3 text-blue-700" />
      };
    }
    if (normalized.includes('epfo') || normalized.includes('provident')) {
      return {
        label: 'EPFO Inoperative Audit',
        colors: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <Building2 className="w-3 h-3 text-emerald-700" />
      };
    }
    if (normalized.includes('lic') || normalized.includes('insurance')) {
      return {
        label: 'IRDAI Mutual/LIC Ledger',
        colors: 'bg-[#fdf2f8] text-[#be185d] border-[#fbcfe8]',
        icon: <FileText className="w-3 h-3 text-[#be185d]" />
      };
    }
    if (normalized.includes('sebi') || normalized.includes('amfi') || normalized.includes('mutual')) {
      return {
        label: 'AMFI Mutual Funds',
        colors: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <Verified className="w-3 h-3 text-purple-700" />
      };
    }
    return {
      label: 'Verified Public Registry',
      colors: 'bg-gray-50 text-gray-700 border-gray-200',
      icon: <Sparkles className="w-3 h-3 text-gray-700" />
    };
  };

  const config = getSourceConfig();

  return (
    <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md border text-[10px] font-semibold font-mono tracking-wide ${config.colors} ${className}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}
