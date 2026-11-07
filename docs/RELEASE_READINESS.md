# Pavurio release readiness (7 Nov 2026, branch `fix/first-use`, PR #38, second recheck)

**Verdict:** ready for **native release-candidate testing**. **Not** ready for production: none of the native acceptance gates below have been run. PR #38 must not be merged and no store release submitted until they pass.

## 1. Verified code fixes (automated checks only)

| Area | Fix | How verified |
|---|---|---|
| **Cloud backup could report completion falsely** | Before: `Cloud.tsx` caught a failed media upload, uploaded the snapshot anyway and cleared `cloud.dirty`. Now `src/data/backupRun.ts`: the snapshot is still uploaded (the care data is saved), but `cloud.dirty` is cleared **only** when every referenced photo and document is in the cloud. A broken file-upload step counts as pending, not as "nothing to upload". Incomplete runs retry after 30 s, 1, 2, 4, 8 and 16 min. Sign-out's safety check uses the same complete/incomplete result. | `tests/backupRun.test.ts`: failed photo → incomplete, flag kept, snapshot doesn't list the missing file; retry completes it; broken upload step → incomplete; snapshot upload failure → flag kept; a second phone restores the data and every photo after the first phone finished. |
| **Interrupted pet creation** | `src/data/setup.ts`: the pet is created (with its plan, in one transaction), then the rest of its setup is recorded as `setupPending:<petId>` *before* it is applied: profile, first weigh-in, routines, guide stage, draft clean-up. Every step is idempotent, and the weigh-in step is marked done so it is never added twice. The record is cleared only at the end. `recoverSetups` runs on every app start and finishes any interrupted setup. A retry in onboarding reuses the created pet, so there are no twins. (A single transaction isn't possible because expo-sqlite can't nest the transactions `createPet` and `setPlan` already use; this is the safe equivalent.) | `tests/setup.test.ts`: complete in one go; app killed after creation → finished on next start; retry never duplicates the pet, routines or weigh-in; the draft is cleared. |
| **Onboarding blockers** (keyboard, oversized pet, collar out of reach, confirm button, stuck logo, no route to Home) | See `docs/FIRST_USE_REPAIR.md`. | typecheck, lint, unit tests (`tests/layout.test.ts` for sizing); web build walkthrough at 360×640 and 412×915, dog and cat, en/fr/ar. |
| **Privacy / store / release docs** | Each privacy policy (en/fr/es/pt) said it uses Firebase Analytics, then later "No analytics SDK". That line is replaced by an accurate statement. Walk weather (Open-Meteo, only a city the user picks; no GPS) is added to the policy and its processor table. The store listings (Play en/fr/es/pt, App Store en/fr) no longer mention streaks or challenges, which were removed from the app; they now describe the plan, pantry, memories, records, the walk timer ("No GPS, no location tracking") and backup. The App Privacy table adds Product Interaction and Device ID (Analytics, not linked, not tracking). `docs/RELEASE.md` is rewritten (it described an offline-only app with no accounts or analytics). | Text review. A grep finds no streak or challenge claims in the listings or policies. |
| **UX polish** | **Home:** the next care appears once, under the pet, with its portion ("Meal · 135 g"). Tapping it opens that care's log card directly and ticks the routine. The duplicate Next Care card was removed from the feed. **Settings** no longer duplicates the feature hub: one row leads to Explore. **Explore:** Paw Passport is now "A walk timer and a passport of your walks together. No GPS, no tracking." (it previously mentioned "places you explored"). **First care:** only the badge moment shows, with no second tip on top. **es:** "Coat" was mistranslated as "Abrigo" (a garment); it is now "Pelaje". | Web walkthrough: Home → tap next care → log card → save → badge. |

### Second recheck (after the review of `d0030b7`)

