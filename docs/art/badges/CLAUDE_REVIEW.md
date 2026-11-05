# Claude review — Pavurio badge pack

Fourteen achievement badge keys match `src/domain/badges.ts` exactly.

- Runtime 512×512 RGBA transparent PNG: `assets/art/badges/<key>.png`
- Original 1024×1024 PNG: `docs/art/badges/highres/<key>.png`
- Editable vector SVG: `docs/art/badges/svg/<key>.svg`
- `manifest.json` maps color and symbols.

**Before merging:** review the in-app Achievements screen at locked/earned states; compare colors and icon legibility with approved Pavurio artwork; confirm all `require` mappings in `src/ui/art.ts`, run typecheck and device tests; update the badge queue checkbox only after tests pass. The badge illustrations are vector reconstructions following image-generated art direction, not crops of the original generated sheet. Do not replace any dog/cat animation or unrelated artwork.
