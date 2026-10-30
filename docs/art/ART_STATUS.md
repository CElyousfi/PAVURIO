# Art status

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
