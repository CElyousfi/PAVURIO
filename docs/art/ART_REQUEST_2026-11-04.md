# Art request: 4 Nov 2026

## What's no longer needed
- **New coats need no new art.** Coats are now dyed at runtime from the drawn ones (`tools/art/dye.py`).
  - Dog: Golden, Red, Chocolate, Black, Yellow Lab, Blue, Piebald.
  - Cat: Black, Russian Blue, Brown Tabby, Silver, Chocolate, Lilac.
  - Adding another coat is just two colours in `src/domain/appearance.ts`.
- **Low-frame-rate clips are fixed in code.** They are blended between frames on the device.

## What's still needed: the cat's missing videos (Gemini)
The cat has only 3 real animations (idle, celebrate, eat). For everything else it plays "celebrate", which is the main reason the cat feels less smooth and less alive than the dog.

**How to make them:**
- Use the **shared rules** and the **start frame** from `docs/art/gpt-cat/GEMINI_PROMPTS.md`, which are unchanged.
- Upload the start frame, paste the shared rules, then paste the clip line.
- Save each result as `docs/art/gpt-cat/videos/<clip>.mp4`, or send it in chat. I run `SPECIES=cat python3 tools/art/clips.py assets/pets/cat/clips`, then `python3 tools/art/dye.py cat`, and every coat gets it automatically.

| # | Clip | Start frame | Used for |
|---|---|---|---|
| 1 | drink | start-frames/drink.png | logging water |
| 2 | groom | start-frames/idle.png | logging brushing |
| 3 | litter | start-frames/litter.png | scooping the litter |
| 4 | play | start-frames/play.png | logging play |
| 5 | hello | start-frames/idle.png | tapping the cat, tap-to-wake |
| 6 | sleep | start-frames/idle.png | night-time Home |
| 7 | idle2 | start-frames/idle.png | small idle variations |
| 8 | walk (**new**) | start-frames/idle.png | Toss the kibble, walks |

**Prompt line for the new clip (8):**
> The cat stands up and trots a few small steps to the LEFT across the frame in a cute side-on walk cycle, tail up, then stops, turns back toward the camera and sits again in the exact starting pose in the same spot. Paws stay on the same ground line.

**Tips that make the clips smoother:**
- Ask for **24 fps** if Gemini offers it.
- Keep every clip **8–10 seconds**.
- Make sure the cat ends in the **exact start pose**, so loops and returns don't jump.
- If a clip morphs (ears, extra paws), send it anyway with the time range that looks right, e.g. "good from 1.2 s to 7.5 s".

## Optional, lower priority (ChatGPT, static)
None of these are needed for the coats to work.
- **Pro paywall hero (1 image)**: Honey and Tabby side by side in three different realistic coats each (golden, black, blue / ginger, black, russian blue), arranged like a fashion line-up. Same flat cartoon style and white background as the existing stickers (`docs/art/CHATGPT_ART_BRIEF.md`). Square, 1024×1024.
- **Stickers in the new coats**: not needed. The stickers will be dyed with the same layers in a later pass.
