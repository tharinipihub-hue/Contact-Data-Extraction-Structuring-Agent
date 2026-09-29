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
  const { batch_id, source } = req.query;

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

module.exports = router;
