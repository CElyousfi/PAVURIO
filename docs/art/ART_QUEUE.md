# Art queue: ChatGPT × Gemini × Claude

One shared checklist. **Owner** does the work, then ticks the box in the same PR or commit.

- **ChatGPT** (GitHub access): static illustrations and reference images, committed by pull request following
  `docs/art/CHATGPT_ART_BRIEF.md`.
- **Gemini** (run by the owner of the project): animation videos made from ChatGPT's start frames.
  Upload them to `docs/art/<species>/videos/<clip>.mp4`, or hand them to Claude.
- **Claude**: integrates everything: cleans and slices the videos into app clips (`tools/art/clips.py`), wires
  art, tests the app, reviews ChatGPT's PRs (style, size, transparency, no text) and asks for redos when needed.

## Dog

| Done | Item | Owner | Path |
|---|---|---|---|
| [x] | Dog master | ChatGPT | `docs/art/gpt-dog/source/master_b.png` |
| [x] | Clips: idle, celebrate, eat, drink, walk, play, groom | Gemini → Claude | `docs/art/gpt-dog/videos/*.mp4` |
| [x] | Clip: hello (wave when the app opens) | Gemini → Claude | `docs/art/gpt-dog/videos/hello.mp4` |
| [x] | Clip: sleep (dozing, loops 22:00–06:00; the bubble part is cut — its inside keys out as a hole) | Gemini → Claude | `docs/art/gpt-dog/videos/sleep.mp4` |
| [x] | Clip: idle 2 (looking around, tail wag; plays every 14–26 s) | Gemini → Claude | `docs/art/gpt-dog/videos/idle2.mp4` |

## Cat (needed before cats can launch)

| Done | Item | Owner | Path |
|---|---|---|---|
| [x] | Cat master, full body, sitting, front (from ChatGPT's cat sheet, EDSR 4× upscale) | ChatGPT → Claude | `docs/art/gpt-cat/source/master.png` |
| [x] | Cat video start frames idle/eat/drink/play/litter (same framing as the dog videos) | Claude | `docs/art/gpt-cat/start-frames/*.png` |
| [x] | Cat in app: 4 coats + sketch + collar colors + avatars | Claude | `assets/pets/cat/` |
| [ ] | Clips: idle, celebrate, eat, drink, play, groom (lick paw), litter | Gemini → Claude | `docs/art/gpt-cat/videos/*.mp4` |

## Static illustrations wired into the app (brief §3)

| Done | Item | Owner |
|---|---|---|
| [x] | Care objects ×10 (meal ×3 states, water ×3 states, walk, play, grooming, litter) | ChatGPT |
| [x] | Welcome badge | ChatGPT |
| [ ] | Empty-day picture, plan header: **redo** — the batch-1 versions were code-drawn and don't match the approved dog/cat; draw them with image generation using `docs/art/gpt-dog/source/master_b.png` and `docs/art/gpt-cat/source/master.png` | ChatGPT |

## Illustration batches 01–02 (PR #2)

Reviewed in `docs/art/ILLUSTRATION_AUDIT_01_02.md`: 15 scenes in the app (4× upscales from the owner's sheets + the native duo hero), #18 litter **rejected — please redo**, #2/#16/#19 unused.

## Batch 2 — engagement & paywall (slots already wired in `src/ui/art.ts`; the app shows a fallback until each file lands)

Style for all: the approved Pavurio dog (`docs/art/gpt-dog/source/master_b.png`) and cat (`docs/art/gpt-cat/source/master.png`) exactly — same proportions, line, palette (honey dog with teal bandana, grey tabby cat with red collar), soft cel shading, **transparent PNG, no text, no frame, no drop shadow box**. Make them with image generation, never by drawing shapes in code.

| Done | Item | Path | Spec |
|---|---|---|---|
| [x] | Smart reminders hero (duo hero from batch 01) | `assets/art/ui/reminders_hero.png` | 1200×1200, the dog leaping happily over a few green bushes, light sky behind (this one may have a background: soft sky #BFEFF3 fading to white, rounded nothing) |
| [x] | Paywall hero (crowned scene from batch 01) | `assets/art/ui/paywall_hero.png` | 1536×1024 transparent, dog and cat side by side, both proud and happy, the dog with a tiny gold crown |
| [ ] | Streak mascot | `assets/art/ui/streak_flame.png` | 512×512 transparent, a friendly orange flame with a paw-print shape inside, no face |
| [~] | Challenge art ×7 — 6 done from batch 01–02 scenes; litter7 waits for the redo | `assets/art/challenges/{walk7,water7,litter7,perfect5,brush10,play14,walk30}.png` | 1024×1024 transparent; the pet doing the activity: walking with leash (dog), drinking from bowl, cat next to a clean litter box, dog+cat sitting proudly on a podium, being brushed, playing with a ball, dog on a trail with a little backpack |
| [~] | Tip art ×8 — 7 done from batch 01–02 scenes; litter waits for the redo | `assets/art/tips/{water,walk-sniff,cat-play,brush,meals,weigh,litter,calm}.png` | 1024×1024 transparent; one simple scene each: bowl being refilled, dog sniffing a flower, cat pouncing on a feather toy, brush with fur tuft, measuring cup of kibble, pet on a bathroom scale, tidy litter box, pet asleep in a cosy bed |
| [ ] | Badges ×14 | `assets/art/badges/<key>.png` (keys in `src/domain/badges.ts`) | 512×512 transparent round medals in the badge's colour with a small illustration inside (bowl, star, trophy, calendar, document, camera, scale, paw…) |

To wire one: put the PNG at its path and change the `null`/missing entry in `src/ui/art.ts` to `require(...)` (for badges/challenges/tips add `key: require('../../assets/art/<folder>/<key>.png')` to the map).

## Later features (brief §6; not wired yet)

| Done | Item | Owner |
|---|---|---|
| [ ] | Little World backgrounds (room, garden, 4 seasons, night) | ChatGPT |
| [ ] | Stories backgrounds (monthly, first month, birthday, adoption, year) | ChatGPT |
| [ ] | Accessories (neckwear, hats, glasses, outfits) | ChatGPT |
| [ ] | Empty states: Records, Moments; reminders permission; paywall hero | ChatGPT |
| [ ] | Future species masters: rabbit, hamster, bird, turtle | ChatGPT |
