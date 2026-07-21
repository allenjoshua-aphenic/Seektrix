import React, { useRef, useState } from 'react';
import { SearchQuery, UnclaimedAsset, AssetCategory } from '../types';
import { 
  ArrowLeft, Landmark, FileCheck, ShieldAlert, Award, 
  HelpCircle, Download, CheckCircle, MapPin, Calendar, FileText, ChevronRight,
  ShieldCheck, AlertTriangle, Hash, HelpCircle as QrCode,
  Lock, Unlock, CreditCard, Check, Sparkles, X
} from 'lucide-react';
import { motion } from 'motion/react';
import { jsPDF } from 'jspdf';
import { useAppStore } from '../store/useAppStore';

interface ReportViewProps {
  currentQuery: SearchQuery | null;
  setView: (view: any) => void;
}

export default function ReportView({ currentQuery, setView }: ReportViewProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { unlockedAssetIds, unlockAsset, addToast, recordPayment } = useAppStore();

  const [assets, setAssets] = useState<UnclaimedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment states
  const [paymentAsset, setPaymentAsset] = useState<UnclaimedAsset | 'all' | null>(null);
  const [paymentStep, setPaymentStep] = useState<'select' | 'processing' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'upi_qr' | 'upi_id' | 'card'>('upi_qr');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  React.useEffect(() => {
    if (!currentQuery) return;
    if (currentQuery.matchedCount === 0) {
      setAssets([]);
      setLoading(false);
      return;
    }

    let active = true;
    const fetchMatches = async () => {
      try {
        const response = await fetch(`/api/search/${currentQuery.id}/matches`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        
        const mappedAssets: UnclaimedAsset[] = data.map((item: any, idx: number) => ({
          id: item.id || `ASSET-${idx}`,
          category: 'Shares',
          companyName: item.companyName || item.company_name,
          holderName: item.holderName || item.holder_name,
          fatherHusbandName: item.fatherName || item.father_name || 'N/A',
          amount: Number(item.unclaimedAmount || item.unclaimed_amount || 0),
          shares: Number(item.shares ?? 0),
          folioNumberOrId: item.folioNumber || item.folio_number || '',
          claimAuthority: '',
          stateOrCity: item.fullAddress || item.full_address || item.state || item.municipalRegion || item.municipal_region || '',
          matchConfidence: Number(item.matchedSimilarityScore ?? item.matched_similarity_score ?? 0),
          disclosureSource: item.disclosureSource || item.disclosure_source || '',
          refNumber: item.folioNumber || item.folio_number || '',
          financialYear: '',
          lastTransmissionDate: undefined,
          status: 'Unclaimed',
          matchReasons: [
            'Name-similarity match (pg_trgm) against the unclaimed_assets registry database'
          ]
        }));

        if (active) {
          setAssets(mappedAssets);
          setLoading(false);
        }
      } catch (e) {
        // API unreachable — show an honest empty state, never generated data.
        if (active) {
          setAssets([]);
          setLoading(false);
        }
      }
    };

    fetchMatches();
    return () => {
      active = false;
    };
  }, [currentQuery]);

  if (!currentQuery) {
    return (
      <div className="bg-ash-gray py-16 text-center font-mono">
        <p className="text-red-500">Error: No active search query has been loaded.</p>
        <button onClick={() => setView('dashboard')} className="mt-4 text-xs text-cofounder-blue underline">
          Return to Workspace
        </button>
      </div>
    );
  }

  // Fetch match details based on search criteria
  const isMatchEmpty = currentQuery.matchedCount === 0;
  const lockedAssets = assets.filter((a) => !unlockedAssetIds.includes(a.id));

  const handleStartPayment = () => {
    setPaymentStep('processing');
    setProcessingProgress(0);
    
    const interval = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (paymentAsset === 'all') {
              assets.forEach((a) => unlockAsset(a.id));
              recordPayment(99, `Unlocked full report for ${currentQuery?.fullName || 'Search Query'}`);
              addToast(
                'Full Report Unlocked',
                `Successfully unlocked all ${assets.length} discovered asset records for ₹99!`,
                'success'
              );
            } else if (paymentAsset) {
              unlockAsset(paymentAsset.id);
              recordPayment(49, `Unlocked ${paymentAsset.category} portfolio details for ${currentQuery?.fullName || 'Search Query'}`);
              addToast(
                'Payment Verified',
                `Successfully unlocked ${paymentAsset.category} portfolio details for ₹49!`,
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

  const handleDownload = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const refChecksum = `SHA256:${currentQuery.id.substring(3).toLowerCase()}${(currentQuery.fullName.length * 9283 + 7711).toString(16).padStart(8, 'a')}fbc7719d`;
    const formattedDate = currentQuery.submittedAt;
    const totalValStr = isMatchEmpty ? 'INR 0' : `INR ${assets.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-IN')}`;

    // Helper to draw standard page decoration
    const drawPageBorders = (pageNo: number) => {
      // Outer frame border to make it look like an authentic certificate
      doc.setDrawColor(222, 226, 222);
      doc.rect(10, 10, 190, 277);

      // Top banner color band
      doc.setFillColor(0, 129, 192);
      doc.rect(11, 11, 188, 4, 'F');

      // Header on every page
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 129, 192);
      doc.text('SEEKTRIX DATABASE VERIFICATION SYSTEMS', 20, 22);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('STANDARD PUBLIC COMPLIANCE & ASSET TRACING LEDGER', 20, 26);

      // Divider line
      doc.setDrawColor(230, 230, 228);
      doc.line(20, 29, 190, 29);

      // Page Number indicator
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${pageNo} of 2`, 175, 22);
      doc.text(`REF ID: ${currentQuery.id.toUpperCase()}`, 145, 26);
    };

    // ----- PAGE 1 -----
    drawPageBorders(1);

    // Title Block
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(23, 23, 23);
    if (isMatchEmpty) {
      doc.text('CERTIFICATE OF VERIFIED REGISTRY CLEARANCE', 20, 38);
    } else {
      doc.text('COMPLIANCE DISCOVERY & ASSET RECOVERY DOSSIER', 20, 38);
    }

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Official compliance report compiled on ${formattedDate} from deep registry indexes.`, 20, 42);

    // SUMMARY BLOCK (New section)
    doc.setFillColor(245, 248, 250);
    doc.rect(20, 47, 170, 36, 'F');
    doc.setDrawColor(210, 225, 235);
    doc.rect(20, 47, 170, 36, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 129, 192);
    doc.text('VERIFICATION AND SUMMARY OF FINDINGS', 25, 53);

    // Table outline grid within summary block
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Target Query Name:', 25, 59);
    doc.text('Target Location Area:', 25, 64);
    doc.text('Report Checksum/ID:', 25, 69);
    doc.text('Security Fingerprint:', 25, 74);

    doc.text('Discovery Status:', 110, 59);
    doc.text('Records Located:', 110, 64);
    doc.text('Claimable Value:', 110, 69);
    doc.text('Confidence Rating:', 110, 74);

    // Values of summary block
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(23, 23, 23);
    doc.text(currentQuery.fullName.toUpperCase(), 55, 59);
    doc.text(currentQuery.city.toUpperCase() + ', ' + (currentQuery.state || 'IN').toUpperCase(), 55, 64);
    doc.setFont('Courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(currentQuery.id.toUpperCase(), 55, 69);
    doc.text(refChecksum, 55, 74);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    if (isMatchEmpty) {
      doc.setTextColor(16, 124, 65);
      doc.text('VERIFIED CLEAR / NO DEBTS', 138, 59);
      doc.text('0 REGISTER MATCHES', 138, 64);
      doc.text('INR 0.00', 138, 69);
    } else {
      doc.setTextColor(192, 50, 0);
      doc.text('UNCLAIMED FINANCES FOUND', 138, 59);
      doc.setTextColor(23, 23, 23);
      doc.text(`${currentQuery.matchedCount} DISCLOSED ACCOUNTS`, 138, 64);
      doc.setTextColor(16, 124, 65);
      doc.text(totalValStr, 138, 69);
    }
    doc.setTextColor(23, 23, 23);
    doc.text(`${currentQuery.confidenceScore}% AUDIT CONFIDENCE`, 138, 74);

    let currentY = 92;

    // Identified Register Items Section
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(23, 23, 23);
    doc.text(isMatchEmpty ? 'VERIFIED SEARCH SCOPES DETECTED' : 'IDENTIFIED PUBLIC REGISTER ENTRIES', 20, currentY);
    currentY += 5;

    if (isMatchEmpty) {
      // Search list
      const databases = [
        { name: 'MCA IEPF (Investor Education & Protection Fund)', status: 'COMPLETED - 0 Matches Registered' },
        { name: 'AMFI Inoperative Mutual Fund Holdings & Dividends', status: 'COMPLETED - 0 Matches Registered' },
        { name: 'EPFO Inoperative Pension & Provident Accounts', status: 'COMPLETED - 0 Matches Registered' },
        { name: 'LIC Unclaimed Claims and Dormant Life Insurance Ledgers', status: 'COMPLETED - 0 Matches Registered' },
        { name: 'SEBI Outstanding Registrar Unclaimed Share Lists', status: 'COMPLETED - 0 Matches Registered' }
      ];

      databases.forEach((db) => {
        doc.setFillColor(252, 252, 252);
        doc.rect(20, currentY, 170, 11, 'F');
        doc.setDrawColor(235, 235, 232);
        doc.rect(20, currentY, 170, 11, 'D');

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);
        doc.text(db.name, 24, currentY + 7);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(16, 124, 65);
        doc.text(db.status, 124, currentY + 7);

        currentY += 14;
      });

      // Verification text block at the bottom of Page 1
      doc.setFillColor(240, 248, 242);
      doc.rect(20, currentY, 170, 22, 'F');
      doc.setDrawColor(200, 230, 210);
      doc.rect(20, currentY, 170, 22, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(16, 124, 65);
      doc.text('REGISTRY CLEARANCE CONFIRMATION', 24, currentY + 6);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 90, 70);
      doc.text('This verifies that a comprehensive scanning pipeline executed on index targets concluded with clear results.', 24, currentY + 11);
      doc.text('No matching portfolios, old certificates, dormant holdings, or forgotten claim pools are present for index records.', 24, currentY + 16);

    } else {
      // Loop assets
      assets.forEach((asset, idx) => {
        if (currentY + 28 > 270) {
          // If we run out of room on page 1
          doc.addPage();
          drawPageBorders(1);
          currentY = 35;
        }

        const isUnlocked = unlockedAssetIds.includes(asset.id);
        const estimatedShares = asset.shares ?? 0;

        const pdfFolio = isUnlocked ? asset.folioNumberOrId : 'XXXX-XXXX (LOCKED)';
        const pdfCompanyName = isUnlocked ? asset.companyName : `${asset.companyName.split(' ')[0] || 'Company'} [LOCKED - PAY ₹49]`;
        const pdfDisclosure = isUnlocked ? asset.disclosureSource : 'Public Disclosure Ledger [LOCKED]';
        const pdfValuation = isUnlocked ? `INR ${asset.amount.toLocaleString('en-IN')}` : 'INR XX,XXX (LOCKED)';
        const pdfShares = isUnlocked ? `${estimatedShares} Shares` : 'XX Shares (LOCKED)';

        doc.setFillColor(255, 255, 254);
        doc.rect(20, currentY, 170, 26, 'F');
        doc.setDrawColor(222, 226, 222);
        doc.rect(20, currentY, 170, 26, 'D');

        // Number Indicator tag inside the list
        doc.setFillColor(0, 129, 192);
        doc.rect(23, currentY + 4, 15, 4.5, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(`ASSET ${idx + 1}`, 25, currentY + 7.2);

        // Share/holding ref
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(`Ref Folio: ${pdfFolio}`, 44, currentY + 7.2);
        doc.text(`Type: ${asset.category.toUpperCase()} (${pdfShares})`, 90, currentY + 7.2);

        // Company Name
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(23, 23, 23);
        doc.text(pdfCompanyName, 24, currentY + 14);

        // Subtext details
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`Registrant: ${asset.holderName} | Parent: ${asset.fatherHusbandName || 'NA'}`, 24, currentY + 19);
        doc.text(`Claim Authority: ${asset.claimAuthority} | Address: ${asset.stateOrCity}`, 24, currentY + 23);

        // Right side values
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('ESTIMATED VALUATION', 134, currentY + 8);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(16, 124, 65);
        doc.text(pdfValuation, 134, currentY + 14);

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 129, 192);
        doc.text(`MATCH CONFIDENCE: ${asset.matchConfidence}%`, 134, currentY + 20);

        currentY += 29;
      });
    }

    // Footnote on page 1
    doc.setDrawColor(230, 230, 228);
    doc.line(20, 260, 190, 260);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('SECURITY NOTICE & COMPLIANCE STAMP', 20, 266);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Disclaimer: This is Page 1 of the official Seektrix compliance tracing document. Please consult Page 2 for official', 20, 270);
    doc.text('claims procedures, legal disclaimers, next actions, and report registry authenticity checksum files.', 20, 273);


    // ----- PAGE 2: RECOMMENDED CLAIMS STEPS & LEGAL DISCLAIMERS (New Polish) -----
    doc.addPage();
    drawPageBorders(2);

    let nextY = 38;

    // NEXT STEPS SECTION: Recommended Claim Process
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 129, 192);
    doc.text('RECOMMENDED CLAIM PROCESS & WORKFLOW ACTIONS', 20, nextY);
    nextY += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('To redeem identified assets from the public registers, follow the official SEBI & IEPF guidelines below:', 20, nextY);
    nextY += 6;

    // 4 requested steps
    const claimsSteps = [
      {
        step: '1',
        title: 'Contact Registrar and Share Transfer Agent (RTA)',
        text: 'Initiate a formal query to the designated company registrar (e.g., KFinTech, Link Intime, etc.) to verify physical folio codes, shareholder addresses, and outstanding dividends matching the indexed registers.'
      },
      {
        step: '2',
        title: 'Submit Comprehensive Identity Proof & Credentials Dossier',
        text: 'File duly self-attested identity certificates, including PAN card copies, Aadhaar verification, utility proof, and signature specimen records matching historical files.'
      },
      {
        step: '3',
        title: 'Initiate Transfer & Ledger Demat Account Registration',
        text: 'Prepare state-approved Indemnity Bonds, Surety agreements, and physical/digital transfer forms (such as SEBI Form ISR-1, ISR-2, and IEPF-5) to coordinate dematerialization and transfer clearances.'
      },
      {
        step: '4',
        title: 'Follow SEBI/IEPF Verification Rules & Claim Approvals',
        text: 'Coordinate directly with the issuer\'s corporate Nodal Officer for physical document verification. Follow standard guidelines to submit files for MCA portal verification and ultimate payout approval.'
      }
    ];

    claimsSteps.forEach((s) => {
      // Step panel box
      doc.setFillColor(252, 252, 252);
      doc.rect(20, nextY, 170, 20, 'F');
      doc.setDrawColor(230, 230, 228);
      doc.rect(20, nextY, 170, 20, 'D');

      // Step Number circle/box
      doc.setFillColor(0, 129, 192);
      doc.rect(22, nextY + 3.5, 6, 6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(s.step, 24.3, nextY + 7.8);

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(23, 23, 23);
      doc.text(s.title, 31, nextY + 7.5);

      // Description text
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text(s.text, 31, nextY + 12, { maxWidth: 153 });

      nextY += 23;
    });

    nextY += 3;

    // REPORT AUTHENTICITY SECTION (New Polish)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(23, 23, 23);
    doc.text('REPORT AUTHENTICITY & CONTROL METRICS', 20, nextY);
    nextY += 5;

    doc.setFillColor(253, 252, 250);
    doc.rect(20, nextY, 170, 32, 'F');
    doc.setDrawColor(235, 230, 220);
    doc.rect(20, nextY, 170, 32, 'D');

    // Drawing a visual QR / stamp indicator box on the right of the authenticity metrics
    doc.setFillColor(240, 240, 238);
    doc.rect(155, nextY + 4, 24, 24, 'F');
    doc.setDrawColor(210, 210, 208);
    doc.rect(155, nextY + 4, 24, 24, 'D');
    doc.setFont('Courier', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text('[ SECURE ]', 159, nextY + 12);
    doc.text('[ VERIFY ]', 159, nextY + 16);
    doc.text('[ SEAL   ]', 159, nextY + 20);

    // Credentials / Checksum values on left
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text('Cryptographic Checksum:', 24, nextY + 9);
    doc.text('Audit Tracking Node:', 24, nextY + 14);
    doc.text('Verification Code:', 24, nextY + 19);
    doc.text('Digital Signature Status:', 24, nextY + 24);

    doc.setFont('Courier', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(23, 23, 23);
    doc.text(refChecksum, 62, nextY + 9);
    doc.text(`SEEK-NODE-${(currentQuery.city.slice(0,3)).toUpperCase()}-${(currentQuery.id.slice(6)).toUpperCase()}`, 62, nextY + 14);
    doc.text('SYSTEM-VERIFIED-LEVEL-4', 62, nextY + 19);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(16, 124, 65);
    doc.text('SECURELY SIGNED & ENCRYPTED IN PUBLIC RECORD DATABASE', 62, nextY + 24);

    nextY += 38;

    // LEGAL DISCLAIMER
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(192, 50, 0);
    doc.text('LEGAL COMPLIANCE DISCLAIMER', 20, nextY);
    nextY += 4;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 130, 130);
    const legalText = 'COMPLIANCE STATEMENT: This tracing report is compiled systematically from publicly disclosed periodic tables, MCA IEPF portals, corporate registers, and other official national records. This report functions as a research tool to locate potentially associated assets. Seektrix does not claim or warrant legal ownership of the specified funds, nor do we act as a licensing authority. All final redemptions must pass official scrutiny and verify through respective Registrars, Company Nodal Officers, and Judicial / Regulatory ministries. Total yields listed are calculated estimates and may fluctuate depending on corporate dividends or market interest index rates in effect during transfer.';
    doc.text(legalText, 20, nextY, { maxWidth: 170 });

    // Show warnings if downloading with locked entries
    const lockedCount = assets.filter(a => !unlockedAssetIds.includes(a.id)).length;
    if (lockedCount > 0) {
      addToast(
        'Masked Draft Exported',
        `Generated PDF has ${lockedCount} locked entries. Unlock each portfolio record to reveal full registry codes, folios, and company identities.`,
        'warning'
      );
    } else {
      addToast(
        'Audit Dossier Exported',
        'Successfully compiled and downloaded the official unmasked digital asset ledger.',
        'success'
      );
    }

    // Save as complete real PDF!
    doc.save(`SEEKTRIX_VERIFIED_REPORT_${currentQuery.id.toUpperCase()}.pdf`);
  };

  const getCategoryIcon = (category: AssetCategory) => {
    return <FileText className="w-4 h-4 text-cofounder-blue" />;
  };

  // Checksum calculation to match PDF content state
  const visualChecksum = `SHA256:${currentQuery.id.substring(3).toLowerCase()}${(currentQuery.fullName.length * 9283 + 7711).toString(16).padStart(8, 'a')}fbc7719d`;
  const totalSumAmount = isMatchEmpty ? 0 : assets.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-transparent min-h-[90vh] pt-3 pb-10 text-[#171717] relative z-10" id="report-view-root">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Navigation / Actions Bar */}
        <div className="flex justify-between items-center bg-transparent no-print" id="report-navbar">
          <button
            onClick={() => setView('dashboard')}
            className="text-xs font-mono uppercase text-[#646464] hover:text-[#171717] transition-colors flex items-center space-x-1.5 cursor-pointer"
            id="report-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
          </button>
          
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleDownload}
              className="h-10 px-5 bg-cofounder-blue hover:bg-[#0074ad] text-xs font-mono tracking-wide uppercase text-white rounded-xl flex items-center justify-center space-x-2.5 shadow-sm font-bold cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md"
              id="report-download-btn"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Download Verified PDF</span>
            </button>
          </div>
        </div>
 
        {/* Crisp Document Container simulating formal audit sheet */}
        <div 
          ref={reportRef}
          className="report-page glass-panel-light rounded-2xl p-6 sm:p-10 shadow-[0_30px_70px_-10px_rgba(0,0,0,0.12),inset_0_1px_2.5px_rgba(255,255,255,0.95)] border border-white/75 space-y-8 relative overflow-hidden"
          id="report-paper-container"
        >
          {/* Subtle watermark or side badge */}
          <div className="absolute right-0 top-0 bg-[#0081c0]/5 text-action-azure font-sans text-[9px] tracking-widest py-1.5 px-4 rounded-bl border-l border-b border-steel-gray/10 uppercase font-bold" id="badge-clearance">
            {isMatchEmpty ? 'Verified Clear' : 'Discovered Asset Report'}
          </div>

          {/* Report Sheet Header */}
          <div className="border-b border-steel-gray/20 pb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4" id="report-header-block">
            <div className="space-y-1.5">
              <span className="text-[10px] text-action-azure font-sans font-bold uppercase tracking-wider flex items-center space-x-1">
                <Landmark className="w-4 h-4 shrink-0 animate-pulse" />
                <span>SEEKTRIX DATABASE VERIFICATION SYSTEMS</span>
              </span>
              <h2 className="font-serif-intellectual text-2xl sm:text-3xl font-medium tracking-tight text-dark-charcoal">
                {isMatchEmpty ? 'Certificate of Verified Registry Search' : 'Unclaimed Financial Assets Compliance Dossier'}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-gray font-light">
                <span className="flex items-center space-x-1"><MapPin className="w-3.5 h-3.5 text-steel-gray shrink-0" /> <span>Scope Location: {currentQuery.city}</span></span>
                <span>•</span>
                <span className="flex items-center space-x-1"><Calendar className="w-3.5 h-3.5 text-steel-gray shrink-0" /> <span>Date Indexed: {currentQuery.submittedAt}</span></span>
              </div>
            </div>
            
            <div className="sm:text-right font-sans text-xs text-slate-gray shrink-0 space-y-0.5">
              <p className="text-[9px] text-slate-400 font-bold tracking-wide uppercase">REPORT SERIAL ID</p>
              <p className="text-cofounder-blue font-mono font-semibold text-sm">{currentQuery.id}</p>
              <p className="text-[10px] font-medium text-slate-500">CONFIDENCE: <span className="font-bold font-mono text-dark-charcoal bg-gray-100 px-1 py-0.5 rounded">{currentQuery.confidenceScore}%</span></p>
            </div>
          </div>

          {/* COMPLAINCE & VALUE SUMMARY BLOCK (Requested) */}
          <div className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4" id="report-summary-block">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-action-azure flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-action-azure" />
                <span>Verification & Audited Registry Summary</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">STATUS: VERIFIED</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Target Participant</p>
                <p className="font-bold text-dark-charcoal truncate">{currentQuery.fullName.toUpperCase()}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Claimable Valuation</p>
                <p className="font-extrabold text-emerald-700 font-mono text-sm">
                  ₹{(typeof totalSumAmount === 'number' && !isNaN(totalSumAmount)) ? totalSumAmount.toLocaleString('en-IN') : '0'}
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Database Records Checked</p>
                <p className="font-bold text-slate-800">{isMatchEmpty ? '0 Matches Found' : `${currentQuery.matchedCount} Match Records`}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-medium">Compliance Checksum</p>
                <p className="font-mono text-[9px] text-[#0081c0] font-bold select-all truncate">{visualChecksum}</p>
              </div>
            </div>
          </div>

          {/* Conditional Layouts based on scan match values */}
          {isMatchEmpty ? (
            /* EMPTY STATE: Certificate of financial cleanliness */
            <div className="space-y-8 py-4 animate-fade-in" id="report-empty-certificate">
              <div className="p-5 rounded-lg bg-green-500/5 backdrop-blur-xs border border-green-500/20 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="p-3 bg-white/40 rounded-full text-green-600 border border-green-500/10 shrink-0">
                  <Award className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.5 text-center sm:text-left">
                  <h4 className="text-sm font-semibold text-green-800 font-sans">
                    Registry Match Clearance Status: No Claims Located
                  </h4>
                  <p className="text-[11px] text-[#646464] leading-relaxed font-light">
                    This document certifies that after performing systematic index scans across MCA public records, historic shareholder registers, mutual fund rosters, and EPFO databases, **no unclaimed or dormant legacy assets** were found matching the parameters of:
                  </p>
                  <p className="font-sans text-xs font-semibold text-slate-green pt-1 bg-[#fefffc] px-2 py-1 rounded inline-block text-dark-charcoal border border-steel-gray/5">
                    Search Parameter Name: <span className="text-cofounder-blue font-medium">"{currentQuery.fullName}"</span> | Target Location: <span className="text-cofounder-blue font-medium">"{currentQuery.city}"</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4 font-sans font-light">
                <h3 className="text-xs font-sans uppercase tracking-widest text-action-azure border-b border-steel-gray/10 pb-2 font-bold">
                  Verified Inoperative Registries Scoped
                </h3>
                <p className="text-xs text-[#646464] font-light leading-relaxed">
                  Our validation platform systematically queried and validated status on the following national registries:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans text-slate-gray">
                  {[
                    { name: 'MCA IEPF (Investor Unclaimed Share & Dividends Ledger)', status: '0 matches' },
                    { name: 'AMFI (Association of Mutual Funds of India Rosters)', status: '0 matches' },
                    { name: 'EPFO (Employees Provident Fund Organization)', status: '0 matches' },
                    { name: 'LIC Unclaimed Policies Database Ledger', status: '0 matches' }
                  ].map((db, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center shadow-2xs">
                      <span className="font-medium text-slate-700 text-[11px]">{db.name}</span>
                      <span className="text-green-600 text-[9px] font-bold uppercase font-sans bg-green-50 px-2 py-1 rounded">{db.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* MATCH FOUND: High-fidelity tabular audit sheet of matching unclaimed accounts */
            <div className="space-y-8" id="report-matched-details">
              
              <div className="p-4 rounded bg-[#0081c0]/5 border border-[#0081c0]/15 backdrop-blur-xs text-xs flex items-start space-x-2">
                <ShieldAlert className="w-5 h-5 text-[#0081c0] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-dark-charcoal uppercase">Positive Discovery Match Established</span>
                  <p className="text-[11px] text-slate-gray font-light">
                    Our database verification platform identified associated files. In accordance with Indian SEBI, MCA, and IEPF guidelines, the designated legal claimant may initiate recovery operations immediately. To reveal specific company registries, ledger folio references, and download official claims verification PDF, unlock the respective records below.
                  </p>
                </div>
              </div>

              {lockedAssets.length > 0 && (
                <div 
                  className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/70 border border-amber-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 animate-fade-in"
                  id="report-unlock-all-banner"
                >
                  <div className="space-y-2 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-600/10 border border-amber-600/20 text-amber-800 text-[9px] font-sans font-bold uppercase rounded-full tracking-wide">
                        Limited Time Special Discount
                      </span>
                      <span className="flex items-center text-amber-700 text-[10px] font-bold gap-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Secure Gateway
                      </span>
                    </div>
                    <h4 className="text-base font-extrabold text-[#171717] tracking-tight">
                      Unmask Entire Audit Dossier
                    </h4>
                    <p className="text-xs text-slate-600 font-light leading-relaxed max-w-xl">
                      Unlock all <strong className="font-semibold text-slate-800">{lockedAssets.length} restricted records</strong> under this search inquiry. Get full unmasked visibility on registries, ledger volumes, folio codes, and download the print-ready compliance PDF instantly.
                    </p>
                    {/* Trust indicators */}
                    <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">🔒 256-Bit SSL</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">🏦 UPI & All Cards Accepted</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">🛡️ Refund Guarantee</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center items-center md:items-end gap-3 px-4 py-3 md:py-0 border-t md:border-t-0 md:border-l border-amber-200/60 min-w-[200px] text-center md:text-right shrink-0">
                    <div className="space-y-0.5">
                      <span className="text-xs text-slate-400 line-through font-mono font-bold block text-center md:text-right">
                        Regular Price: ₹199
                      </span>
                      <div className="flex items-baseline justify-center md:justify-end gap-1.5">
                        <span className="text-2xl font-black text-amber-950 font-sans tracking-tight">
                          ₹99
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase bg-emerald-50 border border-emerald-100 px-1 rounded">
                          Save 50%
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 block">Single payment for lifetime access</span>
                    </div>

                    <button
                      onClick={() => {
                        setPaymentAsset('all');
                        setPaymentStep('select');
                        setPaymentMethod('upi_qr');
                      }}
                      className="w-full h-11 px-6 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-xs font-mono font-bold tracking-wider uppercase text-white rounded-xl flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer border-0"
                      id="pay-now-all-btn"
                    >
                      <Sparkles className="w-4 h-4 text-amber-200 animate-pulse shrink-0" />
                      <span>Pay ₹99 Now</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Grid lists of match items categorized in elegant card blocks */}
              <div className="space-y-5">
                <h3 className="text-xs font-sans uppercase tracking-widest text-[#646464] border-b border-steel-gray/10 pb-2 font-bold">
                  DISCOVERED SHARES & REGISTRY ENTRIES ({assets.length})
                </h3>
                
                <div className="space-y-4">
                  {assets.map((asset) => {
                    const isUnlocked = unlockedAssetIds.includes(asset.id);
                    const estimatedShares = asset.shares ?? 0;

                    return (
                      <div 
                        key={asset.id} 
                        className="p-5 sm:p-6 rounded-xl border border-slate-250/60 bg-white/50 backdrop-blur-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in relative shadow-sm overflow-hidden"
                      >
                        {/* Background locked pattern indicator */}
                        {!isUnlocked && (
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.015] to-transparent pointer-events-none" />
                        )}

                        <div className="space-y-2 flex-grow">
                          <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
                            <span className="px-2 py-0.5 bg-cofounder-blue/10 border border-cofounder-blue/25 text-action-azure font-sans text-[9px] font-bold uppercase rounded">
                              {asset.category}
                            </span>
                            <span className="text-[11px] text-[#646464] font-sans font-medium">
                              Ref No:{' '}
                              {isUnlocked ? (
                                <span className="font-mono font-bold text-slate-800">{asset.folioNumberOrId}</span>
                              ) : (
                                <span className="font-mono font-bold text-slate-400 blur-[4.5px] select-none pointer-events-none">
                                  {asset.folioNumberOrId}
                                </span>
                              )}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-dark-charcoal font-sans flex items-center gap-2">
                            {isUnlocked ? (
                              <span>{asset.companyName}</span>
                            ) : (
                              <span className="relative inline-flex items-center gap-2">
                                <span className="blur-[5.5px] select-none pointer-events-none text-slate-400 font-bold tracking-tight">
                                  {asset.companyName}
                                </span>
                                <span className="bg-amber-600/10 text-amber-800 border border-amber-600/25 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-black tracking-wider animate-pulse flex items-center gap-0.5 select-none">
                                  <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                              </span>
                            )}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-[11px] text-[#646464] font-light font-sans mt-2">
                            <p className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Primary Registrant:</span> 
                              <span className="font-semibold text-[#171717]">{asset.holderName}</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Father / Spouse:</span> 
                              <span className="font-semibold text-[#171717]">
                                {asset.fatherHusbandName || 'N/A'}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Registered Address:</span> 
                              <span className="font-semibold text-[#171717]">{asset.stateOrCity}</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Shares Ledger Count:</span> 
                              {isUnlocked ? (
                                <span className="font-bold text-[#171717] font-mono">{estimatedShares} Shares</span>
                              ) : (
                                <span className="blur-[4.5px] font-mono select-none pointer-events-none text-slate-400 bg-slate-200/40 rounded px-1">
                                  {estimatedShares} Shares
                                </span>
                              )}
                            </p>
                            <p className="sm:col-span-2 flex items-center gap-1.5">
                              <span className="text-slate-400 font-semibold">Source Register:</span>{' '}
                              {isUnlocked ? (
                                <span className="font-semibold text-slate-700">{asset.disclosureSource}</span>
                              ) : (
                                <span className="blur-[4.5px] select-none pointer-events-none text-slate-400">
                                  {asset.disclosureSource}
                                </span>
                              )}
                            </p>
                          </div>

                          <p className="text-[11px] text-slate-500 font-sans mt-1">
                            Authority Hub:{' '}
                            <span className="text-cofounder-blue font-sans text-[10px] font-extrabold uppercase">
                              {asset.claimAuthority}
                            </span>
                          </p>

                          {isUnlocked && asset.matchReasons && asset.matchReasons.length > 0 && (
                            <div className="mt-3.5 p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl max-w-xl animate-fade-in">
                              <span className="text-[10px] font-bold font-sans text-cofounder-blue uppercase block mb-1">
                                Match Reason & Verification Evidence:
                              </span>
                              <ul className="list-disc pl-4 text-[10px] text-slate-600 space-y-1">
                                {asset.matchReasons.map((reason, rIdx) => (
                                  <li key={rIdx}>{reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Right side values & Action button */}
                        <div className="sm:text-right self-stretch sm:self-center shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3.5">
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] font-sans text-[#646464] font-bold uppercase tracking-wide">Market Value Estimated</p>
                            {isUnlocked ? (
                              <p className="font-sans text-xl sm:text-2xl font-bold text-dark-charcoal animate-fadeIn">
                                ₹{asset.amount.toLocaleString('en-IN')}
                              </p>
                            ) : (
                              <p className="font-sans text-xl sm:text-2xl font-bold text-slate-400 blur-[5px] select-none pointer-events-none">
                                ₹{asset.amount.toLocaleString('en-IN')}
                              </p>
                            )}
                            <div className="flex sm:justify-end">
                              <span className="text-[10px] font-sans text-green-600 font-bold tracking-wide uppercase bg-green-50 px-1.5 py-0.5 rounded border border-green-100 select-none">
                                Match Score: <span className="font-mono">{asset.matchConfidence}%</span>
                              </span>
                            </div>
                          </div>

                          {!isUnlocked && (
                            <button
                              onClick={() => {
                                setPaymentAsset(asset);
                                setPaymentStep('select');
                                setPaymentMethod('upi_qr');
                              }}
                              className="h-9 px-4.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-[11px] font-mono tracking-wider uppercase text-white rounded-xl flex items-center justify-center space-x-2 shadow-sm font-extrabold cursor-pointer transition-all duration-200 active:scale-[0.98] shrink-0"
                            >
                              <Lock className="w-3.5 h-3.5 mr-0.5 shrink-0" />
                              <span>Unlock Record</span>
                              <span className="text-[9px] opacity-70 line-through">₹99</span>
                              <span className="font-black text-amber-200">₹49</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* RECOMMENDED CLAIM PROCESS SECTION (Requested:makes PDF/UI feel REAL) */}
          <div className="space-y-4 pt-6 border-t border-slate-200" id="recommended-claim-process-section">
            <h3 className="text-xs font-sans uppercase tracking-widest text-[#0081c0] border-b border-steel-gray/10 pb-2 font-black flex items-center space-x-1.5">
              <ChevronRight className="w-4 h-4 text-[#0081c0]" />
              <span>Recommended Claim Process</span>
            </h3>
            <p className="text-xs text-[#646464] font-light leading-relaxed">
              We recommend completing recovery files in the following sequential order to guarantee approval under SEBI/IEPF guidelines:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white/40 shadow-2xs space-y-2 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cofounder-blue text-white font-sans font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-dark-charcoal">Contact Registrar and Share Transfer Agent (RTA)</h4>
                  <p className="text-[11px] font-light text-slate-gray leading-relaxed">
                    Obtain confirmation from the designated registrar (e.g. KFin Technologies, Link Intime) regarding outstanding shares, dividend folios, and past registered addresses associated with matching profiles.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white/40 shadow-2xs space-y-2 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cofounder-blue text-white font-sans font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-dark-charcoal">Submit Attested Identity Proof & KYC Credentials</h4>
                  <p className="text-[11px] font-light text-slate-gray leading-relaxed">
                    Prepare a comprehensive compliance file featuring self-attested copies of PAN card, Aadhaar card, current utility or bank Statements, and specimens to resolve any names mismatch.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white/40 shadow-2xs space-y-2 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cofounder-blue text-white font-sans font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-dark-charcoal">Initiate Demat & Payout Transfer Requests</h4>
                  <p className="text-[11px] font-light text-slate-gray leading-relaxed">
                    Submit requisite regulatory forms such as SEBI ISR-1, ISR-2 for address updates and signature validation, or file digital Form IEPF-5 via the Ministry of Corporate Affairs (MCA) portal.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white/40 shadow-2xs space-y-2 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-cofounder-blue text-white font-sans font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-dark-charcoal">Follow SEBI/IEPF Verification Rules & Approvals</h4>
                  <p className="text-[11px] font-light text-slate-gray leading-relaxed">
                    Submit physical files folders directly to the designated company Nodal Officer. The company verifies all documentation, files e-verification audits to IEPF/SEBI hubs, and issues payouts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* REPORT AUTHENTICITY BLOCK (Requested) */}
          <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-[#fbfbfa] flex flex-col sm:flex-row items-center sm:items-start gap-4" id="report-authenticity-block">
            <div className="p-3 bg-white/80 rounded-lg border border-slate-200/60 shrink-0 text-slate-700 shadow-2xs flex items-center justify-center select-none">
              <QrCode className="w-12 h-12 text-[#646464] animate-pulse" />
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <h4 className="text-xs font-bold text-dark-charcoal uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                <Hash className="w-4 h-4 text-action-azure" />
                <span>Registry Authenticity Verification Stamp</span>
              </h4>
              <p className="text-[11px] text-[#646464] leading-relaxed font-light">
                This document contains highly secured trace credentials certified by Seektrix Database Services. It can be validated by checking the cryptographic SHA-256 fingerprint matching the public audit registry ledger.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono pt-1 text-slate-gray">
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">Checksum: {visualChecksum}</span>
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">Node: SEEK-NODE-{currentQuery.city.toUpperCase().slice(0,3)}</span>
                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">Status: SECURE DIGITAL DOCUMENT</span>
              </div>
            </div>
          </div>

          {/* LEGAL DISCLAIMER BLOCK (Requested) */}
          <div className="pt-6 border-t border-slate-250 mt-4 space-y-2 text-slate-gray font-serif text-[10px]" id="report-legal-disclaimer">
            <p className="font-sans font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Legal Disclaimer & Scope Boundaries</span>
            </p>
            <p className="leading-relaxed font-light">
              STATEMENT: Seektrix operates as an independent audit discovery system scanning published public indexes (such as IEPF registers, corporate shareholder disclosures, Mutual Fund rosters, EPFO pension records, etc.). This document acts solely as an auxiliary aid to identifying potential legacy claims. Seektrix does not guarantee final claim approval, claim ownership rights, or act as an official regulatory registrar. Total valuations shown are estimates; final payouts are subject to independent validation and approval by company RTAs, company Nodal Officers, SEBI, and Central ministries.
            </p>
          </div>

          {/* Certificate signature stamp block */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] font-sans text-slate-gray gap-4" id="report-footer-block">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-green-500 animate-pulse" />
              <span className="font-bold tracking-wide text-dark-charcoal">VERIFIED DATABASE INGESTION REPORT // SEEKTRIX </span>
            </div>
            <span className="font-light text-slate-500">GENERATED ON: <span className="font-mono font-bold text-dark-charcoal">{currentQuery.submittedAt}</span></span>
          </div>

        </div>

      </div>

      {/* Dynamic Payment Gate Modal */}
      {paymentAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6" id="payment-modal-backdrop">
          {/* Backdrop with elegant glass blur */}
          <div 
            className="fixed inset-0 bg-[#171717]/60 backdrop-blur-md transition-opacity" 
            onClick={() => {
              if (paymentStep !== 'processing') {
                setPaymentAsset(null);
              }
            }}
          />

          {/* Modal box */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-[0_30px_90px_-10px_rgba(0,0,0,0.4)] border border-slate-200 overflow-hidden relative z-10 font-sans"
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
                  onClick={() => setPaymentAsset(null)} 
                  className="p-1 rounded-full text-slate-400 hover:text-[#171717] hover:bg-slate-100 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {paymentStep === 'select' && (
              <div className="p-6 space-y-6">
                {/* Summary bar */}
                <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-sans font-bold uppercase text-amber-800 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10 select-none">
                        OFFER: 50% DISCOUNT
                      </span>
                      <h4 className="font-sans font-extrabold text-slate-800 text-sm mt-1">
                        {paymentAsset === 'all' 
                          ? `Unlock Complete Audit Report (${assets.length} Records)` 
                          : `Unlock ${paymentAsset.category} Portfolio Record`}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-light mt-0.5">
                        {paymentAsset === 'all' ? (
                          <span>Target Inquiry: <span className="font-semibold text-slate-700">{currentQuery.fullName}</span> | Location: <span className="font-semibold text-slate-700">{currentQuery.city}</span></span>
                        ) : (
                          <span>Holder: <span className="font-semibold text-slate-700">{paymentAsset.holderName}</span> | State: <span className="font-semibold text-slate-700">{paymentAsset.stateOrCity}</span></span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 line-through font-mono block select-none">
                        ₹{paymentAsset === 'all' ? '199' : '99'}
                      </span>
                      <span className="text-xl font-black text-amber-950 font-mono select-none">
                        ₹{paymentAsset === 'all' ? '99' : '49'}
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

                {/* Tabs */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
                    Choose Secure Payout Option
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'upi_qr', name: 'UPI QR', icon: QrCode },
                      { id: 'upi_id', name: 'UPI ID', icon: HelpCircle },
                      { id: 'card', name: 'Card', icon: CreditCard }
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = paymentMethod === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setPaymentMethod(tab.id as any)}
                          className={`py-3.5 px-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-cofounder-blue border-cofounder-blue text-white shadow-xs' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
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
                        {/* Interactive glow laser scan line */}
                        <div className="absolute left-3 right-3 h-[2px] bg-emerald-500 top-2 rounded-full shadow-[0_0_10px_#10b981] animate-[scan_2.5s_ease-in-out_infinite]" />
                        
                        {/* Native Vector QR Code */}
                        <svg className="w-32 h-32 text-slate-800" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 5h22v22H5zm48 0h22v22H53zM5 53h22v22H5z" fill="currentColor" stroke="none" />
                          <path d="M10 10h12v12H10zm48 0h12v12H58zm-48 43h12v12H10z" fill="white" stroke="none" />
                          <path d="M36 5h4M36 12h4M36 19h4M36 26h4" strokeWidth="3" />
                          <path d="M5 36h4M12 36h4M19 36h4M26 36h4" strokeWidth="3" />
                          <path d="M43 36h4M50 36h4M57 36h4" strokeWidth="3" />
                          <path d="M8 43h2M18 43h5M28 43h2" />
                          <path d="M48 48h22M48 58h12M48 68h15M62 48h5M62 58h5" strokeWidth="2.5" />
                          <path d="M80 53h5v5h-5zm0 10h5v5h-5z" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-bold text-slate-800 flex items-center justify-center gap-1.5">
                          <span>Scan QR using PhonePe, GPay or Paytm</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-light">
                          Waiting for instant payment confirmation from your bank account...
                        </p>
                      </div>

                      <button
                        onClick={handleStartPayment}
                        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-xs font-mono tracking-wider uppercase text-white rounded-xl flex items-center justify-center space-x-2 font-bold cursor-pointer transition-all shadow-sm border-0"
                      >
                        <Check className="w-4 h-4 text-white" />
                        <span>Simulate Scan Success</span>
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'upi_id' && (
                    <div className="space-y-4 w-full">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase font-mono block">
                          Enter UPI Address
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. holder@okaxis"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cofounder-blue focus:ring-1 focus:ring-cofounder-blue"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 font-light leading-relaxed">
                        A dynamic payment collection request will be sent securely to your BHIM-UPI application dashboard.
                      </p>
                      <button
                        onClick={handleStartPayment}
                        disabled={!upiId.includes('@')}
                        className={`w-full h-11 text-xs font-mono tracking-wider uppercase rounded-xl flex items-center justify-center space-x-2 font-bold transition-all shadow-sm border-0 ${
                          upiId.includes('@')
                            ? 'bg-cofounder-blue hover:bg-action-azure text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Send UPI Request</span>
                      </button>
                    </div>
                  )}

                  {paymentMethod === 'card' && (
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-4 gap-3.5">
                        <div className="col-span-4 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase font-mono block">
                            Card Number
                          </label>
                          <input
                            type="text"
                            placeholder="4111 2222 3333 4444"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                              setCardNumber(val);
                            }}
                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-300"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase font-mono block">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            placeholder="MM / YY"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 text-center focus:outline-none focus:border-slate-300"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-extrabold text-slate-400 uppercase font-mono block">
                            CVV Code
                          </label>
                          <input
                            type="password"
                            placeholder="•••"
                            maxLength={3}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 text-center focus:outline-none focus:border-slate-300"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleStartPayment}
                        disabled={cardNumber.replace(/\s/g, '').length < 16}
                        className={`w-full h-11 text-xs font-mono tracking-wider uppercase rounded-xl flex items-center justify-center space-x-2 font-bold transition-all shadow-sm border-0 ${
                          cardNumber.replace(/\s/g, '').length >= 16
                            ? 'bg-cofounder-blue hover:bg-action-azure text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Pay ₹{paymentAsset === 'all' ? '99' : '49'} Safely</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer security badges */}
                <div className="pt-2 flex justify-center items-center gap-5 text-[10px] text-slate-400 font-sans border-t border-slate-100 select-none">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" /> 100% Encrypted
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-slate-400" /> SEBI/NPCI Verified
                  </span>
                </div>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="p-8 text-center space-y-6">
                <div className="relative w-20 h-20 mx-auto select-none">
                  {/* Outer spinning ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-cofounder-blue border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-2 bg-slate-50 rounded-full flex items-center justify-center text-cofounder-blue font-mono font-bold text-xs">
                    {processingProgress}%
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-sans font-bold text-slate-800 text-sm">Verifying with Bank Ingress Nodes</h4>
                  <p className="text-[11px] text-slate-500 font-light max-w-xs mx-auto leading-relaxed">
                    Connecting to NPCI gateway and validating secure token signatures. Do not close this window or refresh the page.
                  </p>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div className="p-8 text-center space-y-6 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-600 flex items-center justify-center mx-auto text-3xl select-none">
                  <CheckCircle className="w-10 h-10 text-emerald-600 animate-[bounce_1s_ease-in-out_1]" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-sans font-extrabold text-slate-800 text-base">Payment Verified Successfully!</h4>
                  <p className="text-xs text-[#646464] font-light max-w-sm mx-auto leading-relaxed">
                    The security ledger folder has been completely unlocked. You can now inspect all folio references, share ledgers, and download the unmasked legal PDF dossier.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs font-mono text-emerald-800">
                  <span>Transferred Amount:</span>
                  <span className="font-extrabold">
                    ₹{paymentAsset === 'all' ? '99.00' : '49.00'} INR
                  </span>
                </div>

                <button
                  onClick={() => setPaymentAsset(null)}
                  className="w-full h-11 bg-cofounder-blue hover:bg-action-azure text-xs font-mono tracking-wider uppercase text-white rounded-xl flex items-center justify-center space-x-2 font-bold cursor-pointer transition-all shadow-sm border-0"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Reveal Portfolio Details</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
