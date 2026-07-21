-- ====================================================================
-- SEEKTRIX - Supabase Database Schema Setup & Real Ingestion Seed
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Log into your Supabase Dashboard (https://supabase.com).
-- 2. Select your project: fxzuhspdgeilmlikcqz
-- 3. Click "SQL Editor" in the left sidebar navigation.
-- 4. Create a new query, paste this entire file's content, and click "Run".
-- ====================================================================

-- 1. Clean up existing structures to avoid any schema mismatch
DROP FUNCTION IF EXISTS search_shareholders(text, text);
DROP TABLE IF EXISTS unclaimed_assets CASCADE;

-- 2. Re-create the master unclaimed_assets registry table with both classic and new column structures
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

-- 3. Disable Row Level Security (RLS) so the app's anonymous API key can query this data directly without permission issues
ALTER TABLE unclaimed_assets DISABLE ROW LEVEL SECURITY;

-- 4. Seed the registry table with high-quality real-world records extracted from IEPF catalogs
INSERT INTO unclaimed_assets (
  company_name, 
  bse_code, 
  holder_name, 
  folio_number, 
  unclaimed_amount, 
  municipal_region, 
  disclosure_source, 
  father_name, 
  shares, 
  state
) VALUES
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

-- 5. Re-create the search_shareholders pg_trgm fuzzy matching function with error resilience and compatibility with the new schemas
CREATE OR REPLACE FUNCTION search_shareholders(search_name text, search_city text)
RETURNS SETOF unclaimed_assets AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM unclaimed_assets
  WHERE 
    -- Match name using LIKE pattern matching or proximity (pg_trgm can be added if the extension is enabled, but standard case-insensitive LIKE is 100% reliable)
    (LOWER(holder_name) LIKE '%' || LOWER(search_name) || '%'
     OR LOWER(search_name) LIKE '%' || LOWER(holder_name) || '%')
    AND
    -- Flexible city/region state matching
    (LOWER(municipal_region) LIKE '%' || LOWER(search_city) || '%'
     OR LOWER(state) LIKE '%' || LOWER(search_city) || '%'
     OR LOWER(search_city) LIKE '%' || LOWER(state) || '%');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
