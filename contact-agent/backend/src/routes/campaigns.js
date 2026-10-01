'use strict';

const express = require('express');
const router = express.Router();
const nurtureStore = require('../services/nurtureStore');
const workbenchService = require('../services/nurtureWorkbenchService');

// Get all campaigns
router.get('/', (req, res) => {
  try {
    res.json({ success: true, campaigns: nurtureStore.getCampaigns(), audit_logs: nurtureStore.getAuditLogs(), stats: nurtureStore.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: `Could not load campaigns: ${err.message}` });
  }
});

// Get recent telemetry audit logs
router.get('/audit-logs', (req, res) => {
  res.json({
    success: true,
    logs: nurtureStore.getAuditLogs()
  });
});

// Delete a campaign
router.delete('/:id', (req, res) => {
  try {
    const deleted = nurtureStore.deleteCampaign(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, message: 'Campaign deleted successfully', campaign: deleted, campaigns: nurtureStore.getCampaigns(), stats: nurtureStore.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: `Could not delete campaign: ${err.message}` });
  }
});

async function uploadToFreeImage(sourceDataOrPath) {
  try {
    if (!sourceDataOrPath) return null;
    if (typeof sourceDataOrPath === 'string' && (sourceDataOrPath.startsWith('http://') || sourceDataOrPath.startsWith('https://'))) {
      return sourceDataOrPath;
    }

    if (typeof sourceDataOrPath === 'string' && sourceDataOrPath.startsWith('data:image/')) {
      const base64Data = sourceDataOrPath.split(',')[1];
      const formData = new FormData();
      if (!process.env.FREEIMAGE_API_KEY) throw new Error('FREEIMAGE_API_KEY is not configured');
      formData.append('key', process.env.FREEIMAGE_API_KEY);
      formData.append('action', 'upload');
      formData.append('source', base64Data);
      formData.append('format', 'json');

      const res = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data && data.image && (data.image.url || data.image.display_url)) {
        return data.image.url || data.image.display_url;
      }
    }
  } catch (err) {
    console.warn('[uploadToFreeImage] Upload error:', err.message);
  }
  return null;
}

