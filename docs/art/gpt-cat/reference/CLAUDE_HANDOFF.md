# Cat art correction — Claude handoff

The existing cat PNGs on this PR were programmatically constructed and **do not match** the approved GPT dog artwork. They are drafts and must not be considered approved or used to generate the final animation videos.

The attached `style-correction.jpg` is a GPT-generated concept sheet in a closer visual language: rounded chibi gray tabby, white muzzle/chest, forehead stripes, large glossy dark eyes, coral collar and gold bell, soft flat pastel fills, no outlines. **It is not the final master** and must not be cropped and upscaled as a production asset.

## Next work (Claude with user/GPT image-generation support)

1. Compare `docs/art/gpt-dog/source/master_b.png` and `style-correction.jpg`; preserve dog-level fidelity, finish, anatomy, and consistent scale.
2. Produce a **single**, front-facing transparent 1254x1254 cat master with original design and no background artifacts; obtain visual approval before accepting.
3. Generate the five 1280x720 **single-pose** video start frames: idle/eat/drink/play/litter, same cat and frame geometry; solid pure-white background as §5 demands.
4. Render `assets/art/cat/avatar.png` from the approved master, genuinely transparent 512x512, then verify in-app.
5. Only after visual review, check the three cat entries in `ART_QUEUE.md`. Keep the other completed illustrations available for independent QA.
6. No changes to dog rig, animation code, or unrelated app features. Do not merge until reviewed.

Generated image atlas is solely a direction/reference, not sprite frames or animation-ready vector layers.
