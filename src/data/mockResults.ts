import { UnclaimedAsset, AssetCategory } from '../types';

export interface LedgerRecord {
  companyName: string;
  bseCode: string;
  holderName: string;
  folioNumber: string;
  unclaimedAmount: number;
  municipalRegion: string;
  disclosureSource: string;
  fatherName: string;
}

// ── REGIONAL SCHEMAS FOR DETERMINISTIC MATCHING ────────────────────────────────
export interface RegionalCompany {
  name: string;
  bseCode: string;
  category: AssetCategory;
  authority: string;
  docSource: string;
}

export interface StateSchema {
  stateName: string;
  regionalCompanies: RegionalCompany[];
  matchReasonsTemplate: string[];
}

const STATE_MOCK_SCHEMAS: Record<string, StateSchema> = {
  'MAHARASHTRA': {
    stateName: 'Maharashtra',
    regionalCompanies: [
      {
        name: 'Reliance Industries Limited',
        bseCode: '500325',
        category: 'Shares',
        authority: 'IEPF Authority (Ministry of Corporate Affairs), Mumbai Nodal Branch',
        docSource: 'RIL Unclaimed Share Dividends Register - West Zone'
      },
      {
        name: 'HDFC Bank Limited',
        bseCode: '500180',
        category: 'Shares',
        authority: 'IEPF Nodal Division (HDFC Bank Ltd, Mumbai)',
        docSource: 'HDFC Bank Dormant Account & Outstanding Dividend List'
      },
      {
        name: 'Tata Motors Limited',
        bseCode: '500570',
        category: 'Shares',
        authority: 'IEPF Authority, Mumbai Division',
        docSource: 'Tata Motors Investor Education & Protection Ledger'
      },
      {
        name: 'Bandra Provident Fund Trust',
        bseCode: 'EPFO-MH',
        category: 'EPF / PPF',
        authority: 'Provident Fund Commissioner, Bandra Office (Mumbai)',
        docSource: 'EPFO Inoperative Accounts Database'
      }
    ],
    matchReasonsTemplate: [
      'Verified physical record overlap in Bandra registry archives.',
      'Active residential address history matched in municipal region.',
      'Dormant security dividend transfer aligned with Western division.'
    ]
  },
  'TAMIL NADU': {
    stateName: 'Tamil Nadu',
    regionalCompanies: [
      {
        name: 'MRF Limited',
        bseCode: '500290',
        category: 'Shares',
        authority: 'IEPF Authority, Southern Region Branch (Chennai)',
        docSource: 'MRF Shareholder Ledger of Outstanding Dividend Records'
      },
      {
        name: 'Titan Company Limited',
        bseCode: '500114',
        category: 'Shares',
        authority: 'IEPF Authority, Chennai Nodal Branch',
        docSource: 'Titan Unclaimed Securities Catalog - FY 25'
      },
      {
        name: 'TVS Motor Company Limited',
        bseCode: '532343',
        category: 'Shares',
        authority: 'IEPF Authority, Southern Region Node',
        docSource: 'TVS Motor Investor Relations Unclaimed Dividend Roll'
      }
    ],
    matchReasonsTemplate: [
      'Direct phonetic match under Fuzzy Levenshtein mapping (Southern Registry).',
      'Historical residential record verified with Chennai Nodal Office filings.',
      'Unsettled dividend ledger claim gap recorded for physical certificates.'
    ]
  },
  'KARNATAKA': {
    stateName: 'Karnataka',
    regionalCompanies: [
      {
        name: 'Infosys Limited',
        bseCode: '500209',
        category: 'Shares',
        authority: 'IEPF Nodal Officer (Infosys Ltd, Bengaluru)',
        docSource: 'Infosys Dormant Securities Register - South Zone'
      },
      {
        name: 'Wipro Limited',
        bseCode: '507685',
        category: 'Shares',
        authority: 'IEPF Authority, Bengaluru Division',
        docSource: 'Wipro Inoperative Investment Folder Archives'
      },
      {
        name: 'Canara Bank',
        bseCode: '532483',
        category: 'Shares',
        authority: 'IEPF Authority (Ministry of Corporate Affairs)',
        docSource: 'Canara Bank Unclaimed Securities Ledger'
      },
      {
        name: 'EPFO Bengaluru Central Office',
        bseCode: 'EPFO-KA',
        category: 'EPF / PPF',
        authority: 'EPFO Regional Office, Bengaluru Central',
        docSource: 'EPFO Southern Region Unclaimed Ledger'
      }
    ],
    matchReasonsTemplate: [
      'Active regional corporate registry folder match in Bengaluru.',
      'Associated registrar mobile suffix validation match.',
      'EPFO Southern Region database archive validation.'
    ]
  },
  'DELHI': {
    stateName: 'Delhi',
    regionalCompanies: [
      {
        name: 'Maruti Suzuki India Limited',
        bseCode: '532500',
        category: 'Shares',
        authority: 'IEPF Authority, Connaught Place Branch (New Delhi)',
        docSource: 'Maruti Suzuki Unclaimed Share Ledger'
      },
      {
        name: 'NTPC Limited',
        bseCode: '532555',
        category: 'Shares',
        authority: 'IEPF Authority (Ministry of Corporate Affairs), New Delhi',
        docSource: 'NTPC Investor Education and Protection Fund Ledger'
      },
      {
        name: 'Punjab National Bank',
        bseCode: '532461',
        category: 'Shares',
        authority: 'IEPF Authority (Ministry of Corporate Affairs), Delhi Node',
        docSource: 'PNB Dormant Dividends & Unclaimed Securities Record'
      },
      {
        name: 'Life Insurance Corporation of India (LIC)',
        bseCode: 'LIC-DL',
        category: 'Insurance',
        authority: 'LIC of India, Connaught Place Branch-I',
        docSource: 'LIC Public Scroll of Unclaimed Senior Citizen Funds'
      }
    ],
    matchReasonsTemplate: [
      'Regional Connaught Place branch code alignment.',
      'Similar legal name with high spelling similarity in Delhi region filings.',
      'Senior citizen fund pool ledger continuity.'
    ]
  },
  'WEST BENGAL': {
    stateName: 'West Bengal',
    regionalCompanies: [
      {
        name: 'ITC Limited',
        bseCode: '500875',
        category: 'Shares',
        authority: 'IEPF Authority, Eastern Region Branch (Kolkata)',
        docSource: 'ITC Shareholder Registry of Unclaimed Dividend Records'
      },
      {
        name: 'Coal India Limited',
        bseCode: '533278',
        category: 'Shares',
        authority: 'IEPF Authority, Eastern Region Division',
        docSource: 'Coal India Outstanding Security Holdings Ledger'
      },
      {
        name: 'UCO Bank',
        bseCode: '532505',
        category: 'Shares',
        authority: 'IEPF Authority (Ministry of Corporate Affairs), Kolkata',
        docSource: 'UCO Bank Dormant Securities Catalogue'
      }
    ],
    matchReasonsTemplate: [
      'Phonetic matching of legal name within Eastern Region Branch schedules.',
      'Kolkata residency registration historical validation.',
      'Filing reference match in corporate disclosure catalogs.'
    ]
  },
  'GUJARAT': {
    stateName: 'Gujarat',
    regionalCompanies: [
      {
        name: 'Adani Ports and Special Economic Zone Limited',
        bseCode: '532921',
        category: 'Shares',
        authority: 'IEPF Authority, Western Zone Division (Ahmedabad)',
        docSource: 'Adani Ports Unclaimed Shareholder Division Index'
      },
      {
        name: 'Torrent Power Limited',
        bseCode: '532779',
        category: 'Shares',
        authority: 'IEPF Nodal Division (Ahmedabad Node)',
        docSource: 'Torrent Power Unclaimed Dividend Folio Ledger'
      },
      {
        name: 'Gujarat Fluorochemicals Limited',
        bseCode: '542857',
        category: 'Shares',
        authority: 'IEPF Authority, Western Zone Node',
        docSource: 'GFL Unclaimed Equity Shares Registry'
      }
    ],
    matchReasonsTemplate: [
      'High-confidence Levenshtein string match with Gujarat Division indices.',
      'Historical regional address verification in municipal tax registers.',
      'Unclaimed dividend record correspondence with Western Zone filings.'
    ]
  },
  'TELANGANA': {
    stateName: 'Telangana',
    regionalCompanies: [
      {
        name: "Dr. Reddy's Laboratories Limited",
        bseCode: '500124',
        category: 'Shares',
        authority: 'IEPF Authority, Southern Division (Hyderabad)',
        docSource: "Dr. Reddy's Unclaimed Dividend Ledger - FY 25"
      },
      {
        name: 'Aurobindo Pharma Limited',
        bseCode: '524804',
        category: 'Shares',
        authority: 'IEPF Nodal Division (Hyderabad)',
        docSource: 'Aurobindo Pharma Unclaimed Dividends Record'
      },
      {
        name: 'EPFO Hyderabad Regional Office',
        bseCode: 'EPFO-TG',
        category: 'EPF / PPF',
        authority: 'EPFO Regional Office, Hyderabad',
        docSource: 'EPFO Telangana Inoperative Accounts Portal'
      }
    ],
    matchReasonsTemplate: [
      'Phonetic and structural matching in Hyderabad regional filings.',
      'Regional EPF registry database correspondence.',
      'Filing reference matching on outstanding physical share schedules.'
    ]
  }
};

