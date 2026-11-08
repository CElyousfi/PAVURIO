# Pavurio release readiness (8 Nov 2026, branch `fix/first-use`, PR #38, debugging pass)

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

### Debugging pass (8 Nov, after the review of `744a247` and its EAS build)

Each finding was reproduced with a test against the old code first. It was only fixed if the test failed. The fix was then checked by the same test.

| Finding | Evidence before the fix | Fix | Verified by |
|---|---|---|---|
| **Pounds: setup stuck for dogs over 200 lb** (confirmed) | The stepper allows up to 120 kg (264.6 lb), but `addMeasurement` rejected any value over 200 in any unit. `finishSetup` failed on every retry: no routines, the pending record never cleared, no way back. Four tests in `tests/weight.test.ts` fail on the old code. | `src/domain/weight.ts`: one rule in kg for both units (0 < weight ≤ 120 kg, with rounding slack so 264.6 lb passes). The stepper, onboarding, the plan screen and manual entry all use it. The error names the limit in the owner's unit ("between 0 and 264.6 lb"). An invalid first weigh-in, for example one saved by an older build, no longer blocks setup: it is skipped and everything else is applied. | `tests/weight.test.ts`: the whole stepper range in kg and lb, 200/210/264.6 lb, conversions, manual 250 lb saves, 300 lb gives an error, a 264.6 lb dog completes setup, and an old stuck record finishes. Web: a dog set to 264.6 lb went through onboarding, and the weight history shows 264.6 lb; manual 250 lb saved and 300 lb showed the error. |
| **"Taking longer than usual" never cleared** (confirmed) | `started` was a module variable, so a successful start didn't re-render the root, and the notice stayed over a working app. | A `useReducer` state (`src/features/startup.ts`) that clears when the app is ready. | `tests/startup.test.ts`. On a web build slowed down on purpose (database 13 s), the notice appeared at 10.9 s and cleared by itself at 13.9 s. |
| **Retry during a slow start opened the database twice** (confirmed in expo-sqlite's code) | `SQLiteProvider` only closes a database that had finished opening. A retry while `migrate` ran left that connection migrating, and the new provider migrated in parallel. A failed migration also leaked its connection. | `src/state/DbProvider.tsx` replaces `SQLiteProvider`. Every mount shares one open-and-migrate attempt (`singleFlight`). A failed attempt closes its connection and the next retry starts fresh. | `tests/startup.test.ts`: 5 retries during a slow start → one open, one migration. A failure → the connection is closed, then the retry succeeds. Web, database 26 s, two retries: one open, one migration, the app started, no error. Web, first open failing on purpose: "We couldn't open your data" appeared, then one TRY AGAIN opened Welcome. |
| **One lost photo kept "unsaved changes" forever** (confirmed) | A file on neither the phone nor the cloud kept `cloud.dirty` at '1'. That meant a full backup on every app switch, a launch that never took a newer backup, a phone that kept overwriting it, and a sign-out that always failed with a wrong "offline" message. The repro tests in `tests/lostFiles.test.ts` fail on the old code. | `runBackup` now reports `saved` (everything this phone has is in the cloud; this alone clears `cloud.dirty`) separately from `complete` (saved, and nothing is lost). Lost files stay reported. Account lists what they belong to (memory, record, adventure, with dates) and adds **Look again**, which asks the cloud for each file and rebuilds lost thumbnails. Nothing is ever deleted or replaced automatically. | `tests/lostFiles.test.ts` (9 tests): the flag clears with a lost photo; offline it stays set; a photo uploaded by another phone is found and recorded; a photo found nowhere stays listed with no rows or files touched; offline look-again changes nothing; a cut-off download is never kept; a lost thumbnail is rebuilt; memory and record names are shown. |
| **Setup overlapping with the reload that recovers it** (confirmed, worse than reported) | `Promise.all([finishSetup, recoverSetups])`: onboarding's own save failed with `UNIQUE constraint failed: care_plans`, and the pet got 11 routines instead of 6 (meal, walk, water, play and grooming twice each). The pending record was left behind. | `planLock` around every plan write (`applyChoices`, `followGrowth`) and `setupLock` around `finishSetup`. A plan update skips pets whose setup is pending. | `tests/setupConcurrency.test.ts`: two and three overlapping attempts → no errors, one set of routines, one weigh-in, one pet. |
| **Two writers at once on the single connection** (found in this pass) | With the test driver now as strict as expo-sqlite (no nested or overlapping transactions), two `createPet` at once fail. The colliding `BEGIN`'s `ROLLBACK` cancels the other transaction: in a double-tap model the first pet disappeared (`FOREIGN KEY constraint failed`). | `serialTransactions` (`src/data/db.ts`): transactions on the app's connection are queued, with no time limit; a timed-out wait would itself cause the collision. The app and background tasks (notification actions, reminder refresh) share one connection (`src/native/appDb.ts`): one migration, one queue. | Tests: without the queue → collision; with it → both succeed; a failed transaction rolls back only itself; a long transaction (a big restore) is never cut short by one waiting behind it; setup, recovery, plan updates and another pet creation all at once → clean. All 23 test files pass with the strict driver, so no code path nests transactions. |
| **Fast double tap on "Start with this plan"** (confirmed by code and a model) | The guard was React state, so two taps before the re-render both started a save: two pets, or a collision. | `dropWhileBusy`: a synchronous guard shared by "Start with this plan" and "Let's go". | Tests: three taps → one pet; the guard is released after success or failure. |
| **Offline: no retry after a failed snapshot upload; overlapping backup runs** (confirmed) | `Cloud.tsx` returned on `status === 'failed'` without scheduling a retry. Four triggers called `backupNow` with no guard. Running the real backup code twice at once uploads every photo twice (test). | `BackupRunner` (`src/data/backupRunner.ts`): one run at a time, requests made during a run share one follow-up run, failures and waiting files are retried (30 s doubling to every 30 min), the backoff resets on returning to the foreground, and nothing is scheduled after dispose. | `tests/backupRunner.test.ts` (8 tests, fake timers): no overlap; an offline failure is retried until saved; 12 hours offline keeps retrying; a thrown error counts as failure; dispose during a run schedules nothing. |
| **A photo the phone can't read was counted as "lost"** (found by the independent review) | `localFiles.size` turned any read error into "not there". Now that lost files don't block sign-out, an unreadable file could have let sign-out wipe a photo that still existed. | `size` throws on a read error; the backup counts it as waiting (`saved` false), never lost. | `tests/lostFiles.test.ts`: an unreadable photo keeps "unsaved changes", isn't listed as lost, and sign-out's check fails. |
| **An edit made during an upload could be marked as backed up** (existing before this pass; found by the review) | The flag was cleared after the upload even if the owner logged something meanwhile. If the app was killed before the next backup, a newer backup from another phone could later replace that edit. | `markDirty` bumps `cloud.dirtySeq` on every change. A run clears the flag only if no change arrived while it ran. | Test: an edit during the upload keeps "unsaved changes"; the next run clears it. |
| **Keyboard on Android** (strong evidence) | Onboarding had `behavior={ios ? 'padding' : undefined}` when testers reported the keyboard covering the name field. Five more screens still had it: form sheets, modal screens (weight, routines, records, memories…), sign-in, adventure notes, log notes. | `behavior="padding"` on both platforms, as in onboarding. | Typecheck only. **Must be checked on Samsung Keyboard and Gboard** (tester guide). |

Totals: `tsc` (app and tests), ESLint 0 problems, `npm test` 218 tests × 3 time zones, the Android Hermes bundle export, and the web walkthroughs above. An independent review of the diff found no deadlock and confirmed the lock and queue design; its findings are fixed above.

**Known limitation:** if opening the database ever hangs (never settles), TRY AGAIN keeps waiting for that same attempt rather than opening a second connection that could migrate in parallel; closing and reopening the app recovers. The new texts (9) are translated into 29 languages.

### Dependency update for the Play build (8 Nov)

The 14 packages that EAS's expo-doctor reported as behind SDK 58 were updated to the expected versions. These include `expo` 58.0.23, `expo-router` 58.0.30, `expo-sqlite` 58.0.15, `expo-notifications` 58.1.8, `expo-updates` 58.0.21, `expo-widgets` 58.0.27 and `react-native-safe-area-context` 5.11.1. There are no other dependency changes, and `npm ci` from the lockfile succeeds.

Re-verified after the update:
- `tsc`, ESLint and 218 tests × 3 time zones pass.
- The Android Hermes bundle builds, and `expo prebuild` succeeds (AD_ID still removed, Kotlin 2.3.21).
- Web walkthrough: cat setup with Pet Studio, Home, logging, relaunch, Pantry, Care and Settings.

Release notes for build 7 (en-US, fr-FR, es-ES, pt-BR, pt-PT) are in `docs/store/release-notes-7.md`.

`npm run typecheck`, ESLint (0 problems) and `npm test` (218 tests × 3 time zones, as of 8 Nov) all pass.

## 2. Native tests: passed or failed

**None run.** This environment has no Android SDK, emulator, iOS simulator or physical device. EAS builds can be started (one preview APK of `744a247` built successfully on 8 Nov: `f4e08421`), but no build has been installed on a device by us. Nothing native is claimed as passing.

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
