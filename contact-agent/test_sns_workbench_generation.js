'use strict';

const assert = require('assert');
const { JSDOM } = require('jsdom');
const workbenchService = require('./backend/src/services/nurtureWorkbenchService');
const { extractWorkbenchAiContent, personalizeContentForRecipient } = require('./backend/src/routes/campaigns');
const { normalizeWorkbenchTemplateContent } = require('./frontend/src/views/nurturing/workbenchTemplateContent');

async function run() {
  const originalFetch = global.fetch;
  const originalProdUrl = process.env.NURTURE_WORKBENCH_WEBHOOK_URL;
  const originalTestUrl = process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL;
  const originalTestMode = process.env.TEST_MODE;
  const originalUseTest = process.env.USE_WORKBENCH_TEST_WEBHOOK;
  const requestedUrls = [];

  process.env.NURTURE_WORKBENCH_WEBHOOK_URL = 'https://api.agents.snsihub.ai/webhook/client-nurturing';
  process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL = 'https://api.agents.snsihub.ai/webhook-test/client-nurturing';
  process.env.TEST_MODE = 'true';
  process.env.USE_WORKBENCH_TEST_WEBHOOK = 'true';
  workbenchService.preferredWebhookUrl = process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL;

  try {
    console.log('SNS WORKBENCH PRODUCTION GENERATION SERVICE TESTS');

    // This is the observed production 404 envelope, captured during the actual
    // production endpoint check; it contains an error and no generated content.
    const actual404 = {
      error: 'Webhook not found or workflow inactive',
      debug: { received: { path: 'client-nurturing', method: 'POST', isTest: false }, extractedPathParams: {} }
    };
    global.fetch = async (url, options) => {
      requestedUrls.push({ url, payload: JSON.parse(options.body) });
      return { status: 404, text: async () => JSON.stringify(actual404) };
    };
    await assert.rejects(
      workbenchService.triggerNurturingProductionWorkflow({ action: 'generate_preview', campaign_name: 'Newsletter' }),
      error => {
        assert.strictEqual(error.status, 404);
        assert.strictEqual(error.errorType, 'workflow_not_deployed');
        assert.deepStrictEqual(error.responseData, actual404);
        return true;
      }
    );
    assert.deepStrictEqual(requestedUrls.map(item => item.url), [process.env.NURTURE_WORKBENCH_WEBHOOK_URL]);
    assert.strictEqual(requestedUrls[0].payload.action, 'generate_preview');
    console.log('  ✓ Production generation stays on /webhook/client-nurturing under test flags and preserves actual 404 JSON');

    // Structural fixture uses the existing app contract (subject/email_body).
    // It exercises envelope extraction only and is never surfaced as generated output.
    const contractFixture = {
      output: { items: [{ json: { body: { subject: 'fixture subject', email_body: '<p>fixture body</p>' } } }] }
    };
    assert.deepStrictEqual(extractWorkbenchAiContent(contractFixture), {
      subject: 'fixture subject',
      email_body: '<p>fixture body</p>',
      personalization_summary: 'Generated via SNS Workbench workflow'
    });
    assert.strictEqual(extractWorkbenchAiContent(actual404), null, '404 response must never become generated content');
    assert.strictEqual(extractWorkbenchAiContent({ output: { items: [{ json: { body: { developer_input: 'request echo' } } }] } }), null,
      'Echoed request body must never become generated content');
    console.log('  ✓ Known response contract is normalized; production error and echoed request remain unusable');

    global.DOMParser = new JSDOM('').window.DOMParser;
    const normalized = normalizeWorkbenchTemplateContent({
      preview: {
        subject: 'Fixture subject',
        body_text_only: '<div><p>Hello,</p><h1>Fixture hero</h1><p>Fixture introduction.</p><p><strong>Headline: Fixture article</strong></p><p>Fixture analysis.</p><p><a href="https://example.test/article">Read article</a></p><ul><li>Fixture takeaway</li></ul></div>'
      },
      workbench_content: { subject: 'Fixture subject', email_body: '<p>Fixture body</p>' }
    });
    assert.deepStrictEqual(normalized, {
      subjectLine: 'Fixture subject',
      heroHeadline: 'Fixture hero',
      heroBody: 'Fixture introduction.',
      articles: [{ headline: 'Fixture article', body: 'Fixture analysis.', ctaText: 'Read article', ctaUrl: 'https://example.test/article' }],
      synthesisPoints: ['Fixture takeaway']
    });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized, 'promotionalBanner'), false,
      'Missing promotional content remains absent instead of invented');
    assert.strictEqual(normalizeWorkbenchTemplateContent({ error: 'Webhook not found or workflow inactive' }), null);
    console.log('  ✓ Actual response content is mapped into existing fields; missing promotional content stays absent');

    const approvedHtml = '<table><tr><td>Dear {{first_name}}, {{company}} — {{industry}} / {{client_name}}</td></tr></table>';
    const personalized = personalizeContentForRecipient(approvedHtml, 'Update for {{company}}', {
      id: 'contact-1', name: 'Arjun Mehta', company: 'Example & Co', sector: 'Technology'
    }, [], 'https://example.test');
    assert.strictEqual(approvedHtml.includes('{{first_name}}'), true, 'Approved source remains unchanged');
    assert(personalized.body.includes('Dear Arjun, Example &amp; Co — Technology / Arjun Mehta'));
    assert.strictEqual(personalized.subject, 'Update for Example & Co');
    console.log('  ✓ Dispatch personalizes the approved template source per recipient without mutating that source');

    // A successful transport with the established response contract is passed
    // through as actual response fields. This structural fixture tests wiring,
    // not production availability or generated copy quality.
    global.fetch = async (url, options) => {
      requestedUrls.push({ url, payload: JSON.parse(options.body) });
      return {
        status: 200,
        text: async () => JSON.stringify({ subject: 'fixture subject', email_body: '<p>fixture body</p>' })
      };
    };
    const successResult = await workbenchService.triggerNurturingProductionWorkflow({ action: 'generate_preview' });
    assert.strictEqual(successResult.httpStatus, 200);
    assert.deepStrictEqual(successResult.data, { subject: 'fixture subject', email_body: '<p>fixture body</p>' });
    assert.strictEqual(requestedUrls.at(-1).url, process.env.NURTURE_WORKBENCH_WEBHOOK_URL);
    console.log('  ✓ Successful response data is passed through without fallback or fabricated fields');

    console.log('RESULTS: 5/5 Workbench generation service tests passed');
  } finally {
    global.fetch = originalFetch;
    delete global.DOMParser;
    workbenchService.preferredWebhookUrl = null;
    if (originalProdUrl === undefined) delete process.env.NURTURE_WORKBENCH_WEBHOOK_URL;
    else process.env.NURTURE_WORKBENCH_WEBHOOK_URL = originalProdUrl;
    if (originalTestUrl === undefined) delete process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL;
    else process.env.NURTURE_WORKBENCH_TEST_WEBHOOK_URL = originalTestUrl;
    if (originalTestMode === undefined) delete process.env.TEST_MODE;
    else process.env.TEST_MODE = originalTestMode;
    if (originalUseTest === undefined) delete process.env.USE_WORKBENCH_TEST_WEBHOOK;
    else process.env.USE_WORKBENCH_TEST_WEBHOOK = originalUseTest;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
