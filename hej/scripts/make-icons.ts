// Generates the PWA icons as pixel art (no image dependencies): a speech bubble in
// Dannebrog colours. Run `npm run icons`; output goes to public/icons/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 16×16 design. . = background, r = red, w = white, d = dark outline
const ART = [
  '................',
  '................',
  '..dddddddddddd..',
  '.drrrwwrrrrrrrd.',
  '.drrrwwrrrrrrrd.',
  '.drrrwwrrrrrrrd.',
  '.dwwwwwwwwwwwwd.',
  '.dwwwwwwwwwwwwd.',
  '.drrrwwrrrrrrrd.',
  '.drrrwwrrrrrrrd.',
  '.drrrwwrrrrrrrd.',
  '..dddddddddddd..',
  '....ddrd........',
  '.....drd........',
  '......dd........',
  '................',
];
const COLORS: Record<string, [number, number, number, number]> = {
  r: [200, 16, 46, 255],
  w: [255, 255, 255, 255],
  d: [40, 20, 30, 255],
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size: number, bg: [number, number, number, number], pad: number): Buffer {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const inner = size - pad * 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let px = bg;
      const ix = Math.floor(((x - pad) / inner) * 16);
      const iy = Math.floor(((y - pad) / inner) * 16);
      if (ix >= 0 && iy >= 0 && ix < 16 && iy < 16) px = COLORS[ART[iy][ix]] ?? bg;
      raw.set(px, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(ROOT, 'public/icons');
mkdirSync(out, { recursive: true });
const BG: [number, number, number, number] = [255, 230, 170, 255];
writeFileSync(join(out, 'icon-192.png'), png(192, BG, 0));
writeFileSync(join(out, 'icon-512.png'), png(512, BG, 0));
writeFileSync(join(out, 'icon-maskable-512.png'), png(512, BG, 64));
writeFileSync(join(out, 'favicon-32.png'), png(32, [0, 0, 0, 0], 0));
console.log('✓ icons written to public/icons');
