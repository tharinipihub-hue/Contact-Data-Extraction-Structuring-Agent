'use strict';

/**
 * Canonical SNS Square Email Template Builder (CommonJS runtime for backend and tests)
 * 
 * Generates self-contained, enterprise-grade, client-facing HTML emails
 * for the 5 SNS Square Campaign Templates:
 *  1. SNS Editorial Newsletter
 *  2. SNS Festival & Seasonal Greeting
 *  3. SNS Enterprise Promotional Campaign
 *  4. SNS Executive Event & Webinar Invitation
 *  5. SNS Strategic Client & Partnership Update
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
  const interpolate = (str) => interpolateTemplateVars(str, recipient);
  const firstName = recipient?.name ? recipient.name.split(' ')[0] : 'Colleague';

  // 2. Resolve Header & Colors
  const isFestival = category.includes('occasion') || templateId.includes('festival') || templateId.includes('greeting');
  const isEvent = category.includes('event') || templateId.includes('event') || templateId.includes('invitation');
  const isCampaign = category.includes('campaign') || templateId.includes('promotional');
  const isClientUpdate = category.includes('client') || templateId.includes('client_update');

  const headerGradient = isFestival
    ? 'linear-gradient(135deg, #701a75 0%, #a21caf 50%, #c026d3 100%)'
    : isEvent
      ? 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)'
      : isCampaign
        ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)'
        : isClientUpdate
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
          : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)';

  const rawHeaderTitle = c.headerTitle || t.headerTitle || 'Your Weekly GCC & AI Scoop';
  const rawHeaderSubtitle = c.headerSubtitle || t.headerSubtitle || 'Core Perspective | Wednesday Edition';
  const headerTitle = interpolate(rawHeaderTitle);
  const headerSubtitle = interpolate(rawHeaderSubtitle);

  // 3. Greeting & Hero Section
  const greetingType = c.greetingType || t.greetingType || (isFestival || isCampaign || isEvent || isClientUpdate ? 'personal' : 'editorial');
  const greetingText = greetingType === 'editorial' ? 'Hello Readers,' : `Dear ${firstName},`;

  const heroHeadline = interpolate(c.heroHeadline || t.heroHeadline || '');
  const rawHeroBody = c.heroBody || t.heroBody || '';
  const heroParagraphs = interpolate(rawHeroBody)
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="font-size: 14.5px; line-height: 1.7; color: #334155; margin: 0 0 14px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  // 4. Curated Article / Content Blocks
  const blocks = Array.isArray(c.blocks) ? c.blocks : (Array.isArray(t.blocks) ? t.blocks : []);
  const blocksHtml = blocks.map((b, idx) => {
    const headline = interpolate(b.headline || '');
    const body = interpolate(b.body || '');
    const image = b.image || '';
    const ctaText = interpolate(b.ctaText || '');
    const ctaUrl = b.ctaUrl || 'https://www.snssquare.com';

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
            <a href="${ctaUrl}" style="background-color: #0b0f19; color: #ffffff; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12.5px; font-weight: 600; display: inline-block;">
              ${ctaText} &rarr;
            </a>
          </div>` : ''}
      </div>
    `;
  }).join('\n');

  // 5. Foundations / Synthesis Section
  const foundationsTitle = interpolate(c.foundationsTitle || t.foundationsTitle || '');
  const foundations = Array.isArray(c.foundations) ? c.foundations : (Array.isArray(t.foundations) ? t.foundations : []);
  const closingText = interpolate(c.closingText || t.closingText || '');

  const foundationsHtml = (foundationsTitle || foundations.length > 0) ? `
    <div style="margin: 30px 0 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
      ${foundationsTitle ? `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <div style="width: 14px; height: 14px; border: 2px solid #ef4444; border-top-color: #f59e0b; border-right-color: #10b981; border-bottom-color: #06b6d4; border-radius: 2px; display: inline-block;"></div>
          <strong style="font-size: 14px; color: #0f172a;">${foundationsTitle}</strong>
        </div>` : ''}
      ${foundations.length > 0 ? `
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.65; color: #334155;">
          ${foundations.map(f => `<li style="margin-bottom: 6px;">${interpolate(f)}</li>`).join('\n')}
        </ul>` : ''}
      ${closingText ? `
        <p style="font-size: 13.5px; line-height: 1.65; color: #475569; margin: 14px 0 0 0;">
          ${closingText.replace(/\n/g, '<br/>')}
        </p>` : ''}
    </div>
  ` : '';

  // 6. Promotional Banner
  const promo = c.promoBanner || t.promoBanner || null;
  const promoHeadline = interpolate(promo?.headline || '');
  const promoBody = interpolate(promo?.body || '');
  const promoBadge = interpolate(promo?.partnerBadge || '');
  const promoCtaText = interpolate(promo?.ctaText || '');
  const promoCtaUrl = promo?.ctaUrl || 'https://www.snssquare.com/gcc-services';

  const promoBannerHtml = promoHeadline ? `
    <div style="background: linear-gradient(135deg, #090e17 0%, #0e1e3e 50%, #1e3a8a 100%); border-radius: 12px; padding: 24px; color: #ffffff; margin: 30px 0 16px 0; border: 1px solid #1e293b;">
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
              <a href="${promoCtaUrl}" style="background-color: #0b0f19; color: #ffffff; border: 1px solid #3b82f6; text-decoration: none; padding: 9px 18px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block;">
                ${promoCtaText} &rarr;
              </a>` : ''}
          </td>
          ${promoBadge ? `
            <td align="right" style="vertical-align: middle; width: 140px;">
              <div style="display: inline-block; background: rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px; border: 1px solid rgba(255, 255, 255, 0.15); text-align: left;">
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
<div class="sns-email-container" style="background-color: #f1f5f9; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Gradient Brand Header -->
    <tr>
      <td style="padding: 24px 28px; background: ${headerGradient}; border-bottom: 1px solid rgba(255,255,255,0.15);">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
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
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13.5px; font-weight: 600; color: #1e293b;">
            <div style="width: 14px; height: 14px; border: 2px solid #ef4444; border-top-color: #f59e0b; border-right-color: #10b981; border-bottom-color: #06b6d4; border-radius: 2px; display: inline-block;"></div>
            <span>The SNS Square Team</span>
          </div>
        </div>

        ${blocksHtml}
        ${foundationsHtml}
        ${promoBannerHtml}
      </td>
    </tr>

    <!-- Dark Enterprise Footer -->
    <tr>
      <td style="padding: 26px 24px; background-color: #090e17; color: #94a3b8; font-size: 12px; line-height: 1.6; text-align: center; border-top: 1px solid #1e293b;">
        <div style="margin-bottom: 14px;">
          <a href="https://www.snssquare.com" style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 3px; font-size: 11px;">&bull;</a>
          <a href="https://linkedin.com" style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 3px; font-size: 11px;">in</a>
          <a href="https://youtube.com" style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 3px; font-size: 11px;">yt</a>
          <a href="https://instagram.com" style="display: inline-block; width: 28px; height: 28px; line-height: 28px; background-color: #ffffff; color: #090e17; border-radius: 50%; text-decoration: none; font-weight: 700; margin: 0 3px; font-size: 11px;">ig</a>
        </div>
        <div style="color: #cbd5e1; font-size: 12px; margin-bottom: 4px;">
          You have received this communication as a registered client of SNS Square.
        </div>
        <div style="margin-bottom: 16px;">
          To manage email preferences or unsubscribe, click <a href="#" style="color: #60a5fa; text-decoration: underline;">here</a>.
        </div>
        <div style="margin-bottom: 12px;">
          <div style="width: 28px; height: 28px; border: 2px solid #ef4444; border-top-color: #f59e0b; border-right-color: #10b981; border-bottom-color: #06b6d4; border-radius: 3px; display: inline-block; margin-bottom: 4px;"></div>
          <div style="font-size: 12.5px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">SNS SQUARE</div>
          <div style="font-size: 8px; color: #94a3b8; font-style: italic;">Redesigning Business</div>
        </div>
        <div style="color: #94a3b8; font-size: 11px; line-height: 1.5; max-width: 480px; margin: 0 auto 10px auto;">
          <strong>BLOCK-L, Embassy TechVillage</strong><br/>
          Outer Ring Road, Devarabisanahalli, Bellandur, Bengaluru, Karnataka 560103, India
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 10px; border-top: 1px solid #1e293b; padding-top: 10px;">
          &copy; 2026 SNS Square. All rights reserved. &bull; Enterprise Client Partnerships
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

module.exports = {
  interpolateTemplateVars,
  buildSnsTemplateEmailHtml,
  buildSnsTemplateEmailResult
};
