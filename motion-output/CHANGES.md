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