// Upload custom poster image endpoint (returns public HTTPS URL for Gmail delivery)
router.post('/upload-image', async (req, res) => {
  try {
    const { image_data, filename } = req.body;
    if (!image_data) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }
    const publicUrl = await uploadToFreeImage(image_data);
    if (publicUrl) {
      return res.json({ success: true, url: publicUrl });
    }
    return res.status(502).json({ success: false, error: 'Image hosting failed; no image was uploaded.' });
  } catch (err) {
    console.error('[Upload Image Error]:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

function getUnsubscribeBaseUrl(req) {
  if (process.env.UNSUBSCRIBE_BASE_URL) {
    return process.env.UNSUBSCRIBE_BASE_URL.replace(/\/+$/, '');
  }
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  let host = req ? (req.headers['x-forwarded-host'] || req.headers.host) : null;
  const proto = req ? (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')) : 'http';
  if (host && /^(localhost|127\.0\.0\.1):3000$/i.test(host)) {
    host = host.replace(/:3000$/i, ':4000');
  }
  return host ? `${proto}://${host}` : '';
}

function useConfiguredPreferenceLinks(emailBody, unsubscribeUrl, preferencesUrl) {
  return String(emailBody || '').replace(
    /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\/(unsubscribe|preferences)(?:\?[^\s"'<>]*)?/gi,
    (_match, page) => page.toLowerCase() === 'unsubscribe' ? unsubscribeUrl : preferencesUrl
  );
}

function extractWorkbenchAiContent(data) {
  if (!data) return null;

  // 1. Check for Groq / LLM model output nested inside content.parts or text
  // Workbench Groq node output typically formats as:
  // data.result.content.parts[0].text or data.content.parts[0].text
  let groqRaw = null;
  const candidates = [
    data.result?.content?.parts?.[0]?.text,
    data.content?.parts?.[0]?.text,
    data.result?.text,
    data.text,
    data.result?.choices?.[0]?.message?.content,
    data.choices?.[0]?.message?.content,
    data.result?.output,
    data.output
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      groqRaw = candidate.trim();
      break;
    }
  }

  if (groqRaw) {
    // Strip markdown code fences if present
    let cleaned = groqRaw;
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && (parsed.subject || parsed.email_body)) {
        return {
          subject: (parsed.subject || '').trim(),
          email_body: (parsed.email_body || '').trim(),
          personalization_summary: parsed.personalization_summary || 'Generated via SNS Workbench Groq AI'
        };
      }
    } catch (e) {
      // Try regex search for embedded JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.subject || parsed.email_body)) {
            return {
              subject: (parsed.subject || '').trim(),
              email_body: (parsed.email_body || '').trim(),
              personalization_summary: parsed.personalization_summary || 'Generated via SNS Workbench Groq AI'
            };
          }
        } catch (err) {}
      }
    }

    // Try regex extraction of Subject: and Body
    const subjectMatch = groqRaw.match(/^(?:Subject|Title):\s*(.+)$/im);
    if (subjectMatch) {
      const subj = subjectMatch[1].trim();
      const body = groqRaw.replace(/^(?:Subject|Title):\s*.+$/im, '').trim();
      if (body) {
        return {
          subject: subj,
          email_body: body,
          personalization_summary: 'Generated via SNS Workbench Groq AI'
        };
      }
    }
  }

  // 2. Check direct / structured fields in Workbench response
  const fieldSources = [
    data.nurtured_contact,
    data.result?.nurtured_contact,
    data.result,
    data
  ];

  for (const src of fieldSources) {
    if (src && typeof src === 'object') {
      const subject = src.subject;
      const email_body = src.email_body;
      if (subject && email_body && typeof subject === 'string' && typeof email_body === 'string' && subject.trim() && email_body.trim()) {
        return {
          subject: subject.trim(),
          email_body: email_body.trim(),
          personalization_summary: src.personalization_summary || 'Generated via SNS Workbench workflow'
        };
      }
    }
  }

  return null;
}

// Generate content & preview strictly using SNS Workbench Webhook (with Groq GPT-OSS-120B)
router.post('/test-webhook', async (req, res) => {
  try {
    let testContact = null;
    if (req.body?.contact_id) {
      testContact = nurtureStore.getContactById(req.body.contact_id);
    }
    const result = await workbenchService.testNurturingWebhook(testContact);
    return res.status(result.status >= 200 && result.status < 300 ? 200 : 502).json(result);
  } catch (err) {
    return res.status(err.status || 502).json({ success: false, error: err.message, status: err.status || 502 });
  }
});