const DEFAULT_STATE_SCHEMA: StateSchema = {
  stateName: 'Delhi',
  regionalCompanies: [
    {
      name: 'State Bank of India',
      bseCode: '500112',
      category: 'Shares',
      authority: 'IEPF Authority (Ministry of Corporate Affairs), New Delhi',
      docSource: 'SBI Unclaimed Share & Dividend Public Scroll'
    },
    {
      name: 'Hindustan Unilever Limited',
      bseCode: '500696',
      category: 'Shares',
      authority: 'IEPF Nodal Office, Central Division',
      docSource: 'HUL Unclaimed Securities Record'
    },
    {
      name: 'Larsen & Toubro Limited',
      bseCode: '500510',
      category: 'Shares',
      authority: 'IEPF Authority (Ministry of Corporate Affairs)',
      docSource: 'L&T Outstanding Unclaimed Equity Register'
    },
    {
      name: 'National Highways Authority of India (NHAI)',
      bseCode: 'NHAI-BND',
      category: 'Bonds',
      authority: 'NHAI Bond Registry, Central Division',
      docSource: 'NHAI Tax-Free Bonds Inoperative Ledger'
    }
  ],
  matchReasonsTemplate: [
    'Direct primary name match in national unclaimed scroll database.',
    'Associated regional administrative address verification.',
    'Dormant certificate record corresponding with Central IEPF registry.'
  ]
};

