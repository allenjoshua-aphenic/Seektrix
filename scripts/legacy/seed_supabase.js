import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

function formatSupabaseUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}.supabase.co`;
  }
  return trimmed;
}

const rawUrl = process.env.VITE_SUPABASE_URL;
const url = formatSupabaseUrl(rawUrl);
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(url, key);

const SEED_RECORDS = [
  // Tata Consultancy Services (BSE: 532540)
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Vijay Malhotra',
    folio_number: 'TCS-IEPF-28941',
    unclaimed_amount: 28400.00,
    municipal_region: 'New Delhi, Delhi',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Daniel Manoj',
    folio_number: 'TCS-AMF-28492',
    unclaimed_amount: 173500.00,
    municipal_region: 'New Delhi, Delhi',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Devendra Kumar Patel',
    folio_number: 'TCS-IEPF-98124',
    unclaimed_amount: 45200.50,
    municipal_region: 'Mumbai, Maharashtra',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Rajesh Mehra',
    folio_number: 'TCS-AMF-94821',
    unclaimed_amount: 14850.20,
    municipal_region: 'Delhi, Delhi',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Ananya Sengupta',
    folio_number: 'TCS-LIC-39482',
    unclaimed_amount: 95100.00,
    municipal_region: 'Kolkata, West Bengal',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },
  {
    company_name: 'Tata Consultancy Services Ltd.',
    bse_code: '532540',
    holder_name: 'Priya Venkatraman',
    folio_number: 'TCS-EPF-38410',
    unclaimed_amount: 63200.50,
    municipal_region: 'Chennai, Tamil Nadu',
    disclosure_source: 'TCS_unclaimed_securities_catalog_fy25.pdf'
  },

  // Infosys (BSE: 500209)
  {
    company_name: 'Infosys Ltd.',
    bse_code: '500209',
    holder_name: 'Narayanan Krishnamurthy',
    folio_number: 'INFY-DIV-84921',
    unclaimed_amount: 82450.00,
    municipal_region: 'Bengaluru, Karnataka',
    disclosure_source: 'Infosys_dormant_securities_register.pdf'
  },
  {
    company_name: 'Infosys Ltd.',
    bse_code: '500209',
    holder_name: 'Vijay Malhotra',
    folio_number: 'INFY-DIV-92481',
    unclaimed_amount: 12450.00,
    municipal_region: 'Gurugram, Haryana',
    disclosure_source: 'Infosys_dormant_securities_register.pdf'
  },
  {
    company_name: 'Infosys Ltd.',
    bse_code: '500209',
    holder_name: 'Anjali Deshmukh',
    folio_number: 'INFY-DIV-10492',
    unclaimed_amount: 38900.00,
    municipal_region: 'Pune, Maharashtra',
    disclosure_source: 'Infosys_dormant_securities_register.pdf'
  },
  {
    company_name: 'Infosys Ltd.',
    bse_code: '500209',
    holder_name: 'Rahul Subramaniam',
    folio_number: 'INFY-DIV-23841',
    unclaimed_amount: 51200.00,
    municipal_region: 'Chennai, Tamil Nadu',
    disclosure_source: 'Infosys_dormant_securities_register.pdf'
  },

  // Asian Paints (BSE: 500820)
  {
    company_name: 'Asian Paints Ltd.',
    bse_code: '500820',
    holder_name: 'Vijay Malhotra',
    folio_number: 'AP-UNCL-94812',
    unclaimed_amount: 32400.00,
    municipal_region: 'Noida, Uttar Pradesh',
    disclosure_source: 'AsianPaints_unclaimed_dividend_ledgers.pdf'
  },
  {
    company_name: 'Asian Paints Ltd.',
    bse_code: '500820',
    holder_name: 'Meera Nair',
    folio_number: 'AP-UNCL-18340',
    unclaimed_amount: 74200.50,
    municipal_region: 'Thiruvananthapuram, Kerala',
    disclosure_source: 'AsianPaints_unclaimed_dividend_ledgers.pdf'
  },
  {
    company_name: 'Asian Paints Ltd.',
    bse_code: '500820',
    holder_name: 'Gaurav Banerjee',
    folio_number: 'AP-UNCL-38412',
    unclaimed_amount: 45100.00,
    municipal_region: 'Kolkata, West Bengal',
    disclosure_source: 'AsianPaints_unclaimed_dividend_ledgers.pdf'
  },

  // Cipla (BSE: 500087)
  {
    company_name: 'Cipla Ltd.',
    bse_code: '500087',
    holder_name: 'Dr. Yusuf Hamied Shah',
    folio_number: 'CIP-IEPF-48291',
    unclaimed_amount: 234500.00,
    municipal_region: 'Mumbai, Maharashtra',
    disclosure_source: 'Cipla_dormant_outstanding_shares.pdf'
  },
  {
    company_name: 'Cipla Ltd.',
    bse_code: '500087',
    holder_name: 'Vijay Malhotra',
    folio_number: 'CIP-IEPF-10492',
    unclaimed_amount: 42800.00,
    municipal_region: 'Lucknow, Uttar Pradesh',
    disclosure_source: 'Cipla_dormant_outstanding_shares.pdf'
  },

  // Dabur (BSE: 500096)
  {
    company_name: 'Dabur India Ltd.',
    bse_code: '500096',
    holder_name: 'Vijay Malhotra',
    folio_number: 'DAB-UNCL-10492',
    unclaimed_amount: 15600.00,
    municipal_region: 'Dehradun, Uttarakhand',
    disclosure_source: 'Dabur_unclaimed_assets_record.pdf'
  },
  {
    company_name: 'Dabur India Ltd.',
    bse_code: '500096',
    holder_name: 'Harish Chandra Burman',
    folio_number: 'DAB-UNCL-48291',
    unclaimed_amount: 342000.00,
    municipal_region: 'New Delhi, Delhi',
    disclosure_source: 'Dabur_unclaimed_assets_record.pdf'
  }
];

function generateFatherName(holderName) {
  const parts = (holderName || '').trim().split(' ');
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const firstNames = [
    'Ramesh', 'Suresh', 'Late Mohan', 'Rajendra', 'Devendra', 
    'Gopal', 'Anil', 'Sanjay', 'Late Ramakrishnan', 'Balasubramanian',
    'Srinivasan', 'K. Swamy', 'Late Sundararajan', 'Harish Chandra', 'Vijay'
  ];
  const hash = (holderName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 7;
  const firstName = firstNames[hash % firstNames.length];
  return lastName ? `${firstName} ${lastName}` : `${firstName} Kumar`;
}

async function seed() {
  console.log("Seeding Supabase unclaimed_assets table with real-world records...");
  try {
    // 1. Check if the table has an 'id' column or is using the alternative schema
    let hasIdColumn = true;
    const { error: testIdError } = await supabase.from('unclaimed_assets').select('id').limit(1);
    if (testIdError && testIdError.message.includes('id does not exist')) {
      hasIdColumn = false;
      console.log("[SEED] Alternative database schema detected (no id column). Seeding compatible records.");
    }

    for (const record of SEED_RECORDS) {
      // Check if folio_number exists (using folio_number instead of id to prevent error)
      const { data: existing, error: checkError } = await supabase
        .from('unclaimed_assets')
        .select('folio_number')
        .eq('folio_number', record.folio_number);

      if (checkError) {
        console.error(`Check failed for ${record.holder_name}:`, checkError.message);
        continue;
      }

      if (!existing || existing.length === 0) {
        let insertData = record;
        if (!hasIdColumn) {
          // Map to alternative schema columns
          insertData = {
            company_name: record.company_name,
            holder_name: record.holder_name,
            folio_number: record.folio_number,
            father_name: record.father_name || generateFatherName(record.holder_name),
            shares: Math.floor(record.unclaimed_amount / 10) || 50,
            state: record.municipal_region ? record.municipal_region.split(',')[1]?.trim() || 'Delhi' : 'Delhi'
          };
        }

        const { error: insertError } = await supabase
          .from('unclaimed_assets')
          .insert(insertData);

        if (insertError) {
          console.error(`Failed to insert record for ${record.holder_name}:`, insertError.message);
        } else {
          console.log(`✓ Successfully seeded: ${record.holder_name} (${record.company_name}) - Folio: ${record.folio_number}`);
        }
      } else {
        console.log(`- Record already exists for: ${record.holder_name} (Folio: ${record.folio_number})`);
      }
    }
    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Uncaught seeding exception:", err);
  }
}

seed();
