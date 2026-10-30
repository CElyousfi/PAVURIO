# PAVURIO — Claude Opus 5.5 + Refero Build Playbook
Updated Oct 30, 2026 • Read `01_PRODUCT_MASTER_BLUEPRINT.md` first.

## 1. What to copy from Jason Lee's method (NOT copyrighted visuals)
The independently documented Waterllama/animated app video shows this cycle:
1. Inspect installed app and record important real interactions.
2. Retrieve screen/flow examples through a design-reference MCP rather than relying on vague adjectives.
3. Give Claude original character references plus specific target screens and screen recordings.
4. Produce a clickable, stateful skeleton and test it.
5. Use code-driven animation for responsive UI and interactions.
6. Use prepared video assets only for movements that code cannot render convincingly; this is where Jason uses a separate Higgsfield service.
7. Correct motion via filmed device reproduction and precise bug reports.
8. Prototype sensor-driven interactions with Reanimated and test physically.

Do not blindly copy exact screens, app mascot, distinctive phrases, paid assets, layouts or artwork. Treat competitor screens as comparative UX evidence, and combine with original design tokens, illustrative composition and domain-specific flow.

The second video about Apple's Dynamic Island was identified but could not be accessed as a complete timestamped transcript. Live Activities/widgets below are verified against Expo's official documentation, not falsely attributed to unretrieved video timestamps.

## 2. Set up Refero MCP in Claude Code
If the MCP is already connected, **do not reinstall or replace it**. In Claude Code run `/mcp` and confirm an authenticated `refero` server is available.
If not configured, official Refero skill docs currently show:

```bash
claude mcp add --transport http refero https://api.refero.design/mcp
```

Check https://refero.design/mcp and https://github.com/referodesign/refero_skill for up-to-date setup.
Optional official research-first design skill:

```bash
npx skills add https://github.com/referodesign/refero_skill --skill refero-design
```

Don't invent tool methods. Check the tool names available in the installed MCP. Public Refero tool families include styles, screens and flows, such as `refero_search_styles`, `refero_search_screens`, and the relevant flow-search tools documented by the current provider.

## 3. Research queries for the reference board
Always search `styles` before final design. For screens specify the required platform (`ios` for mobile). Search **patterns**, not “copy this app”.

### Style searches
- `friendly editorial illustration warm playful minimal ios app typography cream mint coral`
- `premium whimsical mobile pet care playful illustrations accessibility readable interface`
- `minimal modern soft playful consumer subscription app design system`

### Screen searches
- `onboarding pet profile select animal illustrated customization`
- `animated gamified habit tracker home daily progress mascot`
- `one tap activity logging bottom sheet ios`
- `calendar recurring reminders completed tasks ios`
- `personal health documents timeline list ios`
- `photo memory scrapbook collage cards ios`
- `year in review personalized story slides social sharing`
- `paywall monthly yearly comparison free trial restore purchase ios`
- `customization character accessories unlock store inventory`
- `notifications rationale before request permission ios`
- `empty state personal records first use mobile`
- `settings export delete account privacy subscription manage`

### Flow searches
- pet/profile setup; quick activity log and undo; edit recurring task; choose premium plan and return free; generate a story and share; account deletion; restore purchases.

### Research deliverable
Before Claude creates components, require `docs/research/REFERENCE_BOARD.md` with:
- Pattern, source URL, description, what is useful, what must NOT be copied.
- 2–3 candidates per key flow, screenshots or permitted reference links.
- A synthesis of design principles in original words.
- Identified gaps: pet record provenance, safe reminder states, social export UX.
- Proposed unique Pavurio layout and animation language.

## 4. Bootstrapping the project
Install versions supported by the *actual current Expo SDK*, not random `latest` for every native package. Use `npx expo install` where relevant. Set iOS/Android bundle IDs only once the provisional name is legally cleared. Scaffold a TypeScript project and install dev-client early because widgets/Rive/sandbox purchases may need native builds.

Example scaffold (review current docs before execution):

