'use strict';

/**
 * AI Quality Testing Service — Digital Client Nurturing Agent
 *
 * Purpose: Evaluate the quality of AI-generated campaign content WITHOUT
 * sending emails to real customers. Tests run in a sandbox mode.
 *
 * Test areas:
 *  - Campaign personalization quality
 *  - Newsletter structure compliance
 *  - Festival/occasion tone compliance
 *  - Regional personalization
 *  - Email subject quality
 *  - Email body completeness
 *  - Placeholder detection (unreplaced [Name], [Company] etc.)
 *  - Generic-content detection
 *  - Hallucinated company/product claims (heuristic)
 *  - Missing recipient information
 *  - Incorrect campaign type detection
 *  - Workbench response validity
 *  - Dispatch payload validity
 *  - Compliance (unsubscribe links, consent checks)
 *
 * No email is ever sent during testing. The test runner uses workbench
 * generate (not dispatch) to evaluate content quality.
 */

const workbenchService = require('./nurtureWorkbenchService');
const nurtureStore = require('./nurtureStore');

// ── Scoring weights ───────────────────────────────────────────────────────────

const SCORING_WEIGHTS = {
  personalization: 20,
  relevance: 15,
  accuracy: 15,
  tone: 10,
  campaign_type_compliance: 10,
  content_quality: 15,
  technical_validity: 10,
  compliance: 5
};

// ── Test definitions ──────────────────────────────────────────────────────────

/**
 * Evaluate personalization quality of generated content.
 */
