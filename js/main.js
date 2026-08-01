'use strict';

/* Boot. Mobile browsers resize the visual viewport as their chrome slides
 * in and out, so the app height is pinned in JS rather than using 100vh. */
(function () {
  function setAppHeight() {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', h + 'px');
  }

  function boot() {
    setAppHeight();
    Native.init();
    Store.load();
    Levels.validate();
    UI.init();
    // Ads and the store initialise in the background; the game never waits
    // on the network to become playable.
    Ads.init().then(() => UI.refreshOffers());
    IAP.init().then(() => UI.refreshOffers());
    UI.showScreen('home');
    // Dismiss the native launch image only once the home screen has painted.
    requestAnimationFrame(() => requestAnimationFrame(() => Native.ready()));

    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 200));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setAppHeight);
      window.visualViewport.addEventListener('scroll', setAppHeight);
    }

    // Kill the mobile browser gestures that would fight with the board.
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 320) e.preventDefault();   // no double-tap zoom
      lastTouch = now;
    }, { passive: false });

    // The first touch anywhere unlocks WebAudio.
    const unlock = () => { SFX.resume(); document.removeEventListener('pointerdown', unlock); };
    document.addEventListener('pointerdown', unlock);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
