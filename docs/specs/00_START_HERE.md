# START HERE — Pavurio Production Pack
Prepared October 30, 2026 • Provisional name PAVURIO (subject to clearance)

## What's included
1. `01_PRODUCT_MASTER_BLUEPRINT.md` — product PRD, screen map, features, UI states, data, premium, roadmap.
2. `02_REFERO_CLAUDE_BUILD_PLAYBOOK.md` — exact research-first MCP workflow and 10 phased Claude prompts.
3. `03_GPT_ART_ANIMATION_BIBLE.md` — art direction, character prompts, approved-asset continuity, frame/layer production and motion contract.
4. `04_RELEASE_QA_BUSINESS.md` — QA, dynamic island/widgets, store launch, pricing, growth and privacy.

## Start in this order
1. Import the entire ZIP into a dedicated Claude Code project or copy the four Markdown specs into `docs/`.
2. Connect the Refero MCP already available to you. Run `/mcp` in Claude Code to verify it. Do not replace an existing working connection.
3. **Do not rename the legal store identity yet:** Pavurio is only provisional pending trademark/domain screening.
4. Run the *MASTER FIRST PROMPT* below; do not let Claude start coding immediately.
5. Generate and approve a single original dog character using the art bible. Do NOT generate 50 assets first.
6. Build the feeding-event vertical slice, including actual data persistence and motion.
7. Record the actual iOS/Android screen and send errors back to Claude.
8. Only then proceed to recurring schedules, cat assets, memories, subscriptions and widgets.

## MASTER FIRST PROMPT — paste into Claude Code
```
You are lead product engineer, visual design architect and QA owner for
PAVURIO, a non-AI animated consumer pet care app on iOS and Android.

Read these supplied files in full before writing any production code:
- 01_PRODUCT_MASTER_BLUEPRINT.md
- 02_REFERO_CLAUDE_BUILD_PLAYBOOK.md
- 03_GPT_ART_ANIMATION_BIBLE.md
- 04_RELEASE_QA_BUSINESS.md

You have the Refero MCP connected. Verify the connection with the
available MCP tool listing; do NOT fabricate tool results. Research
visual style first, then specific iOS screens and complete flows:
onboarding, home, care quick log, reminders, Memories/Stories,
character customization, premium paywall, settings and data export.
Store links and concrete design patterns in REFERENCE_BOARD.md.
Do not copy competitor artwork, branding, screen geometry, or copy.

We use GPT to generate ORIGINAL character illustrations and layered
asset references, and Claude to implement code-driven motion. We DO
NOT have a Higgsfield subscription. Do not promise that GPT still
images are animated video or animation-ready vector rigs.

Use an Expo SDK version compatible with selected native dependencies,
React Native, TypeScript, SQLite, Reanimated, SVG/Skia as justified,
Expo Notifications, RevenueCat and Expo Widgets when appropriate.
Real RevenueCat purchases and widgets require native development builds.

We need one excellent vertical slice first:
1. Create a dog profile locally.
2. Display a home character with blinking and responsive touch.
3. Log an actual meal and save it to SQLite transactionally.
4. Update Today timeline.
5. Trigger character celebration only after confirmed persistence.
6. Undo or edit the event.
7. Kill and reopen the app; record still exists.
8. Demo on physical iPhone and Android device.

FIRST RESPONSE ONLY: produce
A. Verified Refero research plan and initial queries.
B. Original art direction choices and remaining asset needs.
C. App architecture and folder structure.
D. Database schema and care-event state flow.
E. Screen-state and interaction matrix for the vertical slice.
F. Milestone acceptance tests.
G. Dependencies, risks, and implementation sequence.
H. Exact first GPT illustration prompt for the approved dog direction.

Ask for no information already specified in the supplied documents.
Do NOT implement all screens in one pass. Do NOT make fake paywalls,
placeholders or mock events look production-ready. After planning,
propose the smallest code change and await the development go-ahead.
```

## Source transparency
The Waterllama animation tutorial has available timestamped third-party summaries. The first Dynamic Island tutorial could be identified but its complete transcript and frames were not accessible at research time. The native feature recommendations use official Expo/Apple documentation, not imagined video transcripts.

## Non-negotiables
- Small, original pet art system; progressively expand.
- Core features work offline.
- Accurate and editable records, not inferred animal health.
- Essential reminders free.
- Story recaps use saved data; sharing is private by default.
- Premium products and pricing are real store products, not mock screens.
- No release before iOS and Android device tests.
- Both developer registrations already obtained; only future recurring fees when due.
