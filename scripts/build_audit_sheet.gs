/**
 * SEEKTRIX — Company Audit Sheet builder (Google Apps Script)
 * ==========================================================
 * Builds the team audit spreadsheet for the IEPF data hunt.
 *
 * Columns: sr_no | company_name | bse_scrip_code | nse_symbol | industry |
 *          has_data | data_available_upto | record_count |
 *          ingested_to_supabase | notes
 *
 * NOT limited to 150 companies — dropdowns, colour coding, the filter and the
 * Dashboard formulas cover the WHOLE sheet, so you can keep adding rows at the
 * bottom (or insert rows anywhere) and everything keeps working automatically.
 *
 * HOW TO USE (once):
 *   1. https://sheets.new   (blank Google Sheet)
 *   2. Extensions -> Apps Script
 *   3. Delete the sample code, paste THIS ENTIRE FILE, Save (disk icon)
 *   4. Run -> buildAuditSheet
 *   5. First time only: Review permissions -> your account -> Advanced ->
 *      "Go to <project> (unsafe)" -> Allow.  (Normal for your own scripts;
 *      it only touches THIS spreadsheet.)
 *   6. Back on the sheet: two tabs appear — "Company Audit" and "Dashboard".
 *   7. Share (top right) with your teammates as Editors.
 *
 * ADDING COMPANIES LATER: just type in the next empty row. The dropdowns and
 * colours are already applied down the whole column, and the Dashboard counts
 * update by themselves. To add capacity beyond the sheet's current size, use
 * the "Add 500 more rows" item in the Seektrix menu (appears after you reload).
 *
 * WARNING: re-running buildAuditSheet() REBUILDS the list and wipes your team's
 * edits. Run it once on a fresh sheet, then never again.
 */

// ── COLUMNS ──────────────────────────────────────────────────────────────────
var HEADERS = ["sr_no", "company_name", "bse_scrip_code", "nse_symbol", "industry", "has_data", "data_available_upto", "record_count", "ingested_to_supabase", "notes"];

