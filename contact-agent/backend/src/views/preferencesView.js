'use strict';

function renderPreferencePage(contact, isUnsubscribe = false) {
  const publicAppUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const isOptedIn = contact?.opt_in === true;
  const contactId = contact?.id || '';
  const name = contact?.name || 'Contact not found';
  const company = contact?.company || '';
  const email = contact?.email || '';
  const role = contact?.designation || '';
  const sector = contact?.sector || contact?.industry || '';
  const prefs = contact?.preferences || {
    email_newsletters: false,
    executive_briefings: false,
    case_studies: false,
    frequency: 'bi-weekly'
  };
  const preferenceActions = !contact ? '' : isOptedIn ? `
            <button type="button" class="btn btn-primary" id="btnSavePreferences">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Save Communication Preferences
            </button>
            <button type="button" class="btn btn-danger" id="btnUnsubscribeAll">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              Unsubscribe from All Communications
            </button>
  ` : `
            <button type="button" class="btn btn-resubscribe" id="btnResubscribe">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Re-Subscribe to Executive Newsletters
            </button>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Communication Preferences & Opt-Out | Digital Nurturing Network</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --danger: #ef4444;
      --danger-dark: #dc2626;
      --success: #10b981;
      --success-dark: #059669;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #eff6ff 50%, #f8fafc 100%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .pref-container {
      width: 100%;
      max-width: 620px;
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border);
      overflow: hidden;
    }

    .pref-header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: #ffffff;
      padding: 28px 32px;
      position: relative;
    }

    .pref-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #93c5fd;
      margin-bottom: 8px;
    }

    .pref-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .pref-subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 6px;
      line-height: 1.5;
    }

    .pref-body {
      padding: 32px;
    }

    /* Client Info Card */
    .client-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    .client-info h3 {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
    }

    .client-info p {
      font-size: 12.5px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-badge.opted-in {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }

    .status-badge.opted-out {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Option Items */
    .pref-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .pref-option:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .pref-option input[type="checkbox"],
    .pref-option input[type="radio"] {
      margin-top: 3px;
      width: 17px;
      height: 17px;
      cursor: pointer;
      accent-color: var(--primary);
    }

    .pref-option-text h4 {
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text);
    }

    .pref-option-text p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
      line-height: 1.4;
    }

    .frequency-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }

    .freq-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .freq-card:hover {
      border-color: var(--primary);
    }

    .freq-card.active {
      border-color: var(--primary);
      background: #eff6ff;
    }

    .freq-card input {
      display: none;
    }

    .freq-card span {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    /* Buttons */
    .button-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 28px;
    }

    .btn {
      width: 100%;
      padding: 13px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
    }

    .btn-danger {
      background: #fef2f2;
      color: var(--danger-dark);
      border: 1px solid #fecaca;
    }

    .btn-danger:hover {
      background: #fee2e2;
    }

    .btn-resubscribe {
      background: var(--success);
      color: #ffffff;
    }

    .btn-resubscribe:hover {
      background: var(--success-dark);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    /* Alert Banner */
    .pref-alert {
      padding: 14px 18px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pref-alert.danger {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }

    .pref-alert.success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }

    /* Footer */
    .pref-footer {
      border-top: 1px solid var(--border);
      padding: 18px 32px;
      background: #f8fafc;
      font-size: 11.5px;
      color: var(--text-muted);
      text-align: center;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pref-footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    .pref-footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      .pref-header, .pref-body, .pref-footer { padding: 20px; }
      .frequency-grid { grid-template-columns: 1fr; }
      .client-card { flex-direction: column; align-items: flex-start; }
      .pref-footer { flex-direction: column; gap: 8px; }
    }
  </style>
</head>
<body>

  <div class="pref-container">
    <div class="pref-header">
      <div class="pref-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Enterprise Communication Preference Center
      </div>
      <h1 class="pref-title">Manage Your Email Preferences</h1>
      <p class="pref-subtitle">Control the frequency, content topics, and automated newsletters you receive from the Digital Client Nurturing Network.</p>
    </div>

    <div class="pref-body">
      <!-- Live Status Message -->
      <div id="statusAlert" style="display: none;" class="pref-alert"></div>

      ${isUnsubscribe && contact ? `
        <div class="pref-alert success" style="margin-bottom: 20px; display: flex; align-items: center; gap: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 14px 18px; border-radius: 8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <strong style="font-size: 15px; display: block; margin-bottom: 2px;">Unsubscribe Confirmation</strong>
            <div style="font-size: 13.5px;">You have been successfully unsubscribed from all digital nurturing communications, executive briefings, and automated newsletters.</div>
          </div>
        </div>
      ` : ''}

      ${contact && !isOptedIn && !isUnsubscribe ? `
        <div class="pref-alert danger">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <strong>You are currently unsubscribed.</strong>
            <div>You will not receive any automated newsletters, executive capability updates, or strategic briefings.</div>
          </div>
        </div>
      ` : ''}

      ${!contact ? `
        <div class="pref-alert danger" style="margin-bottom: 20px;">
          No matching contact record was found. No communication preference was changed.
        </div>
      ` : ''}

      <!-- Client Info Card -->
      <div class="client-card">
        <div class="client-info">
          <h3>${name}</h3>
          <p>${role} • <strong>${company}</strong></p>
          <p>${email} • <em>Sector: ${sector}</em></p>
        </div>
        <div>
          <span class="status-badge ${isOptedIn ? 'opted-in' : 'opted-out'}" id="currentStatusBadge">
            ${!contact ? '● Contact Not Found' : (isOptedIn ? '● Active (Opted In)' : '● Inactive / Pending Consent')}
          </span>
        </div>
      </div>

      <form id="preferencesForm">
        <div class="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Content & Newsletter Subscriptions
        </div>

        <label class="pref-option">
          <input type="checkbox" id="chkNewsletter" ${prefs.email_newsletters ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
          <div class="pref-option-text">
            <h4>${sector} Industry Intelligence & Sector Briefings</h4>
            <p>Curated insights, market dynamics, and competitive updates specific to the ${sector} landscape.</p>
          </div>
        </label>

        <label class="pref-option">
          <input type="checkbox" id="chkExecutive" ${prefs.executive_briefings ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
          <div class="pref-option-text">
            <h4>Executive Announcements & Capability Previews</h4>
            <p>Direct briefings on new agentic workflows, architecture scaling, and partnership roadmap milestones.</p>
          </div>
        </label>

        <label class="pref-option">
          <input type="checkbox" id="chkCaseStudies" ${prefs.case_studies ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
          <div class="pref-option-text">
            <h4>Case Studies & Implementation Results</h4>
            <p>Real-world benchmark data, technical whitepapers, and operational ROI case studies.</p>
          </div>
        </label>

        <div class="section-title" style="margin-top: 24px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Delivery Cadence
        </div>

        <div class="frequency-grid">
          <label class="freq-card ${prefs.frequency === 'weekly' ? 'active' : ''}">
            <input type="radio" name="frequency" value="weekly" ${prefs.frequency === 'weekly' ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
            <span>Weekly Digest</span>
          </label>
          <label class="freq-card ${(!prefs.frequency || prefs.frequency === 'bi-weekly') ? 'active' : ''}">
            <input type="radio" name="frequency" value="bi-weekly" ${(!prefs.frequency || prefs.frequency === 'bi-weekly') ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
            <span>Bi-Weekly</span>
          </label>
          <label class="freq-card ${prefs.frequency === 'monthly' ? 'active' : ''}">
            <input type="radio" name="frequency" value="monthly" ${prefs.frequency === 'monthly' ? 'checked' : ''} ${!isOptedIn ? 'disabled' : ''}>
            <span>Monthly Review</span>
          </label>
        </div>

        <div class="button-stack">
          ${preferenceActions}
          <a href="${publicAppUrl || '/'}" class="btn btn-secondary">
            ← Return to Digital Nurturing Dashboard
          </a>
        </div>
      </form>
    </div>

    <div class="pref-footer">
      <span>Enterprise Privacy & CAN-SPAM / GDPR Compliant</span>
      <a href="${publicAppUrl || '/'}" target="_blank">Open App</a>
    </div>
  </div>

  <script>
    const contactId = "${contactId}";

    // Handle Frequency selection styling
    document.querySelectorAll('.freq-card input').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.freq-card').forEach(c => c.classList.remove('active'));
        radio.closest('.freq-card').classList.add('active');
      });
    });

    const showAlert = (message, isSuccess = true) => {
      const alert = document.getElementById('statusAlert');
      alert.style.display = 'flex';
      alert.className = 'pref-alert ' + (isSuccess ? 'success' : 'danger');
      alert.innerHTML = isSuccess 
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div>' + message + '</div>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div>' + message + '</div>';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Save Preferences
    const btnSave = document.getElementById('btnSavePreferences');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        btnSave.disabled = true;
        btnSave.textContent = 'Saving Preferences...';
        try {
          const freq = document.querySelector('input[name="frequency"]:checked')?.value || 'bi-weekly';
          const payload = {
            opt_in: true,
            email_newsletters: document.getElementById('chkNewsletter').checked,
            executive_briefings: document.getElementById('chkExecutive').checked,
            case_studies: document.getElementById('chkCaseStudies').checked,
            frequency: freq
          };
          const res = await fetch('/api/contacts/' + encodeURIComponent(contactId) + '/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            showAlert('Your communication preferences have been saved and synced with the CRM.', true);
            setTimeout(() => window.location.reload(), 1200);
          } else {
            showAlert('Error saving preferences: ' + (data.error || 'Server error'), false);
          }
        } catch (err) {
          showAlert('Failed to connect to server: ' + err.message, false);
        } finally {
          btnSave.disabled = false;
          btnSave.innerHTML = 'Save Communication Preferences';
        }
      });
    }

    // Unsubscribe from All
    const btnUnsub = document.getElementById('btnUnsubscribeAll');
    if (btnUnsub) {
      btnUnsub.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to unsubscribe from all digital nurturing communications?')) return;
        btnUnsub.disabled = true;
        btnUnsub.textContent = 'Unsubscribing...';
        try {
          const res = await fetch('/api/contacts/' + encodeURIComponent(contactId) + '/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opt_in: false })
          });
          const data = await res.json();
          if (data.success) {
            showAlert('You have been successfully unsubscribed from all communications.', true);
            setTimeout(() => window.location.reload(), 1200);
          } else {
            showAlert('Error: ' + (data.error || 'Server error'), false);
          }
        } catch (err) {
          showAlert('Failed to connect to server: ' + err.message, false);
        } finally {
          btnUnsub.disabled = false;
          btnUnsub.innerHTML = 'Unsubscribe from All Communications';
        }
      });
    }

    // Re-Subscribe
    const btnResub = document.getElementById('btnResubscribe');
    if (btnResub) {
      btnResub.addEventListener('click', async () => {
        btnResub.disabled = true;
        btnResub.textContent = 'Re-subscribing...';
        try {
          const res = await fetch('/api/contacts/' + encodeURIComponent(contactId) + '/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opt_in: true })
          });
          const data = await res.json();
          if (data.success) {
            showAlert('Welcome back! You have successfully re-subscribed to sector intelligence newsletters.', true);
            setTimeout(() => window.location.reload(), 1200);
          } else {
            showAlert('Error: ' + (data.error || 'Server error'), false);
          }
        } catch (err) {
          showAlert('Failed to connect to server: ' + err.message, false);
        } finally {
          btnResub.disabled = false;
          btnResub.innerHTML = 'Re-Subscribe to Executive Newsletters';
        }
      });
    }
  </script>
</body>
</html>`;
}

module.exports = { renderPreferencePage };
