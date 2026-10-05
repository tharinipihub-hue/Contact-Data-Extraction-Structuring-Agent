/**
 * Canonical SNS Square Email Template Builder
 * 
 * Generates self-contained, enterprise-grade, client-facing HTML emails
 * for the 5 SNS Square Campaign Templates:
 *  1. SNS Editorial Newsletter
 *  2. SNS Festival & Seasonal Greeting
 *  3. SNS Enterprise Promotional Campaign
 *  4. SNS Executive Event & Webinar Invitation
 *  5. SNS Strategic Client & Partnership Update
 * 
 * Features:
 *  - Fully self-contained table-based responsive email layout (640px max width)
 *  - Preserves SNS Square brand identity: multi-color logo, gradient header, dark footer
 *  - Dynamic client placeholder resolution ({{first_name}}, {{company}}, {{industry}}, {{client_name}})
 *  - Guaranteed non-empty HTML output with embedded styling
 */

function interpolateTemplateVars(text, recipient = null) {
  if (!text) return '';
  const firstName = recipient?.name ? recipient.name.split(' ')[0] : (recipient?.first_name || 'Colleague');
  const company = recipient?.company || 'Enterprise';
  const industry = recipient?.sector || recipient?.industry || 'Technology';
  const clientName = recipient?.name || (recipient?.first_name ? `${recipient.first_name} ${recipient.last_name || ''}`.trim() : 'Valued Client');

  return String(text)
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{company\}\}/gi, company)
    .replace(/\{\{industry\}\}/gi, industry)
    .replace(/\{\{client_name\}\}/gi, clientName);
}

function interpolateEmailHtmlVars(html, recipient = null) {
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const values = {
    first_name: recipient?.name ? recipient.name.split(' ')[0] : (recipient?.first_name || 'Colleague'),
    company: recipient?.company || 'Enterprise',
    industry: recipient?.sector || recipient?.industry || 'Technology',
    client_name: recipient?.name || (recipient?.first_name ? `${recipient.first_name} ${recipient.last_name || ''}`.trim() : 'Valued Client')
  };
  return String(html || '').replace(/\{\{(first_name|company|industry|client_name)\}\}/gi, (_match, key) => escapeHtml(values[key.toLowerCase()]));
}

