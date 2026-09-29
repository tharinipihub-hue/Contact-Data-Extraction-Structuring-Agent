'use strict';

/**
 * src/services/leadEngine.js
 *
 * Enterprise CRM Lead Scoring, Validation, Deduplication & Sales Summary Engine
 * Styled after Zoho CRM Enterprise without emojis.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { deduplicateContactList } = require('./dedupService');

function formatField(val) {
  if (val === null || val === undefined) return 'Missing';
  const str = String(val).trim();
  return str.length > 0 ? str : 'Missing';
}

function cleanPhoneNumber(phone) {
  if (!phone || phone === 'Missing') return null;
  let digits = String(phone).replace(/\D/g, '');
  // Strip country code 91 if present and length > 10
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.substring(2);
  }
  // Strip leading 0 trunk prefix if present and length > 10
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.substring(1);
  }
  // Standard phone length validation (8 to 11 digits)
  if (digits.length >= 8 && digits.length <= 11) {
    return digits;
  }
  return null;
}

function validateContact(email, phone) {
  const isEmailValid = email && email !== 'Missing' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPhoneValid = Boolean(cleanPhoneNumber(phone));

  if (isEmailValid && isPhoneValid) return 'Valid';
  if (!isEmailValid && !isPhoneValid) return 'Invalid Email & Phone';
  if (!isEmailValid) return 'Invalid Email';
  return 'Invalid Phone';
}

function evaluateSeniority(rawTitle) {
  const t = (rawTitle || '').toLowerCase().trim();
  if (!t || t === 'missing') {
    return { points: 5, label: 'Designation not specified' };
  }

  // 1. Entry / Intern / Student / Clerk check
  if (/\b(intern|internship|student|trainee|apprentice|peon|attendant|clerk)\b/i.test(t)) {
    return { points: 5, label: 'Entry / Intern / Student / Non-decision maker' };
  }

  // 2. Specific prefix downgrades
  // Personal Secretary / Executive Secretary -> Staff (15 pts), NOT Secretary (40 pts)
  if (/\b(personal secretary|executive secretary|private secretary)\b/i.test(t)) {
    return { points: 15, label: 'Professional staff role (Secretarial)' };
  }

  // Product Owner / Process Owner / Business Owner -> Managerial (25 pts), NOT Owner (40 pts)
  if (/\b(product owner|process owner|business owner|service owner|scrum master)\b/i.test(t)) {
    return { points: 25, label: 'Management / Product ownership role' };
  }

  // Principal Engineer / Architect / Consultant / Scientist -> Specialist (20 pts), NOT Principal (40 pts)
  if (/\bprincipal\s+(engineer|architect|consultant|scientist|analyst|developer|specialist|designer)\b/i.test(t)) {
    return { points: 20, label: 'Technical specialist / Principal engineer' };
  }

  // Assistant / Associate / Deputy Director or Dean -> Senior Executive (35 pts), NOT Director (40 pts)
  if (/\b(assistant director|associate director|deputy director|assistant dean|associate dean|deputy dean|joint director)\b/i.test(t)) {
    return { points: 35, label: 'Senior administrative leadership / Deputy / Associate' };
  }

  // Vice President / VP / EVP / SVP -> Senior Executive (35 pts), NOT President (40 pts)
  if (/\b(vice president|vp|svp|evp|avp|assistant vice president|associate vice president)\b/i.test(t)) {
    return { points: 35, label: 'Senior corporate executive (VP level)' };
  }

  // 3. Apex Leadership & Decision-Maker Authority (40 pts)
  if (/\b(trustee|chairman|chairperson|correspondent|director|chancellor|principal|dean|president|founder|co-founder|chief executive|ceo|chief technology|cto|chief financial|cfo|chief operating|coo|chief revenue|cro|chief information|cio|owner|partner|general secretary|secretary to the board|minister|cabinet secretary)\b/i.test(t)) {
    return { points: 40, label: 'Apex institutional leadership / executive decision maker' };
  }

  // Secretary handling:
  if (/\bsecretary\b/i.test(t)) {
    if (/\b(chief secretary|principal secretary|secretary to government)\b/i.test(t)) {
      return { points: 40, label: 'Apex government leadership (Secretary to Govt)' };
    }
    return { points: 35, label: 'Institutional / Corporate Secretary' };
  }

  // 4. Senior Leadership & Department Heads (35 pts)
  if (/\b(head of|head|provost|controller|registrar|commissioner|secretary to government)\b/i.test(t)) {
    return { points: 35, label: 'Senior executive / department head' };
  }

  // 5. Managerial Roles (25 pts)
  if (/\b(manager|lead|supervisor|coordinator|hod|head of department)\b/i.test(t)) {
    return { points: 25, label: 'Departmental management role' };
  }

  // 6. Specialist & Academic Faculty (20 pts)
  if (/\b(professor|associate professor|assistant professor|faculty|lecturer|reader|specialist|consultant|analyst|engineer|architect|scientist)\b/i.test(t)) {
    return { points: 20, label: 'Academic faculty / domain specialist' };
  }

  // 7. Professional Staff Role (15 pts)
  if (/\b(officer|executive|associate|assistant|staff|representative)\b/i.test(t)) {
    return { points: 15, label: 'Professional staff role' };
  }

  return { points: 15, label: 'Professional staff role' };
}

function evaluateSector(rawIndustry, rawCompany) {
  const ind = (rawIndustry || '').toLowerCase().trim();
  const comp = (rawCompany || '').toLowerCase().trim();

  // Missing or unspecified sector: explicitly +5 pts
  if ((!ind || ind === 'missing') && (!comp || comp === 'missing')) {
    return { points: 5, label: 'Sector unspecified' };
  }

  // Government & Public Administration: 20 pts
  if (/\b(government|ministry|public administration|department of|municipal|secretariat|psu)\b/i.test(ind) ||
      /\b(ministry of|govt of|government of|municipal corporation)\b/i.test(comp)) {
    return { points: 20, label: 'Government / Public administration' };
  }

  // Target commercial / institutional sector: 30 pts
  const targetRegex = /\b(fashion|apparel|retail|textile|education|college|university|institution|institute|trust|academy|foundation|academic|school|software|saas|it|cloud|cybersecurity|data|engineering|healthcare|pharma|finance|banking)\b/i;
  if (targetRegex.test(ind) || targetRegex.test(comp) || /\bsns\b/i.test(comp)) {
    return { points: 30, label: 'Target commercial / institutional sector' };
  }

  // Standard Commercial Organization: 20 pts
  if ((comp && comp !== 'missing') || (ind && ind !== 'missing')) {
    return { points: 20, label: 'Standard commercial organization' };
  }

  return { points: 5, label: 'Sector unspecified' };
}

function evaluateReachability(rawEmail, rawPhone, rawLinkedin, rawAddress) {
  let reachScore = 0;
  const availableChannels = [];
  const personalEmailRegex = /@(gmail|yahoo|hotmail|outlook|rediffmail|icloud|aol)(\.[a-z]+)+$/i;

  // 1. Email check (Corporate: 15 pts, Personal: 8 pts, Missing: 0 pts)
  const isEmailValid = rawEmail && rawEmail !== 'Missing' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
  if (isEmailValid) {
    const isPersonal = personalEmailRegex.test(rawEmail);
    if (!isPersonal) {
      reachScore += 15;
      availableChannels.push('Official Email: ' + rawEmail);
    } else {
      reachScore += 8;
      availableChannels.push('Personal Email: ' + rawEmail);
    }
  }

  // 2. Phone check (Valid: 10 pts, Invalid/Missing: 0 pts)
  const cleanedPhone = cleanPhoneNumber(rawPhone);
  if (cleanedPhone) {
    reachScore += 10;
    availableChannels.push('Phone: ' + rawPhone);
  }

  // 3. LinkedIn or Physical Address (5 pts max)
  const hasLinkedin = rawLinkedin && rawLinkedin !== 'Missing' && rawLinkedin.toLowerCase().includes('linkedin');
  const hasAddress = rawAddress && rawAddress !== 'Missing' && rawAddress.trim().length > 3;

  if (hasLinkedin) {
    reachScore += 5;
    availableChannels.push('LinkedIn: ' + rawLinkedin);
  } else if (hasAddress) {
    reachScore += 5;
    availableChannels.push('Location: ' + rawAddress);
  }

  return {
    points: reachScore,
    availableChannels,
    hasAnyChannel: availableChannels.length > 0
  };
}

function scoreLead(contact) {
  const rawTitle = (contact.designation || contact.Designation || contact.job_title || '').trim();
  const rawCompany = (contact.company || contact.Company || '').trim();
  const rawEmail = (contact.email || contact.Email || '').trim();
  const rawPhone = (contact.phone || contact.Phone || '').trim();
  const rawLinkedin = (contact.linkedin_url || contact.LinkedIn || '').trim();
  const rawIndustry = (contact.sector_industry || contact['Sector/Industry'] || '').trim();
  const rawAddress = (contact.address || contact.Address || contact.city || '').trim();

  // ----------------------------------------------------
  // STEP 1: Competitor Override Check
  // ----------------------------------------------------
  const isEducationalOrTrust = /\b(college|university|institution|institute|school|trust|academy|sns|hospital)\b/i.test(rawCompany);
  const aiRegex = /\b(ai|artificial intelligence|generative ai|genai|llm|machine learning|deep learning|agentic ai)\b/i;

  const isAICompetitor = !isEducationalOrTrust && (
    aiRegex.test(rawIndustry) ||
    aiRegex.test(rawCompany) ||
    aiRegex.test(rawTitle) ||
    /\b(head of ai|ai lead|ai architect|data & ai|director - ai|vp - ai|ai engineering|ai solutions)\b/i.test(rawTitle) ||
    /\b(ai vendor|ai competitor|ai solutions|ai engineering|data science & ai)\b/i.test(rawIndustry) ||
    /\b(ai solutions|ai platform|ai consulting|ai products)\b/i.test(rawCompany)
  );

  if (isAICompetitor) {
    const compScore = 20; // Standardized to 20 across all documents and code
    const tier = 'Cold';
    const tierLabel = 'Low Priority';
    const companyDisplay = rawCompany || 'AI Vendor';
    const titleDisplay = rawTitle || 'Contact';

    const reachEval = evaluateReachability(rawEmail, rawPhone, rawLinkedin, rawAddress);
    const channelStr = reachEval.availableChannels.length > 0 ? reachEval.availableChannels.join(', ') : 'None listed';

    const salesSummary = `[${tierLabel} - Score: ${compScore}/100] Profile: ${titleDisplay} at ${companyDisplay} [Sector: AI Solutions / Direct Competitor] | Available channels: ${channelStr} | Action: Direct AI industry competitor overlap. Deprioritized to Cold to avoid market conflict.`;

    return {
      score: compScore,
      tier,
      rationale: 'Direct AI company / role overlap; competitor clash with our AI offerings. Assigned to Cold priority.',
      salesSummary
    };
  }

  // ----------------------------------------------------
  // STEP 2: Calculate Base Points (Seniority + Sector + Channels)
  // ----------------------------------------------------
  const seniorityEval = evaluateSeniority(rawTitle);
  const sectorEval = evaluateSector(rawIndustry, rawCompany);
  const reachEval = evaluateReachability(rawEmail, rawPhone, rawLinkedin, rawAddress);

  let score = seniorityEval.points + sectorEval.points + reachEval.points;
  const reasons = [seniorityEval.label, sectorEval.label];
  if (reachEval.points >= 20) {
    reasons.push('High reachability');
  } else if (reachEval.points > 0) {
    reasons.push('Available contact channels');
  } else {
    reasons.push('No contact channels available');
  }

  // ----------------------------------------------------
  // STEP 3: Apply Non-Decision-Maker Cap
  // If seniority <= 5 (interns, students, clerks, unspecified), cap score at 39 (Cold)
  // ----------------------------------------------------
  if (seniorityEval.points <= 5) {
    score = Math.min(score, 39);
  }

  // ----------------------------------------------------
  // STEP 4: Apply Apex Executive Floor
  // Apex decision makers (Seniority = 40) get a floor of 85 (Hot)
  // ----------------------------------------------------
  const isApex = seniorityEval.points === 40;
  if (isApex) {
    score = Math.max(score, 85);
  }

  // ----------------------------------------------------
  // STEP 5: Apply Hot Gate
  // Hot requires seniority >= 35 or Apex floor.
  // Everyone else (seniority < 35) is capped at 69 (Warm max).
  // ----------------------------------------------------
  if (seniorityEval.points < 35) {
    score = Math.min(score, 69);
  }

  // Final bounding [0, 100]
  score = Math.min(100, Math.max(0, score));

  // ----------------------------------------------------
  // STEP 6: Final Tier Assignment from Final Score
  // ----------------------------------------------------
  let tier = 'Cold';
  if (score >= 70) {
    tier = 'Hot';
  } else if (score >= 40) {
    tier = 'Warm';
  }

  let tierLabel = 'Low Priority';
  if (tier === 'Hot') tierLabel = 'High Priority';
  else if (tier === 'Warm') tierLabel = 'Medium Priority';

  const companyDisplay = rawCompany || 'Corporate Entity';
  const titleDisplay = rawTitle || 'Executive';

  let action = '';
  if (isApex) {
    if (!reachEval.hasAnyChannel) {
      action = 'No contact channel available; research contact details prior to outreach.';
    } else {
      action = 'Apex enterprise leadership. Initiate executive briefing for strategic partnerships and institutional alignment.';
    }
  } else if (tier === 'Hot') {
    action = 'Initiate direct executive correspondence via official communication channels.';
  } else if (tier === 'Warm') {
    action = 'Send commercial introduction and case study; request connection with designated department lead.';
  } else {
    action = 'Maintain on communication list; low priority for manual direct outreach.';
  }

  const channelStr = reachEval.availableChannels.length > 0 ? reachEval.availableChannels.join(', ') : 'None listed';
  const salesSummary = `[${tierLabel} - Score: ${score}/100] Profile: ${titleDisplay} at ${companyDisplay} | Available channels: ${channelStr} | Action: ${action}`;

  return {
    score,
    tier,
    rationale: reasons.join('; '),
    salesSummary
  };
}

function processAndScoreList(rawContacts, fileName = 'Upload') {
  if (!Array.isArray(rawContacts) || rawContacts.length === 0) return [];

  const scoredContacts = [];
  const uploadTime = new Date().toISOString();

  for (const raw of rawContacts) {
    const emailVal = formatField(raw.email);
    const nameVal = formatField(raw.full_name || raw.name);
    const phoneVal = formatField(raw.phone);

    const valStatus = validateContact(emailVal, phoneVal);
    const scored = scoreLead({
      ...raw,
      full_name: nameVal,
      email: emailVal,
      phone: phoneVal
    });

    scoredContacts.push({
      full_name: nameVal,
      first_name: formatField(raw.first_name),
      last_name: formatField(raw.last_name),
      designation: formatField(raw.designation || raw.job_title),
      company: formatField(raw.company),
      email: emailVal,
      phone: phoneVal,
      address: formatField(raw.address),
      city: formatField(raw.city),
      state: formatField(raw.state),
      country: formatField(raw.country),
      sector_industry: formatField(raw.sector_industry),
      linkedin_url: formatField(raw.linkedin_url),
      website: formatField(raw.website),
      source: fileName,
      uploaded_at: uploadTime,
      validation_status: valStatus,
      duplicate_status: 'UNIQUE',
      lead_status: 'New',
      lead_score: scored.score,
      lead_tier: scored.tier,
      scoring_rationale: scored.rationale,
      sales_summary: scored.salesSummary
    });
  }

  return deduplicateContactList(scoredContacts, scoreLead);
}

function parseCSVText(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, '_'));
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    results.push({
      full_name: row.full_name || row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      designation: row.job_title || row.designation || row.title || row.role || '',
      company: row.company || row.organization || '',
      email: row.email || row.e_mail || '',
      phone: row.phone || row.mobile || row.telephone || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      sector_industry: row.sector_industry || row.industry || row.sector || '',
      linkedin_url: row.linkedin_url || row.linkedin || '',
      website: row.website || row.url || ''
    });
  }

  return results;
}

function parseCSVLine(text) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

async function extractContactsFromImage(imageBuffer, mimeType = 'image/jpeg') {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  let base64Data = '';
  if (Buffer.isBuffer(imageBuffer)) {
    base64Data = imageBuffer.toString('base64');
  } else if (typeof imageBuffer === 'string') {
    base64Data = imageBuffer.replace(/\s/g, '');
  }

  if (!base64Data) return [];

  const prompt = `Extract all contact information visible in this image. Return ONLY valid JSON in this exact structure: {"contacts":[{"full_name":"","first_name":"","last_name":"","designation":"","company":"","email":"","phone":"","address":"","city":"","state":"","country":"","sector_industry":"","linkedin_url":"","website":"","source":""}]}. Do not invent information. If a field is not visible, return an empty string.`;

  try {
    const resp = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000
      }
    );

    const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(clean);
    return Array.isArray(parsed.contacts) ? parsed.contacts : [];
  } catch (err) {
    console.warn('[leadEngine] Image extraction notice:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

module.exports = {
  formatField,
  validateContact,
  scoreLead,
  processAndScoreList,
  parseCSVText,
  extractContactsFromImage
};

