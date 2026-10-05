'use strict';

/**
 * Content Sanitizer & Brand Consistency Service
 * 
 * Guarantees:
 *  1. AI instructions and prompt rules NEVER leak into subject lines.
 *  2. No generic or fabricated greetings ("Dear Leader", "Dear Executive").
 *  3. Standard SNS Square email template branding consistently applied.
 *  4. HTML email content cleanly formatted and sanitized.
 */

// Patterns indicating prompt / instruction leaks in subject lines
const PROMPT_INSTRUCTION_PATTERNS = [
  /^(?:generate|write|create|craft|compose|draft|send|build|produce)\s+(?:a|an|the|warm|concise|professional|culturally)\b/i,
  /^(?:please\s+)?(?:generate|write|create|draft|compose)\b/i,
  /^(?:this\s+is\s+a|campaign\s+rules?|instructions?|prompt|brief)\s*[:—–-]/i,
  /\b(?:do\s+not\s+include|keep\s+it\s+under|keep\s+under|avoid\s+product|culturally\s+appropriate|not\s+a\s+newsletter)\b/i,
  /^(?:system\s+instructions?|developer\s+input)\s*[:—–-]/i,
  /\b(?:under\s+\d+\s+words|concise\s+greeting|warm\s+greeting|festival\s+rules?)\b/i
];

/**
 * Detects if a subject line contains leaked prompt/developer instructions.
 * 
 * @param {string} subject
 * @returns {boolean}
 */
function detectPromptLeakInSubject(subject) {
  if (!subject || typeof subject !== 'string') return false;
  const s = subject.trim();
  return PROMPT_INSTRUCTION_PATTERNS.some(pattern => pattern.test(s));
}

/**
 * Validates, cleans, and sanitizes subject line.
 * If instructions leaked, rewrites to a clean, professional enterprise subject line.
 * 
 * @param {string} rawSubject
 * @param {Object} options - { campaignType, occasion, company, name, topic }
 * @returns {string} - Clean, client-facing email subject
 */
