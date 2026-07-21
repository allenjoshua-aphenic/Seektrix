import { UnclaimedAsset, FAQItem, SearchQuery, SecurityCredential, PipelineLog, AssetCategory } from './types';
import { getDeterministicUnclaimedAssets } from './data/mockResults';

// Large static database representing disclosures of unclaimed shares, dividends, EPFO accounts, and insurance policies in India.
export const MASTER_UNCLAIMED_ASSETS: UnclaimedAsset[] = [
  {
    id: 'ASSET-101',
    category: 'Shares',
    companyName: 'Reliance Industries Limited',
    holderName: 'Rajesh Kumar',
    fatherHusbandName: 'Late Mohan Kumar',
    amount: 145000,
    folioNumberOrId: 'RIL-00948123',
    claimAuthority: 'IEPF Authority (Ministry of Corporate Affairs)',
    stateOrCity: 'Mumbai',
    matchConfidence: 98,
    disclosureSource: 'IEPF MCA Form 5 Web Disclosure - FY 2021-22',
    refNumber: 'IEPF2021-RIL-0948A',
    financialYear: '2021-22',
    lastTransmissionDate: '2022-11-14',
    status: 'Unclaimed',
    matchReasons: [
      'Similar legal name with high spelling similarity',
      'Historical Mumbai address match in public filings',
      'Dividend record overlap from FY 2021-22'
    ]
  },
  {
    id: 'ASSET-102',
    category: 'Mutual Funds',
    companyName: 'HDFC Mutual Fund (Prudence Growth)',
    holderName: 'Priya Sharma',
    fatherHusbandName: 'Ramesh Sharma',
    amount: 88400,
    folioNumberOrId: 'HDFC-MF-74920412',
    claimAuthority: 'AMFI Under Guidance of SEBI',
    stateOrCity: 'New Delhi',
    matchConfidence: 96,
    disclosureSource: 'AMFI Unclaimed Dividend & Redemption Database',
    refNumber: 'AMFI-HDFC-94821',
    financialYear: '2020-21',
    lastTransmissionDate: '2021-08-19',
    status: 'Unclaimed',
    matchReasons: [
      'Identical legal name match in AMFI registry',
      'Historical New Delhi address match',
      'Matching nominee surname criteria'
    ]
  },
  {
    id: 'ASSET-103',
    category: 'EPF / PPF',
    companyName: 'Employees Provident Fund Organisation (EPFO)',
    holderName: 'Rajesh Kumar',
    fatherHusbandName: 'Mohan Kumar',
    amount: 215300,
    folioNumberOrId: 'MH-BAN-0082490-000-0194829',
    claimAuthority: 'Provident Fund Commissioner, Bandra Office',
    stateOrCity: 'Mumbai',
    matchConfidence: 91,
    disclosureSource: 'EPFO Inoperative Accounts Database Portal',
    refNumber: 'EPF-MH-BND-924',
    financialYear: '2018-19',
    lastTransmissionDate: '2019-03-31',
    status: 'Unclaimed',
    matchReasons: [
      'Similar legal name with spelling variation',
      'EPFO regional ledger office match (Bandra, Mumbai)',
      'Provident fund dividend record overlap'
    ]
  },
  {
    id: 'ASSET-104',
    category: 'Insurance',
    companyName: 'Life Insurance Corporation of India (LIC)',
    holderName: 'Vijay Malhotra',
    fatherHusbandName: 'S. K. Malhotra',
    amount: 320000,
    folioNumberOrId: 'LIC-POL-948201481',
    claimAuthority: 'LIC of India, Connaught Place Branch-I',
    stateOrCity: 'New Delhi',
    matchConfidence: 94,
    disclosureSource: 'LIC Public Scroll of Unclaimed Senior Citizen Funds',
    refNumber: 'LIC-UNCL-94801',
    financialYear: '2022-23',
    lastTransmissionDate: '2023-05-12',
    status: 'Unclaimed',
    matchReasons: [
      'Identical match for Vijay Malhotra',
      'Regional Connaught Place branch code alignment',
      'Senior citizen fund pool ledger continuity'
    ]
  },
  {
    id: 'ASSET-105',
    category: 'Bonds',
    companyName: 'National Highways Authority of India (NHAI) Tax-Free Bonds',
    holderName: 'Sunita Mehra',
    fatherHusbandName: 'Anil Mehra',
    amount: 50000,
    folioNumberOrId: 'NHAI-BND-0029348',
    claimAuthority: 'IEPF Authority',
    stateOrCity: 'Chandigarh',
    matchConfidence: 89,
    disclosureSource: 'NHAI Unclaimed Bondholder Register',
    refNumber: 'IEPF-NHAI-0029A',
    financialYear: '2017-18',
    lastTransmissionDate: '2018-10-05',
    status: 'Unclaimed',
    matchReasons: [
      'Historical address in Chandigarh verified',
      'Matching nominee surname records',
      'Bond interest maturity rollover gap'
    ]
  },
  {
    id: 'ASSET-106',
    category: 'Shares',
    companyName: 'Tata Motors Limited',
    holderName: 'Arvind Swamy',
    fatherHusbandName: 'K. Swamy',
    amount: 112000,
    folioNumberOrId: 'TML-04918234',
    claimAuthority: 'IEPF Authority (Ministry of Corporate Affairs)',
    stateOrCity: 'Chennai',
    matchConfidence: 97,
    disclosureSource: 'IEPF MCA Form 5 Web Disclosure - FY 2023-24',
    refNumber: 'IEPF2023-TML-8419Z',
    financialYear: '2023-24',
    lastTransmissionDate: '2024-02-28',
    status: 'Unclaimed',
    matchReasons: [
      'Similar legal name spelling variation',
      'Historical Chennai address database correlation',
      'Dividend ledger matching timeline'
    ]
  },
  {
    id: 'ASSET-M101',
    category: 'Shares',
    companyName: 'Tata Consultancy Services Limited (TCS - BSE 500)',
    holderName: 'Manoj Kumar',
    fatherHusbandName: 'Late Sundararajan Kumar',
    amount: 284000,
    folioNumberOrId: 'TCS-00384129',
    claimAuthority: 'IEPF Authority (Ministry of Corporate Affairs)',
    stateOrCity: 'Chennai',
    matchConfidence: 98,
    disclosureSource: 'TCS Unclaimed Share Transfer Registry (BSE 500 List)',
    refNumber: 'IEPF2022-TCS-M94B',
    financialYear: '2022-23',
    lastTransmissionDate: '2023-08-14',
    status: 'Unclaimed',
    matchReasons: [
      'Identical primary name alignment ("Manoj Kumar") against active indexes',
      'Historical residential address verified in Chennai, Tamil Nadu (Adyar region)',
      'Dividend ledger claim record gap for FY 2022-23'
    ]
  },
  {
    id: 'ASSET-M102',
    category: 'Shares',
    companyName: 'ITC Limited (ITC - BSE 500)',
    holderName: 'Manoj K.',
    fatherHusbandName: 'Arun Krishnan',
    amount: 143500,
    folioNumberOrId: 'ITC-01948214',
    claimAuthority: 'IEPF Authority (Ministry of Corporate Affairs)',
    stateOrCity: 'Chennai',
    matchConfidence: 92,
    disclosureSource: 'ITC Investor Relations Unclaimed Dividend Roll (BSE 500 List)',
    refNumber: 'IEPF2023-ITC-K90A',
    financialYear: '2023-24',
    lastTransmissionDate: '2024-01-20',
    status: 'Unclaimed',
    matchReasons: [
      'High phonetic spelling similarity ("Manoj K.") under Fuzzy Phonetic alignment',
      'Regional matching pin-code correlation in T-Nagar, Chennai',
      'Multi-year unpaid dividend sequence overlap in corporate files'
    ]
  },
  {
    id: 'ASSET-M103',
    category: 'Mutual Funds',
    companyName: 'HDFC Bank Limited (HDFC - BSE 500)',
    holderName: 'Manoj S.',
    fatherHusbandName: 'Srinivasan Parthasarathy',
    amount: 95000,
    folioNumberOrId: 'HDFC-MF-8492041',
    claimAuthority: 'AMFI Under Guidance of SEBI',
    stateOrCity: 'Chennai',
    matchConfidence: 89,
    disclosureSource: 'HDFC Mutual Fund Inoperative Folder Archives (BSE 500 List)',
    refNumber: 'AMFI-HDFC-M72B',
    financialYear: '2021-22',
    lastTransmissionDate: '2022-11-05',
    status: 'Unclaimed',
    matchReasons: [
      'Partial surname nominee validation match on heir records',
      'Associated registrar mobile suffix confirmation validation',
      'Last transmission date overlap in Adyar district, Chennai'
    ]
  },
  {
    id: 'ASSET-107',
    category: 'Mutual Funds',
    companyName: 'SBI Bluechip Fund (Direct Growth)',
    holderName: 'Pooja Hegde',
    fatherHusbandName: 'Prasad Hegde',
    amount: 175000,
    folioNumberOrId: 'SBI-MF-0941829',
    claimAuthority: 'AMFI Under Guidance of SEBI',
    stateOrCity: 'Bangalore',
    matchConfidence: 95,
    disclosureSource: 'SBI Mutual Fund Inoperative Folio disclosure',
    refNumber: 'SBI-MFO-914820',
    financialYear: '2022-23',
    lastTransmissionDate: '2023-09-12',
    status: 'Unclaimed',
    matchReasons: [
      'Identical name matching regional Bangalore portfolio list',
      'Redemption record overlap',
      'Associated registrar mobile suffix validation'
    ]
  },
  {
    id: 'ASSET-108',
    category: 'Shares',
    companyName: 'Infosys Limited',
    holderName: 'Nandan Nilekani',
    fatherHusbandName: 'Late S. Nilekani',
    amount: 940000,
    folioNumberOrId: 'INFY-00918482',
    claimAuthority: 'IEPF Authority',
    stateOrCity: 'Bangalore',
    matchConfidence: 75,
    disclosureSource: 'Infosys Investor Relations Report Table 4',
    refNumber: 'IEPF-INFY-0091X',
    financialYear: '2019-20',
    lastTransmissionDate: '2020-04-10',
    status: 'Claimed',
    matchReasons: [
      'Identical match on senior stakeholder records',
      'Historical Bangalore address match and verification'
    ]
  }
];

