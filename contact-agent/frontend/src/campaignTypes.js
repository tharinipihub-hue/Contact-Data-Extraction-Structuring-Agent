/**
 * Canonical Digital Client Nurturing Campaign Type Registry
 * --------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for campaign types across the application.
 *
 * The frontend imports this module directly. The backend loads the exact
 * same file through backend/src/services/campaignTypeRegistry.js, which
 * uses the same `new Function` shim technique already used by
 * backend/src/services/templateEmailBuilderCanonical.js. There is therefore
 * exactly one implementation, not two copies that can drift.
 *
 * The SNS Workbench workflow (client_nurturing_workbench_workflow.json)
 * owns ONE content-generation LLM node. Campaign type selects the
 * instruction set inside the Campaign Prompt Builder code node; it never
 * selects a different LLM node.
 *
 * `null` / empty values must never be replaced with invented content.
 */

export const CANONICAL_CAMPAIGN_TYPES = [
  'newsletter',
  'festival_wish',
  'promotional',
  'follow_up',
  'event_invitation',
  'announcement'
];

/**
 * UI display label -> canonical workflow key.
 * These are the exact labels rendered by the Campaign Wizard. Labels are
 * mapped to canonical keys before any Workbench request is built; display
 * labels are never sent to SNS Workbench verbatim.
 */
export const CAMPAIGN_TYPE_LABELS = {
  'newsletter': 'Newsletter',
  'festival_wish': 'Festival / Occasion Wish',
  'promotional': 'Promotional / Strategic Update',
  'follow_up': 'Follow-up',
  'event_invitation': 'Event Invitation',
  'announcement': 'Announcement'
};

/**
 * Every accepted input alias -> canonical workflow key.
 *
 * Covers:
 *  - canonical keys themselves
 *  - the canonical keys written with dashes or spaces
 *  - the exact UI labels from CAMPAIGN_TYPE_LABELS
 *  - legacy values the application already sent before the registry existed
 *    (`welcome`, `content`, `case_study`) so existing clients keep working
 *
 * "welcome" is an onboarding/introduductory message. The Workbench supports
 * no dedicated welcome node, so it maps explicitly to `promotional`, which is
 * the type that carries SNS Square capability/offer content. It is mapped
 * deliberately rather than silently dropped.
 */
export const CAMPAIGN_TYPE_ALIASES = {
  'newsletter': 'newsletter',
  'news_letter': 'newsletter',
  'newsletter_campaign': 'newsletter',

  'festival_wish': 'festival_wish',
  'festival': 'festival_wish',
  'occasion_wish': 'festival_wish',
  'festival_/_occasion_wish': 'festival_wish',
  'festival_occasion_wish': 'festival_wish',

  'promotional': 'promotional',
  'promotion': 'promotional',
  'promo': 'promotional',
  'promotional_/_strategic_update': 'promotional',
  'promotional_strategic_update': 'promotional',
  'strategic_update': 'promotional',

  'follow_up': 'follow_up',
  'followup': 'follow_up',
  'follow_up_message': 'follow_up',

  'event_invitation': 'event_invitation',
  'event': 'event_invitation',
  'event_invite': 'event_invitation',
  'invitation': 'event_invitation',

  'announcement': 'announcement',
  'announcements': 'announcement',
  'announce': 'announcement',

  // Legacy application values, mapped explicitly.
  'welcome': 'promotional',
  'welcome_message': 'promotional',
  'content': 'newsletter',
  'case_study': 'newsletter'
};

/**
 * Build the lookup key for an arbitrary input value.
 * Lower-cases, trims, and normalizes separators to underscores so that
 * "Festival / Occasion Wish" and "festival_wish" resolve identically.
 */
function aliasKey(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolve any label/key/alias to a canonical campaign type.
 * @returns {string} one of CANONICAL_CAMPAIGN_TYPES, or '' when unsupported.
 */
export function normalizeCampaignType(value) {
  const key = aliasKey(value);
  if (!key) return '';
  return CAMPAIGN_TYPE_ALIASES[key] || '';
}

export function isSupportedCampaignType(value) {
  return CANONICAL_CAMPAIGN_TYPES.indexOf(normalizeCampaignType(value)) !== -1;
}

export function campaignTypeLabel(value) {
  const canonical = normalizeCampaignType(value);
  return canonical ? CAMPAIGN_TYPE_LABELS[canonical] : '';
}

/**
 * Ordered options for the Campaign Wizard UI.
 * @returns {Array<{key: string, label: string, description: string}>}
 */
export function campaignTypeOptions() {
  return CANONICAL_CAMPAIGN_TYPES.map((key) => ({
    key,
    label: CAMPAIGN_TYPE_LABELS[key],
    description: CAMPAIGN_TYPE_DESCRIPTIONS[key]
  }));
}

export const CAMPAIGN_TYPE_DESCRIPTIONS = {
  'newsletter':
    'Executive editorial briefing with subject, headline, body sections and a closing. CTA only when a supported URL is supplied.',
  'festival_wish':
    'Occasion greeting: a warm wish and short personalized message. No business claims, no statistics, no article structure.',
  'promotional':
    'Offer or capability content built only from supplied information. No invented discounts, prices, dates or offers.',
  'follow_up':
    'Follow-up referencing only the supplied previous interaction or context. No invented conversations or meetings.',
  'event_invitation':
    'Invitation using only the supplied event name, date, time, location and registration URL. Missing details are omitted.',
  'announcement':
    'Announcement communicating only the supplied announcement fact. Nothing else is added.'
};