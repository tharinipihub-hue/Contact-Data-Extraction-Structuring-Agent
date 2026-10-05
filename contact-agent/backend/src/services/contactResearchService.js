'use strict';

/**
 * Contact Research / Enrichment Service using Tavily Search API
 *
 * Purpose: Gather verified public information about a contact/company
 * to enable industry-specific, contextually relevant campaign generation.
 *
 * Safety rules:
 *  - Only uses TAVILY_API_KEY from environment variables
 *  - Never invents or fabricates search results
 *  - Every enriched field retains its source
 *  - Never scrapes private information
 *  - Returns structured, source-annotated results
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_API_URL = 'https://api.tavily.com/search';
const SEARCH_TIMEOUT_MS = 20000;

/**
 * Check whether Tavily is configured.
 */
function isTavilyAvailable() {
  return Boolean(TAVILY_API_KEY && TAVILY_API_KEY.length > 10);
}

/**
 * Perform a single Tavily search query.
 *
 * @param {string} query
 * @param {Object} options
 * @returns {Promise<Array>} — array of { title, url, content, score }
 */
async function tavilySearch(query, options = {}) {
  if (!isTavilyAvailable()) {
    throw new Error('TAVILY_API_KEY is not configured. Add TAVILY_API_KEY to your environment variables to enable contact research.');
  }

  const body = {
    api_key: TAVILY_API_KEY,
    query,
    search_depth: options.depth || 'basic',
    include_answer: true,
    include_raw_content: false,
    max_results: options.maxResults || 5,
    include_domains: options.includeDomains || [],
    exclude_domains: options.excludeDomains || []
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Digital-Client-Nurturing-Backend/1.0'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Tavily API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
      answer: data.answer || null,
      results: (data.results || []).map(r => ({
        title: r.title || '',
        url: r.url || '',
        content: (r.content || '').slice(0, 500),
        score: r.score || 0,
        published_date: r.published_date || null
      })),
      query
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Research a contact and company using multiple targeted searches.
 *
 * @param {Object} contact — { name, company, designation, industry, sector, linkedin_url }
 * @returns {Promise<Object>} — structured enrichment result
 */
async function researchContact(contact) {
  if (!contact) throw new Error('Contact data is required for research.');
  if (!isTavilyAvailable()) {
    return {
      available: false,
      blocked: true,
      reason: 'BLOCKED — TAVILY_API_KEY not configured. Add TAVILY_API_KEY=tvly-... to environment variables.',
      contact_name: contact.name,
      company: contact.company
    };
  }

  const company = contact.company || '';
  const industry = contact.industry || contact.sector || '';
  const name = contact.name || '';

  const retrievedAt = new Date().toISOString();
  const findings = [];
  const errors = [];

  // Search 1: Company overview
  if (company) {
    try {
      const result = await tavilySearch(`${company} company overview business focus 2024 2025`, { maxResults: 3 });
      if (result.results.length > 0 || result.answer) {
        findings.push({
          category: 'Company Overview',
          query: result.query,
          answer: result.answer,
          sources: result.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, score: r.score })),
          retrieved_at: retrievedAt,
          confidence: result.results.length > 0 ? 'verified' : 'partial'
        });
      }
    } catch (err) {
      errors.push({ category: 'Company Overview', error: err.message });
    }
  }

  // Search 2: Recent company news / developments
  if (company) {
    try {
      const result = await tavilySearch(`${company} recent news announcements 2025 2026`, { maxResults: 3 });
      if (result.results.length > 0 || result.answer) {
        findings.push({
          category: 'Recent Company Developments',
          query: result.query,
          answer: result.answer,
          sources: result.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, score: r.score, date: r.published_date })),
          retrieved_at: retrievedAt,
          confidence: result.results.length > 0 ? 'verified' : 'partial'
        });
      }
    } catch (err) {
      errors.push({ category: 'Recent Company Developments', error: err.message });
    }
  }

  // Search 3: Industry trends relevant to the contact
  if (industry) {
    try {
      const result = await tavilySearch(`${industry} industry trends AI automation enterprise 2025 2026`, { maxResults: 3 });
      if (result.results.length > 0 || result.answer) {
        findings.push({
          category: `${industry} Industry Insights`,
          query: result.query,
          answer: result.answer,
          sources: result.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, score: r.score })),
          retrieved_at: retrievedAt,
          confidence: result.results.length > 0 ? 'verified' : 'partial',
          note: 'Use for industry-specific newsletter context only. Do not present as company-specific facts.'
        });
      }
    } catch (err) {
      errors.push({ category: 'Industry Insights', error: err.message });
    }
  }

  // Build newsletter context summary from findings
  const companyFinding = findings.find(f => f.category === 'Company Overview');
  const newsFinding = findings.find(f => f.category === 'Recent Company Developments');
  const industryFinding = findings.find(f => f.category.includes('Industry'));

  const newsletter_context = [
    companyFinding?.answer ? `Company context: ${companyFinding.answer.slice(0, 300)}` : null,
    newsFinding?.answer ? `Recent developments: ${newsFinding.answer.slice(0, 300)}` : null,
    industryFinding?.answer ? `Industry context: ${industryFinding.answer.slice(0, 300)}` : null
  ].filter(Boolean).join('\n\n');

  return {
    available: true,
    contact_name: name,
    company,
    industry,
    findings,
    errors,
    newsletter_context,
    research_summary: findings.length > 0
      ? `Found ${findings.length} research area(s) for ${company || name}. Use findings to personalize campaign content.`
      : 'No research results found. Proceed with available contact data.',
    retrieved_at: retrievedAt,
    source: 'Tavily Web Search API',
    disclaimer: 'Results are from public web sources. Do not present search results as absolute facts. Verify key claims before including in campaigns.'
  };
}

