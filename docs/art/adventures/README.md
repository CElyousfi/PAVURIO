# Pavurio Adventures — artwork

The pieces in `assets/art/adventures/` are cut from `reference-sheet.png`, a 1536 × 1024 concept sheet, using
`tools/art/adventures.py`. Each cut is only 50–130 px wide in the sheet. The tool upscales it ×2–4 onto a
round cream stamp, so the art is soft up close. **Every piece below should be replaced with a
high-resolution export (512 px or larger, transparent PNG) before release.**

| File | Used for | From the sheet | Notes |
|---|---|---|---|
| `badge_first.webp` | First Walk | "First Adventure" emblem | Banner text cropped off (titles are translated in the UI) |
| `badge_early.webp` | Early Bird | "Morning" chip | The sheet has no Early Bird badge, so the morning sunrise stands in |
| `badge_golden.webp` | Golden Hour | "Golden Hay Explorer" (umbrella) | Misspelt in the sheet. Needs a sunset badge |
| `badge_cloud.webp` | Cloud Explorer | "Cloud Explorer" | |
| `badge_spring.webp` | Spring Walk | "Spring Walker" | |
| `badge_five.webp` / `badge_ten.webp` | 5 / 10 Adventures | "5 / 10 Adventures" | |
| `badge_together.webp` | 50 Together | "Together" heart | Needs a "50" |
| `w_*.webp` | Weather: sunny, partly, cloudy, rainy, storm, snow, hot, cold | Weather row | The sheet's "Light Rain" icon is used for storms (it shows lightning). "Stormy" is used for snow |
| `t_*.webp` | Time of day: morning, afternoon, golden, night | Time-of-day chips | Evening uses the golden one |

The walk screens show the app's own Honey (the animated master in `src/animation`) rather than the sheet's
golden-dog extracts, as the brief asks. The passport cover uses the paw-prints care illustration
(`assets/art/care2/walk.webp`). The sheet's book icon was too small to use.

The full screen references in the sheet are never shown as UI images.
