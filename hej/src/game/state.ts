import type { Save, Settings } from '../store/save';
import { DEFAULT_SETTINGS } from '../store/save';

/** Mutable app-wide state. The save is null until a game is started or loaded. */
export const S: { save: Save | null; settings: Settings } = {
  save: null,
  settings: { ...DEFAULT_SETTINGS },
};

export const who = () => ({ gender: S.save?.gender ?? 'f', name: S.save?.name ?? '' }) as const;
