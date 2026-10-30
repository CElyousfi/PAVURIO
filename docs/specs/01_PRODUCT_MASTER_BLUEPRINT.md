# PAVURIO — Product Master Blueprint
Version 0.1 • October 30, 2026 • Working brand subject to clearance
Platforms: iOS + Android • Tech: Expo/React Native/TypeScript • Consumer product: no AI features

## 0. Boundaries and definition of success
Pavurio is a personal pet care companion with an original responsive illustrated animal, recurring care tools, pet records, memories and social-ready recap stories. It begins with dogs and cats; infrastructure is species-extensible. The target is a reliable, enjoyable subscription app, not a clinical treatment system, virtual pet simulator, community platform, or marketplace.

Business target: €5,000–€10,000 gross monthly recurring revenue equivalent. This is not profit or a guaranteed outcome. Product target: make recording real pet care easy enough that the product is useful without motion, while making the brand desirable because of motion and original art.

Hard rules:
- Real pet welfare is never inferred from streaks, animation states or missing logs.
- No diagnosis, dosage advice, automatically prescribed care, or health-scoring claims.
- A scheduled activity is not completed until explicitly confirmed.
- Medical reminders are never made conditional on payment.
- No copied trademarks, illustrations, character designs or exact competitor layouts.
- The pet's visual state may respond to confirmed actions but cannot generate, alter or fake underlying records.
- All core activities remain functional offline.
- Screens and paywalls disclose all behavior honestly; no placeholder buttons in release builds.

## 1. Personas and jobs-to-be-done
A. New dog owner: wants fast routine setup, reminders, basic vet records, milestones and delightful low-friction engagement.
B. Cat owner: feeding, litter, grooming, play, appointments, records and memories without dog-centered assumptions.
C. Multiple-pet owner: independent schedules, quick pet switching, combined calendar, clean separation of data.
D. Shared household (later): knows which person performed care, handles confirmations and avoids duplicates.
E. Life-long keeper: wants reliable searchable history, photo memories and safe exports for new caregivers/vets.

Core jobs: (1) know what is due; (2) record what happened; (3) find important records; (4) cherish memories; (5) transfer a useful care history; (6) optionally coordinate with another caregiver.

## 2. Positioning and messages
Working proposition: “A little world for all their big moments.”
Practical promise: “Care routines, records and memories in one delightful place.”
Never promise “healthier pets” or “never miss a medication” without careful context; device notifications can be delayed or suppressed.

Brand: provisional PAVURIO. Do not finalize bundle IDs, domains or paid artwork until exact and similarity trademark, domain, app name and handle checks in intended markets.

## 3. Release scope and hard dependencies
### Prototype — first vertical slice
One dog appearance, one pet profile, animated Home, quick log feeding, real SQLite write, undo, persistence across restart, motion controlled by an isolated visual state machine; test on iOS and Android devices.

### 1.0 public launch
- Dogs and cats with at least one high-quality rig and several appearance palettes per species.
- Guest-first onboarding; local pet profiles.
- Home: character, Today care summary, next item, quick actions.
- Activity logs: food, walks for dogs, play, litter for cats, grooming, water bowl, medication confirmation, measurements, custom notes.
- Schedules and device-local reminders; create, edit, pause, skip, mark done, snooze.
- Appointments and preventive-care records, with user-entered due dates and attachments.
- Memories: add photo, title, caption, date, privacy, per-pet album.
- Stories: deterministic monthly/anniversary/year recap with edited copy, factual stats and at least one free 9:16 image export.
- Basic character interactions, one Little World background, haptic/sound controls.
- Free/Pro entitlements through real stores, restore purchases, honest paywall and purchase recovery.
- Export data, accessible settings, FR/EN UI first; Arabic only when full RTL QA is achievable.
- Crash reporting, performance measurement and privacy-aware product analytics.

### 1.5
Cloud backup and restore, optional login/guest migration, more themes and story templates, advanced widgets, selective animated story video output after technical validation, more insights and more species-specific activity templates.

### 2.0
Household shared pets, access roles, record sharing, multi-device conflict resolution, additional species, advanced records, new seasonal Little Worlds.

Never implement all phases in one Claude pass.

## 4. Information architecture
Bottom tabs: Home | Care | (+) Quick Log modal | Moments | Pets.
Contextual destinations: Records, Insights, Appearance, Little World, Household (later), Settings, Subscription, Help, Privacy & Data.

Navigation states: deep links to specific pet/activity, Android back handling, iOS swipe-back, draft-preserving modal dismissal, notification-driven entry, subscription entitlement change while screen open, orientation changes.

