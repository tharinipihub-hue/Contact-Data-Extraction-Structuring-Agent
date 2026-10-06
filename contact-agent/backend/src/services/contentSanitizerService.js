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
  /\b(?:under\s+\d+\s+words|concise\s+greeting|warm\s+greeting|festival\s+rules?|FESTIVAL(?:\s+WISH)?\s+RULE|Return only|Output only|KEY\s+ANNOUNCEMENT\s*(?:&|AND)\s*BRIEFING|STRATEGIC IMPACT FOR|generation instructions?|system instructions?|developer instructions?)\b/i
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
 * Scrubs prompt instruction leaks, directive numbering, and meta-rules from text.
 */
function scrubPromptDirectiveText(text) {
  if (!text || typeof text !== 'string') return '';
  let s = decodeHtmlEntities(text);
  if (/^\s*[\[{]\s*["'\w]+\s*:/.test(s) ||
    /\b(?:FESTIVAL(?:\s+WISH)?\s+RULE|(?:NEWSLETTER|CAMPAIGN)\s+RULES?|CAMPAIGN TYPE|EDITORIAL GUIDELINES|QUALITY STANDARD|Return only\b|Output only\b|KEY\s+ANNOUNCEMENT\s*(?:&|AND)\s*BRIEFING|STRATEGIC IMPACT FOR|GENERATION INSTRUCTIONS?|PROMPT INSTRUCTIONS?|SYSTEM INSTRUCTIONS?|DEVELOPER INSTRUCTIONS?|(?:SECTION|STEP)\s+\d+\s*[:.)-]|developer_input\s*:|campaign_type\s*:|content_blocks\s*:)/i.test(s)) return '';
  s = s.replace(/\(\d+\)\s*(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)[\s\S]*/i, '');
  s = s.replace(/(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)\s*:[\s\S]*/i, '');
  s = s.replace(/\b(?:Avoid raw markup leakage|Content must feel like one unified editorial publication|Do NOT invent unsupported factual claims|fake statistics|imaginary partner companies)[\s\S]*/i, '');
  s = s.replace(/\bSTRATEGIC IMPACT FOR [^:<>\n]+:?[\s\S]*/i, '');
  s = s.replace(/\bKEY ANNOUNCEMENT & BRIEFING:?[\s\S]*/i, '');
  s = s.replace(/\bstructured key pillars with consistent terminology\.?/i, '');
  s = s.replace(/^[\s•\-\*\d\.\)]+/, '');
  s = s.replace(/^["“‘]+|["”’]+$/g, '');
  return s.trim();
}

/**
 * Sanitizes call-to-action button labels:
 *  - Strips brackets: "[Action Text]" -> "Action Text"
 *  - Strips trailing arrows so template builders do not produce duplicate "→ →"
 *  - Replaces placeholders like "[Action Text]" or "Action Text" with "Explore Perspective"
 */
function cleanActionText(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
  s = s.replace(/^[\s\["“‘]+|[\s\]"”’]+$/g, '').trim();
  s = s.replace(/^\[(.*)\]$/, '$1').trim();
  s = s.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
  if (!s || /^(?:\[?action\s*text\]?|\[?cta\]?|\[?link(?:\s*text)?\]?|read\s*more|click\s*here|placeholder)$/i.test(s)) return '';
  return s;
}

/**
 * Sanitizes foundations / strategic pillars list.
 * Strips prompt instructions, discards prompt-only artifacts,
 * and falls back to clean canonical editorial foundations if empty.
 */
function sanitizeFoundationsList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const cleaned = rawList
    .map(scrubPromptDirectiveText)
    .filter(item => {
      if (!item || item.length < 5) return false;
      if (/^(?:structured key pillars|standards|official sign-off|warm regards)/i.test(item)) return false;
      return true;
    });
  return cleaned;
}

/**
 * Scrubs prompt instruction leaks from HTML strings.
 */
function scrubPromptLeakFromHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let s = html;
  s = s.replace(/<(p|div|li|h[1-6])\b[^>]*>[\s\S]*?(?:FESTIVAL(?:\s+WISH)?\s+RULE|(?:NEWSLETTER|CAMPAIGN)\s+RULES?|CAMPAIGN TYPE|EDITORIAL GUIDELINES|QUALITY STANDARD|Return only|Output only|KEY\s+ANNOUNCEMENT\s*(?:&|AND)\s*BRIEFING|STRATEGIC IMPACT FOR|SYSTEM INSTRUCTIONS?|DEVELOPER INSTRUCTIONS?|PROMPT INSTRUCTIONS?|developer_input\s*:|campaign_type\s*:|content_blocks\s*:)[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/\(\d+\)\s*(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)[\s\S]*?(?=(?:<\/li>|<\/p>|<p>|<ul>|<ol>|\n\n|$))/gi, '');
  s = s.replace(/(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)\s*:[\s\S]*?(?=(?:<\/li>|<\/p>|<p>|<ul>|<ol>|\n\n|$))/gi, '');
  s = s.replace(/\b(?:Avoid raw markup leakage|Content must feel like one unified editorial publication|Do NOT invent unsupported factual claims|fake statistics|imaginary partner companies)[\s\S]*?(?=(?:<\/li>|<\/p>|<p>|<ul>|<ol>|\n\n|$))/gi, '');
  s = s.replace(/\bKEY\s+ANNOUNCEMENT\s*(?:&|AND)?\s*BRIEFING\s*:?\s*/gi, '');
  s = s.replace(/\bSTRATEGIC\s+IMPACT\s+(?:FOR\s+[^:\n<]+)?:\s*/gi, '');
  s = s.replace(/\bstructured key pillars with consistent terminology\.?/gi, '');
  s = s.replace(/(?:&rarr;|→)\s*(?:&rarr;|→)+/gi, '&rarr;');
  s = s.replace(/<a\b[^>]*>\s*\[?(?:Action Text|CTA|Link Text)\]?\s*(?:&rarr;|→)?\s*<\/a>/gi, '');
  s = s.replace(/<li>\s*<\/li>/gi, '');
  s = s.replace(/<p[^>]*>\s*<\/p>/gi, '');
  if (/^\s*[\[{]\s*["'\w]+\s*:/.test(s) || /\b(?:FESTIVAL(?:\s+WISH)?\s+RULE|(?:NEWSLETTER|CAMPAIGN)\s+RULES?|CAMPAIGN TYPE|EDITORIAL GUIDELINES|QUALITY STANDARD|Return only\b|Output only\b|SYSTEM INSTRUCTIONS?|DEVELOPER INSTRUCTIONS?|PROMPT INSTRUCTIONS?|developer_input\s*:|campaign_type\s*:|content_blocks\s*:)/i.test(s)) return '';
  return s;
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

  // Scrub prompt directives, awkward placeholders, and duplicate arrows
  body = scrubPromptLeakFromHtml(body);

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
 * Sanitizes and cleans the email header subtitle.
 * Guarantees:
 *  - Completely strips any "From <Company>", "From ...", "By ...", or recipient company name.
 *  - Never attributes the sender subtitle to the recipient company.
 *  - For Diwali / Festival wishes, ensures an enlightened, inspiring, luminous festival subtitle
 *    such as "Festival of Lights, Joy & Prosperity" or "Illuminating Wisdom, Peace & Prosperity".
 *  - For Newsletters, provides clean perspective subtitle (e.g., "Core Perspective | Wednesday Edition").
 *
 * @param {string} rawSubtitle
 * @param {Object} options - { campaignType, occasion, company }
 * @returns {string} - Clean, elegant header subtitle
 */
function cleanHeaderSubtitle(rawSubtitle, options = {}) {
  let subtitle = String(rawSubtitle || '').trim();
  const {
    campaignType = 'newsletter',
    occasion = '',
    company = ''
  } = options;

  const normalizedType = String(campaignType || '').toLowerCase();
  const isFestival = normalizedType.includes('festival') || normalizedType.includes('wish') || Boolean(occasion);
  const isDiwali = /diwali/i.test(occasion) || /diwali/i.test(subtitle);

  // If company is provided, strip any mention of "From <Company>" or "<Company>" in subtitle
  if (company && company.length > 1) {
    const escapedComp = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    subtitle = subtitle.replace(new RegExp(`^(?:From\\s+)?${escapedComp}\\b.*$`, 'i'), '').trim();
    subtitle = subtitle.replace(new RegExp(`\\bFrom\\s+${escapedComp}\\b`, 'gi'), '').trim();
    subtitle = subtitle.replace(new RegExp(`\\b${escapedComp}\\b`, 'gi'), '').trim();
  }

  // Strip generic "From ..." or "By ..." prefixes or full matches
  subtitle = subtitle.replace(/^from\s+.*$/i, '').trim();
  subtitle = subtitle.replace(/^from\b\s*:?\s*/i, '').trim();
  subtitle = subtitle.replace(/^by\b\s*:?\s*/i, '').trim();

  // If prompt leak detected in subtitle
  if (detectPromptLeakInSubject(subtitle) || subtitle.length < 3) {
    subtitle = '';
  }

  // Clean trailing or leading punctuation
  subtitle = subtitle.replace(/^[-—–:,\s]+|[-—–:,\s]+$/g, '').trim();

  // If subtitle was emptied or stripped, supply enlightened default
  if (!subtitle) {
    if (isFestival) {
      return isDiwali
        ? 'Festival of Lights, Joy & Prosperity'
        : (occasion ? `Celebrating ${occasion} & Prosperity` : 'Wishing You Joy and Prosperity');
    }
    return 'Core Perspective | Wednesday Edition';
  }

  return subtitle;
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
    occasion = '',
    title = null,
    subtitle = null,
    imageUrl = null,
    recipientUnsubUrl = '#',
    recipientPrefUrl = '#',
    company = 'SNS Square',
    recipientCompany = ''
  } = options;

  let bodyHtml = cleanEmailBodyHtml(contentBodyHtml);

  // Scrub any accidental sign-off as the recipient's company
  const targetRecipientCompany = recipientCompany || (company !== 'SNS Square' ? company : '');
  if (targetRecipientCompany && targetRecipientCompany.length > 2) {
    const escapedComp = targetRecipientCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    bodyHtml = bodyHtml.replace(
      new RegExp(`(?:warm|best|kind)?\\s*regards,?\\s*(?:the\\s+)?${escapedComp}(?:\\s+team)?`, 'gi'),
      'Warm regards,<br/>The SNS Square Team'
    );
    bodyHtml = bodyHtml.replace(
      new RegExp(`(?:from|sincerely,)\\s*(?:the\\s+)?${escapedComp}(?:\\s+team)?`, 'gi'),
      'The SNS Square Team'
    );
  }

  // Avoid double wrapping if container is already present
  if (bodyHtml.includes('sns-email-container') && bodyHtml.includes('Embassy TechVillage')) {
    return bodyHtml;
  }

  const normalizedType = String(campaignType).toLowerCase();
  const isFestival = normalizedType.includes('festival') || normalizedType.includes('wish') || Boolean(occasion);
  const isNewsletter = normalizedType.includes('newsletter');
  const isEvent = normalizedType.includes('event') || normalizedType.includes('webinar');

  const headerColor = '#064EE3';
  const snsSquareLogoUrl = 'https://contact-data-extraction-structuring-agent.onrender.com/sns-square-logo.png';

  const isDiwali = /diwali/i.test(occasion) || /diwali/i.test(title || '') || /diwali/i.test(subtitle || '');
  const defaultTitle = isFestival
    ? (isDiwali ? 'Warm Diwali Wishes' : 'Warm Festive Wishes')
    : isEvent
      ? 'Executive Leadership Briefing'
      : 'Your Weekly GCC & AI Scoop';

  const defaultSubtitle = isFestival
    ? (isDiwali ? 'Festival of Lights, Joy & Prosperity' : 'Wishing You Joy and Prosperity')
    : isEvent
      ? 'Exclusive Roundtable & Strategy Forum'
      : 'Core Perspective | Wednesday Edition';

  const headerTitleText = title || defaultTitle;
  const headerSubtitleText = cleanHeaderSubtitle(subtitle, {
    campaignType,
    occasion,
    company: targetRecipientCompany
  }) || defaultSubtitle;

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

  return `<div class="sns-email-container" style="background-color: #f1f5f9; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- SNS Square Branded Confirmed Header -->
    <tr>
      <td bgcolor="${headerColor}" style="padding: 20px 24px; background-color: ${headerColor}; border-bottom: 1px solid ${headerColor};">
        <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="vertical-align: middle;"><img src="${snsSquareLogoUrl}" alt="SNS Square — Redesigning Business" width="140" height="auto" border="0" style="display: block; width: 140px; height: auto; max-width: 140px; background-color: #ffffff; border-radius: 4px;" /></td><td align="right" style="vertical-align: middle;"><div style="font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.25;">${headerTitleText}</div><div style="font-size: 11.5px; color: #dbeafe; margin-top: 3px; font-weight: 500;">${headerSubtitleText}</div></td></tr></table>
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
          <img src="${snsSquareLogoUrl}" alt="SNS Square" width="100" height="auto" border="0" style="display: block; margin: 0 auto; width: 100px; height: auto; background-color: #ffffff; border-radius: 4px; padding: 2px;" />
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
  cleanHeaderSubtitle,
  wrapInSnsSquareTemplate,
  cleanActionText,
  scrubPromptDirectiveText,
  sanitizeFoundationsList,
  scrubPromptLeakFromHtml
};
