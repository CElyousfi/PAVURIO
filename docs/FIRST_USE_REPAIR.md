# First-use & start-up repair (branch `fix/first-use`)

Baseline: `main` @ `c149b062`. This document is the root-cause report and the record of what changed,
how it was verified, and what is still unverified.

## 1. Root causes of the tester-reported problems

| # | Report | Root cause (in the code) | Files | Fix |
|---|---|---|---|---|
| 1 | Can't see the name being typed | The setup screen's `KeyboardAvoidingView` had `behavior={ios ? 'padding' : undefined}`, which turns keyboard avoidance OFF on Android. Expo SDK 58 apps draw edge-to-edge on Android, so the OS no longer resizes the window for the keyboard (`adjustResize` has no effect). The keyboard therefore covered the bottom of the screen. Above the input sat a pet preview sized from the screen width (`W × 0.72 × 0.78`, ≈ 230 dp), in a `flex: 1, minHeight: 200` box that could not shrink. | `src/app/onboarding.tsx` | `behavior="padding"` on both platforms (safe either way: it pads only by the keyboard's real overlap with the view). The name step is now a scroll view with a fixed CONTINUE above the keyboard. The pet shrinks to a small companion when the keyboard opens (`useKeyboardHeight`, `previewSize('form')`), or steps aside when space is very short. The labelled, outlined field has a focus border, a brand caret and an error message for an empty name. The keyboard's Next submits. Names are trimmed and inner spaces collapsed. The keyboard is dismissed before the studio opens. |
| 2, 5 | Can't select the collar colour; collar too far down | The appearance step was not scrollable. The coat grid wrapped into 2–3 rows of 62 dp swatches (13 dog / 11 cat coats), and the collar row came after it. On a ≈ 640–730 dp-high Android viewport the collar row was pushed below the screen. | `src/app/onboarding.tsx`, `src/features/PetEditors.tsx` | New **Pet Studio** (`StudioPicker`): a Coat \| Collar/Bandana segmented control, so only one list shows at a time; one horizontally scrolling row of 56 dp swatches; the chosen colour's full name; a Pro "try-on" note with "Back to a free coat". The middle of the screen scrolls. |
| 3 | Can't validate the customisation | "Looks right" was the last child of a non-scrolling column, after the oversized pet and the swatch grid, so it ended up off screen. | `src/app/onboarding.tsx` | **USE THIS LOOK** sits outside the scroll area, above the system navigation bar (safe-area inset), and is always on screen. "Keep the default look" is offered below it. A Pro coat that was only tried on falls back to a free coat: no paywall during setup. |
| 4, 6 | The pet is enormous and overlaps the interface | Pet size came only from width (`min(W × 0.72, 330)`). The clip stage (`ClipStage`) does not clip its frames, so jumps and waves (hello / celebrate) drew outside its box, over titles and controls. | `src/app/onboarding.tsx`, `src/animation/ClipStage.tsx` (unchanged) | New `PetPreview`: a bounded box with headroom and `overflow: hidden`, used everywhere in setup. New `previewSize(kind, width, availableHeight, keyboard)` sizes the pet from the space really left (window − status bar − navigation bar − fixed UI − keyboard): hero, studio (≈ 160–210 dp tall on ordinary phones, less on compact ones), form, card. Unit-tested in `tests/layout.test.ts`. |
| 7, 8 | Can't enter the app / stuck on the splash | Four separate problems: **(a)** `BrandSplash` (the logo over the app) only removed itself when its fade reported `finished === true`. Reanimated reports `false` when the animation is cancelled, for example when the app is backgrounded during start-up, so the logo stayed over a working app forever. **(b)** The native splash was hidden only by `BrandSplash`, which mounts only after the database and state are ready. A database or migration error, or a hang, left the native splash up indefinitely. **(c)** If loading state failed, `AppState` set `ready = true` with no pet, so Home redirected to setup: an error looked like "your pets are gone". **(d)** Finishing setup always went to the paywall, which waits for store offerings, so a slow or unconfigured store kept testers out of Home. | `src/features/BrandSplash.tsx`, `src/app/_layout.tsx`, `src/state/AppState.tsx`, `src/app/onboarding.tsx` | **(a)** The fade callback always finishes, plus a 2.9 s fallback timer, and it fires exactly once. **(b)** A 10 s start-up watchdog in `RootLayout`. A `StartupBoundary` catches database/migration errors. Both show a friendly "We couldn't open your data / This is taking longer than usual" screen with **Try again**, which remounts the database and app state without deleting anything, logs to Crashlytics and hides the native splash. The screen-crash `ErrorBoundary` also hides the native splash. `onInit` is now a stable function, so the database is never re-opened by a re-render. **(c)** A load failure before the first success shows the retry screen, never setup. **(d)** Setup ends on **Welcome home**, then Home. The paywall is never on the path, and closing the paywall always lands somewhere (back, else Home). |

## 2. The new first-use journey

1. **Welcome**: "Every little care makes a big difference." / "Routines, food, health and memories…". Primary: **Let's meet your pet**. Secondary: "I already have an account". The old "Tap to wake" gate (a screen you had to discover a tap on) is removed.
2. **Units** (kg / lb, one tap).
3. **Who are we caring for?** Dog or Cat.
4. **Name**: keyboard-aware, as described above.
5. **Make {name} yours**: Pet Studio, as described above.
6. **About {name}**: age (with **I'm not sure**, which builds an adult plan and says so; no birthday is invented), size, weight (estimate labelled "Estimated"), food. Every field has a default or an "unsure" option.
7. **{name}'s plan is ready**: one screen with every care (how often, how much, times, reminder bell). Tap a line to edit it in a sheet. **Start with this plan** creates the pet. **Customize** walks through one page per care with the bowl controls, then returns. Flea, tick and worm prevention is **off by default**, offered "if your vet recommends it". A note says the numbers are general vet guidance, not medical advice.
8. **Welcome home, {name}!**: the pet celebrates. **Let's go** opens Home. "{name} just ate? Log the meal" opens the normal log card. Nothing is logged automatically.
9. **Home, first visit**: an intro card *inside the feed* (it never covers the app), "Here's {name}'s happy little world.", with Care, Pantry, Memories and Explore. **Show me around** starts a 4-tip tour, one tip at a time, each with Open, Next tip and close. **I'll explore myself** dismisses it.
10. **Contextual tips**, shown once each after the real save: first care, first walk, first pantry product, first photo.

Interruption handling:
- The setup draft (step, species, name, look, about) is saved and restored after an app kill. It resumes at "About" at the latest.
- The pet is created once: a second tap goes straight to Welcome home.
- Back works on every step. Badges unlocked by setup itself (e.g. "Planner") don't pop over the first Home.

## 3. Other screens changed

- **Explore** (`/explore`, new): the feature directory, with a one-line explanation for each feature. Home's menu button opens it, and Settings is its last entry.
  - Every day: Care, Pantry, Memories.
  - Health: Health records, Visits, the plan, Weekly summary.
  - Adventures & milestones: Paw Passport (dogs), Milestones, Memory Cards.
  - Make it yours: Appearance Studio, All pets, Widgets (how-to sheet), Settings.
- **Home**:
  - the intro card and tour;
  - the menu opens Explore;
  - "Add or edit" opens the plan (previously Settings).
- **Paywall**: closing with no screen behind it goes Home.

## 4. Analytics added (no names, photos or free text; fired from handlers, not renders)

- **Setup:** `species_selected`, `name_completed` (length bucket only), `appearance_opened`, `coat_selected`, `accessory_selected`, `appearance_confirmed`, `plan_overview_reached`, `onboarding_completed`.
- **After setup:** `home_reached` (first time), `intro_choice`, `feature_discovered`, `first_care_logged`.

## 5. Verification

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | pass |
| ESLint | pass, 0 problems |
| Unit tests (`npm test`, 3 time zones) | pass. Adds `tests/layout.test.ts` (pet sizing on compact and ordinary phones, keyboard open) |
| Web build walkthrough at 360×640 and 412×915 (dog and cat) | Done. Welcome → species → name (empty-name error) → studio (coat tab, collar tab, choose) → about ("not sure") → plan → Welcome home → Home → intro tour → Explore. The confirm buttons were visible on every step; the pet stayed inside its box. |
| Native Android build | **Not run here.** No Android SDK or emulator is available in this environment. |
| Android keyboard behaviour (Samsung Keyboard, Gboard) | **Not verified.** It can't be reproduced on the web build. |
| iOS | **Not run.** |
| Maestro flows (`.maestro/`) | **Written, not run.** They need a device or emulator. |

## 6. Remaining risks / not done

- **Native checks:** the keyboard handling and all start-up fixes must be confirmed on a native build (build 7+). Testers should repeat the exact tasks they failed.
- **Brief phases 6–10 not implemented** (bottom tab bar, Care segmented control, Home hierarchy, Summary recap, Pantry flow): they change working screens and should be validated with testers first. Explore and the Home intro cover feature discovery in the meantime.
- **Settings still contains its old tile hub.** Explore duplicates it, so nothing is lost; remove the hub once Explore is validated.
- **Right-to-left:** the layout isn't mirrored (as before).
