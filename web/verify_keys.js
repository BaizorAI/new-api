const fs = require('fs');
const path = require('path');

const SRC = '/Users/mq/new-api/web/default/src';
const EN_JSON = '/Users/mq/new-api/web/default/src/i18n/locales/en.json';

function findAllFiles(dir, exts) {
  const r = [];
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) r.push(...findAllFiles(path.join(dir,e.name), exts)); }
    else if (exts.some(x => e.name.endsWith(x))) r.push(path.join(dir,e.name));
  }
  return r;
}

// Method A: Simple single-line regex
const simpleS = /\bt\s*\(\s*'([^'\n]*)'/g;
const simpleD = /\bt\s*\(\s*"([^"\n]*)"/g;

// Method B: Full multi-line regex
const fullS = /\bt\s*\(\s*'((?:[^'\\]|\\.)*)'/g;
const fullD = /\bt\s*\(\s*"((?:[^"\\]|\\.)*)"/g;

const simple = new Set();
const full = new Set();
const fullMap = new Map();

const files = findAllFiles(SRC, ['.ts','.tsx','.js','.jsx']);
for (const f of files) {
  const c = fs.readFileSync(f,'utf8');
  let m;
  while ((m = simpleS.exec(c)) !== null) { let k = m[1]; if (k.length && /[a-zA-Z]/.test(k)) simple.add(k); }
  while ((m = simpleD.exec(c)) !== null) { let k = m[1]; if (k.length && /[a-zA-Z]/.test(k)) simple.add(k); }
  while ((m = fullS.exec(c)) !== null) { let k = m[1].replace(/\\'/g,"'").replace(/\\\\/g,'\\'); if (k.length && /[a-zA-Z]/.test(k)) { full.add(k); if (!fullMap.has(k)) fullMap.set(k, []); fullMap.get(k).push(f); } }
  while ((m = fullD.exec(c)) !== null) { let k = m[1].replace(/\\"/g,'"').replace(/\\\\/g,'\\'); if (k.length && /[a-zA-Z]/.test(k)) { full.add(k); if (!fullMap.has(k)) fullMap.set(k, []); fullMap.get(k).push(f); } }
}

const onlySimple = [...simple].filter(k => !full.has(k));
const onlyFull = [...full].filter(k => !simple.has(k));

console.error('Simple regex found: ' + simple.size + ' keys');
console.error('Full regex found: ' + full.size + ' keys');
console.error('Keys ONLY in simple (MISSED by full): ' + onlySimple.length);
console.error('Keys ONLY in full (MISSED by simple): ' + onlyFull.length);

// Print the keys only found by simple regex (potential false negatives for full)
if (onlySimple.length > 0) {
  console.error('\nKEYS ONLY IN SIMPLE REGEX (potentially missed by full regex):');
  for (const k of onlySimple.sort()) {
    console.error('  ' + JSON.stringify(k));
  }
}

// Load en.json and compute final missing
const enData = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
const existing = new Set(Object.keys(enData.translation));
const missing = [...full].filter(k => !existing.has(k)).sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));

console.error('\nFINAL MISSING KEYS: ' + missing.length);
for (const k of missing) {
  const srcs = fullMap.get(k) || [];
  console.log(k);
  for (const s of srcs) console.log('  -> ' + path.relative(SRC, s));
}
