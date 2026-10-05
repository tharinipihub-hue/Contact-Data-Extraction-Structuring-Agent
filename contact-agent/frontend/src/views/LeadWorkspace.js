import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  UploadCloud,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';
import { uploadFiles, getBatchStatus, retryFile, getContacts, updateContactStatus } from '../api';
import { POLL_INTERVAL_MS, GOOGLE_SHEETS_URL } from '../config';
import { deduplicateContactList } from '../utils/dedup';

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.jpg', '.jpeg', '.png', '.gif'];
const GOOGLE_SHEETS_CSV_DIRECT =
  'https://docs.google.com/spreadsheets/d/1AZqaSfoyhcjQOLif1xZfeGi9rfMWHwKDRJUaYuArJVE/gviz/tq?tqx=out:csv';

function getInitials(name) {
  if (!name || name === 'Missing') return 'L';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatValue(val) {
  if (!val || val === 'null' || val === 'undefined') return 'Missing';
  const str = String(val).trim();
  return str.length > 0 ? str : 'Missing';
}

/**
 * Standardized tier evaluator for Google Sheets contacts
 */
export function getLeadTier(lead) {
  const company = (lead.company || '').toLowerCase();
  const designation = (lead.designation || '').toLowerCase();
  const industry = (lead.sector_industry || '').toLowerCase();

  // AI-based companies / roles are strictly classified as Cold to avoid competitor conflict
  const isEducationOrTrust = /college|university|institution|institute|school|trust|academy|sns|hospital/i.test(company);
  const aiRegex = /\b(ai|artificial intelligence|generative ai|genai|llm|machine learning|deep learning|agentic ai)\b/i;
  if (!isEducationOrTrust && (
    aiRegex.test(company) ||
    aiRegex.test(designation) ||
    aiRegex.test(industry) ||
    /\b(head of ai|ai lead|ai architect|data & ai|director - ai|vp - ai|ai engineering|ai solutions)\b/i.test(designation) ||
    /\b(ai vendor|ai competitor|ai solutions|ai engineering|data science & ai)\b/i.test(industry) ||
    /\b(ai solutions|ai platform|ai consulting|ai products)\b/i.test(company)
  )) {
    return 'Cold';
  }

  // Non-decision maker cap: interns, students, trainees, clerks are strictly Cold
  if (/\b(intern|internship|student|trainee|apprentice|peon|attendant)\b/i.test(designation)) {
    return 'Cold';
  }

  const s = Number(lead.lead_score) || 0;
  const isApexOrSenior = /\b(trustee|chairman|chairperson|correspondent|director|chancellor|principal|dean|president|founder|co-founder|chief|ceo|cto|cfo|coo|cro|owner|partner|vice president|vp|head of|head|provost|controller|minister|commissioner|secretary)\b/i.test(designation) &&
    !/\b(personal secretary|executive secretary|private secretary|product owner|process owner|business owner|principal engineer|principal architect|principal consultant)\b/i.test(designation);

  const t = (lead.lead_tier || '').toLowerCase().trim();

  // If marked Hot, only allow if Apex or Senior Leadership, otherwise capped at Warm
  if (t === 'hot' || t === 'high priority') {
    return isApexOrSenior ? 'Hot' : 'Warm';
  }
  if (t === 'warm' || t === 'medium priority') return 'Warm';
  if (t === 'cold' || t === 'low priority') return 'Cold';

  if (s >= 70 && isApexOrSenior) return 'Hot';
  if (s >= 40) return 'Warm';
  return 'Cold';
}

/**
 * Direct client-side Google Sheets CSV parser fallback
 */
export async function fetchDirectFromGoogleSheets() {
  try {
    const resp = await axios.get(GOOGLE_SHEETS_CSV_DIRECT, { timeout: 8000 });
    const csvText = resp.data;
    if (!csvText || typeof csvText !== 'string') return [];

    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      const next = csvText[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cell);
        cell = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        row.push(cell);
        if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
          rows.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += c;
      }
    }
    if (cell !== '' || row.length > 0) {
      row.push(cell);
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
        rows.push(row);
      }
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.trim());
    const list = [];

    for (let r = 1; r < rows.length; r++) {
      const rowCells = rows[r];
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = (rowCells[idx] || '').trim();
      });

      const name = item['Full Name'] || `${item['First Name'] || ''} ${item['Last Name'] || ''}`.trim() || 'Missing';
      if (name === 'Missing' && !item['Company'] && !item['Email']) continue;

      let score = parseInt(item['Lead Score'], 10);
      let tier = (item['Lead Tier'] || '').trim();
      if (isNaN(score)) {
        score = tier.toLowerCase() === 'hot' ? 85 : tier.toLowerCase() === 'warm' ? 55 : 30;
      }
      if (!tier) {
        tier = score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cold';
      }

      list.push({
        id: `sheet_lead_${r}_${name.replace(/[^a-zA-Z0-9]/g, '')}`,
        full_name: name,
        first_name: item['First Name'] || 'Missing',
        last_name: item['Last Name'] || 'Missing',
        designation: item['Designation'] || item['Job Title'] || 'Missing',
        company: item['Company'] || 'Missing',
        email: item['Email'] || 'Missing',
        phone: item['Phone'] || 'Missing',
        address: item['Address'] || 'Missing',
        city: item['City'] || 'Missing',
        state: item['State'] || 'Missing',
        country: item['Country'] || 'Missing',
        sector_industry: item['Sector/Industry'] || item['Sector/Industry    '] || 'Missing',
        linkedin_url: item['LinkedIn'] || 'Missing',
        website: item['Website'] || 'Missing',
        source: item['Source'] || 'Google Sheets',
        uploaded_at: item['Uploaded At'] || '',
        validation_status: item['Validation Status'] || item['Validation Status  '] || 'Valid',
        duplicate_status: item['Duplicate Status'] || 'UNIQUE',
        lead_status: item['Lead Status'] || 'New',
        status: item['Lead Status'] || 'New',
        lead_score: score,
        lead_tier: tier,
        scoring_rationale: item['Scoring Rationale'] || '',
        sales_summary: item['Sales Summary'] || '',
      });
    }

    const deduped = deduplicateContactList(list);
    deduped._rawCount = list.length;
    deduped._duplicatesRemoved = Math.max(0, list.length - deduped.length);
    return deduped;
  } catch (err) {
    console.warn('[LeadWorkspace] Direct Google Sheets fetch error:', err.message);
    return [];
  }
}

