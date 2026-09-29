import type { Dir } from '../content/types';
import { db } from './db';

export type Mode = 'en' | 'da' | 'bare';

export interface Settings {
  /** Scaffolding: English subtitles / Danish only (tap to reveal) / no hints. */
  mode: Mode;
  autoplay: boolean;
  /** Speak menu items on long-press / hover. */
  speakUi: boolean;
  newPerDay: number;
  /** Include speak-aloud / shadowing exercises. */
  speaking: boolean;
  /** Optional: key for AI-generated free conversation (stored only on this device). */
  aiKey: string;
  aiModel: string;
}

export interface Save {
  v: 1;
  created: number;
  name: string;
  gender: 'f' | 'm';
  map: string;
  x: number;
  y: number;
  dir: Dir;
  /** Index into content.chapters of the current chapter. */
  chapter: number;
  /** Index of the current scene in that chapter; === scenes.length when all are done. */
  scene: number;
  introDone: boolean;
  flags: Record<string, string | number | boolean>;
  rel: Record<string, number>;
  done: string[];
  passed: string[];
  mailDay: string;
  newToday: { day: string; n: number };
  stats: { reviews: number; correct: number; minutes: number };
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'en',
  autoplay: true,
  speakUi: true,
  newPerDay: 25,
  speaking: true,
  aiKey: '',
  aiModel: 'claude-opus-5-5',
};

export function newSave(name: string, gender: 'f' | 'm', spawn: { map: string; x: number; y: number; dir: Dir }): Save {
  return {
    v: 1, created: Date.now(), name, gender, ...spawn, chapter: 0, scene: 0, introDone: false,
    flags: {}, rel: {}, done: [], passed: [], mailDay: '', newToday: { day: '', n: 0 },
    stats: { reviews: 0, correct: 0, minutes: 0 },
  };
}

export const today = () => new Date().toISOString().slice(0, 10);

export async function loadSave(): Promise<Save | undefined> {
  return db.get<Save>('kv', 'save');
}
export async function writeSave(s: Save): Promise<void> {
  await db.put('kv', s, 'save');
}
export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db.get<Settings>('kv', 'settings')) ?? {}) };
}
export async function writeSettings(s: Settings): Promise<void> {
  await db.put('kv', s, 'settings');
}

export interface Report {
  t: number;
  kind: 'line' | 'word' | 'talk';
  id: string;
  da: string;
  en: string;
  cat: string;
  note: string;
  version: string;
}
export async function addReport(r: Report) {
  await db.add('reports', r);
}
export async function allReports(): Promise<Report[]> {
  return db.all<Report>('reports');
}