| Concern | Fix | How verified |
|---|---|---|
| **Pet created, but the app stops before its pending-setup record is written** | `createPet` takes `settings` written **inside its own transaction**, and `startPetSetup` writes `setupPending:<petId>` there. The pet and its record exist together or not at all. | `tests/setup.test.ts`: a failure inside the creation transaction leaves no pet; a created pet always has its record. |
| **Weigh-in saved, then the app stops before the step is marked done** | The first weigh-in has a stable id (`setup-weight-<petId>`) and `addMeasurement` uses `INSERT OR IGNORE` for given ids, so a retry adds nothing. The separate "done" marker was removed. | Test: the weigh-in exists, then recovery runs → still exactly one. |
| **A failed recovery was skipped for the rest of the session** | `recoverSetups` now runs on every data load. It costs one query when nothing is pending. A failed setup stays pending and is retried. | Test: a broken step leaves the record → the next run completes it. |
| **Referenced file missing on the phone AND in the cloud was skipped silently** | `BackupState.lost` counts it. A backup is complete only if `pending === 0 && lost === 0`. Account shows the lost files and how to resolve them (open the memory or record, add the file again or remove it). Lost files aren't retried pointlessly. | `tests/backupRun.test.ts`: lost photo → incomplete, flag kept, the rest uploaded; a cloud-only file (new phone) still counts as safe. |
| **Retries stopped after 6 attempts** | Retries run at 30 s, 1, 2, 4, 8, 16 min, then every 30 min while the app is open. A fresh attempt is made each time the app returns to the foreground, plus the existing flush on going to the background and on every data change. "Unsaved changes" stays set until every file is up. | Tests: 300 photos (600 files) with 12 offline runs, then reconnection with 40-file runs (interrupted, as if backgrounded) → exactly 15 runs, all 600 files, flag cleared only at the end. A flaky connection (every 3rd upload fails) never reports complete early and converges. |
| **Open-Meteo free API not licensed for commercial apps** | Live weather is **off** unless a commercial key is set (`extra.weatherApiKey`). Without it, nothing is sent; the weather card and place picker are hidden; walks, Paw Passport and stamps work unchanged (weather-based stamps can't be earned). Privacy policies (en/fr/es/pt) say weather is off and nothing goes to a weather service. LISTING.md explains the location disclosure needed if it's turned on. | typecheck; code review of every weather call path (`walk.tsx`, `adventures.tsx` → `searchPlaces`, `currentWeather`). |
| **Analytics defaults** | Native auto-collection is now **off** (`firebase.json` → `analytics_auto_collection_enabled: false`) until the app reads the owner's choice, then on (default) or off. An owner who opted out is never measured during start-up. | Config review. **Owner decision:** whether EU/UK users must opt in (consent) instead of having an opt-out; see section 3. |

`npm run typecheck`, ESLint (0 problems) and `npm test` (164 tests × 3 time zones) all pass.

## 2. Native tests: passed or failed

**None run.** This environment has no Android SDK, emulator, iOS simulator or physical device, and can't reach expo.dev to build. Nothing native is claimed as passing.

| Gate | Status |
|---|---|
| Original Samsung cases (Samsung Keyboard) + Gboard, dog and cat | not run |
| Maestro flows `.maestro/onboarding_dog.yaml`, `onboarding_cat.yaml`, `startup_relaunch.yaml` | written, not run |
| Clean-device restore with photos and records | not run (logic covered by unit tests) |
| RevenueCat sandbox: monthly, annual + trial, lifetime, cancel, restore, offerings unavailable | not run |
| Notifications (incl. every-4-weeks), widgets, Live Activities, walk timer, camera, memories export | not run |
| Large text, compact phone, long translations, Arabic RTL on device | not run (web only) |

## 3. Remaining production blockers

1. Every native gate in section 2, run on a build of the exact PR commit.
2. **Weather licence:** buy an Open-Meteo commercial plan (then set `extra.weatherApiKey`, update the privacy policy and declare approximate location), or keep weather off.
3. **Analytics consent:** decide whether EU/UK users get an opt-in prompt (GDPR/ePrivacy) rather than today's opt-out in Settings. Firebase Analytics is configured with no advertising ID, no ad storage and no ad personalisation; collection starts only after the app applies the owner's setting.
4. **Firebase:**
   - turn on Google Analytics for project `pavurio` (until then no events are recorded);
   - turn on Cloud Storage (Blaze plan, with budget alerts set first) and deploy its rules (until then photo backup stays "pending" — correctly, but it never completes).
5. **RevenueCat:** the products and offerings exist in RevenueCat and Play Console / App Store Connect, confirmed by a sandbox purchase.
6. **Store console updates** to paste from `docs/store/`:
   - listing texts;
   - Data safety: App interactions and Device IDs for Analytics, plus the walk-weather location decision noted in `LISTING.md`;
   - Advertising ID: "No";
   - App Privacy.
7. **Screenshots** from the release build: the current pets, setup and Home.
8. **iOS:** there is no iOS build yet (no credentials on Expo), and the widget extension's App Group must be enabled.

## 4. Platform-specific limitations

- **Android:** draws edge to edge, so keyboard avoidance relies on `KeyboardAvoidingView` padding (now on). Confirm on Samsung One UI. Android widgets refresh on data change and on a background task, not on a timeline. A widget tap opening the app must be checked on Android 14+.
- **iOS:** Live Activity "Done" may not apply until the app opens if iOS fully terminated it. The widget gallery name and description are English only (an expo-widgets limitation).
- **Both:** Arabic and Hebrew text runs right to left, but layouts are not mirrored. Translations are machine-made; the top markets need a native review. The free trial and prices depend on store configuration.

## 5. Release readiness

| | Android | iOS |
|---|---|---|
| Code | release candidate on `fix/first-use` | same code |
| Build | to start on expo.dev from the PR head commit | no build yet |
| Native QA | not started | not started |
| Store data | texts ready in `docs/store/`; console updates pending | listing ready; App Privacy pending; account setup pending |
| **Ready for production?** | **No.** Ready for internal / closed testing only. | **No.** |

**Next steps, in order:**
1. Build an Android internal-test APK from the PR head.
2. The original testers repeat the failed journeys, using Samsung Keyboard and Gboard.
3. Run the backup / restore and purchase checks.
4. Fix anything found.
5. Merge PR #38.
6. Make the release build from the verified commit.
7. Update the store data.
8. Run a small closed beta before wider release.
