'use strict';

/**
 * src/services/workbenchService.js
 *
 * Sends uploaded files to SNS Square Agent Workbench.
 *
 * Supported:
 * - JPEG / PNG / GIF images
 * - PDF
 * - CSV
 * - TXT
 *
 * Binary files are converted to Base64.
 * CSV/TXT files are sent as UTF-8 text.
 */

const fs = require('fs');
const axios = require('axios');
const store = require('../store');
const leadEngine = require('./leadEngine');

/**
 * MIME types accepted by the upload endpoint.
 */
const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/csv',
  'text/x-csv',
]);

/**
 * Read the uploaded file content.
 *
 * Supports:
 * - express-fileupload memory buffer: fileObj.data
 * - multer memory buffer: fileObj.buffer
 * - express-fileupload temp file: fileObj.tempFilePath
 * - disk path: fileObj.path
 * - direct filesystem path
 * - string data
 *
 * CSV/TXT  -> UTF-8
 * PDF/image -> Base64
 */
function readFileContent(fileObj) {
  if (!fileObj) {
    return '';
  }

  let buffer = null;

  // 1. express-fileupload memory buffer
  if (
    fileObj.data &&
    Buffer.isBuffer(fileObj.data) &&
    fileObj.data.length > 0
  ) {
    buffer = fileObj.data;
  }

  // 2. multer memory buffer
  else if (
    fileObj.buffer &&
    Buffer.isBuffer(fileObj.buffer) &&
    fileObj.buffer.length > 0
  ) {
    buffer = fileObj.buffer;
  }

  // 3. express-fileupload temp file
  else if (
    fileObj.tempFilePath &&
    fs.existsSync(fileObj.tempFilePath)
  ) {
    buffer = fs.readFileSync(
      fileObj.tempFilePath
    );
  }

  // 4. Disk-based file path
  else if (
    fileObj.path &&
    fs.existsSync(fileObj.path)
  ) {
    buffer = fs.readFileSync(
      fileObj.path
    );
  }

  // 5. Direct filesystem path string
  else if (
    typeof fileObj === 'string' &&
    fs.existsSync(fileObj)
  ) {
    buffer = fs.readFileSync(
      fileObj
    );
  }

  // 6. Already-read string
  else if (
    typeof fileObj.data === 'string'
  ) {
    return fileObj.data;
  }

  // Could not read file
  if (
    !buffer ||
    buffer.length === 0
  ) {
    console.warn(
      `[workbenchService] Warning: Could not read file content for "${fileObj?.name || 'unknown'}"`
    );

    return '';
  }

  const mime =
    (fileObj.mimetype || '')
      .toLowerCase();

  const name =
    (fileObj.name || '')
      .toLowerCase();

  // CSV / text
  if (
    mime.includes('csv') ||
    mime.includes('text') ||
    name.endsWith('.csv') ||
    name.endsWith('.txt')
  ) {
    return buffer.toString('utf-8');
  }

  // PDF / images / other binary files
  return buffer.toString('base64');
}

/**
 * Extract contacts from different possible
 * Workbench response formats.
 */
function extractContacts(data) {
  if (!data) {
    return [];
  }

  let item = data;

  // Workbench item array
  if (Array.isArray(item)) {

    // [{ contacts: [...] }]
    if (
      item.length > 0 &&
      Array.isArray(item[0].contacts)
    ) {
      return item[0].contacts;
    }

    // [{ full_name, email, ... }]
    if (
      item.length > 0 &&
      typeof item[0] === 'object' &&
      (
        item[0].full_name ||
        item[0].email ||
        item[0].name ||
        item[0].phone
      )
    ) {
      return item;
    }

    // [{ json: {...} }]
    if (
      item.length > 0 &&
      typeof item[0] === 'object'
    ) {
      item =
        item[0].json ||
        item[0].body ||
        item[0];
    } else {
      return [];
    }
  }

  // { contacts: [...] }
  if (
    Array.isArray(item.contacts)
  ) {
    return item.contacts;
  }

  // { contacts: "[...]" }
  if (
    typeof item.contacts === 'string'
  ) {
    try {
      const cleanContacts = item.contacts.replace(/^=+/, '').trim();
      const parsed =
        JSON.parse(cleanContacts);

      if (
        Array.isArray(parsed)
      ) {
        return parsed;
      }

    } catch (_) {
      // Not JSON
    }
  }

  // { data: [...] }
  if (
    Array.isArray(item.data)
  ) {
    return item.data;
  }

  // { output: { contacts: [...] } }
  if (
    item.output &&
    Array.isArray(item.output.contacts)
  ) {
    return item.output.contacts;
  }

  // Single contact object
  if (
    item.full_name ||
    item.email ||
    (item.name && !item.status)
  ) {
    return [item];
  }

  return [];
}

