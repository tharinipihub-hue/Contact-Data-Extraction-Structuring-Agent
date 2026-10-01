'use strict';

const store = require('./nurtureStore');
const PAST_CLIENTS_SHEET_ID = '1LffI4BEX2T1mdBIvy45gvauzqny8wPTCX3FaGvYVx2c';
const DEFAULT_PAST_CLIENTS_CSV_URL = `https://docs.google.com/spreadsheets/d/${PAST_CLIENTS_SHEET_ID}/export?format=csv`;

function getPastClientsCsvUrl() {
  const envUrl = (process.env.NURTURE_GOOGLE_SHEETS_CSV_URL || '').trim();
  if (!envUrl) return DEFAULT_PAST_CLIENTS_CSV_URL;

  // Convert standard edit/sharing URLs to direct CSV export
  const match = envUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }
  return envUrl;
}

function parseConsent(value) {
  const consent = String(value ?? '').trim().toLowerCase();
  if (['false', 'no', '0', 'opted out', 'unsubscribe', 'unsubscribed'].includes(consent)) return false;
  if (['true', 'yes', '1', 'opted in', 'subscribed'].includes(consent)) return true;
  return undefined;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows.shift().map(x => x.trim());
  const seen = new Set(); let duplicates = 0;
  const contacts = [];
  for (const cols of rows) {
    const o = Object.fromEntries(headers.map((h, i) => [h, (cols[i] || '').trim()]));
    const name = o['Full Name'] || o.Name || o.Email || '';
    const company = o.Company || '';
    if (!name) continue;
    const key = `${name.toLowerCase()}::${company.toLowerCase()}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const sector = o['Sector / Industry'] || o['Sector/Industry'] || o.Industry || o.Sector || 'Technology';
    const optIn = parseConsent(o['Opt-In'] ?? o['Opt In'] ?? o.Consent);
    contacts.push({
      id: `CNT-${String(contacts.length + 1).padStart(3, '0')}`,
      name,
      designation: o.Designation || o['Job Title'] || '',
      company,
      email: o.Email || '',
      phone: o.Phone || '',
      sector,
      industry: sector,
      client_type: o['Client Type'] || 'Past Client',
      previous_interaction: o['Previous Interaction'] || 'Active enterprise partnership',
      status: optIn === false ? 'Opted Out' : (o.Status || 'Active'),
      opt_in: optIn !== undefined ? optIn : true,
      location: o.Location || [o.City, o.State, o.Country].filter(Boolean).join(', '),
      city: o.City || '', state: o.State || '', country: o.Country || '',
      known_interests: o['Known Interests'] || ''
    });
  }
  contacts.duplicatesRemoved = duplicates;
  return contacts;
}

async function syncFromSheets() {
  const url = getPastClientsCsvUrl();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}`);
    const csvContent = await response.text();
    const contacts = parseCsv(csvContent);
    if (contacts.length) {
      store.setContacts(contacts);
      return { count: contacts.length, duplicates_removed: contacts.duplicatesRemoved || 0, source: 'past_clients_google_sheets' };
    }
  } catch (err) {
    console.warn('[nurtureSheets] Live Past Clients sync unavailable; retaining existing store:', err.message);
  }
  const contacts = store.getContacts();
  return { count: contacts.length, duplicates_removed: 0, source: 'existing_store' };
}

module.exports = { syncFromSheets, parseCsv, getPastClientsCsvUrl, PAST_CLIENTS_SHEET_ID };
