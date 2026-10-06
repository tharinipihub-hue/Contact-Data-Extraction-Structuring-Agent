'use strict';

/**
 * Node entry point for the canonical campaign-type registry.
 *
 * Loads the exact same ES module the frontend imports
 * (frontend/src/campaignTypes.js) using the same `new Function` shim already
 * used by templateEmailBuilderCanonical.js. There is a single source of truth,
 * so the backend and frontend campaign-type mappings cannot drift.
 */

const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../../frontend/src/campaignTypes.js');
const source = fs
  .readFileSync(sourcePath, 'utf8')
  .replace(/^export\s*\{[^}]*\};?\s*$/m, '')
  .replace(/^export\s+(const|function)\s/gm, '$1 ');

const moduleShim = { exports: {} };
new Function(
  'module',
  'exports',
  source +
    '\nmodule.exports = { CANONICAL_CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_ALIASES,' +
    ' CAMPAIGN_TYPE_DESCRIPTIONS, normalizeCampaignType, isSupportedCampaignType,' +
    ' campaignTypeLabel, campaignTypeOptions };'
)(moduleShim, moduleShim.exports);

module.exports = moduleShim.exports;