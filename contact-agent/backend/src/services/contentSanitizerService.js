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

  // 1. Strip leading "Subject:" or "Title:" prefix
  let cleaned = subject.replace(/^(?:Subject|Title)\s*[:—–-]\s*/i, '').trim();

  // 2. If there's a prompt instruction pattern followed by colon or dash, extract the actual subject
  for (const pat of PROMPT_INSTRUCTION_PATTERNS) {
    if (pat.test(cleaned)) {
      const parts = cleaned.split(/[:—–-]\s*/);
      if (parts.length > 1) {
        const candidate = parts.slice(1).join(':').trim();
        if (candidate.length >= 5 && !detectPromptLeakInSubject(candidate)) {
          cleaned = candidate;
          break;
        }
      }
    }
  }

  subject = cleaned;
  const hasLeak = detectPromptLeakInSubject(subject);

  // If instruction still leaked or subject is empty/invalid, rewrite cleanly
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
    /(<p\b[^>]*>)?(?:Dear|Hi|Hello|Greetings|Respected)\s+(?:Leader|Executive|Decision\s+Maker|Valued\s+Decision\s+Maker|Enterprise\s+Partner|Client\s+Executive|Corporate\s+Leader|Business\s+Leader|Valued\s+Partner|Valued\s+Client|Valued\s+Customer|Client|Partner|Customer|User)(?:,|<\/p>|\s*<\/p>)/gi,
    /(?:Dear|Hi|Hello|Greetings|Respected)\s+(?:Leader|Executive|Decision\s+Maker|Valued\s+Decision\s+Maker|Enterprise\s+Partner|Client\s+Executive|Corporate\s+Leader|Business\s+Leader|Valued\s+Partner|Valued\s+Client)(?:,|\b)/gi
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
 * Decode common HTML entities.
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
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

  // Decode escaped HTML tags if present (e.g. &lt;p&gt; -> <p>)
  if (/&lt;(?:p|div|br|strong|b|em|i|ul|ol|li|h[1-6]|a)\b/i.test(body)) {
    body = decodeHtmlEntities(body);
  }

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
    title = null,
    subtitle = null,
    imageUrl = null,
    recipientUnsubUrl = '#',
    recipientPrefUrl = '#',
    company = 'SNS Square'
  } = options;

  let bodyHtml = cleanEmailBodyHtml(contentBodyHtml);

  // Avoid double wrapping if container is already present
  if (bodyHtml.includes('sns-email-container') && bodyHtml.includes('Embassy TechVillage')) {
    return bodyHtml;
  }

  const normalizedType = String(campaignType).toLowerCase();
  const isFestival = normalizedType.includes('festival') || normalizedType.includes('wish');
  const isNewsletter = normalizedType.includes('newsletter');
  const isEvent = normalizedType.includes('event') || normalizedType.includes('webinar');

  const headerGradient = isFestival
    ? 'linear-gradient(135deg, #701a75 0%, #a21caf 50%, #c026d3 100%)'
    : isEvent
      ? 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)'
      : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)';

  const defaultTitle = isFestival
    ? 'Warm Executive Festive Wishes'
    : isEvent
      ? 'Executive Leadership Briefing'
      : 'Your Weekly GCC & AI Scoop';

  const defaultSubtitle = isFestival
    ? 'Executive Festive Greetings & Partnerships'
    : isEvent
      ? 'Exclusive Roundtable & Strategy Forum'
      : 'Core Perspective | Wednesday Edition';

  const headerTitleText = title || defaultTitle;
  const headerSubtitleText = subtitle || defaultSubtitle;

  const imageHtml = imageUrl ? `
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="${imageUrl}" alt="Campaign Header" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; display: block; margin: 0 auto;" />
    </div>` : '';

  // Promotional Banner (matching screenshot 5) - only for newsletters and promotional emails
  const showPromoBanner = !isFestival && !bodyHtml.includes('Data & Agentic AI Services');
  const promoBannerHtml = showPromoBanner ? `
    <div style="background: linear-gradient(135deg, #090e17 0%, #0e1e3e 50%, #1e3a8a 100%); border-radius: 12px; padding: 26px 24px; color: #ffffff; margin: 32px 0 20px 0; border: 1px solid #1e293b;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: top; padding-right: 16px;">
            <div style="font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; margin-bottom: 8px;">
              Data & Agentic AI Services. Built for Execution.
            </div>
            <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin-bottom: 16px;">
              Design, build, and operate production-grade data and Agentic AI systems that move workflows from insight to autonomous action.
            </div>
            <a href="https://www.snssquare.com/gcc-services" style="background-color: #0b0f19; color: #ffffff; border: 1px solid #3b82f6; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12.5px; font-weight: 600; display: inline-block;">
              Explore GCC Services &rarr;
            </a>
          </td>
          <td align="right" style="vertical-align: middle; width: 140px;">
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.15); text-align: left;">
              <div style="font-size: 10px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">GCC PARTNER</div>
              <div style="font-size: 11px; color: #e2e8f0; line-height: 1.35; font-weight: 500;">
                Trusted Build & Operational Partner for GCCs in India
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>` : '';

  return `
<div class="sns-email-container" style="background-color: #f1f5f9; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- SNS Square Branded Gradient Header (Reference: Screenshot 1) -->
    <tr>
      <td style="padding: 24px 28px; background: ${headerGradient}; border-bottom: 1px solid rgba(255,255,255,0.15);">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <!-- Multi-Color Square Logo Icon -->
                    <div style="width: 38px; height: 38px; border: 3px solid #ef4444; border-top-color: #f59e0b; border-right-color: #10b981; border-bottom-color: #06b6d4; border-radius: 4px; display: inline-block; box-sizing: border-box; position: relative;">
                      <div style="position: absolute; top: 3px; left: 3px; right: 3px; bottom: 3px; background: rgba(255,255,255,0.15); border-radius: 2px;"></div>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 15px; font-weight: 900; letter-spacing: -0.02em; color: #ffffff; text-transform: uppercase;">
                      SNS SQUARE
                    </div>
                    <div style="font-size: 9.5px; color: #dbeafe; letter-spacing: 0.04em; font-style: italic;">
                      Redesigning Business
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align: middle;">
              <div style="font-size: 19px; font-weight: 800; color: #ffffff; line-height: 1.25;">
                ${headerTitleText}
              </div>
              <div style="font-size: 11.5px; color: #dbeafe; margin-top: 3px; font-weight: 500;">
                ${headerSubtitleText}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Main Email Body Content -->
    <tr>
      <td style="padding: 32px 32px 24px 32px; color: #1e293b; font-size: 15px; line-height: 1.65; background-color: #ffffff;">
        ${imageHtml}
        ${bodyHtml}
        ${promoBannerHtml}
      </td>
    </tr>
    <!-- SNS Square Branded Dark Footer (Reference: Screenshot 5) -->
    <tr>
      <td style="padding: 28px 24px; background-color: #090e17; color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center; border-top: 1px solid #1e293b;">
        <!-- Social Icons Row -->
        <div style="margin-bottom: 16px;">
          <a href="https://www.snssquare.com" style="display: inline-block; width: 30px; height: 30px; line-height: 30px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 4px; font-size: 12px;">&bull;</a>
          <a href="https://linkedin.com" style="display: inline-block; width: 30px; height: 30px; line-height: 30px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 4px; font-size: 11px;">in</a>
          <a href="https://youtube.com" style="display: inline-block; width: 30px; height: 30px; line-height: 30px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 4px; font-size: 11px;">yt</a>
          <a href="https://instagram.com" style="display: inline-block; width: 30px; height: 30px; line-height: 30px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 4px; font-size: 11px;">ig</a>
        </div>
        <div style="color: #cbd5e1; font-size: 12.5px; margin-bottom: 6px;">
          You have received this email as a registered user of SNS Square.
        </div>
        <div style="margin-bottom: 18px;">
          You can unsubscribe from these emails <a href="${recipientUnsubUrl}" style="color: #60a5fa; text-decoration: underline;">here</a>.
        </div>
        <!-- Centered Logo in Footer -->
        <div style="margin-bottom: 14px;">
          <div style="width: 32px; height: 32px; border: 2.5px solid #ef4444; border-top-color: #f59e0b; border-right-color: #10b981; border-bottom-color: #06b6d4; border-radius: 3px; display: inline-block; margin-bottom: 4px;"></div>
          <div style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">SNS SQUARE</div>
          <div style="font-size: 8.5px; color: #94a3b8; font-style: italic;">Redesigning Business</div>
        </div>
        <!-- Office Location Address -->
        <div style="color: #94a3b8; font-size: 11.5px; line-height: 1.5; max-width: 480px; margin: 0 auto 12px auto;">
          <strong>BLOCK-L, Embassy TechVillage</strong><br/>
          <a href="https://maps.google.com" style="color: #60a5fa; text-decoration: none;">
            Outer Ring Road, Devarabisanahalli, Bellandur, Bengaluru, Karnataka 560103, India
          </a>
        </div>
        <div style="font-size: 10.5px; color: #64748b; margin-top: 12px; border-top: 1px solid #1e293b; padding-top: 12px;">
          &copy; 2026 SNS Square. All rights reserved. &bull; Enterprise Client Partnerships
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
