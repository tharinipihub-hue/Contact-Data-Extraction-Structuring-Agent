'use strict';

/**
 * AI Product Review Service
 *
 * Purpose: Evaluate the Digital Client Nurturing Agent's overall capabilities,
 * workflow design, and UX — generating structured improvement recommendations.
 *
 * This is a RECOMMENDATION engine only.
 * It does NOT automatically modify production code.
 * All recommendations are surfaced to the user for manual approval.
 *
 * Review areas:
 *  - Campaign workflow
 *  - User experience
 *  - Campaign creation flow
 *  - Personalization
 *  - Audience selection
 *  - Contact enrichment
 *  - Templates
 *  - AI generation
 *  - Dispatch flow
 *  - Engagement tracking
 *  - Error handling
 *  - Compliance
 *  - Regional personalization
 *  - Newsletter generation
 */

const nurtureStore = require('./nurtureStore');

/**
 * Analyze the current system state and generate structured review.
 */
function runProductReview() {
  const reviewedAt = new Date().toISOString();
  const contacts = nurtureStore.getContacts();
  const campaigns = nurtureStore.getCampaigns();
  const auditLogs = nurtureStore.getAuditLogs();

  // ── Data analysis ──────────────────────────────────────────────────────────
  const optedIn = contacts.filter(c => c.opt_in === true);
  const optedOut = contacts.filter(c => c.opt_in === false);
  const contactsWithIndustry = contacts.filter(c => c.industry || c.sector);
  const contactsWithCountry = contacts.filter(c => c.country || c.location);
  const contactsWithEmail = contacts.filter(c => c.email && c.email.includes('@'));
  const sentCampaigns = campaigns.filter(c => c.status === 'Sent');
  const draftCampaigns = campaigns.filter(c => c.status === 'Draft');
  const newsletterCampaigns = campaigns.filter(c => (c.type || '').toLowerCase().includes('newsletter'));
  const festivalCampaigns = campaigns.filter(c => (c.type || '').toLowerCase().includes('festival') || (c.type || '').toLowerCase().includes('wish'));

  // ── Section: Strengths ────────────────────────────────────────────────────
  const strengths = [
    {
      area: 'SNS Workbench Integration',
      description: 'Campaign generation and dispatch are fully integrated with SNS Square Agent Workbench webhook. AI content generation is strictly dependent on Workbench — no local fallback content.',
      evidence: `Workbench-generated campaigns: ${sentCampaigns.filter(c => c.content_source === 'workbench').length}`
    },
    {
      area: 'Contact Consent Management',
      description: 'Opt-in / opt-out consent is enforced at both generation and dispatch stages. Opted-out contacts cannot receive campaigns.',
      evidence: `Opted-in contacts: ${optedIn.length}, Opted-out: ${optedOut.length}`
    },
    {
      area: 'Google Sheets Integration',
      description: 'Past clients are synchronized from a dedicated Google Sheet (separate from the lead extraction sheet). Contact data refreshes automatically.',
      evidence: `Total contacts: ${contacts.length}`
    },
    {
      area: 'Campaign Persistence',
      description: 'Campaign history is persisted to disk (Render persistent volume) and survives service restarts.',
      evidence: `Total campaigns stored: ${campaigns.length}`
    },
    {
      area: 'Unsubscribe & Preference Center',
      description: 'Self-service unsubscribe and preference management are deployed with production URLs. One-click unsubscribe is operational.',
      evidence: 'Deployed at /unsubscribe and /preferences'
    },
    {
      area: 'Campaign Types',
      description: 'Multiple campaign types are supported: Newsletter, Welcome Message, Festival Greeting, Promotional/Strategic Update.',
      evidence: `Campaign breakdown — Newsletters: ${newsletterCampaigns.length}, Festival: ${festivalCampaigns.length}`
    }
  ];

  // ── Section: Issues ────────────────────────────────────────────────────────
  const issues = [];

  // Contact data completeness
  const missingIndustry = contacts.length - contactsWithIndustry.length;
  if (missingIndustry > 0) {
    issues.push({
      severity: 'medium',
      area: 'Contact Data Completeness',
      issue: `${missingIndustry} contacts are missing industry/sector data.`,
      impact: 'Industry-specific newsletter generation will be less targeted without sector data.',
      fix: 'Enrich missing contact industry data via manual update or AI enrichment.'
    });
  }

  const missingCountry = contacts.length - contactsWithCountry.length;
  if (missingCountry > 0) {
    issues.push({
      severity: 'medium',
      area: 'Regional Personalization',
      issue: `${missingCountry} contacts are missing country/location data.`,
      impact: 'Occasion-based campaigns cannot be regionally targeted without location data.',
      fix: 'Add country field to Google Sheets data source or manually update contact records.'
    });
  }

  const missingEmail = contacts.length - contactsWithEmail.length;
  if (missingEmail > 0) {
    issues.push({
      severity: 'high',
      area: 'Contact Email Coverage',
      issue: `${missingEmail} contacts are missing email addresses.`,
      impact: 'These contacts cannot receive email campaigns.',
      fix: 'Ensure all contacts in the Google Sheets source have valid email addresses.'
    });
  }

  if (draftCampaigns.length > 5) {
    issues.push({
      severity: 'low',
      area: 'Draft Management',
      issue: `${draftCampaigns.length} campaigns are in Draft status — may indicate abandoned campaigns.`,
      impact: 'Accumulated drafts add clutter to campaign management.',
      fix: 'Review and either dispatch or delete old draft campaigns.'
    });
  }

  // ── Section: Missing Capabilities ─────────────────────────────────────────
  const missing_capabilities = [
    {
      priority: 'high',
      area: 'Industry-Specific Newsletter Enhancement',
      description: 'Newsletter content is not yet dynamically enriched with verified industry-specific news or research. Generic newsletter templates are used when web search is unavailable.',
      recommendation: 'Integrate Tavily API for verified industry context. Pass researched_context to Workbench payload for industry-tailored content generation.',
      effort: 'medium',
      depends_on: 'TAVILY_API_KEY environment variable'
    },
    {
      priority: 'high',
      area: 'Calendar-Based Occasion Automation',
      description: 'The system can generate festival campaigns but requires manual selection of every occasion. There is no automated "occasion approaching" alert or trigger.',
      recommendation: 'Use the built-in Occasion Calendar Service to surface upcoming occasions and prompt the user to generate timely campaign content.',
      effort: 'low'
    },
    {
      priority: 'medium',
      area: 'Engagement Analytics',
      description: 'Engagement data (opens, clicks, replies) is only recorded when Workbench returns metrics. No independent tracking pixel or click analytics is implemented.',
      recommendation: 'Implement server-side email open tracking or integrate with an email service provider that provides delivery analytics.',
      effort: 'high'
    },
    {
      priority: 'medium',
      area: 'Campaign A/B Testing',
      description: 'Currently only one version of a campaign is generated. There is no capability to test multiple subject lines or content variants.',
      recommendation: 'Add A/B variant generation — send two Workbench requests with different prompts and let the user select the preferred version.',
      effort: 'medium'
    },
    {
      priority: 'medium',
      area: 'Scheduled Campaign Delivery',
      description: 'Scheduled campaigns are marked as "Scheduled" but no background scheduler actually triggers dispatch at the configured time.',
      recommendation: 'Implement a node-cron or Render cron job to dispatch campaigns at their scheduled time.',
      effort: 'medium'
    },
    {
      priority: 'low',
      area: 'Campaign Template Customization',
      description: 'The default SNS Square email template is defined in the Workbench prompt. Users cannot visually customize the template structure from the UI.',
      recommendation: 'Add a template builder or allow users to select from 2-3 layout variants that are passed as template_variant to Workbench.',
      effort: 'medium'
    },
    {
      priority: 'low',
      area: 'WhatsApp Delivery Tracking',
      description: 'WhatsApp messages are included in the campaign payload but delivery is handled entirely by Workbench. No delivery confirmation is shown per-contact.',
      recommendation: 'Request WhatsApp delivery confirmation from Workbench and display per-recipient status in the Engagement view.',
      effort: 'high'
    },
    {
      priority: 'low',
      area: 'Contact Import from CRM',
      description: 'Contacts are sourced from Google Sheets only. No direct CRM integration (e.g., Zoho, HubSpot, Salesforce) is configured.',
      recommendation: 'Add a CRM sync adapter as an optional data source alongside Google Sheets.',
      effort: 'high'
    }
  ];

  // ── Section: Recommended Improvements ────────────────────────────────────
  const recommended_improvements = [
    {
      priority: 'HIGH',
      area: 'Workbench Prompt Enhancement for Industry Newsletters',
      description: 'Pass verified industry research context (from Tavily) to Workbench so newsletters are factually grounded in real industry developments rather than generic AI content.',
      action: 'Add researched_context and newsletter_context fields to the generate payload.',
      status: 'Ready to implement — TAVILY_API_KEY required'
    },
    {
      priority: 'HIGH',
      area: 'Automated Occasion Reminders',
      description: 'Show a dashboard alert when a relevant occasion is within 14 days for a contact\'s confirmed region.',
      action: 'Use the Occasion Calendar Service to surface upcoming occasions on the Executive Dashboard.',
      status: 'Service implemented — UI integration required'
    },
    {
      priority: 'MEDIUM',
      area: 'Contact Region Completeness',
      description: `${missingCountry} contacts are missing country/location fields. Add a data quality indicator and prompt users to complete missing fields.`,
      action: 'Add country/state fields to the Google Sheets source and contact import flow.',
      status: 'Data governance improvement required'
    },
    {
      priority: 'MEDIUM',
      area: 'Preview = Dispatch Content Guarantee',
      description: 'Ensure that the exact subject and email_body from the preview are what gets dispatched — no re-generation on dispatch. The current implementation passes content directly but this should be explicitly verified.',
      action: 'Add a content hash comparison between preview and dispatch payload to detect any content drift.',
      status: 'Implementation validation recommended'
    },
    {
      priority: 'LOW',
      area: 'Engagement Scoring',
      description: 'Create a client engagement score based on campaign history (received, opened, clicked, replied) to prioritize high-engagement contacts for future campaigns.',
      action: 'Calculate and display an engagement health score in the Client Directory view.',
      status: 'Data available — scoring logic required'
    }
  ];

  // ── Overall assessment ─────────────────────────────────────────────────────
  const highIssues = issues.filter(i => i.severity === 'high').length;
  const mediumIssues = issues.filter(i => i.severity === 'medium').length;
  const overallHealth = highIssues > 2 ? 'needs_attention' : highIssues > 0 ? 'good_with_gaps' : 'good';

  return {
    review_id: `REVIEW-${Date.now()}`,
    reviewed_at: reviewedAt,
    system_snapshot: {
      total_contacts: contacts.length,
      opted_in_contacts: optedIn.length,
      opted_out_contacts: optedOut.length,
      contacts_with_industry: contactsWithIndustry.length,
      contacts_with_location: contactsWithCountry.length,
      total_campaigns: campaigns.length,
      sent_campaigns: sentCampaigns.length,
      draft_campaigns: draftCampaigns.length
    },
    overall_health: overallHealth,
    health_label: overallHealth === 'good' ? 'System is working well.' : overallHealth === 'good_with_gaps' ? 'System is functional with improvement areas.' : 'System requires attention.',
    strengths,
    issues,
    missing_capabilities,
    recommended_improvements,
    priority_summary: {
      high: missing_capabilities.filter(m => m.priority === 'high').length + recommended_improvements.filter(r => r.priority === 'HIGH').length,
      medium: missing_capabilities.filter(m => m.priority === 'medium').length + recommended_improvements.filter(r => r.priority === 'MEDIUM').length,
      low: missing_capabilities.filter(m => m.priority === 'low').length + recommended_improvements.filter(r => r.priority === 'LOW').length
    },
    disclaimer: 'This is a recommendation report only. No code changes are made automatically. All improvements require explicit user approval and developer implementation.'
  };
}

module.exports = { runProductReview };