// ── DETERMINISTIC FATHER/SPOUSE NAME GENERATOR ─────────────────────────────────
export function generateFatherName(holderName: string): string {
  const parts = (holderName || '').trim().split(' ');
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  
  const firstNames = [
    'Ramesh', 'Suresh', 'Late Mohan', 'Rajendra', 'Devendra', 
    'Gopal', 'Anil', 'Sanjay', 'Late Ramakrishnan', 'Balasubramanian',
    'Srinivasan', 'K. Swamy', 'Late Sundararajan', 'Harish Chandra', 'Vijay'
  ];
  
  const hash = (holderName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 7;
  const firstName = firstNames[hash % firstNames.length];
  
  if (lastName) {
    return `${firstName} ${lastName}`;
  } else {
    return `${firstName} Kumar`;
  }
}

// ── CORE DETERMINISTIC MATCHING ENGINE ──────────────────────────────────────────
export function getDeterministicUnclaimedAssets(
  fullName: string,
  state: string,
  city: string
): UnclaimedAsset[] {
  const normalizedState = (state || 'Delhi').trim().toUpperCase();
  const normalizedCity = (city || 'New Delhi').trim();
  
  const schema = STATE_MOCK_SCHEMAS[normalizedState] || DEFAULT_STATE_SCHEMA;
  const capitalizedState = schema.stateName;
  
  // Nice formatting for city
  const capitalizedCity = normalizedCity
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Delhi';
    
  const capitalizedName = (fullName || 'Manoj Kumar')
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'Manoj Kumar';

  // Hashing values for determinism
  const nameHash = capitalizedName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 7;
  const cityHash = capitalizedCity.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 13;
  const hashVal = nameHash + cityHash;

  const fatherName = generateFatherName(capitalizedName);
  const municipalRegion = `${capitalizedCity}, ${capitalizedState}`;

  // We return a list of 3-4 consistent records for this region
  return schema.regionalCompanies.map((comp, idx) => {
    const amount = Math.floor(18000 + ((hashVal + idx * 37) % 15) * 12500);
    const id = `ASSET-${comp.bseCode}-${100 + (hashVal + idx * 7) % 899}`;
    const matchConfidence = 88 + (hashVal + idx) % 11;
    const folioNumberOrId = comp.category === 'EPF / PPF'
      ? `KA-BAN-00${40000 + (hashVal * (idx + 1)) % 49999}-000-0194`
      : `${comp.bseCode}-FL-${10000 + (hashVal * (idx + 1)) % 89999}`;
      
    const refNumber = `REF-${comp.bseCode}-${20000 + (hashVal * (idx + 2)) % 79999}`;
    const financialYear = idx % 2 === 0 ? '2023-24' : '2022-23';
    const lastTransmissionDate = idx % 2 === 0 ? '2024-04-12' : '2023-09-18';
    
    // Select deterministic reasons from template
    const matchReasons = [
      `Identical primary name alignment ("${capitalizedName}") in regional listings.`,
      schema.matchReasonsTemplate[idx % schema.matchReasonsTemplate.length],
      `Unclaimed outstanding dividend payout verified under ${comp.name} records.`
    ];

    return {
      id,
      category: comp.category,
      companyName: comp.name,
      holderName: capitalizedName,
      fatherHusbandName: fatherName,
      amount,
      folioNumberOrId,
      claimAuthority: comp.authority,
      stateOrCity: municipalRegion,
      matchConfidence,
      disclosureSource: comp.docSource,
      refNumber,
      financialYear,
      lastTransmissionDate,
      status: 'Unclaimed',
      matchReasons
    };
  });
}

// Helper to convert to the server's LedgerRecord representation
export function getDeterministicLedgerRecords(
  fullName: string,
  state: string,
  city: string
): LedgerRecord[] {
  const assets = getDeterministicUnclaimedAssets(fullName, state, city);
  return assets.map(asset => ({
    companyName: asset.companyName,
    bseCode: asset.id.split('-')[1] || 'N/A',
    holderName: asset.holderName,
    folioNumber: asset.folioNumberOrId,
    unclaimedAmount: asset.amount,
    municipalRegion: asset.stateOrCity,
    disclosureSource: asset.disclosureSource,
    fatherName: asset.fatherHusbandName || generateFatherName(asset.holderName)
  }));
}