function LeadWorkspace({ onSwitchToDemo }) {
  // Leads state
  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters & Search
  const [filterChip, setFilterChip] = useState('All'); // 'All' | 'Hot' | 'Warm' | 'Cold'
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Strip state: 'idle' | 'uploading' | 'processing' | 'done' | 'failed'
  const [uploadState, setUploadState] = useState('idle');
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [currentFileId, setCurrentFileId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [addedCount, setAddedCount] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // ── Fetch Leads (Google Sheets Synchronized) ─────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);

    // 1. Try Backend API (fetches live Google Sheets)
    try {
      const res = await getContacts();
      const list = Array.isArray(res.data) ? res.data : res.data?.contacts || [];
      if (list && list.length > 0) {
        console.log('[LeadWorkspace] Fetched live Google Sheets leads via backend:', list.length);
        setLeads(deduplicateContactList(list));
        setLoadingLeads(false);
        return;
      }
    } catch (err) {
      console.warn('[LeadWorkspace] Backend fetch failed, trying direct Google Sheets export...', err.message);
    }

    // 2. Client-side direct Google Sheets fallback
    try {
      const directList = await fetchDirectFromGoogleSheets();
      if (directList && directList.length > 0) {
        console.log('[LeadWorkspace] Fetched leads directly from Google Sheets:', directList.length);
        setLeads(deduplicateContactList(directList));
      }
    } catch (sheetErr) {
      console.error('[LeadWorkspace] Direct Google Sheets fallback failed:', sheetErr);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Batch Polling ────────────────────────────────────────────────────────────
  const pollStatus = useCallback(
    async (batchId) => {
      try {
        const { data } = await getBatchStatus(batchId);
        const files = data.files || [];
        if (files.length === 0) return;

        const file = files[0];
        setCurrentFileId(file.file_id || file.id);

        if (file.status === 'done') {
          clearInterval(pollIntervalRef.current);
          setUploadState('done');
          setAddedCount(file.contacts_count || files.length);
          // Wait 1.5s for Google Sheets append to commit, then re-fetch
          setTimeout(() => {
            fetchLeads();
          }, 1500);
        } else if (file.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setUploadState('failed');
          setUploadError(file.error || 'Extraction processing failed.');
        } else {
          setUploadState('processing');
        }
      } catch (err) {
        console.error('Status poll error:', err);
      }
    },
    [fetchLeads]
  );

  // ── File Selection & Upload ──────────────────────────────────────────────────
  const handleFile = async (file) => {
    setUploadError(null);
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`File exceeds maximum allowed size of 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError('Unsupported file format. Please upload a PDF, CSV, JPEG, PNG, or GIF file.');
      return;
    }

    setUploadState('uploading');
    const formData = new FormData();
    formData.append('files', file);

    try {
      const { data } = await uploadFiles(formData);
      const batchId = data.batch_id || data.batchId || data.id;
      if (!batchId) throw new Error('No batch ID returned from server.');

      setCurrentBatchId(batchId);
      setUploadState('processing');

      clearInterval(pollIntervalRef.current);
      pollStatus(batchId);
      pollIntervalRef.current = setInterval(() => pollStatus(batchId), POLL_INTERVAL_MS);
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Upload failed. Please try again.';
      setUploadError(msg);
      setUploadState('idle');
    }
  };

  const handleRetry = async () => {
    if (!currentFileId) return;
    setUploadError(null);
    setUploadState('processing');
    try {
      await retryFile(currentFileId);
      if (currentBatchId) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = setInterval(() => pollStatus(currentBatchId), POLL_INTERVAL_MS);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Retry failed.';
      setUploadError(msg);
      setUploadState('failed');
    }
  };

  const handleResetUpload = () => {
    setUploadState('idle');
    setUploadError(null);
    setCurrentBatchId(null);
    setCurrentFileId(null);
    setAddedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // ── CRM Status Update ────────────────────────────────────────────────────────
  const handleStatusChange = async (contactId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === contactId ? { ...l, status: newStatus, lead_status: newStatus } : l))
    );
    try {
      await updateContactStatus(contactId, newStatus);
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
  };

  // ── Metrics Calculation (Google Sheets Synchronized) ─────────────────────────
  const totalLeads = leads.length;
  const hotCount = leads.filter((l) => getLeadTier(l) === 'Hot').length;
  const warmCount = leads.filter((l) => getLeadTier(l) === 'Warm').length;
  const coldCount = leads.filter((l) => getLeadTier(l) === 'Cold').length;

  // ── Filtered & Sorted Leads ──────────────────────────────────────────────────
  const filteredLeads = leads
    .filter((l) => {
      if (filterChip === 'All') return true;
      return getLeadTier(l) === filterChip;
    })
    .filter((l) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (l.full_name || '').toLowerCase();
      const company = (l.company || '').toLowerCase();
      const title = (l.designation || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const phone = (l.phone || '').toLowerCase();
      return name.includes(q) || company.includes(q) || title.includes(q) || email.includes(q) || phone.includes(q);
    })
    .sort((a, b) => (Number(b.lead_score) || 0) - (Number(a.lead_score) || 0));

  return (
    <div className="crm-workspace">
      {/* ── Header ── */}
      <header className="crm-header">
        <div className="crm-header-titles">
          <h1 className="crm-title">Contact Extraction Agent</h1>
          <p className="crm-subtitle">Google Sheets Synchronized Lead Workspace</p>
        </div>
        <div className="crm-header-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            onClick={fetchLeads}
            title="Refresh Leads live from Google Sheets"
          >
            <RefreshCw size={13} style={{ marginRight: 6 }} className={loadingLeads ? 'crm-spin' : ''} />
            Refresh Leads
          </button>
          <a
            href={GOOGLE_SHEETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="crm-btn crm-btn-secondary"
          >
            Open in Google Sheets
            <ExternalLink size={13} style={{ marginLeft: 6 }} />
          </a>
          {onSwitchToDemo && (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={onSwitchToDemo}
              style={{ background: '#19273c', borderColor: '#19273c' }}
              title="Preview the Zoho CRM Enterprise Layout Demo"
            >
              Preview Zoho CRM Layout &rarr;
            </button>
          )}
        </div>
      </header>

      {/* ── Upload Strip ── */}
      <section className="crm-upload-container">
        {uploadError && (
          <div className="crm-inline-error" style={{ marginBottom: 10 }}>
            <AlertCircle size={15} color="#b91c1c" />
            <span>{uploadError}</span>
            <button className="crm-close-btn" onClick={() => setUploadError(null)}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* ── Active Status Banners ── */}
        {uploadState === 'uploading' && (
          <div className="crm-status-strip" style={{ marginBottom: 10 }}>
            <Loader2 size={16} className="crm-spin text-blue" />
            <span className="crm-status-label">Uploading file to server...</span>
          </div>
        )}

        {uploadState === 'processing' && (
          <div className="crm-status-strip" style={{ marginBottom: 10 }}>
            <Loader2 size={16} className="crm-spin text-blue" />
            <span className="crm-status-label">
              Extracting contacts and appending to Google Sheets (checking status every 3s)...
            </span>
          </div>
        )}

        {uploadState === 'done' && (
          <div className="crm-status-strip crm-status-done" style={{ marginBottom: 10 }}>
            <div className="crm-status-info">
              <CheckCircle2 size={16} color="#15803d" />
              <span>
                Processing complete. Contacts extracted and synchronized to Google Sheets.
              </span>
            </div>
            <button className="crm-close-btn" onClick={handleResetUpload} title="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        )}

        {uploadState === 'failed' && (
          <div className="crm-status-strip crm-status-failed" style={{ marginBottom: 10 }}>
            <div className="crm-status-info">
              <AlertCircle size={16} color="#b91c1c" />
              <span>Processing failed. {uploadError || 'An error occurred.'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="crm-btn crm-btn-sm crm-btn-primary" onClick={handleRetry}>
                <RefreshCw size={12} style={{ marginRight: 4 }} /> Retry
              </button>
              <button className="crm-btn crm-btn-sm crm-btn-secondary" onClick={handleResetUpload}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Always-Active Drop Strip ── */}
        <div
          className={`crm-upload-strip ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.csv,.jpg,.jpeg,.png,.gif"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <div className="crm-upload-left">
            <UploadCloud size={22} color="#2563eb" className="crm-upload-icon" />
            <div className="crm-upload-info">
              <span className="crm-upload-title">Drop PDF, CSV, or Business Card Image here</span>
              <span className="crm-upload-subtitle">Supports PDF, CSV, JPG, PNG, GIF &bull; Max 20 MB</span>
            </div>
          </div>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
              }
            }}
          >
            <UploadCloud size={15} style={{ marginRight: 6 }} />
            Upload File
          </button>
        </div>
      </section>

      {/* ── Summary Metric Cards (4 Across: Total Leads, Hot, Warm, Cold) ── */}
      <section className="crm-summary-grid">
        <div
          className={`crm-summary-card ${filterChip === 'All' ? 'card-selected' : ''}`}
          onClick={() => setFilterChip('All')}
        >
          <div className="crm-card-label">Total Leads</div>
          <div className="crm-card-val">{totalLeads}</div>
        </div>

        <div
          className={`crm-summary-card crm-card-hot ${filterChip === 'Hot' ? 'card-selected' : ''}`}
          onClick={() => setFilterChip('Hot')}
        >
          <div className="crm-card-label">Hot</div>
          <div className="crm-card-val text-hot">{hotCount}</div>
        </div>

        <div
          className={`crm-summary-card crm-card-warm ${filterChip === 'Warm' ? 'card-selected' : ''}`}
          onClick={() => setFilterChip('Warm')}
        >
          <div className="crm-card-label">Warm</div>
          <div className="crm-card-val text-warm">{warmCount}</div>
        </div>

        <div
          className={`crm-summary-card crm-card-cold ${filterChip === 'Cold' ? 'card-selected' : ''}`}
          onClick={() => setFilterChip('Cold')}
        >
          <div className="crm-card-label">Cold</div>
          <div className="crm-card-val text-cold">{coldCount}</div>
        </div>
      </section>

      {/* ── Filter Chips & Search Bar ── */}
      <section className="crm-filter-bar">
        <div className="crm-chips-group">
          {['All', 'Hot', 'Warm', 'Cold'].map((chip) => (
            <button
              key={chip}
              className={`crm-chip ${filterChip === chip ? 'chip-active' : ''}`}
              onClick={() => setFilterChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="crm-search-wrap">
          <Search size={14} className="crm-search-icon" />
          <input
            type="text"
            className="crm-search-input"
            placeholder="Search by name, company, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="crm-search-clear" onClick={() => setSearchQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </section>

      {/* ── Leads Feed / Content ── */}
      <section className="crm-feed-container">
        {loadingLeads && leads.length === 0 ? (
          <div className="crm-empty-state">
            <Loader2 size={32} className="crm-spin text-blue" style={{ marginBottom: 12 }} />
            <h3 className="crm-empty-title">Loading leads from Google Sheets...</h3>
            <p className="crm-empty-subtitle">Synchronizing live contact rows and scoring data.</p>
          </div>
        ) : leads.length === 0 ? (
          /* Empty State: No files uploaded yet */
          <div
            className="crm-empty-state crm-empty-actionable"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{ cursor: 'pointer' }}
          >
            <div className="crm-empty-icon-box">
              <UploadCloud size={32} color="#2563eb" />
            </div>
            <h3 className="crm-empty-title">Upload your first contact file</h3>
            <p className="crm-empty-subtitle">
              Drop a PDF, CSV, or Business Card image here to automatically extract, score, and organize your leads.
            </p>
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              style={{ marginTop: 16 }}
              onClick={(e) => {
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
            >
              <UploadCloud size={15} style={{ marginRight: 6 }} />
              Upload a File
            </button>
          </div>
        ) : filteredLeads.length === 0 ? (
          /* No Search/Filter Results */
          <div className="crm-empty-state">
            <Search size={28} color="#94a3b8" style={{ marginBottom: 10 }} />
            <h3 className="crm-empty-title">No matching leads</h3>
            <p className="crm-empty-subtitle">
              No contacts match your current filter or search criteria.
            </p>
            <button
              className="crm-btn crm-btn-secondary crm-btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => {
                setFilterChip('All');
                setSearchQuery('');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Lead Cards */
          filteredLeads.map((lead, idx) => {
            const id = lead.id || lead._file_id || idx;
            const isExpanded = expandedId === id;
            const score = Number(lead.lead_score) || 0;
            const tier = getLeadTier(lead);
            const badgeClass =
              tier === 'Hot'
                ? 'badge-hot'
                : tier === 'Warm'
                ? 'badge-warm'
                : 'badge-cold';

            const fullName = formatValue(lead.full_name);
            const designation = formatValue(lead.designation);
            const company = formatValue(lead.company);
            const salesSummary = formatValue(lead.sales_summary || lead.scoring_rationale);

            return (
              <div
                key={id}
                className={`crm-lead-card ${isExpanded ? 'card-expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : id)}
              >
                {/* Main Row */}
                <div className="crm-card-header">
                  {/* Left: Avatar & Info */}
                  <div className="crm-avatar-block">
                    <div className="crm-avatar">{getInitials(fullName)}</div>
                    <div>
                      <div className="crm-lead-name">{fullName}</div>
                      <div className="crm-lead-role">
                        {designation}
                        {company !== 'Missing' ? `, ${company}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Right: Score, Priority, Status, Toggle */}
                  <div className="crm-card-right" onClick={(e) => e.stopPropagation()}>
                    <div className="crm-score-pill">{score}/100</div>
                    <div className={`crm-priority-badge ${badgeClass}`}>{tier.toUpperCase()}</div>

                    <select
                      className="crm-status-select"
                      value={lead.status || lead.lead_status || 'New'}
                      onChange={(e) => handleStatusChange(id, e.target.value)}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>

                    <button
                      type="button"
                      className="crm-expand-btn"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                      title={isExpanded ? 'Collapse' : 'Expand details'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Zoho CRM Flat One-Line Summary */}
                {salesSummary && salesSummary !== 'Missing' && (
                  <div className="crm-summary-line">
                    <span className="crm-summary-tag">Summary:</span> {salesSummary}
                  </div>
                )}

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="crm-drawer" onClick={(e) => e.stopPropagation()}>
                    <div className="crm-drawer-grid">
                      <div className="crm-field-item">
                        <span className="crm-field-label">Email</span>
                        <span className={`crm-field-val ${lead.email === 'Missing' ? 'text-missing' : ''}`}>
                          {formatValue(lead.email)}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Phone</span>
                        <span className={`crm-field-val ${lead.phone === 'Missing' ? 'text-missing' : ''}`}>
                          {formatValue(lead.phone)}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Address</span>
                        <span className={`crm-field-val ${lead.address === 'Missing' ? 'text-missing' : ''}`}>
                          {formatValue(lead.address)}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Sector / Industry</span>
                        <span className={`crm-field-val ${lead.sector_industry === 'Missing' ? 'text-missing' : ''}`}>
                          {formatValue(lead.sector_industry)}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">LinkedIn</span>
                        <span className="crm-field-val">
                          {lead.linkedin_url && lead.linkedin_url !== 'Missing' ? (
                            <a
                              href={lead.linkedin_url.startsWith('http') ? lead.linkedin_url : `https://${lead.linkedin_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="crm-link"
                            >
                              {lead.linkedin_url}
                            </a>
                          ) : (
                            <span className="text-missing">Missing</span>
                          )}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Website</span>
                        <span className="crm-field-val">
                          {lead.website && lead.website !== 'Missing' ? (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="crm-link"
                            >
                              {lead.website}
                            </a>
                          ) : (
                            <span className="text-missing">Missing</span>
                          )}
                        </span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Source File</span>
                        <span className="crm-field-val">{formatValue(lead.source)}</span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Validation Status</span>
                        <span className="crm-field-val">{formatValue(lead.validation_status)}</span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Duplicate Status</span>
                        <span className="crm-field-val">{formatValue(lead.duplicate_status)}</span>
                      </div>

                      <div className="crm-field-item">
                        <span className="crm-field-label">Extracted At</span>
                        <span className="crm-field-val">
                          {formatValue(lead.uploaded_at || lead.extracted_at)}
                        </span>
                      </div>
                    </div>

                    <div className="crm-full-summary">
                      <span className="crm-field-label">Sales Action Directive</span>
                      <p className="crm-directive-text">{salesSummary}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

export default LeadWorkspace;
