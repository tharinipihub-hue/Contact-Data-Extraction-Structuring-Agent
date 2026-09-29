'use strict';

/**
 * src/routes/upload.js
 *
 * POST /upload
 * Accepts one or more files, saves them locally, creates a batch,
 * and dispatches each file to the Workbench asynchronously.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const {
  processFile,
  SUPPORTED_MIME_TYPES
} = require('../services/workbenchService');

const router = express.Router();

// ── Upload directory ──────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || './uploads'
);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}

// ── POST /upload ──────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  try {
    // express-fileupload puts uploaded files on req.files
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        error: 'No files were uploaded.'
      });
    }

    // Normalise: accept field name 'files', 'file',
    // or any other single field.
    let rawFiles = [];

    for (const fieldName of Object.keys(req.files)) {
      const field = req.files[fieldName];

      if (Array.isArray(field)) {
        rawFiles = rawFiles.concat(field);
      } else {
        rawFiles.push(field);
      }
    }

    if (rawFiles.length === 0) {
      return res.status(400).json({
        error: 'No files were uploaded.'
      });
    }

    // ── Normalise CSV MIME types ─────────────────────────────────────────────

    for (const f of rawFiles) {
      if (
        f.name &&
        f.name.toLowerCase().endsWith('.csv') &&
        (!f.mimetype || !f.mimetype.includes('csv'))
      ) {
        f.mimetype = 'text/csv';
      }
    }

    // ── Validate MIME types ──────────────────────────────────────────────────

    const rejected = rawFiles.filter(
      (f) => !SUPPORTED_MIME_TYPES.has(f.mimetype)
    );

    if (rejected.length > 0) {
      return res.status(415).json({
        error: 'Unsupported file type(s).',

        rejected: rejected.map((f) => ({
          file_name: f.name,
          file_type: f.mimetype
        })),

        supported_types: [
          ...SUPPORTED_MIME_TYPES
        ]
      });
    }

    // ── Create batch ─────────────────────────────────────────────────────────

    const batch_id = uuidv4();

    const fileMeta = rawFiles.map((f) => ({
      file_id: uuidv4(),
      file_name: f.name,
      file_type: f.mimetype
    }));

    store.createBatch(
      batch_id,
      fileMeta
    );

    // ── Save files locally + send to Workbench ───────────────────────────────

    rawFiles.forEach((fileObj, idx) => {
      const { file_id } = fileMeta[idx];

      // Save the original uploaded file locally.
      try {
        const extension = path.extname(
          fileObj.name || ''
        );

        const storedFileName =
          `${file_id}${extension}`;

        const storedFilePath =
          path.join(
            UPLOAD_DIR,
            storedFileName
          );

        fs.writeFileSync(
          storedFilePath,
          fileObj.data
        );

        console.log(
          `[upload] Saved file: ${storedFilePath}`
        );

      } catch (err) {
        console.error(
          `[upload] Failed to save file_id=${file_id}:`,
          err
        );
      }

      // Send the file to Workbench asynchronously.
      processFile(
        batch_id,
        file_id,
        fileObj
      ).catch((err) => {
        console.error(
          `[upload] Unexpected error for file_id=${file_id}:`,
          err
        );
      });
    });

    // ── Respond immediately ──────────────────────────────────────────────────

    return res.status(202).json({
      batch_id,

      total_files: fileMeta.length,

      files: fileMeta.map(
        ({ file_id, file_name }) => ({
          file_id,
          file_name,
          status: 'queued'
        })
      )
    });

  } catch (err) {
    console.error(
      '[upload] Unexpected error:',
      err
    );

    return res.status(500).json({
      error: 'Internal server error during upload.'
    });
  }
});

module.exports = router;