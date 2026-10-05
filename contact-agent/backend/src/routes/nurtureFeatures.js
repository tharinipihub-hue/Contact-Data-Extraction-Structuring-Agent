'use strict';

/**
 * Enhanced Nurturing Features Routes
 *
 * Endpoints:
 *  POST /api/nurture/ai-test          — Run AI quality test suite (no email sent)
 *  POST /api/nurture/ai-review        — Run AI product review (recommendations only)
 *  POST /api/nurture/research-contact — Research a contact using Tavily web search
 *  GET  /api/nurture/occasions        — Get all occasions from calendar
 *  POST /api/nurture/occasions/applicable — Get occasions relevant to a contact
 *  POST /api/nurture/occasions/upcoming   — Get upcoming occasions for a contact
 *  POST /api/nurture/instant-wish     — Generate instant occasion wish via Workbench
 */

const express = require('express');
const router = express.Router();
const nurtureStore = require('../services/nurtureStore');
const workbenchService = require('../services/nurtureWorkbenchService');
const occasionService = require('../services/occasionService');
const contactResearchService = require('../services/contactResearchService');
const aiProductReviewService = require('../services/aiProductReviewService');
const aiTestingService = require('../services/aiTestingService');
const {
  sanitizeAndValidateSubject,
  sanitizeAndPersonalizeGreeting,
  cleanEmailBodyHtml,
  wrapInSnsSquareTemplate
} = require('../services/contentSanitizerService');

// ── Helper: extract Workbench AI content (same logic as campaigns.js) ────────
function extractWorkbenchAiContent(data) {
  if (!data) return null;
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
    let cleaned = groqRaw;
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    cleaned = cleaned.trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && (parsed.subject || parsed.email_body)) {
        return { subject: (parsed.subject || '').trim(), email_body: (parsed.email_body || '').trim(), personalization_summary: parsed.personalization_summary || 'Generated via SNS Workbench' };
      }
    } catch (e) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && (parsed.subject || parsed.email_body)) {
            return { subject: (parsed.subject || '').trim(), email_body: (parsed.email_body || '').trim(), personalization_summary: parsed.personalization_summary || 'Generated via SNS Workbench' };
          }
        } catch (err) {}
      }
    }
    const subjectMatch = groqRaw.match(/^(?:Subject|Title):\s*(.+)$/im);
    if (subjectMatch) {
      const subj = subjectMatch[1].trim();
      const body = groqRaw.replace(/^(?:Subject|Title):\s*.+$/im, '').trim();
      if (body) return { subject: subj, email_body: body, personalization_summary: 'Generated via SNS Workbench' };
    }
  }
  const fieldSources = [data.nurtured_contact, data.result?.nurtured_contact, data.result, data];
  for (const src of fieldSources) {
    if (src && typeof src === 'object') {
      const subject = src.subject;
      const email_body = src.email_body;
      if (subject && email_body && typeof subject === 'string' && typeof email_body === 'string' && subject.trim() && email_body.trim()) {
        return { subject: subject.trim(), email_body: email_body.trim(), personalization_summary: src.personalization_summary || 'Generated via SNS Workbench workflow' };
      }
    }
  }
  return null;
}

// ── 1. AI Test Environment ─────────────────────────────────────────────────────