function sanitizeAndValidateSubject(rawSubject, options = {}) {
  let subject = String(rawSubject || '').trim();
  const {
    campaignType = 'newsletter',
    occasion = '',
    company = '',
    name = '',
    topic = ''
  } = options;

  const normalizedType = String(campaignType || 'newsletter').toLowerCase();
  const isFestival = normalizedType.includes('festival') || normalizedType.includes('wish');
  const isWelcome = normalizedType.includes('welcome');
  const isPromotional = normalizedType.includes('promotional') || normalizedType.includes('update');

  // Strip newsletter branding if this is a festival greeting or welcome message
  if (isFestival || isWelcome) {
    subject = subject.replace(/\s*\|\s*SNS\s+Square\s+Weekly\s+GCC\s+&\s+AI\s+Scoop\b/gi, '').trim();
  }

  const hasLeak = detectPromptLeakInSubject(subject);

  // If instruction leaked or subject is empty/invalid, rewrite cleanly
  if (hasLeak || !subject || subject.length < 6) {
    if (isFestival) {
      const occName = occasion ? occasion.replace(/\s*\d{4}\b/, '').trim() : 'Festive';
      subject = company
        ? `Warm ${occName} Wishes to ${company} from SNS Square`
        : `Warm ${occName} Wishes from SNS Square`;
    } else if (isWelcome) {
      subject = company
        ? `Welcome to SNS Square — Partnership Orientation for ${company}`
        : `Welcome to SNS Square Executive Client Partnership`;
    } else if (isPromotional) {
      subject = `SNS Square Strategic Capabilities Update: Enterprise AI & Cloud Innovation`;
    } else {
      // Newsletter
      let cleanTopic = (topic || '').trim();
      PROMPT_INSTRUCTION_PATTERNS.forEach(pat => {
        cleanTopic = cleanTopic.replace(pat, '').trim();
      });
      cleanTopic = cleanTopic.replace(/^[:—–-\s]+/, '').slice(0, 50).trim();
      subject = cleanTopic
        ? `${cleanTopic} | SNS Square Weekly GCC & AI Scoop`
        : `Enterprise AI & Cloud Transformation | SNS Square Weekly GCC & AI Scoop`;
    }
  }

  // Final cleanup of quotes or trailing brackets
  subject = subject
    .replace(/^["'`“‘\s]+|["'`”’\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return subject;
}

/**
 * Sanitizes greeting in email body to prevent fabricated titles like:
 * "Dear Leader", "Dear Executive", "Dear Enterprise Partner", "Dear Client Executive".
 * 
 * Rules:
 *  - If recipient first name exists -> "Dear <First Name>,"
 *  - If recipient name exists -> "Dear <Name>,"
 *  - If no name -> "Hello,"
 * 
 * @param {string} rawBody
 * @param {Object} recipient - { name, first_name }
 * @returns {string} - Cleaned email body
 */
function sanitizeAndPersonalizeGreeting(rawBody, recipient) {
  let body = String(rawBody || '');
  const fullName = recipient?.name || '';
  const firstName = recipient?.first_name || (fullName.split(' ')[0] || '').trim();
  const cleanGreeting = firstName ? `Dear ${firstName},` : 'Hello,';

  // Replace fake generic titles in greetings
  const fakeTitlePatterns = [
    /(<p\b[^>]*>)?(?:Dear|Hi|Hello|Greetings)\s+(?:Leader|Executive|Enterprise\s+Partner|Client\s+Executive|Valued\s+Partner|Valued\s+Client|Valued\s+Customer|Client|Partner|Customer|User)(?:,|<\/p>|\s*<\/p>)/gi,
    /(?:Dear|Hi|Hello|Greetings)\s+(?:Leader|Executive|Enterprise\s+Partner|Client\s+Executive|Valued\s+Partner|Valued\s+Client)(?:,|\b)/gi
  ];

  for (const pattern of fakeTitlePatterns) {
    body = body.replace(pattern, (match, prefix) => {
      return prefix ? `${prefix}${cleanGreeting}` : cleanGreeting;
    });
  }

  // Ensure first paragraph greeting uses the recipient name if available
  body = body.replace(/(<p\b[^>]*>)?(?:Dear|Hi|Hello|Greetings)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:,|<\/p>)/i, (match, prefix, fn, ln) => {
    if (firstName && fn !== firstName) {
      return `${prefix || ''}Dear ${firstName},`;
    }
    return match;
  });

  return body;
}

/**
 * Formats raw plain text or HTML body into clean HTML paragraphs.
 * 
 * @param {string} content
 * @returns {string} - Formatted HTML
 */
function cleanEmailBodyHtml(content) {
  let body = String(content || '').trim();
  if (!body) return '';

  // If already rich HTML with tags, return with paragraph spacing normalized
  if (/<(?:p|div|table|h[1-6]|ul|ol)\b/i.test(body)) {
    return body;
  }

  // Convert double newlines to paragraphs
  const paragraphs = body.split(/\n\n+/);
  return paragraphs
    .map(p => {
      const clean = p.trim().replace(/\n/g, '<br/>');
      return clean ? `<p style="margin: 0 0 16px 0; line-height: 1.65; color: #334155; font-size: 15px;">${clean}</p>` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Standard SNS Square Email Wrapper
 * Wraps campaign body with official enterprise branding, header, footer,
 * and compliance unsubscribe & preference links.
 * 
 * @param {string} contentBodyHtml
 * @param {Object} options
 * @returns {string} - Full HTML email
 */
function wrapInSnsSquareTemplate(contentBodyHtml, options = {}) {
  const {
    campaignType = 'newsletter',
    imageUrl = null,
    recipientUnsubUrl = '#',
    recipientPrefUrl = '#',
    company = 'SNS Square'
  } = options;

  let bodyHtml = cleanEmailBodyHtml(contentBodyHtml);

  // Avoid double wrapping if container is already present
  if (bodyHtml.includes('sns-email-container') || bodyHtml.includes('Embassy TechVillage')) {
    return bodyHtml;
  }

  const normalizedType = String(campaignType).toLowerCase();
  const isFestival = normalizedType.includes('festival') || normalizedType.includes('wish');

  const headerAccent = isFestival ? '#a21caf' : '#2563eb';
  const headerSubtitle = isFestival
    ? 'Executive Festive Greetings & Partnerships'
    : 'Enterprise Client Intelligence & Strategic Advisory';

  const imageHtml = imageUrl ? `
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${imageUrl}" alt="Campaign Header" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin: 0 auto;" />
    </div>` : '';

  return `
<div class="sns-email-container" style="background-color: #f8fafc; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Standard SNS Header -->
    <tr>
      <td style="padding: 24px 28px 20px 28px; background-color: #ffffff; border-bottom: 2px solid ${headerAccent};">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <div style="font-size: 17px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a;">
                SNS SQUARE <span style="font-size: 11px; font-weight: 700; color: ${headerAccent}; text-transform: uppercase; margin-left: 6px; padding: 2px 6px; background-color: #f1f5f9; border-radius: 4px;">GCC & AI</span>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
                ${headerSubtitle}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Email Content Body -->
    <tr>
      <td style="padding: 28px 28px 24px 28px; color: #1e293b; font-size: 15px; line-height: 1.65;">
        ${imageHtml}
        ${bodyHtml}
      </td>
    </tr>
    <!-- Standard SNS Footer & Compliance -->
    <tr>
      <td style="padding: 22px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6; text-align: center;">
        <div style="font-weight: 600; color: #334155; margin-bottom: 4px;">
          SNS Square Enterprise Client Partnerships
        </div>
        <div style="color: #94a3b8; font-size: 11px; margin-bottom: 12px;">
          BLOCK-L, Embassy TechVillage, Outer Ring Road, Devarabisanahalli, Bellandur, Bengaluru, Karnataka 560103, India
        </div>
        <div>
          <a href="${recipientUnsubUrl}" style="color: #2563eb; text-decoration: underline; margin-right: 12px;">Unsubscribe</a> &bull;
          <a href="${recipientPrefUrl}" style="color: #64748b; text-decoration: underline; margin-left: 12px;">Manage Preferences</a>
        </div>
        <div style="font-size: 10.5px; color: #94a3b8; margin-top: 8px;">
          &copy; 2026 SNS Square. All rights reserved. Confirmed opt-in recipient.
        </div>
      </td>
    </tr>
  </table>
</div>`.trim();
}

module.exports = {
  detectPromptLeakInSubject,
  sanitizeAndValidateSubject,
  sanitizeAndPersonalizeGreeting,
  cleanEmailBodyHtml,
  wrapInSnsSquareTemplate
};
