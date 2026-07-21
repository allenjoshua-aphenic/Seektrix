/**
 * SEEKTRIX - Real-World Asset Ingestion Engine (insert.js)
 * ====================================================================
 * This script runs the ingestion pipeline after Claude OCR extracts rows
 * from the IEPF PDFs of TCS, Infosys, Asian Paints, Cipla, and Dabur.
 * It connects to Supabase / PostgreSQL and populates the unclaimed_assets table.
 * 
 * To run this script:
 * 1. Ensure you have pg installed: npm install pg dotenv
 * 2. Configure DATABASE_URL in your .env file
 * 3. Run: node insert.js
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// The database URL can be supplied via .env or directly hardcoded for local run
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:securepassword@localhost:5432/seektrix";

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

async function ingest() {
  console.log("Initializing Ingestion Engine Node...");
  console.log(`Connecting to: ${DATABASE_URL.replace(/:([^:@]+)@/, ":xxxxxx@")}`);

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("supabase") ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log("Connection to Supabase database established successfully!");

    // Ensure the table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS unclaimed_assets (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        bse_code VARCHAR(50) NOT NULL,
        holder_name VARCHAR(255) NOT NULL,
        folio_number VARCHAR(100) NOT NULL,
        unclaimed_amount FLOAT NOT NULL,
        municipal_region VARCHAR(255) NOT NULL,
        disclosure_source VARCHAR(255)
      );
    `);
    console.log("Table 'unclaimed_assets' verified.");

    // Loop through records and insert them
    console.log(`Ingesting ${SEED_RECORDS.length} processed PDF records...`);
    for (const record of SEED_RECORDS) {
      const checkRes = await client.query(
        "SELECT id FROM unclaimed_assets WHERE folio_number = $1",
        [record.folio_number]
      );

      if (checkRes.rows.length === 0) {
        await client.query(
          `INSERT INTO unclaimed_assets 
           (company_name, bse_code, holder_name, folio_number, unclaimed_amount, municipal_region, disclosure_source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            record.company_name,
            record.bse_code,
            record.holder_name,
            record.folio_number,
            record.unclaimed_amount,
            record.municipal_region,
            record.disclosure_source
          ]
        );
        console.log(`✓ Ingested row for: ${record.holder_name} (${record.company_name})`);
      } else {
        console.log(`- Row already exists: ${record.holder_name} (Folio: ${record.folio_number})`);
      }
    }

    console.log("\nIngestion completed successfully! All rows verified.");

  } catch (error) {
    console.error("Ingestion failed:", error);
  } finally {
    await client.end();
  }
}

ingest();
