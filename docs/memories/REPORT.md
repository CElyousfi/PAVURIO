# Pavurio Memories — implementation report (2 Nov 2026)

## What was built
- **Today's little moment.** This card appears on Home and on the Memories screen.
  - It has two buttons: **Take Photo** and **Choose from Gallery** (up to 10 photos at once).
  - Photos are saved straight away, with no confirmation step. Each photo is placed on the day it was taken (EXIF `DateTimeOriginal`). Photos with no capture date, or a date in the future, go on today.
  - After saving, the moment viewer opens with confetti (skipped when reduced motion is on), a "Moment saved!" card and optional quick extras: caption, milestone, other pets, fix date.
  - A day can hold several photos. One of them can be marked as the day's featured photo.
- **Scrapbook** (`/moments`, titled "Memories") has three tabs:
  - **Moments:** grouped by month in a virtualized FlatList, with a favorites filter.
  - **Milestones:** upcoming birthday and adoption day, a timeline of milestones, and quick buttons to add one: First Day Home, Birthday, Adoption Anniversary, First Adventure, First Trick, Holiday Memories, Special Day, Custom.
  - **On This Day:** photos from earlier years. A 29 Feb photo shows on 28 Feb in non-leap years.
- **Moment viewer** (`/moment`): full-screen photo, pets, date, caption and milestone. Actions: favorite, feature for the day, share (re-encoded, so GPS is not included), edit, delete, and **Create Memory Card**.
- **Moment editor** (`/memory`): photo, optional title and caption, date, milestone, which pets are in it, favorite, and an optional link to one of that day's adventures.
- **Memory Cards** (`/cards`, `/card`): 10 templates, each in Story (1080×1920) and Post (1080×1350).
  - The editor suggests starting photos from the owner's own moments. The choice uses only dates and the owner's flags (featured, favorite, adventure).
  - You can pick photos from Memories or the gallery, reorder them (◀ ▶), drag to frame, pinch to zoom, or use the − + ← → ↑ ↓ buttons for accessibility.
  - Title and name/date text are optional. Preview, then Save to Photos or Share.
- **Anniversary prompt** (Home and Memories): appears from 7 days before to 2 days after a birthday or adoption date. It suggests Birthday Pawty / Gotcha Day / Then & Now / A Year Together. Dismissing it is remembered per pet, per anniversary type and per year.
- **Integrations:**
  - The Care calendar marks birthdays, adoption days and milestones, with a legend.
  - The Adventure detail screen shows "Moments from this adventure" and can add photos to it.
  - Deleting a walk keeps the linked photos and only removes the link.
  - Week/month stories include moments shared with the pet.
  - The "Memory keeper" badge fires on the first save.

## Files
- **New:**
  - Data and rules: `src/data/memoriesRepo.ts`, `src/data/uris.ts`, `src/domain/memories.ts`, `src/native/media.ts`
  - Shared UI and card logic: `src/features/MemoriesKit.tsx`, `src/features/CardCanvas.tsx`, `src/features/memoryCards.ts`
  - Generated from the templates: `src/features/memoryTemplates.generated.ts`, `src/features/memoryTemplateArt.generated.ts`
  - Screens: `src/app/moment.tsx`, `src/app/cards.tsx`, `src/app/card.tsx`
  - Other: `src/i18n/memories.ts`, `tools/art/memories.py`, `assets/memories/*` (20 templates plus `layout_manifest.json`), `tests/memories.test.ts`, `tests/helpers/migrateTo.ts`
- **Changed:**
  - Data: `src/data/migrations.ts` (v5), `recordsRepo.ts`, `walkRepo.ts`, `snapshot.ts`, `repo.ts`
  - Screens: `src/app/moments.tsx` (rewritten), `memory.tsx` (rewritten), `care.tsx`, `adventure.tsx`, `pet.tsx`, `settings.tsx`, `_layout.tsx`
  - Shared: `src/features/HomeFeed.tsx`, `src/native/files.ts`, `src/ui/forms.tsx` (Field ref), `src/ui/motion.tsx` (Bouncy keeps fixed heights on flex buttons), `src/i18n/core.ts`
  - Config: `app.json` (permission wording), `package.json` (expo-image-manipulator ~58.0.16)

