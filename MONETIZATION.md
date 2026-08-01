# Ads and In-App Purchase

Everything is implemented and wired up. What's left is account setup on your
side — the IDs go in **`js/config.js`**, which is the only file you need to
edit.

---

## What ships in the game

| Placement | Where | Notes |
|---|---|---|
| **Rewarded video** — +5 moves | "Out of Moves" screen | Offered *above* the 900-coin option, because it's free for the player and rewarded video earns the most per impression |
| **Rewarded video** — free life | Lives dialog, when not full | |
| **Rewarded video** — 150 coins | Home screen "Free Coins" | 15-minute cooldown so it can't be farmed |
| **Interstitial** | Leaving a finished level | Every 2nd level end, 90s minimum gap, nothing before level 4 |
| **Banner** | Level map only | Never over the board — an ad on the play area is bad play and a review risk |
| **Remove Ads** | Home screen + Settings | Non-consumable, kills banners and interstitials, includes 1000 bonus coins |

Rewarded video stays available after Remove Ads is bought. That's deliberate
and standard: the player opted in, and it's the only way they can still earn
continues.

---

## 1. AdMob setup

1. Create an account at [apps.admob.com](https://apps.admob.com) and add an
   iOS app. If the app isn't on the store yet, choose "not listed yet" — you
   can link it later.
2. Create three ad units: **Banner**, **Interstitial**, **Rewarded**.
3. Put the three unit IDs into `AdConfig.ios` in `js/config.js`.
4. Copy your AdMob **App ID** (the `ca-app-pub-…~…` one, with a tilde) into
   `ios/App/App/Info.plist`:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-0000000000000000~0000000000</string>
```

5. **Set `AdConfig.testMode = false`.** This matters twice over: test ads earn
   nothing, and tapping your own live ads during testing is the fastest way to
   get an AdMob account suspended. Leave it `true` until you are done testing.

### Personalised ads and the tracking prompt

`AdConfig.nonPersonalizedOnly` defaults to `true`, which requests
non-personalised ads. This keeps the app off the IDFA, so it needs **no App
Tracking Transparency prompt** and answers fewer privacy questions. It also
earns meaningfully less — commonly a third to a half less per impression.

To switch to personalised ads you must:

- set `nonPersonalizedOnly: false`
- add to `Info.plist`:
  ```xml
  <key>NSUserTrackingUsageDescription</key>
  <string>This lets us show ads that are more relevant to you.</string>
  ```
- handle EEA/UK consent with Google's UMP SDK — GDPR requires it, and AdMob
  will serve blank ads in Europe without it.

The code already calls `requestTrackingAuthorization` when you flip that flag.

---

## 2. In-app purchase setup

1. In App Store Connect, sign the **Paid Applications Agreement** and fill in
   banking and tax details. IAP silently does not work until this is done —
   this is the single most common reason a purchase button appears dead.
2. Under your app → **Monetization → In-App Purchases**, create a
   **Non-Consumable**:
   - Product ID: `com.yourname.crownquest.removeads`
   - Reference name: `Remove Ads`
   - Price tier: your choice (the code shows the real localized price)
   - Add a localization with a display name and description
   - Upload a review screenshot — a shot of the Remove Ads button is fine
3. Put that exact Product ID into `IapConfig.removeAdsProductId` in
   `js/config.js`.
4. Test with a **Sandbox tester** account (App Store Connect → Users and
   Access → Sandbox). Sign out of the real App Store account on the device
   first. Sandbox purchases are free and repeatable.

### Restore Purchases

Already implemented, in **Settings → Purchases → Restore**. Do not remove it:
shipping a non-consumable without a restore option is an automatic rejection,
and it's how someone on a new phone gets their purchase back.

---

## 3. Privacy — this changes once ads are on

**Adding AdMob makes the "Data Not Collected" answer false.** Google's SDK
collects device identifiers and usage data for ad delivery and measurement,
even with non-personalised ads. Two things have to change:

**In App Store Connect → App Privacy**, declare at minimum:

| Data type | Purpose | Linked to identity | Used for tracking |
|---|---|---|---|
| Device ID | Third-party advertising | No | Yes if personalised, No if `nonPersonalizedOnly` |
| Product interaction / Advertising data | Analytics, Advertising | No | as above |
| Crash / performance data | App functionality | No | No |

Check the current answers against
[Google's AdMob privacy disclosures](https://developers.google.com/admob/ios/privacy)
when you submit — Apple's questionnaire and Google's guidance both change.

**`PRIVACY.md` has already been updated** to describe the ad SDK. If you ship
with `AdConfig.enabled = false`, revert it to the no-collection version, since
it would then be inaccurate in the other direction.

---

## 4. Age rating

Ads push the questionnaire's "web/ad content" answers. A puzzle game with
non-targeted ads still normally rates **4+**. Do not opt into the **Kids
Category** — it forbids third-party advertising and behavioural tracking, and
your build would be rejected.

---

## 5. Test checklist before submitting

- [ ] `AdConfig.testMode = false` and real unit IDs in place
- [ ] `GADApplicationIdentifier` in Info.plist matches your AdMob app
- [ ] Rewarded ad grants moves; **closing it early grants nothing**
- [ ] Interstitial appears between levels, not during one
- [ ] Banner never overlaps the Play button or the board
- [ ] Purchase completes with a Sandbox account
- [ ] Restore works after deleting and reinstalling the app
- [ ] After purchase: banner and interstitials gone, rewarded still offered
- [ ] App Privacy answers updated to match the ad SDK

Everything except the store-account items is covered automatically by
`npm run test:native`, which runs the ad and purchase logic against a stubbed
bridge — including the reward gating and the frequency cap.

---

## Turning it all off

`AdConfig.enabled = false` and `IapConfig.enabled = false` in `js/config.js`
strips both from the UI completely, with no other changes needed.
