'use strict';

/**
 * src/services/googleSheetsService.js
 *
 * Connects directly to Google Sheets to fetch, parse, and synchronize
 * contacts and leads live from the spreadsheet.
 */

const https = require('https');
const crypto = require('crypto');
const { scoreLead } = require('./leadEngine');
const { deduplicateContactList } = require('./dedupService');

const GOOGLE_SHEET_ID = '1AZqaSfoyhcjQOLif1xZfeGi9rfMWHwKDRJUaYuArJVE';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;

// In-memory status overrides (e.g. user changes status to 'Contacted' or 'Follow-up')
const statusOverrides = new Map();

/**
 * Fetch URL content following HTTP redirects
 */
function fetchUrl(targetUrl, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsRemaining <= 0) {
      return reject(new Error('Too many HTTP redirects while fetching Google Sheets.'));
    }

    const req = https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Node.js)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Google Sheets responded with HTTP status ${res.statusCode}`));
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Google Sheets request timed out after 10s.'));
    });
  });
}

/**
 * RFC-4180 compliant CSV parser
 * Correctly handles quotes, escaped quotes, multiline values, and commas.
 */
function parseRFC4180CSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    const next = csvText[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++; // handle CRLF
      }
      row.push(cell);
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function cleanVal(v) {
  if (v === undefined || v === null) return 'Missing';
  const str = String(v).trim();
  return (str === '' || str.toLowerCase() === 'missing') ? 'Missing' : str;
}

/**
 * AI Competitor Detection
 * Any company, industry, or job title relating to AI / Machine Learning / LLMs
 * is classified as Cold to prevent conflict with our own AI offerings.
 * Educational institutions and universities (e.g. SNS) are excluded.
 */
function isAICompetitor(company, designation, sectorIndustry, salesSummary) {
  const c = (company || '').toLowerCase();
  const d = (designation || '').toLowerCase();
  const s = (sectorIndustry || '').toLowerCase();
  const sum = (salesSummary || '').toLowerCase();

  if (/sns|college|university|institution|institute|school|trust|academy|hospital|ministry|government/i.test(c)) {
    return false;
  }

  const aiRegex = /\b(ai|artificial intelligence|generative ai|genai|llm|machine learning|deep learning|agentic ai|nlp|computer vision)\b/i;
  return (
    aiRegex.test(c) ||
    aiRegex.test(d) ||
    aiRegex.test(s) ||
    aiRegex.test(sum) ||
    /head of ai|ai lead|ai architect|data & ai|director - ai|vp - ai|ai engineering|ai solutions/i.test(d) ||
    /ai vendor|ai competitor|ai solutions|ai engineering|data science & ai/i.test(s) ||
    /ai solutions|ai platform|ai consulting|ai products/i.test(c)
  );
}

/**
 * Fetch and map contacts directly from Google Sheets
 */
async function fetchContactsFromSheet() {
  let csvText;
  try {
    csvText = await fetchUrl(CSV_URL);
  } catch (err) {
    console.warn('[googleSheets] CSV export failed, falling back to gviz endpoint:', err.message);
    csvText = await fetchUrl(GVIZ_URL);
  }

  const rawRows = parseRFC4180CSV(csvText);
  if (rawRows.length < 2) {
    console.warn('[googleSheets] Sheet contains fewer than 2 rows (no data).');
    return [];
  }

  // Normalize header keys: trim whitespace and lowercase
  const rawHeaders = rawRows[0];
  const headers = rawHeaders.map((h) => h.trim());

  const contacts = [];

  for (let r = 1; r < rawRows.length; r++) {
    const rowCells = rawRows[r];
    const row = {};

    headers.forEach((key, idx) => {
      row[key] = (rowCells[idx] || '').trim();
    });

    const fullName = cleanVal(row['Full Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim());
    if (fullName === 'Missing' && cleanVal(row['Company']) === 'Missing' && cleanVal(row['Email']) === 'Missing') {
      continue; // Skip completely blank lines
    }

    const company = cleanVal(row['Company']);
    const email = cleanVal(row['Email']);
    const phone = cleanVal(row['Phone']);
    const designation = cleanVal(row['Designation'] || row['Job Title']);
    const city = cleanVal(row['City']);
    const state = cleanVal(row['State']);
    const country = cleanVal(row['Country']);
    const address = cleanVal(row['Address']);
    const sectorIndustry = cleanVal(row['Sector/Industry'] || row['Sector/Industry    ']);
    const website = cleanVal(row['Website']);
    const linkedin = cleanVal(row['LinkedIn']);
    const source = cleanVal(row['Source'] || 'Google Sheets');
    const uploadedAt = cleanVal(row['Uploaded At'] || new Date().toISOString());
    const validationStatus = cleanVal(row['Validation Status'] || row['Validation Status  '] || 'Valid');
    const duplicateStatus = cleanVal(row['Duplicate Status'] || 'UNIQUE');
    const scoringRationale = cleanVal(row['Scoring Rationale']);
    const rawConsent = String(row['Opt-In'] ?? row['Opt In'] ?? row.Consent ?? '').trim().toLowerCase();
    const sheetOptIn = ['false', 'no', '0', 'opted out', 'unsubscribe', 'unsubscribed'].includes(rawConsent)
      ? false
      : ['true', 'yes', '1', 'opted in', 'subscribed'].includes(rawConsent) ? true : undefined;
    const scored = scoreLead({
      full_name: fullName,
      designation,
      company,
      email,
      phone,
      address,
      city,
      state,
      country,
      sector_industry: sectorIndustry,
      linkedin_url: linkedin,
      website
    });

    const leadScore = scored.score;
    const leadTier = scored.tier;
    const finalRationale = scored.rationale;
    const finalSummary = scored.salesSummary;

    // Deterministic lead ID
    const hashBasis = `${fullName}|${company}|${email}|${phone}|${r}`;
    const id = crypto.createHash('md5').update(hashBasis).digest('hex');

    // Status: apply any user status override if present, else use Sheet status, else 'New'
    let leadStatus = statusOverrides.get(id) || cleanVal(row['Lead Status']);
    if (leadStatus === 'Missing' || !['New', 'Contacted', 'Follow-up'].includes(leadStatus)) {
      leadStatus = 'New';
    }

    contacts.push({
      id,
      full_name: fullName,
      first_name: cleanVal(row['First Name']),
      last_name: cleanVal(row['Last Name']),
      designation,
      company,
      email,
      phone,
      address,
      city,
      state,
      country,
      sector_industry: sectorIndustry,
      linkedin_url: linkedin,
      website,
      source,
      uploaded_at: uploadedAt,
      validation_status: validationStatus,
      duplicate_status: duplicateStatus,
      lead_status: leadStatus,
      status: leadStatus,
      lead_score: leadScore,
      lead_tier: leadTier,
      scoring_rationale: finalRationale,
      sales_summary: finalSummary,
      opt_in: sheetOptIn
    });
  }

  console.log(`[googleSheets] Synchronized ${contacts.length} live contacts from Google Sheets.`);
  const store = require('../store');
  const manualLeads = store.getContactsForFile ? store.getContactsForFile('manual_leads') : [];
  const allContacts = [...manualLeads, ...contacts];
  const dedupedContacts = deduplicateContactList(allContacts, scoreLead);
  console.log(`[googleSheets] After deduplication: ${dedupedContacts.length} unique contacts.`);
  return dedupedContacts;
}

/**
 * Update CRM status in memory override
 */
function setStatusOverride(contactId, status) {
  statusOverrides.set(contactId, status);
}

module.exports = {
  fetchContactsFromSheet,
  setStatusOverride,
  GOOGLE_SHEET_ID
};