## 5. Screen requirements by ID
Each screen must document normal, loading, empty, offline, error, large-text, RTL, permission denied and no-subscription states as applicable. Animated UI must not obscure screen-reader semantics.

### Onboarding
O01 Welcome: illustration, value proposition, Get started, legal links; animation must be skippable.
O02 Species: dog/cat choices; only supported species are selectable; do not imply full bird/reptile support at launch.
O03 Identity: required name, optional photo, approximate birthday, breed, adoption date; skip optional data.
O04 Character Studio: species-family-specific palettes, ears/coats/accessories that are actually compatible; live preview, undo preset, store local appearance.
O05 Routine templates: explain optional suggestions; owner customizes schedule times; no veterinary dosage assumptions.
O06 First scheduled item: create, preview and correct occurrence; timezone is explicit under the hood.
O07 First activity: walkthrough or genuine user event; clearly mark example demonstration if not persisted.
O08 Permission request: explain notification benefit before OS prompt; Not now works.
O09 Pro preview: show real, implemented premium features; Continue free visible; pricing loaded from store, not hardcoded.

### Home and character
H01 Pet Home: greeting (decorative), selectable pet, animated Little World scene, quick care action, scheduled list, important upcoming reminders, event history shortcut, current sync state when enabled.
H02 Character interaction overlay: tap, gentle press, drag of permitted prop/toy, motion option; no record generated from pet taps.
H03 Pet switcher: remember current pet, never mix care events across profiles.
H04 Little World: inventory, placing items on snap grid, reset and undo, free/premium themes; hidden when no compatible assets.

### Care
C01 Today list: upcoming, completed, skipped, postponed, unconfirmed statuses. Segregate by pet; filter.
C02 Week/month calendar: timezone handling, cross-month navigation, recurring instance previews.
C03 Activity log sheet: structured templates, timestamps, note entry, optional units/photos; quick path vs details path.
C04 Activity detail: created/occurred times, actor if shared, notes, edits, undo/correction and linked recurring item.
C05 Schedule editor: name, pet, category, recurrence, local time, reminder offsets, quiet hours and end date.
C06 Appointments: date, contact/location optionally, reminders, add to calendar/share via native controls.
C07 Measurements: weight/other owner-provided readings, validated units, no automatic medical interpretation.
C08 Care insights: factual counts and time-series; label missing data, exclude clinical assessments.

### Records
R01 Record list: vaccinations, vet visits, allergies, prescribed medications, other documents; search/filter.
R02 Record editor: source/provenance, date, text fields, attachment, reminders, confidence is always 'user-entered' unless verified externally.
R03 Record viewer: safe PDF/photo render, privacy controls, export/share, remove/restore policy.
R04 Care summary: factual and editable PDF/print export (later if necessary), all dates and sources visible.

### Moments / stories
M01 Memories grid: chronological, date filters, per-pet grouping, hero seasonal art.
M02 Create memory: photo, optional caption, date, type, pet association; preview and save.
M03 Memory details: share one card, edit and delete, manage photo permissions.
M04 Story hub: Monthly Moments, Adoption Chapter, Birthday, Your Pet's Year, Create Your Story.
M05 Story assembly: only actual stored memories and counts; user can hide numbers/photos, reorder slides, change template.
M06 Story player: 9:16 full screen, progress tracks, tap next, hold pause, swipe back, replay, sound/motion toggles.
M07 Export: 9:16 / 4:5 / 1:1 static PNG/JPEG; preview with safe areas, gallery permission; native share sheet.
M08 Later video: MP4 via separate validated rendering pipeline, progress, cancellation, failures, cost controls.

### Pets / settings / commerce
P01 Pet list: add second pet (premium gate), edit, archive, switch.
P02 Pet details: dates, species, care customizations, records link, appearance.
P03 Character Studio: supported assets and combinations, store local choices, preview even when Pro locked.
S01 Settings: languages, units, date/time, haptics, audio, reduced motion, theme, privacy.
S02 Notifications: permission state, per-category settings, re-sync scheduled notifications.
S03 Pro paywall: localized store prices, accurate trial terms, Restore, Terms, Privacy, Continue free.
S04 Manage subscription: app store management deep link or clear instructions, current entitlement and purchase error states.
S05 Data: CSV/JSON export plus media as reasonable, local reset, account deletion when cloud account exists.
S06 Support: FAQ, contact form/mail, debug report opt-in, diagnostics without pet medical free-text.

