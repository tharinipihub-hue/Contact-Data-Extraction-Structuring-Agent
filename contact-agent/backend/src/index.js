'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

// ── Routes ────────────────────────────────────────────────────────────────────

const uploadRoutes = require('./routes/upload');
const statusRoutes = require('./routes/status');
const contactRoutes = require('./routes/contacts');
const nurtureContactsRoutes = require('./routes/nurtureContacts');
const webhookRoutes = require('./routes/webhook');
const retryRoutes = require('./routes/retry');
const filesRoutes = require('./routes/files');
const campaignsRoutes = require('./routes/campaigns');
const salesRoutes = require('./routes/sales');
const nurtureWebhookRoutes = require('./routes/nurtureWebhook');
const nurtureStore = require('./services/nurtureStore');
const { renderPreferencePage } = require('./views/preferencesView');

// ── App setup ─────────────────────────────────────────────────────────────────

const app = express();

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

// Ensure upload directory exists
const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || './uploads'
);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

// CORS — allow all origins in development
app.use(cors());

// HTTP request logger
app.use(morgan('dev'));

// JSON body parser
app.use(express.json());

// URL-encoded body parser
app.use(
  express.urlencoded({
    extended: true
  })
);

// Multipart file upload middleware
const MAX_FILE_SIZE_MB = parseInt(
  process.env.MAX_FILE_SIZE_MB || '20',
  10
);

app.use(
  fileUpload({
    limits: {
      fileSize:
        MAX_FILE_SIZE_MB * 1024 * 1024
    },

    abortOnLimit: true,

    // Keep uploaded files in memory.
    // The uploaded file is available as file.data.
    useTempFiles: false,

    debug: false
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use(
  '/upload',
  uploadRoutes
);

app.use(
  '/status',
  statusRoutes
);

app.use('/contacts', contactRoutes);


// Nurturing contacts share the legacy /api/contacts shape without changing
// the existing extraction CRM responses. The nurturing view calls /api.
app.use('/api/contacts', nurtureContactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/webhook', nurtureWebhookRoutes);
app.get(['/preferences', '/unsubscribe'], (req, res) => {
  const key = req.query.id || req.query.contact_id || req.query.email;
  const contact = key ? (nurtureStore.getContactById(key) || nurtureStore.getContacts().find(c => String(c.email || '').toLowerCase() === String(key).toLowerCase())) : null;
  const isUnsubscribe = req.path === '/unsubscribe';
  if (isUnsubscribe && contact) {
    const result = nurtureStore.updateContactPreferences(contact.id, { opt_in: false, reason: 'One-click unsubscribe link' });
    if (result) nurtureStore.addAuditLog({ event_type: 'Client Opt-Out (Unsubscribe)', contact_name: `${contact.name} (${contact.company})`, details: 'Client opted out using the deployed unsubscribe link.', status: 'Opted Out' });
  }
  res.type('html').send(renderPreferencePage(contact, isUnsubscribe));
});

app.use(
  '/webhook',
  webhookRoutes
);

app.use(
  '/retry',
  retryRoutes
);

// Public uploaded-file endpoint.
// Example:
// GET /files/<file_id>
//
// This is used by Mistral OCR to access the actual
// uploaded business-card image through the ngrok URL.
app.use(
  '/files',
  filesRoutes
);

// ── Health-check ──────────────────────────────────────────────────────────────

app.get(
  '/health',
  (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }
);

// ── Serve Production React Frontend Build ────────────────────────────────────

const frontendBuildPath = path.resolve(__dirname, '../../frontend/build');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/contacts') ||
      req.path.startsWith('/files') ||
      req.path.startsWith('/status') ||
      req.path.startsWith('/upload') ||
      req.path.startsWith('/webhook') ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/retry') ||
      req.path.startsWith('/health')
      || req.path === '/preferences'
      || req.path === '/unsubscribe'
    ) {
      return next();
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use(
  (_req, res) => {
    res.status(404).json({
      error: 'Not found'
    });
  }
);

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use(
  (err, _req, res, _next) => {
    console.error(
      '[GlobalError]',
      err
    );

    const status =
      err.status ||
      err.statusCode ||
      500;

    const message =
      err.message ||
      'Internal server error';

    res.status(status).json({
      error: message
    });
  }
);

// ── Start server ──────────────────────────────────────────────────────────────

const server = app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `[server] Contact Agent backend listening on ${HOST}:${PORT}`
    );

    console.log(
      `[server] Upload directory      : ${UPLOAD_DIR}`
    );
  }
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = (signal) => {
  console.log(
    `\n[server] Received ${signal}. Shutting down gracefully…`
  );

  server.close(() => {
    console.log(
      '[server] HTTP server closed. Exiting.'
    );

    process.exit(0);
  });

  // Force exit after 10 seconds if still pending
  setTimeout(() => {
    console.error(
      '[server] Force exiting after timeout.'
    );

    process.exit(1);
  }, 10_000).unref();
};

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);

module.exports = app;