router.post('/ai-test', async (req, res) => {
  try {
    const testResult = await aiTestingService.runAudienceAITest(req.body);
    if (!testResult.success) {
      return res.status(400).json(testResult);
    }
    return res.json(testResult);
  } catch (err) {
    console.error('[AI Test Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. AI Product Review ────────────────────────────────────────────────────────

router.post('/ai-review', (req, res) => {
  try {
    const review = aiProductReviewService.runProductReview();
    return res.json({ success: true, review });
  } catch (err) {
    console.error('[AI Product Review Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ai-review', (req, res) => {
  try {
    const review = aiProductReviewService.runProductReview();
    return res.json({ success: true, review });
  } catch (err) {
    console.error('[AI Product Review Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Contact Research (Tavily) ───────────────────────────────────────────────

router.post('/research-contact', async (req, res) => {
  try {
    const { contact_id, contact } = req.body;
    let targetContact = contact || null;
    if (!targetContact && contact_id) {
      targetContact = nurtureStore.getContactById(contact_id);
    }
    if (!targetContact) {
      return res.status(400).json({ success: false, error: 'Contact data or contact_id is required.' });
    }
    if (!contactResearchService.isTavilyAvailable()) {
      return res.json({
        success: false,
        available: false,
        blocked: true,
        reason: 'BLOCKED — TAVILY_API_KEY is not configured.',
        setup_instructions: 'Add TAVILY_API_KEY=tvly-... to your backend environment variables (and Render dashboard). Get a free API key at https://tavily.com',
        contact_name: targetContact.name,
        company: targetContact.company
      });
    }
    const result = await contactResearchService.researchContact(targetContact);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Research Contact Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/research-industry', async (req, res) => {
  try {
    const { industry } = req.body;
    if (!industry || typeof industry !== 'string' || !industry.trim()) {
      return res.status(400).json({ success: false, error: 'Industry name is required.' });
    }
    const targetIndustry = industry.trim();
    if (!contactResearchService.isTavilyAvailable()) {
      return res.json({
        success: false,
        available: false,
        blocked: true,
        reason: 'BLOCKED — TAVILY_API_KEY is not configured.',
        setup_instructions: 'Add TAVILY_API_KEY=tvly-... to your backend environment variables (and Render dashboard). Get a free API key at https://tavily.com',
        industry: targetIndustry
      });
    }
    const result = await contactResearchService.researchIndustry(targetIndustry);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Research Industry Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 4. Occasions Calendar ──────────────────────────────────────────────────────

// Get all occasions
router.get('/occasions', (req, res) => {
  try {
    const occasions = occasionService.getAllOccasions();
    return res.json({ success: true, occasions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get occasions applicable to a specific contact
router.post('/occasions/applicable', (req, res) => {
  try {
    const { contact_id, contact } = req.body;
    let targetContact = contact || null;
    if (!targetContact && contact_id) {
      targetContact = nurtureStore.getContactById(contact_id);
    }
    const result = occasionService.getApplicableOccasions(targetContact || {});
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get upcoming occasions for a contact (within N days)
router.post('/occasions/upcoming', (req, res) => {
  try {
    const { contact_id, contact, window_days = 60 } = req.body;
    let targetContact = contact || null;
    if (!targetContact && contact_id) {
      targetContact = nurtureStore.getContactById(contact_id);
    }
    const upcoming = occasionService.getUpcomingOccasions(targetContact || {}, Number(window_days) || 60);
    const region = occasionService.detectContactRegion(targetContact || {});
    return res.json({ success: true, upcoming, region, contact_id: targetContact?.id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 5. Instant Occasion Wish ───────────────────────────────────────────────────

router.post('/instant-wish', async (req, res) => {
  try {
    const {
      occasion,
      contact_id,
      contacts: requestedContacts,
      region_override,
      preview_only = false
    } = req.body;

    if (!occasion) {
      return res.status(400).json({ success: false, error: 'Occasion name is required.' });
    }

    // Validate contacts
    let audienceContacts = [];
    if (Array.isArray(requestedContacts) && requestedContacts.length > 0) {
      const ids = new Set(requestedContacts.map(c => typeof c === 'string' ? c : c?.id).filter(Boolean));
      audienceContacts = nurtureStore.getContacts().filter(c => ids.has(c.id) && c.opt_in === true);
    } else if (contact_id) {
      const found = nurtureStore.getContactById(contact_id);
      if (found && found.opt_in === true) audienceContacts = [found];
    }
    if (audienceContacts.length === 0) {
      audienceContacts = nurtureStore.getContacts().filter(c => c.opt_in === true);
    }
    if (audienceContacts.length === 0) {
      return res.status(400).json({ success: false, error: 'No opted-in contacts available for this occasion campaign.' });
    }

    const primaryContact = audienceContacts[0];
    const occasionPayload = occasionService.buildOccasionPayload(occasion, primaryContact);

    // If region_override is provided, use it (user explicitly selected region)
    const effectiveRegion = region_override || occasionPayload.region;

    const workbenchPayload = {
      action: 'generate_preview',
      campaign_name: `${occasion} Greetings from SNS Square`,
      campaign_type: 'festival_wish',
      developer_input: `Warm ${occasion} greeting celebrating milestones with ${primaryContact.name} at ${primaryContact.company}. FESTIVAL WISH RULE: Return only the greeting content without any instruction headings.`,
      campaign_brief: `${occasion} festive greeting for ${primaryContact.name} at ${primaryContact.company}.`,
      occasion,
      ...occasionPayload,
      region: effectiveRegion,
      sector: primaryContact.sector || primaryContact.industry || 'Technology',
      industry: primaryContact.industry || primaryContact.sector || 'Technology',
      company: primaryContact.company,
      full_name: primaryContact.name,
      first_name: primaryContact.name.split(' ')[0],
      designation: primaryContact.designation || 'Executive',
      name: primaryContact.name,
      email: primaryContact.email,
      to_email: primaryContact.email,
      target_segment: `Clients (${effectiveRegion || 'Global'})`,
      channel: 'email',
      contacts: audienceContacts,
      active_contact: primaryContact
    };

    let workbenchResult = null;
    let generatedContent = null;
    let workbenchError = null;

    try {
      workbenchResult = await workbenchService.triggerNurturingWorkflow(workbenchPayload);
      generatedContent = extractWorkbenchAiContent(workbenchResult?.data);
      if (!generatedContent && workbenchResult?.data) {
        const d = workbenchResult.data;
        const src = d?.nurtured_contact || d?.result || d;
        if (src?.subject && src?.email_body) {
          generatedContent = { subject: src.subject, email_body: src.email_body };
        }
      }
    } catch (err) {
      workbenchError = err.message;
    }

    if (!generatedContent?.subject || !generatedContent?.email_body) {
      return res.status(502).json({
        success: false,
        error: workbenchError || 'AI content generation failed. Please retry or check the Workbench connection.',
        requires_workbench: true
      });
    }

    // 1. Sanitize subject line to guarantee prompt instructions never leak
    const cleanSubject = sanitizeAndValidateSubject(generatedContent.subject, {
      campaignType: 'festival_wish',
      occasion,
      company: primaryContact.company,
      name: primaryContact.name,
      topic: `${occasion} festive greetings`
    });

    // 2. Sanitize greeting to prevent generic fake titles (Dear Leader, Dear Executive)
    let cleanBody = sanitizeAndPersonalizeGreeting(generatedContent.email_body, primaryContact);
    cleanBody = cleanEmailBodyHtml(cleanBody);

    // 3. Wrap in official standardized SNS Square email template
    const unsubBase = process.env.PUBLIC_APP_URL || 'https://contact-data-extraction-structuring-agent.onrender.com';
    const recipientUnsubUrl = `${unsubBase}/unsubscribe?id=${encodeURIComponent(primaryContact.id)}`;
    const recipientPrefUrl = `${unsubBase}/preferences?id=${encodeURIComponent(primaryContact.id)}`;

    const fullTemplateHtml = wrapInSnsSquareTemplate(cleanBody, {
      campaignType: 'festival_wish',
      recipientUnsubUrl,
      recipientPrefUrl,
      company: 'SNS Square'
    });

    return res.json({
      success: true,
      preview_only: Boolean(preview_only),
      occasion,
      occasion_payload: occasionPayload,
      region: effectiveRegion,
      audience_count: audienceContacts.length,
      primary_contact: { id: primaryContact.id, name: primaryContact.name, company: primaryContact.company },
      content: {
        subject: cleanSubject,
        email_body: fullTemplateHtml,
        email_body_html: fullTemplateHtml,
        body_text_only: cleanBody,
        content_version: 'v1',
        content_source: 'workbench'
      },
      workbench_source: workbenchResult?.targetUrl
    });
  } catch (err) {
    console.error('[Instant Wish Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── 6. Industry Newsletter Context ─────────────────────────────────────────────

router.post('/industry-context', async (req, res) => {
  try {
    const { industry, contact_id, contact } = req.body;
    let targetContact = contact || null;
    if (!targetContact && contact_id) {
      targetContact = nurtureStore.getContactById(contact_id);
    }
    const effectiveIndustry = industry || targetContact?.industry || targetContact?.sector || 'Technology';

    if (!contactResearchService.isTavilyAvailable()) {
      return res.json({
        success: false,
        available: false,
        blocked: true,
        reason: 'BLOCKED — TAVILY_API_KEY is not configured.',
        setup_instructions: 'Add TAVILY_API_KEY=tvly-... to environment variables.',
        industry: effectiveIndustry
      });
    }

    const result = await contactResearchService.tavilySearch(
      `${effectiveIndustry} industry trends AI automation enterprise digital transformation 2025 2026`,
      { maxResults: 5, depth: 'basic' }
    );

    return res.json({
      success: true,
      industry: effectiveIndustry,
      context: {
        answer: result.answer,
        insights: result.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          score: r.score
        })),
        query: result.query,
        retrieved_at: new Date().toISOString(),
        source: 'Tavily Web Search'
      }
    });
  } catch (err) {
    console.error('[Industry Context Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
