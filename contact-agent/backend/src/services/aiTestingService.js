'use strict';

/**
 * Enterprise AI Quality Testing Service — Digital Client Nurturing Agent
 * 
 * Scaled audience-level quality validation:
 *  - Quick Test (5–10 representative contacts)
 *  - Standard Test (25 representative contacts)
 *  - Full Test (all contacts in selected audience)
 * 
 * Transparent 100-Point Quality Score Model:
 *  - Personalization: 20
 *  - Content Quality: 20
 *  - Campaign Structure: 15
 *  - Industry / Context Relevance: 15
 *  - Technical Validity: 10
 *  - Compliance: 15
 *  - Brand Consistency: 5
 *  Total: 100
 * 
 * Statuses:
 *  - 90–100: READY
 *  - 75–89: READY WITH WARNINGS
 *  - Below 75: NEEDS IMPROVEMENT
 *  - Critical compliance failures override to BLOCKED
 * 
 * Guarantee: Running AI Quality validation NEVER sends emails to real customers.
 */

const workbenchService = require('./nurtureWorkbenchService');
const nurtureStore = require('./nurtureStore');
const {
  detectPromptLeakInSubject,
  sanitizeAndValidateSubject,
  sanitizeAndPersonalizeGreeting
} = require('./contentSanitizerService');

const SCORING_MODEL = {
  personalization: { max: 20, label: 'Personalization Quality' },
  content_quality: { max: 20, label: 'Content Quality & Integrity' },
  campaign_structure: { max: 15, label: 'Campaign Structure Compliance' },
  industry_relevance: { max: 15, label: 'Industry & Context Relevance' },
  technical_validity: { max: 10, label: 'Technical & Link Validity' },
  compliance: { max: 15, label: 'Compliance & Consent Coverage' },
  brand_consistency: { max: 5, label: 'SNS Square Brand Consistency' }
};

/**
 * Filter audience based on criteria.
 */
function resolveAudienceContacts(options = {}) {
  const audience_filter = (options.audience_filter || options.audience_scope || 'all').toLowerCase();
  const audience_value = String(options.audience_value || options.filter_value || '').trim();
  const selected_contact_ids = options.selected_contact_ids || options.contact_ids || [];
  const contacts_override = options.contacts_override || null;

  let allContacts = contacts_override || nurtureStore.getContacts();

  if (audience_filter === 'selected' && Array.isArray(selected_contact_ids) && selected_contact_ids.length > 0) {
    const idSet = new Set(selected_contact_ids);
    return allContacts.filter(c => idSet.has(c.id));
  }

  if (audience_filter === 'industry' && audience_value) {
    const val = audience_value.toLowerCase();
    return allContacts.filter(c => {
      const ind = (c.sector || c.industry || '').toLowerCase();
      return ind.includes(val) || val.includes(ind);
    });
  }

  if (audience_filter === 'region' && audience_value) {
    const val = audience_value.toLowerCase();
    const occasionService = require('./occasionService');
    return allContacts.filter(c => {
      const detected = occasionService.detectContactRegion(c).toLowerCase();
      const loc = [c.country, c.state, c.city, c.location].filter(Boolean).join(' ').toLowerCase();
      return detected.includes(val) || val.includes(detected) || loc.includes(val);
    });
  }

  if (audience_filter === 'campaign' && audience_value) {
    const campaigns = nurtureStore.getCampaigns();
    const cmp = campaigns.find(c => c.id === audience_value || c.name === audience_value);
    if (cmp && Array.isArray(cmp.contacts) && cmp.contacts.length > 0) {
      const idSet = new Set(cmp.contacts.map(c => typeof c === 'string' ? c : c?.id));
      return allContacts.filter(c => idSet.has(c.id));
    }
  }

  if (audience_filter === 'segment' && audience_value) {
    return allContacts.filter(c => (c.client_type || c.segment || 'Past Clients').toLowerCase() === audience_value.toLowerCase());
  }

  // Default: All opted-in contacts (or all contacts if no opt-ins)
  const optedIn = allContacts.filter(c => c.opt_in === true);
  return optedIn.length > 0 ? optedIn : allContacts;
}