/**
 * Process one uploaded file through Workbench.
 */
async function processFile(
  batch_id,
  file_id,
  fileObj
) {
  try {

    // ─────────────────────────────────────────
    // 1. MARK PROCESSING
    // ─────────────────────────────────────────

    store.updateFileStatus(
      file_id,
      'processing'
    );

    // ─────────────────────────────────────────
    // 2. READ ENVIRONMENT
    // ─────────────────────────────────────────

    const webhookUrl =
      process.env.WORKBENCH_WEBHOOK_URL;

    const callbackUrl =
      process.env.BACKEND_CALLBACK_URL;

    if (
      !webhookUrl ||
      webhookUrl.includes(
        'YOUR_WORKBENCH_HOST'
      )
    ) {
      throw new Error(
        'WORKBENCH_WEBHOOK_URL is not configured in backend/.env'
      );
    }

    // ─────────────────────────────────────────
    // 3. READ FILE CONTENT
    // ─────────────────────────────────────────

    const fileContent =
      readFileContent(fileObj);

    // ─────────────────────────────────────────
    // 4. NORMALIZE MIME TYPE
    // ─────────────────────────────────────────

    let fileType =
      fileObj.mimetype ||
      'text/csv';

    if (
      fileObj.name &&
      fileObj.name
        .toLowerCase()
        .endsWith('.csv') &&
      !fileType.includes('csv')
    ) {
      fileType = 'text/csv';
    }

    // ─────────────────────────────────────────
    // 5. BUILD PAYLOAD
    // ─────────────────────────────────────────

    const payload = {
      file_id,
      batch_id,
      file_name: fileObj.name,
      file_type: fileType,

      // IMPORTANT:
      // This contains the actual file content.
      file_content: fileContent,

      source_label: 'upload',

      callback_url:
        callbackUrl || '',
    };

    // ─────────────────────────────────────────
    // 6. DIAGNOSTIC INFORMATION
    // ─────────────────────────────────────────

    const serializedPayload =
      JSON.stringify(payload);

    console.log('');
    console.log(
      '================================================'
    );
    console.log(
      '[workbenchService] OUTGOING WORKBENCH REQUEST'
    );
    console.log(
      '================================================'
    );

    console.log(
      '[workbenchService] file_id:',
      file_id
    );

    console.log(
      '[workbenchService] batch_id:',
      batch_id
    );

    console.log(
      '[workbenchService] file_name:',
      fileObj.name
    );

    console.log(
      '[workbenchService] file_type:',
      fileType
    );

    console.log(
      '[workbenchService] file_content type:',
      typeof fileContent
    );

    console.log(
      '[workbenchService] file_content length:',
      fileContent.length
    );

    console.log(
      '[workbenchService] file_content empty:',
      fileContent === ''
    );

    console.log(
      '[workbenchService] complete JSON payload length:',
      serializedPayload.length
    );

    console.log(
      '[workbenchService] payload has file_content:',
      Object.prototype.hasOwnProperty.call(
        payload,
        'file_content'
      )
    );

    console.log(
      '[workbenchService] payload file_content length:',
      String(
        payload.file_content || ''
      ).length
    );

    console.log(
      '================================================'
    );
    console.log('');

    // ─────────────────────────────────────────
    // 7. HEADERS
    // ─────────────────────────────────────────

    const headers = {
      'Content-Type':
        'application/json'
    };

    if (
      process.env.WORKBENCH_WEBHOOK_SECRET
    ) {
      headers.Authorization =
        `Bearer ${process.env.WORKBENCH_WEBHOOK_SECRET}`;
    }

    // ─────────────────────────────────────────
    // 8. SEND TO WORKBENCH
    // ─────────────────────────────────────────

    const response =
      await axios.post(
        webhookUrl,
        payload,
        {
          headers,

          // Allow large Base64 payloads.
          maxContentLength: Infinity,
          maxBodyLength: Infinity,

          // Allow up to 120 seconds
          // for Workbench / LLM processing.
          timeout: 120000,

          // Explicitly serialize JSON.
          transformRequest: [
            (data, requestHeaders) => {

              requestHeaders[
                'Content-Type'
              ] =
                'application/json';

              return JSON.stringify(data);
            }
          ]
        }
      );

    // ─────────────────────────────────────────
    // 9. WORKBENCH RESPONSE
    // ─────────────────────────────────────────

    console.log(
      `[workbenchService] ← Workbench HTTP ${response.status} for file_id=${file_id}`
    );

    console.log(
      `[workbenchService] Workbench response received for file_id=${file_id}`
    );

    // ─────────────────────────────────────────
    // 10. NORMALIZE RESPONSE
    // ─────────────────────────────────────────

    let respData =
      response.data;

    if (
      Array.isArray(respData) &&
      respData.length > 0
    ) {
      respData =
        respData[0].json ||
        respData[0].body ||
        respData[0];

    } else if (
      respData?.body
    ) {
      respData =
        respData.body;
    }

    // ─────────────────────────────────────────
    // 11. EXTRACT CONTACTS
    // ─────────────────────────────────────────

    const contacts =
      extractContacts(
        response.data
      );

    // ─────────────────────────────────────────
    // 12. STORE CONTACTS
    // ─────────────────────────────────────────

    if (contacts.length > 0) {
      const scored = leadEngine.processAndScoreList(contacts, fileObj.name || 'Upload');
      store.addContacts(file_id, scored);
      store.updateFileStatus(file_id, 'done');
      console.log(`[workbenchService] ✓ Stored ${scored.length} scored contact(s) for file_id=${file_id}`);
    } else {
      console.log(`[workbenchService] Workbench accepted execution (no sync contacts). Running local extraction engine for file_id=${file_id}...`);

      let localContacts = [];
      try {
        localContacts = await leadEngine.extractLocalContacts(fileObj, fileType);
      } catch (localErr) {
        console.warn(`[workbenchService] Local extraction warning for file_id=${file_id}:`, localErr.message);
      }

      if (localContacts && localContacts.length > 0) {
        const scored = leadEngine.processAndScoreList(localContacts, fileObj.name || 'Upload');
        store.addContacts(file_id, scored);
        store.updateFileStatus(file_id, 'done');
        console.log(`[workbenchService] ✓ Stored ${scored.length} contact(s) via local engine for file_id=${file_id}`);
      } else {
        console.log(`[workbenchService] No contacts extracted locally. Marking file_id=${file_id} status.`);
        // If no contacts could be extracted from image or document, mark as failed so UI informs user
        store.updateFileStatus(file_id, 'failed', 'No contact records could be extracted from this file. Please verify file format and clarity.');
      }
    }

  } catch (err) {
    const errorMsg =
      err.response
        ? `Workbench HTTP ${err.response.status}: ${typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data}`
        : err.message;

    console.error(
      `[workbenchService] ✗ Error for file_id=${file_id}: ${errorMsg}`
    );

    // Fallback: If Workbench fails or is offline, run local extraction engine
    try {
      console.log(`[workbenchService] Attempting local fallback extraction for file_id=${file_id}...`);
      const localContacts = await leadEngine.extractLocalContacts(fileObj, fileType);
      if (localContacts && localContacts.length > 0) {
        const scored = leadEngine.processAndScoreList(localContacts, fileObj.name || 'Upload');
        store.addContacts(file_id, scored);
        store.updateFileStatus(file_id, 'done');
        console.log(`[workbenchService] ✓ Successfully recovered ${scored.length} contact(s) via fallback engine for file_id=${file_id}`);
        return;
      }
    } catch (fallbackErr) {
      console.warn(`[workbenchService] Fallback extraction also failed:`, fallbackErr.message);
    }

    // Do NOT falsely mark as done if extraction genuinely failed
    store.updateFileStatus(
      file_id,
      'failed',
      `Extraction failed: ${errorMsg}`
    );
  }
}

module.exports = {
  processFile,
  readFileContent,
  extractContacts,
  SUPPORTED_MIME_TYPES
};
