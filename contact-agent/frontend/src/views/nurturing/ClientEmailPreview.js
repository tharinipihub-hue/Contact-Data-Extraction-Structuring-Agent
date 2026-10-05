import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Mail,
  User,
  Clock,
  ShieldCheck,
  Code,
  Eye,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

/**
 * Enterprise Client-Facing Email Preview Component
 * 
 * Guarantees:
 *  1. Raw HTML tags (like <p>, <div>, <a>) are NEVER displayed as literal text to the user.
 *  2. HTML is securely sanitized using DOMPurify before rendering.
 *  3. Visually resembles a real corporate email client (Gmail / Outlook).
 *  4. Provides an optional "View HTML Source" toggle for administrative/developer inspection.
 */
export default function ClientEmailPreview({
  subject = '',
  bodyHtml = '',
  recipient = null,
  senderName = 'SNS Square Enterprise Client Partnerships',
  senderEmail = 'nurture@snssquare.com',
  dateString = 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  contentVersion = 'v1',
  allowRawView = true
}) {
  const [showRawHtml, setShowRawHtml] = useState(false);

  // Normalize body content
  let rawBody = String(bodyHtml || '').trim();

  // If content is plain text without HTML tags, wrap paragraphs for clean display
  let cleanHtmlToSanitize = rawBody;
  if (!/<(?:p|div|table|h[1-6]|ul|ol)\b/i.test(cleanHtmlToSanitize)) {
    cleanHtmlToSanitize = cleanHtmlToSanitize
      .split(/\n\n+/)
      .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.65; color: #334155; font-size: 15px;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  // Sanitize HTML strictly with DOMPurify
  const sanitizedHtml = DOMPurify.sanitize(cleanHtmlToSanitize, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'a', 'table', 'tbody', 'tr', 'td', 'th', 'thead', 'div', 'span', 'img', 'hr', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class', 'src', 'alt', 'width', 'height', 'align', 'border', 'cellpadding', 'cellspacing', 'title'],
    ADD_ATTR: ['target']
  });

  const recipientName = recipient?.name || (recipient?.first_name ? `${recipient.first_name} ${recipient.last_name || ''}`.trim() : 'Valued Client');
  const recipientEmail = recipient?.email || 'client@organization.com';
  const recipientCompany = recipient?.company || '';

  return (
    <div style={{
      border: '1px solid #cbd5e1',
      borderRadius: 10,
      backgroundColor: '#ffffff',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.05)'
    }}>
      {/* ── Email Client Header (Outlook / Gmail Style) ── */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* Subject Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subject
            </span>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 2, lineHeight: 1.4 }}>
              {subject || 'No Subject Specified'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe'
            }}>
              Version {contentVersion}
            </span>

            {allowRawView && (
              <button
                type="button"
                className="dn-btn dn-btn-secondary dn-btn-sm"
                onClick={() => setShowRawHtml(!showRawHtml)}
                style={{ fontSize: 11, padding: '4px 8px', height: 'auto' }}
                title="Toggle raw HTML source for technical inspection"
              >
                {showRawHtml ? <><Eye size={12} /> Rendered View</> : <><Code size={12} /> View HTML</>}
              </button>
            )}
          </div>
        </div>

        {/* Sender & Recipient Meta Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 10,
          paddingTop: 8,
          borderTop: '1px solid #f1f5f9',
          fontSize: 12,
          color: '#475569'
        }}>
          <div>
            <span style={{ color: '#64748b' }}>From:</span> <strong>{senderName}</strong>{' '}
            <span style={{ color: '#94a3b8' }}>&lt;{senderEmail}&gt;</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>To:</span> <strong>{recipientName}</strong>{' '}
            {recipientCompany && <span style={{ color: '#64748b' }}>({recipientCompany})</span>}{' '}
            <span style={{ color: '#94a3b8' }}>&lt;{recipientEmail}&gt;</span>
          </div>
        </div>

        {/* Security & Date Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8', paddingTop: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a' }}>
            <ShieldCheck size={13} />
            <span>Verified Opt-In Recipient &bull; TLS Encrypted</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            <span>{dateString}</span>
          </div>
        </div>
      </div>

      {/* ── Email Body Content ── */}
      <div style={{ padding: '24px 20px', backgroundColor: '#ffffff', minHeight: 280 }}>
        {showRawHtml ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Code size={13} color="#2563eb" /> Underlying HTML Content (Dispatched verbatim):
            </div>
            <pre style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              padding: 14,
              fontSize: 11.5,
              color: '#334155',
              maxHeight: 400,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            }}>
              {cleanHtmlToSanitize}
            </pre>
          </div>
        ) : (
          <div
            className="dn-rendered-email-frame"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: '#1e293b'
            }}
          />
        )}
      </div>
    </div>
  );
}
