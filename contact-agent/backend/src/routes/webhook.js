'use strict';

/**
 * src/routes/webhook.js
 *
 * POST /webhook/workbench-callback
 *
 * Flexible Callback handler for SNS Square Agent Workbench.
 * Accepts callback payloads in any structure sent by Workbench nodes.
 */

const express = require('express');
const store   = require('../store');

const router = express.Router();

router.post('/workbench-callback', (req, res) => {
  try {
    console.log('[webhook] Received callback from Workbench:', JSON.stringify(req.body));

    let data = req.body;
    if (Array.isArray(data) && data.length > 0) {
      data = data[0].json || data[0].body || data[0];
    } else if (data.body) {
      data = data.body;
    }

    const file_id = data.file_id;
    const status  = data.status || 'done';
    let contacts  = data.contacts || data.data || [];
    const error   = data.error || null;

    if (!Array.isArray(contacts) && typeof contacts === 'object') {
      contacts = [contacts];
    }

    if (!file_id || typeof file_id !== 'string') {
      console.warn('[webhook] Callback missing string `file_id`. Data:', data);
      return res.status(200).json({ ok: true, warning: 'file_id missing' });
    }

    const found = store.findFile(file_id);
    if (!found) {
      console.warn(`[webhook] Received callback for unknown file_id=${file_id}. Ignoring.`);
      return res.json({ ok: true, warning: 'file_id not recognised' });
    }

    const errorMsg = (status === 'failed' && error) ? String(error) : null;
    store.updateFileStatus(file_id, status, errorMsg);

    if (Array.isArray(contacts) && contacts.length > 0) {
      store.addContacts(file_id, contacts);
      console.log(`[webhook] Stored ${contacts.length} contact(s) from Workbench for file_id=${file_id}.`);
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error('[webhook] Error handling workbench callback:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