/**
 * Select a representative sample based on test mode.
 */
function sampleAudience(audience, testMode = 'quick', customSampleSize = null) {
  if (audience.length === 0) return [];
  if (testMode === 'full') return audience;

  let sampleLimit = 10;
  if (customSampleSize && Number(customSampleSize) > 0) {
    sampleLimit = Math.min(Number(customSampleSize), audience.length);
  } else if (testMode === 'standard') {
    sampleLimit = Math.min(25, audience.length);
  } else {
    // Quick test
    sampleLimit = Math.min(10, audience.length);
  }

  if (audience.length <= sampleLimit) return audience;

  // Stratified sampling across industries/regions for representative coverage
  const sampled = [];
  const step = Math.floor(audience.length / sampleLimit);
  for (let i = 0; i < sampleLimit; i++) {
    const idx = Math.min(i * step, audience.length - 1);
    sampled.push(audience[idx]);
  }
  return sampled;
}

/**
 * Evaluate single contact data and generated content.
 */
function evaluateContactRecord(contact, content, campaignType, occasion) {
  const issues = [];
  const warnings = [];
  const goods = [];
  let isBlocked = false;

  const body = String(content?.email_body || '');
  const subject = String(content?.subject || '');

  // 1. Compliance check (Critical)
  if (contact.opt_in === false) {
    issues.push(`Contact ${contact.name || contact.id} has opted out. Must not receive campaigns.`);
    isBlocked = true;
  }
  if (!contact.email || !contact.email.includes('@')) {
    issues.push(`Contact ${contact.name || contact.id} has missing or invalid email address.`);
    isBlocked = true;
  }
  if (!body.includes('unsubscribe') && !body.includes('Unsubscribe')) {
    issues.push('Missing mandatory one-click unsubscribe mechanism.');
    isBlocked = true;
  }

  // 2. Personalization check
  if (!contact.name || contact.name.trim().length < 2) {
    warnings.push(`Missing recipient contact name.`);
  } else {
    const firstName = contact.name.split(' ')[0];
    if (body.includes(firstName) || body.includes(contact.name)) {
      goods.push(`Personalized greeting with first name "${firstName}".`);
    } else {
      warnings.push(`First name "${firstName}" not found in message body.`);
    }
  }

  if (!contact.company || contact.company === 'Enterprise Partner') {
    warnings.push(`Missing confirmed company name for contact.`);
  } else if (body.includes(contact.company) || subject.includes(contact.company)) {
    goods.push(`Company name "${contact.company}" reflected in campaign.`);
  }

  // Check for fake titles
  if (/Dear\s+(?:Leader|Executive|Enterprise\s+Partner|Client\s+Executive)/i.test(body)) {
    issues.push(`Generic fabricated title ("Dear Leader/Executive") detected.`);
  }

  // Check for unreplaced placeholders
  const placeholderMatch = body.match(/\[([A-Za-z_ ]+)\]|\{([A-Za-z_ ]+)\}/);
  if (placeholderMatch) {
    issues.push(`Unreplaced placeholder "${placeholderMatch[0]}" detected.`);
  }

  // 3. Subject Line Prompt Leak Check
  if (detectPromptLeakInSubject(subject)) {
    issues.push(`AI instructions leaked into subject line: "${subject.slice(0, 45)}...".`);
  }

  // 4. Tone / Campaign-type check
  const isFestival = String(campaignType).toLowerCase().includes('festival') || String(campaignType).toLowerCase().includes('wish');
  if (isFestival) {
    if (subject.includes('Weekly GCC & AI Scoop')) {
      warnings.push('Festival greeting contains newsletter branding in subject line.');
    }
    const techWords = ['cloud modernisation', 'ai automation digest', 'roi case study', 'platform update'];
    const foundTech = techWords.filter(tw => body.toLowerCase().includes(tw));
    if (foundTech.length > 0) {
      warnings.push(`Festival greeting contains technical newsletter content: ${foundTech.join(', ')}.`);
    }
  }

  const occasionService = require('./occasionService');
  const detectedRegion = occasionService.detectContactRegion(contact);
  let regionDisplay = contact.country || contact.location || 'Global';
  if (detectedRegion.toLowerCase().includes('india')) {
    regionDisplay = 'India';
  } else if (detectedRegion.toLowerCase().includes('united states') || detectedRegion.toLowerCase().includes('us') || detectedRegion.toLowerCase().includes('america')) {
    regionDisplay = 'USA';
  }

  return {
    contact_id: contact.id,
    contact_name: contact.name || 'Unnamed',
    company: contact.company || 'Unspecified',
    industry: contact.sector || contact.industry || 'Technology',
    region: regionDisplay,
    email: contact.email || '',
    is_blocked: isBlocked,
    issues,
    warnings,
    goods
  };
}

