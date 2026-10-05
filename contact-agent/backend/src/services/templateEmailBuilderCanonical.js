'use strict';

/* Canonical Node entry point kept in sync with the frontend ES module. */
const fs = require('fs');
const path = require('path');
const sourcePath = path.resolve(__dirname, '../../../frontend/src/views/nurturing/templateEmailBuilderCanonical.js');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/^export \{[^\n]+\};?\s*$/m, '');
const moduleShim = { exports: {} };
new Function('module', 'exports', source + '\nmodule.exports = { interpolateTemplateVars, interpolateEmailHtmlVars, buildSnsTemplateEmailHtml, buildSnsTemplateEmailResult };')(moduleShim, moduleShim.exports);
module.exports = moduleShim.exports;
