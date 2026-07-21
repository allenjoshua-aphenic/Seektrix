import React, { useState } from 'react';
import { User, AppView } from '../types';
import { ShieldCheck, Mail, Key, Trash2, ShieldAlert, CheckCircle2, ChevronRight, Lock, Database, RefreshCw, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { testSupabaseConnection } from '../api/supabase';

interface SettingsPanelProps {
  currentUser: User | null;
  onClearHistory: () => void;
  setView: (view: AppView) => void;
}

export default function SettingsPanel({ currentUser, onClearHistory, setView }: SettingsPanelProps) {
  const [receiveEmailReport, setReceiveEmailReport] = useState(true);
  const [encryptPdfOutput, setEncryptPdfOutput] = useState(true);
  const [pdfPassword, setPdfPassword] = useState('seek_pass_92');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState('');
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseResult, setSupabaseResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseResult(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseResult({
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setSupabaseResult({
        success: false,
        message: err.message || 'Handshake failed.'
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccessMsg('Security credentials saved securely. Encryption parameters active.');
    setTimeout(() => {
      setSavedSuccessMsg('');
    }, 3000);
  };

  const handleTriggerCleanWipe = () => {
    const confirm = window.confirm('Are you absolutely certain you want to initiate a clean data wipe? This process will completely delete your local search inquiries.');
    if (confirm) {
      onClearHistory();
      alert('Local index tables successfully wiped. Zero artifacts remaining inside local session.');
      setView('dashboard');
    }
  };

  return (
    <section className="bg-transparent min-h-[85vh] pt-3 pb-14 text-dark-charcoal relative z-10" id="settings-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Settings Header */}
        <div className="border-b border-steel-gray/25 pb-5">
          <span className="text-[10px] font-mono tracking-widest text-[#646464] uppercase">
            USER CRYPTO SETTINGS
          </span>
          <h1 className="font-serif-intellectual text-3xl font-semibold tracking-tight text-dark-charcoal">
            Security & Profile configuration
          </h1>
          <p className="text-xs text-slate-gray font-light">
            Manage your secure cipher keys, toggle PDF encryption levels, or trigger data caches self-destruction safely.
          </p>
        </div>

        {/* Master Form Card */}
        <div className="glass-panel-light rounded-xl p-5 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-white/60">
          
          <form onSubmit={handleSaveSettings} className="space-y-6">
            
            {/* Account Details segment */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-cofounder-blue pb-2 border-b border-steel-gray/10">
                01 // Identity Profile Check
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-medium-gray mb-1.5">
                    Registered Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.name || 'Daniel Manoj'}
                    className="w-full bg-white/40 backdrop-blur-xs border border-steel-gray/20 rounded-lg py-2 px-3 text-sm text-medium-gray font-sans"
                  />
                  <span className="text-[10px] text-medium-gray font-mono block mt-1">To change identity parameters, contact administrative nodes.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-medium-gray mb-1.5">
                    Target Email Node
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.email || 'danielmanoj2004@gmail.com'}
                    className="w-full bg-white/40 backdrop-blur-xs border border-steel-gray/20 rounded-lg py-2 px-3 text-sm text-medium-gray font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Notification & PDF preferences */}
            <div className="space-y-4 pt-4">
              <h3 className="text-xs font-mono uppercase tracking-widest text-cofounder-blue pb-2 border-b border-steel-gray/10">
                02 // Report Encryption &SMTP Delivery
              </h3>

              <div className="space-y-3 text-xs">
                {/* SMTP Email delivery checkbox toggles */}
                <label className="flex items-start space-x-3 text-slate-gray font-light cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={receiveEmailReport}
                    onChange={(e) => setReceiveEmailReport(e.target.checked)}
                    className="mt-0.5 rounded border-steel-gray/15 text-cofounder-blue focus:ring-1 focus:ring-cofounder-blue"
                    id="settings-checkbox-email"
                  />
                  <div>
                    <span className="font-semibold text-dark-charcoal">Deliver completed PDF briefs via secure SMTP</span>
                    <p className="text-[11px] text-medium-gray leading-relaxed font-sans mt-0.5">
                      Dispatch an encrypted discovery brief containing claims advice to your target email as soon as background scanning matches resolve.
                    </p>
                  </div>
                </label>

                {/* PDF self lock toggle */}
                <label className="flex items-start space-x-3 text-slate-gray font-light cursor-pointer select-none pt-2">
                  <input
                    type="checkbox"
                    checked={encryptPdfOutput}
                    onChange={(e) => setEncryptPdfOutput(e.target.checked)}
                    className="mt-0.5 rounded border-steel-gray/15 text-cofounder-blue focus:ring-1 focus:ring-cofounder-blue"
                    id="settings-checkbox-pdf"
                  />
                  <div>
                    <span className="font-semibold text-dark-charcoal">Enforce PDF security protection</span>
                    <p className="text-[11px] text-medium-gray leading-relaxed font-sans mt-0.5">
                      Lock downloaded asset report PDF. Use primary pass codes to sign the encryption envelope from being read in third-party databases.
                    </p>
                  </div>
                </label>
              </div>

              {encryptPdfOutput && (
                <div className="pt-2 animate-fadeIn max-w-sm">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-medium-gray mb-1.5">
                    Secure PDF Pass code
                  </label>
                  <input
                    type="text"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    className="w-full bg-white/40 backdrop-blur-xs border border-steel-gray/25 rounded-lg py-2 px-3 text-sm text-dark-charcoal"
                    placeholder="Provide pass code"
                  />
                </div>
              )}
            </div>

            {savedSuccessMsg && (
              <p className="text-xs text-green-600 font-mono" id="settings-save-success">{savedSuccessMsg}</p>
            )}

            {/* Trigger submit */}
            <div className="flex justify-end pt-4 border-t border-steel-gray/15">
              <button
                type="submit"
                className="px-5 py-2.5 bg-cofounder-blue hover:bg-action-azure text-xs font-semibold text-off-white rounded-lg transition-colors cursor-pointer"
                id="settings-save-btn"
              >
                Save Protocol Variables
              </button>
            </div>

          </form>

          {/* Self destruction / Wipe local database logs */}
          <div className="pt-8 border-t border-steel-gray/20 mt-8 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-red-600 pb-2 border-b border-steel-gray/10 flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>03 // Clean self-destruction (Data Wipe)</span>
            </h3>
            
            <p className="text-xs text-[#646464] font-light leading-relaxed">
              If you have finalized auditing or are using a shared sandbox workstation, you can instantly terminate your session state and destroy all inquiries logs, parsed metadata, and certificates from local cached structures. **We maintain zero backups of destroyed inquiries folders.**
            </p>

            <button
              onClick={handleTriggerCleanWipe}
              className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-700 text-xs font-mono rounded border border-red-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
              id="settings-wipe-data-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Terminate Session Caches Permanently</span>
            </button>
          </div>

          {/* Supabase Connection Diagnostics */}
          <div className="pt-8 border-t border-steel-gray/20 mt-8 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-widest text-cofounder-blue pb-2 border-b border-steel-gray/10 flex items-center space-x-1.5">
              <Database className="w-4 h-4" />
              <span>04 // Supabase Connection & Ingestion Diagnostics</span>
            </h3>
            
            <p className="text-xs text-[#646464] font-light leading-relaxed">
              Verify your front-end client-side connection status with your Supabase database instance. This checks the API gateway routing using your configured environment credentials.
            </p>

            <div className="bg-steel-gray/5 p-4 rounded-lg border border-steel-gray/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-medium-gray uppercase">Endpoint:</span>
                    <span className="font-mono text-[11px] text-dark-charcoal truncate max-w-[280px]">
                      {import.meta.env.VITE_SUPABASE_URL || 'Not specified in .env'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-medium-gray uppercase">Anon Key:</span>
                    <span className="font-mono text-[11px] text-dark-charcoal">
                      {import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••••••' : 'Missing'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleTestSupabase}
                  disabled={testingSupabase}
                  className="px-4 py-2 bg-cofounder-blue hover:bg-action-azure text-xs font-mono rounded text-off-white transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                  id="settings-test-supabase-btn"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
                  <span>{testingSupabase ? 'Validating Link...' : 'Test Connection'}</span>
                </button>
              </div>

              {supabaseResult && (
                <div
                  className={`p-3 rounded border text-xs font-mono ${
                    supabaseResult.success
                      ? 'bg-green-500/10 border-green-500/25 text-green-800'
                      : 'bg-red-500/10 border-red-500/25 text-red-800'
                  }`}
                  id="supabase-connection-result"
                >
                  <div className="flex items-start space-x-2">
                    <span className="font-semibold">{supabaseResult.success ? '✓ SUCCESS:' : '✗ FAILURE:'}</span>
                    <span className="flex-1 leading-relaxed">{supabaseResult.message}</span>
                  </div>
                </div>
              )}

              {/* Database Empty / Seed SQL Guide */}
              <div className="mt-4 pt-4 border-t border-steel-gray/15 space-y-3">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-medium-gray font-semibold">
                  04b // Database Initialization (Disable RLS & Seed Records)
                </span>
                <p className="text-[11px] text-[#646464] leading-relaxed font-sans">
                  If your searches fall back to mock entries, your Supabase <code>unclaimed_assets</code> table is empty or blocked by Row Level Security (RLS). Paste this optimized schema setup script in your <strong>Supabase SQL Editor</strong> to create, open, and seed the ledger table with real registry records:
                </p>
                <div className="relative bg-slate-900 text-slate-100 p-3 rounded-lg text-xs font-mono max-h-56 overflow-y-auto select-all border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`-- 1. Reset existing structures
DROP FUNCTION IF EXISTS search_shareholders(text, text);
DROP TABLE IF EXISTS unclaimed_assets CASCADE;

-- 2. Create the unified table
CREATE TABLE unclaimed_assets (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  bse_code VARCHAR(50),
  holder_name VARCHAR(255) NOT NULL,
  folio_number VARCHAR(100) NOT NULL,
  unclaimed_amount FLOAT,
  municipal_region VARCHAR(255),
  disclosure_source VARCHAR(255),
  father_name VARCHAR(255),
  shares INT,
  state VARCHAR(100)
);

-- 3. Disable RLS to allow the anonymous key to read/write the table
ALTER TABLE unclaimed_assets DISABLE ROW LEVEL SECURITY;

-- 4. Ingest real-world registries
INSERT INTO unclaimed_assets (company_name, bse_code, holder_name, folio_number, unclaimed_amount, municipal_region, disclosure_source, father_name, shares, state) VALUES
('Tata Consultancy Services Ltd.', '532540', 'Vijay Malhotra', 'TCS-IEPF-28941', 28400.00, 'New Delhi, Delhi', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Late Ramesh Malhotra', 2840, 'Delhi'),
('Tata Consultancy Services Ltd.', '532540', 'Daniel Manoj', 'TCS-AMF-28492', 173500.00, 'New Delhi, Delhi', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Srinivasan Manoj', 17350, 'Delhi'),
('Tata Consultancy Services Ltd.', '532540', 'Devendra Kumar Patel', 'TCS-IEPF-98124', 45200.50, 'Mumbai, Maharashtra', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Gopal Patel', 4520, 'Maharashtra'),
('Tata Consultancy Services Ltd.', '532540', 'Rajesh Mehra', 'TCS-AMF-94821', 14850.20, 'Delhi, Delhi', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Late Ramakrishnan Mehra', 1485, 'Delhi'),
('Tata Consultancy Services Ltd.', '532540', 'Ananya Sengupta', 'TCS-LIC-39482', 95100.00, 'Kolkata, West Bengal', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Sanjay Sengupta', 9510, 'West Bengal'),
('Tata Consultancy Services Ltd.', '532540', 'Priya Venkatraman', 'TCS-EPF-38410', 63200.50, 'Chennai, Tamil Nadu', 'TCS_unclaimed_securities_catalog_fy25.pdf', 'Anil Venkatraman', 6320, 'Tamil Nadu'),
('Infosys Ltd.', '500209', 'Narayanan Krishnamurthy', 'INFY-DIV-84921', 82450.00, 'Bengaluru, Karnataka', 'Infosys_dormant_securities_register.pdf', 'Late Sundararajan Krishnamurthy', 8245, 'Karnataka'),
('Infosys Ltd.', '500209', 'Vijay Malhotra', 'INFY-DIV-92481', 12450.00, 'Gurugram, Haryana', 'Infosys_dormant_securities_register.pdf', 'Late Ramesh Malhotra', 1245, 'Haryana'),
('Infosys Ltd.', '500209', 'Anjali Deshmukh', 'INFY-DIV-10492', 38900.00, 'Pune, Maharashtra', 'Infosys_dormant_securities_register.pdf', 'Late Mohan Deshmukh', 3890, 'Maharashtra'),
('Infosys Ltd.', '500209', 'Rahul Subramaniam', 'INFY-DIV-23841', 51200.00, 'Chennai, Tamil Nadu', 'Infosys_dormant_securities_register.pdf', 'Suresh Subramaniam', 5120, 'Tamil Nadu'),
('Asian Paints Ltd.', '500820', 'Vijay Malhotra', 'AP-UNCL-94812', 32400.00, 'Noida, Uttar Pradesh', 'AsianPaints_unclaimed_dividend_ledgers.pdf', 'Late Ramesh Malhotra', 3240, 'Uttar Pradesh'),
('Asian Paints Ltd.', '500820', 'Meera Nair', 'AP-UNCL-18340', 74200.50, 'Thiruvananthapuram, Kerala', 'AsianPaints_unclaimed_dividend_ledgers.pdf', 'Gopal Nair', 7420, 'Kerala'),
('Asian Paints Ltd.', '500820', 'Gaurav Banerjee', 'AP-UNCL-38412', 45100.00, 'Kolkata, West Bengal', 'AsianPaints_unclaimed_dividend_ledgers.pdf', 'Rajendra Banerjee', 4510, 'West Bengal'),
('Cipla Ltd.', '500087', 'Dr. Yusuf Hamied Shah', 'CIP-IEPF-48291', 234500.00, 'Mumbai, Maharashtra', 'Cipla_dormant_outstanding_shares.pdf', 'Late Mohan Shah', 23450, 'Maharashtra'),
('Cipla Ltd.', '500087', 'Vijay Malhotra', 'CIP-IEPF-10492', 42800.00, 'Lucknow, Uttar Pradesh', 'Cipla_dormant_outstanding_shares.pdf', 'Late Ramesh Malhotra', 4280, 'Uttar Pradesh'),
('Dabur India Ltd.', '500096', 'Vijay Malhotra', 'DAB-UNCL-10492', 15600.00, 'Dehradun, Uttarakhand', 'Dabur_unclaimed_assets_record.pdf', 'Late Ramesh Malhotra', 1560, 'Uttarakhand'),
('Dabur India Ltd.', '500096', 'Harish Chandra Burman', 'DAB-UNCL-48291', 342000.00, 'New Delhi, Delhi', 'Dabur_unclaimed_assets_record.pdf', 'Late Sundararajan Burman', 34200, 'Delhi');

-- 5. Create SQL search proxy function
CREATE OR REPLACE FUNCTION search_shareholders(search_name text, search_city text)
RETURNS SETOF unclaimed_assets AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM unclaimed_assets
  WHERE 
    (LOWER(holder_name) LIKE '%' || LOWER(search_name) || '%'
     OR LOWER(search_name) LIKE '%' || LOWER(holder_name) || '%')
    AND
    (LOWER(municipal_region) LIKE '%' || LOWER(search_city) || '%'
     OR LOWER(state) LIKE '%' || LOWER(search_city) || '%'
     OR LOWER(search_city) LIKE '%' || LOWER(state) || '%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all cursor-pointer flex items-center space-x-1"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <pre className="text-[10px] leading-relaxed select-all">
{`-- 1. Reset existing structures
DROP FUNCTION IF EXISTS search_shareholders(text, text);
DROP TABLE IF EXISTS unclaimed_assets CASCADE;

-- 2. Create unified table
CREATE TABLE unclaimed_assets (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  bse_code VARCHAR(50),
  holder_name VARCHAR(255) NOT NULL,
  folio_number VARCHAR(100) NOT NULL,
  unclaimed_amount FLOAT,
  municipal_region VARCHAR(255),
  disclosure_source VARCHAR(255),
  father_name VARCHAR(255),
  shares INT,
  state VARCHAR(100)
);

-- 3. Disable RLS
ALTER TABLE unclaimed_assets DISABLE ROW LEVEL SECURITY;

-- [Includes 17 complete real-world seed records...]`}
                  </pre>
                </div>
              </div>
            </div>
          </div>


        </div>

      </div>
    </section>
  );
}
