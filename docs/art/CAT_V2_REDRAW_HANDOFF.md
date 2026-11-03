# Pavurio — Cat V2 redraw handoff

**Source of truth:** `docs/art/CAT_V2_REDRAW.md` on branch `art/integrate-batches-01-02` of `CElyousfi/PAVURIO`.

**Status: NOT COMPLETE.** Concept boards are not replacement assets. Generate 23 separate final images; do not crop the concept boards into production files. The original artwork must be used as image-to-image input for each corresponding redraw.

## Non-negotiable visual requirements

- Replace **only the old Tabby cat** with the newly approved cat depicted in `docs/art/gpt-cat/source/v2/master_tabby.png` (also supplied as a transparent reference image in this chat).
- V2 cat: slim gray tabby kitten; darker gray stripes; distinct broad white forehead/muzzle blaze, white chest and white paws; pink inner ears and cheeks; big glossy black eyes, small lashes, thin whiskers; **red collar with gold bell**. Keep pose and expression appropriate to each scene.
- Preserve dog **Honey** unchanged: same orange/golden fur, cream blaze, teal paw-print bandana, pose and expression as the source scene.
- **Preserve original composition**: objects, characters, narrative, background, palette, framing, proportions and number of pets. Only adapt the cat's appearance, size, pose and occlusion as necessary to fit.
- Match the **existing image's dimensions, aspect ratio and alpha/transparency**. Do not add a square background to originally transparent graphics. Retain rounded background tiles in artwork that already has them.
- No labels, captions, watermarks, UI controls or new clocks/timers. Where original has symbols/icons, reproduce those faithfully.
- Keep all elements within original safe margins. Verify cat's collar/bell and four paws are not accidentally erased or covered unless the pose requires it. Export final lossless PNG for art review; Claude converts to the app's WebP asset format after approval.

## 18 scenes (existing source files, redraw exactly with new cat)

| Output replacement path | Original scene to preserve |
|---|---|
| `assets/art/scenes/appointments.webp` | Honey and cat happily in front of a large pink appointment calendar with checkmark; light peach backdrop. |
| `assets/art/scenes/bath.webp` | Honey and cat inside teal bath tub, white soap bubbles and bubbles over cat's head; pink shampoo bottle and yellow stacked towels; lavender background. |
| `assets/art/scenes/bed.webp` | Honey and cat sleeping together inside rounded golden pet bed; cozy yellow light, plant and lamp. |
| `assets/art/scenes/brushing.webp` | Cat cheerfully holds pink grooming brush near playful Honey; soft pink background, little golden excitement marks. |
| `assets/art/scenes/duo.webp` | Honey and cat sitting close outdoors amid green shrubs, daisies, small pink heart and yellow accents; transparent background. |
| `assets/art/scenes/meals.webp` | Honey and cat eating from teal and coral food bowls; hearts above, leafy potted plant. |
| `assets/art/scenes/medication.webp` | Large amber/orange medicine bottle with paw label and pink capsules in foreground; Honey and cat smiling behind. |
| `assets/art/scenes/moments.webp` | Layered instant-photo snapshots with Honey and cat pictured together at colorful sunset beach; coral instant camera at bottom. |
| `assets/art/scenes/night.webp` | Honey and cat curled sleeping in warm ochre bed, window showing crescent moon and stars, soft indigo room. |
| `assets/art/scenes/play.webp` | Honey and cat springing playfully upward toward a floating red ball; bright sky, clouds and green grass. |
| `assets/art/scenes/premium.webp` | Honey and cat dressed in royal red capes, with golden crown above Honey and sparkle accents on purple background. |
| `assets/art/scenes/records.webp` | Large teal clipboard with vet records, first-aid case with medical cross and stethoscope; Honey and cat cheerful in foreground. |
| `assets/art/scenes/trophy.webp` | Honey and cat holding/celebrating golden paw-print trophy against pink backdrop and confetti accents. |
| `assets/art/scenes/vaccine.webp` | Honey and cat calmly showing small bandages, syringe pictogram in white speech bubble, soft pink backdrop. |
| `assets/art/scenes/vet.webp` | Honey wearing white veterinarian coat and stethoscope, cat wearing white nurse-style cap; turquoise clinic and medical-cross sign. |
| `assets/art/scenes/walk.webp` | Honey wearing teal bandana, walking beside cat with leash along peach outdoor path; blue sky, flowering greenery. |
| `assets/art/scenes/water.webp` | Honey drinking from bright cyan water bowl and cat drinking from coral water bowl; cheerful splash motif. |
| `assets/art/scenes/weigh.webp` | Honey sitting on teal paw-printed weighing scale, cat proudly beside it; cream-pink background and golden celebratory marks. |

## 4 badges (preserve medal shapes, centerpieces, ribbons, backgrounds)

| Output replacement path | Original badge to preserve |
|---|---|
| `assets/art/badges/family.webp` | Best Friends: gold-edged purple round medallion, pink heart with little side hearts, cuddling Honey and cat, violet ribbon with white paw symbol. |
| `assets/art/badges/moment.webp` | Memory Keeper: gold-edged badge with blue sky, green hill, snowy mountain, Honey and cat sitting together, green ribbon with paw symbol. |
| `assets/art/badges/streak3.webp` | 3-day streak: pink sculpted medal, cat curled up asleep on pink cushion, three white Z symbols, gold foliage and rose ribbon. |
| `assets/art/badges/streak7.webp` | 7-day streak: gold-edged navy medal with yellow moon and stars, Honey and cat tucked under purple blanket, blue paw ribbon. |

## Pending new scene

- **New litter scene (source file not yet present):** Proud, happy full-body V2 Tabby **beside a clean litter tray with a scoop**, suitable for the existing scenes collection. Keep the new cat's exact face and markings, red collar and gold bell. Clean/tasteful, no dirty litter, no clock, no timer. Choose dimensions/aspect ratio matching the planned scene slot in the app; preserve transparency conventions of nearby app assets.

## QA gates before integrating

1. **23 files**, not one collage/contact sheet.
2. Each output compared side-by-side against its **original image** for preserved composition and against `master_tabby.png` for cat identity.
3. Check unchanged Honey in every two-pet scene.
4. Check red collar / gold bell consistency, tabby stripes and white face/chest/paws.
5. Validate output dimensions and transparency against corresponding existing files.
6. Verify all 18 scene paths, all 4 badge paths, and a named litter asset; only then mark the redraw as complete.

**Handoff:** Claude reviews and integrates through a dedicated pull request; do not automatically replace existing assets before visual approval.