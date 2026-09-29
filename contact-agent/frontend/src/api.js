import axios from 'axios';
import { API_BASE } from './config';

/**
 * Upload one or more files for contact extraction.
 * @param {FormData} formData - FormData containing file(s) under the key "files"
 */
export const uploadFiles = (formData) =>
  axios.post(`${API_BASE}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * Poll the processing status of a batch.
 * @param {string} batchId
 */
export const getBatchStatus = (batchId) =>
  axios.get(`${API_BASE}/status/${batchId}`);

/**
 * Retry a failed file within a batch.
 * @param {string} fileId
 */
export const retryFile = (fileId) =>
  axios.post(`${API_BASE}/retry/${fileId}`);

/**
 * Retrieve extracted contacts, optionally filtered by batch.
 * @param {string|null} batchId - Optional batch ID to filter results
 */
export const getContacts = (batchId) =>
  axios.get(`${API_BASE}/contacts`, {
    params: batchId ? { batch_id: batchId } : {},
  });

/**
 * Update a lead's CRM status (New, Contacted, Follow-up).
 * @param {string} contactId
 * @param {'New'|'Contacted'|'Follow-up'} status
 */
export const updateContactStatus = (contactId, status) =>
  axios.patch(`${API_BASE}/contacts/${contactId}/status`, { status });

/**
 * Create a new lead manually.
 * @param {object} contactData
 */
export const createContact = (contactData) =>
  axios.post(`${API_BASE}/contacts`, contactData);

