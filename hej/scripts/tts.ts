// Build-time audio generation with Google Cloud Text-to-Speech (da-DK neural voices).
//
//   GOOGLE_TTS_API_KEY=… npm run audio          generate missing clips
//   npm run audio:dry                           show what would be generated + character count
//   npm run audio:voices                        list the da-DK voices your key can use
//   npm run audio -- --prune                    also delete clips no longer referenced
//
// Reads src/generated/clips.json (written by `npm run content`). Each clip's file name is a
// hash of provider + voice + rate + text, so editing one line regenerates only that clip and
// everything already on disk is skipped. Writes public/audio/<key>.mp3 (+ <key>.slow.mp3 for
// sentences) and public/audio/manifest.json, which the game uses to decide between the real
// clip and the speechSynthesis fallback.
//
// The key can also live in hej/.env as GOOGLE_TTS_API_KEY=… (git-ignored).

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

interface VoiceDef { name: string; gender: string; rate: number; slowRate: number }
interface Clip { key: string; text: string; voice: string; slow: boolean }
interface ClipFile { provider: string; voices: Record<string, VoiceDef>; clips: Clip[] }

export interface Synth {
  synthesize(text: string, voice: VoiceDef, rate: number): Promise<Buffer>;
}

function loadEnvKey(): string | undefined {
  if (process.env.GOOGLE_TTS_API_KEY) return process.env.GOOGLE_TTS_API_KEY;
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return undefined;
  const m = readFileSync(envFile, 'utf8').match(/^GOOGLE_TTS_API_KEY\s*=\s*(.+)$/m);
  return m?.[1].trim().replace(/^["']|["']$/g, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GoogleSynth implements Synth {
  constructor(private key: string) {}

  async synthesize(text: string, voice: VoiceDef, rate: number): Promise<Buffer> {
    const body = {
      input: { text },
      voice: { languageCode: 'da-DK', name: voice.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: rate },
    };
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(this.key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = (await res.json()) as { audioContent: string };
        return Buffer.from(json.audioContent, 'base64');
      }
      const detail = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      throw new Error(`Google TTS ${res.status} for voice ${voice.name}: ${detail.slice(0, 300)}`);
    }
  }

  async listVoices(): Promise<{ name: string; ssmlGender: string; languageCodes: string[] }[]> {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=da-DK&key=${encodeURIComponent(this.key)}`);
    if (!res.ok) throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
    return ((await res.json()) as any).voices ?? [];
  }
}

/** Deterministic fake for tests: writes the text itself so files are inspectable. */
export class MockSynth implements Synth {
  calls: string[] = [];
  async synthesize(text: string, voice: VoiceDef, rate: number): Promise<Buffer> {
    this.calls.push(`${voice.name}@${rate}:${text}`);
    return Buffer.from(`MOCK ${voice.name} ${rate} ${text}`);
  }
}

export interface RunResult {
  generated: number;
  skipped: number;
  failed: string[];
  chars: number;
  pruned: number;
  pending: number;
}

export async function run(opts: {
  clipFile: ClipFile;
  outDir: string;
  synth: Synth | null; // null = dry run
  prune?: boolean;
  concurrency?: number;
  log?: (s: string) => void;
}): Promise<RunResult> {
  const { clipFile, outDir, synth } = opts;
  const log = opts.log ?? (() => {});
  mkdirSync(outDir, { recursive: true });
  const jobs: { file: string; text: string; voice: VoiceDef; rate: number; slow: boolean }[] = [];
  for (const c of clipFile.clips) {
    const v = clipFile.voices[c.voice];
    jobs.push({ file: `${c.key}.mp3`, text: c.text, voice: v, rate: v.rate, slow: false });
    if (c.slow) jobs.push({ file: `${c.key}.slow.mp3`, text: c.text, voice: v, rate: v.slowRate, slow: true });
  }
  const todo = jobs.filter((j) => !existsSync(join(outDir, j.file)));
  const result: RunResult = {
    generated: 0, skipped: jobs.length - todo.length, failed: [],
    chars: todo.reduce((n, j) => n + j.text.length, 0), pruned: 0, pending: todo.length,
  };
  if (synth) {
    const slowUnsupported = new Set<string>();
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const j = todo[i++];
        if (j.slow && slowUnsupported.has(j.voice.name)) continue;
        try {
          const buf = await synth.synthesize(j.text, j.voice, j.rate);
          writeFileSync(join(outDir, j.file), buf);
          result.generated++;
          if (result.generated % 25 === 0) log(`  … ${result.generated}/${todo.length}`);
        } catch (e) {
          const msg = (e as Error).message;
          // Some voices reject speakingRate; the game then slows the normal clip itself.
          if (j.slow && /speaking.?rate|not supported/i.test(msg)) {
            slowUnsupported.add(j.voice.name);
            log(`  ! ${j.voice.name} doesn't support speakingRate; slow playback will use the normal clip`);
          } else {
            result.failed.push(`${j.file} "${j.text}": ${msg}`);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  }

  // Manifest: 1 = normal clip only, 2 = normal + slow.
  const wanted = new Set(jobs.map((j) => j.file));
  const manifest: Record<string, number> = {};
  for (const c of clipFile.clips) {
    if (!existsSync(join(outDir, `${c.key}.mp3`))) continue;
    manifest[c.key] = existsSync(join(outDir, `${c.key}.slow.mp3`)) ? 2 : 1;
  }
  if (opts.prune) {
    for (const f of readdirSync(outDir)) {
      if (f.endsWith('.mp3') && !wanted.has(f)) {
        unlinkSync(join(outDir, f));
        result.pruned++;
      }
    }
  }
  if (synth || existsSync(join(outDir, 'manifest.json')) || Object.keys(manifest).length) {
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ v: 1, clips: manifest }));
  }
  return result;
}

