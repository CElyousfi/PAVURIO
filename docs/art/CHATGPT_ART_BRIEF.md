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
6. Tick the matching boxes in `docs/art/ART_QUEUE.md` in the same PR.
7. Claude reviews every PR in the app. If something comes back as "redo", fix it on the same branch.

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

## 4. Quality bar (Claude checks these before merging)

- Transparent background is real alpha: no painted checkerboard and no white box.
- Same character as the master: ears, blaze, eye patches, bandana or collar, colors.
- No text anywhere, no outlines, nothing cropped by the image edge.
- The three states of a bowl line up exactly (same bowl, size and position).

## 5. Cat: reference master and video start frames

The cat is animated the same way as the dog: Gemini turns a still start frame into a short video, and Claude cuts it
into app clips. The start frames must match the dog videos' framing exactly so all pets appear at the same size.
Look at `docs/art/gpt-dog/video-frame-reference.png` first.

**Cat character:** gray tabby `#9A929E` with darker `#665A6D` stripes (three on the forehead, rings on the tail), a white
blaze running up the forehead and widening into a big white muzzle, white chest and paws, pointed ears with pink
`#F9A3AE` inner ears, small pink triangle nose, dark whiskers (2 per side), a coral `#FF6B6B` collar with a gold
`#FFC83D` bell, a fluffy tail curling at the bottom left. Same art style, eye style and blush as the dog.

| Path | Size | Content |
|---|---|---|
| `docs/art/gpt-cat/source/master.png` | 1254×1254, transparent | Cat sitting, front view, happy, filling ~85% of the height |
| `docs/art/gpt-cat/start-frames/idle.png` | 1280×720, **solid flat white** | Cat sitting, centered, paws ~30 px above the bottom edge, ~590 px tall (like the dog in the reference frame) |
| `docs/art/gpt-cat/start-frames/eat.png` | 1280×720, white | Same cat, same position and size, a small orange food bowl full of kibble in front-left |
| `docs/art/gpt-cat/start-frames/drink.png` | 1280×720, white | Same, with a light-blue water bowl in front-left |
| `docs/art/gpt-cat/start-frames/play.png` | 1280×720, white | Same, with a pink yarn ball in front-left |
| `docs/art/gpt-cat/start-frames/litter.png` | 1280×720, white | Same, sitting beside a clean brown litter box on the left |

Do not wire any of these in `art.ts`; they are inputs for video generation.

**Gemini video prompts** (the project owner runs these; listed here so everything stays in one place). Attach the
start frame; all videos 6–8 s, static camera, same framing, plain white background, character design must not
change:

- idle: "The cat sits and breathes gently, blinks slowly, tail tip swishes, ends in the same pose as it starts."
- celebrate: "The cat crouches, hops up happily with paws in the air, lands and sits again."
- eat: "The cat leans into the bowl, eats, sits up chewing with closed happy eyes, licks its lips, sits."
- drink: "The cat crouches at the bowl and laps water with small droplets, then sits up and licks its lips."
- play: "The cat crouches, wiggles, pounces on the yarn ball, bats it, then sits proudly next to it."
- groom: "The cat licks a raised front paw, washes its face, then sits fluffy and clean with small sparkles."
- litter: "The cat steps into the clean litter box, scratches the sand, steps out with a little paw flick, sits proudly."

## 6. Later features (do not wire yet: add files under `docs/art/incoming/` when asked)

Prompts and sizes for these are in the "Pavurio — GPT Image & Animation Prompt Pack" document (sections D–H):
Little World backgrounds, Stories backgrounds, accessories and props, more empty states (Records, Moments),
reminders permission, paywall hero, future species masters (rabbit, hamster, bird, turtle; same framing rules as
the cat).