// Helper to perform a smart fuzzy search or generate dynamic matching mock-records when searched name is outside database
export function findAssetsForQuery(fullName: string, city: string, companyCode?: string, state?: string): UnclaimedAsset[] {
  return getDeterministicUnclaimedAssets(fullName, state || 'Delhi', city);
}

// Security & Audit Log Mock Data Stream
export const generatePipelineLogs = (fullName: string): PipelineLog[] => [
  { timestamp: '18:05:40', message: 'Initialized search query.', step: 'queued', status: 'success' },
  { timestamp: '18:05:42', message: 'Accessing official registry catalogs (MCA, EPFO, and AMFI).', step: 'pdf_indexing', status: 'info' },
  { timestamp: '18:05:45', message: `Structuring search parameters for "${fullName}".`, step: 'pdf_indexing', status: 'processing' },
  { timestamp: '18:05:48', message: 'Scanning public disclosure archives.', step: 'ocr_scanning', status: 'processing' },
  { timestamp: '18:05:51', message: 'Registry search completed successfully.', step: 'ocr_scanning', status: 'success' },
  { timestamp: '18:05:54', message: 'Comparing alternate name spelling variations.', step: 'fuzzy_matching', status: 'processing' },
  { timestamp: '18:05:58', message: 'Cross-referencing regional asset databases.', step: 'cross_referencing', status: 'success' },
  { timestamp: '18:06:01', message: 'Compiling recovery guidelines and filing instructions.', step: 'report_assembly', status: 'success' },
  { timestamp: '18:06:05', message: 'Search finalized. Verification records compiled.', step: 'completed', status: 'success' }
];

