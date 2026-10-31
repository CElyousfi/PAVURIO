# Art brief for ChatGPT (static illustrations, committed straight to this repo)

You are adding **static illustrations** to the Pavurio app. Animations are NOT your job: the pets are animated
from generated videos (see `docs/art/ART_STATUS.md`). Do not change any other code than what this brief allows.

## 1. Look and character references (read before drawing)

- Approved dog: `docs/art/gpt-dog/source/master_b.png` (main reference), plus `master_a.png` and the sheets next to it.
- Style: flat, soft, rounded vector illustration, no outlines, no texture, gentle single-tone shading,
  big glossy black eyes with white highlights, pink blush, light from the top-left.
- Palette: cream `#FFF0D9`, honey `#FBD49B`, orange `#FDA33B`, teal `#22C1C3`, coral `#FF6B6B`, sun `#FFC83D`,
  leaf `#58C322`, sky `#1CB0F6`, pink `#FF6B9A`, lavender `#9B7BF7`, litter brown `#B07A4F`, ink `#2B2D3A`.
- Every image: **PNG, transparent background**, subject centered with about 8% empty margin,
  **no text / letters / numbers / logos / watermarks**, no ground shadow unless asked.
- Pets are always happy. Never draw a sad, sick or hurt animal.

## 2. How to deliver (important)

1. Work on a branch named `art/<short-name>` and open a pull request to `main`.
2. Save each file at **exactly** the path in the tables below (create folders if missing).
3. In `src/ui/art.ts`, replace the matching `null` with `require('<path relative to src/ui>')`.
   Example: `meal: { empty: require('../../assets/art/care/meal_empty.png'), half: …, full: … }`.
   Only change entries whose files you actually added.
4. Do not edit anything else. Do not resize or rename other assets.
5. In the PR description, list the files you added and paste the prompt you used for each.

## 3. Wired now: these show up in the app as soon as the PR is merged

### 3a. Care objects (log card hero + Home quick-add icons)

Each is shown up to about 360 pt wide on the log card, so draw them big and simple. The three bowl states
must be the **same bowl, same size and position**; only the contents change.

| Path | Size | What to draw |
|---|---|---|
| `assets/art/care/meal_empty.png` | 1024×1024 | Round orange `#F59E0B` pet food bowl, lighter rim, small white paw print on the front, front view slightly from above, **empty** |
| `assets/art/care/meal_half.png` | 1024×1024 | Same bowl, **half full** of round brown kibble |
| `assets/art/care/meal_full.png` | 1024×1024 | Same bowl, **heaped full** of kibble |
| `assets/art/care/water_low.png` | 1024×1024 | Wide pale-blue `#E7F6FE` water bowl with `#B7E6FC` rim, water `#1CB0F6` **almost empty** |
| `assets/art/care/water_half.png` | 1024×1024 | Same bowl, water **half** |
| `assets/art/care/water_full.png` | 1024×1024 | Same bowl, water **full**, one small flat reflection |
| `assets/art/care/walk.png` | 1024×1024 | Green `#58C322` leash coiled in a soft loop with a matching collar and two small green paw prints |
| `assets/art/care/play.png` | 1024×1024 | Round pink `#FF6B9A` toy ball with two curved white seams and a small highlight |
| `assets/art/care/grooming.png` | 1024×1024 | Lavender `#9B7BF7` grooming brush, rounded white bristles, tilted 20°, three small sparkles |
| `assets/art/care/litter.png` | 1024×1024 | Clean, cute brown `#B07A4F` litter box with smooth pale sand and a white paw print, gray scoop leaning on it (tasteful, clean) |

In `src/ui/art.ts` the water states use the keys `empty` / `half` / `full`: map `water_low.png` to `empty`.

### 3b. Screens

| Path | Size | Where it appears | What to draw |
|---|---|---|---|
| `assets/art/ui/welcome_badge.png` | 512×512 | Above the welcome headline | Tiny emblem: the orange food bowl with a heart-shaped paw rising from it |
| `assets/art/ui/empty_day.png` | 1024×1024 | Day view when nothing is logged | The approved dog sitting next to its empty orange bowl, looking up hopeful and happy, tail wagging |
| `assets/art/ui/plan_header.png` | 1536×1024 | Onboarding "daily plan" step | The approved dog and a gray tabby cat sitting side by side looking at a big friendly checklist card with four colored ticks (orange, green, blue, pink), no text on the card |

### 3c. Cat

| Path | Size | What to draw |
|---|---|---|
| `assets/art/cat/avatar.png` | 512×512 | Head-and-collar bust of the cat: gray tabby `#9A929E` with darker stripes, white blaze widening into a white muzzle, pink inner ears, dark whiskers, coral `#FF6B6B` collar with gold `#FFC83D` bell, happy ^^ eyes |
| `docs/art/gpt-cat/source/master.png` | 1254×1254 | Full cat master, sitting, front view, same style and size as the dog master (needed to make the cat videos). Do **not** wire this in `art.ts`. |

## 4. Later features (do not wire yet: just add the files under `docs/art/incoming/` if asked)

Little World backgrounds (living room, garden, 4 seasons, 1024×1536), Stories backgrounds (9:16 monthly, first month,
birthday, adoption, year in review), accessories (hats, glasses, outfits), empty states for Records and Moments,
reminder-permission illustration, paywall hero. The full prompt list for these is in the
"Pavurio — GPT Image & Animation Prompt Pack" document.
