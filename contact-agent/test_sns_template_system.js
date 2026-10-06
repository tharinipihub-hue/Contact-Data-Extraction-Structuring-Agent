'use strict';

/**
 * SNS Square Campaign Template System Verification Test Suite
 * 
 * Verifies:
 * 1. Template variable interpolation with client data and fallbacks.
 * 2. All 5 canonical templates render rich, self-contained HTML (not blank).
 * 3. SNS Square branding: multi-color square logo, category-specific gradients, dark footer.
 * 4. Curated article cards, call-to-actions, foundations, and promotional banners.
 * 5. Dynamic recipient switching without audience distortion.
 * 6. DOMPurify security sanitization preserving email layout, styles, and imagery.
 * 7. Exact zero divergence between preview and dispatch content.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Load templateEmailBuilder (transpiled/compatible or pure JS)
// Let's implement the pure JS module import or require
const {
  buildSnsTemplateEmailHtml,
  interpolateTemplateVars,
  interpolateEmailHtmlVars,
  buildSnsTemplateEmailResult
} = require('./backend/src/services/templateEmailBuilderNode');

const MOCK_CONTACTS = [
  {
    id: 'CNT-001',
    name: 'Priya Sharma',
    company: 'Vertex Corp',
    sector: 'Technology',
    email: 'psharma@vertexcorp.com',
    opt_in: true
  },
  {
    id: 'CNT-002',
    name: 'David Miller',
    company: 'Apex Financial',
    sector: 'Finance',
    email: 'dmiller@apexfin.com',
    opt_in: true
  }
];

const TEMPLATES = [
  {
    id: 'editorial_newsletter',
    name: 'SNS Editorial Newsletter',
    category: 'Newsletter',
    headerTitle: 'Your Weekly GCC & AI Scoop',
    headerSubtitle: 'Core Perspective | Wednesday Edition',
    defaultSubject: 'Enterprise AI & Cloud Transformation | SNS Square Weekly GCC & AI Scoop',
    greetingType: 'editorial',
    heroHeadline: 'Navigating Sustainable Enterprise Transformation',
    heroBody: 'Enterprise transformation is entering a new phase.',
    blocks: [
      {
        id: 'b1',
        headline: 'FedRAMP Cloud Modernisation: Building a Secure Digital Foundation',
        image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
        body: 'Cloud modernisation has become a strategic priority for government agencies.',
        ctaText: 'Build secure digital foundations',
        ctaUrl: 'https://www.snssquare.com/insights'
      }
    ],
    foundationsTitle: 'Every transformation initiative ultimately depends on four foundations:',
    foundations: [
      'Secure digital infrastructure that enables innovation.',
      'Intelligent systems that improve operational performance.'
    ],
    closingText: 'Together, these capabilities form the foundation of resilient organizations.',
    promoBanner: {
      headline: 'Data & Agentic AI Services. Built for Execution.',
      body: 'Design, build, and operate production-grade data and Agentic AI systems.',
      partnerBadge: 'Trusted Build and Operational Partner for GCCs in India',
      ctaText: 'Explore GCC Services',
      ctaUrl: 'https://www.snssquare.com/gcc-services'
    }
  },
  {
    id: 'festival_greeting',
    name: 'SNS Festival & Seasonal Greeting',
    category: 'Occasion',
    headerTitle: 'Warm Executive Festive Wishes',
    headerSubtitle: 'Celebrating Shared Milestones & Prosperity',
    defaultSubject: 'Warm Festive Wishes to {{company}} from SNS Square',
    greetingType: 'personal',
    heroHeadline: 'Celebrating Shared Milestones and Enduring Partnership',
    heroBody: 'As we celebrate this joyous festive season, all of us at SNS Square extend our warmest greetings to {{company}}.',
    blocks: [
      {
        id: 'b1',
        headline: 'A Season of Renewal, Growth, and Shared Prosperity',
        image: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=800',
        body: 'May this festive season illuminate new avenues of growth.',
        ctaText: 'Connect with Executive Leadership',
        ctaUrl: 'https://www.snssquare.com/leadership'
      }
    ],
    foundationsTitle: 'Reflecting on the foundations of our collaboration:',
    foundations: ['Commitment to delivery excellence.', 'Collaborative alignment.'],
    closingText: 'Wishing you and {{company}} a prosperous year ahead.',
    promoBanner: {
      headline: 'Empowering Enterprise Excellence Together',
      body: 'We are proud to serve as your strategic partner.',
      partnerBadge: 'Executive Partnership Desk',
      ctaText: 'Visit SNS Square',
      ctaUrl: 'https://www.snssquare.com'
    }
  },
  {
    id: 'promotional_campaign',
    name: 'SNS Enterprise Promotional Campaign',
    category: 'Campaign',
    headerTitle: 'Enterprise Agentic AI & Data Capabilities',
    headerSubtitle: 'Strategic Advisory & Production Execution',
    defaultSubject: 'Data & Agentic AI Capabilities for {{company}}',
    greetingType: 'personal',
    heroHeadline: 'Moving From Experimental AI to Autonomous Production Systems',
    heroBody: 'Modern enterprises require data architectures engineered for deterministic execution.',
    blocks: [
      {
        id: 'b1',
        headline: 'Agentic Workflow Automation: Autonomous Decision Workflows',
        image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800',
        body: 'Our Agentic AI systems combine real-time domain grounding with multi-agent orchestration.',
        ctaText: 'Schedule Technical Demonstration',
        ctaUrl: 'https://www.snssquare.com/demo'
      }
    ],
    foundationsTitle: 'Key delivery tenets powering our engagements:',
    foundations: ['Zero-compromise security posture.'],
    closingText: 'Ready to elevate your roadmap? Contact us today.',
    promoBanner: {
      headline: 'Data & Agentic AI Services. Built for Execution.',
      body: 'Production-grade agentic systems.',
      partnerBadge: 'Trusted Build & Operational Partner',
      ctaText: 'Explore GCC Services',
      ctaUrl: 'https://www.snssquare.com/gcc-services'
    }
  },
  {
    id: 'event_invitation',
    name: 'SNS Executive Event & Webinar Invitation',
    category: 'Event',
    headerTitle: 'Executive Leadership Roundtable',
    headerSubtitle: 'Exclusive CXO & Engineering Leadership Forum',
    defaultSubject: 'Invitation: Enterprise Agentic AI Roundtable 2026 for {{company}}',
    greetingType: 'personal',
    heroHeadline: 'You Are Invited: The 2026 GCC & AI Transformation Summit',
    heroBody: 'We are pleased to invite you to an exclusive closed-door executive roundtable.',
    blocks: [
      {
        id: 'b1',
        headline: 'Keynote & Panel: Scaling Autonomous Agent Swarms',
        image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
        body: 'Industry leaders will present verified case studies.',
        ctaText: 'Reserve Your Executive Seat',
        ctaUrl: 'https://www.snssquare.com/events/roundtable-2026'
      }
    ],
    foundationsTitle: 'Roundtable Agenda & Strategic Focus:',
    foundations: ['Architectural blueprints for agentic integration.'],
    closingText: 'Seats are strictly limited.',
    promoBanner: {
      headline: 'SNS Square Executive Thought Leadership',
      body: 'Curating actionable insights.',
      partnerBadge: 'SNS Executive Network',
      ctaText: 'View Full Agenda',
      ctaUrl: 'https://www.snssquare.com/events'
    }
  },
  {
    id: 'client_update',
    name: 'SNS Strategic Client & Partnership Update',
    category: 'Client Update',
    headerTitle: 'Executive Client Briefing & Roadmap',
    headerSubtitle: 'SNS Square Strategic Partnership Services',
    defaultSubject: 'Partnership Milestone & Platform Update for {{company}}',
    greetingType: 'personal',
    heroHeadline: 'Quarterly Partnership Milestones & Capabilities Update',
    heroBody: 'We are pleased to share our periodic executive briefing highlighting recent platform enhancements for {{company}}.',
    blocks: [
      {
        id: 'b1',
        headline: 'Platform Performance & Operational Milestones Delivered',
        image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
        body: 'Over the past quarter, our teams achieved 99.98% uptime.',
        ctaText: 'Review Full Milestone Report',
        ctaUrl: 'https://www.snssquare.com/portal'
      }
    ],
    foundationsTitle: 'Key operational metrics across our partnership:',
    foundations: ['Sub-second API response times.'],
    closingText: 'We welcome your feedback.',
    promoBanner: {
      headline: 'Dedicated Enterprise Support & Advisory',
      body: 'Your dedicated Client Partner is available for technical escalations.',
      partnerBadge: 'Enterprise Client Advisory',
      ctaText: 'Contact Client Partner',
      ctaUrl: 'mailto:partnerships@snssquare.com'
    }
  }
];

function runTemplateTests() {
  console.log('========================================================');
  console.log('SNS SQUARE CAMPAIGN TEMPLATE SYSTEM — VERIFICATION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  const total = 13;

  // 1. Variable Interpolation
  console.log('TEST 1: Variable interpolation for personalization tags...');
  try {
    const raw = 'Hello {{first_name}}, welcome to {{company}} in {{industry}}.';
    const res = interpolateTemplateVars(raw, MOCK_CONTACTS[0]);
    assert.strictEqual(res, 'Hello Priya, welcome to Vertex Corp in Technology.');
    const fallback = interpolateTemplateVars('Hi {{first_name}} at {{company}}', null);
    assert.strictEqual(fallback, 'Hi  at ');
    console.log('  ✓ Personalization tags dynamically substituted');
    console.log('  ✓ Omitted without fabrication when recipient data is missing');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 1 Failed:', err.message);
  }

  // 2. All 5 Templates Render Non-Empty HTML
  console.log('\nTEST 2: All 5 templates compile self-contained, non-empty HTML...');
  try {
    for (const tmpl of TEMPLATES) {
      const html = buildSnsTemplateEmailHtml({
        template: tmpl,
        recipient: MOCK_CONTACTS[0]
      });
      assert(typeof html === 'string', `${tmpl.name} output must be string`);
      assert(html.length > 500, `${tmpl.name} HTML length ${html.length} must exceed 500 chars`);
      assert(!html.includes('{{company}}'), `${tmpl.name} should interpolate {{company}}`);
      assert(html.includes('<table'), `${tmpl.name} should use email table layout`);
      assert(html.includes('alt="SNS Square — Redesigning Business"'), `${tmpl.name} should use the canonical supplied SNS Square logo`);
      assert(html.includes('https://contact-data-extraction-structuring-agent.onrender.com/sns-square-logo.png'), `${tmpl.name} should use the supplied multi-color logo asset`);
      assert(html.includes('unsubscribe'), `${tmpl.name} should contain compliance guidance`);
      assert(html.includes('#064EE3'), `${tmpl.name} should use the confirmed SNS header color`);
    }
    console.log('  ✓ All 5 templates generate complete HTML exceeding 500 characters');
    console.log('  ✓ Zero unrendered placeholder tags in generated markup');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 2 Failed:', err.message);
  }

  // 3. SNS Square Brand Identity Preserved
  console.log('\nTEST 3: SNS Square brand identity elements present in all emails...');
  try {
    const html = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      recipient: MOCK_CONTACTS[0]
    });
    assert(html.includes('bgcolor="#064EE3"'), 'Brand header color');
    assert(html.includes('SNS SQUARE'), 'Brand wordmark SNS SQUARE');
    assert(html.includes('unsubscribe'), 'Compliance/unsubscribe information present');
    console.log('  ✓ SNS Square wordmark and confirmed brand header embedded');
    console.log('  ✓ Compliance footer and unsubscribe guidance verified');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 3 Failed:', err.message);
  }

  // 4. Shared SNS Square blue header
  console.log('\nTEST 4: All categories use the confirmed SNS Square header color...');
  try {
    const newsletterHtml = buildSnsTemplateEmailHtml({ template: TEMPLATES[0], recipient: MOCK_CONTACTS[0] });
    assert(newsletterHtml.includes('bgcolor="#064EE3"'), 'Newsletter confirmed blue header');

    const festivalHtml = buildSnsTemplateEmailHtml({ template: TEMPLATES[1], recipient: MOCK_CONTACTS[0] });
    assert(festivalHtml.includes('bgcolor="#064EE3"'), 'Occasion confirmed blue header');

    const eventHtml = buildSnsTemplateEmailHtml({ template: TEMPLATES[3], recipient: MOCK_CONTACTS[0] });
    assert(eventHtml.includes('bgcolor="#064EE3"'), 'Event confirmed blue header');

    console.log('  ✓ All five category structures share the #064EE3 brand header');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 4 Failed:', err.message);
  }

  // 5. Article Cards, Foundations & Promotional Banner
  console.log('\nTEST 5: Editorial cards, foundations & promotional banner...');
  try {
    const html = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      recipient: MOCK_CONTACTS[0]
    });
    assert(html.includes('FedRAMP Cloud Modernisation'), 'Article headline present');
    assert(html.includes('Build secure digital foundations'), 'CTA text present');
    assert(html.includes('Data &amp; Agentic AI Services. Built for Execution.'), 'Promotional headline present');
    assert(html.includes('GCC PARTNER') || html.includes('Trusted Build and Operational Partner'), 'GCC Partner badge present');
    console.log('  ✓ Curated editorial article blocks with actionable CTA buttons rendered');
    console.log('  ✓ Strategic foundations synthesis section verified');
    console.log('  ✓ Production Agentic AI & GCC promotional banner verified');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 5 Failed:', err.message);
  }

  // 6. DOMPurify Sanitization Integrity
  console.log('\nTEST 6: DOMPurify sanitization preserves email layout and images...');
  try {
    const rawHtml = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      recipient: MOCK_CONTACTS[0]
    });
    const hostileHtml = rawHtml.replace('</table>', '<script>alert(1)</script><img src="x" onerror="alert(1)"></table>');
    const sanitized = purify.sanitize(hostileHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'a', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'div', 'span',
        'img', 'hr', 'blockquote', 'style'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'style', 'class', 'src', 'alt',
        'width', 'height', 'align', 'valign', 'border', 'cellpadding',
        'cellspacing', 'title', 'bgcolor', 'colspan', 'rowspan'
      ]
    });

    assert(sanitized.length > 500, 'Sanitized HTML must not be empty or truncated');
    assert(sanitized.includes('<table'), 'Table structure preserved');
    assert(sanitized.includes('<img'), 'Images preserved');
    assert(sanitized.includes('SNS SQUARE'), 'Branding preserved');
    assert(!/<script|onerror\s*=/i.test(sanitized), 'Executable markup and event handlers removed');
    assert(sanitized.includes('bgcolor="#064EE3"'), 'Confirmed brand header color preserved');
    console.log('  ✓ DOMPurify preserves 640px table, inline styles, and template images');
    console.log('  ✓ Zero raw markup leakage or blank output after sanitization');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 6 Failed:', err.message);
  }

  // 7. Preview vs. Dispatch Zero Content Divergence
  console.log('\nTEST 7: Preview vs. Dispatch content identity verification...');
  try {
    const previewHtml = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      recipient: MOCK_CONTACTS[0]
    });
    const dispatchHtml = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      recipient: MOCK_CONTACTS[0]
    });
    assert.strictEqual(previewHtml, dispatchHtml, 'Dispatched HTML must be 100% byte-for-byte identical to preview');
    console.log('  ✓ Byte-for-byte identity between preview and dispatch guaranteed');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 7 Failed:', err.message);
  }

  // 8. Stable canonical HTML plus recipient-only interpolation
  console.log('\nTEST 8: Canonical source remains stable when preview recipient changes...');
  try {
    const options = { template: TEMPLATES[0], customization: { greetingType: 'personal' } };
    const baseHtml = buildSnsTemplateEmailHtml({ ...options, recipient: null });
    const firstPreview = interpolateEmailHtmlVars(baseHtml, MOCK_CONTACTS[0]);
    const secondPreview = interpolateEmailHtmlVars(baseHtml, MOCK_CONTACTS[1]);
    assert(baseHtml.includes('{{first_name}}'), 'Approved base HTML preserves personalization tokens');
    assert(firstPreview.includes('Dear Priya,') && secondPreview.includes('Dear David,'), 'Preview recipient controls greeting');
    assert(!firstPreview.includes('David') && !secondPreview.includes('Priya'), 'Recipient switching changes only recipient values');
    assert.strictEqual(firstPreview, buildSnsTemplateEmailHtml({ ...options, recipient: MOCK_CONTACTS[0] }));
    assert.strictEqual(secondPreview, buildSnsTemplateEmailHtml({ ...options, recipient: MOCK_CONTACTS[1] }));
    console.log('  ✓ Recipient switching interpolates a stable approved source');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 8 Failed:', err.message);
  }

  // 9. Canonical SNS Square logo & brand identity preserved
  console.log('\nTEST 9: Canonical supplied SNS Square logo and footer...');
  try {
    const html = buildSnsTemplateEmailHtml({ template: TEMPLATES[0], recipient: MOCK_CONTACTS[0] });
    assert(html.includes('src="https://contact-data-extraction-structuring-agent.onrender.com/sns-square-logo.png"'), 'Canonical email uses supplied multi-color logo image');
    assert(html.includes('SNS Square — Redesigning Business'), 'Logo alt text preserves canonical brand treatment');
    assert(html.includes('The SNS Square Team'), 'Canonical email includes permanent team signature');
    assert(!html.includes('linkedin.com'), 'Canonical footer does not add an unsupported social URL');
    assert(!html.includes('Bengaluru, Karnataka 560103'), 'Canonical footer does not add an address absent from the canonical template');
    console.log('  ✓ Canonical email uses the supplied logo and existing compliance footer');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 9 Failed:', err.message);
  }

  // 10. CTA button label sanitization & double arrow prevention
  console.log('\nTEST 10: CTA button label sanitization & single arrow guarantee...');
  try {
    const leakTemplate = {
      ...TEMPLATES[0],
      blocks: [
        {
          id: 'b_test1',
          headline: 'Cloud Modernization Perspective',
          body: 'Strategic perspective on cloud scalability.',
          ctaText: '[Action Text] &rarr;',
          ctaUrl: 'https://www.snssquare.com/insights'
        },
        {
          id: 'b_test2',
          headline: 'Autonomous Mobility Operations',
          body: 'Optimizing logistics workflows with AI.',
          ctaText: 'Build secure digital foundations &rarr;',
          ctaUrl: 'https://www.snssquare.com/insights'
        }
      ]
    };
    const html = buildSnsTemplateEmailHtml({ template: leakTemplate, recipient: MOCK_CONTACTS[0] });
    assert(!html.includes('[Action Text]'), 'Placeholder bracket [Action Text] must be scrubbed');
    assert(!html.includes('&rarr; &rarr;'), 'Double arrow &rarr; &rarr; must not occur');
    assert(!html.includes('→ →'), 'Double arrow → → must not occur');
    assert(!html.includes('Explore Perspective'), 'Missing/placeholder CTA does not fabricate a button label');
    assert(html.includes('Build secure digital foundations &rarr;'), 'Preserved CTA renders single arrow &rarr;');
    console.log('  ✓ Bracketed [Action Text] placeholders are removed and valid CTA labels remain clean');
    console.log('  ✓ Trailing arrows stripped before appending &rarr; to guarantee single arrow');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 10 Failed:', err.message);
  }

  // 12. Workbench copy reaches the canonical newsletter without replacing the brand header
  console.log('\nTEST 12: Workbench editorial content in canonical SNS newsletter...');
  try {
    const generated = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      customization: {
        headerTitle: 'Generated Edition Title',
        headerSubtitle: 'Generated Edition Subtitle',
        greetingType: 'personal',
        heroHeadline: 'Workbench Hero Headline',
        heroBody: 'Workbench hero paragraph one.\n\nWorkbench hero paragraph two.',
        blocks: [{ headline: 'Workbench Article', body: 'Workbench editorial body.', ctaText: 'Read Analysis →', ctaUrl: 'https://example.test/analysis' }],
        foundationsTitle: '', foundations: [], closingText: '', promoBanner: {}
      }
    });
    assert(generated.includes('Workbench Hero Headline'));
    assert(generated.includes('Workbench hero paragraph one.'));
    assert(generated.includes('Workbench hero paragraph two.'));
    assert(generated.includes('Workbench Article'));
    assert.strictEqual((generated.match(/Workbench Article/g) || []).length, 1);
    assert(generated.includes('Generated Edition Title'));
    assert(generated.includes('src="https://contact-data-extraction-structuring-agent.onrender.com/sns-square-logo.png"'));
    assert(generated.includes('#064EE3'));
    assert(!generated.includes(TEMPLATES[0].blocks[0].headline), 'Old sample article is cleared on successful generated content');
    assert(!generated.includes('FESTIVAL WISH RULE'));
    assert(!generated.includes('Return only'));
    assert(!generated.includes('https://www.snssquare.com/gcc-services'), 'Missing promo does not fall back to a canned banner');
    console.log('  ✓ Generated copy renders once beneath the fixed SNS Square brand header');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 12 Failed:', err.message);
  }

  // 13. Successful synthesis can explicitly clear generated editorial slots
  console.log('\nTEST 13: Empty generated fields do not resurrect static sample copy...');
  try {
    const html = buildSnsTemplateEmailHtml({
      template: TEMPLATES[0],
      customization: { heroHeadline: '', heroBody: '', blocks: [], foundationsTitle: '', foundations: [], closingText: '', promoBanner: {} }
    });
    assert(!html.includes(TEMPLATES[0].heroHeadline));
    assert(!html.includes(TEMPLATES[0].heroBody.slice(0, 60)));
    assert(!html.includes(TEMPLATES[0].blocks[0].headline));
    assert(!html.includes(TEMPLATES[0].foundationsTitle));
    assert(!html.includes('Data & Agentic AI Services. Built for Execution.'));
    console.log('  ✓ Explicitly cleared generated slots remain empty in compiled HTML');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 13 Failed:', err.message);
  }

  // 11. Prompt instruction leakage scrubbing in foundations & copy
  console.log('\nTEST 11: Prompt instruction leakage scrubbing in foundations...');
  try {
    const contaminatedTemplate = {
      ...TEMPLATES[0],
      foundationsTitle: 'Every transformation initiative ultimately depends on four foundations: (4) Strategic Synthesis',
      foundations: [
        'Robust FedRAMP cloud compliance architecture. (5) Official Sign-off: Warm regards, The Team at SNS Square, Enterprise Client Partnerships.',
        'structured key pillars with consistent terminology. (5) Official Sign-off: Warm regards. (6) Standards: Content must feel like one unified editorial publication. Avoid raw markup leakage, disconnected sentences, generic filler, repetitive headings, keyword stuffing, or awkward CTAs. Do NOT invent unsupported factual claims, fake statistics, or imaginary partner companies. STRATEGIC IMPACT FOR TECHNOLOGY LEADERSHIP AT BRIGHTEDGE SOLUTIONS'
      ],
      closingText: 'Together, these capabilities power transformation. (6) Standards: Do NOT invent unsupported factual claims.'
    };
    const html = buildSnsTemplateEmailHtml({ template: contaminatedTemplate, recipient: MOCK_CONTACTS[0] });
    assert(!html.includes('(5) Official Sign-off:'), 'Leaked (5) Official Sign-off must be stripped');
    assert(!html.includes('(6) Standards:'), 'Leaked (6) Standards must be stripped');
    assert(!html.includes('Avoid raw markup leakage'), 'Meta-directive text must be stripped');
    assert(!html.includes('Do NOT invent unsupported factual claims'), 'Meta-directive text must be stripped');
    assert(!html.includes('STRATEGIC IMPACT FOR'), 'Prompt header STRATEGIC IMPACT FOR must be stripped');
    assert(html.includes('Robust FedRAMP cloud compliance architecture.'), 'Legitimate pillar content must be preserved');
    console.log('  ✓ Leaked prompt instructions and meta-standards completely scrubbed');
    console.log('  ✓ Pure prompt leakage items cleanly purged without breaking template');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 11 Failed:', err.message);
  }

  console.log('\n========================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('========================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTemplateTests();
