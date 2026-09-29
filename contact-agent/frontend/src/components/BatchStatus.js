import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBatchStatus, retryFile } from '../api';
import { POLL_INTERVAL_MS } from '../config';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

/** Terminal states – stop polling when all files reach one of these */
const TERMINAL = new Set(['done', 'failed']);

function StatusChip({ status }) {
  const map = {
    queued:     { label: 'Queued',     cls: 'chip-queued',      icon: <Clock size={10} /> },
    processing: { label: 'Processing', cls: 'chip-processing',  icon: <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2, borderColor: '#bfdbfe', borderTopColor: '#2563eb' }} /> },
    done:       { label: 'Done',       cls: 'chip-done',        icon: <CheckCircle2 size={10} /> },
    failed:     { label: 'Failed',     cls: 'chip-failed',      icon: <AlertCircle size={10} /> },
  };
  const { label, cls, icon } = map[status] || { label: status, cls: 'chip-queued', icon: null };
  return (
    <span className={`chip ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

/**
 * BatchStatus
 *
 * Props:
 *   batchId: string
 *   onReset()           – go back to upload idle state
 *   onComplete(batchId) – called when all files are terminal
 */
function BatchStatus({ batchId, onReset, onComplete }) {
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState({}); // fileId -> bool
  const intervalRef = useRef(null);
  const completedRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await getBatchStatus(batchId);
      setBatch(data);
      setError(null);

      const files = data.files || [];
      const allTerminal = files.length > 0 && files.every((f) => TERMINAL.has(f.status));
      const allDone = files.every((f) => f.status === 'done');

      if (allTerminal) {
        clearInterval(intervalRef.current);
        if (allDone && !completedRef.current) {
          completedRef.current = true;
          // Don't auto-navigate – let user click the button
        }
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to fetch status');
    }
  }, [batchId]);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchStatus]);

  const handleRetry = async (fileId) => {
    setRetrying((r) => ({ ...r, [fileId]: true }));
    try {
      await retryFile(fileId);
      // Re-start polling if it stopped
      clearInterval(intervalRef.current);
      completedRef.current = false;
      await fetchStatus();
      intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('Retry failed', err);
    } finally {
      setRetrying((r) => ({ ...r, [fileId]: false }));
    }
  };

  /* ── Derived stats ── */
  const files = batch?.files || [];
  const total = files.length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;
  const allTerminal = total > 0 && files.every((f) => TERMINAL.has(f.status));
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="card">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>
            Batch Processing
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ID: <span className="batch-badge">{batchId}</span>
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onReset}>
          ← New Upload
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: '0.82rem',
            color: '#dc2626',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* ── Progress ── */}
      {batch && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: '#64748b',
              marginBottom: 4,
            }}
          >
            <span>
              {doneCount} / {total} files complete
              {failedCount > 0 && (
                <span style={{ color: '#dc2626', marginLeft: 8 }}>
                  · {failedCount} failed
                </span>
              )}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-wrap" style={{ marginBottom: 20 }}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}

      {/* ── File table ── */}
      {!batch ? (
        <div className="spinner-overlay">
          <span className="spinner spinner-lg" />
          <span>Loading batch status…</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>File Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8' }}>
                    No files in this batch.
                  </td>
                </tr>
              )}
              {files.map((file, idx) => (
                <tr key={file.file_id || file.id || idx}>
                  <td style={{ color: '#94a3b8', width: 40 }}>{idx + 1}</td>
                  <td title={file.file_name}>{file.file_name}</td>
                  <td>
                    <StatusChip status={file.status} />
                  </td>
                  <td>
                    {file.status === 'failed' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {file.error && (
                          <div className="tooltip-wrap">
                            <AlertCircle size={14} color="#dc2626" />
                            <div className="tooltip-box">{file.error}</div>
                          </div>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRetry(file.file_id || file.id)}
                          disabled={retrying[file.file_id || file.id]}
                        >
                          {retrying[file.file_id || file.id] ? (
                            <Loader2 size={11} className="spin" />
                          ) : (
                            <RefreshCw size={11} />
                          )}
                          Retry
                        </button>
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <span style={{ fontSize: '0.75rem', color: '#2563eb' }}>
                        In progress…
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Success Completion Banner ── */}
      {allTerminal && doneCount > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: '16px 20px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} color="#16a34a" />
            <div>
              <div style={{ fontWeight: 600, color: '#15803d', fontSize: '0.95rem' }}>
                Extraction Completed Successfully!
              </div>
              <div style={{ color: '#166534', fontSize: '0.82rem', marginTop: 2 }}>
                Contacts have been processed and synced to Google Sheets.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a
              href="https://docs.google.com/spreadsheets/d/1AZqaSfoyhcjQOLif1xZfeGi9rfMWHwKDRJUaYuArJVE/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              Open in Google Sheets ↗
            </a>
            <button className="btn btn-primary btn-sm" onClick={onReset}>
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchStatus;
