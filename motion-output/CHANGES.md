# Motion pass 2 — files touched

No new dependencies. Everything uses what the project already had (Reanimated 4.7, react-native-svg,
expo-notifications).

## Pets (the biggest change)
- `src/animation/ClipStage.tsx` — frame clock moved to the UI thread (`useFrameCallback`); each sheet
  image moves its window in an animated style; React re-renders only when playback enters the next
  sheet. Long loops keep at most 3 decoded sheets per layer. Colour-in rises in 800 ms ease-out.
- `tools/art/clips.py` — per-clip frame rate (24 fps for idle, sleep, idle2, celebrate); cleaner sketch
  layer (flat light coat, outlines only for really dark strokes, so bandana/collar no longer smudge);
  bowl keeps its colours but not the dog's cheek above it; drawn floor line removed for the dog too
  (wherever no paw stands on it).
- `assets/pets/{dog,cat}/clips/*` — all clips re-exported (dog 53 → 61 MB, cat 25 → 36 MB).
- `src/animation/dogClips.ts`, `src/animation/catClips.ts` — regenerated asset maps.

## Log moment (timed to Waterllama, read from the video at 60 fps)
- `src/app/log/[type].tsx` — open 260 ms bezier(0.2, 0, 0, 1) (was a ~600 ms spring); close = 70 ms
  dip to 0.95 + 210 ms ease-in drop into the icon (was 230 ms ease-in).
- `src/app/_layout.tsx` — log card screen fade 180 → 150 ms.
- `src/ui/CareIcon.tsx` — empty / half / full art crossfades over 200 ms instead of snapping.

## Notifications
- `assets/notification-icon.png` (new) + `app.json` — Android status-bar icon: a white paw silhouette
  (before, Android drew the full app icon's alpha, i.e. a plain white square). Needs a new build.
- `src/ui/NotifPreview.tsx` (new) — the onboarding reminder previews now look like the real banner
  (app icon, PAVURIO, time, two-line title so it's never cut), and drop in with a spring.
- `src/app/onboarding.tsx` — uses it on the welcome carousel and the Smart Reminders step.
- i18n: "now" in fr / es / pt.

## Illustrations
- `src/features/Medal.tsx` — locked badges are a clean flat silhouette with a lock (was a 28 % faded
  copy of the medal).
- `src/features/HomeFeed.tsx` — unlit streak flame is a soft silhouette (was a faded copy).

## Speed
- `src/state/Engagement.tsx` — after a save, streak/badge/challenge recompute waits 450 ms so the save
  animation and the pet's reaction get the JS thread first (celebrations are held 3.2 s anyway).
- Pets no longer cost a React render per frame (above).

## Deliverables
- `motion-output/motion-spec.md` — measured numbers, tokens, choreography.
- `motion-output/preview.mp4` / `preview.gif` — Waterllama vs PAVURIO, same move, side by side.

## Independent review → fixed before merge
- The UI-thread clock never steps onto a sheet that isn't mounted (holds its frame and catches up by
  time) — no blank pet when JS is late or a long loop restarts.
- Sheet state is scoped to each playback (clip + nonce): an interrupted or replayed action never
  reuses the previous run's sheet window.
- An end queued by a previous run is ignored; a late second "ready" can't cancel the closing fade.
- Memory: actions keep 2 decoded sheets per layer, a paused clock keeps 1; welcome-carousel pets on
  pages that aren't showing pause.
- Reduce motion stops an action already playing.
- Art crossfade can't flash the new image for a frame; engagement loads immediately on pet switch and
  runs never overlap (no duplicate badge); the notification banner is one accessible element and
  keeps its space on the carousel (no layout jump).

# Pass 3 — Waterllama clone for pet care

Reference: Waterllama (Refero, 111 screens across 19 flows, list in `work3/screens.json`) and the
uploaded "how to use 2" video. PAVURIO now follows Waterllama's layout and mechanics while keeping
all of its own features.

## The core mechanic: the pet fills up like the llama
- `src/domain/progress.ts`: each logged care is a band weighted by its amount (`amount / default`,
  clamped 0.5–1.6). `fillStack()` stacks the bands in log order; the top equals today's level (100% only
  when the plan is complete).
- `src/animation/ClipStage.tsx`: in silhouette mode the pet is a light-gray silhouette. Each band is a
  clip window holding the same animated frame tinted with the care's colour, and it rises 200 ms ease-out
  as you log. The art's own shading is laid over the bands with a luminosity blend, so the face and fur
  stay readable on the gray and in every colour.