// ── SEED COMPANY DATA (from data/company_audit_150.csv) ──────────────────────
var COMPANIES = [
  ["1", "Reliance Industries Ltd", "500325", "RELIANCE", "Oil & Gas / Telecom / Retail", "No", "", "", "No", "[Widget only] Verified: 3 per-person lookup widgets only. No bulk file. BSE announcements scanned - no name lists. Source: https://www.ril.com/investors/shares/dividend-shares"],
  ["2", "Tata Consultancy Services Ltd", "532540", "TCS", "Information Technology", "Partial", "2019", "", "No", "[Bulk PDF] Download in a NORMAL BROWSER (tcs.com blocks scripts). Richer 1146-page historic lists on Wayback Machine. Source: https://www.tcs.com/content/dam/tcs/pdf/discover-tcs/investor-relations/Unclaimed-Dividend-Details-for-2017/unclaimed-dividend-details-august-13-2013-October-24-2019.pdf"],
  ["3", "HDFC Bank Ltd", "500180", "HDFCBANK", "Banking & Financial Services", "No", "", "", "No", "[Widget only] RTA Datamatics per-person portal. Erstwhile HDFC Ltd holders have separate lookup apps. Source: https://www.hdfcbank.com/personal/about-us/corporate-governance/shareholders-information-and-helpdesk/details-of-unclaimed-dividend"],
  ["4", "Infosys Ltd", "500209", "INFY", "Information Technology", "No", "", "", "No", "[Widget only] Folio/DP-ID lookup only. ~20 notice PDFs are newspaper ads without names. Source: https://www.infosys.com/investors/shareholder-services/unclaimed-dividend-shares.html"],
  ["5", "ICICI Bank Ltd", "532174", "ICICIBANK", "Banking & Financial Services", "Partial", "FY2018-19", "38", "No", "[Bulk PDF] NARROW: only erstwhile ICICI Securities holders. No folio/address/shares. Main base is widget-only. Source: https://www.icici.bank.in/content/dam/icicibank/managed-assets/docs/investor/list-of-erstwhile-shareholders.pdf"],
  ["6", "Larsen & Toubro Ltd", "500510", "LT", "Engineering & Infrastructure", "No", "", "", "No", "[Widget only] KFin widget (PAN + captcha). Newspaper notices only. Source: https://ris.kfintech.com/services/IEPF/IEPFInfo.aspx?q=SaWKckFMJxE%3d"],
  ["7", "ITC Ltd", "500875", "ITC", "FMCG / Diversified", "Not checked", "", "", "No", ""],
  ["8", "Hindustan Unilever Ltd", "500696", "HINDUNILVR", "FMCG", "Not checked", "", "", "No", ""],
  ["9", "Axis Bank Ltd", "532215", "AXISBANK", "Banking & Financial Services", "Not checked", "", "", "No", ""],
  ["10", "Kotak Mahindra Bank Ltd", "500247", "KOTAKBANK", "Banking & Financial Services", "Not checked", "", "", "No", ""],
  ["11", "State Bank of India", "500112", "SBIN", "Banking & Financial Services", "Not checked", "", "", "No", ""],
  ["12", "Bajaj Finance Ltd", "500034", "BAJFINANCE", "Financial Services (NBFC)", "Not checked", "", "", "No", ""],
  ["13", "Tata Motors Ltd", "500570", "TATAMOTORS", "Automobile", "Not checked", "", "", "No", ""],
  ["14", "Maruti Suzuki India Ltd", "532500", "MARUTI", "Automobile", "Not checked", "", "", "No", ""],
  ["15", "Sun Pharmaceutical Ind. Ltd", "524715", "SUNPHARMA", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["16", "Wipro Ltd", "507685", "WIPRO", "Information Technology", "No", "2016", "", "No", "[Wayback only] IMPORTANT PRECEDENT: bulk PDFs were DELETED from wipro.com; only Wayback copies survive. Live site = KFin widgets. Source: http://web.archive.org/web/20180515132347/https://www.wipro.com/content/dam/nexus/en/investor/unpaid-dividend/2012/12642-unclaimed-dividend-data-7.pdf"],
  ["17", "UltraTech Cement Ltd", "532538", "ULTRACEMCO", "Cement", "Not checked", "", "", "No", ""],
  ["18", "Titan Company Ltd", "500114", "TITAN", "Consumer Durables / Jewellery", "Not checked", "", "", "No", ""],
  ["19", "Asian Paints Ltd", "500820", "ASIANPAINT", "Paints & Chemicals", "Yes", "FY2024-25", "", "No", "[Bulk PDF] BEST SOURCE FOUND. 15 years of annual PDFs (FY2010-11 to FY2024-25). FY24-25 file = 1211 pages. Also has liable-for-transfer lists WITH share counts. START HERE. Source: https://www.asianpaints.com/IEPF.html"],
  ["20", "HCL Technologies Ltd", "532281", "HCLTECH", "Information Technology", "No", "", "", "No", "Exact-folio widget only. All IEPF PDFs ever hosted were newspaper ads (verified via Wayback CDX). Source: https://www.hcltech.com/investor-relations/iepf"],
  ["21", "Bajaj Finserv Ltd", "532978", "BAJAJFINSV", "Financial Services", "Not checked", "", "", "No", ""],
  ["22", "Tech Mahindra Ltd", "532755", "TECHM", "Information Technology", "Not checked", "", "", "No", ""],
  ["23", "Mahindra & Mahindra Ltd", "500520", "M&M", "Automobile", "Not checked", "", "", "No", ""],
  ["24", "NTPC Ltd", "532555", "NTPC", "Power", "Not checked", "", "", "No", ""],
  ["25", "Oil & Natural Gas Corp. Ltd", "500312", "ONGC", "Oil & Gas", "Not checked", "", "", "No", ""],
  ["26", "Power Grid Corp. of India Ltd", "532898", "POWERGRID", "Power", "Not checked", "", "", "No", ""],
  ["27", "Tata Steel Ltd", "500470", "TATASTEEL", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["28", "JSW Steel Ltd", "500228", "JSWSTEEL", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["29", "Hindalco Industries Ltd", "500440", "HINDALCO", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["30", "Cipla Ltd", "500087", "CIPLA", "Pharmaceuticals", "No", "", "", "No", "[Widget only] 4 per-person widgets. Notice PDFs 2016-2025 have no names. NOTE: row 50 is a duplicate of this company. Source: https://www.cipla.com/investors/unclaimed-data"],
  ["31", "Dr. Reddy's Laboratories Ltd", "500124", "DRREDDY", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["32", "Divis Laboratories Ltd", "532488", "DIVISLAB", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["33", "Eicher Motors Ltd", "505200", "EICHERMOT", "Automobile", "Not checked", "", "", "No", ""],
  ["34", "Hero MotoCorp Ltd", "500182", "HEROMOTOCO", "Automobile", "Not checked", "", "", "No", ""],
  ["35", "Bharti Airtel Ltd", "532454", "BHARTIARTL", "Telecom", "Not checked", "", "", "No", ""],
  ["36", "Grasim Industries Ltd", "500300", "GRASIM", "Cement / Diversified", "Not checked", "", "", "No", ""],
  ["37", "Adani Ports & SEZ Ltd", "532921", "ADANIPORTS", "Ports & Logistics", "Not checked", "", "", "No", ""],
  ["38", "Coal India Ltd", "533278", "COALINDIA", "Mining", "Not checked", "", "", "No", ""],
  ["39", "BPCL (Bharat Petroleum Corp.)", "500547", "BPCL", "Oil & Gas", "Not checked", "", "", "No", ""],
  ["40", "Bajaj Auto Ltd", "532977", "BAJAJ-AUTO", "Automobile", "Not checked", "", "", "No", ""],
  ["41", "Shriram Finance Ltd", "511218", "SHRIRAMFIN", "Financial Services (NBFC)", "Not checked", "", "", "No", ""],
  ["42", "IndusInd Bank Ltd", "532187", "INDUSINDBK", "Banking & Financial Services", "Not checked", "", "", "No", ""],
  ["43", "Apollo Hospitals Enterprise Ltd", "508869", "APOLLOHOSP", "Healthcare", "Not checked", "", "", "No", ""],
  ["44", "Nestle India Ltd", "500790", "NESTLEIND", "FMCG", "Not checked", "", "", "No", ""],
  ["45", "Britannia Industries Ltd", "500825", "BRITANNIA", "FMCG", "Not checked", "", "", "No", ""],
  ["46", "Tata Consumer Products Ltd", "500800", "TATACONSUM", "FMCG", "Not checked", "", "", "No", ""],
  ["47", "LTIMindtree Ltd", "540005", "LTIM", "Information Technology", "Not checked", "", "", "No", ""],
  ["48", "SBI Life Insurance Co. Ltd", "540719", "SBILIFE", "Insurance", "Not checked", "", "", "No", ""],
  ["49", "HDFC Life Insurance Co. Ltd", "540777", "HDFCLIFE", "Insurance", "Not checked", "", "", "No", ""],
  ["50", "Cipla Ltd", "500087", "CIPLA", "Pharmaceuticals", "No", "", "", "No", "[Widget only] DUPLICATE of row 30 - same company and BSE code. Skip this row. Source: https://www.cipla.com/investors/unclaimed-data"],
  ["51", "Bharat Heavy Electricals Ltd", "500103", "BHEL", "Capital Goods", "Not checked", "", "", "No", ""],
  ["52", "Steel Authority of India Ltd", "500113", "SAIL", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["53", "Indian Oil Corporation Ltd", "530965", "IOC", "Oil & Gas", "Not checked", "", "", "No", "Known to publish IEPF transfer details - HIGH PRIORITY to check (iocl.com/transfer-of-equity)"],
  ["54", "Bharat Electronics Ltd", "500049", "BEL", "Defence & Electronics", "Not checked", "", "", "No", ""],
  ["55", "Godrej Consumer Products Ltd", "532424", "GODREJCP", "FMCG", "Not checked", "", "", "No", ""],
  ["56", "Pidilite Industries Ltd", "500331", "PIDILITIND", "Chemicals", "Not checked", "", "", "No", ""],
  ["57", "Havells India Ltd", "517354", "HAVELLS", "Consumer Durables", "Not checked", "", "", "No", ""],
  ["58", "Torrent Pharmaceuticals Ltd", "500420", "TORNTPHARM", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["59", "Dabur India Ltd", "500096", "DABUR", "FMCG", "Not checked", "", "", "No", ""],
  ["60", "Colgate-Palmolive (India) Ltd", "500830", "COLPAL", "FMCG", "Not checked", "", "", "No", ""],
  ["61", "Marico Ltd", "531642", "MARICO", "FMCG", "Not checked", "", "", "No", ""],
  ["62", "Bosch Ltd", "500530", "BOSCHLTD", "Auto Components", "Not checked", "", "", "No", "BSE code partly hidden by watermark in source image - VERIFY code"],
  ["63", "Siemens Ltd", "500550", "SIEMENS", "Capital Goods", "Not checked", "", "", "No", ""],
  ["64", "ABB India Ltd", "500002", "ABB", "Capital Goods", "Not checked", "", "", "No", ""],
  ["65", "3M India Ltd", "523395", "3MINDIA", "Diversified", "Not checked", "", "", "No", ""],
  ["66", "Cummins India Ltd", "500480", "CUMMINSIND", "Capital Goods", "Not checked", "", "", "No", ""],
  ["67", "Mphasis Ltd", "526299", "MPHASIS", "Information Technology", "Not checked", "", "", "No", ""],
  ["68", "Persistent Systems Ltd", "533179", "PERSISTENT", "Information Technology", "Not checked", "", "", "No", ""],
  ["69", "Tata Power Company Ltd", "500400", "TATAPOWER", "Power", "Not checked", "", "", "No", ""],
  ["70", "Adani Green Energy Ltd", "541450", "ADANIGREEN", "Power / Renewables", "Not checked", "", "", "No", ""],
  ["71", "ACC Ltd", "500410", "ACC", "Cement", "Not checked", "", "", "No", ""],
  ["72", "Ambuja Cements Ltd", "500425", "AMBUJACEM", "Cement", "Not checked", "", "", "No", ""],
  ["73", "The Ramco Cements Ltd", "500260", "RAMCOCEM", "Cement", "Not checked", "", "", "No", ""],
  ["74", "Shree Cement Ltd", "500387", "SHREECEM", "Cement", "Not checked", "", "", "No", ""],
  ["75", "Dalmia Bharat Ltd", "542216", "DALBHARAT", "Cement", "Not checked", "", "", "No", ""],
  ["76", "Punjab National Bank", "532461", "PNB", "Banking", "Not checked", "", "", "No", ""],
  ["77", "Bank of Baroda", "532134", "BANKBARODA", "Banking", "Not checked", "", "", "No", ""],
  ["78", "Canara Bank", "532483", "CANBK", "Banking", "Not checked", "", "", "No", ""],
  ["79", "Union Bank of India", "532477", "UNIONBANK", "Banking", "Not checked", "", "", "No", ""],
  ["80", "Bank of India", "532149", "BANKINDIA", "Banking", "Not checked", "", "", "No", ""],
  ["81", "General Insurance Corp. of India", "540755", "GICRE", "Insurance", "Not checked", "", "", "No", ""],
  ["82", "New India Assurance Co. Ltd", "540769", "NIACL", "Insurance", "Not checked", "", "", "No", ""],
  ["83", "Life Insurance Corp. of India", "543526", "LICI", "Insurance", "Not checked", "", "", "No", ""],
  ["84", "LIC Housing Finance Ltd", "500253", "LICHSGFIN", "Financial Services", "Not checked", "", "", "No", ""],
  ["85", "Muthoot Finance Ltd", "533398", "MUTHOOTFIN", "Financial Services (NBFC)", "Not checked", "", "", "No", "Known to publish an IEPF shareholder list - HIGH PRIORITY. NOTE: row 148 is a duplicate."],
  ["86", "Cholamandalam Investment & Fin.", "511243", "CHOLAFIN", "Financial Services (NBFC)", "Not checked", "", "", "No", ""],
  ["87", "IDBI Bank Ltd", "500116", "IDBI", "Banking", "Not checked", "", "", "No", ""],
  ["88", "GAIL (India) Ltd", "532155", "GAIL", "Oil & Gas", "Not checked", "", "", "No", ""],
  ["89", "Petronet LNG Ltd", "532522", "PETRONET", "Oil & Gas", "Not checked", "", "", "No", "BSE code cut off in source image - VERIFY code"],
  ["90", "Hindustan Petroleum Corp. Ltd", "500104", "HINDPETRO", "Oil & Gas", "Not checked", "", "", "No", ""],
  ["91", "Castrol India Ltd", "500870", "CASTROLIND", "Oil & Gas / Lubricants", "Not checked", "", "", "No", ""],
  ["92", "Tata Chemicals Ltd", "500770", "TATACHEM", "Chemicals", "Not checked", "", "", "No", ""],
  ["93", "UPL Ltd", "512070", "UPL", "Agrochemicals", "Not checked", "", "", "No", ""],
  ["94", "Coromandel International Ltd", "506395", "COROMANDEL", "Fertilisers", "Not checked", "", "", "No", ""],
  ["95", "Chambal Fertilisers & Chem. Ltd", "500085", "CHAMBLFERT", "Fertilisers", "Not checked", "", "", "No", ""],
  ["96", "Gujarat Fluorochemicals Ltd", "542812", "FLUOROCHEM", "Chemicals", "Not checked", "", "", "No", ""],
  ["97", "Berger Paints India Ltd", "509480", "BERGEPAINT", "Paints", "Not checked", "", "", "No", ""],
  ["98", "Kansai Nerolac Paints Ltd", "500165", "KANSAINER", "Paints", "Not checked", "", "", "No", ""],
  ["99", "Akzo Nobel India Ltd", "500710", "AKZOINDIA", "Paints", "Not checked", "", "", "No", ""],
  ["100", "Whirlpool of India Ltd", "500238", "WHIRLPOOL", "Consumer Durables", "Not checked", "", "", "No", ""],
  ["101", "Voltas Ltd", "500575", "VOLTAS", "Consumer Durables", "Not checked", "", "", "No", "NOTE: row 141 is a duplicate of this company."],
  ["102", "Blue Star Ltd", "500067", "BLUESTARCO", "Consumer Durables", "Not checked", "", "", "No", ""],
  ["103", "Crompton Greaves Consumer Elec.", "539876", "CROMPTON", "Consumer Durables", "Not checked", "", "", "No", ""],
  ["104", "Thermax Ltd", "500411", "THERMAX", "Capital Goods", "Not checked", "", "", "No", ""],
  ["105", "Bharat Forge Ltd", "500493", "BHARATFORG", "Auto Components", "Not checked", "", "", "No", ""],
  ["106", "Motherson Sumi Wiring India Ltd", "543498", "MSUMI", "Auto Components", "Not checked", "", "", "No", ""],
  ["107", "MRF Ltd", "500290", "MRF", "Tyres", "Not checked", "", "", "No", ""],
  ["108", "Apollo Tyres Ltd", "500877", "APOLLOTYRE", "Tyres", "Not checked", "", "", "No", ""],
  ["109", "Ceat Ltd", "500878", "CEATLTD", "Tyres", "Not checked", "", "", "No", ""],
  ["110", "Balkrishna Industries Ltd", "502355", "BALKRISIND", "Tyres", "Not checked", "", "", "No", ""],
  ["111", "Godrej Properties Ltd", "533150", "GODREJPROP", "Real Estate", "Not checked", "", "", "No", ""],
  ["112", "DLF Ltd", "532868", "DLF", "Real Estate", "Not checked", "", "", "No", ""],
  ["113", "Prestige Estates Projects Ltd", "533274", "PRESTIGE", "Real Estate", "Not checked", "", "", "No", "BSE code cut off in source image - VERIFY code"],
  ["114", "Oberoi Realty Ltd", "533273", "OBEROIRLTY", "Real Estate", "Not checked", "", "", "No", ""],
  ["115", "Interglobe Aviation Ltd (IndiGo)", "539448", "INDIGO", "Aviation", "Not checked", "", "", "No", ""],
  ["116", "Container Corp. of India Ltd", "531344", "CONCOR", "Logistics", "Not checked", "", "", "No", ""],
  ["117", "Bharat Dynamics Ltd", "541143", "BDL", "Defence", "Not checked", "", "", "No", ""],
  ["118", "HAL (Hindustan Aeronautics Ltd)", "541154", "HAL", "Defence", "Not checked", "", "", "No", ""],
  ["119", "IRCTC (Indian Railway Catering)", "542830", "IRCTC", "Railways / Services", "Not checked", "", "", "No", ""],
  ["120", "Indian Railway Finance Corp.", "543257", "IRFC", "Financial Services", "Not checked", "", "", "No", ""],
  ["121", "Hindustan Zinc Ltd", "500188", "HINDZINC", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["122", "Vedanta Ltd", "500295", "VEDL", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["123", "National Aluminium Co. Ltd", "532234", "NATIONALUM", "Metals & Mining", "Not checked", "", "", "No", ""],
  ["124", "MOIL Ltd", "532636", "MOIL", "Mining", "Not checked", "", "", "No", ""],
  ["125", "NMDC Ltd", "526371", "NMDC", "Mining", "Not checked", "", "", "No", ""],
  ["126", "Aurobindo Pharma Ltd", "524804", "AUROPHARMA", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["127", "Lupin Ltd", "500257", "LUPIN", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["128", "Zydus Lifesciences Ltd", "532321", "ZYDUSLIFE", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["129", "Alkem Laboratories Ltd", "539523", "ALKEM", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["130", "Ipca Laboratories Ltd", "524494", "IPCALAB", "Pharmaceuticals", "Not checked", "", "", "No", ""],
  ["131", "Minda Industries Ltd (UNO Minda)", "532539", "UNOMINDA", "Auto Components", "Not checked", "", "", "No", "Renamed UNO Minda; source image shows old symbol MINDAIND"],
  ["132", "Exide Industries Ltd", "500086", "EXIDEIND", "Auto Components", "Not checked", "", "", "No", ""],
  ["133", "Amara Raja Energy & Mobility", "500008", "ARE&M", "Auto Components", "Not checked", "", "", "No", "Source image shows old symbol AMARAJABAT"],
  ["134", "Timken India Ltd", "522113", "TIMKEN", "Auto Components", "Not checked", "", "", "No", ""],
  ["135", "SKF India Ltd", "500472", "SKFINDIA", "Auto Components", "Not checked", "", "", "No", ""],
  ["136", "Kirloskar Brothers Ltd", "500241", "KIRLOSBROS", "Capital Goods", "Not checked", "", "", "No", ""],
  ["137", "Kirloskar Electric Co. Ltd", "500243", "KIRLOSELE", "Capital Goods", "Not checked", "", "", "No", "VERIFY BSE code"],
  ["138", "KEC International Ltd", "532714", "KEC", "Capital Goods", "Not checked", "", "", "No", ""],
  ["139", "Kalpataru Projects Int. Ltd", "522287", "KPIL", "Capital Goods", "Not checked", "", "", "No", ""],
  ["140", "NCC Ltd", "500294", "NCC", "Construction", "Not checked", "", "", "No", ""],
  ["141", "Voltas Ltd", "500575", "VOLTAS", "Consumer Durables", "Not checked", "", "", "No", "DUPLICATE of row 101 - same company and BSE code. Skip this row."],
  ["142", "Raymond Ltd", "500330", "RAYMOND", "Textiles", "Not checked", "", "", "No", ""],
  ["143", "Arvind Ltd", "500101", "ARVIND", "Textiles", "Not checked", "", "", "No", ""],
  ["144", "Century Textiles & Industries", "500040", "CENTURYTEX", "Textiles / Paper", "Not checked", "", "", "No", ""],
  ["145", "The Indian Hotels Co. Ltd (Taj)", "500850", "INDHOTEL", "Hotels", "Not checked", "", "", "No", ""],
  ["146", "ITC Hotels Ltd", "800415", "ITCHOTEL", "Hotels", "Not checked", "", "", "No", "UNUSUAL CODE: 800415 read from image but BSE codes are normally 5xxxxx - VERIFY (listed Jan 2025)"],
  ["147", "EIH Ltd (Oberoi Hotels)", "500840", "EIHOTEL", "Hotels", "Not checked", "", "", "No", "Known to publish year-wise IEPF shareholder lists - HIGH PRIORITY"],
  ["148", "Muthoot Finance Ltd", "533398", "MUTHOOTFIN", "Financial Services (NBFC)", "Not checked", "", "", "No", "DUPLICATE of row 85 - same company and BSE code. Skip this row."],
  ["149", "Manappuram Finance Ltd", "531213", "MANAPPURAM", "Financial Services (NBFC)", "Not checked", "", "", "No", ""],
  ["150", "CRISIL Ltd", "500092", "CRISIL", "Ratings / Analytics", "Not checked", "", "", "No", ""],
  ["151", "PNB Gilts Ltd", "532366", "PNBGILTS", "Financial Services", "Yes", "2018", "382", "Yes", "[Bulk PDF] ALREADY INGESTED into unclaimed_assets_live (382 rows / 24220 shares). Not part of the original 150 - added as proof of the pipeline. VERIFY BSE code. Source: https://www.pnbgilts.com/uploads/annoucement/1524651350.pdf"]
];

var HAS_DATA_OPTIONS = ['Yes', 'Partial', 'No', 'Not checked'];
var YES_NO_OPTIONS   = ['Yes', 'No'];

var SHEET_NAME = 'Company Audit';
var DASH_NAME  = 'Dashboard';

// 1-based column positions — keep in sync with HEADERS
var COL = {
  SR: 1, NAME: 2, BSE: 3, NSE: 4, INDUSTRY: 5,
  HAS_DATA: 6, UPTO: 7, RECORDS: 8,
  INGESTED: 9, NOTES: 10
};

// Spare capacity created below the seed rows so the team can keep adding.
var SPARE_ROWS = 500;

/**
 * MAIN — run this one.
 */
function buildAuditSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName(SHEET_NAME);
  if (old) { ss.deleteSheet(old); }
  var sheet = ss.insertSheet(SHEET_NAME, 0);

  var nData = COMPANIES.length;
  var lastCol = HEADERS.length;

  // Header + data
  sheet.getRange(1, 1, 1, lastCol).setValues([HEADERS]);
  sheet.getRange(2, 1, nData, lastCol).setValues(COMPANIES);

  // Make sure there is plenty of room to keep adding companies
  var needed = nData + 1 + SPARE_ROWS;
  if (sheet.getMaxRows() < needed) {
    sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() > lastCol) {
    sheet.deleteColumns(lastCol + 1, sheet.getMaxColumns() - lastCol);
  }
  var maxRow = sheet.getMaxRows();          // everything below applies to the WHOLE sheet
  var bodyRows = maxRow - 1;

  // Header styling
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#0b5394')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  // Column widths
  var widths = {1: 60, 2: 270, 3: 110, 4: 120, 5: 190,
                6: 110, 7: 150, 8: 110, 9: 150, 10: 520};
  for (var c in widths) { sheet.setColumnWidth(Number(c), widths[c]); }

  // Dropdowns — applied to the ENTIRE column so new rows get them free
  applyDropdown_(sheet, COL.HAS_DATA, bodyRows, HAS_DATA_OPTIONS);
  applyDropdown_(sheet, COL.INGESTED, bodyRows, YES_NO_OPTIONS);

  // Default new rows to "Not checked" / "No" so the dashboard maths stays honest
  // (only the seed rows are filled; blanks below are counted separately)

  // Colour coding — also whole-column
  var hasDataRange = sheet.getRange(2, COL.HAS_DATA, bodyRows, 1);
  var wholeBody = sheet.getRange(2, 1, bodyRows, lastCol);
  var rules = [
    colourRule_('Yes',         '#b7e1cd', '#0b5323', hasDataRange),
    colourRule_('Partial',     '#fce8b2', '#7f6000', hasDataRange),
    colourRule_('No',          '#f4c7c3', '#990000', hasDataRange),
    colourRule_('Not checked', '#efefef', '#666666', hasDataRange),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=REGEXMATCH($J2&"","DUPLICATE")')
      .setBackground('#fff2cc')
      .setRanges([wholeBody])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);

  // Filter over the whole sheet + number/wrap formats
  sheet.getRange(1, 1, maxRow, lastCol).createFilter();
  sheet.getRange(2, COL.RECORDS, bodyRows, 1).setNumberFormat('#,##0');
  sheet.getRange(2, COL.NOTES, bodyRows, 1).setWrap(true);

  buildDashboard_(ss);
  ss.setActiveSheet(sheet);

  SpreadsheetApp.getUi().alert(
    'Seektrix audit sheet ready\n\n' +
    nData + ' companies loaded, with room for ' + SPARE_ROWS + ' more.\n' +
    'Tabs: "' + SHEET_NAME + '" and "' + DASH_NAME + '".\n\n' +
    'Just type in the next empty row to add a company — dropdowns, colours and ' +
    'the Dashboard extend automatically.');
}

/**
 * Dashboard — all formulas use open-ended ranges (F2:F etc.) so they count
 * every row you ever add, without editing anything.
 */
function buildDashboard_(ss) {
  var dash = ss.getSheetByName(DASH_NAME);
  if (dash) { ss.deleteSheet(dash); }
  dash = ss.insertSheet(DASH_NAME, 1);

  var S = "'" + SHEET_NAME + "'";
  var names    = S + '!B2:B';
  var hasData  = S + '!F2:F';
  var ingested = S + '!I2:I';
  var records  = S + '!H2:H';

  var rows = [
    ['SEEKTRIX — Data Coverage Dashboard', ''],
    ['', ''],
    ['Companies in list', '=COUNTA(' + names + ')'],
    ['', ''],
    ['DATA AVAILABILITY', ''],
    ['Has data (Yes)', '=COUNTIF(' + hasData + ',"Yes")'],
    ['Partial data', '=COUNTIF(' + hasData + ',"Partial")'],
    ['No data available', '=COUNTIF(' + hasData + ',"No")'],
    ['Still to check', '=COUNTIF(' + hasData + ',"Not checked")'],
    ['Usable sources (Yes + Partial)',
     '=COUNTIF(' + hasData + ',"Yes")+COUNTIF(' + hasData + ',"Partial")'],
    ['Audit progress',
     '=IFERROR(TEXT(1-COUNTIF(' + hasData + ',"Not checked")/COUNTA(' + hasData + '),"0.0%"),"-")'],
    ['', ''],
    ['INGESTION INTO SUPABASE', ''],
    ['Companies ingested', '=COUNTIF(' + ingested + ',"Yes")'],
    ['Total records collected', '=SUM(' + records + ')'],
    ['', ''],
    ['Last refreshed', '=TEXT(NOW(),"yyyy-mm-dd hh:mm")']
  ];

  dash.getRange(1, 1, rows.length, 2).setValues(rows);
  dash.getRange(1, 1, 1, 2).setFontSize(16).setFontWeight('bold').setFontColor('#0b5394');
  [5, 13].forEach(function (r) {
    dash.getRange(r, 1, 1, 2).setFontWeight('bold').setBackground('#e8eaed');
  });
  dash.getRange(11, 1, 1, 2).setFontWeight('bold');
  dash.setColumnWidth(1, 300);
  dash.setColumnWidth(2, 170);
  dash.getRange(1, 2, rows.length, 1).setHorizontalAlignment('right');
}

function applyDropdown_(sheet, col, bodyRows, options) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(true)   // allow blanks in the empty rows below the data
    .build();
  sheet.getRange(2, col, bodyRows, 1).setDataValidation(rule);
}

function colourRule_(value, bg, fg, range) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(value)
    .setBackground(bg)
    .setFontColor(fg)
    .setRanges([range])
    .build();
}

/** Adds a "Seektrix" menu with row-capacity + export helpers. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Seektrix')
    .addItem('Add 500 more rows', 'addMoreRows')
    .addItem('Export sheet as CSV (to log)', 'exportSheetAsCsv')
    .addToUi();
}

/** Extends the sheet AND the dropdowns/colours so new rows behave the same. */
function addMoreRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  sheet.insertRowsAfter(sheet.getMaxRows(), 500);
  var bodyRows = sheet.getMaxRows() - 1;
  applyDropdown_(sheet, COL.HAS_DATA, bodyRows, HAS_DATA_OPTIONS);
  applyDropdown_(sheet, COL.INGESTED, bodyRows, YES_NO_OPTIONS);
  var hasDataRange = sheet.getRange(2, COL.HAS_DATA, bodyRows, 1);
  var wholeBody = sheet.getRange(2, 1, bodyRows, HEADERS.length);
  sheet.setConditionalFormatRules([
    colourRule_('Yes',         '#b7e1cd', '#0b5323', hasDataRange),
    colourRule_('Partial',     '#fce8b2', '#7f6000', hasDataRange),
    colourRule_('No',          '#f4c7c3', '#990000', hasDataRange),
    colourRule_('Not checked', '#efefef', '#666666', hasDataRange),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=REGEXMATCH($J2&"","DUPLICATE")')
      .setBackground('#fff2cc')
      .setRanges([wholeBody])
      .build()
  ]);
  SpreadsheetApp.getUi().alert('500 rows added. Total capacity: ' + sheet.getMaxRows() + ' rows.');
}

/**
 * Exports the sheet back to CSV text in the execution log, so the team's audit
 * progress can be pasted into data/company_audit_150.csv in the repo.
 * Run it, then open the Executions / Logs panel and copy the output.
 */
function exportSheetAsCsv() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var csv = values.map(function (row) {
    return row.map(function (cell) {
      var s = String(cell === null || cell === undefined ? '' : cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
  Logger.log(csv);
}
