'use strict';

const express = require('express');
const router = express.Router();
const nurtureStore = require('../services/nurtureStore');
const workbenchService = require('../services/nurtureWorkbenchService');
const {
  sanitizeAndValidateSubject,
  detectPromptLeakInSubject,
  sanitizeAndPersonalizeGreeting,
  cleanEmailBodyHtml,
  wrapInSnsSquareTemplate,
  cleanActionText,
  sanitizeFoundationsList,
  scrubPromptDirectiveText
} = require('../services/contentSanitizerService');
const {
  normalizeCampaignType,
  isSupportedCampaignType
} = require('../services/campaignTypeRegistry');

/**
 * Decide whether SNS Workbench actually confirmed an email delivery.
 *
 * DELIVERY HONESTY RULE
 *   "Generation success" is NOT "delivery success".
 *
 *   A generation/preview response looks like
 *     { success: true, status: "completed", content_source: "workbench", result: {...} }
 *   and must NEVER be treated as a send.
 *
 *   Only an explicit delivery signal is accepted:
 *     delivery_confirmed === true | email_sent === true | sent === true
 *     delivery_status === "delivered" | status in ["sent","delivered"]
 *
 *   `success === true` alone is NOT sufficient, and status "completed" /
 *   "success" are explicitly NOT accepted, because the workflow uses those for
 *   generation outcomes that never reached the SMTP node.
 *
 * @param {object} resData SNS Workbench response envelope
 * @returns {boolean} true only on an explicit delivery confirmation
 */
function isDeliveryConfirmedResponse(resData) {
  if (!resData) return false;
  const responses = [resData, resData.result, resData.data, resData.data && resData.data.result]
    .filter(r => r && typeof r === 'object');
  if (resData.success === false || responses.some(r => r.success === false)) return false;
  return responses.some(response =>
    response.delivery_confirmed === true ||
    response.email_sent === true ||
    response.sent === true ||
    String(response.delivery_status || '').toLowerCase() === 'delivered' ||
    ['sent', 'delivered'].includes(String(response.status || '').toLowerCase())
  );
}

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
    const rawId = req.params.id;
    if (!rawId || !String(rawId).trim()) {
      return res.status(400).json({ success: false, error: 'Campaign ID is required for deletion.' });
    }
    const cleanId = String(rawId).trim();
    const deleted = nurtureStore.deleteCampaign(cleanId);
    if (!deleted) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({
      success: true,
      message: 'Campaign deleted successfully',
      campaign: deleted,
      campaigns: nurtureStore.getCampaigns(),
      stats: nurtureStore.getStats()
    });
  } catch (err) {
    console.error(`[Campaigns DELETE /:id Error]:`, err.message);
    res.status(500).json({ success: false, error: `Could not delete campaign: ${err.message}` });
  }
});

const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const POSTERS_DIR = path.join(UPLOAD_DIR, 'posters');
try {
  fs.mkdirSync(POSTERS_DIR, { recursive: true });
} catch (_) {}

