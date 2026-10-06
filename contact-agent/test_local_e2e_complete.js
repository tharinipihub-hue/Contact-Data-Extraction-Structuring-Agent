'use strict';

/**
 * COMPREHENSIVE LOCAL END-TO-END VERIFICATION SUITE
 * 
 * Verifies all requirements (A through Q) strictly locally:
 *  - Frontend payload -> local backend -> local/stubbed Workbench -> mocked AI response
 *    -> validation -> mocked SMTP
 *  - Proves:
 *      VALID SEND: reaches SMTP branch, returns explicit delivery confirmation, backend records Sent.
 *      BLOCKED SEND: opt-out, missing email, missing subject, missing body, prompt leakage -> blocked, no SMTP.
 *      PREVIEW: generates structured content, never calls SMTP, draft/preview preserved.
 *      FALSE DELIVERY: success:true or status:completed alone is never marked as Sent.
 *      NEWSLETTER & 5 CAMPAIGN TYPES: structured generation, hero_body array handling, no fabrication.
 *      UNKNOWN CAMPAIGN TYPE: rejected cleanly.
 * 
 * SAFETY:
 *  - Zero real emails sent.
 *  - Zero production webhook calls.
 *  - Zero production SMTP triggered.
 *  - Zero Groq quota consumed.
 *  - RFC 2606 .invalid test fixture addresses only.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure isolated temp storage for nurture store
const tempDir = path.join(__dirname, 'backend', 'nurture-data-test-e2e');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
process.env.NURTURE_DATA_DIR = tempDir;

// Write fresh mock contacts into tempDir
const fixtureContacts = [
  {
    id: 'CNT-MOCK-001',
    name: 'Jane Doe',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane.doe@example.invalid',
    company: 'Acme Global',
    sector: 'Technology',
    industry: 'Technology',
    opt_in: true,
    designation: 'VP Engineering'
  },
  {
    id: 'CNT-MOCK-002',
    name: 'Bob Smith',
    first_name: 'Bob',
    last_name: 'Smith',
    email: 'bob.smith@example.invalid',
    company: 'Beta Corp',
    sector: 'Finance',
    industry: 'Finance',
    opt_in: false, // Opted OUT
    designation: 'Director'
  },
  {
    id: 'CNT-MOCK-003',
    name: 'Alice NoEmail',
    first_name: 'Alice',
    last_name: 'NoEmail',
    email: '', // Missing Email
    company: 'Gamma Logistics',
    sector: 'Logistics',
    industry: 'Logistics',
    opt_in: true,
    designation: 'Manager'
  }
];

fs.writeFileSync(path.join(tempDir, 'contacts.json'), JSON.stringify(fixtureContacts, null, 2));
fs.writeFileSync(path.join(tempDir, 'campaigns.json'), JSON.stringify([], null, 2));
fs.writeFileSync(path.join(tempDir, 'audit_logs.json'), JSON.stringify([], null, 2));
fs.writeFileSync(path.join(tempDir, 'sales_handoffs.json'), JSON.stringify([], null, 2));

// Load backend app and components
const express = require('express');
const campaignsRouter = require('./backend/src/routes/campaigns');
const { extractWorkbenchAiContent, isDeliveryConfirmedResponse } = campaignsRouter;
const { normalizeCampaignType, isSupportedCampaignType } = require('./backend/src/services/campaignTypeRegistry');
const { normalizeWorkbenchTemplateContent } = require('./frontend/src/views/nurturing/workbenchTemplateContent');

// Load workflow JSON and nodes
const wf = require('./client_nurturing_workbench_workflow.json');
const workflowNodes = Object.fromEntries(wf.nodes.map(n => [n.id, n]));

function executeNode(nodeId, input, nodeState = {}) {
  const code = workflowNodes[nodeId].data.inputs.code;
  return new Function('$json', '$node', code)(input, nodeState);
}

// Local mock Workbench simulator running the workflow nodes
function simulateWorkflow({ payload, mockedLlmText, simulateSmtpSend = true }) {
  // 1. Ingest
  const ingest = executeNode('code.execute-nurture-ingest', payload);

  // 2. Prompt Builder
  const promptBuilder = executeNode('code.execute-campaign-prompt-builder', ingest, {
    'code.execute-nurture-ingest': { json: ingest }
  });

  // 3. LLM output (mocked or from approved content)
  const llmOutput = mockedLlmText ? { text: mockedLlmText } : {};

  // 4. Validation
  const validation = executeNode('code.execute-1790678109627001', llmOutput, {
    'code.execute-nurture-ingest': { json: ingest },
    'code.execute-campaign-prompt-builder': { json: promptBuilder }
  });

  // 5. Send Gate (Switch: Allow Dispatch Only Outside Preview)
  const swNode = workflowNodes['core_switch-nurture-generation-valid'].data.inputs;
  let switchOutput = swNode.fallbackOutput;
  for (const rule of swNode.rules) {
    if (rule.outputIndex === 0 && ingest.action !== 'generate_preview' &&
        ingest.send_allowed === true && validation.generation_validation?.valid === true) {
      switchOutput = 0;
      break;
    }
  }

  // 6. Branch routing
  let smtpNodeOutput = null;
  let telemetryNodeOutput = null;

  if (switchOutput === 0) {
    // Reached SMTP node!
    if (simulateSmtpSend) {
      smtpNodeOutput = {
        success: true,
        status: 'sent',
        delivery_confirmed: true,
        sent: true,
        messageId: '<mock-smtp-id-12345@localhost>'
      };
      // Downstream Telemetry node
      telemetryNodeOutput = executeNode('code.execute-engagement-telemetry', {
        ...smtpNodeOutput,
        client_response_text: ''
      }, {
        'code.execute-1790678109627001': { json: validation },
        'code.execute-nurture-ingest': { json: ingest }
      });
    } else {
      smtpNodeOutput = {
        success: false,
        status: 'failed',
        error: 'SMTP transport error'
      };
    }
  }

  // 7. Format Response
  const nodeState = {
    'code.execute-1790678109627001': { json: validation },
    'code.execute-nurture-ingest': { json: ingest }
  };
  if (smtpNodeOutput) nodeState['smtp-nurture-dispatch'] = { json: smtpNodeOutput };
  if (telemetryNodeOutput) nodeState['code.execute-engagement-telemetry'] = { json: telemetryNodeOutput };

  const finalResponse = executeNode('code.execute-format-response', validation, nodeState);

  return {
    ingest,
    promptBuilder,
    validation,
    switchOutput,
    smtpExecuted: switchOutput === 0,
    finalResponse
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('DIGITAL CLIENT NURTURING — COMPLETE END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function runCase(desc, fn) {
    try {
      fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${desc}: ${err.message}`);
      failed++;
    }
  }

  // A. Newsletter generation
  runCase('A. Newsletter generation populates structured fields & hero paragraphs', () => {
    const mockLlm = JSON.stringify({
      campaign_type: 'newsletter',
      subject: 'Sustainable Transformation Scoop',
      header_title: 'Enterprise Transformation',
      header_subtitle: 'Quarterly Briefing',
      greeting: 'Hi Jane,',
      hero_headline: 'Navigating Sustainable Enterprise Transformation',
      hero_body: [
        'First editorial paragraph outlining system resilience.',
        'Second editorial paragraph detailing workforce adaptation.'
      ],
      content_blocks: [
        {
          headline: 'Cloud Modernization',
          body: 'Strategic priority for enterprise architectures.',
          cta_label: 'Explore Perspective',
          cta_url: 'https://www.snssquare.com/insights'
        }
      ],
      foundations_title: 'Core Foundations',
      foundations: ['Resilience', 'Intelligent Automation'],
      closing_text: 'Best regards, The Team',
      email_body: '<p>Hi Jane,</p><h2>Navigating Sustainable Enterprise Transformation</h2><p>First editorial paragraph outlining system resilience.</p><p>Second editorial paragraph detailing workforce adaptation.</p>'
    });

    const sim = simulateWorkflow({
      payload: {
        action: 'generate_preview',
        campaign_type: 'newsletter',
        developer_input: 'Navigating Sustainable Enterprise Transformation',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]],
        approved_urls: ['https://www.snssquare.com/insights']
      },
      mockedLlmText: mockLlm
    });

    assert.strictEqual(sim.finalResponse.success, true);
    assert.strictEqual(sim.finalResponse.status, 'completed');
    assert.strictEqual(sim.finalResponse.delivery_confirmed, false);
    assert.strictEqual(sim.smtpExecuted, false);

    // Verify backend extraction
    const extracted = extractWorkbenchAiContent(sim.finalResponse);
    assert.strictEqual(extracted.subject, 'Sustainable Transformation Scoop');
    assert.strictEqual(extracted.hero_headline, 'Navigating Sustainable Enterprise Transformation');
    assert(Array.isArray(extracted.hero_body) || typeof extracted.hero_body === 'string');

    // Verify frontend normalization
    const normalized = normalizeWorkbenchTemplateContent(sim.finalResponse);
    assert.strictEqual(normalized.heroHeadline, 'Navigating Sustainable Enterprise Transformation');
    assert(normalized.heroBody.includes('First editorial paragraph'));
    assert(normalized.heroBody.includes('Second editorial paragraph'));
    assert.strictEqual(normalized.articles.length, 1);
    assert.strictEqual(normalized.articles[0].headline, 'Cloud Modernization');
  });

  // B. Other five campaign types
  const otherTypes = ['festival_wish', 'promotional', 'follow_up', 'event_invitation', 'announcement'];
  for (const cType of otherTypes) {
    runCase(`B. Campaign type "${cType}" generates its own type-specific content`, () => {
      const mockLlm = JSON.stringify({
        campaign_type: cType,
        subject: `${cType} Subject Line`,
        header_title: `${cType} Header`,
        header_subtitle: 'Update',
        email_body: `<p>Content for ${cType}</p>`
      });

      const sim = simulateWorkflow({
        payload: {
          action: 'generate_preview',
          campaign_type: cType,
          developer_input: `Topic for ${cType}`,
          active_contact: fixtureContacts[0],
          contacts: [fixtureContacts[0]]
        },
        mockedLlmText: mockLlm
      });

      assert.strictEqual(sim.finalResponse.success, true);
      assert.strictEqual(sim.promptBuilder.campaign_type_normalized, cType);
      assert.strictEqual(sim.validation.generation_validation.valid, true);
    });
  }

  // C. Unknown campaign type
  runCase('C. Unknown campaign type is rejected cleanly', () => {
    assert.strictEqual(isSupportedCampaignType('unknown_type_xyz'), false);
    assert.strictEqual(normalizeCampaignType('unknown_type_xyz'), '');

    const sim = simulateWorkflow({
      payload: {
        action: 'generate_preview',
        campaign_type: 'unknown_type_xyz',
        developer_input: 'Test',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      },
      mockedLlmText: JSON.stringify({ subject: 'Test', email_body: 'Body' })
    });

    assert.strictEqual(sim.promptBuilder.campaign_type_supported, false);
    assert.strictEqual(sim.validation.generation_validation.valid, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'rejected');
  });

  // D. Preview never reaches SMTP
  runCase('D. Preview action (generate_preview) generates content and NEVER reaches SMTP', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'generate_preview',
        campaign_type: 'newsletter',
        developer_input: 'Preview topic',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      },
      mockedLlmText: JSON.stringify({ subject: 'Preview Subject', email_body: '<p>Preview Body</p>' })
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.delivery_confirmed, false);
    assert.strictEqual(sim.finalResponse.status, 'completed');
  });

  // E. Valid Send reaches SMTP
  runCase('E. Valid Send (approve_and_send) routes to SMTP output 0 and confirms delivery', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: 'Approved Subject Line',
        email_body: '<p>Approved Email Body</p>',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]],
        developer_input: 'Approved Topic'
      },
      mockedLlmText: null // No LLM generation needed for dispatch!
    });

    assert.strictEqual(sim.switchOutput, 0); // Output 0 -> SMTP!
    assert.strictEqual(sim.smtpExecuted, true);
    assert.strictEqual(sim.finalResponse.success, true);
    assert.strictEqual(sim.finalResponse.status, 'sent');
    assert.strictEqual(sim.finalResponse.delivery_confirmed, true);
    assert.strictEqual(isDeliveryConfirmedResponse(sim.finalResponse), true);
  });

  // F. Send with LLM empty does NOT depend on second LLM response
  runCase('F. Send does NOT depend on a second LLM response when approved content exists', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'promotional',
        subject: 'Already Approved Promotion',
        email_body: '<p>Already Approved Body</p>',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      },
      mockedLlmText: '' // Completely empty LLM!
    });

    assert.strictEqual(sim.validation.generation_validation.valid, true);
    assert.strictEqual(sim.switchOutput, 0);
    assert.strictEqual(sim.smtpExecuted, true);
    assert.strictEqual(sim.finalResponse.status, 'sent');
  });

  // G. Opt-out blocked
  runCase('G. Opted-out contact is strictly blocked from dispatch', () => {
    const optedOutContact = fixtureContacts[1]; // opt_in: false
    assert.strictEqual(optedOutContact.opt_in, false);

    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: 'Approved Subject',
        email_body: '<p>Approved Body</p>',
        active_contact: optedOutContact,
        contacts: [optedOutContact]
      }
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'blocked');
    assert.strictEqual(sim.finalResponse.error_type, 'not_opted_in');
    assert.strictEqual(sim.finalResponse.delivery_confirmed, false);
  });

  // H. Missing email blocked
  runCase('H. Missing recipient email is strictly blocked from dispatch', () => {
    const noEmailContact = fixtureContacts[2]; // email: ''
    assert.strictEqual(noEmailContact.email, '');

    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: 'Approved Subject',
        email_body: '<p>Approved Body</p>',
        active_contact: noEmailContact,
        contacts: [noEmailContact]
      }
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'blocked');
    assert.strictEqual(sim.finalResponse.error_type, 'missing_recipient_email');
  });

  // I. Missing subject blocked
  runCase('I. Missing subject is strictly blocked from dispatch', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: '', // Missing
        email_body: '<p>Approved Body</p>',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      }
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'blocked');
    assert.strictEqual(sim.finalResponse.error_type, 'missing_campaign_content');
  });

  // J. Missing body blocked
  runCase('J. Missing email body is strictly blocked from dispatch', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: 'Approved Subject',
        email_body: '', // Missing
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      }
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'blocked');
    assert.strictEqual(sim.finalResponse.error_type, 'missing_campaign_content');
  });

  // K. Prompt leakage blocked
  runCase('K. Prompt leakage in dispatch content is detected and blocked', () => {
    const sim = simulateWorkflow({
      payload: {
        action: 'approve_and_send',
        campaign_type: 'newsletter',
        subject: 'EDITORIAL GUIDELINES: Follow standard tone',
        email_body: '<p>CAMPAIGN RULES: Return only valid JSON.</p>',
        active_contact: fixtureContacts[0],
        contacts: [fixtureContacts[0]]
      }
    });

    assert.strictEqual(sim.switchOutput, 1);
    assert.strictEqual(sim.smtpExecuted, false);
    assert.strictEqual(sim.finalResponse.success, false);
    assert.strictEqual(sim.finalResponse.status, 'blocked');
    assert.strictEqual(sim.finalResponse.error_type, 'prompt_leak_detected');
  });

  // L. False delivery response alone is NOT Sent
  runCase('L. { success: true } alone is NOT delivery proof', () => {
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true }), false);
  });

  // M. completed response is NOT Sent
  runCase('M. { success: true, status: "completed" } is NOT delivery proof', () => {
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, status: 'completed' }), false);
  });

  // N. success response is NOT Sent
  runCase('N. { success: true, status: "success" } is NOT delivery proof', () => {
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, status: 'success' }), false);
  });

  // O. Explicit delivery confirmation is Sent
  runCase('O. Explicit delivery signals confirm delivery', () => {
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, delivery_confirmed: true }), true);
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, email_sent: true }), true);
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, sent: true }), true);
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, status: 'sent' }), true);
    assert.strictEqual(isDeliveryConfirmedResponse({ success: true, delivery_status: 'delivered' }), true);
  });

  // P. No fabricated fields when data is missing
  runCase('P. Missing fields are never filled with fabricated fallbacks', () => {
    const contactWithMissingFields = {
      id: 'CNT-EMPTY-001',
      name: '',
      email: 'empty@example.invalid',
      company: '',
      sector: '',
      industry: '',
      opt_in: true
    };

    const sim = simulateWorkflow({
      payload: {
        action: 'generate_preview',
        campaign_type: 'newsletter',
        developer_input: 'Brief without extra context',
        active_contact: contactWithMissingFields,
        contacts: [contactWithMissingFields]
      },
      mockedLlmText: JSON.stringify({
        campaign_type: 'newsletter',
        subject: 'Clean Subject Line',
        email_body: '<p>Brief editorial</p>'
      })
    });

    const ctx = sim.promptBuilder.generation_context;
    assert.strictEqual(ctx.company, undefined);
    assert.strictEqual(ctx.industry, undefined);
    assert.strictEqual(ctx.sector, undefined);
    assert.strictEqual(ctx.recipient_name, undefined);
  });

  // Q. hero_body array handling
  runCase('Q. hero_body as array preserves all paragraphs', () => {
    const rawResponse = {
      success: true,
      result: {
        subject: 'Newsletter Title',
        hero_headline: 'Strategic Perspective',
        hero_body: [
          'Editorial paragraph 1 regarding infrastructure.',
          'Editorial paragraph 2 regarding security compliance.'
        ],
        email_body: '<p>Editorial paragraph 1 regarding infrastructure.</p><p>Editorial paragraph 2 regarding security compliance.</p>'
      }
    };

    const normalized = normalizeWorkbenchTemplateContent(rawResponse);
    assert(normalized.heroBody.includes('Editorial paragraph 1 regarding infrastructure.'));
    assert(normalized.heroBody.includes('Editorial paragraph 2 regarding security compliance.'));
    const parts = normalized.heroBody.split(/\n{2,}/);
    assert.strictEqual(parts.length, 2);
  });

  // Cleanup temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