## Screens
- **Navigation.** No tab bar. Home has a streak circle top-left and a waves menu top-right. The
  menu hub lists Care, Records, Moments, Pets, Achievements and Summary as flat gray rows, with
  settings below. Each section is a stack screen with a back circle.
- **Home.** The big `done/planned` count, or "Wonderful Monday!" with confetti and a "Celebrate my
  day!" pill once the day is complete. Below that sit the silhouette pet, a row of care items with
  count badges, and a pastel "next up" card.
- **Log card.** It works like Waterllama's cup. A vessel per care type (bowl for water and meal,
  timer for walk, play and grooming, box for litter) fills with flat colour, with a wave or kibble.
  The centre has a chevron control (tap or drag) and the amount sits between faded neighbouring
  sizes. A coloured "+ CARE" pill saves; the "…" button sets time and note.
- **Day.** A flat list with coloured names and pink minus buttons to delete entries.
- **Summary.** A filled KPI disc, pill-stacked bars (one pill per care) and a chip legend.
- **Achievements.** A collection grid of light-cyan tiles with the selected badge in the header.
- **Tip reader.** Pastel slides, a LEAVE pill, segmented progress and a dark NEXT pill.
- **Challenge.** A coloured header with a sticky START NOW pill.
- **Celebrations.** A full-screen splash with an arch, the medal, an AWESOME pill and confetti.
- **Onboarding.** Silhouette pets that fill with colour.
- **Everywhere.** Flat gray cards and inputs with no shadows.

## Pass 3b — the user's illustrations as the care buttons
- `assets/art/care2/*.webp` were made with `tools/art/careicons.py`, which removes the halo, trims the image and outputs 512 px. The set covers meal, water, walk (leash), play (yarn and ball), grooming, litter, medication, sleep, records (clipboard) and calendar.
- `src/ui/FillArt.tsx` is one fill mechanic shared by everything that fills. The picture starts as gray (a flat silhouette with its own shading on top) and its real colours pour in from the bottom, rising in 200 ms. It is the same look as the pet.
  - In the Home care row, each picture fills by its share of today's plan (or fully once logged, if the care isn't in the plan).
  - In the log card (`Vessel`), the picture fills with the amount: the smallest amount gives a sliver and the biggest preset fills it. The chevron control and drag still work.
- Lists (day, care agenda, routines, plan, story, medals) show the pictures in full colour.
- In the menu hub, Care uses the calendar, Records the clipboard and Pets the sleeping duo. Medication routines use the medication picture, and the empty reminders state uses the calendar.

# Pass 4 — goals, medicine, reminders, Adventures, lock-screen walk, icon

- **Goals from the owner's plan.** The plan step sets how many times a day and how much each time (`care_plans.portion`, migration v4).
  - Every picture fills toward its daily goal, times × portion: the log card (already given today plus this amount), the Home row, and the pet's bands (one usual portion = one band).
- **Medicine** is a care type: doses (half steps), with the medicine illustration. It isn't in anyone's plan until the owner adds it.
- **Reminders**
  - Sync runs right after permission is granted and every time the app comes back to the foreground. A background refresh (expo-background-task) keeps the window filled.
  - Android: Done / In 15 min work from the notification without opening the app.
  - One follow-up 30 min after an unticked meal or medicine.
  - Medicine uses its own high-priority channel and is delivered as an alarm clock when exact alarms are allowed; Settings offers "Allow on-time reminders".
  - Portions appear in the reminder text, and a "still walking?" nudge goes out after 3 h.
- **Adventures** (`src/app/walk.tsx`, `passport.tsx`, `adventure.tsx`; `src/data/walkRepo.ts`; `src/domain/walks.ts`, `weather.ts`; `src/native/weather.ts`)
  - Open-Meteo weather for a town picked once, cached 20 min.
  - The timer is computed from stored timestamps, through a state machine.
  - Finishing is idempotent: one care event, one memory and the passport stamps (8 rules, v1) are derived from the walk.
  - Edit and delete keep all of these in step. 14 new tests.
- **Lock screen** (`src/native/walkLive/*`, expo-widgets)
  - iOS: a Live Activity with a self-ticking timer and Pause / Resume / Finish buttons.
  - Android: an ongoing notification with the same buttons, handled natively and applied with their real times when the app runs (`WalkLiveBridge`).
- **Launcher icon.** The adaptive background is now the store icon fitted to the visible zone, over a soft extension; the foreground is transparent. Installed icons now match the Play Store icon.
- **New dependencies:** expo-widgets 58.0.x, @expo/ui 58.0.x, expo-background-task 58.0.x, expo-task-manager 58.0.x.
