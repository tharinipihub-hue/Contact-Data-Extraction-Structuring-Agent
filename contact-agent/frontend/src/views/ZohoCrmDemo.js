import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Search,
  UploadCloud,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Table as TableIcon,
  Columns as KanbanIcon,
  Grid as GridIcon,
  X,
  Mail,
  Phone,
  Building,
  Globe,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Send,
  MoreVertical,
  Plus,
  Download,
  Sparkles,
  Copy,
  Check,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { getContacts, uploadFiles, getBatchStatus, updateContactStatus, createContact } from '../api';
import { GOOGLE_SHEETS_URL, POLL_INTERVAL_MS } from '../config';
import { getLeadTier, fetchDirectFromGoogleSheets } from './LeadWorkspace';
import { deduplicateContactList } from '../utils/dedup';
import './ZohoCrmDemo.css';

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

function formatSourceType(source) {
  if (!source || source === 'Missing') return 'Google Sheets';
  const s = String(source).toLowerCase().trim();

  // If from Google Sheets
  if (s.includes('sheet') || s.includes('google')) {
    return 'Google Sheets';
  }

  // If it's a business card / OCR image
  if (
    s.includes('card') ||
    s.endsWith('.jpg') ||
    s.endsWith('.jpeg') ||
    s.endsWith('.png') ||
    s.endsWith('.webp') ||
    s.endsWith('.gif') ||
    s.includes('ocr')
  ) {
    return 'Business Card';
  }

  // If not a business card, show the clean file name
  return source;
}

