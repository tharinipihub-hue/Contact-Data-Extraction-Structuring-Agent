'use strict';

const express = require('express');
const router = express.Router();
const store = require('../services/nurtureStore');

// Get all hot leads handed off to sales
router.get('/handoffs', (req, res) => {
  res.json({
    success: true,
    count: store.getSalesHandoffs().length,
    handoffs: store.getSalesHandoffs()
  });
});

// Update sales lead status / assignment
router.post('/update', (req, res) => {
  const { lead_id, assigned_rep, status, notes } = req.body;
  const lead = store.updateSalesHandoff(lead_id, { assigned_rep, status, notes });
  if (lead) {
    return res.json({ success: true, lead });
  }
  res.status(404).json({ success: false, error: 'Lead not found' });
});

module.exports = router;