```bash
npx create-expo-app@latest pavurio
cd pavurio
npx expo install expo-dev-client expo-sqlite expo-notifications \
  expo-image-picker expo-media-library expo-sharing expo-haptics \
  react-native-reanimated react-native-svg react-native-gesture-handler \
  react-native-safe-area-context
```

Add animation rig packages (Rive/Skia) only after a tested compatibility spike. Add real RevenueCat SDK and widgets with native development builds, never infer real purchases from Expo Go's preview mode.

## 5. Repository structure
```
app/                      # expo-router routes only
src/domain/               # pets, care, schedules, records, memories, stories
src/data/                 # SQLite schema, repositories, migrations, sync
src/features/             # per-screen business logic and hooks
src/ui/                   # design-system components and tokens
src/animation/            # PetAnimationController, art manifests, scene engine
src/native/               # notifications, widgets, haptics, sharing
src/billing/              # RevenueCat adapter and entitlements
src/telemetry/            # privacy-aware analytics and errors
assets/                   # original versioned illustrations, rigs and sequences
docs/                     # reference board, decisions, contracts, QA, roadmap
tests/                    # unit, integration, end-to-end
```

## 6. Milestone prompts for Claude
### Prompt 0 — architecture and UX research
```
You are the senior architect and product design engineer for PAVURIO.
Read 01_PRODUCT_MASTER_BLUEPRINT.md and 03_GPT_ART_ANIMATION_BIBLE.md.
Use the ALREADY CONNECTED Refero MCP for actual styles, iOS screens and flow research.
Do not copy any source app. Create docs/research/REFERENCE_BOARD.md with
URLs, pattern findings, limitations and original design recommendations.
Next create: navigation map, role/data boundaries, minimum domain models,
interaction inventory, UI state specification, dependencies, risk register,
and M0–M8 implementation backlog.
Produce only specs and diagrams in this pass. Do not scaffold a full application yet.
```

### Prompt 1 — design system + navigator
```
Build original Pavurio design tokens and reusable primitives from the approved art bible.
Build accessible typography, buttons, cards, sheets, tabs, loading/error/empty states,
modal interactions, haptics abstraction, safe areas and text scale testing.
Create visual previews at 3 device sizes. Build real navigation between stub screens,
clearly marked as unavailable. No fake completed functionality.
For every component, provide accepted touch, keyboard and screen-reader states.
```

### Prompt 2 — dog vertical slice
```
Implement one dog pet in SQLite and one Home screen with an original layered dog.
Implement a 'Meal' quick log with input validation and data persistence.
The saved event updates the Today list and triggers a visual animation state.
Close/restart the app and verify that the event persists.
Implement edit/undo and duplicate-tap protection. Add real tests.
Do not create a second species or a cloud backend yet.
```

### Prompt 3 — animation engine
```
Review the animation contract from the art bible.
Integrate an approved layered pet asset; do NOT invent new character proportions.
Create a typed PetAnimationController: idle, blink, look at touch, tap reaction,
feeding_logged, care_logged, resting. All movement must be cancellable,
react to touches and stop offscreen. Respect reduce motion and battery constraints.
Prefer Reanimated + transform layers; test one sprite sequence if needed.
Report frame budget and real-device performance, then wait for visual approval.
```

### Prompt 4 — routines and notifications
```
Implement recurrence rules separately from local notifications. Model schedule
occurrences with scheduled, completed, skipped, postponed, unknown states.
Use IANA timezone identifiers; test DST. Schedule local reminders and cancel
or reschedule on edits/deletion. Never auto-mark an event completed.
Create the Calendar and Reminder settings, permission education, and unit tests.
```

### Prompt 5 — cats, records and memories
```
Create a distinct cat interaction family with species-specific actions.
Add pet records with source, date, optional attachment, and owner-entered status.
Add Memories photos, milestone types, captions, edit/delete and gallery views.
Do not generate diagnoses, prescriptive dosage instructions or health scores.
```

