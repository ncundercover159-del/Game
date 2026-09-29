// Used instead of vite-plugin-pwa in the artifact build (service workers aren't allowed there).
export function registerSW(_opts?: unknown) {
  return () => Promise.resolve();
}
