'use strict';

/**
 * Digital Client Nurturing — Campaign Type, Prompt Builder, Validation and
 * Dispatch-Guard verification suite.
 *
 * SAFETY GUARANTEES
 *  - Executes the REAL code nodes from client_nurturing_workbench_workflow.json
 *    locally via `new Function`. No network access of any kind.
 *  - Does NOT call the production SNS Workbench webhook.
 *  - Does NOT call any SMTP node or mail transport. SMTP expressions are
 *    inspected statically; the node is never executed.
 *  - Does NOT consume Groq quota. All LLM output is a local mock.
 *  - Does NOT modify real contacts (store test uses a temp data dir).
 *  - No real contact, company, email, statistic, URL or reply is used as data.
 *    Every string below is an explicit, clearly-labelled TEST FIXTURE.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Fixtures (test-only, never production data) ─────────────────────────────

// TEST FIXTURE contact. Not a real person or company.
const FIXTURE_CONTACT = Object.freeze({
  id: 'CNT-FIXTURE-001',
  name: 'Fixture Recipient',
  company: 'Fixture Company Ltd',
  designation: 'Fixture Role',
  email: 'fixture-recipient@example.invalid', // .invalid is reserved by RFC 2606
  sector: 'Fixture Sector',
  opt_in: true
});

const WORKFLOW_PATH = path.resolve(__dirname, 'client_nurturing_workbench_workflow.json');
const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
const nodes = Object.fromEntries(workflow.nodes.map(n => [n.id, n]));

function runCodeNode(id, input, nodeResults = {}) {
  const code = nodes[id].data.inputs.code;
  return new Function('$json', '$node', code)(input, nodeResults);
}

/** ingest -> prompt builder -> validation -> response, with a mocked LLM. */
function runGeneration({ payload, llmOutput }) {
  const ingest = runCodeNode('code.execute-nurture-ingest', { body: payload });

  const promptBuilder = runCodeNode('code.execute-campaign-prompt-builder', ingest, {
    'code.execute-nurture-ingest': { json: ingest }
  });

  const validation = runCodeNode('code.execute-1790678109627001', llmOutput, {
    'code.execute-nurture-ingest': { json: ingest },
    'code.execute-campaign-prompt-builder': { json: promptBuilder }
  });

  const response = runCodeNode('code.execute-format-response', validation, {
    'code.execute-1790678109627001': { json: validation },
    'code.execute-nurture-ingest': { json: ingest }
  });

  return { ingest, promptBuilder, validation, response };
}

/** Emulate the "Allow Dispatch Only Outside Preview" switch. */
function routeThroughGenerationSwitch(validation, ingest) {
  const node = nodes['core_switch-nurture-generation-valid'].data.inputs;
  let outputIndex = node.fallbackOutput;
  for (const rule of node.rules) {
    if (rule.outputIndex === 0 && ingest.action !== 'generate_preview' &&
        ingest.send_allowed === true && validation.generation_validation?.valid === true) {
      outputIndex = 0;
      break;
    }
  }
  return outputIndex;
}

function smtpTargetFor(handle) {
  return workflow.edges
    .filter(e => e.source === 'core_switch-nurture-generation-valid' && e.sourceHandle === handle)
    .map(e => e.target);
}

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}

function basePayload(overrides = {}) {
  return {
    action: 'generate_preview',
    request_type: 'generate_preview',
    campaign_name: 'Fixture Campaign',
    campaign_type: 'newsletter',
    developer_input: 'TEST FIXTURE BRIEF. This is not real campaign copy.',
    campaign_brief: 'TEST FIXTURE BRIEF. This is not real campaign copy.',
    sector: 'Fixture Sector',
    target_segment: 'Fixture Segment',
    channel: 'email',
    from_email: 'sender@example.invalid',
    sender_email: 'sender@example.invalid',
    contacts: [FIXTURE_CONTACT],
    active_contact: FIXTURE_CONTACT,
    approved_urls: [],
    ...overrides
  };
}

/** TEST FIXTURE successful LLM JSON output. Not generated content.
 *  Shape matches the real Groq node output the validation node reads (`.text`). */
function fixtureLlmOutput(overrides = {}) {
  return {
    text: JSON.stringify({
      campaign_type: 'newsletter',
      subject: 'Fixture Subject Line',
      header_title: 'Fixture Header',
      header_subtitle: 'Fixture Subtitle',
      greeting: 'Hello,',
      hero_headline: 'Fixture Hero Headline',
      hero_body: ['Fixture hero body paragraph.'],
      content_blocks: [],
      foundations_title: '',
      foundations: [],
      closing_text: 'Fixture closing.',
      promo_banner: '',
      email_body: '<p>Fixture generated body used only by this test suite.</p>',
      ...overrides
    })
  };
}

