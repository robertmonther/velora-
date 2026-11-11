# The phone app (Android and iPhone)

Status on 12 November 2026: **a test app, not a store release.** The website is wrapped with Capacitor 8, so the app
is the same pages in a native shell. Nothing was uploaded to Google Play or the App Store, and no developer account
exists yet.

## What is here

| Folder or file | What it is |
| --- | --- |
| `capacitor.config.json` | The app's name and ID, colours, status-bar behaviour. |
| `build-www.mjs` | Copies the site into `www/` for the app. Songs, covers and videos are not copied: the app loads them from the web, like the site does. A new song needs no new app version. |
| `android/`, `ios/` | The two native projects (open in Android Studio or Xcode). |
| `assets/` | The icon and splash sources. `npm run icons` makes every size from them. |
| `store/` | Store pictures, the three icon ideas, and the draft store texts (`LISTING.md`). |
| `BUILD` | Change the number in it and push: GitHub builds a fresh Android test file. |
| `../.github/workflows/app.yml` | The free build on GitHub's machines. |

## What is different inside the app

- **No shop.** No prices, no License buttons, no Premium, no pricing page (`config.js`: `app.sales`). People listen in the
  app and license on the website. Reason: both stores have their own payment rules for digital goods, and a web
  checkout inside the app is a common reason for rejection. Whether licenses for use outside the app may be sold in
  the app with the stores' own billing is a question for later.
- Songs load from the web (`config.js`: `mediaFrom`, `siteUrl`).
- Share uses the phone's share sheet. Links point to `siteUrl`; while that is empty, only the song's name is shared.
- No preview banner. The page keeps clear of the status bar and the home indicator.
- iPhone: music keeps playing with the screen locked (background audio is switched on).

Checked in a phone-size browser with the app's bridge played by a stand-in: `python3 tests/app_mode.py` (9 checks).
**Not checked on a real phone.** That is the first thing to do with the test file.

## Building

- **Android test file:** every push that changes something in `app/` builds `velora-android-test.apk` and attaches it
  to the pre-release "android-test" on GitHub. It is a debug build: fine for testing, not accepted by the Play Store.
  Each build is signed with a fresh throw-away key, so remove the old test app before installing a new one.
- **iPhone:** GitHub only checks that the Xcode project builds for the simulator. A file that installs on a real
  iPhone needs an Apple developer account and its signing keys.
- On a computer: `npm ci`, `npm run sync`, then open `android/` in Android Studio or `ios/App/App.xcodeproj` in Xcode.

## Before a store release (not done, and why)

1. **The name and the app ID.** `appId` is `app.velora.test`. The ID is permanent once an app is in a store, so set
   the real one together with the real name, in `capacitor.config.json`, `android/app/build.gradle` (two lines),
   the folder of `MainActivity.java`, and the Xcode project.
2. **Developer accounts (cost, Robert's OK first):** Apple Developer Program €99 a year; Google Play Console $25 once
   (as checked in October 2026; check again before paying).
3. **Google Play wants a closed test first** for new personal accounts: 12 testers opted in for 14 days in a row,
   then an application for production access.
4. **Signing:** a release key for Android (kept safe, never in this repo) and Apple's certificates.
5. **Android, screen off:** music may stop after a while when the app is in the background. A small native player
   service (with lock-screen controls) is the fix. To build and test on a real phone.
6. **Apple may see a wrapped website** (guideline 4.2, "minimum functionality"). The stronger the native side
   (lock-screen controls, background play, notifications), the better the chances. No promise can be made here.
7. **Age rating and content.** Answer the rating questions honestly: explicit lyrics, sensual themes. Expect a 16+ or
   18+ rating. Sensual covers are the risk: both stores remove apps for sexual content. To check per cover before a
   release; the "hide explicit songs" switch exists.
8. **Privacy forms.** Google's Data safety form and Apple's privacy labels must match the privacy page: email, name,
   password (accounts); uploads (the owner); nothing for listeners. Account deletion is inside the app already;
   Google also wants a web address where deletion can be asked for.
9. **Store pictures and texts:** `store/pictures/` and `store/LISTING.md` are drafts with the working name.