function saveLocalPoster(sourceDataOrPath, req) {
  try {
    if (!sourceDataOrPath || typeof sourceDataOrPath !== 'string') return null;
    if (sourceDataOrPath.startsWith('http://') || sourceDataOrPath.startsWith('https://')) {
      return sourceDataOrPath;
    }
    const match = sourceDataOrPath.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return null;
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    else if (ext.includes('png')) ext = 'png';
    else if (ext.includes('webp')) ext = 'webp';
    else if (ext.includes('gif')) ext = 'gif';
    else ext = 'jpg';

    const buffer = Buffer.from(match[2], 'base64');
    const filename = `poster_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(POSTERS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    const baseUrl = getUnsubscribeBaseUrl(req);
    return `${baseUrl}/files/poster/${filename}`;
  } catch (err) {
    console.error('[saveLocalPoster] Error saving poster locally:', err.message);
    return null;
  }
}

async function uploadToFreeImage(sourceDataOrPath, req) {
  try {
    if (!sourceDataOrPath) return null;
    if (typeof sourceDataOrPath === 'string' && (sourceDataOrPath.startsWith('http://') || sourceDataOrPath.startsWith('https://'))) {
      return sourceDataOrPath;
    }

    if (typeof sourceDataOrPath === 'string' && sourceDataOrPath.startsWith('data:image/')) {
      if (process.env.FREEIMAGE_API_KEY) {
        try {
          const base64Data = sourceDataOrPath.split(',')[1];
          const formData = new FormData();
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
        } catch (fetchErr) {
          console.warn('[uploadToFreeImage] FreeImage upload failed, falling back to local poster storage:', fetchErr.message);
        }
      }
      return saveLocalPoster(sourceDataOrPath, req);
    }
  } catch (err) {
    console.warn('[uploadToFreeImage] Upload error:', err.message);
  }
  return saveLocalPoster(sourceDataOrPath, req);
}

// Upload custom poster image endpoint (returns public HTTPS URL for Gmail delivery)
router.post('/upload-image', async (req, res) => {
  try {
    const { image_data, filename } = req.body;
    if (!image_data) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }
    const publicUrl = await uploadToFreeImage(image_data, req);
    if (publicUrl) {
      return res.json({ success: true, url: publicUrl });
    }
    return res.status(502).json({ success: false, error: 'Image hosting failed; no image was uploaded.' });
  } catch (err) {
    console.error('[Upload Image Error]:', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

const DEFAULT_PUBLIC_APP_URL = 'https://contact-data-extraction-structuring-agent.onrender.com';

function getUnsubscribeBaseUrl(req) {
  if (process.env.UNSUBSCRIBE_BASE_URL && !process.env.UNSUBSCRIBE_BASE_URL.includes('localhost')) {
    return process.env.UNSUBSCRIBE_BASE_URL.replace(/\/+$/, '');
  }
  if (process.env.PUBLIC_APP_URL && !process.env.PUBLIC_APP_URL.includes('localhost')) {
    return process.env.PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  let host = req ? (req.headers['x-forwarded-host'] || req.headers.host) : null;
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req ? (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')) : 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return DEFAULT_PUBLIC_APP_URL;
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function forcePublicUnsubscribeUrls(htmlOrText, unsubUrl, prefUrl) {
  if (!htmlOrText || typeof htmlOrText !== 'string') return htmlOrText;
  return htmlOrText
    .replace(/href\s*=\s*['"][^'"]*(?:unsubscribe|opt-out)[^'"]*['"]/gi, `href="${unsubUrl}"`)
    .replace(/href\s*=\s*['"][^'"]*preferences[^'"]*['"]/gi, `href="${prefUrl}"`)
    .replace(/\[([^\]]*unsubscribe[^\]]*)\]\([^)]+\)/gi, `[$1](${unsubUrl})`)
    .replace(/\[([^\]]*preference[^\]]*)\]\([^)]+\)/gi, `[$1](${prefUrl})`)
    .replace(/(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?\/(?:unsubscribe|preferences)(?:\?[^\s"'<>]*)?/gi, unsubUrl)
    .replace(/https?:\/\/[^\s"'<>]+\/unsubscribe(?:\?[^\s"'<>]*)?/gi, unsubUrl)
    .replace(/https?:\/\/[^\s"'<>]+\/preferences(?:\?[^\s"'<>]*)?/gi, prefUrl);
}

function useConfiguredPreferenceLinks(emailBody, unsubscribeUrl, preferencesUrl) {
  return forcePublicUnsubscribeUrls(emailBody, unsubscribeUrl, preferencesUrl);
}

function personalizeContentForRecipient(rawBody, rawSubject, recipient, allContacts, unsubBase) {
  let body = String(rawBody || '');
  let subject = String(rawSubject || '');

  const recipientFullName = recipient.name || '';
  const recipientFirstName = recipientFullName.split(' ')[0] || recipientFullName;
  const recipientCompany = recipient.company || 'your organization';

  // 1. Sanitize fake titles (Dear Leader, Dear Executive) and normalize greeting to recipient
  body = sanitizeAndPersonalizeGreeting(body, recipient);
  subject = sanitizeAndValidateSubject(subject, { company: recipientCompany, name: recipientFullName });

  // Resolve approved template tokens per recipient just before dispatch.
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const templateValues = {
    first_name: recipientFirstName || '',
    company: recipientCompany || '',
    industry: recipient.sector || recipient.industry || '',
    client_name: recipientFullName || ''
  };
  const interpolateTemplateTokens = (value, htmlSafe = true) => String(value || '').replace(
    /\{\{(first_name|company|industry|client_name)\}\}/gi,
    (_match, key) => htmlSafe ? escapeHtml(templateValues[key.toLowerCase()]) : templateValues[key.toLowerCase()]
  );
  body = interpolateTemplateTokens(body);
  subject = interpolateTemplateTokens(subject, false);

  // 2. Iterate all known contacts to replace any other names and companies
  for (const c of allContacts) {
    if (c.id === recipient.id) continue;
    if (c.name) {
      const cFull = c.name;
      const cFirst = c.name.split(' ')[0];
      body = body.replace(new RegExp(`Dear\\s+${escapeRegex(cFull)}`, 'gi'), `Dear ${recipientFullName}`);
      body = body.replace(new RegExp(`Hi\\s+${escapeRegex(cFull)}`, 'gi'), `Hi ${recipientFullName}`);
      if (cFirst && cFirst.length > 2) {
        body = body.replace(new RegExp(`Dear\\s+${escapeRegex(cFirst)}`, 'gi'), `Dear ${recipientFirstName}`);
        body = body.replace(new RegExp(`Hi\\s+${escapeRegex(cFirst)}`, 'gi'), `Hi ${recipientFirstName}`);
      }
      subject = subject.replace(new RegExp(escapeRegex(cFull), 'gi'), recipientFullName);
    }
    if (c.company && c.company.length > 2) {
      body = body.replace(new RegExp(escapeRegex(c.company), 'g'), recipientCompany);
      subject = subject.replace(new RegExp(escapeRegex(c.company), 'g'), recipientCompany);
    }
  }

  // 3. Scrub and replace all unsubscribe and preferences links to point to this recipient's URL
  const recipientUnsubUrl = `${unsubBase}/unsubscribe?id=${encodeURIComponent(recipient.id)}`;
  const recipientPrefUrl = `${unsubBase}/preferences?id=${encodeURIComponent(recipient.id)}`;

  body = forcePublicUnsubscribeUrls(body, recipientUnsubUrl, recipientPrefUrl);

  return { body, subject, recipientUnsubUrl, recipientPrefUrl };
}

function normalizeExtractedFields(src, defaultSummary = 'Generated via SNS Workbench') {
  if (!src || typeof src !== 'object') return null;
  const subject = typeof src.subject === 'string' ? src.subject.trim() : '';
  let email_body = typeof src.email_body === 'string' ? src.email_body.trim() : '';

  const heroHeadline = src.hero_headline || src.heroHeadline || src.hero?.headline || '';
  const rawHeroBody = src.hero_body || src.heroBody || src.hero?.body;
  const heroBody = Array.isArray(rawHeroBody)
    ? rawHeroBody.map(p => typeof p === 'string' ? p.trim() : '').filter(Boolean).join('\n\n')
    : (typeof rawHeroBody === 'string' ? rawHeroBody : '') ||
      (Array.isArray(src.hero?.paragraphs) ? src.hero.paragraphs.join('\n\n') : '');
  const rawBlocks = src.content_blocks || src.blocks || src.articles;
  const cleanedBlocks = Array.isArray(rawBlocks) ? rawBlocks.map(b => ({
    ...b,
    ctaText: cleanActionText(b.ctaText || b.cta_text || b.cta_label || ''),
    cta_label: cleanActionText(b.cta_label || b.ctaText || b.cta_text || '')
  })) : null;

  if (!email_body && (heroHeadline || (Array.isArray(cleanedBlocks) && cleanedBlocks.length))) {
    const heroPart = heroHeadline ? `<h2>${heroHeadline}</h2>\n<p>${heroBody}</p>` : '';
    const blocksPart = (Array.isArray(cleanedBlocks) ? cleanedBlocks : []).map(b => {
      const ctaUrl = /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(b.cta_url || b.ctaUrl || '') ? (b.cta_url || b.ctaUrl) : '';
      const ctaText = b.cta_label || b.ctaText || '';
      return `<p><strong>${b.headline || b.title || ''}</strong></p>\n<p>${b.body || b.paragraph || ''}</p>${ctaText && ctaUrl ? `\n<p><a href="${ctaUrl}">${ctaText} &rarr;</a></p>` : ''}`;
    }).join('\n\n');
    email_body = [heroPart, blocksPart].filter(Boolean).join('\n\n');
  }

  if (email_body) {
    email_body = cleanEmailBodyHtml(email_body);
  }

  if (!subject && !email_body) return null;

  const result = {
    subject,
    email_body,
    personalization_summary: src.personalization_summary || defaultSummary
  };

  if (src.campaign_name || src.campaignName) result.campaign_name = src.campaign_name || src.campaignName;
  const headerTitle = src.header_title || src.headerTitle || src.header?.title;
  if (headerTitle) result.header_title = headerTitle;
  const headerSubtitle = src.header_subtitle || src.headerSubtitle || src.header?.subtitle;
  if (headerSubtitle) result.header_subtitle = headerSubtitle;
  if (heroHeadline) result.hero_headline = heroHeadline;
  if (heroBody) result.hero_body = heroBody;
  if (Array.isArray(src.hero?.paragraphs)) result.hero_paragraphs = src.hero.paragraphs;
  if (Array.isArray(cleanedBlocks)) result.content_blocks = cleanedBlocks;
  const foundationsTitle = src.foundations_title || src.foundationsTitle;
  if (foundationsTitle) result.foundations_title = scrubPromptDirectiveText(foundationsTitle);
  const foundations = src.foundations || src.synthesis_points || src.synthesisPoints;
  if (Array.isArray(foundations)) result.foundations = sanitizeFoundationsList(foundations);
  const closingText = src.closing_text || src.closingText;
  if (closingText) result.closing_text = scrubPromptDirectiveText(closingText);
  const greetingType = src.greeting_type || src.greetingType;
  if (greetingType) result.greeting_type = greetingType;
  const promoBanner = src.promo_banner || src.promoBanner;
  if (promoBanner && typeof promoBanner === 'object') result.promo_banner = promoBanner;

  return result;
}

function extractWorkbenchAiContent(data) {
  if (!data) return null;

  // Workbench may wrap executions as output/items/json/body/data/result/content.
  // Traverse those envelope nodes, but accept generated content only when the
  // response itself contains the application's established subject/email_body
  // contract. An echoed request body is never treated as generated content.
  const payloads = [];
  const queue = [data];
  const visited = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    payloads.push(value);
    if (Array.isArray(value)) {
      value.forEach(item => queue.push(item?.json || item));
      continue;
    }
    ['output', 'items', 'json', 'body', 'data', 'result', 'content', 'nurtured_contact', 'workbench_content', 'preview', 'structured_content'].forEach(key => {
      const nested = value[key];
      if (nested && typeof nested === 'object') queue.push(nested);
    });
  }

  // 1. Check for Groq / LLM model output nested inside content.parts or text
  // Workbench Groq node output typically formats as:
  // data.result.content.parts[0].text or data.content.parts[0].text
  let groqRaw = null;
  const candidates = payloads.flatMap(value => [
    value.content?.parts?.[0]?.text,
    value.text,
    typeof value.body === 'string' ? value.body : null,
    value.choices?.[0]?.message?.content,
    typeof value.output === 'string' ? value.output : null
  ]);

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
      const normalized = normalizeExtractedFields(parsed, 'Generated via SNS Workbench Groq AI');
      if (normalized) return normalized;
    } catch (e) {
      // Try regex search for embedded JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const normalized = normalizeExtractedFields(parsed, 'Generated via SNS Workbench Groq AI');
          if (normalized) return normalized;
        } catch (err) {}
      }
    }

    // Try regex extraction of Subject: and Body
    const subjectMatch = groqRaw.match(/^(?:Subject|Title):\s*(.+)$/im);
    if (subjectMatch) {
      const subj = subjectMatch[1].trim();
      const body = groqRaw.replace(/^(?:Subject|Title):\s*.+$/im, '').trim();
      if (body) {
        return normalizeExtractedFields({
          subject: subj,
          email_body: body,
          personalization_summary: 'Generated via SNS Workbench Groq AI'
        });
      }
    }
  }

  // 2. Check direct / structured fields in Workbench response
  for (const src of payloads) {
    if (src && typeof src === 'object' && src.success !== false && src.status !== 'error' && !src.error) {
      const normalized = normalizeExtractedFields(src, 'Generated via SNS Workbench workflow');
      if (normalized) return normalized;
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
    return res.status(200).json(result);
  } catch (err) {
    const is404 = err.status === 404 || err.errorType === 'workflow_not_deployed' || String(err.message || '').includes('404');
    return res.status(200).json({
      success: false,
      status: err.status || 502,
      error_type: is404 ? 'workflow_not_deployed' : (err.errorType || 'connection_error'),
      error: err.message,
      message: is404
        ? 'SNS Workbench Client Nurturing workflow is not deployed or active (HTTP 404).'
        : err.message,
      action_label: is404 ? 'Check Workbench Deployment' : 'Retry Verification'
    });
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
    sector
  } = req.body;
  const contact_id = req.body.contact_id || req.body.active_contact_id;
  const contacts = req.body.contacts || req.body.contact_ids;

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

  // Campaign type is normalized through the canonical registry so UI display
  // labels ("Festival / Occasion Wish") are never sent to SNS Workbench
  // verbatim. An unsupported type is rejected truthfully rather than being
  // silently substituted with another campaign type.
  const campaignTypeKey = normalizeCampaignType(campaign_type);
  if (!isSupportedCampaignType(campaignTypeKey)) {
    return res.status(400).json({
      success: false,
      error_type: 'unsupported_campaign_type',
      error: campaign_type
        ? `Campaign type "${campaign_type}" is not supported by the SNS Square Client Nurturing workflow.`
        : 'A supported campaign type is required.',
      supported_campaign_types: ['newsletter', 'festival_wish', 'promotional', 'follow_up', 'event_invitation', 'announcement'],
      requires_workbench: false
    });
  }

  // Only real stored contact data is used. No sector is invented.
  const activeSector = String(sector || activeContact?.sector || activeContact?.industry || '').trim();

  const developerInput = brief;

  const unsubBase = getUnsubscribeBaseUrl(req);
  const targetId = activeContact.id;
  const unsubUrl = `${unsubBase}/unsubscribe?id=${targetId}`;
  const prefUrl = `${unsubBase}/preferences?id=${targetId}`;

  // No sector is invented. When the contact and request carry no sector, the
  // field is sent empty so the LLM cannot anchor on a fabricated industry.
  const audienceLabel = String(target_audience || '').trim();

  // Build occasion payload for festival/wish campaigns
  const occasionService = require('../services/occasionService');
  const occasionPayloadData = occasion
    ? occasionService.buildOccasionPayload(occasion, activeContact)
    : {};

  // Include researched_context and newsletter_context if provided
  const researchedContext = String(req.body.researched_context || '').trim();
  const newsletterContext = String(req.body.newsletter_context || '').trim();

  const payload = {
    action: 'generate_preview',
    request_type: 'generate_preview',
    // Fall back to the user's own brief, never to an invented sector name.
    campaign_name: String(campaign_name || '').trim() || brief.slice(0, 60),
    // canonical registry key, never the UI display label
    campaign_type: campaignTypeKey,
    developer_input: developerInput,
    campaign_brief: developerInput,
    ...(occasion ? { occasion, ...occasionPayloadData } : {}),
    sector: activeSector,
    industry: activeSector,
    company: activeContact.company || '',
    full_name: activeContact.name || '',
    first_name: (activeContact.name || '').split(' ')[0] || '',
    designation: activeContact.designation || '',
    name: activeContact.name,
    email: activeContact.email,
    to_email: activeContact.email,
    // Regional context — only from confirmed contact fields
    country: activeContact.country || '',
    state: activeContact.state || '',
    city: activeContact.city || '',
    location: activeContact.location || '',
    recipient_region: occasionPayloadData.recipient_region || activeContact.country || activeContact.location || '',
    target_segment: audienceLabel,
    channel: channel || 'email',
    from_email: process.env.NURTURE_SENDER_EMAIL || '',
    sender_email: process.env.NURTURE_SENDER_EMAIL || '',
    contacts: recipientContacts,
    active_contact: activeContact,
    unsubscribe_url: unsubUrl,
    preferences_url: prefUrl,
    // Research/enrichment context — passed only when available
    ...(researchedContext ? { researched_context: researchedContext } : {}),
    ...(newsletterContext ? { newsletter_context: newsletterContext } : {}),
    client_type: activeContact.client_type || '',
    previous_interaction: activeContact.previous_interaction || '',
    known_interests: activeContact.known_interests || activeContact.interests || [],
    engagement_history: activeContact.engagement_history || activeContact.engagementHistory || [],
    approved_campaign_metadata: req.body.approved_campaign_metadata && typeof req.body.approved_campaign_metadata === 'object'
      ? req.body.approved_campaign_metadata
      : {},
    approved_urls: Array.isArray(req.body.approved_urls) ? req.body.approved_urls : []
  };

  try {
    // Strictly trigger SNS Workbench workflow
    const result = await workbenchService.triggerNurturingProductionWorkflow(payload);
    
    // Robustly extract Workbench Groq AI or workflow output
    const extracted = result.normalizedContent || extractWorkbenchAiContent(result.data);
    console.info(`[Campaigns /generate] Workbench normalized generated content=${Boolean(extracted?.subject && extracted?.email_body)} http_status=${result.httpStatus}`);

    if (extracted && extracted.email_body && result.data?.success !== false) {
      const campaignId = req.body.campaign_id || `CMP-${require('crypto').randomUUID()}`;
      const previous = nurtureStore.getCampaigns().find(campaign => campaign.id === campaignId);
      const now = new Date().toISOString();

      // 1. Sanitize subject line to guarantee prompt instructions never leak
      const cleanSubject = extracted.subject && extracted.subject.trim().length >= 6 && !detectPromptLeakInSubject(extracted.subject)
        ? sanitizeAndValidateSubject(extracted.subject, {
          campaignType: campaign_type,
          occasion,
          company: activeContact.company,
          name: activeContact.name,
          topic: brief || developerInput
        })
        : '';

      // 2. Sanitize greeting to prevent generic fake titles (Dear Leader, Dear Executive)
      let cleanBody = sanitizeAndPersonalizeGreeting(extracted.email_body, activeContact);
      cleanBody = cleanEmailBodyHtml(cleanBody);
      cleanBody = useConfiguredPreferenceLinks(cleanBody, unsubUrl, prefUrl);

      // 3. Wrap in official standardized SNS Square email template
      const fullTemplateHtml = wrapInSnsSquareTemplate(cleanBody, {
        campaignType: campaign_type,
        title: extracted.header_title || cleanSubject || brief || 'Your Weekly GCC & AI Scoop',
        subtitle: extracted.header_subtitle || (brief ? `Topic: ${brief.slice(0, 45)}` : 'Core Perspective | Wednesday Edition'),
        recipientUnsubUrl: unsubUrl,
        recipientPrefUrl: prefUrl,
        company: 'SNS Square'
      });

      const structuredContent = {
        campaign_name: extracted.campaign_name,
        subject: cleanSubject,
        header_title: extracted.header_title,
        header_subtitle: extracted.header_subtitle,
        hero_headline: extracted.hero_headline,
        hero_body: extracted.hero_body,
        content_blocks: extracted.content_blocks,
        foundations_title: extracted.foundations_title,
        foundations: extracted.foundations,
        closing_text: extracted.closing_text,
        greeting_type: extracted.greeting_type,
        promo_banner: extracted.promo_banner
      };

      const previewData = {
        ...((result.data?.nurtured_contact || result.data?.result || result.data) || {}),
        subject: cleanSubject,
        email_body: fullTemplateHtml,
        email_body_html: fullTemplateHtml,
        body_text_only: cleanBody,
        content_version: previous?.content_version || 'v1',
        personalization_summary: extracted.personalization_summary || 'Generated via SNS Workbench',
        content_source: 'workbench',
        workbench_http_status: result.httpStatus,
        workbench_content: extracted,
        structured_content: structuredContent
      };

      const generatedCampaign = {
        ...(previous || {}),
        id: campaignId,
        content_version: previous?.content_version || 'v1',
        name: String(campaign_name || '').trim() || brief.slice(0, 60),
        type: campaignTypeKey,
        type_key: campaignTypeKey,
        sector: activeSector,
        occasion: occasion || '',
        brief: developerInput,
        audience: audienceLabel,
        target_audience: audienceLabel,
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
        structured_content: structuredContent,
        campaign: generatedCampaign,
        campaign_data: result.data,
        workbench_http_status: result.httpStatus
      });
    }

    return res.status(502).json({
      success: false,
      source: 'workbench_error',
      content_source: 'unavailable',
      error_type: 'no_usable_content',
      error: 'Workbench responded, but no usable campaign content was returned.',
      message: 'Workbench responded, but no usable campaign content was returned.',
      workbench_http_status: result.httpStatus,
      workbench_response: result.data,
      normalized_generated_content: null,
      requires_workbench: true
    });
  } catch (err) {
    console.error('[Campaigns /generate Error]:', err.message);
    const is404 = err.status === 404 || err.errorType === 'workflow_not_deployed' || String(err.message || '').includes('404');
    const isAuth = err.status === 401 || err.status === 403 || err.errorType === 'auth_error';
    const isNetwork = err.errorType === 'network_error';
    const isTimeout = err.errorType === 'timeout';
    const isConfiguration = err.errorType === 'configuration_error';

    const errorType = is404
      ? 'workflow_not_deployed'
      : isAuth
      ? 'auth_error'
      : isNetwork
      ? 'network_error'
      : isTimeout
      ? 'timeout'
      : isConfiguration
      ? 'configuration_error'
      : 'generation_failed';

    const userMessage = is404
      ? 'Generation is currently unavailable because the SNS Workbench Client Nurturing workflow is not deployed or its production webhook is unavailable.'
      : isAuth
      ? 'SNS Workbench authentication required or credentials rejected.'
      : isNetwork
      ? 'Unable to connect to SNS Workbench. Check your internet connection.'
      : isTimeout
      ? 'SNS Workbench did not respond before the generation request timed out.'
      : isConfiguration
      ? 'SNS Workbench production endpoint configuration is invalid.'
      : (err.message || 'SNS Workbench encountered an error during generation.');

    return res.status(502).json({
      success: false,
      source: 'workbench_error',
      content_source: 'unavailable',
      error_type: errorType,
      error: err.message,
      message: userMessage,
      workbench_http_status: err.status || null,
      workbench_endpoint: err.targetUrl || 'https://api.agents.snsihub.ai/webhook/client-nurturing',
      workbench_response: err.responseData || null,
      action_label: is404 ? 'Check Workbench Deployment' : 'Retry Generation',
      action_hint: is404 ? 'In SNS Workbench, open the Client Nurturing workflow and click "Deploy Live".' : undefined,
      requires_workbench: true
    });
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

    // Same canonical registry used by /generate. Display labels are never sent.
    const dispatchTypeKey = normalizeCampaignType(campaign_type);
    if (!isSupportedCampaignType(dispatchTypeKey)) {
      return res.status(400).json({
        success: false,
        error_type: 'unsupported_campaign_type',
        error: campaign_type
          ? `Campaign type "${campaign_type}" is not supported by the SNS Square Client Nurturing workflow.`
          : 'A supported campaign type is required before dispatch.',
        supported_campaign_types: ['newsletter', 'festival_wish', 'promotional', 'follow_up', 'event_invitation', 'announcement']
      });
    }

    // BLOCK DISPATCH: every recipient must have a real email address.
    const recipientsMissingEmail = targetAudienceContacts.filter(c => !String(c.email || '').trim());
    if (recipientsMissingEmail.length > 0) {
      return res.status(400).json({
        success: false,
        error_type: 'missing_recipient_email',
        error: `${recipientsMissingEmail.length} selected recipient(s) have no email address. Add an email address or remove them from the audience before dispatching.`,
        contacts_missing_email: recipientsMissingEmail.map(c => ({ id: c.id, name: c.name || '' }))
      });
    }

    // Only real stored sector data. No industry is invented.
    const activeSector = String(sector || targetContact?.sector || targetContact?.industry || '').trim();
    const dispatchAudienceLabel = String(audience || '').trim();
    const finalDeveloperInput = developer_input || topic || occasion || '';
    const finalSubject = String(content?.subject || req.body.subject || '').trim();
    const finalBody = String(content?.email_body || req.body.email_body || content?.body || req.body.body || '').trim();
    if (!finalSubject || !finalBody) {
      return res.status(400).json({
        success: false,
        error_type: 'missing_campaign_content',
        error: 'Campaign subject and content are required before dispatch.'
      });
    }

    let finalImageUrl = image_url || content?.image_url || ''; 
    let publicImageUrl = null;
    if (finalImageUrl) {
      publicImageUrl = await uploadToFreeImage(finalImageUrl, req);
    }
    if (!publicImageUrl && finalImageUrl && finalImageUrl.startsWith('http')) {
      publicImageUrl = finalImageUrl;
    }
    if (finalImageUrl && !publicImageUrl) {
      publicImageUrl = saveLocalPoster(finalImageUrl, req);
    }

    const unsubBase = getUnsubscribeBaseUrl(req);
    const primaryContact = targetContact || targetAudienceContacts[0];
    const primaryFirstName = (primaryContact.name || '').split(' ')[0];
    const primaryFullName = primaryContact.name || '';

    const isDeliveryConfirmed = (resData) => isDeliveryConfirmedResponse(resData);

    const allStoreContacts = nurtureStore.getContacts();

    // Dispatch concurrently to every opted-in contact with complete personalized content
    const dispatchPromises = targetAudienceContacts.map(async (recipient) => {
      const {
        body: personalizedBody,
        subject: personalizedSubject,
        recipientUnsubUrl,
        recipientPrefUrl
      } = personalizeContentForRecipient(finalBody, finalSubject, recipient, allStoreContacts, unsubBase);

      const unsubscribeFooterHtml = `
<div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.6;">
  You are receiving this executive update because of your strategic collaboration with SNS Square.<br/>
  <a href="${recipientUnsubUrl}" style="color: #2563eb; text-decoration: underline; margin-right: 12px;">Unsubscribe</a> &bull; 
  <a href="${recipientPrefUrl}" style="color: #64748b; text-decoration: underline; margin-left: 12px;">Manage Preferences</a>
</div>`.trim();

      // Ensure the email is formatted inside the complete SNS Square branded template
      // (Header with dynamic title/subtitle, branded body, and complete compliant footer)
      let recipientBody = personalizedBody;

      if (!recipientBody.includes('sns-email-container') || !recipientBody.includes('Embassy TechVillage')) {
        recipientBody = wrapInSnsSquareTemplate(recipientBody, {
          campaignType: dispatchTypeKey,
          title: content?.header_title || personalizedSubject || campaign_name || 'Your Weekly GCC & AI Scoop',
          subtitle: content?.header_subtitle || (finalDeveloperInput ? `Topic: ${String(finalDeveloperInput).slice(0, 45)}` : 'Core Perspective | Wednesday Edition'),
          imageUrl: publicImageUrl || null,
          recipientUnsubUrl,
          recipientPrefUrl,
          company: 'SNS Square'
        });
      } else if (publicImageUrl && !recipientBody.includes('<img')) {
        const formattedText = recipientBody.split('\n\n').map(p => `<p style="margin: 0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`).join('');
        recipientBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${publicImageUrl}" alt="Campaign Poster" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />
  </div>
  <div style="font-size: 15px; color: #1e293b; line-height: 1.6;">
    ${formattedText}
  </div>
  ${unsubscribeFooterHtml}
</div>`.trim();
      }

      // Aggressively replace any localhost or non-production links
      recipientBody = forcePublicUnsubscribeUrls(recipientBody, recipientUnsubUrl, recipientPrefUrl);

      const recipientPayload = {
        action: 'approve_and_send',
        campaign_name: campaign_name || (recipient.company ? `${recipient.company} Update` : 'Client Update'),
        campaign_type: dispatchTypeKey,
        developer_input: `CAMPAIGN TOPIC: ${finalDeveloperInput}\n\nTARGET RECIPIENT: ${recipient.name || ''} at ${recipient.company || ''}${recipient.sector || recipient.industry ? ` (${recipient.sector || recipient.industry})` : ''}\nUNSUBSCRIBE LINK: ${recipientUnsubUrl}\nPREFERENCES LINK: ${recipientPrefUrl}`,
        occasion: finalDeveloperInput,
        sector: recipient.sector || recipient.industry || activeSector,
        target_segment: dispatchAudienceLabel,
        channel: (channels && channels[0]) || 'email',
        from_email: process.env.NURTURE_SENDER_EMAIL || '',
        sender_email: process.env.NURTURE_SENDER_EMAIL || '',
        contacts: [recipient],
        active_contact: recipient,
        to_email: recipient.email,
        recipient_email: recipient.email,
        email: recipient.email,
        recipient_name: recipient.name,
        recipient_company: recipient.company,
        unsubscribe_url: recipientUnsubUrl,
        preferences_url: recipientPrefUrl,
        content: {
          ...content,
          subject: personalizedSubject,
          image_url: publicImageUrl || finalImageUrl,
          poster_url: publicImageUrl || finalImageUrl,
          attachments: publicImageUrl || finalImageUrl,
          email_body: recipientBody,
          unsubscribe_url: recipientUnsubUrl,
          preferences_url: recipientPrefUrl
        },
        image_url: publicImageUrl || finalImageUrl,
        poster_url: publicImageUrl || finalImageUrl,
        poster_image: publicImageUrl || finalImageUrl,
        attachments: publicImageUrl || finalImageUrl,
        subject: personalizedSubject,
        email_body: recipientBody,
        whatsapp_message: content?.whatsapp_message
      };

      try {
        const result = await workbenchService.triggerNurturingWorkflow(recipientPayload);
        const confirmed = isDeliveryConfirmed(result?.data);
        return { recipient, success: confirmed, result, recipientBody, recipientPayload };
      } catch (err) {
        console.error(`[Campaigns /dispatch] Failed to dispatch to ${recipient.email}:`, err.message);
        return { recipient, success: false, error: err.message };
      }
    });

    const dispatchResults = await Promise.all(dispatchPromises);
    const successfulDispatches = dispatchResults.filter(r => r.success);

    if (successfulDispatches.length === 0) {
      const firstError = dispatchResults.find(r => r.error)?.error || 'Workbench responded without confirming campaign delivery.';
      return res.status(502).json({
        success: false,
        error: `Workbench delivery failed: ${firstError}`,
        requires_workbench: true,
        dispatch_results: dispatchResults.map(r => ({ recipient: r.recipient?.email, success: r.success, error: r.error }))
      });
    }

    const primaryDispatch = successfulDispatches[0];
    const result = primaryDispatch.result;
    const payload = primaryDispatch.recipientPayload;

    const recipientCount = targetAudienceContacts.length;
    const sentCount = successfulDispatches.length;
    const rawMetrics = result.data?.metrics || result.data?.result?.metrics;
    const metric = key => {
      const value = rawMetrics?.[key];
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const workbenchMetrics = {
      total_recipients: metric('total_recipients') ?? recipientCount,
      sent: sentCount,
      delivered: sentCount,
      opened: metric('opened') ?? 0,
      clicked: metric('clicked') ?? 0,
      replied: metric('replied') ?? 0,
      interested: metric('interested') ?? 0,
      unsubscribed: metric('unsubscribed') ?? 0
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
      target_audience: payload.target_segment,
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
    const recipientEmails = successfulDispatches.map(s => s.recipient?.email || s.recipient?.name).filter(Boolean).join(', ');
    const targetName = targetContact ? `${targetContact.name} (${targetContact.company})` : `${recipientCount} Client(s)`;
    const newAuditEntries = [{
      event_type: 'Campaign Delivery Logger',
      contact_name: targetName,
      details: `Workbench confirmed campaign dispatch for "${newCampaign.name}" (${newCampaign.type}) to ${recipientEmails || 'selected contacts'}. Timestamp: ${sentDateStr}`,
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
      name: String(campaign_name || '').trim() || 'Draft Campaign',
      type: normalizeCampaignType(campaign_type) || 'newsletter',
      type_key: normalizeCampaignType(campaign_type) || 'newsletter',
      sector: String(sector || '').trim(),
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
module.exports.extractWorkbenchAiContent = extractWorkbenchAiContent;
module.exports.personalizeContentForRecipient = personalizeContentForRecipient;
module.exports.isDeliveryConfirmedResponse = isDeliveryConfirmedResponse;
