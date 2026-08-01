/* Assembles the web assets Capacitor copies into the native app bundle.
 *
 *   node tools/build-www.js   ->  www/
 *
 * Capacitor ships everything inside `webDir`, so this stages only the files
 * the game actually needs — never node_modules, tools or the git metadata.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

/* Sources are listed explicitly rather than globbed so a stray file in the
 * repo can never end up shipping inside the app. */
const FILES = ['index.html'];
const DIRS = ['css', 'js'];

function copyDir(rel) {
  const from = path.join(ROOT, rel);
  const to = path.join(WWW, rel);
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    if (fs.statSync(src).isDirectory()) continue;
    fs.copyFileSync(src, path.join(to, name));
    n++;
  }
  return n;
}

function build() {
  // Verify every script referenced by index.html is actually staged, so a
  // newly added file cannot be silently missing from the shipped app.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const refs = [
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => m[1]),
    ...[...html.matchAll(/<link[^>]+href="([^"]+\.css)"/gi)].map(m => m[1]),
  ];

  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });

  for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
  let count = FILES.length;
  for (const d of DIRS) count += copyDir(d);

  const missing = refs.filter(r => !fs.existsSync(path.join(WWW, r)));
  if (missing.length) {
    throw new Error('index.html references files that were not staged: ' + missing.join(', '));
  }

  console.log(`staged ${count} files into www/ (${refs.length} referenced by index.html)`);
}

build();
