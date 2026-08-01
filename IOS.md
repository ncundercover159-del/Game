# Shipping Crown Quest on the iOS App Store

The game is wrapped with [Capacitor](https://capacitorjs.com), which builds a
real native iOS app around the WebView. Everything in this repo is ready; the
remaining steps need a Mac, because only Xcode can compile and sign an iOS
binary.

## What you need

| | |
|---|---|
| **A Mac** | Xcode 15+ (macOS Sonoma or newer). There is no supported way to build an `.ipa` on Linux or Windows. |
| **Apple Developer Program** | $99/year, at [developer.apple.com/programs](https://developer.apple.com/programs/). Required to submit — a free account can only sideload to your own device. |
| **CocoaPods** | `sudo gem install cocoapods` (or `brew install cocoapods`). |
| **Node 18+** | To run the build scripts. |

---

## 1. Set your bundle identifier

`capacitor.config.json` ships with a placeholder:

```json
"appId": "com.example.crownquest"
```

Change it to a reverse-DNS identifier you own — e.g. `com.yourname.crownquest`.
It must match the App ID you register in your Apple Developer account, and it
can never be changed once the app is published. Do this **before** generating
the iOS project.

## 2. Generate the native project

```bash
npm install
npm run ios:init      # build-www + npx cap add ios
```

This creates an `ios/` folder containing a real Xcode project. It is generated
output, so it is not committed here — regenerate it any time. Rerun
`npm run ios:sync` after any change to the game files.

## 3. Generate the icon and launch screens

The sources live in `assets/` (`icon.png` 1024×1024, `splash.png` and
`splash-dark.png` 2732×2732), all opaque sRGB, which is what the App Store
requires — an icon with an alpha channel is rejected automatically.

```bash
npm run assets:generate    # npx capacitor-assets generate --ios
```

That writes every size Xcode needs into `ios/App/App/Assets.xcassets`. To
restyle the artwork, edit `tools/make-app-assets.js`, run `npm run assets`,
then regenerate.

## 4. Configure the target in Xcode

```bash
npx cap open ios
```

In the **App** target:

- **Signing & Capabilities** — pick your Team; let Xcode manage signing.
- **General → Deployment Info** — set iPhone only, and tick **Portrait**
  only (the game is portrait-locked; leaving landscape on invites a
  rejection for a broken landscape layout).
- **General → Minimum Deployments** — iOS 14.0 or later.

Then in `ios/App/App/Info.plist` add:

```xml
<key>UIStatusBarHidden</key>
<true/>
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

The first two hide the status bar so the board gets the full screen. The third
declares that the app uses no encryption — without it, every single upload
stops and waits for you to answer that question by hand.

## 5. Test on a real device

Plug in an iPhone, select it in Xcode, and hit Run. Check specifically:

- The board fits above the home indicator and below the notch / Dynamic Island.
- Swipes on the board never scroll or rubber-band the page.
- Haptics fire on matches, blasts and level end.
- Sound starts after the first tap (iOS blocks audio until a user gesture).
- Backgrounding the app silences it, and returning resumes cleanly.
- Progress survives a force-quit (it is stored in `localStorage`).

## 6. Create the App Store listing

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +**:

- **Name**: must be unique across the App Store. "Crown Quest" may well be
  taken — check first and be ready with an alternative.
- **Category**: Games → Puzzle (secondary: Casual).
- **Age rating**: answer the questionnaire. With no ads, no purchases, no
  user content and no gambling, this lands at **4+**.
- **Privacy**: the app collects nothing and has no network calls, so answer
  **"Data Not Collected"** on the App Privacy form. You still must supply a
  privacy policy URL — host `PRIVACY.md` somewhere public (GitHub Pages works).
- **Screenshots**: required at 6.7" (1290×2796) and 6.5" (1242×2688).
  `npm run shots` renders the game's screens; retake them at those exact sizes,
  or screenshot the simulator, which is simpler and always the right size.

## 7. Upload and submit

In Xcode: **Product → Archive**, then **Distribute App → App Store Connect**.
Once the build finishes processing (10–30 minutes), attach it to your version
in App Store Connect and submit for review. First reviews typically take 24–48
hours.

---

## About Guideline 4.2

Apple rejects apps that are just a website in a wrapper
([Guideline 4.2, Minimum Functionality](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)).
This is the single most likely reason a Capacitor game gets bounced, so it is
worth knowing where this app stands.

What works in its favour, and is already implemented:

- It is a **game**, not a repackaged brochure or content feed.
- It works **fully offline** — no server, no network permission, nothing loaded
  from the web at runtime.
- It uses **native device features**: Haptic Engine feedback, native splash
  screen, status bar control, and app lifecycle handling.
- It has **substantial content**: 60 levels, power-ups, obstacles, a progression
  and lives system.
- There is **no browser affordance** anywhere — no URL bar, no visible web page.

What would raise risk, and is worth avoiding:

- Shipping with fewer levels, or with placeholder art.
- Adding an in-app link that opens a website in a browser view.
- Submitting a build where the layout is visibly broken on any supported device.

If a rejection does come, Apple's note will name the guideline. Reviewers
generally respond well to a reply in Resolution Center pointing at the offline
play, the native haptics, and the amount of content.

## Cost summary

| Item | Cost |
|---|---|
| Apple Developer Program | $99 / year |
| Everything in this repo | free, MIT |

Apple takes no cut here because the game has no purchases. If you later add
in-app purchases, that revenue is subject to Apple's commission and requires
implementing StoreKit.
