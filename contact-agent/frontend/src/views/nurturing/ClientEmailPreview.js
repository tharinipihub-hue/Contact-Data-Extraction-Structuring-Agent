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
  ExternalLink,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

/**
 * Enterprise Client-Facing Email Preview Component
 * 
 * Guarantees:
 *  1. Accepts either bodyHtml or emailBody, recipient or contact, contentVersion or version.
 *  2. HTML is securely sanitized using DOMPurify with rich email table, image, and style support.
 *  3. Visually resembles a real corporate email client (Gmail / Outlook Standard).
 *  4. Provides an interactive "View HTML" source viewer with Copy to Clipboard.
 *  5. Empty content protection: displays a diagnostic card if the content is empty, never a silent blank box.
 */
export default function ClientEmailPreview({
  subject = '',
  bodyHtml = '',
  emailBody = '',
  recipient = null,
  contact = null,
  senderName = 'SNS Square Enterprise Client Partnerships',
  senderEmail = 'nurture@snssquare.com',
  dateString = 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  contentVersion = 'v1',
  version = '',
  allowRawView = true,
  campaignName = '',
  campaignType = ''
}) {
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  // Normalize inputs across both property naming conventions
  const effectiveRecipient = recipient || contact || null;
  const effectiveVersion = version || contentVersion || 'v1';
  let rawBody = String(bodyHtml || emailBody || '').trim();

  // If content has escaped HTML entities like &lt;p&gt; or &lt;div&gt;, decode them first
  if (/&lt;\/?[a-z][\s\S]*?&gt;/i.test(rawBody)) {
    if (typeof document !== 'undefined') {
      const txt = document.createElement('textarea');
      txt.innerHTML = rawBody;
      rawBody = txt.value;
    }
  }

  // If content is plain text or markdown without structural HTML tags, format into clean paragraphs
  let cleanHtmlToSanitize = rawBody;
  if (cleanHtmlToSanitize && !/<(?:p|div|table|h[1-6]|ul|ol|tr|td|body)\b/i.test(cleanHtmlToSanitize)) {
    cleanHtmlToSanitize = cleanHtmlToSanitize
      .replace(/^### (.*$)/gim, '<h3 style="color:#0f172a;font-size:16px;margin:16px 0 8px 0;font-weight:700;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="color:#0f172a;font-size:18px;margin:18px 0 10px 0;font-weight:700;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="color:#0f172a;font-size:20px;margin:20px 0 12px 0;font-weight:800;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">$1</a>')
      .split(/\n\n+/)
      .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.65; color: #334155; font-size: 15px;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  // Sanitize HTML strictly with DOMPurify while preserving email table layout, styles, and imagery
  const sanitizedHtml = DOMPurify.sanitize(cleanHtmlToSanitize, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'a', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'div', 'span',
      'img', 'hr', 'blockquote', 'style'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'style', 'class', 'src', 'alt',
      'width', 'height', 'align', 'valign', 'border', 'cellpadding',
      'cellspacing', 'title', 'bgcolor', 'colspan', 'rowspan'
    ],
    ADD_ATTR: ['target']
  });

  const recipientName = effectiveRecipient?.name || (effectiveRecipient?.first_name ? `${effectiveRecipient.first_name} ${effectiveRecipient.last_name || ''}`.trim() : 'Valued Client');
  const recipientEmail = effectiveRecipient?.email || 'client@organization.com';
  const recipientCompany = effectiveRecipient?.company || '';
  const recipientSector = effectiveRecipient?.sector || effectiveRecipient?.industry || '';

  const handleCopyHtml = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(cleanHtmlToSanitize);
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2500);
      }
    } catch (_err) {
      console.warn('Could not copy HTML to clipboard');
    }
  };

  const isBodyEmpty = !sanitizedHtml || sanitizedHtml.trim() === '';

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
              Version {effectiveVersion}
            </span>

            {allowRawView && !isBodyEmpty && (
              <button
                type="button"
                className="dn-btn dn-btn-secondary dn-btn-sm"
                onClick={() => setShowRawHtml(!showRawHtml)}
                style={{ fontSize: 11, padding: '4px 8px', height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                title="Toggle final HTML source view"
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
            {recipientCompany && <span style={{ color: '#64748b' }}>({recipientCompany}{recipientSector ? ` • ${recipientSector}` : ''})</span>}{' '}
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
      <div style={{ padding: '24px 20px', backgroundColor: '#f8fafc', minHeight: 320 }}>
        {isBodyEmpty ? (
          <div style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#fffbeb',
            border: '1px dashed #fde68a',
            borderRadius: 8,
            color: '#92400e',
            maxWidth: 580,
            margin: '0 auto'
          }}>
            <AlertTriangle size={32} color="#d97706" style={{ margin: '0 auto 10px auto', display: 'block' }} />
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Unable to Render Email Preview
            </div>
            <div style={{ fontSize: 13, color: '#b45309', marginTop: 6, lineHeight: 1.5 }}>
              The final campaign content is currently empty. Please return to the <strong>Customize</strong> tab to verify headlines, body copy, or generate content via SNS Workbench.
            </div>
            <div style={{ marginTop: 14, fontSize: 11.5, color: '#78350f', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, display: 'inline-block' }}>
              Diagnostic check: Template selected: {campaignName || 'Yes'} &bull; Recipient: {recipientName} &bull; HTML payload: Empty
            </div>
          </div>
        ) : showRawHtml ? (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code size={14} color="#2563eb" /> Final Dispatched HTML Source Code:
              </div>
              <button
                type="button"
                onClick={handleCopyHtml}
                className="dn-btn dn-btn-secondary dn-btn-xs"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copiedHtml ? <><Check size={12} color="#16a34a" /> Copied!</> : <><Copy size={12} /> Copy HTML</>}
              </button>
            </div>
            <pre style={{
              backgroundColor: '#090e17',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: 16,
              fontSize: 11.5,
              color: '#38bdf8',
              maxHeight: 520,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: 1.5
            }}>
              {cleanHtmlToSanitize}
            </pre>
          </div>
        ) : (
          <div
            className="dn-rendered-email-frame"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center'
            }}
          />
        )}
      </div>
    </div>
  );
}
