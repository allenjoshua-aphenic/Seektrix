export type AppView =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'status'
  | 'pricing'
  | 'admin'
  | 'admin-login'
  | 'settings'
  | 'privacy'
  | 'terms'
  | 'compliance-disclaimer';

export interface User {
  name: string;
  email: string;
  city: string;
  isAuthenticated: boolean;
  role: 'user' | 'admin';
}

export type PipelineStep =
  | 'queued'
  | 'pdf_indexing'
  | 'ocr_scanning'
  | 'fuzzy_matching'
  | 'cross_referencing'
  | 'report_assembly'
  | 'completed'
  | 'failed';

export interface PipelineLog {
  timestamp: string;
  message: string;
  step: PipelineStep;
  status: 'info' | 'success' | 'warning' | 'processing';
}

export interface SearchQuery {
  id: string;
  fullName: string;
  city: string;
  state: string;
  email: string;
  submittedAt: string;
  status: PipelineStep;
  progressPercent: number;
  estimatedCompletionMinutes: number;
  logs: PipelineLog[];
  matchedCount: number;
  confidenceScore: number; // 0-100
  totalMatchedValue: number; // in INR
  companyCode?: string;
  isStarred?: boolean;
  isArchived?: boolean;
}

export type AssetCategory =
  | 'Shares'
  | 'Bonds'
  | 'Mutual Funds'
  | 'EPF / PPF'
  | 'Insurance';

export interface UnclaimedAsset {
  id: string;
  category: AssetCategory;
  companyName: string;
  holderName: string;
  fatherHusbandName?: string;
  amount: number;
  shares?: number;
  folioNumberOrId: string;
  claimAuthority: string; // e.g. 'IEPF Authority', 'EPFO', 'LIC of India', 'SEBI Unclaimed Dividends'
  stateOrCity: string;
  matchConfidence: number; // e.g. 98 -> percentage
  disclosureSource: string; // e.g. 'SEBI Annual Dividend Disclosure PDF - Pg 412'
  refNumber: string; // IEPF Reference/Folio
  financialYear: string;
  lastTransmissionDate?: string;
  status: 'Unclaimed' | 'In Process' | 'Claimed';
  matchReasons?: string[];
}

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export interface SecurityCredential {
  id: string;
  name: string;
  value: string;
  lastUpdated: string;
  type: 'API Key' | 'OCR Service' | 'PDF Registry';
  status: 'active' | 'inactive';
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
}

export interface AppPayment {
  id: string;
  amount: number;
  timestamp: string;
  description: string;
}


