# Art status

## Cat (31 Oct 2026)

The cat now comes from ChatGPT's cat sheet (`gpt-cat/source/cat_sheet.png`): 54 elements cut into `gpt-cat/elements/`,
the four coats upscaled 4× with EDSR (`tools/art/upscale.py`), and `tools/art/cat_assets.py` builds the app files
(coats on one shared canvas, gray sketch, collar color overlays, avatars). `CatStage` shows the cat still, with the
color-in fill, until its videos exist. `tools/art/cat_start_frames.py` makes the Gemini start frames with the same framing
as the dog videos. The hand-made vector pets and their code motion were removed.

ChatGPT batch 1: the 10 care objects and the welcome badge were merged, trimmed to their content so they read at icon
size. The empty-day picture, plan header and code-drawn cat drafts were not taken (they don't match the approved characters).


## Dog = generated video only (30 Oct 2026, evening)

All hand-made dog motion was removed. The dog is now played **only** from the generated videos:

| Clip | Source | Plays when |
|---|---|---|
| idle (loop, played forward then back) | celebrate.mp4 8.7–9.95 s, sitting and panting | always |
| eat | eat.mp4 | Meal saved |
| drink | drink.mp4 | Water saved |
| celebrate | celebrate.mp4 1.2–3.25 s + 7.45–8.75 s | litter / anything without its own clip, or a tap on the pet |
| walk | walk.mp4 0.3–5.2 s | Walk saved |
| play | play.mp4 1.0–9.0 s | Play saved |
| groom | groom.mp4 1.5–8.6 s (droplets + sparkles kept) | Grooming saved |

Placement: all generated videos share Gemini's framing (bandana 221–229 px wide in every video), so every clip uses one
video-pixel → stage transform anchored on the sitting idle dog (`_anchor` in clips.json). The dog never changes size
between clips.

`src/animation/DogStage.tsx` timing: clock-based (frames are skipped, never slowed), 140 ms crossfade into an action and
220 ms back to idle, and an action only starts once its first sheets are decoded. A new action interrupts the current one
cleanly, and leaving the screen ends it. The color-in fill and coat/bandana colors apply to every clip.
Check: 270 high-rate captures across idle → eat → drink → celebrate → idle showed no blank or misplaced frame.
The cat stays still until its videos arrive (the hand-made cat motion is switched off).


## Dog animation clips (30 Oct 2026)

Three generated videos (`gpt-dog/videos/`) are now real in-app animations:

| Clip | Plays when | Frames | Notes |
|---|---|---|---|
| eat | Meal saved | 74 @ 10 fps | bowl stays orange for every coat |
| drink | Water saved | 70 @ 10 fps | |
| celebrate | Any other care saved | 37 @ 10 fps | 3.45–7.4 s cut out: the video turns the ears into bunny ears there |

`tools/art/clips.py` removes the painted checkerboard background, Gemini's checker patches inside the dog and the gray
ground line, recolors frames for all 4 coats (props like bowls are protected) and writes bandana-color overlays.
It packs frames into 24-frame WebP sprite sheets (≤3000×2000 px) so a phone only decodes one sheet at a time.
`src/animation/ClipPlayer.tsx` plays them, lined up with the layered rig on the paw line, head height and head center.
Clips are skipped when Reduce motion is on, and a touch skips a clip.

**For the next videos:** a flat solid background (pure white or pure green, not a checkerboard); the dog filling about 70% of
the frame height (these clips use only about 330 px of a 720 px frame); a square or portrait 1080 px video; and an unchanged
character for the whole video.


## Dog v2 (30 Oct 2026): the real GPT art is in the app

The in-app dog is now **the approved GPT master itself** (`gpt-dog/source/master_b.png`, 1274 px), not a code drawing.

- `tools/art/rig.py` cuts the master into 8 layers: tail, body, bandana, left ear, right ear, head, left eye, right eye.
  It fills in what's hidden behind each layer (head behind the ears and eyes, body behind the head and bandana),
  so parts can move without tearing.
- `tools/art/rig_export.py` exports WebP layers (533 KB total): 4 coats (Honey, Cocoa, Snow, Midnight), a gray sketch
  version for the color-in fill, 5 bandana colors, avatars, the app icon, the adaptive icon and the splash.
- `src/animation/RasterDogRig.tsx` animates those layers with the same motion controller: breathing, tail wag,
  ear flops, blinking, eyes and head following your finger, happy "^^" eyes, jump after a care log.
- `gpt-dog/` holds **133 separate transparent elements** cut from the GPT sheets: master, turnaround,
  expressions, parts, coats, poses, walk cycle.

Rebuild after changing the master: `python3 tools/art/rig.py && python3 tools/art/rig_export.py`.

**Still needed for the cat:** a full-size cat master (like the dog's 1274 px one). Until then the cat uses the vector rig.


## Board v1 (30 Oct 2026): approved art direction

`gpt-board-v1/00-full-board.png` is GPT's board of all 79 prompts from the
[prompt pack](https://claude.ai/artifact/EWf3LCNkwhLFERDGgrts56), sliced into one file per section.

**How it is used**

| What | Status |
|---|---|
| Dog look (C1) | ✅ In-app vector rig redrawn to match: cream face, orange eye patches, cream blaze, curly tuft, long orange ears, tongue out, orange body patches, fluffy tail on the left. Board colors sampled into the `honey` palette. |
| Cat look (C6) | ✅ Redrawn to match: gray tabby head, white blaze widening into a big muzzle, forehead stripes, pink inner ears, dark whiskers, coral collar and gold bell, curled tail bottom-left. Board colors sampled into the `tabby` palette. |
| Care objects (C) | ✅ The app's care icons already follow the same design (orange bowl with paw, blue water bowl, green leash, pink ball, lavender brush, brown litter box). |
| Everything else | 📌 Reference only, waiting for full-size files |

**Why the board can't ship as-is.** The whole board is 1536×1024 for 79 images, so each image is only about 60–130 px.
On a phone the pet is drawn about 900 px tall and the log-card object about 1000 px, so crops would look blurry.
Send each image as its own full-size file (the size listed in the pack), using the file names from the pack.

**Message to send GPT to get the full-size files (one image per reply):**

> Using the board you just made as the approved reference, generate each asset again as its own separate image at full size, one per reply, starting with C1 `dog_master.png` (1024×1024, transparent background). Keep the design identical to the board. No text.

## Integration plan when the full-size files arrive

1. **Characters:** trace C4/C9 parts into the layered vector rig (`src/animation/art.tsx`) and add the expressions from C3/C8.
2. **Animations:** turn AN keyframe sheets into pose sets for `usePetMotion`; walk cycles AN5/AN13 become sprite strips.
3. **Objects, props, environments, stories:** background removal, then WebP at @1x/@2x/@3x under `assets/`.
4. **App icon:** U1 → `assets/icon.png`; U2 → adaptive icon foreground; U3 → notification glyph.
