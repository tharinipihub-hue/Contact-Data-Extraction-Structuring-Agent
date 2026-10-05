'use strict';

/**
 * Map the current campaigns/generate API contract into the SNS template model.
 * The backend returns Workbench's subject/email_body pair plus the sanitized
 * original copy in preview.body_text_only. Missing sections intentionally stay
 * absent so the selected template retains its controlled defaults.
 */
function normalizeWorkbenchTemplateContent(apiResponse) {
  const preview = apiResponse?.preview;
  const raw = apiResponse?.workbench_content;
  if (!preview || !raw || typeof raw.subject !== 'string' || typeof raw.email_body !== 'string') return null;

  const normalized = { subjectLine: typeof preview.subject === 'string' ? preview.subject.trim() : raw.subject.trim() };
  const bodyHtml = typeof preview.body_text_only === 'string' ? preview.body_text_only : raw.email_body;
  if (!bodyHtml.trim() || typeof DOMParser === 'undefined') {
    if (bodyHtml.trim()) normalized.heroBody = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return normalized;
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
  return normalized;
}

module.exports = { normalizeWorkbenchTemplateContent };