## 6. Critical user interactions and state contracts
- Complete routine: validate → persist event and occurrence state in a transaction → update UI and notification schedule → trigger optional character celebration. No optimistic fake completion that can be lost.
- Undo: correct via compensating event or reversible state, update affected recaps and future reminders; offer short undo snackbar.
- Offline: show explicit offline icon if sync enabled, all local logging remains available; persist mutation queue with idempotency keys.
- Notification tap: route to correct pet/schedule, validate whether event already completed.
- Pet switch: all UI and cache keys include petId; cancel irrelevant character actions; never show stale pet data.
- Delete pet: friction proportional to data loss; warn about records/memories; export option; remove scheduled notifications; defined retention.
- Premium expires: data retained and exportable; premium editing limits applied only to new operations where appropriate; character doesn't disappear.
- Share recap: clear privacy checklist, no private records/addresses or geotags, confirmation then save/share sheet; never assume the user published.

## 7. Character, artwork and animation specification
Create an original approved art bible before any production asset. Use layered body/head/ears/eyes/mouth/legs/tail/accessories if motion is to be code-driven. GPT image generation typically returns raster composites; these require cutting, vector reconstruction or manually specified layer assets before rigging.

States: idle, blink, lookAt, greeting, petting, playing, sleeping/relaxed, feedingLogged, walkLogged, groomingLogged, milestone, customizing, sceneTransition.

State priorities: user navigation/critical alerts > direct touch > confirmation > ambient > idle. Cancel stale queued reactions. Store the actual care event without waiting for character animation.

Technique selection:
- UI controls, parallax, counters, graphs, interactive touch: Reanimated + SVG or Skia.
- Low-complexity pet parts: layered original transparent PNG/SVG art + code transformations.
- Complex loops (e.g. full run/jump): manually approved frame sequence/sprite sheet; validate pose consistency and loop seams.
- Rive only if a proper rig/state machine is authored; do not describe static GPT images as a Rive rig.
- Generated video only if a separately available and appropriately licensed video-generation/rendering workflow exists. GPT image generation alone does not generate source video clips.

Quality: 60fps target on representative hardware; bounded CPU/memory and app size; pause ambient animations offscreen; graceful fallback static pose; motion reduction compliance; no animation indicating the pet is harmed by missing app engagement.

## 8. Little World
Home scene composed of independently placed original props, interactive foreground, pet anchor and parallax layers. Progress unlocks are based on onboarding milestones and owner-approved organizational events, not prescribed feeding/walking quotas.

Scene grid data: environmentId, backgroundId, item placements, item unlock IDs, z-order, scale, anchor, rotation, premium entitlement flag. Preserve unlocked core items after subscription lapse, define premium-edit restrictions fairly. No loot boxes, guilt mechanics, or pay-to-restore-animal-health loops.

## 9. Recaps and the growth engine
Story source data: actual activity IDs and memory IDs. Slides: intro, walks logged (if any), owner-selected photos, notable custom milestone, care organization summary (optional), closing.
Recap availability: First Month, Monthly, Birthday, Adoption Anniversary, Year-End and Custom. Each must function with sparse records by omitting unsupported claims.

Draft story can be edited before export; no private medical detail, geolocation or full pet-owner names without explicit choice. Support no-music exports, accessibility captions, optional branding. Free users get at least one useful static share template. Premium gets additional themes, advanced edit controls, later video exports and multi-pet stories.

Measurements: recap_generated, edited, static_export_completed, native_share_initiated, attributable install/referral. A share-sheet open is not proof that a post went live.

## 10. Free/Pro entitlement matrix
Free: one pet, core logging, core reminders, essential record storage, compact history, simple Memories, basic Little World, one beautiful social static export, local data export.
Pro candidate: multi-pet, custom advanced recurring routines, longer/filtered history, expanded records and themes, advanced customization, higher story-template library, more export formats, optional cloud backup after implementation.
Family later: shared care responsibility, delegated task permissions, family roles. Essential reminders and user data exports must not be withheld behind paywall.

Initial pricing experiments: annual €29.99 vs €39.99; monthly around €5.99; native region pricing should be shown from StoreKit/Play not hardcoded. Trial length and paywall timing as controlled experiments. Do not launch features that aren't present on the paywall.

Purchase states: unknown/loading, not purchased, eligible trial, trial active, active, canceled-but-active, grace, billing issue, expired, refunded, revoked, pending, restore, offline cache. Entitlement verified via RevenueCat/store. Include restore purchases and management flow.

## 11. Technical components
App: Expo SDK compatible with required native packages, React Native, TypeScript, Expo Router, React Native Reanimated, react-native-svg, optional Skia, SQLite, Expo Notifications, Image Picker, media library, haptics, RevenueCat SDK, analytics and crash monitoring.

