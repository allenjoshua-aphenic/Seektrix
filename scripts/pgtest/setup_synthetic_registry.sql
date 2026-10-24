\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DROP TABLE IF EXISTS unclaimed_holders; DROP TABLE IF EXISTS companies;
CREATE TABLE companies (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, company_name text NOT NULL UNIQUE);
CREATE TABLE unclaimed_holders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id),
  full_name text NOT NULL, father_or_husband_name text, folio_number text, dp_client_id text,
  state text, address text, shares integer, unclaimed_amount numeric(14,2), financial_year text);
INSERT INTO companies(company_name) SELECT 'Company ' || g FROM generate_series(1,100) g;
CREATE OR REPLACE FUNCTION pick(arr text[]) RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT arr[1 + floor(random()*array_length(arr,1))::int] $$;

WITH f AS (SELECT
 ARRAY['RAKESH','RAJESH','RAMESH','SURESH','MUKESH','DINESH','MAHESH','SUNIL','ANIL','VIJAY','AJAY','SANJAY','MANOJ','RAJ','RAM','SHYAM','MOHAN','SOHAN','ARUN','VARUN','KIRAN','LAKSHMI','LAXMI','SUNITA','ANITA','KAVITA','SAVITA','PRIYA','PRIYANKA','POOJA','NEHA','SNEHA','VENKATESAN','VENKATESH','SUBRAMANIAN','SRINIVASAN','KRISHNAN','RAGHAVAN','MURALI','MOHAMMED','MOHAMED','ABDUL','SALIM','IMRAN','GEETA','SEEMA','REKHA','USHA','ASHA','NISHA','DEEPAK','DIPAK','PRAKASH','PRADEEP','SANDEEP','AMIT','SUMIT','ROHIT','MOHIT','NITIN','SACHIN','ASHOK','VINOD','PRAMOD','GOPAL','HARI','SHIV','NARAYAN','SATISH','GIRISH','JAGDISH','HARISH','RAVI','KUMAR','SUNEEL','RAKES','MOHD']::text[] fn,
 ARRAY['KUMAR','KUMAR','KUMAR','KUMAR','CHANDRA','PRASAD','NATH','LAL','DEVI','BEN','BHAI','','','','','','','']::text[] mn,
 ARRAY['SHARMA','VERMA','GUPTA','AGARWAL','AGRAWAL','AGGARWAL','SINGH','YADAV','JAIN','MEHTA','SHAH','PATEL','DESAI','REDDY','NAIDU','RAO','IYER','IYENGAR','NAIR','MENON','PILLAI','MUKHERJEE','BANERJEE','CHATTERJEE','DAS','BOSE','GHOSH','SEN','ROY','DUTTA','KHAN','ALI','ANSARI','SHAIKH','SHEIKH','MISHRA','TIWARI','PANDEY','DUBEY','SRIVASTAVA','SAXENA','KAPOOR','MALHOTRA','KHANNA','CHOPRA','BHATIA','ARORA','SETHI','JOSHI','KULKARNI','DESHPANDE','PATIL','GAIKWAD','JADHAV','DAGA','JADON','MAHAJAN','THAKUR','CHAUHAN','RATHORE']::text[] sn,
 ARRAY['DELHI','MAHARASHTRA','TAMIL NADU','KARNATAKA','WEST BENGAL','UTTAR PRADESH','GUJARAT','RAJASTHAN','KERALA','TELANGANA','Delhi','Tamil Nadu','']::text[] stt)
INSERT INTO unclaimed_holders(company_id, full_name, state, address, shares, unclaimed_amount, financial_year)
SELECT 1 + (random()*99)::int,
  regexp_replace(
  CASE (random()*9)::int
    WHEN 0 THEN pick(fn) || ' ' || pick(sn)
    WHEN 1 THEN pick(fn) || ' ' || pick(mn) || ' ' || pick(sn)
    WHEN 2 THEN pick(fn) || ' ' || pick(mn) || ' ' || pick(sn) || ' .'
    WHEN 3 THEN pick(sn) || ' ' || pick(fn) || ' ' || pick(mn)
    WHEN 4 THEN pick(fn) || ' ' || left(pick(mn),1) || ' ' || pick(sn)
    WHEN 5 THEN 'SHRI ' || pick(fn) || ' ' || pick(mn) || ' ' || pick(sn)
    WHEN 6 THEN pick(fn) || ' KR ' || pick(sn)
    WHEN 7 THEN pick(fn) || ' ' || pick(sn) || ' S/O ' || pick(fn) || ' ' || pick(sn)
    ELSE pick(fn) || ' ' || pick(mn) || ' ' || pick(sn)
  END, '\s+', ' ', 'g'),
  pick(stt), 'H NO ' || (random()*999)::int || ' SOME STREET ' || pick(stt), 1 + (random()*500)::int, (random()*5000)::numeric(14,2), '2019-20'
FROM generate_series(1, 400000) g CROSS JOIN f;

-- planted targets
INSERT INTO unclaimed_holders(company_id, full_name, state, address, shares, unclaimed_amount, financial_year) VALUES
 (1,'RAKESH KUMAR GUPTA','Delhi','B-12 ROHINI DELHI',100,1500,'2019-20'),
 (2,'RAKESH KUMAR','DELHI','KAROL BAGH NEW DELHI',50,800,'2019-20'),
 (3,'RAKESH KR SHARMA','Uttar Pradesh','NOIDA SECTOR 15',20,300,'2019-20'),
 (4,'R K SHARMA','Delhi','DWARKA NEW DELHI',10,120,'2019-20'),
 (5,'MOHAMED ALI .','Kerala','KOZHIKODE',30,450,'2019-20'),
 (6,'LAKSHMI NARAYANAN','Tamil Nadu','T NAGAR CHENNAI',40,600,'2019-20'),
 (7,'LAXMI NARAYAN','Karnataka','JAYANAGAR BANGALORE',40,600,'2019-20'),
 (8,'VENKATESAN R','Tamil Nadu','MYLAPORE CHENNAI',15,200,'2019-20'),
 (9,'SHARMA RAKESH KUMAR','Rajasthan','JAIPUR',12,180,'2019-20'),
 (10,'THIRUVENGADAM S','Tamil Nadu','VELLORE',8,90,'2019-20'),
 (11,'RAKES KUMR GUPTA','Delhi','PITAMPURA DELHI',5,60,'2019-20'),
 (12,'SHRI RAKESH KUMAR GUPTA S/O RAM GUPTA','Delhi','SHALIMAR BAGH DELHI',9,99,'2019-20');

CREATE INDEX idx_holders_name_trgm ON unclaimed_holders USING gin (lower(full_name) gin_trgm_ops);
ANALYZE unclaimed_holders; ANALYZE companies;
SELECT count(*) AS rows, pg_size_pretty(pg_relation_size('unclaimed_holders')) AS table_size, pg_size_pretty(pg_relation_size('idx_holders_name_trgm')) AS gin_index_size FROM unclaimed_holders;
