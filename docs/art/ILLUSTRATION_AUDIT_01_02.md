# Illustration batches 01–02: audit, screen map and production assets

Reviewer: Claude · 31 Oct 2026 · Source: PR #2 (`art/illustrations-batches-01-02`) and the full-size sheets the owner shared in chat.

## How the production assets were made

PR #2's PNGs are 256–304 px crops. Batch 2 (11–20) is **mis-cropped**: every tile carries a strip of the tile above and loses its own bottom 15–20 %. So none of the PR's PNGs ship. Instead:

- The owner's original sheets are kept in `docs/art/gpt-scenes/source/` (`sheet_a.png`, `sheet_b.png`: 10 portrait scenes each, 1536×1024; `sheet_c.png`: 30 small scenes; `duo_hero.png`: 1254×1254 with real transparency).
- `tools/art/scenes.py` finds each card automatically, makes the area outside its rounded corners transparent, upscales it 4× with EDSR (the same model used for the cat), and saves WebP with the longest side at 1024 px in `assets/art/scenes/`.
- **These are upscales, not native renders.** They look clean on flat-colour art, which is why they're used up to ~240 pt wide (≤ 3× density). A true native high-resolution render from ChatGPT would replace them 1:1 with the same filenames.
- `duo_hero.png` is the only native production-resolution piece; it is used as-is (resized to 1024).

## Character check (approved references: `docs/art/gpt-dog/source/master_b.png`, `docs/art/gpt-cat/source/master.png`)

**Honey** must have: a honey/orange coat, a cream blaze, orange ears, and a **teal bandana with a white paw**.
**Tabby** must have: a grey tabby coat, a white muzzle and chest, pink ears, and a **red collar with a gold bell**.

All 20 scenes match the approved line, palette, face construction and proportions. The differences are in the identity marks:

| # | PR file | Source tile used | Verdict | Notes |
|---|---|---|---|---|
| 1 | 01_welcome_duo | `duo_hero.png` (native 1254 px) | ✅ Accept | Both marks correct. |
| 2 | 02_pet_selection | — | ⏸ Not used | Honey wears a thin teal collar instead of the bandana in both variants. The species step already shows the live animated pets. |
| 3 | 03_home_companions | sheet B #3 → `night` | ✅ Accept | Asleep together. Exported for a future night card; not wired yet (Home now plays the real sleep clip at night). |
| 4 | 04_meal_care | sheet B #4 → `meals` | ✅ Accept (minor) | Necks hidden behind the bowls, so no marks are visible. Fine at card size. |
| 5 | 05_walk | **sheet A #5** → `walk` | ✅ Accept | PR used sheet B #5, where Honey wears Tabby's gold bell and a red harness ❌. Sheet A's version has both marks correct. |
| 6 | 06_playtime | sheet B #6 → `play` | ✅ Accept (minor) | Honey's bandana is hidden by the jump; Tabby's collar is correct. |
| 7 | 07_grooming | sheet B #7 → `bath` | ✅ Accept | Exported; not wired (no bathing feature yet). |
| 8 | 08_health_records | sheet B #8 → `records` | ✅ Accept | |
| 9 | 09_moments | sheet B #9 → `moments` | ✅ Accept | |
| 10 | 10_premium | sheet B #10 → `premium` | ✅ Accept | Sheet A's variant gives Honey a yellow bow tie instead of the bandana ❌ — rejected. |
| 11 | 11_appointments | sheet C #6 → `appointments` | ✅ Accept (minor) | Necks cropped; small thumbnail only. |
| 12 | 12_vet_visit | sheet C #7 → `vet` | ✅ Accept | Exported, not wired yet (record kind art is a later polish). |
| 13 | 13_medication | sheet C #8 → `medication` | ✅ Accept (minor) | Exported, not wired yet. |
| 14 | 14_vaccination | sheet C #9 → `vaccine` | ⚠️ Accept with care | A plaster on Honey's leg after a jab. Fine for a vaccine record, never as a "sick" image. Exported, not wired. |
| 15 | 15_weight_tracking | sheet C #10 → `weigh` | ✅ Accept | Honey on the scale with the bandana. |
| 16 | 16_growth_tracking | — | ⏸ Not used | No growth screen; the weight chart covers it. |
| 17 | 17_achievements | sheet C #12 → `trophy` | ✅ Accept | |
| 18 | 18_litter_care | — | ❌ **Reject** | Tabby is sitting *in* the litter tray (reads unhygienic) and wears no collar. Redo: Tabby proudly next to a clean tray with a scoop. |
| 19 | 19_bathing | — | ⏸ Not used | Duplicate of #7. |
| 20 | 20_rest | sheet C #18 → `bed` | ✅ Accept | Cosy bed; used for the "calm corner" tip. |
| — | (extra) | sheet C #4 → `water` | ✅ Accept (minor) | Drinking from bowls; used for the water challenge and tip. |
| — | (extra) | sheet C #17 → `brushing` | ✅ Accept | Tabby brushing Honey; a better fit for the brushing challenge and tip than #7. |

The other sheet C tiles (holidays, weather, travel, "no internet") are kept as source for later.

## Where each accepted scene appears

| Screen | Asset | Size on screen |
|---|---|---|
| Onboarding → Smart Reminders card | `duo` (transparent) | 240 pt |
| Paywall hero | `premium` | 142×178 pt card |
| Home feed → Pro card | `premium` | 86×112 pt |
| Home feed → challenge cards | `walk`, `water`, `play`, `brushing`, `trophy` | 104×128 pt |
| Home feed → tip cards | `water`, `walk`, `play`, `brushing`, `meals`, `weigh`, `bed` | 78×86 pt |
| Challenge detail | same as its card | 190×240 pt |
| Tip reader | same as its card | 170×200 pt |
| Challenge-complete celebration | same as its card | 140×172 pt |
| Records tab empty state | `records` | 150×186 pt |
| Moments tab empty state | `moments` | 150×186 pt |
| Care tab → "Upcoming visits" empty card | `appointments` | 78×66 pt |
| Care tab → Weight empty card | `weigh` | 78×66 pt |

Not replaced on purpose (they already use the live, animated pets): the welcome carousel, species picker, name/look/dates steps, first care, Home, the log card and the walk timer.

## Still needed from ChatGPT

1. Litter scene redo (see #18).
2. Optional: native ≥1536 px renders of `premium`, `records`, `moments`, `walk`, `play`, `brushing`, `water`, `trophy`, `meals`, `weigh`, `bed` to replace the upscales.
3. Badges ×14 and the streak flame (`docs/art/ART_QUEUE.md`, batch 2) are still open; the built-in medals and flame are used meanwhile.
