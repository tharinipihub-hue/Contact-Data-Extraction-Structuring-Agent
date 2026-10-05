'use strict';

/** Normalize only the subject/body fields established by the Workbench route,
 * traversing the wrappers actually emitted by Workbench and this application. */
function normalizeWorkbenchTemplateContent(apiResponse) {
  const queue = [apiResponse];
  const visited = new Set();
  const payloads = [];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    payloads.push(value);
    if (Array.isArray(value)) {
      value.forEach(item => queue.push(item?.json || item));
      continue;
    }
    ['output', 'items', 'json', 'body', 'data', 'result', 'content', 'nurtured_contact', 'workbench_content', 'preview', 'structured_content'].forEach(key => {
      if (value[key] && typeof value[key] === 'object') queue.push(value[key]);
    });
  }

  const raw = payloads.find(value => typeof value.subject === 'string' && typeof value.email_body === 'string');
  const explicitPreview = apiResponse?.preview;
  const preview = explicitPreview && typeof explicitPreview.subject === 'string'
    ? explicitPreview
    : payloads.find(value => typeof value.subject === 'string' && typeof value.body_text_only === 'string')
      || payloads.find(value => typeof value.subject === 'string' && typeof value.email_body === 'string');

  const structuredSource = apiResponse?.structured_content ||
    apiResponse?.preview?.structured_content ||
    apiResponse?.preview?.workbench_content ||
    apiResponse?.workbench_content ||
    payloads.find(p => p.header_title || p.hero_headline || p.content_blocks);

  if (!raw && !preview && !structuredSource?.subject) return null;

  const subject = preview?.subject || raw?.subject || structuredSource?.subject;
  const bodyHtml = preview?.body_text_only || preview?.email_body || raw?.email_body || '';
  const normalized = {};
  if (typeof subject === 'string' && subject.trim()) normalized.subjectLine = subject.trim();

  const structuredCampaignName = structuredSource?.campaign_name || structuredSource?.campaignName;
  const structuredHeaderTitle = structuredSource?.header_title || structuredSource?.headerTitle || structuredSource?.header?.title;
  const structuredHeaderSubtitle = structuredSource?.header_subtitle || structuredSource?.headerSubtitle || structuredSource?.header?.subtitle;
  let structuredGreetingType = structuredSource?.greeting_type || structuredSource?.greetingType;
  const structuredHeroHeadline = structuredSource?.hero_headline || structuredSource?.heroHeadline || structuredSource?.hero?.headline;
  const structuredHeroBody = structuredSource?.hero_body || structuredSource?.heroBody || structuredSource?.hero?.body || (Array.isArray(structuredSource?.hero?.paragraphs) ? structuredSource.hero.paragraphs.join('\n\n') : '');
  const structuredBlocks = structuredSource?.content_blocks || structuredSource?.blocks || structuredSource?.articles;
  const structuredFoundationsTitle = structuredSource?.foundations_title || structuredSource?.foundationsTitle;
  const structuredFoundations = structuredSource?.foundations || structuredSource?.synthesis_points || structuredSource?.synthesisPoints;
  const structuredClosingText = structuredSource?.closing_text || structuredSource?.closingText;
  const structuredPromoBanner = structuredSource?.promo_banner || structuredSource?.promoBanner;

  let heroHeadline = structuredHeroHeadline || '';
  const openingParagraphs = structuredHeroBody ? [structuredHeroBody] : [];
  const blocksFromWorkbench = [];
  const synthesisPoints = Array.isArray(structuredFoundations) ? [...structuredFoundations] : [];

  if (Array.isArray(structuredBlocks) && structuredBlocks.length > 0) {
    structuredBlocks.forEach(b => {
      if (b && (b.headline || b.title || b.body || b.paragraph)) {
        blocksFromWorkbench.push({
          headline: b.headline || b.title || '',
          body: b.body || b.paragraph || '',
          image: b.image || b.image_url || '',
          ctaText: b.ctaText || b.cta_text || b.cta_label || '',
          ctaUrl: b.ctaUrl || b.cta_url || ''
        });
      }
    });
  }

  if (bodyHtml.trim() && typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(bodyHtml, 'text/html');
    let activeArticle = null;

    Array.from(parsed.body.querySelectorAll('h1, h2, h3, p, ul, ol')).forEach(node => {
      const tag = node.tagName.toLowerCase();
      if ((tag === 'h1' || tag === 'h2') && !heroHeadline && blocksFromWorkbench.length === 0) {
        heroHeadline = node.textContent.trim();
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        if (!structuredFoundations || structuredFoundations.length === 0) {
          node.querySelectorAll('li').forEach(item => {
            const text = item.textContent.trim();
            if (text && !synthesisPoints.includes(text)) synthesisPoints.push(text);
          });
        }
        return;
      }

      const strong = node.querySelector('strong');
      const strongText = strong?.textContent?.trim() || '';
      if (tag === 'p' && /^headline\s*:/i.test(strongText)) {
        if (!structuredBlocks || structuredBlocks.length === 0) {
          activeArticle = { headline: strongText.replace(/^headline\s*:\s*/i, '').trim(), body: '', ctaText: '', ctaUrl: '' };
          blocksFromWorkbench.push(activeArticle);
        }
        return;
      }

      const link = node.querySelector('a[href]');
      if (link && activeArticle) {
        activeArticle.ctaText = link.textContent.trim();
        const href = link.getAttribute('href') || '';
        if (/^(?:https?:\/\/|mailto:)/i.test(href)) activeArticle.ctaUrl = href;
        return;
      }

      const text = node.textContent.trim();
      if (!text) return;
      if (!structuredGreetingType) {
        if (/^dear\b/i.test(text)) structuredGreetingType = 'personal';
        else if (/^hello\s+readers\b/i.test(text)) structuredGreetingType = 'editorial';
      }
      if (/^(dear|hello|hi)\b/i.test(text)) return;

      if (activeArticle) {
        activeArticle.body = [activeArticle.body, text].filter(Boolean).join('\n\n');
      } else if (!heroHeadline && tag === 'h3') {
        heroHeadline = text;
      } else if (tag === 'p' && !structuredHeroBody) {
        openingParagraphs.push(text);
      }
    });
  } else if (bodyHtml.trim() && !structuredHeroBody) {
    const stripped = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped) openingParagraphs.push(stripped);
  }

  if (structuredCampaignName && String(structuredCampaignName).trim()) {
    normalized.campaignName = String(structuredCampaignName).trim();
  }
  if (structuredHeaderTitle && String(structuredHeaderTitle).trim()) {
    normalized.headerTitle = String(structuredHeaderTitle).trim();
  }
  if (structuredHeaderSubtitle && String(structuredHeaderSubtitle).trim()) {
    normalized.headerSubtitle = String(structuredHeaderSubtitle).trim();
  }
  if (structuredGreetingType) {
    normalized.greetingType = structuredGreetingType;
  }
  if (heroHeadline && String(heroHeadline).trim()) {
    normalized.heroHeadline = String(heroHeadline).trim();
  }
  if (openingParagraphs.length) {
    normalized.heroBody = openingParagraphs.join('\n\n').trim();
  }
  if (blocksFromWorkbench.length) {
    const valid = blocksFromWorkbench.filter(b => (b.headline && b.headline.trim()) || (b.body && b.body.trim()));
    if (valid.length) normalized.articles = valid;
  }
  if (structuredFoundationsTitle && String(structuredFoundationsTitle).trim()) {
    normalized.foundationsTitle = String(structuredFoundationsTitle).trim();
  }
  if (synthesisPoints.length) {
    normalized.synthesisPoints = synthesisPoints.filter(Boolean);
  }
  if (structuredClosingText && String(structuredClosingText).trim()) {
    normalized.closingText = String(structuredClosingText).trim();
  }
  if (structuredPromoBanner && typeof structuredPromoBanner === 'object' && Object.keys(structuredPromoBanner).length > 0) {
    normalized.promoBanner = structuredPromoBanner;
  }

  return Object.keys(normalized).length ? normalized : null;
}

module.exports = { normalizeWorkbenchTemplateContent };
