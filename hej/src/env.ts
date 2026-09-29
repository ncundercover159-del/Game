/** True in the single-page build published as a claude.ai artifact (no service worker, no network). */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === '1';