### Prompt 6 — story and export engine
```
Build deterministic recap generation sourced strictly from saved event IDs.
Support month, first-month, adoption anniversary, birthday, annual and custom recaps.
Make an interactive 9:16 player with tap advance, hold pause, progress bars,
back/replay, editing and privacy controls. Render a static full-res story
image via a reproducible layout, test capture/save/share. Support 4:5 and 1:1.
Do not claim animated MP4 exports exist unless a real renderer is integrated.
```

### Prompt 7 — paywall
```
Integrate real RevenueCat entitlements with store monthly/annual products.
Use development builds and store sandbox testing. Implement trials, restore,
cancel-but-still-active, expiration, refund, offline cache, purchase pending,
and paywall loading errors. Get prices from storefront metadata. No fake buttons.
```

### Prompt 8 — widgets and live activities
```
Use official Expo Widgets docs for the installed SDK version.
Build a useful home-screen widget with next upcoming care item and pet image.
Build an optional iOS Live Activity ONLY for a genuinely ongoing event such as
an active walking timer (not a permanent mascot overlay). Provide Lock Screen,
Dynamic Island compact/minimal/expanded layouts as supported, graceful fallback
on devices without Dynamic Island, and equivalent Android ongoing notification
where justified. Test with a real development build, not Expo Go.
```

### Prompt 9 — QA, release and launch
```
Perform a production audit against 04_RELEASE_QA_BUSINESS.md.
Verify real SQLite state, notifications, data export, purchase restores,
accessibility, translations, app-privacy disclosures, secure storage and crash logs.
Build signed release candidates, internal/TestFlight/closed tracks, verify on real
phones, produce screenshots and staged release plan. Never claim store approval
until actually approved by the stores.
```

## 7. Voice/screen-recording feedback loop
Record 10–30 seconds showing the actual reproduction steps and expected result. Give Claude:
- Device model, OS version, app build/git commit.
- Steps from fresh launch, exact taps, expected and actual behavior.
- Captured logs/stack traces (redact private data).
- Whether issue is visual, animation, database, network or purchase related.
- Scope constraint: change only affected module, preserve all other states.
Require a tiny regression test and new video showing corrected behavior. Do not accept “fixed” without device verification.

## 8. Native surfaces: what NOT to assume
Expo SDK 56 introduced stable expo-widgets and ActivityKit-based Live Activities (confirm current installed SDK docs). These are not standard React Native screens. Widget code runs in an isolated native-oriented render context and cannot freely access hooks, asynchronous functions or arbitrary Rive scenes.
- iOS home widget: glanceable 'Next care at 18:00' plus illustration and deep link.
- iOS Lock Screen: small upcoming appointment/reminder widget when supported.
- iOS Live Activity/Dynamic Island: only while a specific real-time activity is underway, such as a user-started walk timer. End it reliably when stopped.
- Android home widget: analogous next scheduled item. Android doesn't have Apple's Dynamic Island; use an appropriate ongoing notification where it solves a real problem.
- The Live Activity should not show pet mood/health claims or pretend all day to be ongoing.
- Design static native-friendly pet icons for widgets, not arbitrary embedded animations.

## 9. Checkpoint discipline
For each milestone Claude must deliver:
1. User-visible demo or screen capture, including the interaction in motion.
2. Files changed + concise design rationale.
3. Automated tests and real-device smoke-test results.
4. Remaining blocker list.
5. Accept/reject checklist and the next minimal dependency.
6. Updated docs and versioned asset manifests.

Stop and correct errors at the current milestone. Do not ask Claude to regenerate the entire app after a small issue.

## 10. Definitive success criteria
Vertical slice is complete ONLY IF:
- user creates a dog, logs a valid meal, can edit or undo;
- record survives an app kill/restart and date/time is correct;
- progress updates accurately and respects skipped/unconfirmed states;
- layered pet responds smoothly to a direct tap, blinks, celebrates after persisted record;
- animation can be skipped/disabled without impacting data;
- everything is testable on a real iOS AND Android phone;
- no inaccessible buttons, fake backend, or mock purchase logic are represented as production-complete.