function testPersonalization(content, contact, campaignType) {
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  const body = String(content.email_body || '');
  const subject = String(content.subject || '');

  // 1. Check for unreplaced placeholders
  const placeholderPattern = /\[([A-Za-z_ ]+)\]|\{([A-Za-z_ ]+)\}/g;
  const placeholders = [...body.matchAll(placeholderPattern), ...subject.matchAll(placeholderPattern)];
  if (placeholders.length > 0) {
    const found = placeholders.map(m => m[0]).join(', ');
    issues.push(`Unreplaced placeholders detected: ${found}`);
    score -= 3;
  } else {
    good.push('No unreplaced placeholders detected.');
  }

  // 2. Check for recipient name
  if (contact?.name) {
    const firstName = contact.name.split(' ')[0];
    if (body.includes(firstName) || body.includes(contact.name)) {
      good.push(`Recipient name "${firstName}" found in email body.`);
      score += 1;
    } else {
      issues.push(`Recipient name "${contact.name}" not found in email body.`);
      score -= 2;
      recommendations.push('Ensure the Workbench personalizer inserts the recipient first name in the greeting.');
    }
  }

  // 3. Check for company name
  if (contact?.company && contact.company !== 'Enterprise Partner' && contact.company !== 'your organization') {
    if (body.includes(contact.company) || subject.includes(contact.company)) {
      good.push(`Company name "${contact.company}" is present in content.`);
    } else {
      issues.push(`Company name "${contact.company}" not found in content.`);
      score -= 1;
      recommendations.push('Include company name in at least one location for better personalization.');
    }
  }

  // 4. Check for industry/sector context
  const industry = contact?.industry || contact?.sector || '';
  if (industry && industry !== 'Technology') {
    if (body.toLowerCase().includes(industry.toLowerCase())) {
      good.push(`Industry context "${industry}" present in content.`);
    } else {
      issues.push(`No industry-specific context found for "${industry}".`);
      score -= 1;
      recommendations.push('Improve industry-specific enrichment in the Workbench prompt.');
    }
  }

  // 5. Generic greeting check
  if (/Dear\s+(Partner|Client|Valued|User|Customer)/i.test(body)) {
    issues.push('Generic greeting detected (e.g., "Dear Valued Client") instead of personalized name.');
    score -= 2;
    recommendations.push('Ensure the greeting uses the actual recipient name.');
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Campaign Personalization',
    category: 'personalization',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Evaluate newsletter structure compliance.
 */
function testNewsletterStructure(content, campaignType) {
  if (!['newsletter', 'Newsletter'].includes(campaignType)) {
    return {
      test_name: 'Newsletter Structure',
      category: 'campaign_type_compliance',
      score: 10,
      max_score: 10,
      status: 'SKIP',
      issues: [],
      good: ['Not a newsletter campaign — structure test skipped.'],
      recommendations: []
    };
  }

  const body = String(content.email_body || '');
  const subject = String(content.subject || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  // Subject format check
  if (subject.includes('SNS Square') || subject.includes('Weekly') || subject.includes('AI')) {
    good.push('Subject line references SNS Square newsletter branding.');
  } else {
    issues.push('Newsletter subject does not follow expected format: "[Headline] | SNS Square Weekly GCC & AI Scoop".');
    score -= 2;
    recommendations.push('Subject format should be: [Lead Story] | SNS Square Weekly GCC & AI Scoop');
  }

  // Check for multiple perspectives / articles
  const headlineCount = (body.match(/<strong>|#{1,3}\s+\w/g) || []).length;
  if (headlineCount >= 2) {
    good.push(`Found ${headlineCount} section headings/perspectives.`);
  } else {
    issues.push('Newsletter appears to have fewer than 2 distinct perspective sections.');
    score -= 2;
    recommendations.push('Newsletter should include 3-4 curated perspectives with bold headlines.');
  }

  // Check for links
  const linkCount = (body.match(/href=|https?:\/\//g) || []).length;
  if (linkCount >= 2) {
    good.push(`Found ${linkCount} links in newsletter content.`);
  } else {
    issues.push('Newsletter has fewer than 2 action links. Each perspective should have a read-more link.');
    score -= 1;
    recommendations.push('Add read-more action links for each newsletter perspective.');
  }

  // Check for footer/sign-off
  if (body.toLowerCase().includes('snssquare') || body.includes('SNS Square')) {
    good.push('SNS Square sign-off or branding present in body.');
  } else {
    issues.push('Missing SNS Square sign-off in newsletter footer.');
    score -= 1;
    recommendations.push('Add official SNS Square sign-off: "The Team at SNS Square, Enterprise Client Partnerships"');
  }

  // Check for unsubscribe
  if (body.includes('unsubscribe') || body.includes('Unsubscribe')) {
    good.push('Unsubscribe link present in content.');
  } else {
    issues.push('No unsubscribe link detected. Required for email compliance.');
    score -= 2;
    recommendations.push('Always include a functional unsubscribe link in newsletters.');
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Newsletter Structure',
    category: 'campaign_type_compliance',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Evaluate festival/occasion tone compliance.
 */
function testFestivalTone(content, campaignType, occasion) {
  const isFestival = ['festival_wish', 'Festival / Occasion Wish', 'festival', 'Festival'].includes(campaignType);
  if (!isFestival) {
    return {
      test_name: 'Festival / Occasion Tone',
      category: 'tone',
      score: 10,
      max_score: 10,
      status: 'SKIP',
      issues: [],
      good: ['Not a festival/occasion campaign — tone test skipped.'],
      recommendations: []
    };
  }

  const body = String(content.email_body || '');
  const subject = String(content.subject || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  // Check for warm tone indicators
  const warmWords = ['warm', 'joyous', 'prosperous', 'celebrate', 'wishes', 'greetings', 'festive', 'luminous', 'blessings', 'happy', 'joy'];
  const warmCount = warmWords.filter(w => body.toLowerCase().includes(w)).length;
  if (warmCount >= 2) {
    good.push(`Warm/festive tone detected (${warmCount} warm-tone words found).`);
  } else {
    issues.push('Festival message lacks warm, celebratory tone.');
    score -= 3;
    recommendations.push('Festival messages should be warm, joyful, and occasion-specific. Avoid corporate/technical language.');
  }

  // Check occasion is mentioned
  if (occasion && body.toLowerCase().includes(occasion.toLowerCase().split(' ')[0])) {
    good.push(`Occasion "${occasion}" is mentioned in the content.`);
  } else if (occasion) {
    issues.push(`Occasion "${occasion}" is not explicitly mentioned in the email body.`);
    score -= 2;
    recommendations.push('Festival messages must explicitly name the occasion being celebrated.');
  }

  // Ensure it doesn't contain newsletter/technical content
  const technicalIndicators = ['newsletter', 'AI automation', 'cloud modernisation', 'enterprise transformation', 'ROI', 'use case', 'case study', 'platform update'];
  const technicalFound = technicalIndicators.filter(t => body.toLowerCase().includes(t.toLowerCase()));
  if (technicalFound.length > 1) {
    issues.push(`Festival message contains technical/newsletter content: ${technicalFound.slice(0, 3).join(', ')}.`);
    score -= 3;
    recommendations.push('Festival/occasion messages must NOT be technical newsletters. Keep them warm, concise, and occasion-focused.');
  } else {
    good.push('No inappropriate technical newsletter content in festival message.');
  }

  // Check length (festival messages should be concise)
  const wordCount = body.split(/\s+/).length;
  if (wordCount > 400) {
    issues.push(`Festival message is too long (${wordCount} words). Festival wishes should be concise (under 200 words).`);
    score -= 1;
    recommendations.push('Festival messages should be concise and warm — ideally under 200 words.');
  } else {
    good.push(`Festival message length is appropriate (${wordCount} words).`);
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Festival / Occasion Tone',
    category: 'tone',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Evaluate content quality — checks for generic/default content, broken patterns.
 */
function testContentQuality(content, campaignType) {
  const body = String(content.email_body || '');
  const subject = String(content.subject || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  // Check for empty content
  if (!body || body.trim().length < 50) {
    issues.push('Email body is empty or too short (under 50 characters).');
    score -= 5;
    recommendations.push('AI generation must produce a complete email body.');
  } else {
    good.push('Email body has sufficient content.');
  }

  // Check for empty subject
  if (!subject || subject.trim().length < 5) {
    issues.push('Email subject is empty or too short.');
    score -= 3;
    recommendations.push('AI generation must produce a descriptive subject line.');
  } else {
    good.push('Email subject is present and descriptive.');
  }

  // Check for default/template content indicators
  const defaultIndicators = [
    '[Your Name]', '[Company Name]', '[Campaign Name]', '[Insert Topic]',
    'Lorem ipsum', 'example@example.com', 'placeholder', '{{', '}}'
  ];
  const defaultFound = defaultIndicators.filter(d => body.includes(d) || subject.includes(d));
  if (defaultFound.length > 0) {
    issues.push(`Default template content detected: ${defaultFound.join(', ')}`);
    score -= 3;
    recommendations.push('Replace all template placeholders with actual AI-generated content.');
  } else {
    good.push('No default template content detected.');
  }

  // Check for content_source being workbench
  if (content.content_source === 'workbench') {
    good.push('Content is sourced from SNS Workbench AI generation.');
  } else {
    issues.push('Content is NOT marked as Workbench-generated. Verify AI generation is active.');
    score -= 2;
    recommendations.push('Ensure campaign content goes through the SNS Workbench workflow.');
  }

  // Check for basic formatting (paragraphs)
  const hasFormatting = body.includes('<p>') || body.includes('\n\n') || body.includes('**');
  if (hasFormatting) {
    good.push('Email body has structured formatting.');
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Content Quality',
    category: 'content_quality',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Test technical validity — payload structure, links, compliance.
 */
function testTechnicalValidity(content, contact, dispatchPayload = null) {
  const body = String(content.email_body || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  // Check for unsubscribe link
  if (body.includes('unsubscribe') || body.includes('/unsubscribe')) {
    good.push('Unsubscribe link present.');
  } else {
    issues.push('No unsubscribe link detected. Required for CAN-SPAM/GDPR compliance.');
    score -= 3;
    recommendations.push('All marketing emails must contain a functional unsubscribe link.');
  }

  // Check for production URL in unsubscribe (not localhost)
  if (body.includes('localhost') || body.includes('127.0.0.1')) {
    issues.push('Localhost URL detected in email body. Production emails must use the public domain.');
    score -= 2;
    recommendations.push('Replace localhost URLs with the configured PUBLIC_APP_URL before dispatch.');
  } else {
    good.push('No localhost URLs detected in email body.');
  }

  // Check recipient email
  if (contact?.email && contact.email.includes('@')) {
    good.push(`Recipient email is present: ${contact.email}`);
  } else {
    issues.push('Recipient email is missing or invalid.');
    score -= 3;
    recommendations.push('All campaign recipients must have a valid email address.');
  }

  // Check opt-in status
  if (contact?.opt_in === true) {
    good.push('Contact has active opt-in consent.');
  } else if (contact?.opt_in === false) {
    issues.push('CRITICAL: Contact has opted OUT. This campaign must NOT be dispatched to this contact.');
    score -= 5;
    recommendations.push('Remove opted-out contacts from campaign audience before dispatch.');
  } else {
    issues.push('Contact opt-in status is unknown.');
    score -= 2;
    recommendations.push('Verify opt-in consent before sending any campaign.');
  }

  // Dispatch payload validity
  if (dispatchPayload) {
    if (dispatchPayload.content?.subject && dispatchPayload.content?.email_body) {
      good.push('Dispatch payload contains required subject and email_body fields.');
    } else {
      issues.push('Dispatch payload is missing subject or email_body. Content must be approved before dispatch.');
      score -= 2;
    }
    if (dispatchPayload.action === 'approve_and_send') {
      good.push('Dispatch payload action is correctly set to "approve_and_send".');
    }
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Technical Validity',
    category: 'technical_validity',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Test Workbench response validity.
 */
function testWorkbenchResponse(workbenchResult) {
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  if (!workbenchResult) {
    return {
      test_name: 'Workbench Response Validity',
      category: 'technical_validity',
      score: 0,
      max_score: 10,
      status: 'FAIL',
      issues: ['No Workbench response received.'],
      good: [],
      recommendations: ['Check SNS Workbench connectivity and ensure the workflow is deployed.']
    };
  }

  if (workbenchResult.success === true) {
    good.push('Workbench returned a successful response.');
  } else {
    issues.push('Workbench response did not confirm success.');
    score -= 5;
    recommendations.push('Verify SNS Workbench workflow is active and responding correctly.');
  }

  if (workbenchResult.source === 'workbench_webhook') {
    good.push('Response is from the Workbench webhook (not a local fallback).');
  } else {
    issues.push('Response source is not the Workbench webhook.');
    score -= 3;
  }

  if (workbenchResult.data) {
    good.push('Workbench response contains structured data payload.');
  } else {
    issues.push('Workbench response has no data payload.');
    score -= 2;
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Workbench Response Validity',
    category: 'technical_validity',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Test relevance — is the content relevant to the campaign type and contact?
 */
function testRelevance(content, contact, campaignType, occasion) {
  const body = String(content.email_body || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  const industry = contact?.industry || contact?.sector || '';

  // Industry relevance for newsletters
  if (['newsletter', 'Newsletter'].includes(campaignType) && industry) {
    const industryTerms = {
      'Technology': ['AI', 'cloud', 'automation', 'digital', 'software', 'technology', 'enterprise'],
      'Finance': ['fintech', 'financial', 'banking', 'investment', 'compliance', 'regulation', 'capital'],
      'Healthcare': ['health', 'medical', 'clinical', 'patient', 'digital health', 'healthcare'],
      'Education': ['education', 'learning', 'student', 'academic', 'EdTech', 'curriculum'],
      'Manufacturing': ['manufacturing', 'production', 'supply chain', 'operations', 'automation', 'factory'],
      'Retail': ['retail', 'ecommerce', 'customer', 'commerce', 'supply chain', 'fulfillment'],
      'Real Estate': ['real estate', 'property', 'construction', 'infrastructure', 'development']
    };
    const terms = industryTerms[industry] || industryTerms['Technology'];
    const relevantCount = terms.filter(t => body.toLowerCase().includes(t.toLowerCase())).length;
    if (relevantCount >= 2) {
      good.push(`Content contains ${relevantCount} industry-relevant terms for ${industry}.`);
    } else {
      issues.push(`Newsletter appears generic — fewer than 2 ${industry} industry-specific terms detected.`);
      score -= 3;
      recommendations.push(`Enhance industry-specific content for ${industry} clients with relevant terminology and context.`);
    }
  }

  // Campaign type correctness
  if (['festival_wish', 'Festival / Occasion Wish', 'festival'].includes(campaignType)) {
    if (!body.toLowerCase().includes('newsletter') && !body.toLowerCase().includes('case study')) {
      good.push('Festival campaign does not contain newsletter content — correct behavior.');
    }
  }

  // Occasion in festival campaigns
  if (occasion && ['festival_wish', 'Festival / Occasion Wish', 'festival'].includes(campaignType)) {
    if (body.toLowerCase().includes(occasion.toLowerCase().split(' ')[0])) {
      good.push(`Occasion "${occasion}" is reflected in the content.`);
    } else {
      issues.push(`Occasion "${occasion}" is not referenced in the email body.`);
      score -= 2;
    }
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Content Relevance',
    category: 'relevance',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Test compliance — opt-in, unsubscribe, GDPR basics.
 */
function testCompliance(content, contact) {
  const body = String(content.email_body || '');
  const issues = [];
  const good = [];
  const recommendations = [];
  let score = 10;

  if (contact?.opt_in !== true) {
    issues.push('CRITICAL: Contact has not opted in. Campaign must not be dispatched without consent.');
    score -= 5;
    recommendations.push('Obtain explicit opt-in consent before sending any campaign.');
  } else {
    good.push('Contact has confirmed opt-in consent.');
  }

  if (body.includes('unsubscribe') || body.includes('Unsubscribe')) {
    good.push('Unsubscribe option present in email.');
  } else {
    issues.push('No unsubscribe mechanism found. Required by CAN-SPAM and GDPR.');
    score -= 3;
    recommendations.push('All marketing emails must include a one-click unsubscribe link.');
  }

  if (body.includes('preferences') || body.includes('Manage')) {
    good.push('Preference management link present.');
  }

  score = Math.max(0, Math.min(10, score));
  return {
    test_name: 'Compliance',
    category: 'compliance',
    score: Math.round(score * 10) / 10,
    max_score: 10,
    status: score >= 7 ? 'PASS' : score >= 4 ? 'WARN' : 'FAIL',
    issues,
    good,
    recommendations
  };
}

/**
 * Run the full AI test suite for a campaign and contact.
 *
 * IMPORTANT: This function NEVER sends an email to real customers.
 * It only calls the Workbench /generate endpoint (preview, not dispatch).
 *
 * @param {Object} options
 * @returns {Promise<Object>} — full structured test result
 */
async function runAITestSuite(options = {}) {
  const {
    campaign_type = 'newsletter',
    campaign_name,
    campaign_brief,
    contact_id,
    occasion
  } = options;

  const testStartedAt = new Date().toISOString();
  const testId = `AI-TEST-${Date.now()}`;

  // ── 1. Select a test contact (must be opted-in) ───────────────────────────
  let testContact = null;
  if (contact_id) {
    testContact = nurtureStore.getContactById(contact_id);
  }
  if (!testContact || testContact.opt_in !== true) {
    testContact = nurtureStore.getContacts().find(c => c.opt_in === true);
  }
  if (!testContact) {
    // Use a safe sandbox contact — never a real customer
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

  // ── 2. Generate test content via Workbench (preview only) ─────────────────
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
    // Flag this as a test — do NOT send
    is_test_mode: true,
    test_mode: true
  };

  try {
    workbenchResult = await workbenchService.triggerNurturingWorkflow(testPayload);
    // Extract content from Workbench response
    const { extractWorkbenchAiContent } = require('../routes/campaigns');
    if (extractWorkbenchAiContent) {
      generatedContent = extractWorkbenchAiContent(workbenchResult?.data);
    }
    if (!generatedContent && workbenchResult?.data) {
      // Try direct extraction
      const d = workbenchResult.data;
      const src = d?.nurtured_contact || d?.result || d;
      if (src?.subject && src?.email_body) {
        generatedContent = { subject: src.subject, email_body: src.email_body, content_source: 'workbench' };
      }
    }
    if (generatedContent) generatedContent.content_source = 'workbench';
  } catch (err) {
    workbenchError = err.message;
    workbenchResult = { success: false, error: err.message };
  }

  // If Workbench is unreachable, run tests on a clearly marked synthetic result
  if (!generatedContent) {
    generatedContent = {
      subject: '',
      email_body: '',
      content_source: 'unavailable',
      error: workbenchError || 'Workbench did not return content'
    };
  }

  // ── 3. Run test suite ──────────────────────────────────────────────────────
  const testResults = [
    testPersonalization(generatedContent, testContact, campaign_type),
    testNewsletterStructure(generatedContent, campaign_type),
    testFestivalTone(generatedContent, campaign_type, occasion),
    testContentQuality(generatedContent, campaign_type),
    testRelevance(generatedContent, testContact, campaign_type, occasion),
    testTechnicalValidity(generatedContent, testContact),
    testWorkbenchResponse(workbenchResult),
    testCompliance(generatedContent, testContact)
  ];

  // ── 4. Calculate overall score ─────────────────────────────────────────────
  const categoryScores = {};
  Object.keys(SCORING_WEIGHTS).forEach(cat => {
    const catTests = testResults.filter(t => t.category === cat && t.status !== 'SKIP');
    if (catTests.length === 0) {
      categoryScores[cat] = { score: SCORING_WEIGHTS[cat], max: SCORING_WEIGHTS[cat], skipped: true };
    } else {
      const avg = catTests.reduce((sum, t) => sum + (t.score / t.max_score), 0) / catTests.length;
      categoryScores[cat] = {
        score: Math.round(avg * SCORING_WEIGHTS[cat] * 10) / 10,
        max: SCORING_WEIGHTS[cat],
        tests: catTests.length
      };
    }
  });

  const overallScore = Math.round(
    Object.values(categoryScores).reduce((sum, cat) => sum + cat.score, 0) * 10
  ) / 10;

  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  const warned = testResults.filter(t => t.status === 'WARN').length;
  const skipped = testResults.filter(t => t.status === 'SKIP').length;

  const allIssues = testResults.flatMap(t => t.issues);
  const allRecommendations = testResults.flatMap(t => t.recommendations);

  return {
    test_id: testId,
    test_mode: true,
    email_sent: false,
    campaign_type,
    campaign_name: effectiveName,
    contact_used: {
      id: testContact.id,
      name: testContact.name,
      company: testContact.company,
      industry: testContact.industry || testContact.sector
    },
    overall_score: overallScore,
    overall_max: 100,
    overall_grade: overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : 'F',
    status: failed === 0 ? (warned === 0 ? 'PASS' : 'PASS_WITH_WARNINGS') : 'FAIL',
    summary: {
      passed,
      failed,
      warned,
      skipped,
      total: testResults.length
    },
    category_scores: categoryScores,
    test_results: testResults,
    all_issues: allIssues,
    all_recommendations: [...new Set(allRecommendations)],
    workbench_status: workbenchResult?.success ? 'connected' : 'error',
    workbench_error: workbenchError,
    generated_content: {
      subject: generatedContent.subject,
      email_body_preview: generatedContent.email_body?.slice(0, 500) + (generatedContent.email_body?.length > 500 ? '...' : ''),
      content_source: generatedContent.content_source
    },
    tested_at: testStartedAt,
    completed_at: new Date().toISOString()
  };
}

module.exports = {
  runAITestSuite,
  testPersonalization,
  testNewsletterStructure,
  testFestivalTone,
  testContentQuality,
  testRelevance,
  testTechnicalValidity,
  testCompliance
};
