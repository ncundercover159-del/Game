// Builds one self-contained page for publishing as a claude.ai artifact:
//   npm run artifact   →   dist-artifact/hej.html
// The artifact viewer wraps the page in its own <html>/<head>/<body>, blocks service
// workers and non-CDN network requests, so JS and CSS are inlined here.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-artifact');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ARTIFACT: '1' } });

let html = readFileSync(join(OUT, 'index.html'), 'utf8');
const inlineJs = (src: string) => {
  let js = readFileSync(join(OUT, src.replace(/^\.\//, '')), 'utf8');
  // keep the HTML parser from seeing a closing tag or comment opener inside the script
  js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return js;
};
const scripts: string[] = [];
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>\s*/g, (_, src) => {
  scripts.push(`<script type="module">\n${inlineJs(src)}\n</script>`);
  return '';
});
const styles: string[] = [];
html = html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">\s*/g, (_, href) => {
  styles.push(`<style>\n${readFileSync(join(OUT, href.replace(/^\.\//, '')), 'utf8')}\n</style>`);
  return '';
});
const title = html.match(/<title>.*?<\/title>/)![0];
const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1];
const page = [
  '<title>Hej!</title>',
  '<meta name="description" content="A pixel-art life sim in Aarhus that takes you from zero to conversational Danish.">',
  ...styles,
  '<style>html,body{height:100%}body{background:#1b1f2a}</style>',
  // the viewer's skeleton sets no body class; the game's scaffolding mode lives there
  '<script>document.body.classList.add("mode-en")</script>',
  body.replace(/<noscript>.*?<\/noscript>/, ''),
  ...scripts,
].join('\n');
void title;
writeFileSync(join(OUT, 'hej.html'), page);
console.log(`✓ ${join(OUT, 'hej.html')} (${(page.length / 1024).toFixed(0)} KB)`);