router.post('/generate', async (req, res) => {
  const {
    campaign_type,
    campaign_name,
    occasion,
    topic,
    target_audience,
    channel,
    sector,
    contact_id,
    contacts
  } = req.body;

  let targetContact = null;
  if (contact_id) {
    targetContact = nurtureStore.getContactById(contact_id);
  }

  const brief = String(req.body.developer_input || req.body.topic || req.body.brief || '').trim();
  if (!brief) {
    return res.status(400).json({ success: false, error: 'Campaign brief is required.' });
  }

  let requestedContactList = Array.isArray(contacts) && contacts.length > 0 ? contacts : [];
  if (requestedContactList.length === 0 && (contact_id || targetContact)) {
    requestedContactList = [targetContact || contact_id];
  }
  if (requestedContactList.length === 0) {
    return res.status(400).json({ success: false, error: 'Select at least one opted-in audience contact before generating campaign content.' });
  }

  const allContacts = nurtureStore.getContacts();
  const requestedIds = new Set(requestedContactList.map(c => (typeof c === 'string' ? c : c?.id)).filter(Boolean));
  const recipientContacts = allContacts.filter(c => requestedIds.has(c.id));
  if (recipientContacts.length !== requestedIds.size) {
    return res.status(400).json({ success: false, error: 'One or more selected audience contacts could not be found. Refresh the audience and try again.' });
  }
  if (recipientContacts.some(c => c.opt_in !== true)) {
    return res.status(400).json({ success: false, error: 'The selected audience includes a contact without active opt-in consent.' });
  }
  if (contact_id && (!targetContact || targetContact.opt_in !== true || !requestedIds.has(targetContact.id))) {
    return res.status(400).json({ success: false, error: 'The selected contact has not opted in to nurturing communications.' });
  }

  const activeContact = targetContact || recipientContacts[0];
  const activeSector = sector || activeContact?.sector || activeContact?.industry || 'Technology';

  const developerInput = brief;
  const normalizedCampaignType = String(campaign_type || 'newsletter').toLowerCase();
  const campaignGuidance = normalizedCampaignType === 'welcome' || normalizedCampaignType === 'welcome message'
    ? [
        'CAMPAIGN TYPE: Welcome and onboarding email for a new client.',
        'Write a genuine, warm welcome to the recipient and their company. Briefly introduce SNS Square and give one practical next step for onboarding or getting started.',
        'Use the supplied campaign brief as context for the welcome; do not turn it into a generic executive update, newsletter, announcement, or strategy briefing.',
        'Do not use headings such as KEY ANNOUNCEMENT or STRATEGIC IMPACT. Keep the message concise and specific to the recipient.'
      ].join(' ')
    : '';


  const unsubBase = getUnsubscribeBaseUrl(req);
  const targetId = activeContact.id;
  const unsubUrl = `${unsubBase}/unsubscribe?id=${targetId}`;
  const prefUrl = `${unsubBase}/preferences?id=${targetId}`;

  const payload = {
    action: 'generate_preview',
    campaign_name: campaign_name || `${activeSector} Campaign: ${brief.slice(0, 40)}`,
    campaign_type: campaign_type || 'newsletter',
    developer_input: campaignGuidance ? `${campaignGuidance}\n\nCLIENT BRIEF: ${developerInput}` : developerInput,
    campaign_brief: developerInput,
    ...(occasion ? { occasion } : {}),
    sector: activeSector,
    target_segment: target_audience || `${activeSector} Sector Clients`,
    channel: channel || 'email',
    from_email: process.env.NURTURE_SENDER_EMAIL || '',
    sender_email: process.env.NURTURE_SENDER_EMAIL || '',
    contacts: recipientContacts,
    active_contact: activeContact,
    unsubscribe_url: unsubUrl,
    preferences_url: prefUrl
  };

  try {
    // Strictly trigger SNS Workbench workflow
    const result = await workbenchService.triggerNurturingWorkflow(payload);
    
    // Robustly extract Workbench Groq AI or workflow output
    const extracted = extractWorkbenchAiContent(result.data);

    if (extracted && extracted.subject && extracted.email_body && result.data?.success !== false) {
      const campaignId = req.body.campaign_id || `CMP-${require('crypto').randomUUID()}`;
      const previous = nurtureStore.getCampaigns().find(campaign => campaign.id === campaignId);
      const now = new Date().toISOString();
      const previewData = {
        ...((result.data?.nurtured_contact || result.data?.result || result.data) || {}),
        subject: extracted.subject,
        email_body: useConfiguredPreferenceLinks(extracted.email_body, unsubUrl, prefUrl),
        personalization_summary: extracted.personalization_summary || 'Generated via SNS Workbench',
        content_source: 'workbench'
      };

      const generatedCampaign = {
        ...(previous || {}),
        id: campaignId,
        name: campaign_name || `${activeSector} Campaign: ${brief.slice(0, 40)}`,
        type: campaign_type || 'newsletter',
        type_key: String(campaign_type || 'newsletter').toLowerCase().replace(/\s+/g, '_'),
        sector: activeSector,
        occasion: occasion || '',
        brief: developerInput,
        audience: target_audience || `${activeSector} Sector Clients`,
        target_audience: target_audience || `${activeSector} Sector Clients`,
        contact_ids: recipientContacts.map(contact => contact.id),
        recipient_contacts: recipientContacts.map(({ id, name, company, email }) => ({ id, name, company, email })),
        subject: previewData.subject,
        email_body: previewData.email_body,
        whatsapp_message: previewData.whatsapp_message || '',
        content_source: 'workbench',
        workbench_source: result.targetUrl,
        workbench_response: result.data,
        status: 'Draft',
        delivery_status: 'Not dispatched',
        channels: [channel || 'Email'],
        recipients: recipientContacts.length,
        recipients_count: recipientContacts.length,
        metrics: previous?.metrics || { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0 },
        created_at: previous?.created_at || now,
        updated_at: now,
        created_date: previous?.created_date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        sent_at: previous?.sent_at || null,
        sent_date: previous?.sent_date || '—'
      };
      if (previous) nurtureStore.updateCampaign(campaignId, generatedCampaign);
      else nurtureStore.addCampaign(generatedCampaign);
      previewData.campaign_id = campaignId;

      console.log('[Campaigns /generate] Successfully extracted Workbench content. Returning content_source: workbench');
      return res.json({
        success: true,
        source: result.source,
        content_source: 'workbench',
        targetUrl: result.targetUrl,
        preview: previewData,
        campaign: generatedCampaign,
        campaign_data: result.data
      });
    }

    return res.status(502).json({ success: false, source: 'workbench_error', content_source: 'unavailable', error: 'Workbench returned no usable campaign content.', requires_workbench: true });
  } catch (err) {
    console.error('[Campaigns /generate Error]:', err.message);
    return res.status(502).json({ success: false, source: 'workbench_error', content_source: 'unavailable', error: err.message, requires_workbench: true });
  }
});

