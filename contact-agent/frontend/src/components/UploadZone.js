import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, FileSpreadsheet, Image, X, UploadCloud } from 'lucide-react';

/** 20 MB in bytes */
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
};

/** Returns an emoji icon + label for a MIME type */
function FileTypeIcon({ mimeType }) {
  if (mimeType === 'application/pdf')
    return <FileText size={16} color="#ef4444" />;
  if (mimeType === 'text/csv')
    return <FileSpreadsheet size={16} color="#16a34a" />;
  return <Image size={16} color="#2563eb" />;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * UploadZone
 *
 * Props:
 *   onUpload(files: File[]) – called when user clicks Upload
 *   uploading: boolean       – controls disabled / loading state
 */
function UploadZone({ onUpload, uploading = false }) {
  const [files, setFiles] = useState([]);
  const [sizeErrors, setSizeErrors] = useState([]);

  const onDrop = useCallback((accepted, rejected) => {
    const oversized = [];

    // Client-side size guard (react-dropzone also validates, but belt-and-suspenders)
    const valid = accepted.filter((f) => {
      if (f.size > MAX_SIZE_BYTES) {
        oversized.push(`${f.name} exceeds 20 MB`);
        return false;
      }
      return true;
    });

    rejected.forEach((r) => {
      r.errors.forEach((e) => oversized.push(`${r.file.name}: ${e.message}`));
    });

    setSizeErrors(oversized);
    if (valid.length > 0) {
      setFiles([valid[0]]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: false,
    maxFiles: 1,
    maxSize: MAX_SIZE_BYTES,
  });

  const removeFile = (name) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = () => {
    if (files.length === 0 || uploading) return;
    onUpload(files);
  };

  /* ── Styles ── */
  const dropzoneStyle = {
    border: `2px dashed ${isDragActive ? '#2563eb' : '#cbd5e1'}`,
    borderRadius: 12,
    padding: '48px 32px',
    textAlign: 'center',
    cursor: 'pointer',
    background: isDragActive ? '#eff6ff' : '#f8fafc',
    transition: 'all 0.2s ease',
    marginBottom: 20,
  };

  return (
    <div>
      {/* Drop zone */}
      <div {...getRootProps()} style={dropzoneStyle}>
        <input {...getInputProps()} />
        <UploadCloud
          size={48}
          color={isDragActive ? '#2563eb' : '#94a3b8'}
          style={{ marginBottom: 12 }}
        />
        {isDragActive ? (
          <p style={{ color: '#2563eb', fontWeight: 600 }}>Drop files here…</p>
        ) : (
          <>
            <p style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
              Drag & drop 1 file here, or click to browse
            </p>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Accepted formats: PDF, CSV, JPEG, PNG, GIF (1 file, max 20 MB)
            </p>
          </>
        )}
      </div>

      {/* Size / type errors */}
      {sizeErrors.length > 0 && (
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
          {sizeErrors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      {/* Selected file list */}
      {files.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            marginBottom: 20,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#475569',
            }}
          >
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </div>
          {files.map((file) => (
            <div
              key={file.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <FileTypeIcon mimeType={file.type} />
              <span
                style={{
                  flex: 1,
                  fontSize: '0.875rem',
                  color: '#334155',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <span
                style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}
              >
                {formatSize(file.size)}
              </span>
              <button
                onClick={() => removeFile(file.name)}
                disabled={uploading}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          style={{ minWidth: 120 }}
        >
          {uploading ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Uploading…
            </>
          ) : (
            <>
              <UploadCloud size={15} />
              Upload {files.length > 0 ? `(${files.length})` : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default UploadZone;
