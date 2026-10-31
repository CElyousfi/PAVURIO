# PAVURIO

A little world for all their big moments. Pavurio is a pet care companion for iOS and Android. The dog is animated from generated video clips (Gemini) and the cat and all static art come from GPT illustrations; nothing is drawn by hand in code.

Its design comes from [Waterllama](https://refero.design/apps/274), studied through the Refero MCP. **The pet is the progress bar.** Each day your pet starts as a soft pencil sketch. Every care you log colors in more of them, using their real palette. See [`docs/research/REFERENCE_BOARD.md`](docs/research/REFERENCE_BOARD.md).

![flow](docs/screenshots/flow-overview.png)

## What's in the app (v1.0)

| Area | What it does |
|---|---|
| **Home** | `done/planned` number, the pet colouring in, banded care rug, quick-add row, a **Next up** card with Done / Skip / Snooze, Undo after every log; each care plays its own dog clip |
| **Log card** | amount control, presets, time chips, note; a log ticks the matching scheduled time (±3 h) |
| **Care tab** | week strip + month calendar with dots, day agenda, **routines** (times, weekdays, start/end, reminders, pause), **appointments** with reminders, **weight** log + chart (kg/lb), **walk timer** that survives closing the app |
| **Reminders** | local notifications for the next 4 days, re-planned after every change; tapping one opens the right log card; nothing is ever marked done automatically |
| **Records tab** | vaccines, vet visits, medication, allergies, other; next-due list; photo/PDF attachments stored in the app; a shareable care summary for the vet or a sitter |
| **Moments tab** | photo memories and milestones, birthday / adoption countdowns, **weekly and monthly stories** built only from logged data (9:16 player, share or save a slide, privacy sheet) |
| **Pets tab** | several pets, switch, add, edit, archive/restore, delete |
| **Pro** | RevenueCat (more pets, monthly stories). Without store keys the paywall says it isn't available; reminders, records and exports are always free |
| **Settings** | daily plan, haptics, reduce motion, reminders status, units, **English / Français**, CSV + JSON export, erase |

## Stack

Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router (`src/app`) · expo-sqlite · Reanimated 4 · expo-notifications · expo-image-picker / document-picker / file-system / sharing / media-library · react-native-view-shot · react-native-purchases · Nunito (OFL)

```
src/app/(tabs)/   Home, Care, Moments, Records, Pets (custom tab bar)
src/app/          onboarding, log/[type], day, studio, settings, schedule, appointment,
                  weight, walk, record, memory, story, paywall, pet
src/animation/    DogStage (video-clip sprite sheets), CatStage, PetRig, PetAvatar, Burst
src/domain/       care templates, progress, time, schedule engine, stories
src/data/         migrations (v2), repo (pets, care), careRepo (routines, marks, visits, weight), recordsRepo
src/features/     routines UI, care-log ↔ schedule link, summary, weight helpers
src/native/       haptics, notifications, files (pickers + storage), purchases (RevenueCat)
src/i18n/         t() + French strings
tools/art/        pipelines that turn the GPT/Gemini art into app assets
tests/            vitest in UTC, Paris and New York; SQLite through node:sqlite
```

## Run it

```bash
npm install
npx expo start          # press i / a / w
npm test                # domain + database tests in 3 time zones
npm run typecheck
```

Notifications, RevenueCat and media-library need a development or store build: `npx expo run:ios` / `npx expo run:android` or `eas build --profile preview`. See [`docs/RELEASE.md`](docs/RELEASE.md).

On web, expo-sqlite needs the COOP/COEP headers that are already set in `metro.config.js`.

## Product rules kept in code

- A care record is saved first. Animation is only a reaction to it, and can be turned off without changing any data.
- Progress means "share of **your** plan logged today". It is never a health or welfare score, and the sketch state is neutral (the pet's face stays happy).
- Care is never logged in the future. Instants are stored in UTC; days use local calendar math, so they stay correct across DST.
- All data stays on the device. Export and erase work offline.
- Reminders are never a paid feature, and a scheduled care is never ticked off for you.
- Stories and summaries only state what the owner logged.

## Still to come

- Home-screen widget and a walk Live Activity (need native targets; see `docs/RELEASE.md`).
- The remaining dog clips (hello, sleep, idle 2) and the cat's video clips.

Specs live in [`docs/specs`](docs/specs).