console.log('='.repeat(78));
console.log('DIGITAL CLIENT NURTURING — CAMPAIGN TYPE, VALIDATION & DISPATCH GUARD SUITE');
console.log('='.repeat(78));
console.log('No SMTP. No network. No Groq quota. No real contacts.\n');

const registry = require('./backend/src/services/campaignTypeRegistry');

// ── 0. Graph integrity ───────────────────────────────────────────────────────

test('Workflow graph references are valid (nodes/edges)', () => {
  const ids = new Set(workflow.nodes.map(n => n.id));
  for (const edge of workflow.edges) {
    assert.ok(ids.has(edge.source), `missing edge source ${edge.source}`);
    assert.ok(ids.has(edge.target), `missing edge target ${edge.target}`);
  }
});

test('Exactly ONE content-generation LLM node exists', () => {
  const llm = workflow.nodes.filter(n => n.data.toolId === 'groq' &&
    /Generate Structured Campaign Content/i.test(n.data.label || ''));
  assert.strictEqual(llm.length, 1, 'expected exactly one content-generation LLM node');
});

// ── 1–6. Campaign types ──────────────────────────────────────────────────────

const TYPE_CASES = [
  { key: 'newsletter', uiLabel: 'Newsletter' },
  { key: 'festival_wish', uiLabel: 'Festival / Occasion Wish' },
  { key: 'promotional', uiLabel: 'Promotional / Strategic Update' },
  { key: 'follow_up', uiLabel: 'Follow-up' },
  { key: 'event_invitation', uiLabel: 'Event Invitation' },
  { key: 'announcement', uiLabel: 'Announcement' }
];

for (const t of TYPE_CASES) {
  test(`${t.key}: registry maps UI label "${t.uiLabel}" to canonical key`, () => {
    assert.strictEqual(registry.normalizeCampaignType(t.uiLabel), t.key);
    assert.strictEqual(registry.normalizeCampaignType(t.key), t.key);
    assert.ok(registry.isSupportedCampaignType(t.key));
  });

  test(`${t.key}: prompt builder produces type-specific instructions`, () => {
    const out = runGeneration({
      payload: basePayload({ campaign_type: t.key }),
      llmOutput: fixtureLlmOutput({ campaign_type: t.key })
    });
    const prompt = out.promptBuilder.llm_prompt;
    assert.strictEqual(out.promptBuilder.campaign_type_normalized, t.key);
    assert.ok(out.promptBuilder.campaign_type_supported, 'type must be supported');
    assert.ok(prompt.includes(`Authoritative campaign type: ${t.key}`));
    assert.ok(prompt.includes('Campaign-specific instruction:'), 'type instruction required');
    assert.ok(prompt.includes('Output schema JSON:'), 'structured JSON schema required');
    assert.strictEqual(out.validation.normalized_generated_content, true);
  });
}

test('Registry contains exactly the six supported campaign types', () => {
  assert.deepStrictEqual(
    [...registry.CANONICAL_CAMPAIGN_TYPES].sort(),
    ['announcement', 'event_invitation', 'festival_wish', 'follow_up', 'newsletter', 'promotional']
  );
});

test('Unsupported campaign type is rejected, not substituted', () => {
  const out = runGeneration({
    payload: basePayload({ campaign_type: 'not_a_real_campaign_type' }),
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.promptBuilder.campaign_type_normalized, '');
  assert.strictEqual(out.promptBuilder.campaign_type_supported, false);
  assert.ok(out.promptBuilder.llm_prompt.includes('not supported by the SNS Square Client Nurturing workflow'));
  assert.strictEqual(registry.normalizeCampaignType('not_a_real_campaign_type'), '');
});

test('Router routes all six canonical campaign types', () => {
  const router = nodes['core_switch-nurture-router'].data.inputs;
  const routed = router.rules.map(r => r.value2);
  for (const t of TYPE_CASES) {
    assert.ok(routed.includes(t.key), `router missing ${t.key}`);
  }
});

test('Prompt forbids invention and demands omission over fabrication', () => {
  const out = runGeneration({ payload: basePayload(), llmOutput: fixtureLlmOutput() });
  const p = out.promptBuilder.llm_prompt;
  assert.ok(/Do not invent or infer/i.test(p));
  assert.ok(/Use ONLY URLs that appear verbatim/i.test(p));
  assert.ok(/omit that field or return an empty string/i.test(p));
  assert.ok(/Do not echo these instructions/i.test(p));
});
// ── 7. Null / missing Workbench result ────────────────────────────────────────

test('Null LLM result is rejected with a truthful reason', () => {
  const out = runGeneration({ payload: basePayload(), llmOutput: { text: '' } });
  assert.strictEqual(out.validation.normalized_generated_content, false);
  assert.strictEqual(out.validation.generation_validation.valid, false);
  assert.ok(out.validation.generation_validation.reason.length > 0, 'a reason is required');
  assert.strictEqual(out.response.success, false);
  assert.strictEqual(out.response.result, null);
});

// ── 8. Malformed LLM response ─────────────────────────────────────────────────

test('Malformed (non-JSON prose) LLM response is rejected', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: { text: 'Here is your friendly newsletter! Hope you enjoy it.' }
  });
  assert.strictEqual(out.validation.normalized_generated_content, false);
  assert.strictEqual(out.response.success, false);
});

