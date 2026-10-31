# PR #4 reference atlases — audit and what shipped

Reviewer: Claude · 31 Oct 2026. Source: `docs/art/references/remaining-coverage/atlas_A.png` and `atlas_B.png`. Both are 1536×1024, reduced to a 256-colour palette, with text labels and a pastel glow behind every item. Icons are about 40–120 px.

## Rule applied
- **Character scenes rejected.**
  - In the atlases Honey is a flat yellow dog with no cream blaze and usually no bandana.
  - Tabby often loses the collar and bell.
  - Shipping them would break consistency with the approved masters, the video clips and the batch 01–02 scenes.
  - Rejected: every duo and pet scene, including the onboarding, paywall crown duo, success, reminders bell, invite & share, no results, no activity, seasonal events, future pets and keyframes.
  - The keyframes are not animations either; motion stays on the Gemini video pipeline.
- **Object art accepted when it extracts cleanly.**
  - It contains no characters, so it can't drift off-model, and it matches the palette.
  - `tools/art/atlas_icons.py` crops each item by a checked box, upscales it 4× with EDSR, smooths it, removes the background with GrabCut, trims it, and saves WebP.

## Shipped (`assets/art/badges`, `assets/art/icons`, 175 KB)

| Asset | From | Used for |
|---|---|---|
| 11 rosettes: paw, star, flame, crown, heart, moon, calendar, plus, camera, leaf, trophy | B · Achievement badges | the 14 achievements (key map in `src/ui/art.ts`) |
| 3 recolours of accepted rosettes: brown paw, teal heart, purple trophy | derived | Trail buddy, Full house, Champion (the atlas had 13 rosettes and 2 were rejected) |
| flame | B · Streak | streak card, achievements header (`ART.ui.streak`) |
| gift, gem, infinity | A · Paywall | trial timeline "Today", yearly plan, lifetime plan, Settings Pro row |
| paw, trophy, chart, heart, calendar, shield | B · UI icons and care tips | paywall "What you get" rows, Settings help rows |
| no reminders | B · Empty states | Care agenda with no routines |
| offline | B · Empty states | paywall when the store can't be reached |
| error (laptop) | B · Empty states | new app-wide crash screen (`ErrorBoundary` in `src/app/_layout.tsx`) |

## Rejected after extraction
- Brush rosette: washed out; the glyph is unreadable.
- Dumbbell rosette: the ribbon breaks apart.
- "No records" box: lost its contrast.

## Not used (yet)
- Little-world environments (7): about 120 px each. Usable as a pet backdrop only with native ≥2048 px renders.
- Accessories and outfits: the app's look editor only changes coat colours and bandanas today. Clothing needs video-clip versions to stay in sync with the animation.
- Loading, location and no-results icons: the app has no screen that needs them.

## Still needed from ChatGPT (individual files, not atlases)
1. Native ≥512 px transparent badge medals (the current ones are 4× upscales of 60 px icons).
2. Brush and dumbbell rosettes redrawn.
3. Duo and empty-state scenes **on-model**: honey-orange coat with a cream blaze and the teal paw bandana; grey tabby with a red collar and gold bell. Use `docs/art/gpt-dog/source/master_b.png` and `docs/art/gpt-cat/source/master.png` as image references.
4. Litter scene redo (from the PR #2 audit).