function buildSnsTemplateEmailHtml({
  template = null,
  customization = {},
  recipient = null
}) {
  const t = template || {};
  const c = customization || {};

  const category = (t.category || c.category || 'Newsletter').toLowerCase();
  const templateId = (t.id || c.templateId || '').toLowerCase();

  // 1. Resolve placeholders
  // The recipient-free compilation is the approved source. Keep its
  // personalization tokens intact; preview/dispatch apply recipient values later.
  const interpolate = (str) => recipient ? interpolateTemplateVars(str, recipient) : String(str || '');
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const firstName = recipient?.name ? recipient.name.split(' ')[0] : (recipient?.first_name || (recipient ? 'Colleague' : '{{first_name}}'));

  // 2. Resolve Header & Colors
  const isFestival = category.includes('occasion') || templateId.includes('festival') || templateId.includes('greeting');
  const isEvent = category.includes('event') || templateId.includes('event') || templateId.includes('invitation');
  const isCampaign = category.includes('campaign') || templateId.includes('promotional');
  const isClientUpdate = category.includes('client') || templateId.includes('client_update');

  const headerColor = '#064EE3';
  const snsSquareLogoUrl = 'https://contact-data-extraction-structuring-agent.onrender.com/sns-square-logo.png';

  const rawHeaderTitle = c.headerTitle || t.headerTitle || 'Your Weekly GCC & AI Scoop';
  const rawHeaderSubtitle = c.headerSubtitle || t.headerSubtitle || 'Core Perspective | Wednesday Edition';
  const headerTitle = escapeHtml(interpolate(rawHeaderTitle));
  const headerSubtitle = escapeHtml(interpolate(rawHeaderSubtitle));

  // 3. Greeting & Hero Section
  const greetingType = c.greetingType || t.greetingType || (isFestival || isCampaign || isEvent || isClientUpdate ? 'personal' : 'editorial');
  const greetingText = greetingType === 'editorial' ? 'Hello Readers,' : `Dear ${firstName},`;

  const heroHeadline = escapeHtml(interpolate(c.heroHeadline || t.heroHeadline || ''));
  const rawHeroBody = c.heroBody || t.heroBody || '';
  const heroParagraphs = interpolate(rawHeroBody)
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="font-size: 14.5px; line-height: 1.7; color: #334155; margin: 0 0 14px 0;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  // 4. Curated Article / Content Blocks
  const blocks = Array.isArray(c.blocks) ? c.blocks : (Array.isArray(t.blocks) ? t.blocks : []);
  const blocksHtml = blocks.map((b, idx) => {
    const headline = escapeHtml(interpolate(b.headline || ''));
    const body = escapeHtml(interpolate(b.body || ''));
    const image = /^https:\/\//i.test(b.image || '') ? escapeHtml(b.image) : '';

    // Sanitize CTA button text: strip brackets, strip trailing arrows, map placeholders
    let rawCta = String(b.ctaText || '').trim();
    rawCta = rawCta.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
    rawCta = rawCta.replace(/^[\s\["“‘]+|[\s\]"”’]+$/g, '').trim();
    rawCta = rawCta.replace(/^\[(.*)\]$/, '$1').trim();
    rawCta = rawCta.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
    if (!rawCta || /^(?:action\s*text|cta|link|read\s*more|click\s*here|placeholder)$/i.test(rawCta)) {
      rawCta = 'Explore Perspective';
    }
    const ctaText = escapeHtml(interpolate(rawCta));
    const ctaUrl = /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(b.ctaUrl || '') ? escapeHtml(b.ctaUrl) : '';

    return `
      <div style="margin: 28px 0; padding-top: ${idx > 0 ? '24px' : '0'}; border-top: ${idx > 0 ? '1px solid #e2e8f0' : 'none'};">
        ${image ? `
          <div style="margin-bottom: 14px;">
            <img src="${image}" alt="${headline}" style="width: 100%; max-width: 580px; height: auto; border-radius: 8px; display: block; border: 1px solid #e2e8f0;" />
          </div>` : ''}
        ${headline ? `<h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; line-height: 1.35;">${headline}</h3>` : ''}
        ${body ? `<p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 14px 0;">${body.replace(/\n/g, '<br/>')}</p>` : ''}
        ${ctaText ? `
              <div style="margin-top: 12px;">
            <a href="${ctaUrl || '#'}" style="background-color: #0b0f19; color: #ffffff; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12.5px; font-weight: 600; display: inline-block;">
              ${ctaText} &rarr;
            </a>
          </div>` : ''}
      </div>
    `;
  }).join('\n');

  // 5. Foundations / Synthesis Section
  const CANONICAL_EDITORIAL_FOUNDATIONS = [
    'Secure digital infrastructure that enables innovation.',
    'Intelligent systems that improve operational performance.',
    'Modern public and enterprise services designed for speed and resilience.',
    'A workforce equipped to thrive alongside AI.'
  ];

  function scrubPromptLeak(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str;
    s = s.replace(/\(\d+\)\s*(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)[\s\S]*/i, '');
    s = s.replace(/(?:Official Sign-off|Standards|Strategic Synthesis|Theme & Headline|Executive Opening|Curated Analytical Perspectives)\s*:[\s\S]*/i, '');
    s = s.replace(/\b(?:Avoid raw markup leakage|Content must feel like one unified editorial publication|Do NOT invent unsupported factual claims|fake statistics|imaginary partner companies)[\s\S]*/i, '');
    s = s.replace(/\bSTRATEGIC IMPACT FOR [^:]+:?[\s\S]*/i, '');
    s = s.replace(/\bKEY ANNOUNCEMENT & BRIEFING:?[\s\S]*/i, '');
    s = s.replace(/\bstructured key pillars with consistent terminology\.?/i, '');
    s = s.replace(/^[\s•\-\*\d\.\)]+/, '');
    s = s.replace(/^["“‘]+|["”’]+$/g, '');
    return s.trim();
  }

  const rawFoundationsTitle = interpolate(c.foundationsTitle || t.foundationsTitle || '');
  const foundationsTitle = escapeHtml(scrubPromptLeak(rawFoundationsTitle));
  const rawFoundations = Array.isArray(c.foundations) ? c.foundations : (Array.isArray(t.foundations) ? t.foundations : []);

  let cleanedFoundations = rawFoundations
    .map(f => scrubPromptLeak(interpolate(f)))
    .filter(f => f && f.length >= 5 && !/^(?:structured key pillars|standards|official sign-off|warm regards)/i.test(f));

  if (cleanedFoundations.length === 0 && (foundationsTitle || t.foundations?.length)) {
    cleanedFoundations = CANONICAL_EDITORIAL_FOUNDATIONS;
  }

  let rawClosing = interpolate(c.closingText || t.closingText || '');
  rawClosing = scrubPromptLeak(rawClosing);
  const closingText = rawClosing;

  const foundationsHtml = (foundationsTitle || cleanedFoundations.length > 0) ? `
    <div style="margin: 30px 0 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      ${foundationsTitle ? `
        <strong style="font-size: 14px; color: #0f172a; display: block; margin-bottom: 12px;">${foundationsTitle}</strong>` : ''}
      ${cleanedFoundations.length > 0 ? `
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.65; color: #334155;">
          ${cleanedFoundations.map(f => `<li style="margin-bottom: 6px;">${escapeHtml(f)}</li>`).join('\n')}
        </ul>` : ''}
      ${closingText ? `
        <p style="font-size: 13.5px; line-height: 1.65; color: #475569; margin: 14px 0 0 0;">
          ${escapeHtml(closingText).replace(/\n/g, '<br/>')}
        </p>` : ''}
    </div>
  ` : '';

  // 6. Promotional Banner
  const promo = c.promoBanner || t.promoBanner || null;
  const promoHeadline = escapeHtml(interpolate(promo?.headline || ''));
  const promoBody = escapeHtml(interpolate(promo?.body || ''));
  const promoBadge = escapeHtml(interpolate(promo?.partnerBadge || ''));
  const promoCtaText = escapeHtml(interpolate(promo?.ctaText || ''));
  const promoCtaUrl = /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(promo?.ctaUrl || '') ? escapeHtml(promo.ctaUrl) : '';

  const promoBannerHtml = promoHeadline ? `
    <div style="background-color: #0e1e3e; border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0 16px 0; border: 1px solid #1e293b;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: top; padding-right: 16px;">
            <div style="font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.3; margin-bottom: 8px;">
              ${promoHeadline}
            </div>
            ${promoBody ? `
              <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin-bottom: 14px;">
                ${promoBody}
              </div>` : ''}
            ${promoCtaText ? `
              <a href="${promoCtaUrl || '#'}" style="background-color: #0b0f19; color: #ffffff; border: 1px solid #3b82f6; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block;">
                ${promoCtaText} &rarr;
              </a>` : ''}
          </td>
          ${promoBadge ? `
            <td align="right" style="vertical-align: middle; width: 140px;">
              <div style="display: inline-block; background-color: #1e293b; border-radius: 8px; padding: 10px; border: 1px solid #475569; text-align: left;">
                <div style="font-size: 9.5px; font-weight: 700; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">GCC PARTNER</div>
                <div style="font-size: 11px; color: #e2e8f0; line-height: 1.35; font-weight: 500;">
                  ${promoBadge}
                </div>
              </div>
            </td>` : ''}
        </tr>
      </table>
    </div>
  ` : '';

  // 7. Assemble Full Self-Contained HTML Email
  const finalHtml = `
<div class="sns-email-container" style="background-color: #f1f5f9; padding: 24px 12px; font-family: Arial, Helvetica, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Gradient Brand Header -->
    <tr>
      <td bgcolor="${headerColor}" style="padding: 24px 28px; background-color: ${headerColor}; border-bottom: 1px solid #064EE3;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <img src="${snsSquareLogoUrl}" alt="SNS Square — Redesigning Business" width="150" height="103" border="0" style="display: block; width: 150px; height: auto; max-width: 150px; background-color: #ffffff;" />
            </td>
            <td align="right" style="vertical-align: middle;">
              <div style="font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.25;">
                ${headerTitle}
              </div>
              <div style="font-size: 11.5px; color: #dbeafe; margin-top: 3px; font-weight: 500;">
                ${headerSubtitle}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Main Editorial Content -->
    <tr>
      <td style="padding: 30px 28px 24px 28px; color: #1e293b; font-size: 15px; line-height: 1.65; background-color: #ffffff;">
        <div style="margin-bottom: 20px;">
          <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0;">${greetingText}</p>
          ${heroHeadline ? `<h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.35;">${heroHeadline}</h2>` : ''}
          ${heroParagraphs}
          <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 14px; font-size: 13.5px; font-weight: 600; color: #1e293b;"><tr><td width="22" valign="middle"><span style="color: #064EE3;">&#9632;</span></td><td valign="middle">The SNS Square Team</td></tr></table>
        </div>

        ${blocksHtml}
        ${foundationsHtml}
        ${promoBannerHtml}
      </td>
    </tr>

    <!-- Dark Enterprise Footer -->
    <tr>
      <td style="padding: 26px 24px; background-color: #020617; color: #ffffff; font-size: 12px; line-height: 1.6; text-align: center; border-top: 1px solid #1e293b;">
        <div style="color: #cbd5e1; font-size: 12px; margin-bottom: 4px;">
          You have received this communication as a registered client of SNS Square.
        </div>
        <div style="margin-bottom: 16px;">
          To manage email preferences or unsubscribe, use the links provided in your campaign delivery.
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">SNS SQUARE</div>
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.5; max-width: 480px; margin: 0 auto 10px auto;">
        </div>
      </td>
    </tr>
  </table>
</div>
  `.trim();

  return finalHtml;
}

function buildSnsTemplateEmailResult(options) {
  const finalHtml = buildSnsTemplateEmailHtml(options);
  return {
    finalHtml,
    isNonEmpty: Boolean(finalHtml && finalHtml.length > 200)
  };
}

export { interpolateTemplateVars, interpolateEmailHtmlVars, buildSnsTemplateEmailHtml, buildSnsTemplateEmailResult };
