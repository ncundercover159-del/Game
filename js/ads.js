'use strict';

/* AdMob integration.
 *
 * Uses @capacitor-community/admob, reached through the global bridge that
 * Capacitor injects (window.Capacitor.Plugins.AdMob) so no bundler is
 * required. When that plugin is absent — a browser, or the artifact build —
 * every placement falls back to an on-screen simulator, so the whole flow
 * (frequency caps, rewards, Remove Ads gating) can be exercised without a
 * device. */
const Ads = {
  ready: false,
  bannerVisible: false,
  _interstitialLoaded: false,
  _rewardedLoaded: false,
  _busy: false,

  plugin() { return Native.plugin('AdMob'); },

  /* Real SDK present, as opposed to the browser simulator. */
  get native() { return AdConfig.enabled && !!this.plugin(); },

  /* Ads are switched off entirely once Remove Ads is owned. Rewarded video
   * is deliberately exempt — see shouldShow(). */
  get removed() { return !!Store.data.removeAds; },

  unit(kind) {
    if (AdConfig.testMode) return AdConfig.testIds[kind];
    return (AdConfig.ios && AdConfig.ios[kind]) || AdConfig.testIds[kind];
  },

  /* Interstitials and banners are suppressed by a purchase; rewarded video
   * is opt-in so it always stays available. */
  shouldShow(kind) {
    if (!AdConfig.enabled) return false;
    if (kind === 'rewarded') return true;
    return !this.removed;
  },

  async init() {
    if (!AdConfig.enabled) return;
    const admob = this.plugin();
    if (!admob) { this.ready = true; return; }   // simulator mode

    try {
      await admob.initialize({
        initializeForTesting: !!AdConfig.testMode,
        // Only ask for tracking when we actually intend to personalise.
        requestTrackingAuthorization: !AdConfig.nonPersonalizedOnly,
      });
      this.ready = true;
      this.preload();
    } catch (e) {
      console.warn('[Ads] initialize failed', e);
      this.ready = false;
    }
  },

  /* Shared options: `npa` asks AdMob for a non-personalised ad. */
  opts(kind) {
    return {
      adId: this.unit(kind),
      isTesting: !!AdConfig.testMode,
      npa: !!AdConfig.nonPersonalizedOnly,
    };
  },

  /* Ads take seconds to fetch, so the next one is always loading in the
   * background — asking at the moment of use would show nothing. */
  preload() {
    const admob = this.plugin();
    if (!admob || !this.ready) return;
    if (this.shouldShow('interstitial') && !this._interstitialLoaded && admob.prepareInterstitial) {
      admob.prepareInterstitial(this.opts('interstitial'))
        .then(() => { this._interstitialLoaded = true; })
        .catch(() => { this._interstitialLoaded = false; });
    }
    if (!this._rewardedLoaded && admob.prepareRewardVideoAd) {
      admob.prepareRewardVideoAd(this.opts('rewarded'))
        .then(() => { this._rewardedLoaded = true; })
        .catch(() => { this._rewardedLoaded = false; });
    }
  },

  // -------------------------------------------------------------- banner

  async showBanner() {
    if (!AdConfig.banner.enabled || !this.shouldShow('banner')) return;
    const admob = this.plugin();
    if (!admob) { this.showSimBanner(); return; }
    try {
      await admob.showBanner(Object.assign(this.opts('banner'), {
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0,
      }));
      this.bannerVisible = true;
      this.setBannerSpace(true);
    } catch (e) {
      this.setBannerSpace(false);
    }
  },

  async hideBanner() {
    this.setBannerSpace(false);
    this.bannerVisible = false;
    const sim = document.getElementById('ad-sim-banner');
    if (sim) sim.remove();
    const admob = this.plugin();
    if (!admob) return;
    try { if (admob.hideBanner) await admob.hideBanner(); } catch (e) { /* nothing showing */ }
  },

  /* Off-device the banner slot would just be a gap, which reads as a layout
   * bug — draw a labelled placeholder at exactly the reserved height so the
   * spacing can be checked without a device. */
  showSimBanner() {
    this.setBannerSpace(true);
    this.bannerVisible = true;
    if (document.getElementById('ad-sim-banner')) return;
    const el = Utils.el('div', 'ad-sim-banner', 'Banner ad');
    el.id = 'ad-sim-banner';
    el.style.height = AdConfig.banner.reservedHeight + 'px';
    document.getElementById('app').appendChild(el);
  },

  /* The native banner floats over the WebView, so the page has to give up
   * the space itself or the Play button ends up underneath it. */
  setBannerSpace(on) {
    document.documentElement.style.setProperty(
      '--banner-space', on ? AdConfig.banner.reservedHeight + 'px' : '0px');
    document.documentElement.classList.toggle('has-banner', !!on);
  },

  // -------------------------------------------------- interstitial

  /* Frequency-capped: only between levels, never in the first few levels,
   * and never twice in quick succession. */
  canShowInterstitial() {
    if (!this.shouldShow('interstitial')) return false;
    const st = Store.adState();
    if (Store.data.level <= AdConfig.interstitial.skipFirstLevels) return false;
    if (st.levelEnds < AdConfig.interstitial.everyNLevelEnds) return false;
    const since = (Date.now() - (st.lastInterstitial || 0)) / 1000;
    return since >= AdConfig.interstitial.minSecondsBetween;
  },

  noteLevelEnd() {
    const st = Store.adState();
    st.levelEnds++;
    Store.save();
  },

  async maybeShowInterstitial() {
    if (!this.canShowInterstitial() || this._busy) return false;
    const st = Store.adState();
    this._busy = true;
    try {
      const admob = this.plugin();
      if (admob) {
        if (!this._interstitialLoaded) { this.preload(); return false; }
        await admob.showInterstitial();
        this._interstitialLoaded = false;
      } else {
        await this.simulate('Interstitial ad', 3, false);
      }
      st.levelEnds = 0;
      st.lastInterstitial = Date.now();
      Store.save();
      return true;
    } catch (e) {
      return false;
    } finally {
      this._busy = false;
      this.preload();
    }
  },

  // ------------------------------------------------------- rewarded

  /* Resolves true only when the ad was actually watched to the point the
   * network says the reward is earned. Closing early earns nothing. */
  async showRewarded() {
    if (!AdConfig.enabled || this._busy) return false;
    this._busy = true;
    try {
      const admob = this.plugin();
      if (!admob) {
        return await this.simulate('Rewarded video', 3, true);
      }
      if (!this._rewardedLoaded) {
        this.preload();
        UI.toast('Ad not ready — try again in a moment');
        return false;
      }
      const reward = await admob.showRewardVideoAd();
      this._rewardedLoaded = false;
      return !!reward;
    } catch (e) {
      return false;
    } finally {
      this._busy = false;
      this.preload();
    }
  },

  // ------------------------------------------------------ simulator

  /* Stands in for the SDK off-device: a real countdown, a real close
   * button, and for rewarded ads a real "you closed it early" outcome. */
  simulate(label, seconds, rewarded) {
    return new Promise((resolve) => {
      const overlay = Utils.el('div', 'ad-sim');
      const card = Utils.el('div', 'ad-sim-card');
      card.appendChild(Utils.el('div', 'ad-sim-tag', 'Simulated ad'));
      card.appendChild(Utils.el('h3', '', label));
      card.appendChild(Utils.el('p', '', 'On a device this is a real AdMob ad. '
        + (rewarded ? 'Watch it through to collect the reward.' : '')));

      const timer = Utils.el('div', 'ad-sim-timer', String(seconds));
      card.appendChild(timer);

      const actions = Utils.el('div', 'ad-sim-actions');
      const skip = Utils.el('button', 'btn btn-ghost', 'Close');
      const done = Utils.el('button', 'btn btn-green', rewarded ? 'Collect reward' : 'Continue');
      done.disabled = true;
      actions.appendChild(skip);
      actions.appendChild(done);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.getElementById('app').appendChild(overlay);

      let left = seconds;
      const tick = setInterval(() => {
        left--;
        timer.textContent = left > 0 ? String(left) : '✓';
        if (left <= 0) {
          clearInterval(tick);
          done.disabled = false;
        }
      }, 1000);

      const close = (result) => {
        clearInterval(tick);
        overlay.remove();
        resolve(result);
      };
      skip.addEventListener('click', () => close(false));
      done.addEventListener('click', () => close(true));
    });
  },
};
