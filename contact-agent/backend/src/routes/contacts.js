'use strict';

/**
 * src/routes/contacts.js
 *
 * GET /contacts[?batch_id=<uuid>]
 * Returns extracted contacts directly synchronized from Google Sheets,
 * with fallback to local store if sheet is temporarily unreachable.
 */

const express = require('express');
const store   = require('../store');
const googleSheetsService = require('../services/googleSheetsService');

const router = express.Router();

// ── GET /contacts ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { batch_id } = req.query;

  // If specific batch requested from local uploads
  if (batch_id) {
    const batch = store.getBatch(batch_id);
    if (!batch) {
      return res.status(404).json({ error: `Batch '${batch_id}' not found.` });
    }
    const result = store.getContactsByBatch(batch_id);
    return res.json({
      total: result.length,
      batch_id,
      contacts: result,
      source: 'local_batch'
    });
  }

  // Fetch directly from live Google Sheets
  try {
    const sheetContacts = await googleSheetsService.fetchContactsFromSheet();
    if (sheetContacts && sheetContacts.length > 0) {
      return res.json({
        total: sheetContacts.length,
        batch_id: null,
        contacts: sheetContacts,
        source: 'google_sheets'
      });
    }
  } catch (err) {
    console.warn('[contacts] Failed to fetch live Google Sheets, using local store cache:', err.message);
  }

  // Fallback to local store
  const localContacts = store.getAllContacts();
  return res.json({
    total: localContacts.length,
    batch_id: null,
    contacts: localContacts,
    source: 'local_cache'
  });
});

// ── PATCH /contacts/:id/status ───────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['New', 'Contacted', 'Follow-up'].includes(status)) {
    return res.status(400).json({
      error: "Status must be 'New', 'Contacted', or 'Follow-up'."
    });
  }

  googleSheetsService.setStatusOverride(id, status);
  const updated = store.updateContactStatus(id, status) || { id, status };

  return res.json({ ok: true, contact: updated });
});

// ── POST /contacts (Create New Lead) ──────────────────────────────────────────
router.post('/', (req, res) => {
  const data = req.body;
  if (!data || (!data.full_name && !data.company && !data.email)) {
    return res.status(400).json({ error: 'Please provide at least a Name, Company, or Email.' });
  }

  const { v4: uuidv4 } = require('uuid');
  const { scoreLead, validateContact } = require('../services/leadEngine');
  const scored = scoreLead(data);
  const valStatus = validateContact(data.email || 'Missing', data.phone || 'Missing');

  const fullName = (data.full_name || '').trim() || 'Missing';
  const newContact = {
    id: data.id || `lead_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    full_name: fullName,
    first_name: data.first_name || (fullName !== 'Missing' ? fullName.split(' ')[0] : 'Missing'),
    last_name: data.last_name || (fullName !== 'Missing' ? fullName.split(' ').slice(1).join(' ') || 'Missing' : 'Missing'),
    designation: data.designation || 'Missing',
    company: data.company || 'Missing',
    email: data.email || 'Missing',
    phone: data.phone || 'Missing',
    address: data.address || 'Missing',
    city: data.city || 'Missing',
    state: data.state || 'Missing',
    country: data.country || 'Missing',
    sector_industry: data.sector_industry || 'Missing',
    linkedin_url: data.linkedin_url || 'Missing',
    website: data.website || 'Missing',
    source: 'Manual Entry',
    uploaded_at: new Date().toISOString(),
    validation_status: valStatus,
    duplicate_status: 'UNIQUE',
    lead_status: data.status || data.lead_status || 'New',
    status: data.status || data.lead_status || 'New',
    lead_score: scored.score,
    lead_tier: scored.tier,
    scoring_rationale: scored.rationale,
    sales_summary: scored.salesSummary
  };

  store.addContacts('manual_leads', [newContact]);
  return res.status(201).json({ ok: true, contact: newContact });
});


module.exports = router;
