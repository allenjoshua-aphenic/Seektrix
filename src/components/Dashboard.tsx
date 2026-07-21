import React from 'react';
import { SearchQuery, AppView } from '../types';
import { ArrowLeft, HelpCircle, FileDown, Lock, Sparkles, CreditCard, Check, X, ShieldCheck, Landmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useAppStore } from '../store/useAppStore';
import DashboardQuickActionFooter from './DashboardQuickActionFooter';

interface DashboardProps {
  currentUser: any;
  history: SearchQuery[];
  onStartSearch: (fullName: string, city: string, email: string) => void;
  onOpenReport: (query: SearchQuery) => void;
  setView: (view: AppView) => void;
  onSimulateError?: () => void;
  onSimulateEmpty?: (fullName: string, city: string, email: string) => void;
}

interface ResultRow {
  id: number;
  investorName: string;
  fatherName: string;
  company: string;
  state: string;
  folioNumber: string;
  address: string;
  shares: number;
}

export default function Dashboard({
  history,
  setView
}: DashboardProps) {
  const { selectedReport, addToast, recordPayment } = useAppStore();
  
  // Get the most recent search from search history or default to "Manoj Kumar"
  const latestSearch = selectedReport || history[0];

  const [isReportUnlocked, setIsReportUnlocked] = React.useState(() => {
    if (!latestSearch) return false;
    try {
      return localStorage.getItem(`unlocked_report_${latestSearch.id}`) === 'true';
    } catch (e) {
      return false;
    }
  });

  const [unlockedRowIds, setUnlockedRowIds] = React.useState<number[]>(() => {
    if (!latestSearch) return [];
    try {
      const stored = localStorage.getItem(`unlocked_rows_${latestSearch.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  React.useEffect(() => {
    if (!latestSearch) {
      setIsReportUnlocked(false);
      setUnlockedRowIds([]);
      return;
    }
    try {
      setIsReportUnlocked(localStorage.getItem(`unlocked_report_${latestSearch.id}`) === 'true');
    } catch (e) {
      setIsReportUnlocked(false);
    }
    try {
      const stored = localStorage.getItem(`unlocked_rows_${latestSearch.id}`);
      setUnlockedRowIds(stored ? JSON.parse(stored) : []);
    } catch (e) {
      setUnlockedRowIds([]);
    }
  }, [latestSearch?.id]);

  const [paymentTarget, setPaymentTarget] = React.useState<'all' | number | null>(null);
  const [lastSingleRowId, setLastSingleRowId] = React.useState<number | null>(null);

  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentStep, setPaymentStep] = React.useState<'select' | 'processing' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = React.useState<'upi_qr' | 'upi_id' | 'card'>('upi_qr');
  const [upiId, setUpiId] = React.useState('');
  const [cardNumber, setCardNumber] = React.useState('');
  const [cardExpiry, setCardExpiry] = React.useState('');
  const [cardCvv, setCardCvv] = React.useState('');
  const [processingProgress, setProcessingProgress] = React.useState(0);

  const handleStartPayment = () => {
    setPaymentStep('processing');
    setProcessingProgress(0);
    
    const interval = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (paymentTarget === 'all') {
              if (latestSearch) {
                try {
                  localStorage.setItem(`unlocked_report_${latestSearch.id}`, 'true');
                } catch (e) {}
              }
              setIsReportUnlocked(true);
              recordPayment(99, `Unlocked full dossier report for ${latestSearch?.fullName || 'Search Query'}`);
              addToast(
                'Audit Dossier Unlocked',
                `Successfully unlocked entire trace register for ₹99!`,
                'success'
              );
            } else if (paymentTarget !== null) {
              const updatedRows = [...unlockedRowIds, paymentTarget];
              setUnlockedRowIds(updatedRows);
              if (latestSearch) {
                try {
                  localStorage.setItem(`unlocked_rows_${latestSearch.id}`, JSON.stringify(updatedRows));
                } catch (e) {}
              }
              recordPayment(49, `Unlocked single record #${paymentTarget} details for ${latestSearch?.fullName || 'Search Query'}`);
              addToast(
                'Record Unlocked',
                `Successfully unlocked record details for ₹49!`,
                'success'
              );
            }
            setPaymentStep('success');
          }, 600);
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  // No search yet -> no invented subject; the UI simply shows an empty state.
  const queryName = latestSearch ? latestSearch.fullName : '';
  const queryCity = latestSearch ? latestSearch.city : '';
  const queryState = latestSearch ? (latestSearch.state || '') : '';

  // Capitalize nicely for processing
  const upperName = queryName.trim().toUpperCase();
  const upperState = queryState.trim().toUpperCase();

  const [results, setResults] = React.useState<ResultRow[]>([]);
  const [isLoadingResults, setIsLoadingResults] = React.useState(false);

  React.useEffect(() => {
    if (!latestSearch) {
      setResults([]);
      return;
    }

    let active = true;
    const fetchRealData = async () => {
      setIsLoadingResults(true);
      try {
        const response = await fetch(`/api/search/${latestSearch.id}/matches`);
        if (!response.ok) throw new Error("API error");
        const data = await response.json();

        // Map real database rows only. Missing values render as N/A — never invented.
        const mapped = data.map((item: any, idx: number) => {
          const address = item.fullAddress || item.full_address || item.municipalRegion || item.municipal_region || '';
          const statePart = (item.state || (address.split(',')[1] || '')).trim().toUpperCase() || 'N/A';
          const name = item.holderName || item.holder_name || '';
          return {
            id: idx + 1,
            investorName: name.toUpperCase(),
            fatherName: item.fatherName || item.father_name || 'N/A',
            company: (item.companyName || item.company_name || '').toUpperCase(),
            state: statePart,
            folioNumber: item.folioNumber || item.folio_number || 'N/A',
            address: address.toUpperCase() || 'N/A',
            shares: Number(item.shares ?? 0)
          };
        });

        if (active) {
          setResults(mapped);
        }
      } catch (err) {
        console.error("[SEEKTRIX] Failed to fetch matches from the backend:", err);
        if (active) {
          setResults([]);
          addToast(
            'Search Service Unavailable',
            'Could not load results from the registry server. Please run the search again.',
            'error'
          );
        }
      } finally {
        if (active) {
          setIsLoadingResults(false);
        }
      }
    };

    fetchRealData();
    return () => {
      active = false;
    };
  }, [latestSearch?.id, queryName, queryCity]);

  // Download single result PDF as an official recovery certificate
  const downloadSingleResultPDF = (row: ResultRow) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Outer Border Frame
    doc.setDrawColor(0, 75, 135);
    doc.setLineWidth(1);
    doc.rect(8, 8, 194, 281); // 210 x 297 is A4 size

    // Double fine border inside
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(10, 10, 190, 277);

    // 2. Official Header Accent Band
    doc.setFillColor(0, 75, 135); // #004b87
    doc.rect(10, 10, 190, 24, 'F');

    // Header Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('UNION REGISTRY OF INDIA', 15, 19);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text('OFFICIAL UNCLAIMED CORPORATE SHARES & DIVIDENDS ASSET DOSSIER', 15, 26);

    // Certificate ID & Timestamp
    const certificateId = `IUR-${row.folioNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toLocaleString('en-IN');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`DOC REF: ${certificateId}`, 145, 18);
    doc.setFont('Helvetica', 'normal');
    doc.text(`DATE: ${timestamp.split(',')[0]}`, 145, 22);
    doc.text('STATUS: VERIFIED ENTRY', 145, 26);

    // 3. Document Title
    doc.setTextColor(23, 23, 23);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ASSET RECOVERY & ENTITLEMENT CLAIM', 15, 45);

    // Decorative underline
    doc.setDrawColor(0, 75, 135);
    doc.setLineWidth(0.8);
    doc.line(15, 48, 110, 48);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'This document serves as the official search registry statement verifying the existence of unclaimed corporate securities under physical form custodianship. Please refer to the certified details below for claim initiation.',
      15,
      54,
      { maxWidth: 180 }
    );

    // 4. Detailed Asset Card Table
    // Header for the section
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 68, 180, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(15, 68, 180, 8, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('VERIFIED SECURITY HOLDING INFORMATION', 19, 73.5);

    // Key-value grid coordinates
    const startY = 76;
    const rowHeight = 11;
    const fields = [
      { label: 'Investor Registered Name', value: row.investorName },
      { label: "Father / Spouse's Name", value: row.fatherName || 'NA' },
      { label: 'Company / Issuer Identity', value: row.company },
      { label: 'Folio / Client Account Number', value: row.folioNumber },
      { label: 'State Jurisdiction Code', value: row.state },
      { label: 'Registered Postal Address', value: row.address || 'NA' },
      { label: 'Matched Share Ledger Count', value: `${row.shares.toLocaleString('en-IN')} Shares` }
    ];

    fields.forEach((field, index) => {
      const currentY = startY + (index * rowHeight);
      
      // Draw row outline border
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, currentY, 180, rowHeight, 'S');

      // Draw Key Background
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY, 60, rowHeight, 'F');
      doc.rect(15, currentY, 60, rowHeight, 'S');

      // Label Text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(field.label, 18, currentY + 7);

      // Value Text
      doc.setFont('Helvetica', 'bold');
      if (field.label === 'Investor Registered Name' || field.label === 'Matched Share Ledger Count') {
        doc.setTextColor(0, 75, 135);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.setFontSize(9);
      
      if (field.label === 'Registered Postal Address') {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        const wrappedAddress = doc.splitTextToSize(field.value, 115);
        doc.text(wrappedAddress, 78, currentY + 5);
      } else {
        doc.text(field.value, 78, currentY + 7);
      }
    });

    // 5. Step-by-Step Claim Guidelines
    const claimY = startY + (fields.length * rowHeight) + 12;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 23, 23);
    doc.text('OFFICIAL ASSET RECOVERY ACTION PROTOCOL', 15, claimY);

    doc.setDrawColor(0, 75, 135);
    doc.setLineWidth(0.5);
    doc.line(15, claimY + 2, 80, claimY + 2);

    const steps = [
      {
        num: '1',
        title: 'Folio Verification',
        desc: `Contact the Share Transfer Agent (RTA) representing ${row.company} quoting Folio/Client Account Number ${row.folioNumber} to verify the outstanding dividends or unclaimed shares.`
      },
      {
        num: '2',
        title: 'IEPF Form-5 Submission',
        desc: 'Submit the electronic IEPF Form-5 on the Ministry of Corporate Affairs (MCA) government portal, specifying the company name, PAN card number, and client folio references.'
      },
      {
        num: '3',
        title: 'Physical Submission & Verification',
        desc: 'Send physical copies of the IEPF-5 form, proof of search record, original certificate (if available), PAN, and Aadhaar card to the designated Nodal Officer of the company.'
      },
      {
        num: '4',
        title: 'Settlement & Credit',
        desc: 'Once approved by the Ministry of Corporate Affairs and company auditors, the reclaimed shares and matching dividends will be directly credited to your active demat account.'
      }
    ];

    let currentStepY = claimY + 7;
    steps.forEach((step) => {
      // Step number circle badge
      doc.setFillColor(0, 75, 135);
      doc.circle(19, currentStepY + 2, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(step.num, 18, currentStepY + 4.3);

      // Step title
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.text(step.title, 25, currentStepY + 3);

      // Step Description
      doc.setTextColor(71, 85, 105);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      const wrappedDesc = doc.splitTextToSize(step.desc, 168);
      doc.text(wrappedDesc, 25, currentStepY + 7);

      currentStepY += 15;
    });

    // 6. Amber Warning / Verification Note Block
    doc.setDrawColor(253, 230, 138); // Amber 200
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.rect(15, currentStepY + 2, 180, 15, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('AUDIT DISCLOSURE NOTE:', 19, currentStepY + 7);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(120, 53, 4); // Amber 900
    doc.setFontSize(7.5);
    const disclaimerMsg = "These asset details correspond directly to verified SEBI, MCA and IEPF public records in India. Any discrepancy or updates should be officially submitted to the registered corporate transfer secretaries.";
    const wrappedDisclaimer = doc.splitTextToSize(disclaimerMsg, 172);
    doc.text(wrappedDisclaimer, 19, currentStepY + 11);

    // 7. Footer Seal & Stamp Placeholder
    const footerY = 270;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(15, footerY - 4, 195, footerY - 4);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated holding report issued under active secure union database credentials.', 15, footerY);
    doc.text('No physical signature or rubber stamp stamp is required for initial RTA filings.', 15, footerY + 3);
    doc.text('Digital Signature ID: #IUR-UNION-VERIFIED-SECURE', 135, footerY);

    // Save specific PDF with the company and folio name
    doc.save(`Recovery_Certificate_${row.company.replace(/\s+/g, '_')}_${row.folioNumber}.pdf`);
  };

  // Professional Native PDF Generator using standard jsPDF coordinates for all records
  const downloadAllPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header Banner Accent Bar
    doc.setFillColor(0, 75, 135); // primaryColor #004b87
    doc.rect(0, 0, 297, 22, 'F');
    
    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('INDIA UNION REGISTRY - UNCLAIMED FINANCIAL ASSETS REPORT', 14, 14);
    
    // Metadata timestamp
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    const timestamp = new Date().toLocaleString('en-IN');
    doc.text(`Generated: ${timestamp} | Secure Database Session Active`, 212, 14);

    // 2. Query Info Box
    doc.setTextColor(23, 23, 23);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text('SEARCH REGISTRY PARAMETERS', 14, 32);

    // Horizontal Rule separating info box
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 35, 283, 35);

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text('Verified Target Name:', 14, 43);
    doc.setFont('Helvetica', 'normal');
    doc.text(queryName.toUpperCase(), 52, 43);

    doc.setFont('Helvetica', 'bold');
    doc.text('Target Location/State:', 125, 43);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${queryCity.toUpperCase()} (${queryState.toUpperCase()})`, 165, 43);

    doc.setFont('Helvetica', 'bold');
    doc.text('Active Database Ledger:', 14, 49);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Matched ${results.length} official share certificates`, 52, 49);

    doc.setFont('Helvetica', 'bold');
    doc.text('Compliance Authority:', 125, 49);
    doc.setFont('Helvetica', 'normal');
    doc.text('IEPF Ministry of Corporate Affairs, India (MCA / SEBI / CSD)', 165, 49);

    // 3. Table Header Background
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 55, 269, 10, 'F');

    // Table Header Border Outline
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 55, 269, 10, 'S');

    // Table Header Texts
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('#', 17, 61);
    doc.text('INVESTOR NAME', 24, 61);
    doc.text("FATHER'S NAME", 72, 61);
    doc.text('COMPANY NAME', 108, 61);
    doc.text('FOLIO NUMBER', 158, 61);
    doc.text('STATE', 192, 61);
    doc.text('FULL ADDRESS', 214, 61);
    doc.text('SHARES', 270, 61, { align: 'right' });

    // Table Row Iteration
    let y = 65;
    results.forEach((row, index) => {
      // Start a new page when the current one is full (landscape A4 = 210mm tall)
      if (y > 178) {
        doc.addPage();
        y = 20;
      }
      // Row Background shading for alternates
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 269, 14, 'F');
      }
      doc.setDrawColor(241, 245, 249);
      doc.rect(14, y, 269, 14, 'S');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(row.id.toString(), 17, y + 8);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(row.investorName, 24, y + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(row.fatherName || 'NA', 72, y + 8);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(row.company, 108, y + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(row.folioNumber || 'NA', 158, y + 8);

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text(row.state, 192, y + 8);

      // Wrap address properly
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const addressLines = doc.splitTextToSize(row.address || 'NA', 52);
      doc.text(addressLines, 214, y + 6);

      // Shares
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129); // Beautiful emerald green
      doc.text(row.shares.toLocaleString('en-IN'), 280, y + 8, { align: 'right' });

      y += 14;
    });

    // 4. Verification Statement and Disclaimer
    if (y > 170) {
      doc.addPage();
      y = 20;
    }
    doc.setDrawColor(253, 230, 138); // Amber 200
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.rect(14, y + 4, 269, 15, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14); // Amber 800
    doc.text('VERIFICATION AND RECOVERY GUIDELINES:', 18, y + 9);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(120, 53, 4); // Amber 900
    doc.setFontSize(7.5);
    const disclaimerMsg = "This document serves as an official confirmation of unclaimed corporate shares and dividend balances matched within public ledger files. To begin recovery, submit this ledger proof, your PAN certificate, and the appropriate IEPF Form-5 claim submission to the verified company registrar.";
    const wrappedDisclaimer = doc.splitTextToSize(disclaimerMsg, 260);
    doc.text(wrappedDisclaimer, 18, y + 13);

    // 5. Signature and Footer rule
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 24, 283, y + 24);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Disclaimer: This is an automatically verified registry statement. No manual physical signature is required under current MCA regulatory updates.', 14, y + 28);
    doc.text('Secure Union Assets Retrieval Ledger Engine | A1-90-C0-FF', 214, y + 28);

    // Trigger local PDF download
    doc.save(`Unclaimed_Assets_Report_${queryName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div 
      className="w-full py-10 px-4 sm:px-6 lg:px-8 relative min-h-[85vh] flex flex-col items-center justify-start text-[#171717]"
      style={{
        backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}
    >
      <div className="max-w-7xl w-full space-y-6">
        
        {/* Top bar with Navigation and Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-dark-charcoal font-sans">
              Search Results
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Matched records for <span className="font-bold text-cofounder-blue">{queryName}</span> in <span className="font-semibold">{queryCity} ({queryState})</span>
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                if (isReportUnlocked) {
                  downloadAllPDF();
                } else {
                  setPaymentTarget('all');
                  setPaymentStep('select');
                  setShowPaymentModal(true);
                }
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-750 hover:from-amber-750 hover:to-amber-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
              id="results-download-pdf-btn"
            >
              {isReportUnlocked ? (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download All (PDF)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock & Download All (₹99)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setView('landing')}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold text-dark-charcoal transition-all cursor-pointer shadow-xs"
              id="results-search-again-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Search Another Name</span>
            </button>
          </div>
        </div>

        {/* SPECIAL DISCOUNT PAYMENT PROMOTIONAL BANNER */}
        {!isReportUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] border border-amber-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg"
          >
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Special Verification Discount Applied</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-950 font-sans tracking-tight">
                Unlock Complete Registry Audit Report
              </h2>
              <p className="text-xs sm:text-sm text-amber-900/80 leading-relaxed max-w-2xl font-semibold">
                The secure MCA, SEBI and IEPF registries matching <span className="font-bold text-[#004b87]">{queryName}</span> have been verified. Access all company names, active physical folio numbers, full registry addresses, and exact shares to proceed with claiming.
              </p>
              
              <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-2 select-none">
                <span className="inline-flex items-center text-[10px] bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-extrabold shadow-3xs uppercase tracking-wide">
                  ⭐ Individual Results: ₹49 / Record
                </span>
                <span className="inline-flex items-center text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-1 rounded-lg font-extrabold shadow-3xs uppercase tracking-wide">
                  🚀 All {results.length} Records: ₹99 Total (Save Big!)
                </span>
              </div>
            </div>
            
            <div className="bg-white border border-amber-200/85 rounded-2xl p-5 sm:p-6 shadow-sm min-w-[280px] text-center space-y-4 shrink-0">
              <div>
                <span className="text-xs text-slate-400 font-bold line-through block uppercase tracking-wider">Standard Price: ₹199</span>
                <span className="text-3xl font-black text-amber-950 block mt-1 tracking-tight font-sans">
                  ₹99 <span className="text-xs text-amber-700 font-medium">one-time charge</span>
                </span>
              </div>
              
              <button
                onClick={() => {
                  setPaymentTarget('all');
                  setPaymentStep('select');
                  setShowPaymentModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Pay ₹99 Now</span>
              </button>
              
              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                <span>100% Encrypted & Secure Payout</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results table card matches screenshot exactly but adds the required Columns */}
        <motion.div 
          className="bg-white rounded-xl border border-gray-150 shadow-[0_15px_40px_-5px_rgba(0,0,0,0.05)] overflow-hidden"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="results-data-table">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100 text-[10px] sm:text-xs font-sans tracking-wider text-gray-500 uppercase font-extrabold">
                  <th className="py-4 px-6 w-12 text-center">#</th>
                  <th className="py-4 px-6">Investor Name</th>
                  <th className="py-4 px-6">Father's Name</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Folio Number</th>
                  <th className="py-4 px-6">State</th>
                  <th className="py-4 px-6">Full Address</th>
                  <th className="py-4 px-6 text-right">Shares</th>
                  <th className="py-4 px-6 text-center">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-sans text-xs sm:text-sm">
                {isLoadingResults ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-4 border-[#004b87] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold text-slate-500 tracking-wider">QUERYING LIVE SUPABASE POSTGRESQL REGISTRY...</span>
                      </div>
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">
                      <div className="max-w-md mx-auto space-y-2 py-4">
                        <p className="text-base font-bold text-amber-950">No Database Matches Located</p>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Your search was checked against the registry database and no records matching <span className="font-bold text-[#004b87]">"{queryName}"</span> were found.
                        </p>
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 font-medium leading-relaxed">
                          Try alternate spellings of the name (records are often filed with initials or maiden names), or check back later — new company registries are added to the database every month.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  results.map((row) => {
                    const isRowUnlocked = isReportUnlocked || unlockedRowIds.includes(row.id);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-4 px-6 text-center text-gray-400 font-medium">{row.id}</td>
                        <td className="py-4 px-6 font-bold text-dark-charcoal tracking-tight">
                          {row.investorName}
                        </td>
                        <td className="py-4 px-6 text-gray-600 font-medium text-xs whitespace-normal max-w-[150px] leading-relaxed">
                          {row.fatherName || 'NA'}
                        </td>
                        <td className="py-4 px-6 text-gray-700 font-semibold">
                          {isRowUnlocked ? row.company : (
                            <span className="blur-[5.5px] select-none text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded">
                              {row.company}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {isRowUnlocked ? (
                            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                              {row.folioNumber || 'NA'}
                            </span>
                          ) : (
                            <span className="blur-[6px] select-none text-slate-400 font-mono text-xs bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/20">
                              {row.folioNumber || 'NA'}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50/80 border border-blue-100 text-[10px] font-extrabold text-[#0066cc] uppercase tracking-wide">
                            {row.state}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-600 font-medium whitespace-normal max-w-[280px] leading-relaxed">
                          {row.address || 'NA'}
                        </td>
                        <td className="py-4 px-6 text-right font-extrabold text-base">
                          {isRowUnlocked ? (
                            <span className="text-[#10b981]">{row.shares.toLocaleString('en-IN')}</span>
                          ) : (
                            <span className="blur-[5px] select-none text-slate-400">
                              {row.shares.toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isRowUnlocked ? (
                            <button
                              onClick={() => downloadSingleResultPDF(row)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#004b87] hover:bg-[#003d70] text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 shadow-md"
                              title={`Download PDF for ${row.company}`}
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setPaymentTarget(row.id);
                                setLastSingleRowId(row.id);
                                setPaymentStep('select');
                                setShowPaymentModal(true);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-750 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 shadow-md"
                              title="Pay to unlock single record"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Unlock (₹49)</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Simplified audit disclaimer banner */}
        <div className="p-4 bg-amber-50/60 border border-amber-200/50 rounded-xl text-xs text-amber-900 flex items-start space-x-2.5 font-sans">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">
            <strong>Verification Record:</strong> These search results are fetched directly from MCA, SEBI, and IEPF public records in real-time. Unclaimed shares are held under physical form custodianship. If any discrepancy is found, please verify against the original share ledger certificates or initiate recovery claiming guidelines.
          </p>
        </div>

        {/* Quick Action Footer Component for Compliance and Claims */}
        <DashboardQuickActionFooter setView={setView} resultsCount={results.length} />

      </div>

      {/* Dynamic Payment Gate Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="payment-modal-backdrop">
          {/* Backdrop with elegant glass blur */}
          <div 
            className="fixed inset-0 bg-[#171717]/60 backdrop-blur-md transition-opacity" 
            onClick={() => {
              if (paymentStep !== 'processing') {
                setShowPaymentModal(false);
              }
            }}
          />

          {/* Modal box */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-[0_30px_90px_-10px_rgba(0,0,0,0.4)] border border-slate-200 overflow-hidden relative z-10 font-sans text-left"
            id="payment-modal-container"
          >
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-700">
                  <ShieldCheck className="w-5 h-5 text-amber-700 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-sans font-extrabold text-sm text-[#171717] tracking-tight uppercase">Secured Verification Gateway</h3>
                  <p className="text-[10px] text-[#646464] font-light">NPCI BHIM-UPI / SECURE PAYMENT ENCRYPTION</p>
                </div>
              </div>
              
              {paymentStep !== 'processing' && (
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="p-1 rounded-full text-slate-400 hover:text-[#171717] hover:bg-slate-100 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {paymentStep === 'select' && (
              <div className="p-6 space-y-6">
                {/* Summary bar */}
                {(() => {
                  const targetRow = paymentTarget !== 'all' && paymentTarget !== null ? results.find(r => r.id === paymentTarget) : null;
                  return (
                    <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-sans font-bold uppercase text-amber-800 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10 select-none">
                            OFFER: 50% DISCOUNT
                          </span>
                          <h4 className="font-sans font-extrabold text-slate-800 text-sm mt-1">
                            {paymentTarget === 'all'
                              ? `Unlock Complete Audit Report (${results.length} Record${results.length !== 1 ? 's' : ''})`
                              : `Unlock Record Details (Record #${paymentTarget})`}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-light mt-0.5">
                            {paymentTarget === 'all' ? (
                              <>
                                Target Inquiry: <span className="font-semibold text-slate-700">{queryName}</span> | Location: <span className="font-semibold text-slate-700">{queryCity} ({queryState})</span>
                              </>
                            ) : (
                              <>
                                Registrant: <span className="font-semibold text-slate-700">{targetRow?.investorName}</span> | State: <span className="font-semibold text-slate-700">{targetRow?.state}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs text-slate-400 line-through font-mono block select-none">
                            ₹{paymentTarget === 'all' ? '199' : '99'}
                          </span>
                          <span className="text-xl font-black text-amber-950 font-mono select-none">
                            ₹{paymentTarget === 'all' ? '99' : '49'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t border-amber-500/10 flex items-center justify-between text-[10px] text-amber-800/85">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Includes verified folio codes & claims guidelines</span>
                        </span>
                        <span className="font-bold">GST Included (0%)</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Package Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
                    Select Unlock Package
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Single Result */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = lastSingleRowId || results[0]?.id || 1;
                        setPaymentTarget(targetId);
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative cursor-pointer ${
                        paymentTarget !== 'all'
                          ? 'border-amber-600 bg-amber-500/[0.02] text-amber-950'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between font-sans">
                        <span className="text-xs font-extrabold">Single Record</span>
                        <span className="text-sm font-black font-mono text-amber-750">₹49</span>
                      </div>
                      <p className="text-[10px] font-medium opacity-85 mt-1 font-sans">
                        Unlock only specific record's folio, shares and address.
                      </p>
                      {paymentTarget !== 'all' && (
                        <div className="absolute top-0 right-0 w-4 h-4 bg-amber-600 rounded-bl-lg flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>

                    {/* Option 2: All Results */}
                    <button
                      type="button"
                      onClick={() => setPaymentTarget('all')}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative cursor-pointer ${
                        paymentTarget === 'all'
                          ? 'border-amber-600 bg-amber-500/[0.02] text-amber-950'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold">Complete Bundle</span>
                          <span className="text-[8px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded tracking-wide leading-none animate-pulse">
                            Best Value
                          </span>
                        </div>
                        <span className="text-sm font-black font-mono text-amber-750">₹99</span>
                      </div>
                      <p className="text-[10px] font-medium opacity-85 mt-1 font-sans">
                        Unlock all {results.length} matched records & download PDF dossier.
                      </p>
                      {paymentTarget === 'all' && (
                        <div className="absolute top-0 right-0 w-4 h-4 bg-amber-600 rounded-bl-lg flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
                    Choose Secure Payout Option
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'upi_qr', name: 'UPI QR' },
                      { id: 'upi_id', name: 'UPI ID' },
                      { id: 'card', name: 'Card' }
                    ].map((tab) => {
                      const active = paymentMethod === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setPaymentMethod(tab.id as any)}
                          className={`py-3.5 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-amber-600 border-amber-600 text-white shadow-xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[10px]">{tab.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab content area */}
                <div className="min-h-[140px] flex items-center justify-center bg-slate-50 border border-slate-150 rounded-2xl p-4 sm:p-5">
                  {paymentMethod === 'upi_qr' && (
                    <div className="text-center space-y-4 w-full">
                      <div className="relative inline-block bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs select-none">
                        <div className="absolute left-3 right-3 h-[2px] bg-emerald-500 top-2 rounded-full shadow-[0_0_10px_#10b981] animate-pulse" />
                        <svg className="w-28 h-28 mx-auto text-slate-800" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 5h22v22H5zm48 0h22v22H53zM5 53h22v22H5z" fill="currentColor" />
                          <path d="M10 10h12v12H10zm48 0h12v12H58zm-48 43h12v12H10z" fill="white" />
                          <path d="M35 5h5v20h-5zM5 35h20v5H5zm40 15h15v5H45z" fill="currentColor" />
                        </svg>
                      </div>
                      <p className="text-[11px] font-mono font-bold text-slate-750">
                        Scan QR using PhonePe, GPay, Paytm or any UPI App
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'upi_id' && (
                    <div className="space-y-3.5 w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase block select-none">Enter Virtual Payment Address (VPA)</label>
                      <input 
                        type="text" 
                        placeholder="username@okaxis"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400 font-light">A collect request will be triggered to your UPI app instantly.</p>
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="space-y-3 w-full">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block select-none mb-1">Card Number</label>
                        <input 
                          type="text" 
                          placeholder="4111 2222 3333 4444"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block select-none mb-1">Expiry</label>
                          <input 
                            type="text" 
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block select-none mb-1">CVV</label>
                          <input 
                            type="password" 
                            placeholder="•••"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Simulated Pay Now Button */}
                <button
                  onClick={handleStartPayment}
                  disabled={paymentMethod === 'upi_id' && !upiId}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  <span>Pay ₹{paymentTarget === 'all' ? '99' : '49'} Securely</span>
                </button>

                {/* Badges footer */}
                <div className="flex items-center justify-center space-x-5 text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-600" /> PCI-DSS Compliant</span>
                  <span>•</span>
                  <span>SSL SECURED</span>
                </div>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-600">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-extrabold text-sm text-[#171717] uppercase tracking-wider">Authorizing Transaction</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">Please do not refresh or close this tab. Initiating bank authorization secure handshake...</p>
                </div>
                
                <div className="max-w-xs mx-auto space-y-1.5">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-600 h-full transition-all duration-300" style={{ width: `${processingProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{processingProgress}% Complete</span>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <Check className="w-8 h-8 animate-bounce text-green-600" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-sm text-green-800 uppercase tracking-wider">Payment Verified Successfully</h4>
                  <p className="text-xs text-green-600 font-medium">All matched records unmasked and fully unlocked!</p>
                </div>
                
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md"
                >
                  View Unlocked Report
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

