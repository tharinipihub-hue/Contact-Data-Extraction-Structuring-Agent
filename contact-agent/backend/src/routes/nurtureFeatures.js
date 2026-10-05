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
    const {
      campaign_type = 'newsletter',
      campaign_name,
      campaign_brief,
      contact_id,
      occasion
    } = req.body;

    // Select test contact
    let testContact = null;
    if (contact_id) testContact = nurtureStore.getContactById(contact_id);
    if (!testContact || testContact.opt_in !== true) {
      testContact = nurtureStore.getContacts().find(c => c.opt_in === true);
    }
    if (!testContact) {
      testContact = {
        id: 'AI-TEST-SANDBOX-001',
        name: 'AI Test Contact',
        company: 'AI Test Organization',
        designation: 'Test Executive',
        email: 'ai-test-sandbox@noreply.local',
        sector: 'Technology',
        industry: 'Technology',
        opt_in: true,
        country: 'India'
      };
    }

    const effectiveBrief = campaign_brief || `AI Quality Test — ${campaign_type} campaign evaluation`;
    const effectiveName = campaign_name || `AI Test: ${campaign_type}`;
    const testStartedAt = new Date().toISOString();
    const testId = `AI-TEST-${Date.now()}`;

    // Generate content via Workbench — test_mode flag set, NO dispatch
    let workbenchResult = null;
    let generatedContent = null;
    let workbenchError = null;

    const testPayload = {
      action: 'generate_preview',
      campaign_name: effectiveName,
      campaign_type,
      developer_input: effectiveBrief,
      campaign_brief: effectiveBrief,
      sector: testContact.sector || 'Technology',
      industry: testContact.industry || 'Technology',
      company: testContact.company,
      full_name: testContact.name,
      first_name: testContact.name.split(' ')[0],
      designation: testContact.designation || 'Executive',
      name: testContact.name,
      email: testContact.email,
      to_email: testContact.email,
      target_segment: 'AI Test Audience (Sandbox)',
      channel: 'email',
      contacts: [testContact],
      active_contact: testContact,
      occasion: occasion || '',
      country: testContact.country || '',
      is_test_mode: true,
      test_mode: true
    };

    try {
      workbenchResult = await workbenchService.triggerNurturingWorkflow(testPayload);
      generatedContent = extractWorkbenchAiContent(workbenchResult?.data);
      if (!generatedContent && workbenchResult?.data) {
        const d = workbenchResult.data;
        const src = d?.nurtured_contact || d?.result || d;
        if (src?.subject && src?.email_body) {
          generatedContent = { subject: src.subject, email_body: src.email_body, content_source: 'workbench' };
        }
      }
      if (generatedContent) generatedContent.content_source = 'workbench';
    } catch (err) {
      workbenchError = err.message;
      workbenchResult = { success: false, error: err.message, source: 'error' };
    }

    if (!generatedContent) {
      generatedContent = { subject: '', email_body: '', content_source: 'unavailable', error: workbenchError || 'Workbench did not return content' };
    }

    // Run test evaluators
    const body = String(generatedContent.email_body || '');
    const subject = String(generatedContent.subject || '');

    const testResults = [];

    // Test 1: Personalization
    const personTest = (() => {
      const issues = []; const good = []; const recs = []; let score = 10;
      const placeholders = [...body.matchAll(/\[([A-Za-z_ ]+)\]|\{([A-Za-z_ ]+)\}/g), ...subject.matchAll(/\[([A-Za-z_ ]+)\]|\{([A-Za-z_ ]+)\}/g)];
      if (placeholders.length > 0) { issues.push(`Unreplaced placeholders: ${placeholders.map(m => m[0]).slice(0, 5).join(', ')}`); score -= 3; } else { good.push('No unreplaced placeholders.'); }
      const firstName = testContact.name.split(' ')[0];
      if (body.includes(firstName) || body.includes(testContact.name)) { good.push(`Recipient name "${firstName}" present.`); score += 1; } else { issues.push(`Recipient name not found in body.`); score -= 2; recs.push('Ensure greeting uses recipient first name.'); }
      if (testContact.company && body.includes(testContact.company)) { good.push('Company name present.'); } else { issues.push('Company name not found in content.'); score -= 1; }
      if (/Dear\s+(Partner|Client|Valued|User|Customer)/i.test(body)) { issues.push('Generic greeting detected.'); score -= 2; recs.push('Use recipient name in greeting.'); }
      score = Math.max(0, Math.min(10, score));
      return { test_name: 'Campaign Personalization', category: 'personalization', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
    })();
    testResults.push(personTest);

    // Test 2: Content Quality
    const contentTest = (() => {
      const issues = []; const good = []; const recs = []; let score = 10;
      if (!body || body.trim().length < 50) { issues.push('Email body empty or too short.'); score -= 5; } else { good.push('Email body has sufficient content.'); }
      if (!subject || subject.trim().length < 5) { issues.push('Subject empty or too short.'); score -= 3; } else { good.push('Subject present.'); }
      const defaultFound = ['[Your Name]','[Company Name]','Lorem ipsum','placeholder','{{','}}'].filter(d => body.includes(d) || subject.includes(d));
      if (defaultFound.length > 0) { issues.push(`Default content detected: ${defaultFound.join(', ')}`); score -= 3; } else { good.push('No default template content.'); }
      if (generatedContent.content_source === 'workbench') { good.push('Content from Workbench AI.'); } else { issues.push('Content NOT from Workbench.'); score -= 2; recs.push('Ensure Workbench is connected and workflow is deployed.'); }
      score = Math.max(0, Math.min(10, score));
      return { test_name: 'Content Quality', category: 'content_quality', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
    })();
    testResults.push(contentTest);

    // Test 3: Newsletter structure (if newsletter)
    if (['newsletter', 'Newsletter'].includes(campaign_type)) {
      const nTest = (() => {
        const issues = []; const good = []; const recs = []; let score = 10;
        if (subject.includes('SNS Square') || subject.includes('AI') || subject.includes('Weekly')) { good.push('Subject references newsletter branding.'); } else { issues.push('Subject missing newsletter branding.'); score -= 2; }
        const headlineCount = (body.match(/<strong>|#{1,3}\s+\w/g) || []).length;
        if (headlineCount >= 2) { good.push(`${headlineCount} section headings found.`); } else { issues.push('Fewer than 2 section headings.'); score -= 2; recs.push('Newsletter needs 3-4 curated perspectives with bold headings.'); }
        const linkCount = (body.match(/href=|https?:\/\//g) || []).length;
        if (linkCount >= 2) { good.push(`${linkCount} links present.`); } else { issues.push('Fewer than 2 action links.'); score -= 1; }
        if (body.includes('unsubscribe') || body.includes('Unsubscribe')) { good.push('Unsubscribe link present.'); } else { issues.push('No unsubscribe link.'); score -= 2; }
        score = Math.max(0, Math.min(10, score));
        return { test_name: 'Newsletter Structure', category: 'campaign_type_compliance', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
      })();
      testResults.push(nTest);
    }

    // Test 4: Festival tone (if festival)
    if (['festival_wish', 'Festival / Occasion Wish', 'festival', 'Festival'].includes(campaign_type)) {
      const fTest = (() => {
        const issues = []; const good = []; const recs = []; let score = 10;
        const warmWords = ['warm','joyous','prosperous','celebrate','wishes','greetings','festive','luminous','blessings','happy','joy'];
        const warmCount = warmWords.filter(w => body.toLowerCase().includes(w)).length;
        if (warmCount >= 2) { good.push(`Warm tone detected (${warmCount} warm words).`); } else { issues.push('Festival message lacks warm tone.'); score -= 3; recs.push('Use warm, occasion-specific language.'); }
        if (occasion && body.toLowerCase().includes(occasion.toLowerCase().split(' ')[0])) { good.push(`Occasion "${occasion}" mentioned.`); } else if (occasion) { issues.push(`Occasion "${occasion}" not mentioned.`); score -= 2; }
        const techWords = ['newsletter','AI automation','cloud modernisation','enterprise transformation','ROI','case study','platform update'];
        const techFound = techWords.filter(t => body.toLowerCase().includes(t.toLowerCase()));
        if (techFound.length > 1) { issues.push(`Technical content in festival message: ${techFound.slice(0,3).join(', ')}`); score -= 3; recs.push('Remove technical content from festival messages.'); } else { good.push('No inappropriate technical content.'); }
        const wordCount = body.split(/\s+/).length;
        if (wordCount > 400) { issues.push(`Message too long (${wordCount} words). Festival wishes should be under 200 words.`); score -= 1; } else { good.push(`Appropriate length (${wordCount} words).`); }
        score = Math.max(0, Math.min(10, score));
        return { test_name: 'Festival / Occasion Tone', category: 'tone', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
      })();
      testResults.push(fTest);
    }

    // Test 5: Technical validity
    const techTest = (() => {
      const issues = []; const good = []; const recs = []; let score = 10;
      if (body.includes('unsubscribe')) { good.push('Unsubscribe link present.'); } else { issues.push('No unsubscribe link — compliance risk.'); score -= 3; }
      if (body.includes('localhost') || body.includes('127.0.0.1')) { issues.push('Localhost URL detected.'); score -= 2; recs.push('Use PUBLIC_APP_URL in production.'); } else { good.push('No localhost URLs.'); }
      if (testContact.email && testContact.email.includes('@')) { good.push('Recipient email valid.'); } else { issues.push('Recipient email missing or invalid.'); score -= 3; }
      if (testContact.opt_in === true) { good.push('Contact has opt-in consent.'); } else { issues.push('CRITICAL: Contact has no opt-in.'); score -= 5; }
      score = Math.max(0, Math.min(10, score));
      return { test_name: 'Technical Validity', category: 'technical_validity', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
    })();
    testResults.push(techTest);

    // Test 6: Workbench response
    const wbTest = (() => {
      const issues = []; const good = []; const recs = []; let score = 10;
      if (workbenchResult?.success === true) { good.push('Workbench returned success.'); } else { issues.push(`Workbench error: ${workbenchError || 'Unknown error'}`); score -= 5; recs.push('Check SNS Workbench connectivity. Ensure workflow is deployed.'); }
      if (workbenchResult?.source === 'workbench_webhook') { good.push('Response from Workbench webhook.'); } else if (!workbenchResult?.success) { score -= 3; }
      if (generatedContent?.content_source === 'workbench') { good.push('Content extracted from Workbench.'); } else { issues.push('Content not extracted from Workbench response.'); score -= 2; }
      score = Math.max(0, Math.min(10, score));
      return { test_name: 'Workbench Response Validity', category: 'technical_validity', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: recs };
    })();
    testResults.push(wbTest);

    // Test 7: Compliance
    const compTest = (() => {
      const issues = []; const good = []; let score = 10;
      if (testContact.opt_in !== true) { issues.push('CRITICAL: No opt-in consent.'); score -= 5; } else { good.push('Opt-in consent confirmed.'); }
      if (body.includes('unsubscribe') || body.includes('Unsubscribe')) { good.push('Unsubscribe option present.'); } else { issues.push('No unsubscribe — GDPR/CAN-SPAM risk.'); score -= 3; }
      score = Math.max(0, Math.min(10, score));
      return { test_name: 'Compliance', category: 'compliance', score, max_score: 10, status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL', issues, good, recommendations: [] };
    })();
    testResults.push(compTest);

    // Calculate overall score
    const WEIGHTS = { personalization: 20, content_quality: 20, campaign_type_compliance: 15, tone: 15, technical_validity: 20, compliance: 10 };
    const categoryScores = {};
    Object.keys(WEIGHTS).forEach(cat => {
      const catTests = testResults.filter(t => t.category === cat);
      if (catTests.length === 0) { categoryScores[cat] = { score: WEIGHTS[cat], max: WEIGHTS[cat], skipped: true }; return; }
      const avg = catTests.reduce((sum, t) => sum + (t.score / t.max_score), 0) / catTests.length;
      categoryScores[cat] = { score: Math.round(avg * WEIGHTS[cat] * 10) / 10, max: WEIGHTS[cat], tests: catTests.length };
    });
    const overallScore = Math.round(Object.values(categoryScores).reduce((sum, c) => sum + c.score, 0) * 10) / 10;
    const passed = testResults.filter(t => t.status === 'PASS').length;
    const failed = testResults.filter(t => t.status === 'FAIL').length;
    const warned = testResults.filter(t => t.status === 'WARN').length;

    return res.json({
      success: true,
      test_id: testId,
      test_mode: true,
      email_sent: false,
      campaign_type,
      contact_used: { id: testContact.id, name: testContact.name, company: testContact.company },
      overall_score: overallScore,
      overall_max: 100,
      overall_grade: overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : 'F',
      status: failed === 0 ? (warned === 0 ? 'PASS' : 'PASS_WITH_WARNINGS') : 'FAIL',
      summary: { passed, failed, warned, total: testResults.length },
      category_scores: categoryScores,
      test_results: testResults,
      all_issues: testResults.flatMap(t => t.issues),
      all_recommendations: [...new Set(testResults.flatMap(t => t.recommendations))],
      workbench_status: workbenchResult?.success ? 'connected' : 'error',
      workbench_error: workbenchError,
      generated_content: {
        subject: generatedContent.subject,
        email_body_preview: (generatedContent.email_body || '').slice(0, 400),
        content_source: generatedContent.content_source
      },
      tested_at: testStartedAt,
      completed_at: new Date().toISOString()
    });
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
      developer_input: `Generate a warm, professional, culturally appropriate ${occasion} greeting. This is a festival/occasion wish — NOT a newsletter. Keep it concise (under 150 words), warm, and occasion-specific. Do NOT include product promotions or technical content.`,
      campaign_brief: `${occasion} occasion wish for ${primaryContact.name} at ${primaryContact.company}.`,
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

    generatedContent.content_source = 'workbench';

    return res.json({
      success: true,
      preview_only: Boolean(preview_only),
      occasion,
      occasion_payload: occasionPayload,
      region: effectiveRegion,
      audience_count: audienceContacts.length,
      primary_contact: { id: primaryContact.id, name: primaryContact.name, company: primaryContact.company },
      content: {
        subject: generatedContent.subject,
        email_body: generatedContent.email_body,
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
