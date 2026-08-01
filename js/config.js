'use strict';

/* ------------------------------------------------------------------ *
 * Monetisation settings — this is the file you edit before shipping.
 * See MONETIZATION.md for where each of these IDs comes from.
 * ------------------------------------------------------------------ */

const AdConfig = {
  /* Master switch. Set false to ship a completely ad-free build. */
  enabled: true,

  /* While true the app shows Google's own test ads. You MUST set this to
   * false for the App Store build — shipping test ads earns nothing, and
   * clicking your own live ads gets an AdMob account banned. */
  testMode: true,

  /* Non-personalised ads only. This avoids the App Tracking Transparency
   * prompt and the IDFA entirely, at the cost of lower ad revenue.
   * Setting this false means you must also add NSUserTrackingUsageDescription
   * to Info.plist and handle consent — see MONETIZATION.md. */
  nonPersonalizedOnly: true,

  /* Google's public test unit IDs; used whenever testMode is true. */
  testIds: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },

  /* Your real AdMob unit IDs, from apps.admob.com. */
  ios: {
    banner: 'ca-app-pub-0000000000000000/0000000000',
    interstitial: 'ca-app-pub-0000000000000000/0000000000',
    rewarded: 'ca-app-pub-0000000000000000/0000000000',
  },

  /* A banner across the bottom of the level map. Never shown in a level —
   * an ad over the board would be both bad play and a review risk. */
  banner: {
    enabled: true,
    reservedHeight: 60,
  },

  /* Interstitials run between levels only, and are deliberately rationed:
   * an ad after every single level is the fastest way to lose players. */
  interstitial: {
    everyNLevelEnds: 2,
    minSecondsBetween: 90,
    skipFirstLevels: 3,
  },

  /* Opt-in rewarded video. These stay available even after Remove Ads is
   * bought — the player chose to watch, and it is the fairest way to hand
   * out continues. */
  rewards: {
    extraMoves: 5,
    freeCoins: 150,
    freeCoinsCooldownMinutes: 15,
  },
};

const IapConfig = {
  enabled: true,

  /* Must match the Product ID of the non-consumable you create in
   * App Store Connect. Convention is your bundle ID plus a suffix. */
  removeAdsProductId: 'com.example.crownquest.removeads',

  /* Shown until the real localized price arrives from the store. */
  fallbackPrice: '$2.99',

  /* A sweetener so the purchase feels like more than the absence of ads. */
  bonusCoins: 1000,
};
