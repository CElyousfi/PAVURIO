# PAVURIO — Reference Board (M0)

Research source: Refero MCP, app **Waterllama** (Refero app id `274`, https://refero.design/apps/274), iOS.
Retrieved 30 Oct 2026. Waterllama is studied as **UX evidence only**. We do not copy its characters,
illustrations, copy, icons or exact screen geometry. Pavurio's characters are original (see
`docs/art/character-sheet-reference.png`) and are drawn in code as layered vectors.

## 1. Screens and flows studied

| # | Pattern | Refero source | What is useful | What we must NOT copy |
|---|---------|---------------|----------------|------------------------|
| 1 | Home: big number + mascot that "fills" with each logged drink | [Home (llama)](https://refero.design/screens/fdae625b-3a62-4ef2-b6c6-ad52947e6405), [Home (giraffe)](https://refero.design/screens/a8d9c97c-4db6-473c-807f-21f8565cbf75) | One giant metric at top, one gray subtitle. The character IS the progress bar. A single row of 5 quick-add icons with `+` badges and spaced uppercase labels. Floating circular controls top-left/right. A rounded card peeks from the bottom. | Llama / giraffe / animal silhouettes, the surfboard, drink icons, "Hydration · x% of your goal" copy. |
| 2 | Quick-add drink card (full-screen) | [Drink card](https://refero.design/screens/9b6ee9af-626e-436f-bb02-bafc655e2215), flow [Add beverage & set volume](https://refero.design/flows/11515) | One huge illustration, amount as hero number, up/down control on the object, the CTA is a pill in the item's own color labelled `+ ITEM`. Close is a floating white circle. Confirm → back to Home → mascot fill animates. | Cup art, exact layout ratios, "+ GREEN TEA" wording. |
| 3 | Day detail / history | [Day detail](https://refero.design/screens/d61af236-d265-49e3-92ac-7913f4bc2b36), flow [Add missed beverage](https://refero.design/flows/11524) | Mini mascot on top, total + subtitle, list rows with colored title, amount, time on the right; soft pill buttons "Delete / Edit" and "Add a missed entry". | Caffeine chip, copy. |
| 4 | Onboarding welcome + first log tutorial | flow [Hydration onboarding & first sip](https://refero.design/flows/11511), [Welcome](https://refero.design/screens/9f0d0dd8-9211-4c7e-a34c-1f80ace75da0) | Small icon + one headline, giant silhouette that colors in, dark navy pill CTA "GET STARTED". Units as a bottom sheet. "Add your first sip" teaches the core action before anything else. Reminders explained *before* the OS prompt. | Llama artwork, carousel of their animals, App Store award paywall content. |
| 5 | Character selector | flow [Hydration Character Selector](https://refero.design/flows/11514) | Character lives in the quick-add row as the first item; opening it shows a collection; choice is reflected immediately on Home. | Their character roster and names. |
| 6 | Share card | flow [Share Card to Social](https://refero.design/flows/11516) | Card preview + one big share button handing off to the native sheet. | Card template. (Pavurio Stories = later milestone.) |
| 7 | Paywall | flow [Subscription checkout](https://refero.design/flows/11513) | Persistent CTA, restore + legal links always visible, honest close. | Everything visual; and we will not ship a paywall until real store products exist. |
| 8 | Goal setup | flow [Hydration goal setup](https://refero.design/flows/11512) | Instant recalculation as inputs change; explicit DONE. | — |

## 2. Synthesis — the design idea we keep

1. **The pet is the progress bar.** Waterllama's core idea is a mascot that fills as you log.
   Pavurio's twist: your pet starts the day as a soft pencil-gray sketch and gets *colored in*
   (in its own real palette) as you log the care you planned. A finished day = a fully colored pet.
   The pet is never sad, sick, or "harmed" by missing logs — the sketch state is neutral and the
   face is always happy (blueprint §7: no guilt mechanics).
2. **One number, one sentence.** Home shows `3/6` in huge rounded type and one gray line:
   "Care logged · 50% of today's plan".
3. **One row of care.** Pet avatar (opens Character Studio) + 4 care types for the species, each an
   illustrated icon with a colored `+` badge and spaced uppercase label.
4. **Focused log card.** Tapping a care type opens a full-screen card: big object illustration that
   reacts to the amount, hero amount, up/down control, time chip ("Now", "15 min ago"…), and a pill
   CTA in that care type's color: `+ MEAL`.
5. **Celebrate only after save.** The card closes, the record is already in SQLite, *then* the fill
   animates and the pet celebrates. An undo snackbar appears for 6 seconds.
6. **Day detail.** Mini pet, totals, colored rows, edit/delete, "Add a missed entry", day paging.
7. **Floating circles, no tab bar.** Like the reference, Home has no tab bar: top-left circle =
   today ring (opens Day detail), top-right circle = settings.

## 3. Original Pavurio visual language (tokens in `src/ui/theme.ts`)

- Canvas `#FFFFFF` / `#FBFAF7`; ink `#23304A` (navy, used for CTA pills and headings); muted `#9AA1AE`.
- Sketch gray for un-colored pet `#ECEDEF` with outline `#DADCE0`.
- Brand accent: Pavurio teal `#14B8C4` (taken from the dog's bandana in our own character sheet).
- Care colors: Meal `#F59E0B`, Walk `#58C322`, Water `#1CB0F6`, Play `#FF6B9A`, Grooming `#9B7BF7`, Litter `#B07A4F`.
- Type: Nunito (OFL) 800/900 for numbers & headings, 700 for body. Uppercase labels tracked +1.
- Radius: pills fully rounded; cards 28; floating circles 48–56 with soft shadow `0 6 18 rgba(35,48,74,.10)`.

## 4. Gaps the reference does not solve (Pavurio-specific)

- **Record provenance:** every care event stores `occurred_at` *and* `recorded_at`, a `mutation_id`
  (idempotent writes) and soft-void for undo — Waterllama has no notion of provenance.
- **Multiple species:** activity templates differ by species (Walk for dogs, Litter for cats).
- **No inferred welfare:** progress is "of your plan", never "your pet is healthy".
- **Reminders:** must be explained before the OS prompt and never paywalled (M3).
- **Social export** (Stories) requires privacy checklist (M5).

## 5. Animation language

| State | Motion | Trigger |
|-------|--------|---------|
| idle | breathing (body scaleY 1→1.015), tail sway, random blink 2.5–5 s, ear twitch | always (paused when screen unfocused / reduce motion) |
| lookAt | pupils follow finger (clamped), head tilts ±6° toward finger | touch down / move on pet |
| tap | squash & stretch bounce, ears flop, tongue out, floating hearts, light haptic | tap on pet |
| celebrate | jump, fast tail wag, burst of care-colored confetti, success haptic | **after** a care event is persisted |
| fill | colored layer rises over sketch layer, 900 ms ease-out | progress change |

Priorities: navigation > direct touch > confirmation > ambient > idle. A new direct touch cancels the
running ambient motion; data writes never wait on animation.
