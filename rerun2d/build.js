// Assemble the 2D build into one self-contained HTML fragment.
// The Artifact host wraps it in <!doctype html><head></head><body>, so this
// emits body content only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(dir, 'dist');
const js = fs.readFileSync(path.join(dist, 'rerun2d.js'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'rerun2d.css'), 'utf8');
const markup = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');

const safeJs = js.replace(/<\/script/gi, '<\\/script');
const out = [markup.trim(), `<style>\n${css}\n</style>`, `<script>\n${safeJs}\n</script>`, ''].join('\n\n');
const file = path.join(dist, 'rerun-2d.html');
fs.writeFileSync(file, out);
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(file);
console.log(`  markup ${kb(markup.length)}  css ${kb(css.length)}  js ${kb(js.length)}  total ${kb(out.length)}`);
