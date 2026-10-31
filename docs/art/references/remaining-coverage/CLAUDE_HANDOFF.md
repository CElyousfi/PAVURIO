# Remaining Pavurio artwork — Claude handoff

Two generated concept atlases have been imported for visual planning. **They are NOT individual production images or animation clips.** The original atlases were RGB composites; these copies have been palette-optimized for repository storage, retaining their dimensions.

## Reference atlases
- `docs/art/references/remaining-coverage/atlas_A.png`
- `docs/art/references/remaining-coverage/atlas_B.png`

## Tasks before claiming complete
1. Review `docs/art/ART_QUEUE.md` and `docs/art/CHATGPT_ART_BRIEF.md` on main; preserve approved original Honey/Tabby artwork, code and animation assets.
2. Generate independent high-resolution transparent images for missing: empty day, daily plan, reminders hero, paywall hero, streak flame; 7 challenge arts, 8 tips and 14 badges; then worlds, stories, accessories and empty states as needed.
3. Verify artwork fidelity, alpha transparency, no text/watermarks, sizing, duplicate coverage and alignment.
4. Only wire accepted production assets in `src/ui/art.ts` and relevant UI; ensure typecheck, screenshots and device QA. Never wire either atlas directly.
5. Animations remain a separate pipeline (not delivered by these sheets). Verify missing clips against the shared queue.

This PR is reference-only and should not be interpreted as an art-completion milestone. No runtime changes are included.
