'use strict';

/**
 * src/routes/retry.js
 *
 * POST /retry/:file_id
 * Re-triggers processing for a file that has previously failed.
 */

const express  = require('express');
const store    = require('../store');
const { processFile } = require('../services/workbenchService');

const router = express.Router();

// ── POST /retry/:file_id ──────────────────────────────────────────────────────
router.post('/:file_id', (req, res) => {
  const { file_id } = req.params;

  // ── Look up file across all batches ──────────────────────────────────────
  const found = store.findFile(file_id);
  if (!found) {
    return res.status(404).json({ error: `File '${file_id}' not found.` });
  }

  const { batch, file } = found;

  // ── Only retry failed files ───────────────────────────────────────────────
  if (file.status !== 'failed') {
    return res.status(400).json({
      error:   'Only failed files can be retried.',
      file_id,
      current_status: file.status,
    });
  }

  // ── Reset to queued ───────────────────────────────────────────────────────
  store.updateFileStatus(file_id, 'queued', null);

  // ── Re-build a minimal fileObj that processFile can use ───────────────────
  // NOTE: We do not have the original file buffer in memory after the first
  // attempt (express-fileupload holds it only during the request lifetime).
  // The workbench callback / retry mechanism should be driven by the
  // workbench re-triggering the callback, OR the client re-uploads the file.
  //
  // For cases where the failure was a network/config error (not a bad file),
  // we forward the same metadata so the workbench can look it up by file_id.
  // In production you would persist the buffer or a signed URL; here we
  // signal the workbench with an empty buffer and the original metadata.
  const syntheticFileObj = {
    name:     file.file_name,
    mimetype: file.file_type,
    data:     Buffer.alloc(0), // empty — workbench should use stored file_id
  };

  console.log(
    `[retry] Re-triggering file_id=${file_id} in batch_id=${batch.batch_id}`
  );

  // Fire-and-forget
  processFile(batch.batch_id, file_id, syntheticFileObj).catch((err) => {
    console.error(`[retry] Unexpected error for file_id=${file_id}:`, err);
  });

  return res.json({
    file_id,
    status:  'queued',
    message: 'Retry triggered.',
  });
});

module.exports = router;