Data architecture: React components → feature hooks/controllers → pure domain actions → typed repositories → SQLite. Optional cloud sync: durable mutation log → authenticated backend → PostgreSQL/storage and conflict policy.

Persistence model:
- pets(id, species, name, birth_date, adoption_date, appearance_json, timestamps)
- care_activity_types(id, species, label, schema_version, details_schema)
- care_events(id, pet_id, type_id, occurred_at_utc, recorded_at_utc, actor_id, details_json, source, mutation_id, corrected_by_id)
- care_schedules(id, pet_id, type_id, recurrence_rule, tzid, local_time, start_date, end_date, enabled)
- schedule_occurrences(id, schedule_id, occurrence_key, due_utc, status, linked_event_id)
- appointments(id, pet_id, time_utc, tzid, title, notes)
- medical_records(id, pet_id, type, record_date, source, instructions, verification_status)
- attachments(id, owner_type, owner_id, local_uri, cloud_key, metadata, checksum)
- measurements(id, pet_id, kind, numeric_value, unit, time_utc)
- memories(id, pet_id, title, caption, date, photo_uri, visibility)
- story_drafts(id, pet_id, period, template_id, slides_json, export_settings)
- character_assets(id, family, palette, animations, revision)
- world_items(id, pet_id, item_id, unlocked_at, x, y, layer)
- local_mutations(id, entity, operation, created_at, synced_at, retry_count)
- subscription_cache(id, entitlement, expires_at, last_verified_at)

Indexes on pet+time, schedule due instances, mutation ID unique, and attachments owner. Include FK integrity and migration tests. Schema uses TZ database identifiers and UTC instants: never calculate a 'daily' recurrence by simply adding 24 hours.

## 12. Privacy, safety, accessibility and data lifecycle
Treat owner names, photos, addresses and contact info as personal data. Obtain contextual platform permissions. Never require contacts/GPS for core care. Store cloud documents privately with access controls. Export and deletion must work. Maintain clear privacy/terms/support URLs and store data disclosures; document telemetry and third-party processors. Avoid prefilled diagnosis, treatment schedules or pet welfare scores. Respect reduced motion, screen readers, large text, touch targets, high contrast, Arabic RTL when released.

## 13. QA and launch gates
Golden path e2e: create pet → set routine → notification → log completion → animation → kill app → reopen → history unchanged → undo → progress and reminders corrected.
Second path: create memory → generate sparse/normal recap → remove photo/stat → render story at 9:16 → share → no private fields.
Third path: purchase annual plan in store sandbox → relaunch → Pro active → restore on second device where supported → cancel → entitlement survives until expiration → expires correctly.

Block release for lost/duplicated medication confirmations, incorrect pet data association, inaccessible core flows, severe freezes, broken restore purchases, private-data leaks and misleading pricing.

## 14. Business instrumentation and acquisition
Track app_store_view, install, onboarding_completed, pet_created, first_care_log, schedule_created, activated (pet + meaningful log + next task), D1/D7/D30 activity, paywall_view, trial_start, paid_start, cancel, refund, renewal, story_export and referrer. Do not send medical free text into analytics.

Channel experiments: original character demo videos, pet routine demonstrations, real scrapbook stories, pet creators, app-store search landing pages, French/English localization tests, opt-in referral attribution. Measure CAC per payer and payback, not views alone. Later localized MENA tests should separately assess pricing and willingness to pay.

Target examples only: 100 consistently engaged users; 20 real subscription purchasers; repeatable payer cohorts; eventual €5K and €10K gross MRR equivalent. Annual price €39.99 needs ~1,501 annual payers for €5K and ~3,001 for €10K before fees and costs.

## 15. Development milestones and approvals
M0 research, source footage and refero design board; assets rights and preliminary brand check.
M1 brand/art bible approved, first dog appearance and complete Home interaction specification.
M2 first pet/feeding vertical slice tested on both platforms with durable local persistence.
M3 schedules, appointment and notification engine tested across timezones.
M4 cat family, memories, records and lightweight insights.
M5 recap image rendering, responsive story player, share sheets and privacy guardrails.
M6 RevenueCat and actual sandbox purchase testing, accessibility and localization.
M7 30–50 household closed beta, logging reliability, performance budgets, paywall experiments.
M8 app-store submissions and staged rollout with monitoring and support.
M9 evidence-driven expansions: cloud sync, multi-pet workflows, shared households, native widgets/Live Activities, MP4 recaps, species expansion.

Each milestone ends with: changed files list, reproducible demo, unit/integration/e2e tests, screenshots + 10-second video of interaction, unresolved defects, no fabricated success claims, updated decision log.
