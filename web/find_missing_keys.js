const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/Users/mq/new-api';
const SRC_DIR = path.join(PROJECT_ROOT, 'web/default/src');
const EN_JSON_PATH = path.join(PROJECT_ROOT, 'web/default/src/i18n/locales/en.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'missing_keys.txt');

// 1. Load existing keys from en.json
console.error('Loading en.json...');
const enRaw = fs.readFileSync(EN_JSON_PATH, 'utf-8');
const enData = JSON.parse(enRaw);
const existingKeys = new Set(Object.keys(enData.translation));
console.error('  Found ' + existingKeys.size + ' keys in en.json');

// 2. Find all source files recursively
function findAllFiles(dir, extensions) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      results.push(...findAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

console.error('Finding source files...');
const sourceFiles = findAllFiles(SRC_DIR, ['.ts', '.tsx', '.js', '.jsx']);
console.error('  Found ' + sourceFiles.length + ' source files');

// 3. Robust extraction of t() call string arguments
// Match t('single-quoted content') or t("double-quoted content")
// Supports: t('...'), t("..."), i18next.t('...'), i18n.t('...'), {t('...')}
// Handles escaped quotes within the string: t('it\'s ok') or t("he said \"hi\"")
// Can match across multiple lines since JSX often has t() calls spanning lines

const SINGLE_QUOTE_REGEX = /\bt\s*\(\s*'((?:[^'\\]|\\.)*)'/g;
const DOUBLE_QUOTE_REGEX = /\bt\s*\(\s*"((?:[^"\\]|\\.)*)"/g;

const allUsedKeys = new Set();

function extractKeysFromContent(content) {
  // First pass: try to isolate template literal regions by removing them
  // Template literals with backticks: t(`dynamic-${var}-key`) - these are dynamic, skip
  // But we need a different approach since simple removal can corrupt the content

  for (const regex of [SINGLE_QUOTE_REGEX, DOUBLE_QUOTE_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const rawContent = match[1];

      // Unescape escaped quotes
      let inner = rawContent;
      inner = inner.replace(/\\'/g, "'");
      inner = inner.replace(/\\"/g, '"');
      inner = inner.replace(/\\n/g, '\n');
      inner = inner.replace(/\\t/g, '\t');
      inner = inner.replace(/\\\\/g, '\\');

      if (inner.length === 0) continue;

      // Skip keys that are clearly not actual translation keys
      // (e.g., pure URLs, code snippets accidentally matched)
      // A translation key should be meaningful text

      // Skip if the key matches a URL pattern
      if (/^https?:/.test(inner)) continue;

      // Skip if the key is a pure JSX/code fragment (no actual words)
      // Most translation keys contain at least one alphabetic character
      if (!/[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(inner)) continue;

      allUsedKeys.add(inner);
    }
  }
}

console.error('Extracting t() calls...');
let filesProcessed = 0;
for (const file of sourceFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    extractKeysFromContent(content);
    filesProcessed++;
  } catch (err) {
    console.error('  Error reading ' + file);
  }
}
console.error('  Processed ' + filesProcessed + ' files');
console.error('  Found ' + allUsedKeys.size + ' unique t() string literals');

// 4. Compute missing keys
console.error('Computing missing keys...');
const missingKeys = [];
for (const key of allUsedKeys) {
  if (!existingKeys.has(key)) {
    missingKeys.push(key);
  }
}

missingKeys.sort((a, b) => {
  const la = a.toLowerCase(), lb = b.toLowerCase();
  if (la < lb) return -1; if (la > lb) return 1; return 0;
});

console.error('  Found ' + missingKeys.length + ' MISSING keys');

let output = '';
output += '# Missing i18n Translation Keys\n';
output += '# =============================\n';
output += '# These keys are used in the frontend source code via t(\'...\') calls\n';
output += '# but are NOT present in en.json translation file.\n';
output += '#\n';
output += '# Total keys in en.json: ' + existingKeys.size + '\n';
output += '# Total unique t() string literals found: ' + allUsedKeys.size + '\n';
output += '# Total MISSING keys: ' + missingKeys.length + '\n';
output += '#\n';
output += '# Keys are sorted alphabetically (case-insensitive).\n';
output += '# =============================\n\n';
output += missingKeys.join('\n') + '\n';

fs.writeFileSync(OUTPUT_PATH, output, 'utf-8');
console.error('Done! Output: ' + OUTPUT_PATH);
