// Reformat JSON data files in the compact house style: node tools/format-json.mjs file...
import fs from 'node:fs';
import { formatJson } from '../shared/data/jsonFormat.js';
for (const f of process.argv.slice(2)) {
  fs.writeFileSync(f, formatJson(JSON.parse(fs.readFileSync(f, 'utf8'))));
  console.log('formatted', f);
}
