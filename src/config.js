// Engine-wide constants. Gameplay numbers live in src/data.
export const TILE = 16;
export const SIM_HZ = 60;
export const STEP = 1 / SIM_HZ;

// Logical viewport: the world is drawn at this resolution and upscaled by an integer factor.
export const VIEW = { idealH: 270, minH: 230, maxH: 290, minW: 420 };

export const SAVE_VERSION = 2;
export const SAVE_SLOTS = 3;
