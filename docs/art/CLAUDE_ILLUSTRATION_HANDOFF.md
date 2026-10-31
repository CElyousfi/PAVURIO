# Claude handoff — illustration batches 01 and 02

## Goal
Review 20 new illustrated scene concepts and decide which screens benefit from these assets. User requests production integration, but **these are not yet publishable-resolution artwork**. They are lower-resolution image crops and include colored backgrounds.

## Required sequence
1. Inspect current screen route tree, `src/ui/art.ts`, existing art, animation and design tokens. Inventory actual screen needs; avoid rewriting existing code or overriding approved character masters.
2. Compare the concepts with the approved Honey dog and Tabby cat reference assets. Check face, fur, collars/bandana, proportions, colors, readability, unwanted artifacts, and cropping. Reject inconsistent concepts rather than silently shipping them.
3. Create a mapping document from each accepted illustration to screens: onboarding, choose pet, Home, log meal/walk/play/groom, pet records, memories, premium, calendar, vet, medication, vaccine, measurements, growth, badges, litter, bathing and rest. Some should remain unused if screens already have better art.
4. Request independently generated high-resolution approved replacements for any hero/large card: typically >=1024 square or target aspect ratio at 2x device density. Preserve transparent foreground art where UI layering is required; keep colored backgrounds only in intended rectangular cards.
5. Once approved, optimize to WebP/PNG as needed, add explicit `require()` image imports in `src/ui/art.ts` (or the project's existing art module), and preserve safe fallbacks. Never display these low-res crops at large hero sizes.
6. Verify layouts on small and large iOS and Android screens, image loading/memory, RTL, accessibility labels and reduced motion. Do not generate fake user data or health claims.
7. Run lint, typecheck, automated tests and native build; record actual results, not assumptions. Validate app-store asset licensing and original branding.
8. Maintain an acceptance checklist for each of the 20 assets. Ask the user to review the final replacements before merging into the release branch.

## Delivery policy
This branch contains **only concept PNGs and documentation**. No production entry points or in-app image mappings have been modified, because proper visual and native-device QA has not occurred. Merge only after review; deploy separately from the asset import.

## Refero-derived UI design directions
- Onboarding: focused hero character illustration and short CTA, progressive details.
- Log screens: large character/prop for feedback, clear data entry and undo.
- Care calendar: date strip, tasks and event timeline with actionable states.
- Memories: photo-first cards and scrapbook/story exports.
- Paywall: explicit plans, clear value, skip/restore, native-price accuracy.
These are pattern references, not copied third-party artwork or layouts.
