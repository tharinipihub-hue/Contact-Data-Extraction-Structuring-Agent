'use strict';

const express = require('express');
const router = express.Router();
const nurtureStore = require('../services/nurtureStore');
const workbenchService = require('../services/nurtureWorkbenchService');

// Get all campaigns
router.get('/', (req, res) => {
  res.json({
    success: true,
    campaigns: nurtureStore.getCampaigns(),
    audit_logs: nurtureStore.getAuditLogs(),
    stats: nurtureStore.getStats()
  });
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
  const deleted = nurtureStore.deleteCampaign(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Campaign not found' });
  }
  res.json({
    success: true,
    message: 'Campaign deleted successfully',
    campaign: deleted,
    campaigns: nurtureStore.getCampaigns(),
    stats: nurtureStore.getStats()
  });
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
  const host = req ? (req.headers['x-forwarded-host'] || req.headers.host) : null;
  const proto = req ? (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')) : 'http';
  return host ? `${proto}://${host}` : '';
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

function buildIntelligentPreview({ contact, activeSector, developerInput, occasion, campaign_name, topic, campaign_type }) {
  const textToCheck = `${developerInput} ${occasion || ''} ${campaign_name || ''} ${topic || ''}`;
  const isMilestone = /\b(founders?('s)?(\s+day)?|foundation\s+day|company\s+anniversary|annual\s+day|corporate\s+milestone|company\s+milestone|jubilee)\b|celebrat(ed|ing)\s+(our\s+)?(anniversary|found(ers?|ing)|milestone)/i.test(textToCheck);
  const isFestival = campaign_type === 'festival_wish' || campaign_type === 'Festival / Occasion Wish';
  const isWelcome = campaign_type === 'welcome' || campaign_type === 'Welcome Message';
  const isPromotional = campaign_type === 'promotional' || campaign_type === 'Promotional / Strategic Update';

  if (isMilestone) {
    const milestoneTitle = (occasion && /\b(founders?('s)?(\s+day)?|foundation\s+day|company\s+anniversary|annual\s+day|corporate\s+milestone|company\s+milestone|jubilee)\b/i.test(occasion)) ? occasion : 'Company Milestone';
    return {
      subject: `Celebrating SNS Square ${milestoneTitle}: Thank You for Partnering with Us, ${contact.name}`,
      email_body: `Dear ${contact.name},\n\nWe at SNS Square recently celebrated our ${milestoneTitle}!\n\nAs we commemorate this company milestone, we want to express our sincere appreciation to valued partners like ${contact.company}.\n\n${developerInput}\n\nOur platform advancements and continuous growth are made possible through the collaboration and trust of forward-thinking leaders like you.\n\nThank you for partnering with us. We look forward to continuing our impactful work together.\n\nSNS Square Multi-Agent Platform`,
      whatsapp_message: `Dear ${contact.name}, we at SNS Square recently celebrated our ${milestoneTitle}! ${developerInput} Thank you for your continued partnership and trust.`
    };
  } else if (isFestival) {
    const occasionName = occasion || 'Festive Season';
    return {
      subject: `Warm ${occasionName} Greetings from SNS Square`,
      email_body: `Dear ${contact.name},\n\nOn behalf of everyone at SNS Square, we send our warmest greetings for ${occasionName} to you, your team, and your family at ${contact.company}.\n\n${developerInput}\n\nMay this celebratory season bring joy, health, and prosperity to you and your organization.\n\nSNS Square Multi-Agent Platform`,
      whatsapp_message: `Warm ${occasionName} greetings from SNS Square! ${developerInput} Wishing you and everyone at ${contact.company} joy and success this season!`
    };
  } else if (isWelcome) {
    return {
      subject: `Welcome to SNS Square: Strategic Partnership with ${contact.company}`,
      email_body: `Dear ${contact.name},\n\nWelcome to SNS Square! We are delighted to partner with ${contact.company}.\n\n${developerInput}\n\nOur dedicated account engineering team is here to support end-to-end integration across the SNS Square Agent Workbench, Google Sheets synchronization, and multichannel communication pipelines.\n\nWe look forward to an impactful collaboration.\n\nSNS Square Multi-Agent Platform`,
      whatsapp_message: `Welcome to SNS Square! We are excited to collaborate with your team at ${contact.company}. ${developerInput}`
    };
  } else if (isPromotional) {
    return {
      subject: `SNS Square Strategic Update: Next-Generation Capabilities`,
      email_body: `Dear ${contact.name},\n\nWe are pleased to share an update on next-generation capabilities from the SNS Square Multi-Agent Platform.\n\n${developerInput}\n\nIn recent deployments across ${contact.sector || 'Enterprise'} organizations, teams have established unified data governance and automated lead capture with sub-second response times.\n\nReply directly if you would like an engineering demonstration tailored for ${contact.company}.\n\nSNS Square Multi-Agent Platform`,
      whatsapp_message: `Hi ${contact.name}! Discover the latest enterprise feature updates from SNS Square: ${developerInput}`
    };
  } else {
    return {
      subject: `${contact.sector || 'Technology'} Intelligence Briefing: Enterprise Multi-Agent Workflows`,
      email_body: `Dear ${contact.name},\n\nAs leadership at ${contact.company}, keeping ahead in the rapidly evolving ${contact.sector || 'Technology'} landscape is paramount.\n\nOur advisory team at SNS Square has compiled exclusive operational benchmarks examining how organizations are deploying autonomous agent pipelines to streamline workflows and eliminate manual data bottlenecks.\n\n${developerInput}\n\nWould you be open to an introductory 15-minute sync next week to review these findings?\n\nSNS Square Multi-Agent Platform`,
      whatsapp_message: `Hi ${contact.name}! Here is your tailored ${contact.sector || 'Technology'} briefing for ${contact.company}. ${developerInput}`
    };
  }
}

// Generate content & preview strictly using SNS Workbench Webhook (with Groq GPT-OSS-120B)
router.post('/test-webhook', async (_req, res) => {
  try {
    const result = await workbenchService.testNurturingWebhook();
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

  const allContacts = nurtureStore.getContacts();
  const requestedIds = Array.isArray(contacts) ? new Set(contacts.map(c => c.id).filter(Boolean)) : null;
  let recipientContacts = Array.isArray(contacts)
    ? allContacts.filter(c => requestedIds.has(c.id))
    : allContacts;
  recipientContacts = recipientContacts.filter(c => c.opt_in === true);

  if (contact_id && (!targetContact || targetContact.opt_in !== true)) {
    return res.status(400).json({ success: false, error: 'The selected contact has not opted in to nurturing communications.' });
  }

  if (targetContact) {
    recipientContacts = [targetContact];
  }

  if (recipientContacts.length === 0) {
    return res.status(400).json({ success: false, error: 'No opted-in contacts are available for campaign generation. Sync or import contacts and record consent first.' });
  }

  const activeSector = sector || targetContact?.sector || targetContact?.industry || 'Technology';
  const brief = (req.body.developer_input || req.body.topic || req.body.brief || '').trim();

  if (!brief) {
    return res.status(400).json({
      success: false,
      error: 'Campaign brief is required'
    });
  }

  const developerInput = brief;

  const unsubBase = getUnsubscribeBaseUrl(req);
  const targetId = targetContact?.id || recipientContacts[0].id;
  const unsubUrl = `${unsubBase}/unsubscribe?id=${targetId}`;
  const prefUrl = `${unsubBase}/preferences?id=${targetId}`;

  const payload = {
    action: 'generate_preview',
    campaign_name: campaign_name || `${activeSector} Campaign: ${brief.slice(0, 40)}`,
    campaign_type: campaign_type || 'newsletter',
    developer_input: developerInput,
    occasion: developerInput,
    sector: activeSector,
    target_segment: target_audience || `${activeSector} Sector Clients`,
    channel: channel || 'email',
    from_email: process.env.NURTURE_SENDER_EMAIL || '',
    sender_email: process.env.NURTURE_SENDER_EMAIL || '',
    contacts: recipientContacts,
    active_contact: targetContact || recipientContacts[0],
    unsubscribe_url: unsubUrl,
    preferences_url: prefUrl
  };

  try {
    // Strictly trigger SNS Workbench workflow
    const result = await workbenchService.triggerNurturingWorkflow(payload);
    
    // Robustly extract Workbench Groq AI or workflow output
    const extracted = extractWorkbenchAiContent(result.data);

    if (extracted && extracted.subject && extracted.email_body && result.data?.success !== false) {
      const previewData = {
        ...((result.data?.nurtured_contact || result.data?.result || result.data) || {}),
        subject: extracted.subject,
        email_body: extracted.email_body,
        personalization_summary: extracted.personalization_summary || 'Generated via SNS Workbench',
        content_source: 'workbench'
      };

      if (!previewData.whatsapp_message) {
        const firstName = targetContact?.name?.split(' ')[0] || recipientContacts[0]?.name?.split(' ')[0] || 'Client';
        previewData.whatsapp_message = `Hi ${firstName}, here is your strategic briefing: ${extracted.subject}. (Reply STOP to opt out)`;
      }

      console.log('[Campaigns /generate] Successfully extracted Workbench content. Returning content_source: workbench');
      return res.json({
        success: true,
        source: result.source,
        content_source: 'workbench',
        targetUrl: result.targetUrl,
        preview: previewData,
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

    const requestedContacts = req.body.contacts;
    const requestedContactIds = Array.isArray(requestedContacts) ? new Set(requestedContacts.map(c => c.id).filter(Boolean)) : null;
    let targetAudienceContacts = nurtureStore.getContacts().filter(c =>
      c.opt_in === true && (!Array.isArray(requestedContacts) || requestedContactIds.has(c.id))
    );

    if (targetContactId && (!targetContact || targetContact.opt_in !== true)) {
      return res.status(400).json({ success: false, error: 'The selected contact has not opted in to nurturing communications.' });
    }

    if (targetContact) {
      targetAudienceContacts = [targetContact];
    } else if (sector && sector !== 'All Sectors') {
      const sectorFiltered = targetAudienceContacts.filter(c => (c.sector || c.industry) === sector);
      if (sectorFiltered.length > 0) targetAudienceContacts = sectorFiltered;
    }

    if (targetAudienceContacts.length === 0) {
      return res.status(400).json({ success: false, error: 'No opted-in contacts are available for campaign delivery.' });
    }

    const activeSector = sector || targetContact?.sector || targetContact?.industry || 'Technology';
    const finalDeveloperInput = developer_input || topic || occasion || `${activeSector} Industry Intelligence Briefing`;

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

    let rawBody = content?.email_body || '';
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

    const deliveryConfirmed = result.data?.success !== false && (result.data?.delivery_confirmed === true || result.data?.email_sent === true || result.data?.sent === true || result.data?.delivery_status === 'Delivered' || result.data?.status === 'sent' || result.data?.status === 'delivered');
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

    const newCampaign = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
      name: payload.campaign_name,
      type: payload.campaign_type || 'Newsletter',
      type_key: (payload.campaign_type || 'newsletter').toLowerCase().replace(/\s+/g, '_'),
      sector: activeSector,
      occasion: payload.occasion,
      audience: payload.target_segment,
      target_audience: payload.target_segment || `${activeSector} Clients`,
      created_date: createdDateStr,
      sent_date: sentDateStr,
      recipients: workbenchMetrics.total_recipients || recipientCount,
      recipients_count: workbenchMetrics.total_recipients || recipientCount,
      channels: channels || ['Email', 'WhatsApp'],
      status: schedule_type === 'schedule' ? 'Scheduled' : 'Sent',
      engagement: '—',
      scheduled_at: scheduled_at || new Date().toISOString(),
      sent_at: schedule_type === 'schedule' ? null : new Date().toISOString(),
      subject: payload.subject,
      email_body: payload.email_body,
      whatsapp_message: payload.whatsapp_message,
      image_url: publicImageUrl || req.body.image_url || req.body.content?.image_url || null,
      metrics: workbenchMetrics,
      workbench_source: result.targetUrl
    };

    nurtureStore.addCampaign(newCampaign);

    const hasActualReply = Boolean(result.data?.nurtured_contact?.client_response);
    const classifiedIntent = hasActualReply ? (result.data?.nurtured_contact?.classified_intent || result.data?.intent || 'Replied') : 'Awaiting Response';

    // Update client engagements for all targeted contacts factually
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

    nurtureStore.saveContacts();

    // Sales Handoff ONLY if actual reply exists
    const salesHandoffLead = (hasActualReply && (result.data?.sales_handoff_lead || result.data?.result?.sales_handoff_lead)) ? (result.data?.sales_handoff_lead || result.data?.result?.sales_handoff_lead) : null;
    if (salesHandoffLead) {
      nurtureStore.addSalesHandoff(salesHandoffLead);
    }

    // Factual Campaign Delivery Logger Audit Log
    const targetName = targetContact ? `${targetContact.name} (${targetContact.company})` : `${recipientCount} Client(s)`;
    nurtureStore.addAuditLog({
      event_type: 'Campaign Delivery Logger',
      contact_name: targetName,
      details: `Workbench confirmed the dispatch operation for "${newCampaign.name}" (${newCampaign.type}) to ${targetContact?.email || 'selected contacts'}. Timestamp: ${sentDateStr}`,
      status: 'Sent'
    });

    if (hasActualReply) {
      nurtureStore.addAuditLog({
        event_type: 'Groq Intent Classification',
        contact_name: targetName,
        details: `Client response classified as ${classifiedIntent}`,
        status: 'Qualified'
      });
      if (salesHandoffLead) {
        nurtureStore.addAuditLog({
          event_type: 'Sales Handoff Trigger',
          contact_name: targetName,
          details: `Inbound response triggered sales handoff for ${targetContact?.name || 'Client'}`,
          status: 'Hot Lead'
        });
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
    const newCampaign = {
      id: `CMP-${Date.now().toString().slice(-4)}`,
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update an existing campaign (e.g. updating a draft)
router.put('/:id', (req, res) => {
  try {
    const campaign = nurtureStore.updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      campaign
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