test('LLM output containing only an error object is rejected', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: { text: JSON.stringify({ error: 'model unavailable' }) }
  });
  assert.strictEqual(out.validation.normalized_generated_content, false);
});

// ── 9. Prompt leakage ────────────────────────────────────────────────────────

test('Prompt / instruction leakage in generated content is rejected', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: fixtureLlmOutput({
      subject: 'EDITORIAL GUIDELINES FOR OFFICIAL SNS SQUARE NEWSLETTER: Real Subject',
      hero_body: ['RETURN ONLY one valid JSON object. Do not invent statistics.']
    })
  });
  assert.strictEqual(out.validation.normalized_generated_content, false);
  assert.ok(/leakage/i.test(out.validation.generation_validation.reason));
  assert.strictEqual(out.response.success, false);
});

test('Schema field names leaked into prose are rejected', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: fixtureLlmOutput({ hero_body: ['hero_headline: something the model echoed back'] })
  });
  assert.strictEqual(out.validation.normalized_generated_content, false);
});
// ── 10 / 11. CTA handling ────────────────────────────────────────────────────

const SUPPLIED_URL = 'https://www.snssquare.com/insights';

test('CTA URL not present in the request context is removed', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: fixtureLlmOutput({
      content_blocks: [{
        headline: 'Fixture Block Headline',
        body: 'Fixture block body.',
        cta_label: 'Explore',
        cta_url: 'https://fabricated-example.com/not-supplied'
      }]
    })
  });
  const block = out.validation.content_blocks[0];
  assert.ok(block, 'block should survive');
  assert.strictEqual(block.cta_url, undefined, 'fabricated CTA URL must be dropped');
});

test('CTA URL present in the request context is preserved', () => {
  const out = runGeneration({
    payload: basePayload({ approved_urls: [SUPPLIED_URL] }),
    llmOutput: fixtureLlmOutput({
      content_blocks: [{
        headline: 'Fixture Block Headline',
        body: 'Fixture block body.',
        cta_label: 'Explore',
        cta_url: SUPPLIED_URL
      }]
    })
  });
  assert.strictEqual(out.validation.content_blocks[0].cta_url, SUPPLIED_URL);
});

test('Missing CTA is simply absent; no placeholder CTA is invented', () => {
  const out = runGeneration({
    payload: basePayload(),
    llmOutput: fixtureLlmOutput({
      content_blocks: [{ headline: 'Fixture Block Headline', body: 'Fixture body.' }]
    })
  });
  const block = out.validation.content_blocks[0];
  assert.ok(!('cta_url' in block), 'no CTA URL key when none supplied');
  assert.ok(!('cta_label' in block), 'no CTA label key when none supplied');
  assert.ok(!/\[\s*action\s+text\s*\]/i.test(out.validation.email_body), 'no placeholder CTA token');
});
// ── 12 / 13. Recipient validation ────────────────────────────────────────────

