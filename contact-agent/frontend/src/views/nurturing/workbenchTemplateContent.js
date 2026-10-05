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
    ['output', 'items', 'json', 'body', 'data', 'result', 'content', 'nurtured_contact', 'workbench_content', 'preview'].forEach(key => {
      if (value[key] && typeof value[key] === 'object') queue.push(value[key]);
    });
  }

  const raw = payloads.find(value => typeof value.subject === 'string' && typeof value.email_body === 'string');
  const explicitPreview = apiResponse?.preview;
  const preview = explicitPreview && typeof explicitPreview.subject === 'string'
    ? explicitPreview
    : payloads.find(value => typeof value.subject === 'string' && typeof value.body_text_only === 'string')
      || payloads.find(value => typeof value.subject === 'string' && typeof value.email_body === 'string');
  if (!raw && !preview) return null;

  const subject = preview?.subject || raw?.subject;
  const bodyHtml = preview?.body_text_only || preview?.email_body || raw?.email_body || '';
  const normalized = {};
  if (typeof subject === 'string' && subject.trim()) normalized.subjectLine = subject.trim();
  if (!bodyHtml.trim() || typeof DOMParser === 'undefined') {
    if (bodyHtml.trim()) normalized.heroBody = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return Object.keys(normalized).length ? normalized : null;
  }

  const parsed = new DOMParser().parseFromString(bodyHtml, 'text/html');
  const blocksFromWorkbench = [];
  const openingParagraphs = [];
  const synthesisPoints = [];
  let activeArticle = null;
  let heroHeadline = '';

  Array.from(parsed.body.querySelectorAll('h1, h2, h3, p, ul, ol')).forEach(node => {
    const tag = node.tagName.toLowerCase();
    if ((tag === 'h1' || tag === 'h2') && !heroHeadline && blocksFromWorkbench.length === 0) {
      heroHeadline = node.textContent.trim();
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      node.querySelectorAll('li').forEach(item => {
        const text = item.textContent.trim();
        if (text) synthesisPoints.push(text);
      });
      return;
    }

    const strong = node.querySelector('strong');
    const strongText = strong?.textContent?.trim() || '';
    if (tag === 'p' && /^headline\s*:/i.test(strongText)) {
      activeArticle = { headline: strongText.replace(/^headline\s*:\s*/i, ''), body: '', ctaText: '', ctaUrl: '' };
      blocksFromWorkbench.push(activeArticle);
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
    if (!text || /^(dear|hello|hi)\b/i.test(text)) return;
    if (activeArticle) activeArticle.body = [activeArticle.body, text].filter(Boolean).join('\n\n');
    else if (!heroHeadline && tag === 'h3') heroHeadline = text;
    else if (tag === 'p') openingParagraphs.push(text);
  });

  if (heroHeadline) normalized.heroHeadline = heroHeadline;
  if (openingParagraphs.length) normalized.heroBody = openingParagraphs.join('\n\n');
  if (blocksFromWorkbench.length) normalized.articles = blocksFromWorkbench.filter(block => block.headline || block.body);
  if (synthesisPoints.length) normalized.synthesisPoints = synthesisPoints;
  return Object.keys(normalized).length ? normalized : null;
}

module.exports = { normalizeWorkbenchTemplateContent };