// Approve & Dispatch Campaign strictly through SNS Workbench Webhook
router.post('/dispatch', async (req, res) => {
  try {
    const {
      campaign_name,
      campaign_id,
      campaign_type,
      occasion,
      topic,
      developer_input,
      audience,
      channels,
      sector,
      contact_id,
      content,
      image_url,
      schedule_type,
      scheduled_at
    } = req.body;

    const targetContactId = contact_id || req.body.contact_id || req.body.contact?.id || req.body.target_contact?.id;
    let targetContact = null;
    if (targetContactId) {
      targetContact = nurtureStore.getContactById(targetContactId);
    }

    let requestedContacts = req.body.contacts;
    if ((!Array.isArray(requestedContacts) || requestedContacts.length === 0) && (targetContactId || targetContact)) {
      requestedContacts = [targetContact || targetContactId];
    }
    if (!Array.isArray(requestedContacts) || requestedContacts.length === 0) {
      return res.status(400).json({ success: false, error: 'Select at least one opted-in audience contact before dispatching.' });
    }
    const requestedContactIds = new Set(requestedContacts.map(c => (typeof c === 'string' ? c : c?.id)).filter(Boolean));
    let targetAudienceContacts = nurtureStore.getContacts().filter(c => requestedContactIds.has(c.id));
    if (targetAudienceContacts.length !== requestedContactIds.size) {
      return res.status(400).json({ success: false, error: 'One or more selected audience contacts could not be found. Refresh the audience and try again.' });
    }
    if (targetAudienceContacts.some(c => c.opt_in !== true)) {
      return res.status(400).json({ success: false, error: 'The selected audience includes a contact without active opt-in consent.' });
    }
    if (targetContactId && (!targetContact || targetContact.opt_in !== true || !requestedContactIds.has(targetContact.id))) {
      return res.status(400).json({ success: false, error: 'The selected contact is not part of the opted-in campaign audience.' });
    }

    if (targetAudienceContacts.length === 0) {
      return res.status(400).json({ success: false, error: 'No opted-in contacts are available for campaign delivery.' });
    }

    const activeSector = sector || targetContact?.sector || targetContact?.industry || 'Technology';
    const finalDeveloperInput = developer_input || topic || occasion || '';
    const finalSubject = String(content?.subject || req.body.subject || '').trim();
    const finalBody = String(content?.email_body || req.body.email_body || content?.body || req.body.body || '').trim();
    if (!finalSubject || !finalBody) {
      return res.status(400).json({ success: false, error: 'Campaign subject and content are required before dispatch.' });
    }

    let finalImageUrl = image_url || content?.image_url || ''; 
    let publicImageUrl = null;
    if (finalImageUrl) {
      publicImageUrl = await uploadToFreeImage(finalImageUrl);
    }
    if (!publicImageUrl && finalImageUrl && finalImageUrl.startsWith('http')) {
      publicImageUrl = finalImageUrl;
    }
    if (finalImageUrl && !publicImageUrl) {
      return res.status(502).json({ success: false, error: 'Campaign poster could not be hosted.', requires_image_host: true });
    }

    const unsubBase = getUnsubscribeBaseUrl(req);
    const primaryContactId = targetContact?.id || targetAudienceContacts[0].id;
    const unsubUrl = `${unsubBase}/unsubscribe?id=${primaryContactId}`;
    const prefUrl = `${unsubBase}/preferences?id=${primaryContactId}`;

    let rawBody = finalBody;
    let finalEmailBody = rawBody;

    // Replace stale unsubscribe/preferences hosts with the current application origin.
    finalEmailBody = finalEmailBody
      .replace(/https?:\/\/[^\s"'<>]+\/unsubscribe(?:\?[^\s"'<>]*)?/gi, unsubUrl)
      .replace(/https?:\/\/[^\s"'<>]+\/preferences(?:\?[^\s"'<>]*)?/gi, prefUrl);

    const unsubscribeFooterHtml = `
<div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.6;">
  You are receiving this executive update because of your strategic collaboration with SNS Square.<br/>
  <a href="${unsubUrl}" style="color: #2563eb; text-decoration: underline; margin-right: 12px;">Unsubscribe</a> &bull; 
  <a href="${prefUrl}" style="color: #64748b; text-decoration: underline; margin-left: 12px;">Manage Preferences</a>
</div>`.trim();

    if (publicImageUrl && !rawBody.includes('<img')) {
      const formattedText = rawBody.split('\n\n').map(p => `<p style="margin: 0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
      finalEmailBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${publicImageUrl}" alt="Campaign Poster" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />
  </div>
  <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
    ${formattedText}
  </div>
  ${unsubscribeFooterHtml}
</div>`.trim();
    } else if (!finalEmailBody.includes('/unsubscribe')) {
      if (finalEmailBody.includes('</div>')) {
        const lastDivIdx = finalEmailBody.lastIndexOf('</div>');
        finalEmailBody = finalEmailBody.slice(0, lastDivIdx) + unsubscribeFooterHtml + '</div>';
      } else {
        finalEmailBody = finalEmailBody + `\n\n---\nTo update your preferences or unsubscribe, visit: ${unsubUrl}`;
      }
    }

    const payload = {
      action: 'approve_and_send',
      campaign_name: campaign_name || `${activeSector} Newsletter Dispatch`,
      campaign_type: campaign_type || 'newsletter',
      developer_input: finalDeveloperInput,
      occasion: finalDeveloperInput,
      sector: activeSector,
      target_segment: audience || `${activeSector} Clients`,
      channel: (channels && channels[0]) || 'email',
      from_email: process.env.NURTURE_SENDER_EMAIL || '',
      sender_email: process.env.NURTURE_SENDER_EMAIL || '',
      contacts: targetAudienceContacts,
      active_contact: targetContact || targetAudienceContacts[0],
      unsubscribe_url: unsubUrl,
      preferences_url: prefUrl,
      content: {
        ...content,
        image_url: publicImageUrl || finalImageUrl,
        poster_url: publicImageUrl || finalImageUrl,
        attachments: publicImageUrl || finalImageUrl,
        email_body: finalEmailBody
      },
      image_url: publicImageUrl || finalImageUrl,
      poster_url: publicImageUrl || finalImageUrl,
      poster_image: publicImageUrl || finalImageUrl,
      attachments: publicImageUrl || finalImageUrl,
      subject: content?.subject,
      email_body: finalEmailBody,
      whatsapp_message: content?.whatsapp_message
    };

    // Strictly trigger SNS Workbench workflow
    const result = await workbenchService.triggerNurturingWorkflow(payload);

    const deliveryResponses = [result.data, result.data?.result, result.data?.data, result.data?.data?.result].filter(Boolean);
    const deliveryConfirmed = result.data?.success !== false && !deliveryResponses.some(response => response.success === false) && deliveryResponses.some(response =>
      response.success !== false && (
        response.delivery_confirmed === true ||
        response.email_sent === true ||
        response.sent === true ||
        String(response.delivery_status || '').toLowerCase() === 'delivered' ||
        ['sent', 'delivered', 'completed'].includes(String(response.status || '').toLowerCase())
      )
    );
    if (!deliveryConfirmed) {
      return res.status(502).json({ success: false, error: 'Workbench responded without confirming campaign delivery.', requires_workbench: true, workbench_response: result.data });
    }

    const recipientCount = targetAudienceContacts.length;
    // Audience size is known from the selected contacts. Delivery and engagement
    // metrics remain unknown unless Workbench explicitly returns those counts.
    const rawMetrics = result.data?.metrics || result.data?.result?.metrics;
    const metric = key => {
      const value = rawMetrics?.[key];
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const workbenchMetrics = {
      total_recipients: metric('total_recipients') ?? recipientCount,
      sent: metric('sent'),
      delivered: metric('delivered'),
      opened: metric('opened'),
      clicked: metric('clicked'),
      replied: metric('replied'),
      interested: metric('interested'),
      unsubscribed: metric('unsubscribed')
    };

    const createdDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const sentDateStr = schedule_type === 'schedule' 
      ? `Scheduled (${scheduled_at || 'Upcoming'})` 
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const now = new Date().toISOString();
    const existingCampaign = campaign_id ? nurtureStore.getCampaigns().find(campaign => campaign.id === campaign_id) : null;
    const newCampaign = {
      ...(existingCampaign || {}),
      id: existingCampaign?.id || `CMP-${require('crypto').randomUUID()}`,
      name: payload.campaign_name,
      type: payload.campaign_type || 'Newsletter',
      type_key: (payload.campaign_type || 'newsletter').toLowerCase().replace(/\s+/g, '_'),
      sector: activeSector,
      occasion: payload.occasion,
      audience: payload.target_segment,
      target_audience: payload.target_segment || `${activeSector} Clients`,
      created_date: createdDateStr,
      sent_date: sentDateStr,
      recipients: workbenchMetrics.total_recipients,
      recipients_count: workbenchMetrics.total_recipients,
      channels: channels || ['Email', 'WhatsApp'],
      status: schedule_type === 'schedule' ? 'Scheduled' : 'Sent',
      engagement: '—',
      scheduled_at: scheduled_at || new Date().toISOString(),
      sent_at: schedule_type === 'schedule' ? null : new Date().toISOString(),
      subject: payload.subject,
      email_body: payload.email_body,
      whatsapp_message: payload.whatsapp_message,
      brief: finalDeveloperInput,
      contact_ids: targetAudienceContacts.map(contact => contact.id),
      recipient_contacts: targetAudienceContacts.map(({ id, name, company, email }) => ({ id, name, company, email })),
      content_source: 'workbench',
      workbench_response: result.data,
      delivery_status: 'Workbench confirmed dispatch',
      created_at: existingCampaign?.created_at || now,
      updated_at: now,
      image_url: publicImageUrl || req.body.image_url || req.body.content?.image_url || null,
      metrics: workbenchMetrics,
      workbench_source: result.targetUrl
    };

    if (existingCampaign) nurtureStore.updateCampaign(existingCampaign.id, newCampaign);
    else nurtureStore.addCampaign(newCampaign);

    const replyData = result.data?.nurtured_contact || result.data?.data?.nurtured_contact || result.data?.result?.nurtured_contact;
    const hasActualReply = Boolean(replyData?.client_response);
    let classifiedIntent = hasActualReply ? (replyData?.classified_intent || result.data?.intent || 'Replied') : 'Awaiting Response';
    if (typeof classifiedIntent === 'object' && classifiedIntent !== null) {
      classifiedIntent = classifiedIntent.intent || classifiedIntent.name || classifiedIntent.label || JSON.stringify(classifiedIntent);
    }
    classifiedIntent = String(classifiedIntent || 'Awaiting Response');

    // Update client engagements for all targeted contacts factually
    const priorContacts = targetAudienceContacts.map(contact => ({ contact, snapshot: JSON.parse(JSON.stringify(contact)) }));
    const persistedCampaignSnapshot = existingCampaign ? { ...existingCampaign } : null;
    targetAudienceContacts.forEach(contact => {
      contact.client_engagements = contact.client_engagements || [];
      contact.client_engagements.unshift({
        campaign_name: newCampaign.name,
        type: newCampaign.type,
        status: newCampaign.status === 'Scheduled' ? 'Scheduled' : 'Sent',
        engagement: 'Not reported',
        date: 'Just now'
      });
      contact.timeline = contact.timeline || [];
      contact.timeline.unshift({
        date: 'Just now',
        title: `Campaign Dispatched: ${newCampaign.name}`,
        detail: `Workbench confirmed campaign dispatch. Delivery and engagement metrics are recorded only if returned by Workbench (${sentDateStr}).`
      });
      contact.delivery_status = 'Sent';
      contact.engagement_state = hasActualReply ? 'Replied' : 'Awaiting Response';
      contact.response_intent = classifiedIntent;
      if (hasActualReply && (classifiedIntent === 'Interested' || classifiedIntent === 'Need More Information')) {
        contact.sales_handoff_status = 'Hot Lead';
      }
    });

    try {
      // Save confirmed Workbench campaign history first; then persist contact links.
      nurtureStore.saveContacts();
    } catch (error) {
      priorContacts.forEach(({ contact, snapshot }) => Object.assign(contact, snapshot));
      try { nurtureStore.saveContacts(); } catch (rollbackError) { console.error('[Campaigns /dispatch] Could not restore contact data:', rollbackError.message); }
      if (existingCampaign) nurtureStore.updateCampaign(existingCampaign.id, persistedCampaignSnapshot);
      else nurtureStore.deleteCampaign(newCampaign.id);
      throw error;
    }

    // Factual Campaign Delivery Logger Audit Log
    const targetName = targetContact ? `${targetContact.name} (${targetContact.company})` : `${recipientCount} Client(s)`;
    const newAuditEntries = [{
      event_type: 'Campaign Delivery Logger',
      contact_name: targetName,
      details: `Workbench confirmed the dispatch operation for "${newCampaign.name}" (${newCampaign.type}) to ${targetContact?.email || 'selected contacts'}. Timestamp: ${sentDateStr}`,
      status: 'Sent'
    }];
    if (hasActualReply) {
      newAuditEntries.push({ event_type: 'Groq Intent Classification', contact_name: targetName, details: `Client response classified as ${classifiedIntent}`, status: 'Qualified' });
    }

    const priorAuditLogs = [...nurtureStore.getAuditLogs()];
    try {
      newAuditEntries.forEach(entry => nurtureStore.addAuditLog(entry));
    } catch (error) {
      nurtureStore.auditLogs = priorAuditLogs;
      try { nurtureStore.saveAuditLogs(); } catch (rollbackError) { console.error('[Campaigns /dispatch] Could not restore audit logs:', rollbackError.message); }
      priorContacts.forEach(({ contact, snapshot }) => Object.assign(contact, snapshot));
      try { nurtureStore.saveContacts(); } catch (rollbackError) { console.error('[Campaigns /dispatch] Could not restore contact data:', rollbackError.message); }
      if (existingCampaign) nurtureStore.updateCampaign(existingCampaign.id, persistedCampaignSnapshot);
      else nurtureStore.deleteCampaign(newCampaign.id);
      throw error;
    }

    // Sales handoff is independent from delivery history and only reflects an
    // actual Workbench-reported reply and lead payload.
    const salesHandoffLead = hasActualReply
      ? (result.data?.sales_handoff_lead || result.data?.result?.sales_handoff_lead || result.data?.data?.sales_handoff_lead || null)
      : null;
    if (salesHandoffLead) {
      try {
        nurtureStore.addSalesHandoff(salesHandoffLead);
      } catch (error) {
        console.error('[Campaigns /dispatch] Could not persist sales handoff:', error.message);
      }
    }

    res.json({
      success: true,
      message: `Campaign "${newCampaign.name}" dispatched via SNS Workbench to ${recipientCount} client(s)!`,
      campaign: newCampaign,
      campaigns: nurtureStore.getCampaigns(),
      contacts: nurtureStore.getContacts(),
      sales_handoff: salesHandoffLead,
      sales_handoffs: nurtureStore.getSalesHandoffs(),
      audit_logs: nurtureStore.getAuditLogs(),
      stats: nurtureStore.getStats(),
      source: result.source,
      targetUrl: result.targetUrl
    });
  } catch (err) {
    console.error('[Campaigns /dispatch Error]:', err.message);
    res.status(502).json({
      success: false,
      error: err.message,
      requires_workbench: true
    });
  }
});

// Save Campaign as Draft
router.post('/draft', (req, res) => {
  try {
    const {
      campaign_name,
      campaign_type,
      topic,
      occasion,
      audience,
      channels,
      sector,
      content,
      image_url
    } = req.body;

    const createdDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const now = new Date().toISOString();
    const newCampaign = {
      id: `CMP-${require('crypto').randomUUID()}`,
      name: campaign_name || 'Draft Campaign',
      type: campaign_type || 'Newsletter',
      type_key: (campaign_type || 'newsletter').toLowerCase().replace(/\s+/g, '_'),
      sector: sector || 'Technology',
      occasion: occasion || '',
      audience: audience || 'All Past Clients',
      target_audience: audience || 'All Past Clients',
      created_date: createdDateStr,
      sent_date: '—',
      recipients: 0,
      recipients_count: 0,
      channels: channels || ['Email'],
      status: 'Draft',
      engagement: '—',
      scheduled_at: null,
      sent_at: null,
      subject: content?.subject || '',
      email_body: content?.email_body || '',
      brief: req.body.topic || '',
      contact_ids: [],
      recipient_contacts: [],
      created_at: now,
      updated_at: now,
      whatsapp_message: content?.whatsapp_message || '',
      image_url: image_url || content?.image_url || null,
      metrics: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        unsubscribed: 0
      }
    };

    nurtureStore.addCampaign(newCampaign);

    res.json({
      success: true,
      message: `Campaign "${newCampaign.name}" saved as Draft`,
      campaign: newCampaign
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Could not save campaign: ${err.message}` });
  }
});

// Update an existing campaign (e.g. updating a draft)
router.put('/:id', (req, res) => {
  try {
    const campaign = nurtureStore.updateCampaign(req.params.id, { ...req.body, updated_at: new Date().toISOString() });
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      campaign
    });
  } catch (err) {
    res.status(500).json({ success: false, error: `Could not update campaign: ${err.message}` });
  }
});

module.exports = router;
