'use strict';

const express = require('express');
const store = require('../services/nurtureStore');
const sheets = require('../services/nurtureGoogleSheetsService');
const router = express.Router();

router.get('/', (_req, res) => res.json({ success: true, stats: store.getStats(), contacts: store.getContacts() }));
router.post('/sync', async (_req, res, next) => {
  try {
    const result = await sheets.syncFromSheets();
    res.json({ success: true, message: `Synchronized ${result.count} nurturing contacts from ${result.source}.`, contacts: store.getContacts(), stats: store.getStats(), source: result.source, duplicates_removed: result.duplicates_removed || 0 });
  } catch (err) { next(err); }
});
router.post('/import', (req, res) => {
  const incoming = req.body?.contacts;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return res.status(400).json({ success: false, error: 'A non-empty contacts array is required.' });
  }
  const contacts = incoming.map(contact => ({
    ...contact,
    id: String(contact.id || ''),
    name: String(contact.name || ''),
    company: String(contact.company || ''),
    email: String(contact.email || ''),
    phone: String(contact.phone || ''),
    opt_in: contact.opt_in === undefined || contact.opt_in === null ? true : Boolean(contact.opt_in),
    status: contact.opt_in === false ? 'Opted Out' : 'Active'
  })).filter(contact => contact.id && contact.name);
  if (contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'Imported contacts must include an id and name.' });
  }
  const imported = store.addContacts(contacts);
  res.json({ success: true, imported, contacts: store.getContacts(), stats: store.getStats() });
});
router.get('/opt-events', (_req, res) => res.json({ success: true, events: store.getOptEvents() }));
router.get('/:id', (req, res) => {
  const contact = store.getContactById(req.params.id) || store.getContacts().find(c => c.email === req.params.id);
  return contact ? res.json({ success: true, contact }) : res.status(404).json({ success: false, error: 'Contact not found' });
});
router.post('/:id/toggle-opt-in', (req, res) => {
  const result = store.toggleContactOptIn(req.params.id, req.body?.opt_in, req.body || {});
  if (!result) return res.status(404).json({ success: false, error: 'Contact not found' });
  res.json({ success: true, contact: result.contact, event: result.event, opt_events: store.getOptEvents(), contacts: store.getContacts(), stats: store.getStats() });
});
router.post('/:id/preferences', (req, res) => {
  const result = store.updateContactPreferences(req.params.id, req.body || {});
  if (!result) return res.status(404).json({ success: false, error: 'Contact not found' });
  res.json({ success: true, contact: result.contact, event: result.event, opt_events: store.getOptEvents(), contacts: store.getContacts(), stats: store.getStats() });
});

module.exports = router;
