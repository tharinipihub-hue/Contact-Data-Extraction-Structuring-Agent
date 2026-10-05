'use strict';

/**
 * Occasion / Calendar Service
 * Provides region-aware occasion detection without requiring an external API.
 * The calendar data is maintained as a structured config that can be extended
 * via the OCCASION_CONFIG_URL environment variable in a future integration.
 *
 * Design principles:
 *  - No guessing of nationality from name or company.
 *  - Only uses verified structured contact fields: country, state, city, region.
 *  - Returns occasions relevant to the confirmed recipient region.
 *  - Falls back to global occasions if region is unknown.
 */

// Occasion calendar — keyed by region keyword (lowercase match against contact location)
const OCCASION_CALENDAR = [
  // ── Global / Widely celebrated ──────────────────────────────────────────────
  {
    name: 'New Year',
    date_pattern: '01-01',
    type: 'global',
    regions: ['global'],
    description: 'International New Year — Jan 1',
    tone: 'warm, celebratory, forward-looking',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Christmas',
    date_pattern: '12-25',
    type: 'global',
    regions: ['global', 'us', 'uk', 'australia', 'canada', 'europe', 'singapore', 'philippines'],
    description: 'Christmas Day',
    tone: 'warm, festive, joyful',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'New Year Eve',
    date_pattern: '12-31',
    type: 'global',
    regions: ['global'],
    description: 'New Year Eve celebrations',
    tone: 'reflective, forward-looking, warm',
    avoid: 'product promotion'
  },

  // ── India ────────────────────────────────────────────────────────────────────
  {
    name: 'Diwali',
    date_pattern: 'variable-oct-nov',
    type: 'festival',
    regions: ['india', 'in', 'indian', 'maharashtra', 'karnataka', 'tamil', 'telangana', 'gujarat', 'rajasthan', 'delhi', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad', 'chennai', 'pune'],
    description: 'Festival of Lights — typically Oct/Nov',
    tone: 'warm, luminous, celebratory, prosperous',
    avoid: 'product promotion, technical newsletter content'
  },
  {
    name: 'Pongal',
    date_pattern: '01-14',
    type: 'festival',
    regions: ['tamil', 'tamil nadu', 'india', 'in', 'chennai', 'coimbatore', 'madurai'],
    description: 'Tamil harvest festival — Jan 14/15',
    tone: 'warm, harvest-celebratory, thankful',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Ayudha Pooja',
    date_pattern: 'variable-oct',
    type: 'festival',
    regions: ['tamil', 'tamil nadu', 'india', 'in', 'karnataka', 'andhra', 'telangana', 'chennai', 'bengaluru', 'bangalore'],
    description: 'Worship of tools and instruments — Navratri 9th day',
    tone: 'respectful, professional, culturally aware',
    avoid: 'western corporate tone, product promotion'
  },
  {
    name: 'Holi',
    date_pattern: 'variable-mar',
    type: 'festival',
    regions: ['india', 'in', 'north india', 'rajasthan', 'gujarat', 'maharashtra', 'delhi', 'mumbai', 'lucknow', 'varanasi'],
    description: 'Festival of Colors — March',
    tone: 'colorful, joyful, vibrant, warm',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Onam',
    date_pattern: 'variable-aug-sep',
    type: 'festival',
    regions: ['kerala', 'india', 'in'],
    description: 'Kerala harvest festival',
    tone: 'warm, harvest-celebratory, traditional',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Eid al-Fitr',
    date_pattern: 'variable-islamic',
    type: 'festival',
    regions: ['india', 'in', 'uae', 'dubai', 'saudi', 'pakistan', 'bangladesh', 'malaysia', 'indonesia', 'middle east'],
    description: 'End of Ramadan celebration',
    tone: 'respectful, warm, joyous',
    avoid: 'product promotion, technical content, western assumptions'
  },
  {
    name: 'Independence Day India',
    date_pattern: '08-15',
    type: 'national',
    regions: ['india', 'in', 'indian'],
    description: 'Indian Independence Day — Aug 15',
    tone: 'patriotic, proud, professionally warm',
    avoid: 'product promotion, political statements'
  },
  {
    name: 'Republic Day India',
    date_pattern: '01-26',
    type: 'national',
    regions: ['india', 'in', 'indian'],
    description: 'Indian Republic Day — Jan 26',
    tone: 'patriotic, professionally warm, respectful',
    avoid: 'product promotion, political statements'
  },
  {
    name: 'Gandhi Jayanti',
    date_pattern: '10-02',
    type: 'national',
    regions: ['india', 'in'],
    description: 'Gandhi Jayanti — Oct 2',
    tone: 'respectful, peaceful, reflective',
    avoid: 'product promotion, casual tone'
  },
  {
    name: 'Dussehra',
    date_pattern: 'variable-oct',
    type: 'festival',
    regions: ['india', 'in', 'karnataka', 'tamil', 'maharashtra', 'delhi'],
    description: 'Vijayadasami / Dussehra — victory of good over evil',
    tone: 'celebratory, victorious, warm',
    avoid: 'product promotion'
  },
  {
    name: 'Navratri',
    date_pattern: 'variable-oct',
    type: 'festival',
    regions: ['india', 'in', 'gujarat', 'rajasthan', 'maharashtra', 'west bengal'],
    description: 'Nine nights festival',
    tone: 'festive, warm, devotional respect',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Ugadi / Gudi Padwa',
    date_pattern: 'variable-mar-apr',
    type: 'festival',
    regions: ['karnataka', 'andhra', 'telangana', 'maharashtra', 'india', 'in', 'bengaluru', 'hyderabad', 'pune', 'mumbai'],
    description: 'Telugu / Kannada / Marathi New Year',
    tone: 'new beginnings, warm, prosperous',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Tamil New Year / Puthandu',
    date_pattern: '04-14',
    type: 'festival',
    regions: ['tamil', 'tamil nadu', 'india', 'in', 'chennai', 'singapore'],
    description: 'Tamil New Year — April 14',
    tone: 'warm, new beginnings, prosperous',
    avoid: 'product promotion, technical content'
  },

  // ── United States ────────────────────────────────────────────────────────────
  {
    name: 'Thanksgiving',
    date_pattern: 'variable-nov',
    type: 'cultural',
    regions: ['us', 'usa', 'united states', 'america', 'american'],
    description: 'US Thanksgiving — 4th Thursday of November',
    tone: 'grateful, warm, appreciative',
    avoid: 'product promotion, overly commercial'
  },
  {
    name: 'Independence Day USA',
    date_pattern: '07-04',
    type: 'national',
    regions: ['us', 'usa', 'united states', 'america', 'american'],
    description: 'US Independence Day — July 4',
    tone: 'patriotic, warm, celebratory',
    avoid: 'product promotion, political statements'
  },
  {
    name: 'Memorial Day',
    date_pattern: 'variable-may',
    type: 'national',
    regions: ['us', 'usa', 'united states', 'america', 'american'],
    description: 'US Memorial Day — last Monday of May',
    tone: 'respectful, reflective, solemn',
    avoid: 'promotional tone, casual'
  },
  {
    name: 'Labor Day USA',
    date_pattern: 'variable-sep',
    type: 'national',
    regions: ['us', 'usa', 'united states', 'america', 'american'],
    description: 'US Labor Day — 1st Monday of September',
    tone: 'appreciative, professional',
    avoid: 'product promotion'
  },

  // ── United Kingdom ───────────────────────────────────────────────────────────
  {
    name: 'Bonfire Night',
    date_pattern: '11-05',
    type: 'cultural',
    regions: ['uk', 'united kingdom', 'england', 'britain', 'british'],
    description: 'Guy Fawkes Night — Nov 5',
    tone: 'warm, festive, culturally aware',
    avoid: 'product promotion'
  },

  // ── Singapore / Southeast Asia ───────────────────────────────────────────────
  {
    name: 'Chinese New Year',
    date_pattern: 'variable-jan-feb',
    type: 'festival',
    regions: ['singapore', 'china', 'hong kong', 'taiwan', 'malaysia', 'vietnam', 'chinese'],
    description: 'Lunar New Year',
    tone: 'prosperous, joyful, celebratory',
    avoid: 'product promotion, technical content'
  },
  {
    name: 'Singapore National Day',
    date_pattern: '08-09',
    type: 'national',
    regions: ['singapore', 'sg'],
    description: 'Singapore National Day — Aug 9',
    tone: 'patriotic, warm, professional',
    avoid: 'product promotion'
  },
  {
    name: 'Vesak Day',
    date_pattern: 'variable-may',
    type: 'religious',
    regions: ['singapore', 'thailand', 'sri lanka', 'malaysia', 'buddhist'],
    description: 'Buddhist celebration',
    tone: 'respectful, peaceful, contemplative',
    avoid: 'promotional, casual'
  },

  // ── UAE / Middle East ────────────────────────────────────────────────────────
  {
    name: 'UAE National Day',
    date_pattern: '12-02',
    type: 'national',
    regions: ['uae', 'dubai', 'abu dhabi', 'sharjah', 'united arab emirates'],
    description: 'UAE National Day — Dec 2',
    tone: 'patriotic, warm, professional',
    avoid: 'product promotion'
  },
  {
    name: 'Eid al-Adha',
    date_pattern: 'variable-islamic',
    type: 'festival',
    regions: ['uae', 'dubai', 'saudi', 'india', 'in', 'pakistan', 'bangladesh', 'malaysia', 'indonesia', 'middle east'],
    description: 'Festival of Sacrifice',
    tone: 'respectful, warm, considerate',
    avoid: 'product promotion, western assumptions'
  },

  // ── Australia ────────────────────────────────────────────────────────────────
  {
    name: 'Australia Day',
    date_pattern: '01-26',
    type: 'national',
    regions: ['australia', 'au', 'australian'],
    description: 'Australia Day — Jan 26',
    tone: 'professional, warm',
    avoid: 'product promotion'
  },

  // ── Corporate / Professional ─────────────────────────────────────────────────
  {
    name: 'World Environment Day',
    date_pattern: '06-05',
    type: 'corporate',
    regions: ['global'],
    description: 'World Environment Day — June 5',
    tone: 'sustainability-aware, professional, commitment-focused',
    avoid: 'greenwashing, promotional'
  },
  {
    name: 'International Womens Day',
    date_pattern: '03-08',
    type: 'corporate',
    regions: ['global'],
    description: "International Women's Day — March 8",
    tone: 'empowering, celebratory, inclusive',
    avoid: 'superficial statements, promotional'
  }
];

/**
 * Determine the recipient's region from available structured contact fields.
 * Only uses explicit fields — never guesses from name/company.
 *
 * Priority: country > state > city > location string
 *
 * @param {Object} contact
 * @returns {string} — lowercase region string or 'unknown'
 */
function detectContactRegion(contact) {
  if (!contact) return 'unknown';
  const fields = [
    contact.country,
    contact.state,
    contact.city,
    contact.location,
    contact.region
  ].filter(Boolean).map(f => String(f).toLowerCase().trim());
  return fields.join(' ') || 'unknown';
}

/**
 * Returns occasions relevant to a contact's confirmed region.
 * Always includes global occasions.
 * Returns regional occasions only when location data confirms the region.
 *
 * @param {Object} contact
 * @returns {{ applicable: Array, region: string, regionKnown: boolean }}
 */
function getApplicableOccasions(contact) {
  const regionStr = detectContactRegion(contact);
  const regionKnown = regionStr !== 'unknown' && regionStr.length > 0;

  const applicable = OCCASION_CALENDAR.filter(occasion => {
    // Always include global occasions
    if (occasion.regions.includes('global')) return true;
    // Include regional only if region is confirmed
    if (!regionKnown) return false;
    return occasion.regions.some(r => regionStr.includes(r) || r.includes(regionStr.split(' ')[0]));
  });

  return {
    applicable,
    region: regionStr || 'unknown',
    regionKnown
  };
}

/**
 * Returns all upcoming occasions (within next N days) for a contact's region.
 *
 * @param {Object} contact
 * @param {number} windowDays — how many days ahead to look (default: 60)
 * @returns {Array}
 */
function getUpcomingOccasions(contact, windowDays = 60) {
  const { applicable } = getApplicableOccasions(contact);
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();

  // For occasions with fixed dates, calculate upcoming
  const upcoming = applicable
    .filter(occ => {
      if (occ.date_pattern.startsWith('variable')) return true; // Always include variable dates
      const [, occMonth, occDay] = occ.date_pattern.split('-').map(Number);
      if (!occMonth || !occDay) return true;
      // Check if within windowDays
      const occDate = new Date(now.getFullYear(), occMonth - 1, occDay);
      if (occDate < now) {
        // Check next year
        const nextYear = new Date(now.getFullYear() + 1, occMonth - 1, occDay);
        return (nextYear - now) / 86400000 <= windowDays;
      }
      return (occDate - now) / 86400000 <= windowDays;
    })
    .map(occ => {
      let daysUntil = null;
      if (!occ.date_pattern.startsWith('variable')) {
        const [, occMonth, occDay] = occ.date_pattern.split('-').map(Number);
        if (occMonth && occDay) {
          let occDate = new Date(now.getFullYear(), occMonth - 1, occDay);
          if (occDate < now) occDate = new Date(now.getFullYear() + 1, occMonth - 1, occDay);
          daysUntil = Math.ceil((occDate - now) / 86400000);
        }
      }
      return { ...occ, days_until: daysUntil };
    })
    .sort((a, b) => {
      if (a.days_until === null && b.days_until === null) return 0;
      if (a.days_until === null) return 1;
      if (b.days_until === null) return -1;
      return a.days_until - b.days_until;
    });

  return upcoming;
}

/**
 * Returns all occasions in the calendar (for the UI picker).
 */
function getAllOccasions() {
  return OCCASION_CALENDAR;
}

/**
 * Build the Workbench occasion payload for a given occasion name and contact.
 *
 * @param {string} occasionName
 * @param {Object} contact
 * @returns {Object}
 */
function buildOccasionPayload(occasionName, contact) {
  const occasion = OCCASION_CALENDAR.find(o =>
    o.name.toLowerCase() === (occasionName || '').toLowerCase()
  ) || null;

  const regionStr = detectContactRegion(contact);
  const regionKnown = regionStr !== 'unknown' && regionStr.length > 0;

  return {
    occasion: occasionName,
    occasion_type: occasion?.type || 'festival',
    occasion_description: occasion?.description || occasionName,
    occasion_tone: occasion?.tone || 'warm, professional, respectful',
    occasion_avoid: occasion?.avoid || 'product promotion',
    region: regionStr || 'unknown',
    region_known: regionKnown,
    recipient_region: regionStr || 'unknown',
    date: new Date().toISOString().slice(0, 10)
  };
}

module.exports = {
  OCCASION_CALENDAR,
  getAllOccasions,
  getApplicableOccasions,
  getUpcomingOccasions,
  buildOccasionPayload,
  detectContactRegion
};