## Data and media storage
- **Migration v5 extends the existing `memories` table; nothing is replaced.**
  - New columns: `media_id`, `favorite`, `featured`, `milestone`, `walk_id`, `captured_at`, `updated_at`.
  - New table `media`: uri, thumb_uri, width, height, mime, captured_at, sync_status.
  - New table `memory_pets`: one memory, many pets, with no duplicated files. A trigger links the primary pet on every insert, including walks and restores.
  - Backfill: every existing memory gets its pet link, legacy photos get `legacy-<id>` media rows, adventure memories get `walk_id`, and old milestones become "custom".
- **Files**
  - The original is copied byte for byte into `Documents/memories/`. A 480 px JPEG thumbnail goes into `memories/thumbs/`.
  - Paths are stored as `pv-doc:…` relative to the Documents folder, so they survive iOS container changes.
  - On web, which has no file system, photos are stored as data URLs of at most 1600 px. Memory rows never duplicate that data.
- **Safe deletion**
  - `releaseMedia` deletes a file only when no memory, other media row or walk still points to it.
  - Deleting a pet moves its shared moments to another pet in them, then releases its own photos.
  - "Erase everything" removes the memories folder.
  - If a save fails, the photo it copied is released.
- **Backup**: the snapshot now includes `media` and `memory_pets`. Older backups get media rows when restored.

## Rendering and export
- `CardCanvas` lays out everything in export pixels and scales it for the preview, so the preview and the export match.
  - Each photo is cover-fitted into its window (`coverRect`), and pan/zoom are clamped so the window is always filled.
  - The template PNG sits on top. The title and footer text are sized to fit their white pills.
- **Export**
  1. A copy is mounted off screen, at a size whose device pixels equal the export size.
  2. The export waits until every image has loaded. A failed or slow photo stops the export with a message, so a card never goes out with an empty window.
  3. `captureRef` captures it as a JPEG.
  4. ImageManipulator resizes it to exactly 1080×1920 or 1080×1350. Re-encoding also means no EXIF/GPS travels with it.
- Export stays blocked until every window has a photo ("Add N more photos").
- Verified on web: the exported files are exactly 1080×1920 and 1080×1350, with no EXIF.

## Template integration
`tools/art/memories.py` reads the 20 PNGs. It measures each transparent window (box and corner radius, in reading order) and the clean white area of the title and footer pills. From these it generates the layout manifest, so nothing is hand-typed.

| Template | Windows |
|---|---|
| daily | 1 |
| home | 1 |
| thennow | 2 |
| birthday | 1 |
| gotcha | 2 |
| adventures | 3 |
| littlethings | 4 |
| month | 6 |
| bestfriend | 1 |
| year | 12 |

The same counts apply in both formats.

## Tests
- `npm test` (three timezones): **91 passing**, 27 of them new for Memories.
- The new tests cover:
  - Migration and upgrade from v4.
  - Saving, validation, multi-pet moments, featured and favorite.
  - Deleting shared media, keeping files that a walk still uses, and releasing a replaced photo.
  - Walk links, On This Day (including leap days), milestones, backup and restore (including older backups), pet deletion, legacy photos, and relative paths.
  - EXIF parsing, capture day, anniversaries and prompts, cover/pan clamping, month grouping, the template manifest, prefill, and slot rules.
- tsc and eslint are clean. Every new string exists in FR, ES and PT.
- I walked through the whole flow on the web build. An independent review found 11 issues, and all of them are fixed.

## Limitations
- **Not yet run on a device.** Check camera import, EXIF dates on iOS and Android, Save to Photos and the share sheet, and pinch-zoom feel.
- **Cloud backup covers the database only.** Photo files are not uploaded, so restoring on a new phone brings the moments back without their images.
- On web, photos are kept as data URLs in the local database.
- Template text uses the app font (Nunito), so very long titles shrink to fit.

## Art to replace
None of the templates need replacing; they are used exactly as supplied. If you send new versions, re-run `python3 tools/art/memories.py <uploads> assets/memories src/features/memoryTemplates.generated.ts`.
