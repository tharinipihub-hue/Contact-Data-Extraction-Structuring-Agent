import React, { useEffect, useRef, useState } from 'react';
import { getContacts } from '../api';
import { Download, Search, Users, Loader2 } from 'lucide-react';

/**
 * How often to re-fetch contacts while waiting for Workbench to finish (ms).
 * Stops once contacts appear.
 */
const POLL_INTERVAL_MS = 3000;

/** Normalise contact field names — backend may vary */
const field = (c, ...keys) => {
  for (const k of keys) {
    if (c[k] !== undefined && c[k] !== null && c[k] !== '') return String(c[k]);
  }
  return '—';
};

function ValidationChip({ value }) {
  const v = (value || '').toLowerCase();
  if (v === 'valid')   return <span className="chip chip-valid">Valid</span>;
  if (v === 'invalid') return <span className="chip chip-invalid">Invalid</span>;
  return <span className="chip chip-queued">{value || '—'}</span>;
}

function DuplicateChip({ value }) {
  const v = (value || '').toLowerCase();
  if (v === 'unique')    return <span className="chip chip-unique">Unique</span>;
  if (v === 'duplicate') return <span className="chip chip-duplicate">Duplicate</span>;
  return <span className="chip chip-queued">{value || '—'}</span>;
}

/** Export visible rows as CSV */
function exportCsv(rows) {
  const COLS = [
    'Full Name', 'First Name', 'Last Name', 'Designation', 'Company',
    'Email', 'Phone', 'Address', 'City', 'State', 'Country',
    'Sector / Industry', 'LinkedIn URL', 'Website',
    'Source', 'Validation', 'Duplicate',
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const lines = [
    COLS.join(','),
    ...rows.map((c) =>
      [
        field(c, 'full_name', 'name'),
        field(c, 'first_name'),
        field(c, 'last_name'),
        field(c, 'designation', 'title', 'job_title'),
        field(c, 'company', 'company_name', 'organization'),
        field(c, 'email', 'email_address'),
        field(c, 'phone', 'phone_number'),
        field(c, 'address'),
        field(c, 'city'),
        field(c, 'state'),
        field(c, 'country'),
        field(c, 'sector_industry', 'sector', 'industry'),
        field(c, 'linkedin_url', 'linkedin'),
        field(c, 'website'),
        field(c, 'source', 'source_file'),
        field(c, 'validation_status', 'validation'),
        field(c, 'duplicate_status', 'duplicate'),
      ]
        .map(escape)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ContactsTable
 *
 * Props:
 *   batchId?: string – if provided, filters to contacts from that batch/file only
 *
 * Behaviour:
 *   - Fetches contacts immediately on mount.
 *   - If contacts list is empty, polls every POLL_INTERVAL_MS ms.
 *   - Stops polling once contacts appear (Workbench has finished).
 */
function ContactsTable({ batchId }) {
  const [contacts, setContacts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [polling, setPolling]     = useState(false);
  const [error, setError]         = useState(null);
  const [query, setQuery]         = useState('');
  const intervalRef               = useRef(null);

  const fetchContacts = async (isPolling = false) => {
    try {
      const { data } = await getContacts(batchId || null);
      const list = Array.isArray(data) ? data : (data.contacts || []);

      setContacts(list);
      setError(null);
      setLoading(false);

      if (list.length > 0) {
        // Contacts arrived — stop polling
        clearInterval(intervalRef.current);
        setPolling(false);
      }
    } catch (err) {
      if (!isPolling) {
        setError(err?.response?.data?.error || err.message || 'Failed to load contacts');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    setContacts([]);
    setError(null);
    setQuery('');

    fetchContacts(false).then(() => {
      // If still no contacts after first fetch, start polling
      setContacts((current) => {
        if (current.length === 0) {
          setPolling(true);
          intervalRef.current = setInterval(() => fetchContacts(true), POLL_INTERVAL_MS);
        }
        return current;
      });
    });

    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  /* ── Client-side search ── */
  const filtered = contacts.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      field(c, 'full_name', 'name').toLowerCase().includes(q) ||
      field(c, 'company', 'company_name', 'organization').toLowerCase().includes(q) ||
      field(c, 'email', 'email_address').toLowerCase().includes(q)
    );
  });

  /* ── Loading (first fetch) ── */
  if (loading) {
    return (
      <div className="spinner-overlay">
        <span className="spinner spinner-lg" />
        <span>Loading contacts…</span>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '14px 18px',
          color: '#dc2626',
          fontSize: '0.875rem',
        }}
      >
        ⚠ {error}
      </div>
    );
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color="#64748b" />
          <span style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600 }}>
            {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
            {query && contacts.length !== filtered.length && (
              <span style={{ fontWeight: 400, color: '#94a3b8' }}>
                {' '}(filtered from {contacts.length})
              </span>
            )}
          </span>
          {polling && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#2563eb' }}>
              <Loader2 size={12} className="spin" />
              Waiting for Workbench…
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14}
              color="#94a3b8"
              style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}
            />
            <input
              className="search-input"
              style={{ paddingLeft: 30 }}
              placeholder="Search name, company, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            title="Export visible rows to CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          {polling ? (
            <>
              <span className="spinner spinner-lg" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginTop: 8 }}>
                Waiting for Workbench to extract contacts…
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                This page refreshes automatically every 3 seconds.
              </p>
            </>
          ) : (
            <>
              <Users size={48} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginTop: 8 }}>
                No contacts found
              </p>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 4 }}>
                {query ? 'Try a different search term.' : 'Upload a file to extract contacts.'}
              </p>
            </>
          )}
        </div>
      ) : (
        /* ── Table ── */
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Full Name</th>
                <th>Designation</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City</th>
                <th>Country</th>
                <th>Sector / Industry</th>
                <th>Source</th>
                <th>Validation</th>
                <th>Duplicate</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id || c._id || idx}>
                  <td style={{ color: '#94a3b8', width: 40 }}>{idx + 1}</td>
                  <td title={field(c, 'full_name', 'name')}>
                    <strong>{field(c, 'full_name', 'name')}</strong>
                  </td>
                  <td title={field(c, 'designation', 'title', 'job_title')}>
                    {field(c, 'designation', 'title', 'job_title')}
                  </td>
                  <td title={field(c, 'company', 'company_name', 'organization')}>
                    {field(c, 'company', 'company_name', 'organization')}
                  </td>
                  <td>
                    <a
                      href={`mailto:${field(c, 'email', 'email_address')}`}
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                      title={field(c, 'email', 'email_address')}
                    >
                      {field(c, 'email', 'email_address')}
                    </a>
                  </td>
                  <td title={field(c, 'phone', 'phone_number')}>
                    {field(c, 'phone', 'phone_number')}
                  </td>
                  <td>{field(c, 'city')}</td>
                  <td>{field(c, 'country')}</td>
                  <td>{field(c, 'sector_industry', 'sector', 'industry')}</td>
                  <td title={field(c, 'source', 'source_file')}>
                    {field(c, 'source', 'source_file')}
                  </td>
                  <td>
                    <ValidationChip value={field(c, 'validation_status', 'validation')} />
                  </td>
                  <td>
                    <DuplicateChip value={field(c, 'duplicate_status', 'duplicate')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ContactsTable;