test('Non-opted-in recipient can never be dispatched', () => {
  const optedOut = { ...FIXTURE_CONTACT, opt_in: false };
  const out = runGeneration({
    payload: basePayload({ contacts: [optedOut], active_contact: optedOut, action: 'approve_and_send' }),
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.ingest.active_contact, null, 'opted-out contact is filtered out');
  assert.strictEqual(out.ingest.send_allowed, false);
  assert.strictEqual(out.validation.send_allowed, false);
  assert.ok(/opt-in consent was found/i.test(out.ingest.send_blocked_reason));
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
  assert.ok(!smtpTargetFor('output-1').includes('smtp-nurture-dispatch'), 'must not route to SMTP');
});

test('Missing recipient email blocks dispatch (never a fallback address)', () => {
  const noEmail = { ...FIXTURE_CONTACT, email: '' };
  const out = runGeneration({
    payload: basePayload({ contacts: [noEmail], active_contact: noEmail, action: 'approve_and_send' }),
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.validation.send_allowed, false);
  assert.ok(/no email address/i.test(out.ingest.send_blocked_reason));
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
});

test('Missing subject blocks dispatch', () => {
  const out = runGeneration({
    payload: basePayload({ action: 'approve_and_send' }),
    llmOutput: fixtureLlmOutput({ subject: '' })
  });
  assert.strictEqual(out.validation.send_allowed, false);
  assert.ok(/subject/i.test(out.validation.send_blocked_reason));
});

test('Missing generated body blocks dispatch', () => {
  const out = runGeneration({
    payload: basePayload({ action: 'approve_and_send' }),
    llmOutput: { text: JSON.stringify({ subject: 'Fixture Subject', email_body: '', hero_headline: '', hero_body: [], content_blocks: [], closing_text: '', greeting: '', foundations: [], promo_banner: '' }) }
  });
  assert.strictEqual(out.validation.send_allowed, false);
});

// ── 14. No fabricated fallback content anywhere ──────────────────────────────

test('No fabricated fallback strings exist anywhere in the workflow', () => {
  const raw = JSON.stringify(workflow);
  const banned = [
    'thariniparthasarathy1804@gmail.com',
    'Interested in scheduling a technical review',
    'Valued Client',
    '+1-555-0199',
    'Past Client',
    'Executive Update: Sector Briefing & Capabilities',
    'reduced manual data handling by 84%'
  ];
  for (const phrase of banned) {
    assert.ok(!raw.includes(phrase), 'fabricated content still present: "' + phrase + '"');
  }
});

test('SMTP node has no fallback recipient, subject or sender', () => {
  const smtp = nodes['smtp-nurture-dispatch'].data.inputs;
  assert.strictEqual(smtp.toEmail, '{{ ($node["code.execute-nurture-ingest"].json["active_contact"] || {}).email || "" }}');
  assert.strictEqual(smtp.subject, '{{ $node["code.execute-1790678109627001"].json["subject"] || "" }}');
  assert.strictEqual(smtp.fromEmail, '{{ $node["code.execute-nurture-ingest"].json["from_email"] || $node["code.execute-nurture-ingest"].json["sender_email"] || "" }}');
  assert.ok(!JSON.stringify(smtp).includes('@'), 'no hard-coded address may remain');
});
test('Telemetry node never fabricates a client reply or contact field', () => {
  const out = runCodeNode('code.execute-engagement-telemetry', {
    active_contact: FIXTURE_CONTACT,
    campaign_name: 'Fixture Campaign',
    campaign_type: 'newsletter',
    developer_input: 'Fixture brief',
    subject: 'Fixture Subject',
    email_body: '<p>Fixture body</p>'
  }, {
    'code.execute-nurture-ingest': { json: { action: 'generate_preview', active_contact: FIXTURE_CONTACT } },
    'code.execute-1790678109627001': { json: { subject: 'Fixture Subject', email_body: '<p>Fixture body</p>' } }
  });
  assert.strictEqual(out.client_response_text, '', 'no reply text may be invented');
  assert.strictEqual(out.has_actual_client_response, false);
  assert.strictEqual(out.engagement_state, 'No Response');
  assert.strictEqual(out.requires_intent_classification, false);
  assert.strictEqual(out.phone, '', 'no fake phone default');
  assert.strictEqual(out.client_type, '', 'no "Past Client" default');
});

test('Telemetry reports a real reply verbatim when one actually exists', () => {
  const REAL_REPLY = 'Fixture reply text supplied by the caller.';
  const out = runCodeNode('code.execute-engagement-telemetry', {
    active_contact: FIXTURE_CONTACT,
    campaign_type: 'newsletter',
    client_response: REAL_REPLY
  }, {
    'code.execute-nurture-ingest': { json: { active_contact: FIXTURE_CONTACT } },
    'code.execute-1790678109627001': { json: { subject: 'S', email_body: '<p>b</p>' } }
  });
  assert.strictEqual(out.client_response_text, REAL_REPLY);
  assert.strictEqual(out.engagement_state, 'Replied');
  assert.strictEqual(out.requires_intent_classification, true);
});

// ── 15. Preview can never reach SMTP ─────────────────────────────────────────

test('Preview request (generate_preview) can NEVER reach SMTP', () => {
  const out = runGeneration({ payload: basePayload(), llmOutput: fixtureLlmOutput() });
  assert.strictEqual(out.ingest.action, 'generate_preview');
  assert.strictEqual(out.ingest.send_allowed, false);
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
  assert.deepStrictEqual(smtpTargetFor('output-1'), ['code.execute-format-response']);
});

test('Explicit approve_and_send with approved content, email and opt-in MAY route to SMTP', () => {
  // Dispatch requires the application-supplied, already-reviewed content.
  // The LLM is not re-run for dispatch, so approved subject/body must be sent.
  const out = runGeneration({
    payload: {
      ...basePayload({ action: 'approve_and_send' }),
      subject: 'Real Subject',
      email_body: '<p>Real body</p>',
      content: { subject: 'Real Subject', email_body: '<p>Real body</p>' }
    },
    llmOutput: { text: '' }
  });
  assert.strictEqual(out.validation.send_allowed, true, out.validation.send_blocked_reason);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 0);
  assert.deepStrictEqual(smtpTargetFor('output-0'), ['smtp-nurture-dispatch']);
});

test('approve_and_send WITHOUT approved content is blocked (no LLM regeneration for dispatch)', () => {
  const out = runGeneration({
    payload: basePayload({ action: 'approve_and_send' }),
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.validation.send_allowed, false,
    'dispatch must not synthesise content from the LLM');
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
});

test('Unknown action is not dispatched', () => {
  const out = runGeneration({
    payload: basePayload({ action: 'something_else' }),
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.ingest.send_allowed, false);
  assert.ok(/explicit approve_and_send/i.test(out.ingest.send_blocked_reason));
});

// ── 16. Sales handoff requires an actual reply ───────────────────────────────

test('Sales handoff classification only runs when a real reply exists', () => {
  const ingest = runCodeNode('code.execute-nurture-ingest', { body: basePayload() });
  const noReply = runCodeNode('code.execute-engagement-telemetry',
    { active_contact: FIXTURE_CONTACT }, {
      'code.execute-nurture-ingest': { json: ingest },
      'code.execute-1790678109627001': { json: {} }
    });
  assert.strictEqual(noReply.requires_intent_classification, false);

  const withReply = runCodeNode('code.execute-engagement-telemetry',
    { active_contact: FIXTURE_CONTACT, client_response: 'Fixture caller-supplied reply.' }, {
      'code.execute-nurture-ingest': { json: ingest },
      'code.execute-1790678109627001': { json: {} }
    });
  assert.strictEqual(withReply.requires_intent_classification, true);
});
// ── 17. Campaign deletion ────────────────────────────────────────────────────

test('Campaign deletion removes the campaign without corrupting contacts', () => {
  // Isolated temp data dir: real nurture-data files are never touched.
  process.env.NURTURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nurture-del-'));
  const store = require('./backend/src/services/nurtureStore');

  const campaignId = 'CMP-FIXTURE-' + Date.now();
  store.setContacts([{
    id: 'CNT-FIXTURE-DEL',
    name: 'Fixture Recipient',
    email: 'fixture-recipient@example.invalid',
    opt_in: true,
    client_engagements: []
  }]);
  store.addCampaign({ id: campaignId, name: 'Fixture Campaign', type_key: 'newsletter', status: 'Draft' });

  // A second campaign must survive deletion of the first.
  const otherId = 'CMP-FIXTURE-OTHER-' + Date.now();
  store.addCampaign({ id: otherId, name: 'Other Fixture Campaign', type_key: 'promotional', status: 'Draft' });

  const contactsBefore = store.getContacts().length;
  const deleted = store.deleteCampaign(campaignId);

  assert.ok(deleted, 'campaign must be deleted');
  assert.ok(!store.getCampaigns().some(c => c.id === campaignId), 'deleted campaign is gone');
  assert.ok(store.getCampaigns().some(c => c.id === otherId), 'other campaign untouched');
  assert.strictEqual(store.getContacts().length, contactsBefore, 'contacts are not deleted');
  assert.strictEqual(store.deleteCampaign('CMP-DOES-NOT-EXIST'), null, 'unknown id returns null, no throw');
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 REGRESSION SUITE — dispatch routing
//
// Dispatch must NOT require the LLM to regenerate the campaign. The application
// supplies reviewed, approved subject + email_body; those are validated and
// sanitised directly. Preview behaviour is unchanged.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n--- PHASE 3: dispatch routing regressions ---');

/** Dispatch payload as the backend actually builds it (campaigns.js recipientPayload). */
function dispatchPayload(overrides = {}) {
  const contact = overrides.__contact || FIXTURE_CONTACT;
  const body = Object.prototype.hasOwnProperty.call(overrides, '__body')
    ? overrides.__body
    : '<p>Real body</p>';
  const subject = Object.prototype.hasOwnProperty.call(overrides, '__subject')
    ? overrides.__subject
    : 'Real Subject';
  return {
    action: 'approve_and_send',
    campaign_name: 'Fixture Campaign',
    campaign_type: 'newsletter',
    developer_input: 'CAMPAIGN TOPIC: Fixture brief',
    sector: 'Fixture Sector',
    target_segment: '',
    channel: 'email',
    from_email: 'sender@example.invalid',
    sender_email: 'sender@example.invalid',
    contacts: [contact],
    active_contact: contact,
    to_email: contact.email,
    recipient_email: contact.email,
    email: contact.email,
    subject: subject,
    email_body: body,
    content: { subject: subject, email_body: body },
    ...overrides
  };
}

/** Run the dispatch path with an EMPTY mocked LLM response. */
function runDispatch(overrides, llmText = '') {
  const payload = dispatchPayload(overrides);
  delete payload.__contact; delete payload.__body; delete payload.__subject;
  return runGeneration({ payload, llmOutput: { text: llmText } });
}

// Test 1 — CRITICAL: approved content dispatches without LLM regeneration.
test('P3-T1 Dispatch uses approved content WITHOUT LLM regeneration', () => {
  const out = runDispatch({});
  const g = out.validation.generation_validation;
  assert.strictEqual(out.ingest.action, 'approve_and_send');
  assert.strictEqual(g.valid, true, 'approved dispatch content must validate');
  assert.strictEqual(out.validation.send_allowed, true, out.validation.send_blocked_reason);
  assert.strictEqual(out.validation.subject, 'Real Subject', 'approved subject preserved');
  assert.ok(String(out.validation.email_body).includes('Real body'), 'approved body preserved');
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 0,
    'switch must select SMTP/output 0');
  assert.deepStrictEqual(smtpTargetFor('output-0'), ['smtp-nurture-dispatch']);
});

// Test 2 — blocked without opt-in
test('P3-T2 Dispatch blocked without opt-in', () => {
  const optedOut = { ...FIXTURE_CONTACT, opt_in: false };
  const out = runDispatch({ __contact: optedOut });
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1, 'must take fallback');
});

// Test 3 — blocked without recipient email
test('P3-T3 Dispatch blocked without recipient email', () => {
  const noEmail = { ...FIXTURE_CONTACT, email: '' };
  const out = runDispatch({ __contact: noEmail });
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1, 'must take fallback');
  assert.ok(/no recipient with active opt-in consent|no email address/i.test(out.validation.send_blocked_reason));
});

// Test 4 — blocked without subject
test('P3-T4 Dispatch blocked without subject', () => {
  const out = runDispatch({ __subject: '' });
  assert.strictEqual(out.validation.generation_validation.valid, false);
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
});

// Test 5 — blocked without body
test('P3-T5 Dispatch blocked without body', () => {
  const out = runDispatch({ __body: '' });
  assert.strictEqual(out.validation.generation_validation.valid, false);
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
});

// Test 6 — dispatch content containing prompt leakage
test('P3-T6 Dispatch content containing prompt leakage is rejected', () => {
  const out = runDispatch({ __body: '<p>RETURN ONLY this content</p>' });
  assert.strictEqual(out.validation.generation_validation.valid, false);
  assert.strictEqual(out.validation.send_allowed, false);
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
  assert.ok(/leakage/i.test(out.validation.generation_validation.reason));
});

// Test 7 — preview remains blocked from SMTP
test('P3-T7 Preview remains blocked from SMTP', () => {
  const payload = dispatchPayload({});
  delete payload.__contact; delete payload.__body; delete payload.__subject;
  payload.action = 'generate_preview';
  const out = runGeneration({
    payload,
    llmOutput: fixtureLlmOutput()
  });
  assert.strictEqual(out.ingest.action, 'generate_preview');
  assert.strictEqual(out.validation.generation_validation.valid, true, 'preview content is valid');
  assert.strictEqual(out.validation.send_allowed, false, 'preview must never be sendable');
  assert.strictEqual(routeThroughGenerationSwitch(out.validation, out.ingest), 1);
  assert.ok(!smtpTargetFor('output-1').includes('smtp-nurture-dispatch'));
});

// Test 8 — graph integrity
test('P3-T8 Graph integrity: one validation->switch edge, no orphan router fallback', () => {
  const toSwitch = w2().edges.filter(e =>
    e.source === 'code.execute-1790678109627001' &&
    e.target === 'core_switch-nurture-generation-valid');
  assert.strictEqual(toSwitch.length, 1,
    'exactly ONE edge from the validation node to the dispatch switch, found ' + toSwitch.length);

  const routerHandles = w2().edges
    .filter(e => e.source === 'core_switch-nurture-router')
    .map(e => e.sourceHandle);
  assert.ok(!routerHandles.includes('output-fallback'),
    'orphaned output-fallback router edge must not exist');

  // The dispatch gate expression itself must remain unchanged.
  const sw = nodes['core_switch-nurture-generation-valid'].data.inputs.rules[0];
  assert.strictEqual(sw.outputIndex, 0);
  assert.ok(sw.value1.includes('$json.action !== "generate_preview"'));
  assert.ok(sw.value1.includes('$json.send_allowed === true'));
  assert.ok(sw.value1.includes('$json.generation_validation'));
});

function w2() { return workflow; }

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 REGRESSION SUITE — delivery honesty
//
// success:true must NEVER imply an email was sent. Only an explicit delivery
// confirmation satisfies the backend delivery check.
//
// These tests execute the real workflow code nodes locally with a mocked LLM
// and a MOCKED SMTP node output. No SMTP, no network, no real recipient.
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n--- PHASE 4: delivery honesty regressions ---');

const { isDeliveryConfirmedResponse } = require('./backend/src/routes/campaigns');

/**
 * Run ingest -> prompt builder -> validation -> (optional mocked SMTP) -> response.
 * The SMTP node output is ONLY injected when the dispatch switch routes to output-0,
 * exactly as the real graph does.
 */
function runOutcome({ payload, llmText = '', smtpOutput = { success: true } }) {
  const ingest = runCodeNode('code.execute-nurture-ingest', { body: payload });
  const promptBuilder = runCodeNode('code.execute-campaign-prompt-builder', ingest, {
    'code.execute-nurture-ingest': { json: ingest }
  });
  const validation = runCodeNode('code.execute-1790678109627001', { text: llmText }, {
    'code.execute-nurture-ingest': { json: ingest },
    'code.execute-campaign-prompt-builder': { json: promptBuilder }
  });

  const route = routeThroughGenerationSwitch(validation, ingest);
  const nodeResults = {
    'code.execute-nurture-ingest': { json: ingest },
    'code.execute-campaign-prompt-builder': { json: promptBuilder },
    'code.execute-1790678109627001': { json: validation }
  };

  let smtpExecuted = false;
  if (route === 0) {
    smtpExecuted = true;
    nodeResults['smtp-nurture-dispatch'] = { json: smtpOutput };
    nodeResults['code.execute-engagement-telemetry'] = { json: { engagement_state: 'No Response' } };
  }

  const response = runCodeNode('code.execute-format-response', {}, nodeResults);
  return { ingest, validation, route, smtpExecuted, response };
}

const OUTCOME_BASE = {
  campaign_name: 'Fixture Campaign',
  campaign_type: 'newsletter',
  developer_input: 'Fixture brief',
  sector: 'Fixture Sector',
  contacts: [FIXTURE_CONTACT],
  active_contact: FIXTURE_CONTACT,
  from_email: 'sender@example.invalid',
  sender_email: 'sender@example.invalid',
  subject: 'Real Subject',
  email_body: '<p>Real body</p>',
  content: { subject: 'Real Subject', email_body: '<p>Real body</p>' }
};

const APPROVED_LLM = JSON.stringify({
  subject: 'Generated Subject',
  hero_headline: 'Generated Headline',
  hero_body: ['Generated body.'],
  closing_text: 'Generated closing.',
  email_body: '<p>Generated body.</p>'
});

// Test 1 — Fallback cannot report delivery
test('P4-T1 Fallback response cannot report delivery', () => {
  const out = runOutcome({
    payload: {
      ...OUTCOME_BASE, action: 'approve_and_send',
      subject: 'Leak', email_body: '<p>RETURN ONLY this content</p>',
      content: { subject: 'Leak', email_body: '<p>RETURN ONLY this content</p>' }
    }
  });
  assert.strictEqual(out.route, 1, 'must take the fallback branch');
  assert.strictEqual(out.smtpExecuted, false, 'SMTP must NOT be executed');
  assert.strictEqual(out.response.success, false);
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.notStrictEqual(out.response.status, 'sent');
  assert.strictEqual(out.response.status, 'blocked');
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

// Test 2 — Generation success is NOT delivery success (CRITICAL)
test('P4-T2 Generation success is NOT delivery success', () => {
  const generationOnly = {
    success: true,
    status: 'completed',
    content_source: 'workbench',
    delivery_confirmed: false,
    result: { subject: 'Generated Subject', email_body: '<p>Generated body.</p>' }
  };
  assert.strictEqual(isDeliveryConfirmedResponse(generationOnly), false,
    'a generation response must never confirm delivery');

  // Also proven through the real node.
  const out = runOutcome({ payload: { ...OUTCOME_BASE, action: 'generate_preview' }, llmText: APPROVED_LLM });
  assert.strictEqual(out.route, 1);
  assert.strictEqual(out.smtpExecuted, false);
  assert.strictEqual(out.response.success, true);
  assert.strictEqual(out.response.status, 'completed');
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);

  // Historical false positives must now be rejected.
  assert.strictEqual(isDeliveryConfirmedResponse({ success: true, status: 'completed' }), false);
  assert.strictEqual(isDeliveryConfirmedResponse({ success: true }), false);
  assert.strictEqual(isDeliveryConfirmedResponse({ success: true, status: 'success' }), false);
});

// Test 3 — Explicit SMTP confirmation IS delivery success
test('P4-T3 Explicit SMTP confirmation is delivery success', () => {
  const out = runOutcome({
    payload: { ...OUTCOME_BASE, action: 'approve_and_send' },
    llmText: '',
    smtpOutput: { success: true, messageId: 'fixture-message-id' }
  });
  assert.strictEqual(out.route, 0, 'must route to SMTP');
  assert.strictEqual(out.smtpExecuted, true);
  assert.strictEqual(out.response.success, true);
  assert.strictEqual(out.response.status, 'sent');
  assert.strictEqual(out.response.delivery_confirmed, true);
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), true,
    'explicit delivery confirmation must satisfy the backend check');
});

// Test 4 — SMTP not reached => nothing marked as sent
test('P4-T4 SMTP not reached => delivery_confirmed false, not Sent', () => {
  const out = runOutcome({
    payload: { ...OUTCOME_BASE, action: 'approve_and_send', subject: '', email_body: '',
      content: { subject: '', email_body: '' } }
  });
  assert.strictEqual(out.route, 1);
  assert.strictEqual(out.smtpExecuted, false, 'SMTP must NOT be called');
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.notStrictEqual(out.response.status, 'sent');
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

// Test 5 — Preview never delivers
test('P4-T5 Preview generates successfully but never delivers', () => {
  const out = runOutcome({ payload: { ...OUTCOME_BASE, action: 'generate_preview' }, llmText: APPROVED_LLM });
  assert.strictEqual(out.response.success, true, 'generation succeeds');
  assert.strictEqual(out.response.normalized_generated_content, true);
  assert.strictEqual(out.smtpExecuted, false, 'SMTP not called for preview');
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

// Test 6 — Missing recipient blocked
test('P4-T6 Dispatch blocked for recipient without email', () => {
  const noEmail = { ...FIXTURE_CONTACT, email: '' };
  const out = runOutcome({
    payload: { ...OUTCOME_BASE, action: 'approve_and_send', contacts: [noEmail], active_contact: noEmail }
  });
  assert.strictEqual(out.smtpExecuted, false);
  assert.strictEqual(out.response.success, false);
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.notStrictEqual(out.response.status, 'sent');
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

// Test 7 — Non-opted-in blocked
test('P4-T7 Dispatch blocked for non-opted-in recipient', () => {
  const optedOut = { ...FIXTURE_CONTACT, opt_in: false };
  const out = runOutcome({
    payload: { ...OUTCOME_BASE, action: 'approve_and_send', contacts: [optedOut], active_contact: optedOut }
  });
  assert.strictEqual(out.smtpExecuted, false);
  assert.strictEqual(out.response.success, false);
  assert.strictEqual(out.response.delivery_confirmed, false);
  assert.notStrictEqual(out.response.status, 'sent');
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

test('P4-T8 Blocked dispatch reports a specific truthful error_type', () => {
  const cases = [
    [{ ...OUTCOME_BASE, action: 'approve_and_send', subject: 'L', email_body: '<p>RETURN ONLY this</p>',
       content: { subject: 'L', email_body: '<p>RETURN ONLY this</p>' } }, 'prompt_leak_detected'],
    [{ ...OUTCOME_BASE, action: 'approve_and_send', subject: '', email_body: '',
       content: { subject: '', email_body: '' } }, 'missing_campaign_content'],
    [{ ...OUTCOME_BASE, action: 'approve_and_send', contacts: [{ ...FIXTURE_CONTACT, email: '' }],
       active_contact: { ...FIXTURE_CONTACT, email: '' } }, 'missing_recipient_email'],
    [{ ...OUTCOME_BASE, action: 'approve_and_send', contacts: [{ ...FIXTURE_CONTACT, opt_in: false }],
       active_contact: { ...FIXTURE_CONTACT, opt_in: false } }, 'not_opted_in']
  ];
  for (const [payload, expected] of cases) {
    const out = runOutcome({ payload });
    assert.strictEqual(out.response.error_type, expected,
      'expected ' + expected + ' but got ' + out.response.error_type);
    assert.ok(out.response.error && out.response.error.length > 0, 'a human-readable reason is required');
  }
});

test('P4-T9 SMTP executed but NOT confirmed is never reported as sent', () => {
  const out = runOutcome({
    payload: { ...OUTCOME_BASE, action: 'approve_and_send' },
    llmText: '',
    smtpOutput: { success: false, error: 'fixture smtp failure' }
  });
  assert.strictEqual(out.smtpExecuted, true, 'SMTP node did run');
  assert.strictEqual(out.response.delivery_confirmed, false, 'but it did not confirm delivery');
  assert.strictEqual(out.response.success, false);
  assert.notStrictEqual(out.response.status, 'sent');
  assert.strictEqual(isDeliveryConfirmedResponse(out.response), false);
});

// ── Summary ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log('\n' + '='.repeat(78));
console.log('RESULT: ' + passed + '/' + results.length + ' passed, ' + failed + ' failed');
console.log('='.repeat(78));
console.log('CONFIRMED: no SMTP invoked, no network call, no Groq quota, no real contacts modified.');
if (failed > 0) {
  console.log('\nFailures:');
  results.filter(r => !r.ok).forEach(r => console.log(' - ' + r.name + ': ' + r.err.message));
  process.exit(1);
}
