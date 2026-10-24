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
  confidenceScore: number; // 0-100 — score of the best match
  totalMatchedValue: number; // in INR
  companyCode?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  /** 'typed' = user entered the name; 'email' = the server read it from the email address. */
  nameSource?: 'typed' | 'email';
  /** Which database search function served this job ('v2' | 'v1-fallback' | 'none'). */
  engine?: string;
  /** True when a stage timed out or the server ran on the legacy function. */
  degraded?: boolean;
  degradedReason?: string;
}

// ── Search results (from GET /api/search/:id/matches) ───────────────────────
export type MatchLabel = 'strong' | 'likely' | 'possible' | 'weak';

export interface MatchResult {
  id: string;
  companyName: string;
  bseCode: string;
  holderName: string;
  matchedSimilarityScore: number; // 0-100
  matchLabel: MatchLabel;
  matchReasons: string[];
  folioNumber: string;
  dpClientId: string;
  unclaimedAmount: number;
  municipalRegion: string;
  disclosureSource: string;
  fatherName: string;
  shares: number;
  state: string;
  fullAddress: string;
  financialYear: string;
  stateMatch: boolean | null;
}

export interface SearchStageInfo {
  name: string;
  mode: 'word' | 'similar' | 'prefix' | 'v1';
  threshold: number | null;
  state: string;
  rows: number;
  ms: number;
  error?: string;
}

export interface SearchMeta {
  normalizedQuery: string;
  tokens: string[];
  removed: string[];
  stages: SearchStageInfo[];
  engine: 'v2' | 'v1-fallback' | 'none';
  degraded: boolean;
  /** Plain-language sentence for end users. */
  degradedReason?: string;
  /** Technical detail (shown behind a "technical details" toggle). */
  degradedDetail?: string;
  totalCandidates: number;
  tookMs: number;
  fromCache: boolean;
}

export interface MatchesReady {
  status: 'ready';
  id: string;
  query: { fullName: string; city: string; state: string };
  matches: MatchResult[];
  meta: SearchMeta;
}

export interface MatchesRunning {
  status: 'running';
  progressPercent: number;
  step: PipelineStep;
}

export type MatchesResponse = MatchesReady | MatchesRunning;

// ── Type-ahead suggestions (from GET /api/suggest) ──────────────────────────
export interface SuggestItem {
  holderName: string;
  companyName: string;
  state: string;
  score: number;
  label: MatchLabel;
}

export interface SuggestResponse {
  query: string;
  state: string;
  total: number;
  items: SuggestItem[];
  meta: {
    normalizedQuery: string;
    tookMs: number;
    engine: string;
    degraded: boolean;
    degradedReason?: string;
    fromCache: boolean;
  };
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
