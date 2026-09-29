import React from 'react';
import ContactsTable from '../components/ContactsTable';
import { UploadCloud } from 'lucide-react';

/**
 * ContactsView
 *
 * Shows extracted contacts for the current batch.
 * ContactsTable polls until contacts appear.
 *
 * Props:
 *   batchId?: string    – the batch ID from the last upload (filters contacts to that file)
 *   onUploadMore()      – navigate back to UploadView
 */
function ContactsView({ batchId, onUploadMore }) {
  return (
    <div>
      {/* ── Page header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <div className="section-title">Extracted Contacts</div>
          <div className="section-subtitle" style={{ marginBottom: 0 }}>
            {batchId
              ? 'Contacts extracted from your uploaded file by Workbench.'
              : 'All contacts extracted across all uploaded files.'}
          </div>
        </div>

        <button className="btn btn-primary" onClick={onUploadMore}>
          <UploadCloud size={15} />
          Upload Another File
        </button>
      </div>

      {/* ── Contacts table — auto-polls until contacts arrive ── */}
      <ContactsTable batchId={batchId} />
    </div>
  );
}

export default ContactsView;
