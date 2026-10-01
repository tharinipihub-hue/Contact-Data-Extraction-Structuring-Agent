'use strict';

const store = require('./nurtureStore');
const leadSheets = require('./googleSheetsService');

function parseConsent(value) {
  const consent = String(value ?? '').trim().toLowerCase();
  if (['false', 'no', '0', 'opted out', 'unsubscribe', 'unsubscribed'].includes(consent)) return false;
  if (['true', 'yes', '1', 'opted in', 'subscribed'].includes(consent)) return true;
  return undefined;
}

function toNurtureContact(contact) {
  return {
    ...contact,
    id: String(contact.id || ''),
    name: contact.full_name || contact.name || contact.email || '',
    company: contact.company || '',
    email: contact.email || '',
    phone: contact.phone || '',
    designation: contact.designation || '',
    sector: contact.sector_industry || contact.sector || contact.industry || 'Technology',
    industry: contact.sector_industry || contact.sector || contact.industry || 'Technology',
    location: contact.address || [contact.city, contact.state, contact.country].filter(Boolean).join(', '),
    opt_in: contact.opt_in === undefined ? true : contact.opt_in,
    status: contact.opt_in === false ? 'Opted Out' : 'Active'
  };
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
    const sector = o['Sector / Industry'] || o.Industry || o.Sector || 'Technology';
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
      client_type: o['Client Type'] || '',
      previous_interaction: o['Previous Interaction'] || '',
      status: optIn === false ? 'Opted Out' : (o.Status || 'Active'),
      opt_in: optIn,
      location: o.Location || [o.City, o.State, o.Country].filter(Boolean).join(', '),
      city: o.City || '', state: o.State || '', country: o.Country || '',
      known_interests: o['Known Interests'] || ''
    });
  }
  contacts.duplicatesRemoved = duplicates;
  return contacts;
}

async function syncFromSheets() {
  const url = process.env.NURTURE_GOOGLE_SHEETS_CSV_URL;
  try {
    let contacts;
    let source;
    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Sheets returned HTTP ${response.status}`);
      contacts = parseCsv(await response.text());
      source = 'google_sheets';
    } else {
      // Reuse the same live Sheets connector as the Leads screen when no
      // nurture-specific CSV URL is configured.
      contacts = (await leadSheets.fetchContactsFromSheet()).map(toNurtureContact).filter(contact => contact.id && contact.name);
      source = 'google_sheets';
    }
    if (contacts.length) {
      store.setContacts(contacts);
      return { count: contacts.length, duplicates_removed: contacts.duplicatesRemoved || 0, source };
    }
  } catch (err) {
    console.warn('[nurtureSheets] Live sync unavailable; retaining the existing contact store:', err.message);
  }
  const contacts = store.getContacts();
  return { count: contacts.length, duplicates_removed: 0, source: 'existing_store' };
}

module.exports = { syncFromSheets, parseCsv };
