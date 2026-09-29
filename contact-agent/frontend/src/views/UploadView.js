import React, { useState } from 'react';
import UploadZone from '../components/UploadZone';
import BatchStatus from '../components/BatchStatus';
import { uploadFiles } from '../api';

/**
 * UploadView
 *
 * State machine:
 *   'idle'      → show file picker (UploadZone)
 *   'uploading' → show spinner while file is sent to backend
 *   'tracking'  → show BatchStatus (polls backend until Workbench finishes)
 *
 * Props:
 *   onComplete(batchId) – called when processing is done; App navigates to ContactsView
 */
function UploadView({ onComplete }) {
  const [phase, setPhase] = useState('idle');
  const [batchId, setBatchId] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  /* ─── Send the file to the backend ─── */
  const handleUpload = async (files) => {
    setUploadError(null);
    setPhase('uploading');

    const formData = new FormData();
    // Only 1 file allowed — always use index 0
    formData.append('files', files[0]);

    try {
      const { data } = await uploadFiles(formData);
      const id = data.batch_id || data.batchId || data.id;
      if (!id) throw new Error('Server did not return a batch ID');
      setBatchId(id);
      setPhase('tracking');
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        'Upload failed. Please try again.';
      setUploadError(msg);
      setPhase('idle');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setBatchId(null);
    setUploadError(null);
  };

  /* ── idle ── */
  if (phase === 'idle') {
    return (
      <div>
        <div className="section-title">Upload File</div>
        <div className="section-subtitle">
          Upload one PDF, CSV, or image. Workbench will extract all contacts and display them here.
        </div>

        {uploadError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 16px',
              marginBottom: 20,
              fontSize: '0.875rem',
              color: '#dc2626',
            }}
          >
            ⚠ {uploadError}
          </div>
        )}

        <div className="card">
          <UploadZone onUpload={handleUpload} uploading={false} />
        </div>
      </div>
    );
  }

  /* ── uploading ── */
  if (phase === 'uploading') {
    return (
      <div className="card">
        <div className="spinner-overlay">
          <span className="spinner spinner-lg" />
          <span style={{ fontWeight: 600 }}>Sending file to Workbench…</span>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Please wait while your file is uploaded.
          </span>
        </div>
      </div>
    );
  }

  /* ── tracking ── */
  return (
    <div>
      <div className="section-title">Processing File</div>
      <div className="section-subtitle">
        Workbench is extracting contacts from your file. This updates automatically.
      </div>
      <BatchStatus
        batchId={batchId}
        onReset={handleReset}
        onComplete={onComplete}
      />
    </div>
  );
}

export default UploadView;