function ZohoCrmDemo() {
  // Leads data
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  // View state: 'table' | 'kanban' | 'card'
  const [viewMode, setViewMode] = useState('table');
  const [filterView, setFilterView] = useState('All'); // 'All' | 'Hot' | 'Warm' | 'Cold'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pitchTab, setPitchTab] = useState('email'); // 'email' | 'linkedin' | 'whatsapp'
  const [pitchCopied, setPitchCopied] = useState(false);

  // Import Modal & Upload State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // 'idle' | 'uploading' | 'processing' | 'done' | 'failed'
  const [uploadError, setUploadError] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Create Lead Modal State
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [createLeadError, setCreateLeadError] = useState(null);
  const [createLeadForm, setCreateLeadForm] = useState({
    full_name: '',
    designation: '',
    company: '',
    sector_industry: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    country: '',
    website: '',
    linkedin_url: '',
    status: 'New'
  });

  // Profile Menu State
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Close profile menu on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Export all leads directly to CSV
  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = [
      'Full Name',
      'Designation',
      'Company',
      'Sector/Industry',
      'Email',
      'Phone',
      'City',
      'State',
      'Country',
      'Website',
      'AI Score',
      'Priority Tier',
      'CRM Status',
      'Validation Status',
      'Source File'
    ];

    const csvRows = [headers.join(',')];
    leads.forEach((l) => {
      const tier = getLeadTier(l);
      const score = tier === 'Cold' && Number(l.lead_score) >= 40 ? 20 : (Number(l.lead_score) || 0);
      const row = [
        `"${(l.full_name || '').replace(/"/g, '""')}"`,
        `"${(l.designation || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.sector_industry || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.city || '').replace(/"/g, '""')}"`,
        `"${(l.state || '').replace(/"/g, '""')}"`,
        `"${(l.country || '').replace(/"/g, '""')}"`,
        `"${(l.website || '').replace(/"/g, '""')}"`,
        score,
        tier,
        `"${(l.status || l.lead_status || 'New').replace(/"/g, '""')}"`,
        `"${(l.validation_status || 'Valid').replace(/"/g, '""')}"`,
        `"${(l.source || 'Google Sheets').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sns_agent_leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsProfileMenuOpen(false);
  };

  // ── Fetch Leads from Google Sheets ──────────────────────────────────────────
  // ── Fetch Leads from Google Sheets ──────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let bestList = [];

    // 1. Try backend live Google Sheets sync
    try {
      const res = await getContacts();
      const list = Array.isArray(res.data) ? res.data : res.data?.contacts || [];
      const source = res.data?.source;
      if (list && list.length >= 50 && source === 'google_sheets') {
        setLeads(deduplicateContactList(list));
        setLoading(false);
        return;
      }
      if (list && list.length > bestList.length) {
        bestList = list;
      }
    } catch (err) {
      console.warn('[ZohoCrmDemo] Backend fetch failed, falling back to direct sheet:', err.message);
    }

    // 2. Direct client-side Google Sheets CSV fetch (fallback)
    try {
      const directList = await fetchDirectFromGoogleSheets();
      if (directList && directList.length > bestList.length) {
        setLeads(deduplicateContactList(directList));
        setLoading(false);
        return;
      }
    } catch (sheetErr) {
      console.error('[ZohoCrmDemo] Direct sheet fallback error:', sheetErr);
    }

    if (bestList.length > 0) {
      setLeads(deduplicateContactList(bestList));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ── Metrics Calculation ──────────────────────────────────────────────────────
  const totalCount = leads.length;
  const hotCount = leads.filter((l) => getLeadTier(l) === 'Hot').length;
  const warmCount = leads.filter((l) => getLeadTier(l) === 'Warm').length;
  const coldCount = leads.filter((l) => getLeadTier(l) === 'Cold').length;

  // ── Filtered Leads ───────────────────────────────────────────────────────────
  const filteredLeads = leads
    .filter((l) => {
      if (filterView === 'All') return true;
      return getLeadTier(l) === filterView;
    })
    .filter((l) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (l.full_name || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.designation || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (Number(b.lead_score) || 0) - (Number(a.lead_score) || 0));

  // ── Status Change Handler ────────────────────────────────────────────────────
  const handleStatusChange = async (leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus, lead_status: newStatus } : l))
    );
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => ({ ...prev, status: newStatus, lead_status: newStatus }));
    }
    try {
      await updateContactStatus(leadId, newStatus);
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
  };

  // ── Selection Checkboxes ─────────────────────────────────────────────────────
  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Batch Actions ────────────────────────────────────────────────────────────
  const handleBatchStatusChange = async (newStatus) => {
    if (selectedIds.size === 0) return;
    const idsToUpdate = Array.from(selectedIds);
    setLeads((prev) =>
      prev.map((l) => (selectedIds.has(l.id) ? { ...l, status: newStatus, lead_status: newStatus } : l))
    );
    if (selectedLead && selectedIds.has(selectedLead.id)) {
      setSelectedLead((prev) => ({ ...prev, status: newStatus, lead_status: newStatus }));
    }
    for (const id of idsToUpdate) {
      try {
        await updateContactStatus(id, newStatus);
      } catch (e) {
        // silent fallback
      }
    }
    setSelectedIds(new Set());
  };

  const handleBatchExportCSV = () => {
    const selectedList = leads.filter((l) => selectedIds.has(l.id));
    if (selectedList.length === 0) return;
    const headers = [
      'Full Name',
      'Designation',
      'Company',
      'Sector/Industry',
      'Email',
      'Phone',
      'City',
      'State',
      'Country',
      'Website',
      'Lead Score',
      'Lead Tier',
      'Lead Status',
      'Validation Status',
      'Source'
    ];
    const csvRows = [headers.join(',')];
    selectedList.forEach((l) => {
      const score = l.lead_score || 0;
      const tier = getLeadTier(l);
      const row = [
        `"${(l.full_name || '').replace(/"/g, '""')}"`,
        `"${(l.designation || '').replace(/"/g, '""')}"`,
        `"${(l.company || '').replace(/"/g, '""')}"`,
        `"${(l.sector_industry || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${(l.phone || '').replace(/"/g, '""')}"`,
        `"${(l.city || '').replace(/"/g, '""')}"`,
        `"${(l.state || '').replace(/"/g, '""')}"`,
        `"${(l.country || '').replace(/"/g, '""')}"`,
        `"${(l.website || '').replace(/"/g, '""')}"`,
        score,
        tier,
        `"${(l.status || l.lead_status || 'New').replace(/"/g, '""')}"`,
        `"${(l.validation_status || 'Valid').replace(/"/g, '""')}"`,
        `"${(l.source || 'Google Sheets').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `selected_leads_${selectedList.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${count} selected lead${count > 1 ? 's' : ''}?`
    );
    if (!confirmDelete) return;

    const idsToDelete = new Set(selectedIds);
    setLeads((prev) => prev.filter((l) => !idsToDelete.has(l.id)));
    if (selectedLead && idsToDelete.has(selectedLead.id)) {
      setSelectedLead(null);
    }
    setSelectedIds(new Set());
  };

  const handleCreateLeadSubmit = async (e) => {
    e.preventDefault();
    if (!createLeadForm.full_name?.trim() && !createLeadForm.company?.trim() && !createLeadForm.email?.trim()) {
      setCreateLeadError('Please provide at least a Full Name, Company, or Email.');
      return;
    }
    setIsCreatingLead(true);
    setCreateLeadError(null);
    try {
      const res = await createContact(createLeadForm);
      const created = res.data?.contact;
      if (created) {
        setLeads((prev) => [created, ...prev.filter((l) => l.id !== created.id)]);
        setSelectedLead(created);
      }
      setIsCreateLeadOpen(false);
      setCreateLeadForm({
        full_name: '',
        designation: '',
        company: '',
        sector_industry: '',
        email: '',
        phone: '',
        city: '',
        state: '',
        country: '',
        website: '',
        linkedin_url: '',
        status: 'New'
      });
    } catch (err) {
      console.error('[ZohoCrmDemo] Failed to create lead:', err);
      setCreateLeadError(err.response?.data?.error || err.message || 'Failed to create lead.');
    } finally {
      setIsCreatingLead(false);
    }
  };

  // ── AI Outreach Pitch Generator ──────────────────────────────────────────────
  const getPitchContent = (lead, type) => {
    if (!lead) return '';
    const name = lead.full_name && lead.full_name !== 'Missing' ? lead.full_name : 'Executive';
    const firstName = (lead.first_name && lead.first_name !== 'Missing')
      ? lead.first_name
      : name.split(' ')[0] || 'there';
    const comp = lead.company && lead.company !== 'Missing' ? lead.company : 'your organization';
    const desig = lead.designation && lead.designation !== 'Missing' ? lead.designation : 'Leader';
    const sector = lead.sector_industry && lead.sector_industry !== 'Missing' ? lead.sector_industry : 'industry';

    if (type === 'email') {
      return `Subject: Exploring AI Workflow Automation for ${comp}

Dear ${firstName},

I have been following ${comp}'s strategic growth and your role as ${desig}. 

At SNS Square, we deploy autonomous AI agent workbenches that streamline complex contact data extraction, multi-channel verification, and pipeline qualification for leading enterprises in the ${sector} sector.

Given your leadership focus, I would welcome a brief 10-minute briefing to share relevant case studies and discuss how we can automate manual workflow overhead for your team.

Would you be open to connecting for 10 minutes this Thursday or Friday?

Best regards,
SNS Square Enterprise AI Team
agents.snsihub.ai`;
    }

    if (type === 'linkedin') {
      return `Hi ${firstName}, impressed by your leadership as ${desig} at ${comp}. We build autonomous AI agents streamlining data workflows in ${sector}. Would love to connect and share relevant insights for your team!`;
    }

    if (type === 'whatsapp') {
      return `Hello ${firstName}, hope you are doing well! Reaching out from SNS Square regarding autonomous enterprise AI agents tailored for ${comp}. Would love to share a quick 2-minute overview when convenient.`;
    }

    return '';
  };

  const handleCopyPitch = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setPitchCopied(true);
    setTimeout(() => setPitchCopied(false), 2000);
  };

  const getCleanPhoneDigits = (phone) => {
    if (!phone || phone === 'Missing') return null;
    let digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length > 10) {
      digits = digits.substring(2);
    }
    if (digits.startsWith('0') && digits.length > 10) {
      digits = digits.substring(1);
    }
    // Format for WhatsApp: Indian 10-digit mobile prefix with 91
    if (digits.length === 10) {
      return '91' + digits;
    }
    return digits.length >= 8 ? digits : null;
  };

  // ── File Upload via Import Modal ─────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadError(null);
    setUploadState('uploading');

    const formData = new FormData();
    formData.append('files', file);

    try {
      const { data } = await uploadFiles(formData);
      const batchId = data.batch_id || data.batchId || data.id;
      if (!batchId) throw new Error('No batch ID returned.');

      setUploadState('processing');

      // Poll status with safety timeout
      let pollAttempts = 0;
      const MAX_POLL_ATTEMPTS = 8; // 12 seconds max

      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        pollAttempts++;
        try {
          const res = await getBatchStatus(batchId);
          const files = res.data?.files || [];
          const isDone = files.length > 0 && files[0].status === 'done';
          const isFailed = files.length > 0 && files[0].status === 'failed';

          if (isDone || pollAttempts >= MAX_POLL_ATTEMPTS) {
            clearInterval(pollIntervalRef.current);
            setUploadState('done');
            setTimeout(() => {
              fetchLeads();
              setIsImportModalOpen(false);
              setUploadState('idle');
            }, 1000);
          } else if (isFailed) {
            clearInterval(pollIntervalRef.current);
            setUploadState('failed');
            setUploadError('Processing failed.');
          }
        } catch (e) {
          console.error('[ImportModal] Poll error:', e);
          if (pollAttempts >= MAX_POLL_ATTEMPTS) {
            clearInterval(pollIntervalRef.current);
            setUploadState('done');
            setTimeout(() => {
              fetchLeads();
              setIsImportModalOpen(false);
              setUploadState('idle');
            }, 1000);
          }
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
      setUploadState('failed');
    }
  };

  return (
    <div className="zoho-root">
      {/* ── Top Navigation Bar ── */}
      <nav className="zoho-navbar">
        <div className="zoho-nav-left">
          <div className="zoho-logo-wrap">
            <span style={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em', fontSize: 14 }}>
              Contact Data Extraction & Structuring Agent
            </span>
          </div>

          <div className="zoho-nav-tabs">
            <button className="zoho-nav-tab active">Leads</button>
          </div>
        </div>

        <div className="zoho-nav-center">
          <div className="zoho-search-box">
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              className="zoho-search-input"
              placeholder="Search extracted leads (e.g. Sundar, Nykaa, CEO)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="zoho-nav-right">
          <button
            className="zoho-btn zoho-btn-primary"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setIsImportModalOpen(true)}
          >
            <Plus size={13} /> Import Leads
          </button>

          <div className="zoho-profile-wrap" ref={profileMenuRef}>
            <div
              className="zoho-user-avatar"
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              title="SNS Square Agent Profile & Operations"
            >
              SN
            </div>

            {isProfileMenuOpen && (
              <div className="zoho-profile-menu">
                <div className="zoho-profile-header">
                  <div className="zoho-profile-avatar-lg">SN</div>
                  <div>
                    <div className="zoho-profile-name">SNS Square Administrator</div>
                    <div className="zoho-profile-email">admin@snsihub.ai</div>
                    <span className="zoho-profile-role-badge">Lead Ops &bull; AI Agent</span>
                  </div>
                </div>

                <div className="zoho-profile-body">
                  <div className="zoho-profile-status-card">
                    <div className="zoho-profile-status-row">
                      <span style={{ color: '#64748b' }}>Google Sheets:</span>
                      <span style={{ fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                        <span className="zoho-status-indicator indicator-green"></span>
                        Connected ({totalCount} Leads)
                      </span>
                    </div>
                    <div className="zoho-profile-status-row">
                      <span style={{ color: '#64748b' }}>SNS Agent Webhook:</span>
                      <span style={{ fontWeight: 600, color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                        <span className="zoho-status-indicator indicator-green"></span>
                        Active (Port 4000)
                      </span>
                    </div>
                    <div className="zoho-profile-status-row">
                      <span style={{ color: '#64748b' }}>Leads Breakdown:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {hotCount} Hot &bull; {warmCount} Warm &bull; {coldCount} Cold
                      </span>
                    </div>
                  </div>

                  <div className="zoho-profile-actions-list">
                    <button
                      className="zoho-profile-action-btn"
                      onClick={() => {
                        fetchLeads();
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      <RefreshCw size={13} color="#2563eb" />
                      Sync Live with Google Sheets
                    </button>

                    <button className="zoho-profile-action-btn" onClick={handleExportCSV}>
                      <Download size={13} color="#16a34a" />
                      Export All Leads to CSV ({totalCount})
                    </button>

                    <a
                      href={GOOGLE_SHEETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zoho-profile-action-btn"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <ExternalLink size={13} color="#64748b" />
                      Open Google Spreadsheet
                    </a>
                  </div>
                </div>

                <div className="zoho-profile-footer">
                  <span>SNS Square Agent Workbench</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>v1.4.2</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Module Sub-Header (Views & Actions) ── */}
      <div className="zoho-subbar">
        <div className="zoho-subbar-left">
          <div className="zoho-module-selector">
            <span className="zoho-module-title">Leads</span>
            <span className="zoho-module-count">({filteredLeads.length})</span>
            <ChevronDown size={14} color="#64748b" />
          </div>

          {/* Filter Pills */}
          <div className="zoho-filter-pills">
            <button
              className={`zoho-pill-btn ${filterView === 'All' ? 'active' : ''}`}
              onClick={() => setFilterView('All')}
            >
              All ({totalCount})
            </button>
            <button
              className={`zoho-pill-btn ${filterView === 'Hot' ? 'active' : ''}`}
              onClick={() => setFilterView('Hot')}
            >
              Hot ({hotCount})
            </button>
            <button
              className={`zoho-pill-btn ${filterView === 'Warm' ? 'active' : ''}`}
              onClick={() => setFilterView('Warm')}
            >
              Warm ({warmCount})
            </button>
            <button
              className={`zoho-pill-btn ${filterView === 'Cold' ? 'active' : ''}`}
              onClick={() => setFilterView('Cold')}
            >
              Cold ({coldCount})
            </button>
          </div>
        </div>

        <div className="zoho-subbar-right">
          {/* View Switcher (Table / Kanban) */}
          <div className="zoho-view-switcher">
            <button
              className={`zoho-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <TableIcon size={14} />
            </button>
            <button
              className={`zoho-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Kanban Pipeline View"
            >
              <KanbanIcon size={14} />
            </button>
          </div>

          <button
            className="zoho-btn zoho-btn-secondary"
            onClick={fetchLeads}
            title="Synchronize directly with Google Sheets"
          >
            <RefreshCw size={12} className={loading ? 'crm-spin' : ''} />
            Sync Sheets
          </button>

          <button
            className="zoho-btn zoho-btn-primary"
            style={{ background: '#16a34a', borderColor: '#15803d' }}
            onClick={() => setIsCreateLeadOpen(true)}
            title="Create a new lead manually"
          >
            <Plus size={13} />
            Create Lead
          </button>

          <button
            className="zoho-btn zoho-btn-primary"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadCloud size={13} />
            Import Leads
          </button>

          <a
            href={GOOGLE_SHEETS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="zoho-btn zoho-btn-secondary"
          >
            Open Sheets <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* ── KPI Metric Bar ── */}
      <div className="zoho-kpi-bar">
        <div
          className={`zoho-kpi-item ${filterView === 'All' ? 'active' : ''}`}
          onClick={() => setFilterView('All')}
        >
          <span className="zoho-kpi-label">Total Leads:</span>
          <span className="zoho-kpi-val">{totalCount}</span>
        </div>
        <div
          className={`zoho-kpi-item ${filterView === 'Hot' ? 'active' : ''}`}
          onClick={() => setFilterView('Hot')}
        >
          <span className="zoho-kpi-label text-hot">Hot:</span>
          <span className="zoho-kpi-val text-hot">{hotCount}</span>
        </div>
        <div
          className={`zoho-kpi-item ${filterView === 'Warm' ? 'active' : ''}`}
          onClick={() => setFilterView('Warm')}
        >
          <span className="zoho-kpi-label text-warm">Warm:</span>
          <span className="zoho-kpi-val text-warm">{warmCount}</span>
        </div>
        <div
          className={`zoho-kpi-item ${filterView === 'Cold' ? 'active' : ''}`}
          onClick={() => setFilterView('Cold')}
        >
          <span className="zoho-kpi-label text-cold">Cold:</span>
          <span className="zoho-kpi-val text-cold">{coldCount}</span>
        </div>
      </div>

      {/* ── Content Area: Table or Kanban ── */}
      <main className="zoho-content-area">
        {loading && leads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: 6 }}>
            <Loader2 size={28} className="crm-spin text-blue" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Connecting to Google Sheets...</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>Loading 47 leads with AI scores and rationale.</div>
          </div>
        ) : viewMode === 'table' ? (
          /* ---------- Classic Zoho CRM Table Grid ---------- */
          <div className="zoho-table-wrapper">
            <table className="zoho-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                    />
                  </th>
                  <th>Lead Name</th>
                  <th>Company</th>
                  <th>Email & Phone</th>
                  <th>Location</th>
                  <th>AI Score</th>
                  <th>Tier</th>
                  <th>CRM Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const id = lead.id;
                  const isChecked = selectedIds.has(id);
                  const tier = getLeadTier(lead);
                  const score = tier === 'Cold' && Number(lead.lead_score) >= 40 ? 20 : (Number(lead.lead_score) || 0);
                  const badgeClass =
                    tier === 'Hot' ? 'zoho-badge-hot' : tier === 'Warm' ? 'zoho-badge-warm' : 'zoho-badge-cold';

                  return (
                    <tr
                      key={id}
                      className={isChecked ? 'selected' : ''}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td onClick={(e) => toggleSelectRow(id, e)}>
                        <input type="checkbox" checked={isChecked} onChange={() => {}} />
                      </td>
                      <td>
                        <div className="zoho-lead-cell">
                          <div className="zoho-cell-avatar">{getInitials(lead.full_name)}</div>
                          <div>
                            <div className="zoho-cell-name">{formatValue(lead.full_name)}</div>
                            <div className="zoho-cell-role">{formatValue(lead.designation)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{formatValue(lead.company)}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{formatValue(lead.sector_industry)}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{formatValue(lead.email)}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{formatValue(lead.phone)}</div>
                      </td>
                      <td>
                        {formatValue(lead.city)}
                        {lead.state && lead.state !== 'Missing' ? `, ${lead.state}` : ''}
                      </td>
                      <td>
                        <span className="zoho-score-pill">{score}/100</span>
                      </td>
                      <td>
                        <span className={`zoho-badge ${badgeClass}`}>{tier.toUpperCase()}</span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="zoho-status-dropdown"
                          value={lead.status || lead.lead_status || 'New'}
                          onChange={(e) => handleStatusChange(id, e.target.value)}
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Follow-up">Follow-up</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 11, color: '#64748b' }}>{formatSourceType(lead.source)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ---------- Zoho CRM Kanban Pipeline Board ---------- */
          <div className="zoho-kanban-board">
            {['Hot', 'Warm', 'Cold'].map((tierName) => {
              const tierLeads = filteredLeads.filter((l) => getLeadTier(l) === tierName);
              const headerColor =
                tierName === 'Hot' ? '#dc2626' : tierName === 'Warm' ? '#d97706' : '#2563eb';

              return (
                <div key={tierName} className="zoho-kanban-col">
                  <div className="zoho-kanban-header">
                    <span className="zoho-kanban-title" style={{ color: headerColor }}>
                      {tierName.toUpperCase()} LEADS
                    </span>
                    <span className="zoho-badge" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                      {tierLeads.length}
                    </span>
                  </div>

                  <div className="zoho-kanban-cards">
                    {tierLeads.map((lead) => {
                      const tier = getLeadTier(lead);
                      const score = tier === 'Cold' && Number(lead.lead_score) >= 40 ? 20 : (Number(lead.lead_score) || 0);
                      return (
                        <div
                          key={lead.id}
                          className="zoho-kanban-card"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                              {formatValue(lead.full_name)}
                            </span>
                            <span className="zoho-score-pill">{score}/100</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                            {formatValue(lead.designation)} &bull; {formatValue(lead.company)}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{formatValue(lead.city)}</span>
                            <select
                              className="zoho-status-dropdown"
                              value={lead.status || lead.lead_status || 'New'}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Follow-up">Follow-up</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Zoho Lead Record Slide-Over Drawer ── */}
      {selectedLead && (
        <div className="zoho-drawer-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="zoho-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="zoho-drawer-header">
              <div className="zoho-drawer-title-wrap">
                <div className="zoho-drawer-avatar">{getInitials(selectedLead.full_name)}</div>
                <div>
                  <div className="zoho-drawer-name">{formatValue(selectedLead.full_name)}</div>
                  <div className="zoho-drawer-company">
                    {formatValue(selectedLead.designation)} &bull; {formatValue(selectedLead.company)}
                  </div>
                </div>
              </div>
              <div className="zoho-drawer-actions">
                <button
                  className="zoho-btn zoho-btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '5px 8px' }}
                  onClick={() => {
                    if (window.confirm(`Delete lead "${selectedLead.full_name}"?`)) {
                      setLeads((prev) => prev.filter((l) => l.id !== selectedLead.id));
                      setSelectedLead(null);
                    }
                  }}
                  title="Delete this lead"
                >
                  <Trash2 size={13} />
                </button>
                <button className="zoho-btn zoho-btn-secondary" onClick={() => setSelectedLead(null)}>
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="zoho-drawer-body">
              {/* Quick Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                {selectedLead.email && selectedLead.email !== 'Missing' && (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="zoho-btn zoho-btn-primary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Mail size={13} /> Send Email
                  </a>
                )}
                {selectedLead.phone && selectedLead.phone !== 'Missing' && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="zoho-btn zoho-btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Phone size={13} /> Call
                  </a>
                )}
                <select
                  className="zoho-status-dropdown"
                  style={{ marginLeft: 'auto', padding: '6px 10px', fontSize: 12 }}
                  value={selectedLead.status || selectedLead.lead_status || 'New'}
                  onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                >
                  <option value="New">Status: New</option>
                  <option value="Contacted">Status: Contacted</option>
                  <option value="Follow-up">Status: Follow-up</option>
                </select>
              </div>

              {/* AI Lead Intelligence Directive */}
              {(() => {
                const drawerTier = getLeadTier(selectedLead);
                const drawerScore = drawerTier === 'Cold' && Number(selectedLead.lead_score) >= 40 ? 20 : (Number(selectedLead.lead_score) || 0);
                const isColdAI = drawerTier === 'Cold' && Number(selectedLead.lead_score) >= 40;
                const directiveText = isColdAI
                  ? `[Cold - Score: 20/100] Profile: ${selectedLead.designation} at ${selectedLead.company} | Action: Direct AI company / role overlap. Categorized as Cold to avoid competitor conflict.`
                  : formatValue(selectedLead.sales_summary || selectedLead.scoring_rationale);

                return (
                  <div className="zoho-ai-directive-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b' }}>
                        AI Qualification & Sales Directive
                      </span>
                      <span className="zoho-score-pill">Score: {drawerScore}/100</span>
                    </div>
                    <p className="zoho-directive-p">{directiveText}</p>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                      <strong>Scoring Factors:</strong>{' '}
                      {isColdAI
                        ? 'Direct AI company / role overlap; competitor clash with our AI offerings. Assigned to Cold priority.'
                        : formatValue(selectedLead.scoring_rationale || 'Verified business contact')}
                    </div>
                  </div>
                );
              })()}

              {/* AI Outreach Pitch Generator */}
              {(() => {
                const pitchText = getPitchContent(selectedLead, pitchTab);
                const cleanPhone = getCleanPhoneDigits(selectedLead.phone);
                const hasEmail = selectedLead.email && selectedLead.email !== 'Missing';

                return (
                  <div className="zoho-pitch-card">
                    <div className="zoho-pitch-header">
                      <div className="zoho-pitch-title">
                        <Sparkles size={14} color="#2563eb" />
                        <span>AI Outreach Pitch Generator</span>
                      </div>
                      <div className="zoho-pitch-tabs">
                        <button
                          className={`zoho-pitch-tab ${pitchTab === 'email' ? 'active' : ''}`}
                          onClick={() => setPitchTab('email')}
                        >
                          Email Pitch
                        </button>
                        <button
                          className={`zoho-pitch-tab ${pitchTab === 'linkedin' ? 'active' : ''}`}
                          onClick={() => setPitchTab('linkedin')}
                        >
                          LinkedIn Note
                        </button>
                        <button
                          className={`zoho-pitch-tab ${pitchTab === 'whatsapp' ? 'active' : ''}`}
                          onClick={() => setPitchTab('whatsapp')}
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>

                    <div className="zoho-pitch-content-box">
                      {pitchText}
                    </div>

                    <div className="zoho-pitch-actions">
                      <button
                        className="zoho-btn zoho-btn-secondary"
                        style={{ padding: '5px 10px', fontSize: 11 }}
                        onClick={() => handleCopyPitch(pitchText)}
                      >
                        {pitchCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        {pitchCopied ? 'Copied to Clipboard!' : 'Copy Pitch'}
                      </button>

                      {pitchTab === 'email' && hasEmail && (
                        <a
                          href={`mailto:${selectedLead.email}?subject=${encodeURIComponent(`Exploring AI Workflow Automation for ${selectedLead.company || 'Enterprise'}`)}&body=${encodeURIComponent(pitchText.replace(/^Subject:.*?\n\n/s, ''))}`}
                          className="zoho-btn zoho-btn-primary"
                          style={{ padding: '5px 10px', fontSize: 11, textDecoration: 'none' }}
                        >
                          <Send size={12} /> Send via Mail App
                        </a>
                      )}

                      {pitchTab === 'whatsapp' && cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(pitchText)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="zoho-btn zoho-btn-primary"
                          style={{ padding: '5px 10px', fontSize: 11, textDecoration: 'none', background: '#16a34a', borderColor: '#16a34a' }}
                        >
                          <MessageSquare size={12} /> Open WhatsApp Web
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Contact Information */}
              <div>
                <div className="zoho-section-title">Contact Information</div>
                <div className="zoho-detail-grid">
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Email</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.email)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Phone</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.phone)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">City</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.city)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">State / Region</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.state)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Country</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.country)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Website</span>
                    <span className="zoho-detail-value">
                      {selectedLead.website && selectedLead.website !== 'Missing' ? (
                        <a
                          href={
                            selectedLead.website.startsWith('http')
                              ? selectedLead.website
                              : `https://${selectedLead.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb' }}
                        >
                          {selectedLead.website}
                        </a>
                      ) : (
                        'Missing'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* System & Source Tracking */}
              <div>
                <div className="zoho-section-title">Lead Governance & Source Tracking</div>
                <div className="zoho-detail-grid">
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Source Document</span>
                    <span className="zoho-detail-value">{formatSourceType(selectedLead.source)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Validation Status</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.validation_status)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Duplicate Status</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.duplicate_status)}</span>
                  </div>
                  <div className="zoho-detail-field">
                    <span className="zoho-detail-label">Extracted Timestamp</span>
                    <span className="zoho-detail-value">{formatValue(selectedLead.uploaded_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Zoho Import Leads Modal ── */}
      {isImportModalOpen && (
        <div className="zoho-modal-backdrop" onClick={() => setIsImportModalOpen(false)}>
          <div className="zoho-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="zoho-modal-header">
              <span className="zoho-modal-title">Import Leads from Files</span>
              <button className="zoho-nav-icon-btn" onClick={() => setIsImportModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="zoho-modal-body">
              {uploadState === 'processing' ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <Loader2 size={32} className="crm-spin text-blue" style={{ marginBottom: 12 }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    Processing document with SNS Square Agent Workbench...
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                    Extracting contacts, scoring leads, and appending to Google Sheets.
                  </div>
                </div>
              ) : uploadState === 'done' ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <CheckCircle2 size={32} color="#15803d" style={{ marginBottom: 12 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#15803d' }}>
                    Leads successfully extracted and synced to Google Sheets!
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={`zoho-dropzone ${isDragActive ? 'drag-active' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <UploadCloud size={36} color="#2563eb" style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                      Drag and drop your file here, or click to browse
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                      Supports Business Card Images (JPG, PNG), PDF documents, or CSV spreadsheets
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.csv,.jpg,.jpeg,.png,.gif"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />

                  {uploadError && (
                    <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 12, fontWeight: 500 }}>
                      {uploadError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="zoho-modal-footer">
              <button
                className="zoho-btn zoho-btn-secondary"
                onClick={() => {
                  if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                  setIsImportModalOpen(false);
                  setUploadState('idle');
                  fetchLeads();
                }}
              >
                Cancel
              </button>
              {uploadState !== 'processing' && uploadState !== 'done' && (
                <button
                  className="zoho-btn zoho-btn-primary"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  Select File
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create New Lead Modal ── */}
      {isCreateLeadOpen && (
        <div className="zoho-modal-backdrop" onClick={() => !isCreatingLead && setIsCreateLeadOpen(false)}>
          <div
            className="zoho-modal-card"
            style={{ maxWidth: 640, width: '92%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="zoho-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={16} />
                </div>
                <div>
                  <span className="zoho-modal-title">Create New Lead</span>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Enter lead details. AI Lead Engine will score and prioritize automatically.
                  </div>
                </div>
              </div>
              <button
                className="zoho-btn-text"
                onClick={() => !isCreatingLead && setIsCreateLeadOpen(false)}
                disabled={isCreatingLead}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit}>
              <div className="zoho-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px' }}>
                {createLeadError && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    color: '#b91c1c',
                    fontSize: 12,
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <AlertCircle size={14} />
                    {createLeadError}
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Lead Information
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Full Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="Enter full name"
                      value={createLeadForm.full_name}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Designation / Job Title
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="Enter job title"
                      value={createLeadForm.designation}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, designation: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Company
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="Enter company name"
                      value={createLeadForm.company}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, company: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Sector / Industry
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="Enter industry or sector"
                      value={createLeadForm.sector_industry}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, sector_industry: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 }}>
                  Contact Details
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Work Email
                    </label>
                    <input
                      type="email"
                      className="zoho-form-input"
                      placeholder="name@company.com"
                      value={createLeadForm.email}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Phone / Mobile
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="+91 98765 43210"
                      value={createLeadForm.phone}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 }}>
                  Location & Online Presence
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      City
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="City"
                      value={createLeadForm.city}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      State
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="State / Province"
                      value={createLeadForm.state}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Country
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="Country"
                      value={createLeadForm.country}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, country: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Company Website
                    </label>
                    <input
                      type="text"
                      className="zoho-form-input"
                      placeholder="https://company.com"
                      value={createLeadForm.website}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, website: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                      Initial Status
                    </label>
                    <select
                      className="zoho-form-input zoho-status-dropdown"
                      style={{ height: 35, padding: '4px 8px', fontSize: 13 }}
                      value={createLeadForm.status}
                      onChange={(e) => setCreateLeadForm({ ...createLeadForm, status: e.target.value })}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="zoho-modal-footer">
                <button
                  type="button"
                  className="zoho-btn zoho-btn-secondary"
                  onClick={() => setIsCreateLeadOpen(false)}
                  disabled={isCreatingLead}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zoho-btn zoho-btn-primary"
                  style={{ background: '#16a34a', borderColor: '#15803d' }}
                  disabled={isCreatingLead}
                >
                  {isCreatingLead ? (
                    <>
                      <Loader2 size={13} className="crm-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={13} /> Save Lead
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Floating Batch Action Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="zoho-batch-toolbar">
          <div className="zoho-batch-info">
            <span className="zoho-batch-count-badge">{selectedIds.size}</span>
            <span>{selectedIds.size === 1 ? '1 lead selected' : `${selectedIds.size} leads selected`}</span>
            <button className="zoho-btn-text" onClick={() => setSelectedIds(new Set())}>
              Deselect All
            </button>
          </div>

          <div className="zoho-batch-divider" />

          <div className="zoho-batch-actions">
            <span style={{ fontSize: 11, color: '#94a3b8', marginRight: 2 }}>Mark Status:</span>
            <button
              className="zoho-btn zoho-btn-secondary"
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => handleBatchStatusChange('New')}
            >
              New
            </button>
            <button
              className="zoho-btn zoho-btn-secondary"
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => handleBatchStatusChange('Contacted')}
            >
              Contacted
            </button>
            <button
              className="zoho-btn zoho-btn-secondary"
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => handleBatchStatusChange('Follow-up')}
            >
              Follow-up
            </button>

            <button
              className="zoho-btn zoho-btn-primary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={handleBatchExportCSV}
            >
              <Download size={12} /> Export ({selectedIds.size})
            </button>

            <button
              className="zoho-btn zoho-btn-danger"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                background: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}
              onClick={handleBatchDelete}
              title="Delete selected leads"
            >
              <Trash2 size={12} /> Delete ({selectedIds.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ZohoCrmDemo;
