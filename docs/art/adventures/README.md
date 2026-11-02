# Pavurio Adventures — artwork

Final set from ChatGPT (2 Nov 2026), built by `tools/art/adventures2.py` into `assets/art/adventures/`.

- **Stamps**: `badge_first`, `badge_early`, `badge_golden`, `badge_cloud`, `badge_spring`, `badge_five`, `badge_ten`, `badge_together` (512 px). Locked stamps are the same pictures drawn grey by `FillArt`, so there is no separate locked file.
- **Weather**: `w_sunny`, `w_partly`, `w_cloudy`, `w_rainy`, `w_storm`, `w_snow`, `w_hot`, `w_cold`, `w_night` (384 px).
- **Time of day**: `t_morning`, `t_afternoon`, `t_golden`, `t_evening`, `t_night`. These are 512×384 tiles cut from a labelled sheet, with their corners re-rounded.
- **Screens**:
  - `passport_cover`: the passport header.
  - `walk_scene`: the park behind the dog while walking.
  - `walk_ready`: the passport's empty state.
  - `stopwatch`: walk time.
  - `adventure_saved`: the saved banner.

Not delivered yet (still drawn by the app): the Moments covers and placeholders, the record icons, the paywall perk icons, the streak flame, the bell, the lock, the empty-day picture and the plan header. The prompts for these are in `docs/art/GPT_PROMPTS.md`.

The first concept-sheet cuts (`tools/art/adventures.py`, `reference-sheet.png`) are replaced and kept only for reference.
