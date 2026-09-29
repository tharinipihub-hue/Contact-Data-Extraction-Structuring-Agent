'use strict';

/**
 * src/routes/status.js
 *
 * GET /status/:batch_id
 * Returns the current processing status of every file in a batch.
 */

const express = require('express');
const store   = require('../store');

const router = express.Router();

// ── GET /status/:batch_id ─────────────────────────────────────────────────────
router.get('/:batch_id', (req, res) => {
  const { batch_id } = req.params;

  const batch = store.getBatch(batch_id);
  if (!batch) {
    return res.status(404).json({ error: `Batch '${batch_id}' not found.` });
  }

  // Tally counts by status
  const counts = { done: 0, failed: 0, processing: 0, queued: 0 };
  for (const file of batch.files) {
    if (counts[file.status] !== undefined) {
      counts[file.status]++;
    }
  }

  return res.json({
    batch_id:          batch.batch_id,
    created_at:        batch.created_at,
    total_files:       batch.files.length,
    done_count:        counts.done,
    failed_count:      counts.failed,
    processing_count:  counts.processing,
    queued_count:      counts.queued,
    files: batch.files.map(({ file_id, file_name, file_type, status, error }) => ({
      file_id,
      file_name,
      file_type,
      status,
      error,
    })),
  });
});

module.exports = router;
