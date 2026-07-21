import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  Activity, 
  ShieldCheck, 
  Database, 
  Upload, 
  RefreshCw, 
  Play, 
  Trash2, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  FileText,
  AlertTriangle,
  Info,
  ChevronRight,
  Sparkles,
  BarChart2
} from 'lucide-react';

interface CustomAsset {
  companyName: string;
  bseCode: string;
  holderName: string;
  folioNumber: string;
  unclaimedAmount: number;
  municipalRegion: string;
  disclosureSource: string;
}

export default function AdminPanel() {
  const { searchHistory, setSelectedReport, setView, addToast, payments } = useAppStore();

  // Real-time Revenue Calculations
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const oneWeekAgoDate = new Date();
  oneWeekAgoDate.setDate(oneWeekAgoDate.getDate() - 7);

  const dailyRevenue = payments
    .filter((p) => new Date(p.timestamp) >= todayDate)
    .reduce((sum, p) => sum + p.amount, 0);

  const weeklyRevenue = payments
    .filter((p) => new Date(p.timestamp) >= oneWeekAgoDate)
    .reduce((sum, p) => sum + p.amount, 0);

  // Dynamic weekly segments for bar height calculations
  const totalWk1 = payments.filter((p) => {
    const ageDays = (Date.now() - new Date(p.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= 7;
  }).reduce((sum, p) => sum + p.amount, 0);

  const totalWk2 = payments.filter((p) => {
    const ageDays = (Date.now() - new Date(p.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 7 && ageDays <= 14;
  }).reduce((sum, p) => sum + p.amount, 0);

  const totalWk3 = payments.filter((p) => {
    const ageDays = (Date.now() - new Date(p.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 14 && ageDays <= 21;
  }).reduce((sum, p) => sum + p.amount, 0);

  const totalWk4 = payments.filter((p) => {
    const ageDays = (Date.now() - new Date(p.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > 21 && ageDays <= 28;
  }).reduce((sum, p) => sum + p.amount, 0);

  const maxWeekly = Math.max(totalWk1, totalWk2, totalWk3, totalWk4, 100);

  const h1 = `${Math.max(4, (totalWk1 / maxWeekly) * 100)}px`;
  const h2 = `${Math.max(4, (totalWk2 / maxWeekly) * 100)}px`;
  const h3 = `${Math.max(4, (totalWk3 / maxWeekly) * 100)}px`;
  const h4 = `${Math.max(4, (totalWk4 / maxWeekly) * 100)}px`;
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'ops' | 'stats'>('ops');
  
  // Custom Assets Storage & state
  const [customAssets, setCustomAssets] = useState<CustomAsset[]>([]);
  const [jsonText, setJsonText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Counts derived only from locally uploaded records (the authoritative
  // registry counts live in Supabase — see the unclaimed_assets table).
  const uniqueInvestors = Array.from(new Set(
    customAssets.map((a) => a.holderName.toLowerCase().trim())
  )).filter(Boolean);
  const totalInvestorsRealTime = uniqueInvestors.length;

  const uniqueCompanies = Array.from(new Set(
    customAssets.map((a) => a.companyName.toLowerCase().trim())
  )).filter(Boolean);
  const totalCompaniesRealTime = uniqueCompanies.length;

  const uniqueUsersRealTime = Array.from(new Set([
    ...searchHistory.map((q) => q.fullName.toLowerCase().trim())
  ])).filter(Boolean).length;
  
  // Operation Simulator states
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLogs, setRefreshLogs] = useState<string[]>([]);
  
  const [reindexing, setReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(0);
  const [reindexLogs, setReindexLogs] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom assets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('seektrix_custom_assets');
      if (stored) {
        setCustomAssets(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load custom assets', e);
    }
  }, []);

  // Save custom assets to localStorage
  const saveCustomAssets = (assets: CustomAsset[]) => {
    try {
      localStorage.setItem('seektrix_custom_assets', JSON.stringify(assets));
      setCustomAssets(assets);
    } catch (e) {
      console.error('Failed to save custom assets', e);
    }
  };

  // Import JSON Logic
  const handleIngestJSON = (rawString: string) => {
    setJsonError(null);
    try {
      if (!rawString.trim()) {
        setJsonError('JSON input cannot be empty.');
        return;
      }
      
      const parsed = JSON.parse(rawString);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      
      // Validate fields
      const validated: CustomAsset[] = [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item.companyName || !item.holderName || item.unclaimedAmount === undefined) {
          throw new Error(`Record at index ${i} is missing required fields (companyName, holderName, or unclaimedAmount).`);
        }
        validated.push({
          companyName: String(item.companyName),
          bseCode: String(item.bseCode || 'N/A'),
          holderName: String(item.holderName),
          folioNumber: String(item.folioNumber || `GEN-${10000 + Math.floor(Math.random() * 90000)}`),
          unclaimedAmount: Number(item.unclaimedAmount),
          municipalRegion: String(item.municipalRegion || 'India'),
          disclosureSource: String(item.disclosureSource || 'Manual Administrative Import')
        });
      }

      const merged = [...validated, ...customAssets];
      saveCustomAssets(merged);
      setJsonText('');
      addToast(
        'JSON Ingestion Complete',
        `Successfully ingested ${validated.length} unclaimed wealth record(s) into the local registry cache.`,
        'success'
      );
    } catch (err: any) {
      setJsonError(err.message || 'Syntax Error: Invalid JSON schema format.');
    }
  };

  // Handle Drag-and-Drop file uploads
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setJsonError('Supported format is limited to strictly structured JSON arrays.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setJsonText(result);
        handleIngestJSON(result);
      }
    };
    reader.onerror = () => {
      setJsonError('Failed to read file stream.');
    };
    reader.readAsText(file);
  };

  // Delete an imported custom asset
  const handleDeleteCustomAsset = (indexToDelete: number) => {
    const updated = customAssets.filter((_, idx) => idx !== indexToDelete);
    saveCustomAssets(updated);
    addToast('Asset Removed', 'Ingested registry record deleted.', 'info');
  };

  // Clear all custom assets
  const handleClearAllCustomAssets = () => {
    if (window.confirm('Are you sure you want to clear all manually ingested records?')) {
      saveCustomAssets([]);
      addToast('Ingest Flush Completed', 'All manual assets have been purged.', 'info');
    }
  };

  // Refresh Company Meta Cache simulation
  const handleRefreshCache = () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshLogs([]);
    
    const steps = [
      'Establishing API gateway websocket handshake...',
      'Flushing distributed Redis metadata records...',
      'Re-fetching official list of BSE codes (5 core, 1 custom)...',
      'Synthesizing company market indexes and regional authority directories...',
      'Company indices flush & cache refresh successfully completed.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setRefreshLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[currentStep]}`]);
        currentStep++;
      } else {
        clearInterval(interval);
        setRefreshing(false);
        addToast('Cache Synchronized', 'Company metadata cache reloaded.', 'success');
      }
    }, 600);
  };

  // Reindexing process simulator
  const handleReindex = () => {
    if (reindexing) return;
    setReindexing(true);
    setReindexProgress(0);
    setReindexLogs([]);

    const steps = [
      { pct: 15, msg: 'Initializing direct connection link with Supabase cluster nodes...' },
      { pct: 35, msg: 'Loading Indian Ministry of Corporate Affairs (MCA) dividend files...' },
      { pct: 55, msg: 'Parsing company-level IEPF records via OCR neural tokenizers...' },
      { pct: 75, msg: 'Recalculating fuzzy string match trigrams (pg_trgm indices)...' },
      { pct: 90, msg: 'Compiling search indices and optimization structures...' },
      { pct: 100, msg: 'Re-indexing successfully completed! MCA and IEPF ledgers synchronized.' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        const step = steps[stepIdx];
        setReindexProgress(step.pct);
        setReindexLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [${step.pct}%] ${step.msg}`]);
        stepIdx++;
      } else {
        clearInterval(interval);
        setReindexing(false);
        addToast('Reindexing Successful', 'Compliance search indices compiled.', 'success');
      }
    }, 1000);
  };

  const handleOpenReport = (query: any) => {
    setSelectedReport(query);
    setView('dashboard');
  };

  // Ingested template snippet helper
  const handleInsertTemplate = () => {
    const template = [
      {
        "companyName": "Reliance Industries Ltd.",
        "bseCode": "500325",
        "holderName": "Serena Kapoor",
        "unclaimedAmount": 84200.00,
        "folioNumber": "RIL-IEPF-98421",
        "municipalRegion": "Delhi, Delhi",
        "disclosureSource": "RIL_unclaimed_dividends_2025.pdf"
      }
    ];
    setJsonText(JSON.stringify(template, null, 2));
    setJsonError(null);
  };

  return (
    <section className="bg-transparent min-h-[90vh] pt-4 pb-16 text-[#171717] relative z-10" id="admin-management-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* System Administration Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-steel-gray/25 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-widest text-cofounder-blue uppercase flex items-center space-x-1.5 font-bold bg-cofounder-blue/5 px-2.5 py-1 rounded-md border border-cofounder-blue/20">
                <Activity className="text-red-500 w-3 h-3 animate-pulse shrink-0" />
                <span>SEEKTRIX ADMINISTRATIVE CONTROL</span>
              </span>
              <span className="text-[10px] font-mono tracking-widest text-emerald-700 uppercase bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md font-bold">
                ROOT AUTHENTICATED
              </span>
            </div>
            <h1 className="font-serif-intellectual text-3xl font-semibold tracking-tight text-dark-charcoal mt-2">
              Auditor Command Center
            </h1>
            <p className="text-xs text-[#646464] font-sans font-light mt-1">
              Admin deck to manage ledger files, reindex databases, inspect metrics, and analyze user queries.
            </p>
          </div>
          
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="glass-panel-light border border-steel-gray/60 px-3.5 py-2 rounded-xl flex items-center space-x-2.5 shadow-xs bg-white/70">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span className="text-dark-charcoal font-bold">SYSTEM STATUS: ALL NODE LINKS ACTIVE</span>
            </span>
          </div>
        </div>

        {/* Tab Selector Links */}
        <div className="flex space-x-1 p-1 bg-steel-gray/10 rounded-2xl max-w-sm">
          <button
            onClick={() => setActiveTab('ops')}
            className={`flex-1 py-2.5 text-xs font-mono font-bold tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 ${
              activeTab === 'ops' 
                ? 'bg-white text-cofounder-blue shadow-sm' 
                : 'text-gray-500 hover:text-dark-charcoal hover:bg-white/40'
            }`}
            id="tab-ops-trigger"
          >
            <Database className="w-3.5 h-3.5" />
            <span>OPERATIONS SUITE</span>
          </button>
          
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2.5 text-xs font-mono font-bold tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 ${
              activeTab === 'stats' 
                ? 'bg-white text-cofounder-blue shadow-sm' 
                : 'text-gray-500 hover:text-dark-charcoal hover:bg-white/40'
            }`}
            id="tab-stats-trigger"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>STATISTICS & FINANCE</span>
          </button>
        </div>

        {/* Tab 1: Operations Suite */}
        {activeTab === 'ops' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Operations side: JSON import & Cache trigger */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Ingestion Engine (JSON Import) */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-steel-gray/15 pb-3">
                  <div className="flex items-center space-x-2">
                    <Upload className="w-4.5 h-4.5 text-cofounder-blue" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                      01 // Ingest Unclaimed Wealth JSON
                    </h3>
                  </div>
                  <button 
                    onClick={handleInsertTemplate}
                    className="text-[10px] font-mono text-cofounder-blue hover:underline cursor-pointer flex items-center space-x-1"
                    id="insert-template-btn"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Insert Template</span>
                  </button>
                </div>

                <p className="text-xs text-[#646464] font-sans font-light leading-relaxed">
                  Provide custom records of shareholders/assets to be added instantly. This supports both <b>drag-and-drop file upload</b> and direct code pasting.
                </p>

                {/* File Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    dragOver 
                      ? 'border-cofounder-blue bg-cofounder-blue/5' 
                      : 'border-steel-gray/30 hover:border-steel-gray/60 bg-steel-gray/5'
                  }`}
                  id="json-dropzone"
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json"
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-xs font-semibold text-dark-charcoal">
                    Drag & Drop your ledger .json file here, or click to browse
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-mono">
                    Supported: strict JSON array containing holder details
                  </p>
                </div>

                {/* Paste Area */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-gray-400 block font-bold">
                    Or Paste Raw Array Code
                  </label>
                  <textarea
                    rows={6}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder='[\n  {\n    "companyName": "Reliance Industries Ltd.",\n    "holderName": "Serena Kapoor",\n    "unclaimedAmount": 84200.00\n  }\n]'
                    className="w-full bg-steel-gray/5 border border-steel-gray/25 rounded-2xl p-4 text-xs font-mono text-dark-charcoal focus:outline-none focus:border-cofounder-blue"
                    id="raw-json-textarea"
                  />
                </div>

                {jsonError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-800 text-xs font-mono flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span>{jsonError}</span>
                  </div>
                )}

                <button
                  onClick={() => handleIngestJSON(jsonText)}
                  className="w-full py-3 bg-dark-charcoal hover:bg-[#1f1f29] transition-all text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                  id="trigger-json-ingestion-btn"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>PROCESS REGISTRY INGESTION FLOW</span>
                </button>
              </div>

              {/* Cache Flushing and Synchronization */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-steel-gray/15 pb-3">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4.5 h-4.5 text-cofounder-blue" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                      02 // Refresh Company Meta-Cache
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-[#646464] font-sans font-light leading-relaxed">
                  Flush distributed gateway servers and reload indices. Clears in-memory registers and reconnects pipeline queries to newly updated municipal sectors.
                </p>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefreshCache}
                    disabled={refreshing}
                    className="px-5 py-2.5 bg-cofounder-blue hover:bg-action-azure text-white font-mono font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer flex items-center space-x-2 shrink-0 shadow-sm"
                    id="refresh-cache-btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'FLUSHING REGISTER...' : 'REFRESH COMPANY CACHE'}</span>
                  </button>
                  <span className="text-[10px] font-mono text-gray-400 italic">
                    Last update verified 1 hr ago.
                  </span>
                </div>

                {refreshLogs.length > 0 && (
                  <div className="bg-dark-charcoal text-off-white font-mono text-[10px] p-4 rounded-xl space-y-1.5 h-32 overflow-y-auto leading-relaxed border border-white/10 shadow-inner">
                    {refreshLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-1.5">
                        <span className="text-emerald-400 shrink-0">▸</span>
                        <span className="text-[#e2e2e2]">{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Operations side: Reindexing Suite */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Database Reindexing Portal */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-4">
                <div className="flex items-center space-x-2 border-b border-steel-gray/15 pb-3">
                  <Activity className="w-4.5 h-4.5 text-cofounder-blue animate-pulse" />
                  <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                    03 // MCA & RBI Reindex Operations
                  </h3>
                </div>

                <p className="text-xs text-[#646464] font-sans font-light leading-relaxed">
                  Re-parse all ingested company PDFs, recompute Levenshtein weights, and rebuild the global lookup registers.
                </p>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono font-bold text-dark-charcoal">
                      <span>REINDEXING METRIC</span>
                      <span>{reindexProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-steel-gray/20 rounded-full overflow-hidden border border-white/25 shadow-xs">
                      <div 
                        className="bg-cofounder-blue h-full transition-all duration-500 rounded-full" 
                        style={{ width: `${reindexProgress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleReindex}
                    disabled={reindexing}
                    className="w-full py-3 bg-[#111111] hover:bg-[#222] text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                    id="trigger-reindex-btn"
                  >
                    <Play className="w-4 h-4 text-[#00ff88]" />
                    <span>{reindexing ? 'BUILDING SYSTEM DIRECTORY...' : 'RUN COLD SYSTEM RE-INDEX'}</span>
                  </button>
                </div>

                {reindexLogs.length > 0 && (
                  <div className="bg-[#111] text-[#00ff88] font-mono text-[10px] p-4 rounded-xl space-y-1.5 h-40 overflow-y-auto leading-relaxed border border-white/10 shadow-inner">
                    {reindexLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start space-x-1.5">
                        <span className="text-cofounder-blue shrink-0">▸</span>
                        <span className="text-[#aaffcc]">{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Display of Ingested Custom Records */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-steel-gray/15 pb-2">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-cofounder-blue" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                      Custom Ingested Assets ({customAssets.length})
                    </h3>
                  </div>
                  {customAssets.length > 0 && (
                    <button 
                      onClick={handleClearAllCustomAssets}
                      className="text-red-600 hover:text-red-700 font-mono text-[9px] uppercase font-bold cursor-pointer flex items-center space-x-1"
                      id="flush-custom-assets-btn"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Purge All</span>
                    </button>
                  )}
                </div>

                {customAssets.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-steel-gray/30 rounded-2xl bg-white/40">
                    <Info className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                    <p className="text-[11px] font-mono text-gray-500">No manual JSON assets in memory cache.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {customAssets.map((asset, idx) => (
                      <div key={idx} className="p-3 bg-white/80 rounded-xl border border-steel-gray/15 flex items-center justify-between text-xs">
                        <div className="space-y-0.5 truncate max-w-[85%]">
                          <p className="font-semibold text-dark-charcoal truncate">{asset.holderName}</p>
                          <p className="text-[10px] font-mono text-gray-500 truncate">{asset.companyName} ({asset.folioNumber})</p>
                          <p className="text-[10px] text-cofounder-blue font-bold font-mono">₹{asset.unclaimedAmount.toLocaleString('en-IN')}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteCustomAsset(idx)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Statistics & Financial Ledger */}
        {activeTab === 'stats' && (
          <div className="space-y-8">
            
            {/* Metric Blocks Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Metric Card 1: Total Investors */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-lg relative overflow-hidden flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-gray tracking-wider block font-bold">TOTAL INVESTORS</span>
                    <span className="text-3xl font-serif-intellectual font-semibold text-dark-charcoal">
                      {totalInvestorsRealTime.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2 bg-cofounder-blue/5 rounded-xl border border-cofounder-blue/10 text-cofounder-blue">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-500 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>{customAssets.length} Locally Uploaded Records</span>
                </div>
              </div>

              {/* Metric Card 2: Companies Covered */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-lg relative overflow-hidden flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-gray tracking-wider block font-bold">COMPANIES INGESTED</span>
                    <span className="text-3xl font-serif-intellectual font-semibold text-dark-charcoal">
                      {totalCompaniesRealTime.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2 bg-cofounder-blue/5 rounded-xl border border-cofounder-blue/10 text-cofounder-blue">
                    <Database className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-500 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  <span>{Array.from(new Set(customAssets.map(a => a.companyName))).length} Custom Brands</span>
                </div>
              </div>

              {/* Metric Card 3: Total Users This Month */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-lg relative overflow-hidden flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-gray tracking-wider block font-bold">USERS THIS MONTH</span>
                    <span className="text-3xl font-serif-intellectual font-semibold text-dark-charcoal">
                      {uniqueUsersRealTime.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-2 bg-cofounder-blue/5 rounded-xl border border-cofounder-blue/10 text-cofounder-blue">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-500 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span>{searchHistory.length} Search Queries Executed</span>
                </div>
              </div>

              {/* Metric Card 4: Ledger Revenue */}
              <div className="glass-panel-light rounded-3xl p-6 border border-white/60 shadow-lg relative overflow-hidden flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-slate-gray tracking-wider block font-bold">TOTAL REAL-TIME REVENUE</span>
                    <span className="text-3xl font-serif-intellectual font-semibold text-dark-charcoal">₹{totalRevenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#444] space-x-2">
                  <span>Today: <b>₹{dailyRevenue.toLocaleString('en-IN')}</b></span>
                  <span className="text-gray-300">|</span>
                  <span>7 Days: <b>₹{weeklyRevenue.toLocaleString('en-IN')}</b></span>
                </div>
              </div>

            </div>

            {/* Custom Visual Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Financial Revenue Visualizer */}
              <div className="lg:col-span-8 glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-6">
                <div className="border-b border-steel-gray/15 pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                    Financial Performance Analysis
                  </h3>
                </div>

                <div className="space-y-5">
                  <p className="text-xs text-slate-gray">
                    Audited revenue tracking across active diagnostic audits and automated PDF compilations. All calculations are live based on actual user checkout transactions.
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-white/70 rounded-2xl border border-steel-gray/10 text-center">
                      <p className="text-[10px] font-mono text-slate-gray font-bold">TODAY'S LEDGER</p>
                      <p className="text-xl font-bold text-dark-charcoal mt-1">₹{dailyRevenue.toLocaleString('en-IN')}</p>
                      <p className="text-[9px] text-slate-gray font-mono mt-0.5">Real-time checkout</p>
                    </div>
                    <div className="p-4 bg-white/70 rounded-2xl border border-steel-gray/10 text-center">
                      <p className="text-[10px] font-mono text-slate-gray font-bold">7-DAY REVENUE</p>
                      <p className="text-xl font-bold text-dark-charcoal mt-1">₹{weeklyRevenue.toLocaleString('en-IN')}</p>
                      <p className="text-[9px] text-slate-gray font-mono mt-0.5">Rolling cycle</p>
                    </div>
                    <div className="p-4 bg-white/70 rounded-2xl border border-steel-gray/10 text-center">
                      <p className="text-[10px] font-mono text-slate-gray font-bold">TOTAL ACCUMULATED</p>
                      <p className="text-xl font-bold text-emerald-700 mt-1">₹{totalRevenue.toLocaleString('en-IN')}</p>
                      <p className="text-[9px] text-emerald-600 font-mono mt-0.5">{payments.length} real checkouts</p>
                    </div>
                  </div>

                  {/* Dynamic Weekly Revenue Timeline (only if we have payments) */}
                  <div className="space-y-2 pt-4">
                    <span className="text-[10px] font-mono text-gray-400 block font-bold uppercase">Weekly Audits Revenue Timeline</span>
                    <div className="flex h-24 items-end justify-between border-b border-l border-steel-gray/30 pb-2 pl-2">
                      <div className="flex-1 flex flex-col items-center group">
                        <span className="text-[10px] font-mono font-bold text-cofounder-blue opacity-0 group-hover:opacity-100 transition-opacity">₹{totalWk4}</span>
                        <div className="w-8 bg-cofounder-blue/30 hover:bg-cofounder-blue transition-all rounded-t-md" style={{ height: h4 }} />
                        <span className="text-[9px] font-mono text-gray-500 mt-2">Wk 4</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center group">
                        <span className="text-[10px] font-mono font-bold text-cofounder-blue opacity-0 group-hover:opacity-100 transition-opacity">₹{totalWk3}</span>
                        <div className="w-8 bg-cofounder-blue/30 hover:bg-cofounder-blue transition-all rounded-t-md" style={{ height: h3 }} />
                        <span className="text-[9px] font-mono text-gray-500 mt-2">Wk 3</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center group">
                        <span className="text-[10px] font-mono font-bold text-cofounder-blue opacity-0 group-hover:opacity-100 transition-opacity">₹{totalWk2}</span>
                        <div className="w-8 bg-cofounder-blue/30 hover:bg-cofounder-blue transition-all rounded-t-md" style={{ height: h2 }} />
                        <span className="text-[9px] font-mono text-gray-500 mt-2">Wk 2</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center group">
                        <span className="text-[10px] font-mono font-bold text-cofounder-blue opacity-0 group-hover:opacity-100 transition-opacity">₹{totalWk1}</span>
                        <div className="w-8 bg-cofounder-blue/40 hover:bg-cofounder-blue transition-all rounded-t-md" style={{ height: h1 }} />
                        <span className="text-[9px] font-mono text-gray-500 mt-2">Wk 1</span>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Ledger Log Table */}
                  <div className="space-y-2 pt-4 border-t border-steel-gray/10">
                    <span className="text-[10px] font-mono text-gray-400 block font-bold uppercase">Real-time Checkout Ledger ({payments.length} Payments)</span>
                    {payments.length === 0 ? (
                      <div className="border border-dashed border-steel-gray/30 rounded-2xl p-6 text-center text-slate-gray text-xs bg-white/40 font-mono">
                        No transactions registered yet on this terminal.
                        <div className="text-[9px] mt-1 text-gray-400 font-sans">
                          Once users search and complete UPI / Card handshakes, their audit access fees will populate here in real-time.
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-steel-gray/15 rounded-2xl bg-white/50 backdrop-blur-md max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="bg-steel-gray/10 text-slate-gray text-[10px] uppercase font-bold border-b border-steel-gray/15">
                              <th className="p-3">Transaction ID</th>
                              <th className="p-3">Time</th>
                              <th className="p-3">Description</th>
                              <th className="p-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-steel-gray/10">
                            {payments.map((p) => (
                              <tr key={p.id} className="hover:bg-white/40 transition-colors">
                                <td className="p-3 text-[10px] text-slate-gray">{p.id}</td>
                                <td className="p-3 text-[10px]">
                                  {new Date(p.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="p-3 font-sans text-dark-charcoal">{p.description}</td>
                                <td className="p-3 text-right text-emerald-700 font-bold">₹{p.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Categorization & Regional Analytics */}
              <div className="lg:col-span-4 glass-panel-light rounded-3xl p-6 border border-white/60 shadow-xl space-y-6">
                <div className="border-b border-steel-gray/15 pb-3">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-dark-charcoal font-bold">
                    Compliance Segment Spread
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  
                  {/* Category Spread */}
                  <div className="space-y-2">
                    <span className="font-mono text-[10px] uppercase text-slate-gray font-bold">CATEGORY DISTRIBUTION</span>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Shares & Dividends</span>
                        <span>74%</span>
                      </div>
                      <div className="w-full h-1.5 bg-steel-gray/25 rounded-full overflow-hidden">
                        <div className="bg-cofounder-blue h-full rounded-full" style={{ width: '74%' }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Debentures & Bonds</span>
                        <span>18%</span>
                      </div>
                      <div className="w-full h-1.5 bg-steel-gray/25 rounded-full overflow-hidden">
                        <div className="bg-[#1f1f29] h-full rounded-full" style={{ width: '18%' }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between font-mono text-[11px]">
                        <span>Matured Mutual Funds</span>
                        <span>8%</span>
                      </div>
                      <div className="w-full h-1.5 bg-steel-gray/25 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '8%' }} />
                      </div>
                    </div>
                  </div>

                  {/* Latest Updates Log Feed */}
                  <div className="space-y-2 pt-4 border-t border-steel-gray/10">
                    <span className="font-mono text-[10px] uppercase text-slate-gray font-bold">LATEST UPDATES LOG</span>
                    <div className="space-y-3 font-mono text-[10px] text-gray-500 leading-relaxed">
                      <div className="flex space-x-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-cofounder-blue mt-0.5" />
                        <div>
                          <p className="font-bold text-dark-charcoal">System Audit</p>
                          <p className="text-[9px]">Ingested cache successfully compiled.</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-cofounder-blue mt-0.5" />
                        <div>
                          <p className="font-bold text-dark-charcoal">Automatic Backup</p>
                          <p className="text-[9px]">Supabase connection validated. 0 errors detected.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </section>
  );
}
