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
| [ ] | Clip: hello (wave when the app opens) | Gemini → Claude | `docs/art/gpt-dog/videos/hello.mp4` |
| [ ] | Clip: sleep (curled up, loops; used at night) | Gemini → Claude | `docs/art/gpt-dog/videos/sleep.mp4` |
| [ ] | Clip: idle 2 (looking around, scratching an ear; adds variety to idle) | Gemini → Claude | `docs/art/gpt-dog/videos/idle2.mp4` |

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

## Later features (brief §6; not wired yet)

| Done | Item | Owner |
|---|---|---|
| [ ] | Little World backgrounds (room, garden, 4 seasons, night) | ChatGPT |
| [ ] | Stories backgrounds (monthly, first month, birthday, adoption, year) | ChatGPT |
| [ ] | Accessories (neckwear, hats, glasses, outfits) | ChatGPT |
| [ ] | Empty states: Records, Moments; reminders permission; paywall hero | ChatGPT |
| [ ] | Future species masters: rabbit, hamster, bird, turtle | ChatGPT |