async function main() {
  const clipPath = join(ROOT, 'src/generated/clips.json');
  if (!existsSync(clipPath)) {
    console.error('src/generated/clips.json not found — run `npm run content` first.');
    process.exit(1);
  }
  const clipFile: ClipFile = JSON.parse(readFileSync(clipPath, 'utf8'));
  if (clipFile.provider !== 'google') {
    console.error(`content/voices.yaml provider is "${clipFile.provider}"; this script supports "google".`);
    process.exit(1);
  }
  const outDir = opt('--out') ?? join(ROOT, 'public/audio');
  const dry = flag('--dry-run');
  const key = loadEnvKey();

  if (flag('--list-voices')) {
    if (!key) throw new Error('Set GOOGLE_TTS_API_KEY to list voices.');
    const voices = await new GoogleSynth(key).listVoices();
    for (const v of voices.sort((a, b) => a.name.localeCompare(b.name))) console.log(`${v.name.padEnd(36)} ${v.ssmlGender}`);
    const used = new Set(Object.values(clipFile.voices).map((v) => v.name));
    const missing = [...used].filter((u) => !voices.some((v) => v.name === u));
    if (missing.length) console.log(`\n! Voices in content/voices.yaml not available to this key: ${missing.join(', ')}`);
    return;
  }

  if (!dry && !key) {
    console.error('No GOOGLE_TTS_API_KEY set (env or hej/.env). Use `npm run audio:dry` to preview.\n' +
      'Until clips exist the game falls back to the browser\'s speechSynthesis.');
    process.exit(1);
  }
  const synth = dry ? null : new GoogleSynth(key!);
  const r = await run({ clipFile, outDir, synth, prune: flag('--prune'), log: console.log });
  if (dry) {
    console.log(`Dry run: ${r.skipped} clip files already exist; ${r.pending} to generate ` +
      `(${r.chars.toLocaleString()} characters). At Google's premium-voice rates that is cents at most, and usually inside the free monthly allowance.`);
    return;
  }
  console.log(`✓ audio: ${r.generated} generated, ${r.skipped} cached, ${r.pruned} pruned, ${r.failed.length} failed`);
  if (r.failed.length) {
    console.error(r.failed.slice(0, 20).map((f) => '  ✗ ' + f).join('\n'));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
