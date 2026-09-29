// Plays pre-generated neural TTS clips (public/audio/<key>.mp3). Falls back to the
// browser's speechSynthesis (da-DK) only when a clip hasn't been generated yet.

import { C } from '../content';
import { IS_ARTIFACT } from '../env';

type Manifest = Record<string, number>; // 1 = normal, 2 = normal + slow

let manifest: Manifest = {};
let current: HTMLAudioElement | null = null;
let daVoice: SpeechSynthesisVoice | null = null;
let fallbackUsed = false;

export async function initAudio(): Promise<void> {
  try {
    // the artifact build ships without generated clips; use the browser's Danish voice
    if (IS_ARTIFACT) throw new Error('no clips');
    const res = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = ((await res.json()) as { clips: Manifest }).clips ?? {};
  } catch {
    manifest = {};
  }
  if ('speechSynthesis' in window) {
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      daVoice = vs.find((v) => v.lang === 'da-DK') ?? vs.find((v) => v.lang.toLowerCase().startsWith('da')) ?? null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }
}

export const audioStatus = () => ({
  clips: Object.keys(manifest).length,
  fallbackVoice: daVoice?.name ?? null,
  fallbackUsed,
});

export function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export interface PlayOpts {
  slow?: boolean;
  /** Text to speak with speechSynthesis if the clip doesn't exist. */
  text: string;
  /** Voice id (content/voices.yaml) for fallback pitch shaping. */
  voice: string;
}

/** Play a clip. Resolves when playback ends (or fails). */
export function play(key: string | undefined, o: PlayOpts): Promise<void> {
  stopAudio();
  const have = key ? manifest[key] : undefined;
  if (key && have) {
    const slowFile = o.slow && have === 2;
    const a = new Audio(`audio/${key}${slowFile ? '.slow' : ''}.mp3`);
    if (o.slow && !slowFile) {
      a.playbackRate = 0.75;
      (a as any).preservesPitch = true;
    }
    current = a;
    return new Promise((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => resolve(speak(o));
      a.play().catch(() => resolve());
    });
  }
  return speak(o);
}

function speak(o: PlayOpts): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  fallbackUsed = true;
  const u = new SpeechSynthesisUtterance(o.text);
  u.lang = 'da-DK';
  if (daVoice) u.voice = daVoice;
  const v = C.voices[o.voice];
  u.pitch = v?.pitch ?? 1;
  u.rate = (o.slow ? 0.7 : 0.95) * (v?.rate ?? 1);
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
    // Some browsers never fire onend; don't hang the UI.
    setTimeout(resolve, 800 + o.text.length * 140);
  });
}
