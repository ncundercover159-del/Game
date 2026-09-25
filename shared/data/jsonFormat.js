// Compact, diff-friendly JSON: objects indented, arrays of primitives and
// small objects kept on one line. Used by the track editor export and tools.
export function formatJson(value, indent = 2) {
  const pad = (n) => ' '.repeat(n);
  const isPrim = (v) => v === null || typeof v !== 'object';
  const inline = (v) => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ').replace(/\[ /g, '[').replace(/ \]/g, ']').replace(/\{ /g, '{ ').replace(/ \}/g, ' }');
  const fits = (v) => {
    const s = inline(v);
    return s.length <= 100 && (Array.isArray(v) ? v.every((x) => isPrim(x) || (Array.isArray(x) && x.every(isPrim))) : Object.values(v).every((x) => isPrim(x) || (Array.isArray(x) && x.every(isPrim))));
  };
  const walk = (v, depth) => {
    if (isPrim(v)) return JSON.stringify(v);
    if (fits(v)) return inline(v);
    const ind = pad((depth + 1) * indent);
    if (Array.isArray(v)) {
      // arrays of short primitive arrays (spline points): several per line
      if (v.every((x) => Array.isArray(x) && x.every(isPrim))) {
        const items = v.map(inline);
        const lines = [];
        let line = '';
        for (const it of items) {
          if (line && line.length + it.length > 96) { lines.push(line); line = ''; }
          line += (line ? ', ' : '') + it;
        }
        if (line) lines.push(line);
        return `[\n${lines.map((l) => ind + l).join(',\n')}\n${pad(depth * indent)}]`;
      }
      return `[\n${v.map((x) => ind + walk(x, depth + 1)).join(',\n')}\n${pad(depth * indent)}]`;
    }
    const entries = Object.entries(v).map(([k, x]) => `${ind}${JSON.stringify(k)}: ${walk(x, depth + 1)}`);
    return `{\n${entries.join(',\n')}\n${pad(depth * indent)}}`;
  };
  return walk(value, 0) + '\n';
}
