'use strict';

/**
 * src/store.js — In-memory store (Map-based, no DB dependency)
 *
 * Batch structure:
 * {
 *   batch_id:    string,
 *   created_at:  ISO string,
 *   files: [
 *     {
 *       file_id:   string,
 *       file_name: string,
 *       file_type: string,   // MIME type
 *       status:    'queued' | 'processing' | 'done' | 'failed',
 *       error:     null | string,
 *     }
 *   ]
 * }
 *
 * Contacts structure:
 *   Map<file_id, Array<contact>>
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { deduplicateContactList } = require('./services/dedupService');

/** @type {Map<string, object>} batch_id → batch object */
const batches = new Map();

/** @type {Map<string, Array<object>>} file_id → contact array */
const contacts = new Map();

const CACHE_FILE = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'),
  '.store_cache.json'
);

function _loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.batches) {
        for (const [k, v] of Object.entries(data.batches)) {
          batches.set(k, v);
        }
      }
      if (data.contacts) {
        for (const [k, v] of Object.entries(data.contacts)) {
          contacts.set(k, v);
        }
      }
      console.log(`[store] Loaded ${batches.size} batch(es) and ${contacts.size} contact file group(s) from cache.`);
    }
  } catch (err) {
    console.warn('[store] Could not load cache:', err.message);
  }
}

function _saveCache() {
  try {
    const batchesObj = Object.fromEntries(batches);
    const contactsObj = Object.fromEntries(contacts);
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ batches: batchesObj, contacts: contactsObj }, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[store] Could not save cache:', err.message);
  }
}

_loadCache();

// ── Internal helper ────────────────────────────────────────────────────────────
/**
 * Locate a file-metadata object from ANY batch, by file_id.
 * Returns { batch, file } or null.
 */
function _findFile(file_id) {
  for (const batch of batches.values()) {
    const file = batch.files.find((f) => f.file_id === file_id);
    if (file) return { batch, file };
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a new batch in the store.
 * @param {string} batch_id
 * @param {Array<{ file_id: string, file_name: string, file_type: string }>} files
 * @returns {object} The created batch object.
 */
function createBatch(batch_id, files) {
  const batch = {
    batch_id,
    created_at: new Date().toISOString(),
    files: files.map(({ file_id, file_name, file_type }) => ({
      file_id,
      file_name,
      file_type,
      status: 'queued',
      error:  null,
    })),
  };
  batches.set(batch_id, batch);
  _saveCache();
  return batch;
}

/**
 * Retrieve a batch by ID.
 * @param {string} batch_id
 * @returns {object|undefined}
 */
function getBatch(batch_id) {
  return batches.get(batch_id);
}

/**
 * Update the status (and optional error) for a specific file.
 * @param {string} file_id
 * @param {'queued'|'processing'|'done'|'failed'} status
 * @param {string|null} [error]
 * @returns {boolean} true if the file was found and updated.
 */
function updateFileStatus(file_id, status, error = null) {
  const found = _findFile(file_id);
  if (!found) return false;
  found.file.status = status;
  found.file.error  = error;
  _saveCache();
  return true;
}

/**
 * Store extracted contacts for a given file.
 * Merges with any previously stored contacts for that file_id.
 * @param {string} file_id
 * @param {Array<object>} newContacts
 */
function addContacts(file_id, newContacts) {
  const existing = contacts.get(file_id) || [];
  const combined = [...existing, ...newContacts].map((raw) => {
    const c = { ...raw };
    if (!c.id) c.id = uuidv4();
    if (!c.status) c.status = 'New';
    return c;
  });
  const deduped = deduplicateContactList(combined);
  contacts.set(file_id, deduped);
  _saveCache();
}

/**
 * Update a contact's CRM status (New, Contacted, Follow-up) by its ID.
 * @param {string} contactId
 * @param {'New'|'Contacted'|'Follow-up'} newStatus
 * @returns {object|null}
 */
function updateContactStatus(contactId, newStatus) {
  for (const list of contacts.values()) {
    const target = list.find((c) => c.id === contactId);
    if (target) {
      target.status = newStatus;
      target.updated_at = new Date().toISOString();
      _saveCache();
      return target;
    }
  }
  return null;
}

/**
 * Return all contacts across every file, as a flat array.
 * Each contact is augmented with its source file_id.
 * @returns {Array<object>}
 */
function getAllContacts() {
  const result = [];
  for (const [file_id, fileContacts] of contacts.entries()) {
    for (const contact of fileContacts) {
      result.push({ ...contact, _file_id: file_id });
    }
  }
  return deduplicateContactList(result);
}

/**
 * Return all contacts for every file that belongs to a given batch.
 * @param {string} batch_id
 * @returns {Array<object>}
 */
function getContactsByBatch(batch_id) {
  const batch = batches.get(batch_id);
  if (!batch) return [];

  const result = [];
  for (const { file_id } of batch.files) {
    const fileContacts = contacts.get(file_id) || [];
    for (const contact of fileContacts) {
      result.push({ ...contact, _file_id: file_id });
    }
  }
  return result;
}

/**
 * Find a file's metadata (and its parent batch) by file_id.
 * @param {string} file_id
 * @returns {{ batch: object, file: object }|null}
 */
function findFile(file_id) {
  return _findFile(file_id);
}

module.exports = {
  batches,
  contacts,
  createBatch,
  getBatch,
  updateFileStatus,
  addContacts,
  updateContactStatus,
  getAllContacts,
  getContactsByBatch,
  findFile,
};

