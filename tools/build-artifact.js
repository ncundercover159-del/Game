/* Bundles the game into one self-contained HTML file.
 *
 *   node tools/build-artifact.js  ->  dist/crown-quest.html
 *
 * The output has no <!DOCTYPE>/<html>/<head>/<body> wrapper so it can be
 * published as a Claude Artifact (which supplies that skeleton), and it is
 * still a valid standalone page every browser will render.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'crown-quest.html');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/* Nothing in the sources may contain a closing tag for the block it gets
 * inlined into, or the browser would end the block early. */
function assertInlineSafe(rel, text, closer) {
  if (text.toLowerCase().includes(closer)) {
    throw new Error(`${rel} contains "${closer}" and cannot be inlined verbatim`);
  }
}

function build() {
  const html = read('index.html');

  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, 'Crown Quest'])[1].trim();
  const cssFiles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/gi)].map(m => m[1]);
  const jsFiles = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/gi)].map(m => m[1]);

  if (!cssFiles.length) throw new Error('no stylesheets found in index.html');
  if (!jsFiles.length) throw new Error('no scripts found in index.html');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('could not find <body> in index.html');

  // Drop the <script src> tags; their contents get inlined below instead.
  const markup = bodyMatch[1]
    .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>\s*/gi, '')
    .trim();

  const styles = cssFiles.map((f) => {
    const css = read(f);
    assertInlineSafe(f, css, '</style');
    return `/* ---- ${f} ---- */\n${css}`;
  }).join('\n');

  // Kept as separate <script> blocks so each file keeps its own top-level
  // scope, exactly as when they are loaded individually.
  const scripts = jsFiles.map((f) => {
    const js = read(f);
    assertInlineSafe(f, js, '</script');
    return `<script>\n/* ---- ${f} ---- */\n${js}\n</script>`;
  }).join('\n');

  const out = `<title>${title}</title>
<style>
${styles}
</style>

${markup}

${scripts}
`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, out, 'utf8');

  const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
  console.log(`built ${path.relative(ROOT, OUT_FILE)} — ${kb} KB`);
  console.log(`  ${cssFiles.length} stylesheet(s), ${jsFiles.length} script(s) inlined`);
}

build();