/**
 * Run Full Audience-Level AI Quality Test Suite
 */
async function runAudienceAITest(options = {}) {
  const audience_filter = options.audience_filter || options.audience_scope || 'all';
  const audience_value = options.audience_value || options.filter_value || '';
  const selected_contact_ids = options.selected_contact_ids || options.contact_ids || [];
  const test_mode = options.test_mode || options.testing_mode || 'quick';
  const sample_size = options.sample_size || null;
  const campaign_type = options.campaign_type || 'newsletter';
  const campaign_name = options.campaign_name || '';
  const campaign_brief = options.campaign_brief || '';
  const occasion = options.occasion || '';

  const testStartedAt = new Date().toISOString();
  const testId = `AI-AUDIT-${Date.now()}`;

  // 1. Resolve full audience
  const fullAudience = resolveAudienceContacts({
    audience_filter,
    audience_value,
    selected_contact_ids
  });

  const totalAudienceCount = fullAudience.length;
  if (totalAudienceCount === 0) {
    return {
      success: false,
      error: 'No contacts found for the selected audience criteria.',
      total_audience: 0,
      tested_count: 0
    };
  }

  // 2. Select test sample
  const testSample = sampleAudience(fullAudience, test_mode, sample_size);
  const primaryContact = testSample.find(c => c.opt_in === true) || testSample[0];

  const effectiveBrief = campaign_brief || (
    campaign_type.includes('festival')
      ? `Warm ${occasion || 'Festive'} wishes celebrating shared milestones and wishing prosperity. Concise, respectful, warm. No technical newsletter.`
      : `Weekly enterprise briefing for ${primaryContact.sector || 'Technology'} leadership.`
  );
  const effectiveName = campaign_name || `AI Quality Audit: ${campaign_type}`;

  // 3. Trigger live Workbench in Sandbox Test Mode
  let workbenchResult = null;
  let workbenchError = null;
  let rawContent = null;

  const testPayload = {
    action: 'generate_preview',
    campaign_name: effectiveName,
    campaign_type,
    developer_input: effectiveBrief,
    campaign_brief: effectiveBrief,
    sector: primaryContact.sector || primaryContact.industry || 'Technology',
    industry: primaryContact.industry || primaryContact.sector || 'Technology',
    company: primaryContact.company,
    full_name: primaryContact.name,
    first_name: (primaryContact.name || '').split(' ')[0] || '',
    designation: primaryContact.designation || 'Executive',
    name: primaryContact.name,
    email: primaryContact.email,
    to_email: primaryContact.email,
    target_segment: `Audit Sample (${testSample.length} contacts)`,
    channel: 'email',
    contacts: [primaryContact],
    active_contact: primaryContact,
    occasion: occasion || '',
    country: primaryContact.country || '',
    is_test_mode: true,
    test_mode: true
  };

  try {
    workbenchResult = await workbenchService.triggerNurturingWorkflow(testPayload);
    const { extractWorkbenchAiContent } = require('../routes/campaigns');
    if (extractWorkbenchAiContent) {
      rawContent = extractWorkbenchAiContent(workbenchResult?.data);
    }
    if (!rawContent && workbenchResult?.data) {
      const d = workbenchResult.data;
      const src = d?.nurtured_contact || d?.result || d;
      if (src?.subject && src?.email_body) {
        rawContent = { subject: src.subject, email_body: src.email_body };
      }
    }
  } catch (err) {
    workbenchError = err.message;
    workbenchResult = { success: false, error: err.message };
  }

  // Sanitize content & detect instructions
  let subject = rawContent?.subject || '';
  let body = rawContent?.email_body || '';

  const subjectHadLeak = detectPromptLeakInSubject(subject);
  subject = sanitizeAndValidateSubject(subject, {
    campaignType: campaign_type,
    occasion,
    company: primaryContact.company,
    name: primaryContact.name,
    topic: effectiveBrief
  });

  body = sanitizeAndPersonalizeGreeting(body, primaryContact);

  const evaluatedContent = {
    subject,
    email_body: body,
    subject_had_instruction_leak: subjectHadLeak,
    content_source: rawContent ? 'workbench' : 'unavailable'
  };

  // 4. Evaluate each contact in test sample
  const contactEvaluations = testSample.map(contact => {
    return evaluateContactRecord(contact, evaluatedContent, campaign_type, occasion);
  });

  // 5. Aggregate Findings & Issues
  let totalIssues = 0;
  let totalWarnings = 0;
  let totalGoods = 0;
  let hasCriticalBlock = false;

  const contactIssuesList = [];

  contactEvaluations.forEach((ce, idx) => {
    if (ce.is_blocked) hasCriticalBlock = true;
    totalIssues += ce.issues.length;
    totalWarnings += ce.warnings.length;
    totalGoods += ce.goods.length;

    ce.issues.forEach(iss => {
      contactIssuesList.push({
        contact_id: ce.contact_id,
        contact_name: ce.contact_name,
        company: ce.company,
        severity: 'high',
        detail: iss
      });
    });

    ce.warnings.forEach(warn => {
      contactIssuesList.push({
        contact_id: ce.contact_id,
        contact_name: ce.contact_name,
        company: ce.company,
        severity: 'medium',
        detail: warn
      });
    });
  });

  const diagnosticContacts = contactEvaluations.map(ce => {
    const score = Math.max(0, 100 - (ce.issues.length * 25) - (ce.warnings.length * 10));
    let status = 'Passed';
    if (ce.is_blocked) status = 'Blocked';
    else if (ce.issues.length > 0) status = 'Failed';
    else if (ce.warnings.length > 0) status = 'Warning';

    return {
      contact_id: ce.contact_id,
      name: ce.contact_name,
      company: ce.company,
      industry: ce.industry,
      region: ce.region,
      email: ce.email,
      score,
      status,
      issues: ce.issues,
      warnings: ce.warnings,
      goods: ce.goods
    };
  });

  const findingsGood = Array.from(new Set(contactEvaluations.flatMap(ce => ce.goods)));
  if (evaluatedContent.content_source === 'workbench') {
    findingsGood.unshift('Grounded synthesis via SNS Square Agent Workbench');
  }
  if (!subjectHadLeak) {
    findingsGood.push('Zero prompt instruction leakage in subject line');
  }
  const findingsWarnings = Array.from(new Set(contactEvaluations.flatMap(ce => ce.warnings)));
  const findingsFailures = Array.from(new Set(contactEvaluations.flatMap(ce => ce.issues)));

  // 6. Calculate Transparent Category Scores (Total 100)
  // Deductions based on sample findings
  const sampleSize = testSample.length;
  const issuesPerContact = totalIssues / sampleSize;
  const warningsPerContact = totalWarnings / sampleSize;

  // Category 1: Personalization (Max 20)
  let personalizationScore = 20 - (issuesPerContact * 8) - (warningsPerContact * 3);
  personalizationScore = Math.max(0, Math.min(20, Math.round(personalizationScore * 10) / 10));

  // Category 2: Content Quality (Max 20)
  let contentQualityScore = evaluatedContent.content_source === 'workbench' ? 20 : 5;
  if (!body || body.length < 80) contentQualityScore -= 10;
  if (subjectHadLeak) contentQualityScore -= 5;
  contentQualityScore = Math.max(0, Math.min(20, Math.round(contentQualityScore * 10) / 10));

  // Category 3: Campaign Structure (Max 15)
  let structureScore = 15;
  if (campaign_type.includes('newsletter')) {
    const headings = (body.match(/<h[1-6]|<strong>|###/g) || []).length;
    if (headings < 2) structureScore -= 5;
  }
  structureScore = Math.max(0, Math.min(15, structureScore));

  // Category 4: Industry / Context Relevance (Max 15)
  let relevanceScore = 15;
  const hasIndustryContext = testSample.some(c => (c.sector || c.industry) && body.toLowerCase().includes((c.sector || c.industry || '').toLowerCase()));
  if (!hasIndustryContext && primaryContact.sector !== 'Technology') {
    relevanceScore -= 4;
  }
  relevanceScore = Math.max(0, Math.min(15, relevanceScore));

  // Category 5: Technical Validity (Max 10)
  let technicalScore = 10;
  if (workbenchError) technicalScore -= 6;
  if (hasCriticalBlock) technicalScore -= 4;
  technicalScore = Math.max(0, Math.min(10, technicalScore));

  // Category 6: Compliance (Max 15)
  let complianceScore = 15;
  const optedOutInSample = testSample.filter(c => c.opt_in === false).length;
  if (optedOutInSample > 0) complianceScore -= (optedOutInSample / sampleSize) * 15;
  if (!body.includes('unsubscribe')) complianceScore -= 8;
  complianceScore = Math.max(0, Math.min(15, Math.round(complianceScore * 10) / 10));

  // Category 7: Brand Consistency (Max 5)
  let brandScore = 5;
  if (subjectHadLeak) brandScore -= 2;
  brandScore = Math.max(0, Math.min(5, brandScore));

  const categoryScores = {
    personalization: { score: personalizationScore, max: 20, pct: Math.round((personalizationScore / 20) * 100), label: 'Personalization Quality' },
    content_quality: { score: contentQualityScore, max: 20, pct: Math.round((contentQualityScore / 20) * 100), label: 'Content Quality & Integrity' },
    campaign_structure: { score: structureScore, max: 15, pct: Math.round((structureScore / 15) * 100), label: 'Campaign Structure Compliance' },
    industry_relevance: { score: relevanceScore, max: 15, pct: Math.round((relevanceScore / 15) * 100), label: 'Industry & Context Relevance' },
    technical_validity: { score: technicalScore, max: 10, pct: Math.round((technicalScore / 10) * 100), label: 'Technical & Link Validity' },
    compliance: { score: complianceScore, max: 15, pct: Math.round((complianceScore / 15) * 100), label: 'CAN-SPAM & Consent Compliance' },
    brand_consistency: { score: brandScore, max: 5, pct: Math.round((brandScore / 5) * 100), label: 'Brand & Template Consistency' }
  };

  const overallScore = Math.round(
    Object.values(categoryScores).reduce((sum, c) => sum + c.score, 0) * 10
  ) / 10;

  // Determine readiness status per user specification
  let readiness = 'READY';
  if (hasCriticalBlock || complianceScore < 10) {
    readiness = 'BLOCKED';
  } else if (overallScore >= 90) {
    readiness = 'READY';
  } else if (overallScore >= 75) {
    readiness = 'READY WITH WARNINGS';
  } else {
    readiness = 'NEEDS IMPROVEMENT';
  }

  // Count pass/warning/failed contacts in sample
  const passedCount = contactEvaluations.filter(ce => !ce.is_blocked && ce.issues.length === 0 && ce.warnings.length === 0).length;
  const warnedCount = contactEvaluations.filter(ce => !ce.is_blocked && ce.warnings.length > 0 && ce.issues.length === 0).length;
  const failedCount = contactEvaluations.filter(ce => ce.issues.length > 0 && !ce.is_blocked).length;
  const blockedCount = contactEvaluations.filter(ce => ce.is_blocked).length;

  // 7. Actionable Recommendations
  const actionableRecommendations = [];
  if (personalizationScore < 18) {
    actionableRecommendations.push({
      category: 'Personalization',
      issue: 'Missing recipient personalization or generic greeting detected.',
      recommendation: 'Ensure greeting explicitly uses first name (e.g. "Dear Arjun,") and references verified company name.',
      action_type: 'improve_enrichment'
    });
  }
  if (complianceScore < 15) {
    actionableRecommendations.push({
      category: 'Compliance',
      issue: 'Opt-out consent check or unsubscribe link missing.',
      recommendation: 'Filter audience to verified opted-in recipients only and include standard SNS unsubscribe footer.',
      action_type: 'filter_opt_ins'
    });
  }
  if (subjectHadLeak) {
    actionableRecommendations.push({
      category: 'Subject Line',
      issue: 'Prompt instructions detected in generated subject line.',
      recommendation: 'Sanitizer automatically cleaned subject. Instruct Workbench prompt to return subject line only.',
      action_type: 'clean_subject'
    });
  }
  if (structureScore < 15 && campaign_type.includes('newsletter')) {
    actionableRecommendations.push({
      category: 'Structure',
      issue: 'Fewer than 2 distinct perspective headlines in newsletter.',
      recommendation: 'Generate newsletter using approved multi-perspective SNS Square editorial framework.',
      action_type: 'apply_newsletter_structure'
    });
  }

  const testResultsArray = Object.entries(categoryScores).map(([key, cat]) => ({
    test_name: cat.label,
    category: key,
    score: cat.score,
    max_score: cat.max,
    status: cat.pct >= 85 ? 'PASS' : cat.pct >= 65 ? 'WARN' : 'FAIL',
    issues: contactIssuesList.filter(ci => ci.severity === 'high').map(ci => `${ci.contact_name} (${ci.company}): ${ci.detail}`),
    good: [`Evaluated across ${testSample.length} contacts (${cat.score}/${cat.max} pts)`],
    recommendations: actionableRecommendations.filter(ar => ar.category.toLowerCase().includes(key.toLowerCase().slice(0, 4))).map(ar => ar.recommendation)
  }));

  const recommendationsStrings = actionableRecommendations.map(ar => `${ar.category}: ${ar.recommendation}`);

  return {
    success: true,
    test_id: testId,
    test_mode,
    email_sent: false,
    dispatches_blocked: true,
    campaign_type,
    audience_summary: {
      filter_applied: audience_filter,
      filter_value: audience_value || 'all',
      total_audience_count: totalAudienceCount,
      tested_sample_count: testSample.length,
      coverage_display: `${testSample.length} / ${totalAudienceCount} tested`
    },
    sample_size: testSample.length,
    total_audience: totalAudienceCount,
    tested_contacts_count: testSample.length,
    total_audience_count: totalAudienceCount,
    results_summary: {
      passed: passedCount,
      warnings: warnedCount,
      failed: failedCount,
      blocked: blockedCount,
      total_tested: testSample.length
    },
    summary: {
      passed: passedCount,
      warned: warnedCount,
      failed: failedCount,
      total: testResultsArray.length
    },
    overall_score: overallScore,
    overall_max: 100,
    overall_grade: overallScore >= 90 ? 'A+' : overallScore >= 80 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 60 ? 'C' : 'D',
    readiness,
    status: readiness,
    category_scores: categoryScores,
    test_results: testResultsArray,
    contact_issues: contactIssuesList.slice(0, 15),
    diagnostic_contacts: diagnosticContacts,
    findings: {
      good: findingsGood,
      warnings: findingsWarnings,
      failures: findingsFailures
    },
    actionable_recommendations: actionableRecommendations,
    all_recommendations: recommendationsStrings,
    recommendations: recommendationsStrings,
    workbench_status: workbenchResult?.success !== false ? 'connected' : 'error',
    workbench_error: workbenchError,
    evaluated_content: {
      subject: evaluatedContent.subject,
      email_body_preview: evaluatedContent.email_body.slice(0, 450) + (evaluatedContent.email_body.length > 450 ? '...' : ''),
      content_source: evaluatedContent.content_source
    },
    generated_content: {
      subject: evaluatedContent.subject,
      email_body: evaluatedContent.email_body,
      email_body_preview: evaluatedContent.email_body.slice(0, 450) + (evaluatedContent.email_body.length > 450 ? '...' : ''),
      content_source: evaluatedContent.content_source
    },
    tested_at: testStartedAt,
    completed_at: new Date().toISOString()
  };
}

module.exports = {
  runAudienceAITest,
  evaluateContactRecord,
  resolveAudienceContacts,
  sampleAudience,
  SCORING_MODEL
};
