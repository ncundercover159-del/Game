'use strict';

/* Native shell integration for the iOS (Capacitor) build.
 *
 * Capacitor injects `window.Capacitor` into the WebView before our scripts
 * run, so plugins are reachable as plain globals — no bundler needed. Every
 * call below is feature-detected, so the same files still run as a plain web
 * page in any browser. */
const Native = {
  available: false,
  platform: 'web',
  _lastHaptic: 0,

  plugin(name) {
    const cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins[name]) || null;
  },

  init() {
    const cap = window.Capacitor;
    this.available = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    this.platform = (cap && typeof cap.getPlatform === 'function') ? cap.getPlatform() : 'web';
    if (!this.available) return;

    document.documentElement.classList.add('is-native', 'platform-' + this.platform);

    // Full-bleed game: the board should run under the notch, with the safe
    // area handled in CSS.
    const statusBar = this.plugin('StatusBar');
    if (statusBar) {
      if (statusBar.setOverlaysWebView) statusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      if (statusBar.setStyle) statusBar.setStyle({ style: 'DARK' }).catch(() => {});
      if (statusBar.hide) statusBar.hide().catch(() => {});
    }

    // Mute and idle out while backgrounded so we do not burn battery or
    // keep an audio session open behind another app.
    const app = this.plugin('App');
    if (app && app.addListener) {
      app.addListener('appStateChange', (state) => this.onAppState(!!state.isActive)).catch(() => {});
    }

    document.addEventListener('visibilitychange', () => this.onAppState(!document.hidden));
  },

  /* Called once the first screen has painted, so the launch image never
   * cuts to a blank frame. */
  ready() {
    if (!this.available) return;
    const splash = this.plugin('SplashScreen');
    if (splash && splash.hide) splash.hide({ fadeOutDuration: 250 }).catch(() => {});
  },

  onAppState(isActive) {
    const game = (typeof UI !== 'undefined' && UI.game) ? UI.game : null;
    if (isActive) {
      if (SFX.enabled) SFX.resume();
      if (game) game.resize();
    } else if (SFX.ctx && SFX.ctx.state === 'running') {
      SFX.ctx.suspend().catch(() => {});
    }
  },

  // ------------------------------------------------------------- haptics

  /* iOS coalesces rapid haptics and they cost battery, so cascades get one
   * tap rather than one per cleared gem. */
  haptic(kind) {
    if (!this.available) return;
    const haptics = this.plugin('Haptics');
    if (!haptics) return;

    const now = Date.now();
    const isNotification = kind === 'success' || kind === 'warning' || kind === 'error';
    if (!isNotification && now - this._lastHaptic < 70) return;
    this._lastHaptic = now;

    try {
      switch (kind) {
        case 'light': haptics.impact({ style: 'LIGHT' }); break;
        case 'medium': haptics.impact({ style: 'MEDIUM' }); break;
        case 'heavy': haptics.impact({ style: 'HEAVY' }); break;
        case 'select': haptics.selectionChanged ? haptics.selectionChanged() : haptics.impact({ style: 'LIGHT' }); break;
        case 'success': haptics.notification({ type: 'SUCCESS' }); break;
        case 'warning': haptics.notification({ type: 'WARNING' }); break;
        case 'error': haptics.notification({ type: 'ERROR' }); break;
      }
    } catch (e) { /* haptics are a nicety, never fail the turn over them */ }
  },
};