export const MOCK_HISTORY: SearchQuery[] = [];

export const FAQS: FAQItem[] = [
  {
    category: 'Security & Access',
    question: 'How does SEEKTRIX securely search my details without exposing my personal data?',
    answer: 'We utilize advanced federated query templates and anonymized search hashes. Standard corporate records and PDF documents are ingested locally in our pipeline, so your search query (Name/City) is processed on our isolated backend and compared against static parsed repositories without exposing any of your financial data to the public internet.'
  },
  {
    category: 'Process & Timeline',
    question: 'Why is this an asynchronous search rather than a real-time table lookup?',
    answer: 'Unlike retail banking accounts, unclaimed financial asset registries in India (such as those held by EPFO, IEPF, and AMFI) are scattered across thousands of legacy corporate schedules, public disclosure lists, and regional reports. Systematic search and matching require standardizing unstructured data and performing comprehensive query alignment, which typically requires 1 to 2 minutes of server-side computation.'
  },
  {
    category: 'Claims assistance',
    question: 'Can SEEKTRIX assist me in filing my legal claims to recover the unclaimed assets?',
    answer: 'Yes. Once we find a positive lookup match, our reports provide the specific Folio/ID, Claim Authority (e.g. IEPF Authority), and source file reference. We provide an step-by-step institutional guide on filing Form IEPF-5, EPFO transfer claims, or insurance redemptions, ensuring you can reclaim what is rightfully yours without high consultancy fees.'
  },
  {
    category: 'Accuracy & Verification',
    question: 'How do you handle spelling mismatches or historical address changes?',
    answer: 'We resolve matches by checking standard spelling variations, historical address records, and associated regional registries. This guarantees that even if an old certificate lists an outdated address or minor spelling variation, we correlate records systematically to establish match probability with clear source documentation.'
  }
];

export const INTEGRATION_CREDENTIALS: SecurityCredential[] = [
  { id: 'CRED-1', name: 'IEPF Ingestion Gateway', value: 'sk_live_mca_948a...12a', lastUpdated: '2026-05-20', type: 'API Key', status: 'active' },
  { id: 'CRED-2', name: 'EPFO Inoperative Database Link', value: 'epfo_node_secure_948...df2', lastUpdated: '2026-05-24', type: 'PDF Registry', status: 'active' },
  { id: 'CRED-3', name: 'Character Recognition Service Token', value: 'sk_ocr_v4_deepmind_823...1a', lastUpdated: '2026-05-26', type: 'OCR Service', status: 'active' },
  { id: 'CRED-4', name: 'AMFI Mutual Fund Registry Tunnel', value: 'amfi_secure_db_tunnel_94...1b', lastUpdated: '2026-05-18', type: 'API Key', status: 'active' }
];
