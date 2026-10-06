'use strict';

function scrubPromptDirectiveText(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/&amp;/gi, '&');
  // Do not salvage a prompt or workflow directive into customer-facing copy.
  if (/^\s*[\[{]\s*["'\w]+\s*:/.test(s) ||
    /\b(?:FESTIVAL(?:\s+WISH)?\s+RULE|(?:NEWSLETTER|CAMPAIGN)\s+RULES?|CAMPAIGN TYPE|EDITORIAL GUIDELINES|QUALITY STANDARD|GENERATION\s+INSTRUCTIONS?|PROMPT\s+INSTRUCTIONS?|SYSTEM\s+INSTRUCTIONS?|DEVELOPER\s+INSTRUCTIONS?|Return only\b|Output only\b|Do not include\b|Never include\b|KEY\s+ANNOUNCEMENT\s*(?:&|AND)\s*BRIEFING\s*:|STRATEGIC IMPACT FOR\b|(?:SECTION|STEP)\s+\d+\s*[:.)-]|developer_input\s*:|campaign_type\s*:|content_blocks\s*:)/i.test(s)) return '';
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

function cleanCtaText(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
  s = s.replace(/^[\s\["“‘]+|[\s\]"”’]+$/g, '').trim();
  s = s.replace(/^\[(.*)\]$/, '$1').trim();
  s = s.replace(/\s*(?:&rarr;|→|->|-->|>)+$/gi, '').trim();
  if (!s || /^(?:action\s*text|cta|link\s*text|read\s*more|click\s*here|placeholder)$/i.test(s)) return '';
  return s;
}

function isSignOffOrFooter(text) {
  if (!text || typeof text !== 'string') return true;
  const s = text.trim();
  if (/^(?:sincerely|warm regards|best regards|regards|yours truly|cheers|with gratitude)\b/i.test(s)) return true;
  if (/^(?:the team at|client relations team|sns square team|client relations)\b/i.test(s)) return true;
  if (/^(?:---|——|--|\*\*\*|___)/.test(s)) return true;
  if (/^(?:to manage your communication preferences|reply stop|opt out|unsubscribe)\b/i.test(s)) return true;
  if (/reply\s+stop\b/i.test(s)) return true;
  return false;
}

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

  if (apiResponse?.error || apiResponse?.success === false || apiResponse?.content_source === 'unavailable') return null;

  const structuredSource = [
    apiResponse?.structured_content,
    apiResponse?.preview?.structured_content,
    apiResponse?.preview?.workbench_content,
    apiResponse?.workbench_content,
    payloads.find(p => p.campaign_name || p.header_title || p.header_subtitle || p.greeting_type || p.hero_headline || p.hero_body || p.content_blocks || p.foundations_title || p.foundations || p.closing_text || p.promo_banner)
  ].find(value => value && typeof value === 'object' && Object.keys(value).some(key => value[key] !== undefined && value[key] !== null));

  if (!raw && !preview && !structuredSource?.subject) return null;

  const subject = preview && typeof preview.subject === 'string'
    ? preview.subject
    : (raw?.subject || structuredSource?.subject || '');
  const bodyHtml = preview && typeof preview.body_text_only === 'string'
    ? preview.body_text_only
    : (preview?.email_body || raw?.email_body || '');
  const normalized = {};
  if (typeof subject === 'string' && subject.trim()) normalized.subjectLine = subject.trim();

  const structuredCampaignName = structuredSource?.campaign_name || structuredSource?.campaignName;
  const structuredHeaderTitle = structuredSource?.header_title || structuredSource?.headerTitle || structuredSource?.header?.title;
  const structuredHeaderSubtitle = structuredSource?.header_subtitle || structuredSource?.headerSubtitle || structuredSource?.header?.subtitle;
  let structuredGreetingType = structuredSource?.greeting_type || structuredSource?.greetingType;
  const structuredHeroHeadline = structuredSource?.hero_headline || structuredSource?.heroHeadline || structuredSource?.hero?.headline;
  const rawHeroBody = structuredSource?.hero_body || structuredSource?.heroBody || structuredSource?.hero?.body;
  const structuredHeroBody = Array.isArray(rawHeroBody)
    ? rawHeroBody.map(p => typeof p === 'string' ? p.trim() : '').filter(Boolean).join('\n\n')
    : (typeof rawHeroBody === 'string' ? rawHeroBody : '') ||
      (Array.isArray(structuredSource?.hero_paragraphs) ? structuredSource.hero_paragraphs.filter(Boolean).join('\n\n') : '') ||
      (Array.isArray(structuredSource?.hero?.paragraphs) ? structuredSource.hero.paragraphs.filter(Boolean).join('\n\n') : '');
  const structuredBlocks = structuredSource?.content_blocks || structuredSource?.blocks || structuredSource?.articles;
  const structuredFoundationsTitle = structuredSource?.foundations_title || structuredSource?.foundationsTitle;
  const structuredFoundations = structuredSource?.foundations || structuredSource?.synthesis_points || structuredSource?.synthesisPoints;
  const structuredClosingText = structuredSource?.closing_text || structuredSource?.closingText;
  const structuredPromoBanner = structuredSource?.promo_banner || structuredSource?.promoBanner;

  let heroHeadline = structuredHeroHeadline || '';
  const openingParagraphs = structuredHeroBody ? structuredHeroBody.split(/\n{2,}/).map(s => s.trim()).filter(Boolean) : [];
  const blocksFromWorkbench = [];
  const synthesisPoints = Array.isArray(structuredFoundations) ? [...structuredFoundations] : [];

  if (Array.isArray(structuredBlocks) && structuredBlocks.length > 0) {
    structuredBlocks.forEach(b => {
      if (b && (b.headline || b.title || b.body || b.paragraph)) {
        const headline = scrubPromptDirectiveText(String(b.headline || b.title || '').trim());
        const body = scrubPromptDirectiveText(String(b.body || b.paragraph || '').trim());
        const ctaText = cleanCtaText(b.ctaText || b.cta_text || b.cta_label || '');
        const block = {
          headline,
          body,
          image: /^https:\/\//i.test(b.image || b.image_url || '') ? (b.image || b.image_url) : '',
          ctaText,
          ctaUrl: /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(b.ctaUrl || b.cta_url || '') ? (b.ctaUrl || b.cta_url) : ''
        };
        if (block.headline || block.body || block.image || block.ctaText) blocksFromWorkbench.push(block);
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
        const raw = item.textContent.trim();
            const text = scrubPromptDirectiveText(raw);
            if (text && text.length >= 5 && !/^(?:structured key pillars|standards|official sign-off|warm regards)/i.test(text)) {
              if (!synthesisPoints.includes(text)) synthesisPoints.push(text);
            }
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
        activeArticle.ctaText = cleanCtaText(link.textContent.trim());
        const href = link.getAttribute('href') || '';
        if (/^(?:https?:\/\/|mailto:)/i.test(href)) activeArticle.ctaUrl = href;
        return;
      }

      const text = scrubPromptDirectiveText(node.textContent.trim());
      if (!text) return;
      if (!structuredGreetingType) {
        if (/^dear\b/i.test(text)) structuredGreetingType = 'personal';
        else if (/^hello\s+readers\b/i.test(text)) structuredGreetingType = 'editorial';
      }
      if (/^(dear|hello|hi)\b/i.test(text)) return;
      if (isSignOffOrFooter(text)) return;

      if (activeArticle) {
        activeArticle.body = [activeArticle.body, text].filter(Boolean).join('\n\n');
      } else if (!heroHeadline && tag === 'h3') {
        heroHeadline = text;
      } else if (tag === 'p' && !structuredHeroBody) {
        openingParagraphs.push(text);
      }
    });
  } else if (bodyHtml.trim() && !structuredHeroBody) {
    const paragraphs = bodyHtml
      .split(/<\/(?:p|h[1-6]|li)>|\n{2,}/i)
      .map(p => p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    paragraphs.forEach(text => {
      if (!structuredGreetingType) {
        if (/^dear\b/i.test(text)) structuredGreetingType = 'personal';
        else if (/^hello\s+readers\b/i.test(text)) structuredGreetingType = 'editorial';
      }
      if (/^(dear|hello|hi)\b/i.test(text)) return;
      if (isSignOffOrFooter(text)) return;
      openingParagraphs.push(text);
    });
  }

  // A standalone short heading can be mapped to the hero; unstructured paragraphs
  // remain separate paragraphs in the hero body rather than being turned into invented blocks.
  if (!heroHeadline && openingParagraphs.length > 1) {
    const secondLooksLikeTitle = openingParagraphs[0].endsWith(':') &&
      openingParagraphs[1].length <= 100 && !/[.!?]$/.test(openingParagraphs[1]);
    const firstLooksLikeTitle = openingParagraphs[0].length <= 100 && !/[.!?]$/.test(openingParagraphs[0]);
    const titleIndex = secondLooksLikeTitle ? 1 : firstLooksLikeTitle ? 0 : -1;
    if (titleIndex >= 0) {
      const [title] = openingParagraphs.splice(titleIndex, 1);
      heroHeadline = scrubPromptDirectiveText(title);
    }
  }
  const cleanOpeningParagraphs = openingParagraphs.map(p => scrubPromptDirectiveText(p)).filter(Boolean);
  openingParagraphs.splice(0, openingParagraphs.length, ...cleanOpeningParagraphs);

  if (structuredCampaignName && String(structuredCampaignName).trim()) {
    normalized.campaignName = String(structuredCampaignName).trim();
  }
  if (structuredHeaderTitle && String(structuredHeaderTitle).trim()) normalized.headerTitle = scrubPromptDirectiveText(String(structuredHeaderTitle).trim());
  if (structuredHeaderSubtitle && String(structuredHeaderSubtitle).trim()) normalized.headerSubtitle = scrubPromptDirectiveText(String(structuredHeaderSubtitle).trim());
  if (structuredGreetingType) {
    normalized.greetingType = structuredGreetingType;
  }
  if (heroHeadline && String(heroHeadline).trim()) {
    normalized.heroHeadline = scrubPromptDirectiveText(String(heroHeadline).trim());
  }
  if (openingParagraphs.length) {
    normalized.heroBody = openingParagraphs.join('\n\n').trim();
  }
  if (blocksFromWorkbench.length) {
    const valid = blocksFromWorkbench.filter(b => (b.headline && b.headline.trim()) || (b.body && b.body.trim()));
    if (valid.length) normalized.articles = valid;
  }
  if (structuredFoundationsTitle && String(structuredFoundationsTitle).trim()) {
    normalized.foundationsTitle = scrubPromptDirectiveText(String(structuredFoundationsTitle).trim());
  }
  const cleanedSynthesisPoints = synthesisPoints
    .map(p => scrubPromptDirectiveText(p))
    .filter(p => p && p.length >= 5 && !/^(?:structured key pillars|standards|official sign-off|warm regards)/i.test(p));
  if (cleanedSynthesisPoints.length) {
    normalized.synthesisPoints = cleanedSynthesisPoints;
  }
  if (structuredClosingText && String(structuredClosingText).trim()) {
    normalized.closingText = scrubPromptDirectiveText(String(structuredClosingText).trim());
  }
  if (structuredPromoBanner && typeof structuredPromoBanner === 'object' && Object.keys(structuredPromoBanner).length > 0) {
    const promo = {
      headline: scrubPromptDirectiveText(String(structuredPromoBanner.headline || '').trim()),
      body: scrubPromptDirectiveText(String(structuredPromoBanner.body || '').trim()),
      partnerBadge: scrubPromptDirectiveText(String(structuredPromoBanner.partnerBadge || structuredPromoBanner.partner_badge || '').trim()),
      ctaText: cleanCtaText(structuredPromoBanner.ctaText || structuredPromoBanner.cta_text || structuredPromoBanner.cta_label || ''),
      ctaUrl: /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(structuredPromoBanner.ctaUrl || structuredPromoBanner.cta_url || '') ? (structuredPromoBanner.ctaUrl || structuredPromoBanner.cta_url) : ''
    };
    if (Object.values(promo).some(Boolean)) normalized.promoBanner = promo;
  }

  const hasEditorialContent = Boolean(
    normalized.heroHeadline || normalized.heroBody || normalized.articles?.some(article => article.headline || article.body) ||
    normalized.synthesisPoints?.length || normalized.closingText || normalized.promoBanner?.headline || normalized.promoBanner?.body
  );
  return hasEditorialContent ? normalized : null;
}

module.exports = { normalizeWorkbenchTemplateContent, cleanCtaText, scrubPromptDirectiveText };
