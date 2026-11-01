# PAVURIO motion spec (reference: Waterllama)

**Reference:** Waterllama iOS app — the "how to use" screen recording (in-app section 2:17–3:00, stepped at 60 fps)
and its screens and flows on Refero (app 274: onboarding & first sip, add beverage, character selector,
hydration summary, share poster).
**Scope:** whole app. **Fidelity:** exact for the log moment; inspired everywhere else.
**Stack:** Expo SDK 58, RN 0.88, Reanimated 4.7, expo-router.

## The feel in one paragraph

Waterllama never makes you wait and never moves anything that isn't the point. The one move that
defines it is the cup: tap the water icon and the cup *grows out of that icon* in a quarter second
while the llama behind it fades, tap "+ WATER" and the level rises in 200 ms, then the cup dips
and drops straight back into the icon, and the llama is already a little more blue. Everything else
— sheets, buttons, cards — is quiet, fast and springy. The character itself is a calm presence;
its colour-in edge is one clean water line that rises smoothly.

## Measured from the reference (60 fps frame counts)

| Moment | Frames | Duration | Curve |
|---|---|---|---|
| Cup grows out of the tapped icon | ~15 | **≈250 ms** | ease-out, no overshoot |
| Background (llama, header) fades out under it | ~8 | ≈130 ms | linear-ish |
| Water level rises after "+ WATER" | ~12 | **≈200 ms** | ease-out |
| Cup dips before leaving | ~4 | ≈70 ms | ease-out |
| Cup drops back into the icon | ~13 | **≈210 ms** | ease-in (accelerating) |
| Character sheet swipe-dismiss | ~18 | ≈300 ms | decelerating, follows finger |
| Promo modal slide-up | ~10 + settle | ≈300 ms | spring, slight overshoot |

## Tokens (src/ui/springs.ts, src/ui/motion.tsx)

| Token | Value | Used for |
|---|---|---|
| `springs.pressIn` | damping 20, stiffness 420, mass 0.6 | finger down on anything |
| `springs.pressOut` | damping 11, stiffness 320, mass 0.7 | finger up (small bounce back) |
| `springs.pop` | damping 9, stiffness 240, mass 0.8 | counts, badges, numbers that change |
| `springs.gentle` | damping 18, stiffness 190, mass 0.9 | sheets, panels |
| open (log card) | 260 ms, bezier(0.2, 0, 0, 1) | object grows from icon |
| close (log card) | 70 ms dip to 0.95 + 210 ms ease-in cubic | object drops back into icon |
| art level change | 200 ms ease-out crossfade | empty → half → full bowl |
| colour-in rise | 800 ms, bezier(0.2, 0, 0, 1) | the pet's water line |
| stagger | 70 ms per item, from 80 ms | lists and cards |
| screen push | slide_from_right 280 ms | stack |
| log card screen | fade 150 ms (the object carries the motion) | modal |

## Choreography: logging care (Home → log card → Home)

```
ms        0    70   150  260       ~      0    70        280   +380      +3200
icon      press(0.9)
screen    ---fade in (150)---
object    grow from icon ---------(260)
details        fade up, +120 ----(260)
                                   [save]
object                             dip 0.95 → drop into icon (210, ease-in)
Home                                                    splash on icon, count pops, day number pops
pet                                                          clip + hearts
badges                                                                        may show (held 3.2 s)
```

## Pets (src/animation/ClipStage.tsx)

- Frame clock is a Reanimated frame callback on the UI thread; the visible sheet window moves in an
  animated style. React re-renders only when playback enters the next sheet (every 0.5–1 s) to mount
  the one after it.
- Idle, sleep, idle variety and the tap reaction now play at the source's **24 fps**; long actions stay
  at 12 fps to keep the app small (+≈12 MB instead of +≈55 MB for everything at 24).
- Colour-in edge stays a single crisp line (like Waterllama's). A feathered edge was tried (2 and 3
  stacked translucent windows) and dropped: at phone scale the steps read as stripes, and it cost
  3 extra image layers per pet.
- Sketch layer re-rendered: flat light coat, outlines only for truly dark strokes (the bandana and
  collar no longer turn into dark smudges), bowl keeps colour but not the cheek above it, drawn floor
  line removed wherever no paw stands on it.

## Reduced motion

Every token checks `motionReduced()`: presses still give haptics, objects appear in place, sheets
appear without sliding, the pet stays still and is fully drawn at its real colour-in level.
