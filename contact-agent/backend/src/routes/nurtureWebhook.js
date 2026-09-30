'use strict';

const express = require('express');
const store = require('../services/nurtureStore');
const router = express.Router();

router.post('/callback', (req, res) => {
  const data = req.body || {};
  const lead = data.sales_handoff_lead || data.result?.sales_handoff_lead;
  if (lead) store.addSalesHandoff(lead);
  if (Array.isArray(data.contacts)) store.setContacts(data.contacts);
  if (data.contact && data.contact.id) {
    store.updateContact(data.contact.id, current => Object.assign(current, data.contact));
  }
  if (data.engagement) store.addAuditLog({ event_type: 'Workbench Engagement Callback', contact_name: data.contact?.name || data.contact_id || 'Client', details: JSON.stringify(data.engagement), status: 'Received' });
  return res.json({ received: true, timestamp: new Date().toISOString() });
});

module.exports = router;
