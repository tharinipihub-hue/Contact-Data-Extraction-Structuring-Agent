'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const store = require('../store');

const router = express.Router();

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || './uploads'
);

router.get('/poster/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, 'posters', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Poster not found');
    }
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).send('Unable to serve poster');
  }
});

router.get('/:file_id', (req, res) => {
  try {
    const { file_id } = req.params;

    const found = store.findFile(file_id);

    if (!found) {
      return res.status(404).json({
        error: 'File not found'
      });
    }

    const { file } = found;

    const extension = path.extname(
      file.file_name || ''
    );

    const storedFileName = `${file_id}${extension}`;

    const filePath = path.join(
      UPLOAD_DIR,
      storedFileName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Stored file not found'
      });
    }

    res.setHeader(
      'Content-Type',
      file.file_type || 'application/octet-stream'
    );

    return res.sendFile(filePath);

  } catch (err) {
    console.error('[files] Error serving file:', err);

    return res.status(500).json({
      error: 'Unable to serve file'
    });
  }
});

module.exports = router;
