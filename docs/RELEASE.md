# Releasing Pavurio

What the app is today, so release answers stay accurate:
- Data lives on the phone (SQLite) and is backed up automatically to the user's account: Firebase Auth (a guest account by default; Apple, Google or email to keep it), Firestore for the database snapshot, and Cloud Storage for photos and documents.
- Crash reports: Crashlytics. Anonymous usage analytics: Firebase Analytics, with no advertising ID. Both can be switched off in the app.
- Purchases go through RevenueCat. The free app covers daily care; Pro adds extras.
- Walks are a timer: no GPS and no location. Live walk weather is **off** unless a commercial Open-Meteo key is set in `extra.weatherApiKey` (the free API excludes commercial apps).
- There are no streaks, challenges or games in the product (they were removed). Badges ("Milestones") remain.

## 1. One-time setup
1. **EAS:** builds are started from expo.dev → Builds → **Build from GitHub** (Android, profile `production`). Always type the **full commit hash** in the Git ref field.
2. **Bundle ids:** `com.pavurio.app` (iOS and Android).
3. **Firebase** (project `pavurio`):
   - `firebase/google-services.json` and `firebase/GoogleService-Info.plist` must be present (see `firebase/README.md`).
   - Turn on **Google Analytics** for the project (Project settings → Integrations). Without it, no analytics events are recorded.
   - Turn on **Cloud Storage** (Blaze plan), then run `firebase deploy --only storage`. Without it, photo and document backup can't complete. The app keeps "unsaved changes" set and keeps retrying; it never reports a complete backup with files missing.
4. **RevenueCat:**
   - Entitlement **`pro`**, plus a current offering with monthly, annual and lifetime packages.
   - Keys: `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY` as EAS environment variables.
   - Without keys, the paywall shows preview prices and nothing can be bought. The free app still works fully.
5. **Store privacy answers:** see `docs/store/LISTING.md` (App Privacy and the Data safety form). They must match `site/content/*/privacy.md`.

## 2. Builds
| Profile | Use |
|---|---|
| `preview` | internal testing (APK on Android) |
| `production` | store release (build numbers auto-increment) |

**Over-the-air updates (`eas update`) are NOT safe yet.** `runtimeVersion` follows the app version, but builds with the same version contain different native code (widgets, Storage, expo-audio, Analytics). Before using OTA, bump `version` for every native change, or switch `runtimeVersion` to the `fingerprint` policy.

## 3. Automated checks (must pass on the release commit)
- `npm run typecheck`
- `npx expo lint`
- `npm test` (runs in 3 time zones)
- **Native UI flows:** `maestro test .maestro/` on a compact Android emulator (360×640 dp), a Samsung phone with Samsung Keyboard, a Pixel with Gboard, and an iPhone SE / recent iPhone. See `.maestro/README.md`.

## 4. Native acceptance checklist (on the exact release-candidate build)
Mark each item with the device and build number. Don't release with unchecked critical (★) items.

**First use ★**
- [ ] Clean install → splash → Home or setup, never stuck on the logo. Also test with the app sent to the background during the logo.
- [ ] Dog and cat:
  - [ ] name with the keyboard open (field and Continue visible; Next continues);
  - [ ] coat tab, collar/bandana tab;
  - [ ] "Use this look" visible;
  - [ ] about ("I'm not sure");
  - [ ] plan;
  - [ ] Welcome home;
  - [ ] Home.
- [ ] Kill the app during setup → setup resumes. Kill it right after "Start with this plan" → the pet has all its routines on relaunch, and there's no second pet.
- [ ] No paywall during setup. Closing the paywall from Settings returns to Settings.
- [ ] Large text (200%), Arabic (RTL text), German or Finnish (long strings) on a compact phone.

**Data ★**
- [ ] Backup with photos and documents → reinstall (or a second phone) → sign in → pets, care history, records, photos and documents are all back.
- [ ] Airplane mode while adding photos → Account shows files waiting. Back online → it completes, and nothing is shown as backed up before that.
- [ ] Delete a pet → its reminders and files go.

**Purchases ★** (store sandbox / licence testers)
- [ ] Monthly, annual (with trial) and lifetime each unlock Pro.
- [ ] Cancel → Pro ends at the period end.
- [ ] Restore on a reinstall.
- [ ] Offerings unavailable (no network) → a calm message; the free app keeps working.

**Core features**
- [ ] Reminders:
  - [ ] create one 2 minutes ahead → it arrives;
  - [ ] Done from the notification ticks it;
  - [ ] snooze;
  - [ ] the "every 4 weeks" prevention reminder.
- [ ] Log, undo and edit a care; the pet colours in; the first-care tip shows once.
- [ ] Walk timer:
  - [ ] start, lock the phone, kill the app → time kept;
  - [ ] finish → walk logged;
  - [ ] Paw Passport shows it.
- [ ] Pantry: add food → stock forecast; restock.
- [ ] Memories:
  - [ ] camera and gallery;
  - [ ] Memory Card share;
  - [ ] permission prompts in the device language.
- [ ] Records: attach a camera photo and a PDF, kill the app → attachments still open.
- [ ] Pet switching; Appearance Studio; the plan updates after a weigh-in.

**Widgets and Live Activities**
- [ ] iOS: widgets small/medium/Lock Screen, the care Live Activity with Done, and the walk Live Activity. Needs the `group.com.pavurio.app` App Group on the widget extension.
- [ ] Android: Today and Pantry widgets update after logging. A widget tap opens the app on Android 14+.

**Store**
- [ ] Privacy policy (site), App Privacy / Data safety and the listing text all match this list.
- [ ] Screenshots come from the release build: current pets, setup and Home.

## 5. Assets
The pet clip sheets are bundled so the app works fully offline from the first launch. They come from the Honey & Tabby GIFs in `docs/art/gifs`, processed by `tools/art/gifclips.py` and `tools/art/dye.py`: about 10 MB for the dog and 9 MB for the cat, in WebP.