/**
 * Research broader industry trends and regulatory intelligence using Tavily.
 *
 * @param {string} industryName
 * @returns {Promise<Object>}
 */
async function researchIndustry(industryName) {
  if (!industryName) throw new Error('Industry name is required for research.');
  if (!isTavilyAvailable()) {
    return {
      available: false,
      blocked: true,
      reason: 'BLOCKED — TAVILY_API_KEY is not configured. Add TAVILY_API_KEY=tvly-... to environment variables.',
      setup_instructions: 'Add TAVILY_API_KEY=tvly-... to your backend environment variables (and Render dashboard). Get a free API key at https://tavily.com',
      industry: industryName
    };
  }

  const retrievedAt = new Date().toISOString();
  const findings = [];
  const errors = [];

  // Search 1: Industry Trends & AI Transformation
  try {
    const result = await tavilySearch(`${industryName} industry trends AI technology automation 2025 2026`, { maxResults: 4 });
    if (result.results.length > 0 || result.answer) {
      findings.push({
        category: 'Trends & Technology Adoption',
        query: result.query,
        answer: result.answer,
        sources: result.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, score: r.score })),
        retrieved_at: retrievedAt,
        confidence: result.results.length > 0 ? 'verified' : 'partial'
      });
    }
  } catch (err) {
    errors.push({ category: 'Trends & Technology Adoption', error: err.message });
  }

  // Search 2: Challenges & Regulatory Landscape
  try {
    const result = await tavilySearch(`${industryName} enterprise market challenges regulatory compliance priorities 2025 2026`, { maxResults: 4 });
    if (result.results.length > 0 || result.answer) {
      findings.push({
        category: 'Market Priorities & Challenges',
        query: result.query,
        answer: result.answer,
        sources: result.results.map(r => ({ title: r.title, url: r.url, snippet: r.content, score: r.score })),
        retrieved_at: retrievedAt,
        confidence: result.results.length > 0 ? 'verified' : 'partial'
      });
    }
  } catch (err) {
    errors.push({ category: 'Market Priorities & Challenges', error: err.message });
  }

  const trendsFinding = findings.find(f => f.category.includes('Trends'));
  const challengesFinding = findings.find(f => f.category.includes('Priorities'));

  const newsletter_context = [
    trendsFinding?.answer ? `Industry Trends: ${trendsFinding.answer}` : null,
    challengesFinding?.answer ? `Strategic Priorities: ${challengesFinding.answer}` : null
  ].filter(Boolean).join('\n\n');

  return {
    available: true,
    industry: industryName,
    findings,
    errors,
    newsletter_context,
    research_summary: findings.length > 0
      ? `Found ${findings.length} intelligence area(s) for ${industryName}. Ready to incorporate into industry newsletters.`
      : `No live search results found for ${industryName}.`,
    retrieved_at: retrievedAt,
    source: 'Tavily Web Search API',
    disclaimer: 'Results are compiled from public industry resources and web search. Verify strategic metrics before client dispatch.'
  };
}

module.exports = {
  isTavilyAvailable,
  researchContact,
  researchIndustry,
  tavilySearch
};

