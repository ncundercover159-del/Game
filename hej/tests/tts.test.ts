import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MockSynth, run } from '../scripts/tts';

const voices = { narrator: { name: 'da-DK-Test-A', gender: 'f', rate: 1, slowRate: 0.7 } };

describe('tts pipeline', () => {
  it('generates each clip once and only regenerates changed text', async () => {
    const out = mkdtempSync(join(tmpdir(), 'hej-tts-'));
    const clipFile = {
      provider: 'google', voices,
      clips: [
        { key: 'aaa', text: 'Hej!', voice: 'narrator', slow: true },
        { key: 'bbb', text: 'Tak.', voice: 'narrator', slow: false },
      ],
    };
    const s1 = new MockSynth();
    const r1 = await run({ clipFile, outDir: out, synth: s1 });
    expect(r1.generated).toBe(3); // aaa, aaa.slow, bbb
    expect(s1.calls).toContain('da-DK-Test-A@0.7:Hej!');
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    expect(manifest.clips).toEqual({ aaa: 2, bbb: 1 });

    // second run: everything cached
    const s2 = new MockSynth();
    const r2 = await run({ clipFile, outDir: out, synth: s2 });
    expect(r2.generated).toBe(0);
    expect(s2.calls).toHaveLength(0);

    // edit one line → new key → only that clip is generated; prune removes the stale one
    writeFileSync(join(out, 'junk.mp3'), 'x');
    const edited = { ...clipFile, clips: [clipFile.clips[0], { key: 'ccc', text: 'Tak skal du have.', voice: 'narrator', slow: false }] };
    const s3 = new MockSynth();
    const r3 = await run({ clipFile: edited, outDir: out, synth: s3, prune: true });
    expect(s3.calls).toEqual(['da-DK-Test-A@1:Tak skal du have.']);
    expect(r3.pruned).toBe(2); // bbb.mp3 + junk.mp3
    expect(readdirSync(out).sort()).toEqual(['aaa.mp3', 'aaa.slow.mp3', 'ccc.mp3', 'manifest.json']);
  });
});
