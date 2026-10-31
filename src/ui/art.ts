/**
 * ART REGISTRY: the single place where static illustrations are plugged into the app.
 *
 * Every entry is `null` until the real artwork exists. To add a piece of art:
 *   1. put the PNG at the path in the comment (see docs/art/CHATGPT_ART_BRIEF.md for specs);
 *   2. replace `null` with `require('<that path>')` (relative to this file: '../../assets/art/...').
 * Screens fall back to the built-in vector drawing while an entry is null, so nothing breaks.
 */
type Img = number | null;

export const ART = {
  care: {
    /** assets/art/care/meal_empty.png, meal_half.png, meal_full.png — 1024×1024 transparent */
    meal: {
      empty: require('../../assets/art/care/meal_empty.png') as Img,
      half: require('../../assets/art/care/meal_half.png') as Img,
      full: require('../../assets/art/care/meal_full.png') as Img,
    },
    /** assets/art/care/water_low.png, water_half.png, water_full.png */
    water: {
      empty: require('../../assets/art/care/water_low.png') as Img,
      half: require('../../assets/art/care/water_half.png') as Img,
      full: require('../../assets/art/care/water_full.png') as Img,
    },
    /** assets/art/care/walk.png */
    walk: require('../../assets/art/care/walk.png') as Img,
    /** assets/art/care/play.png */
    play: require('../../assets/art/care/play.png') as Img,
    /** assets/art/care/grooming.png */
    grooming: require('../../assets/art/care/grooming.png') as Img,
    /** assets/art/care/litter.png */
    litter: require('../../assets/art/care/litter.png') as Img,
  },
  ui: {
    /** assets/art/ui/welcome_badge.png — small icon above the welcome headline, 512×512 transparent */
    welcomeBadge: require('../../assets/art/ui/welcome_badge.png') as Img,
    /** assets/art/ui/empty_day.png — pet next to an empty bowl, hopeful and happy, 1024×1024 transparent */
    emptyDay: null as Img,
    /** assets/art/ui/plan_header.png — dog and cat looking at a checklist, 1536×1024 transparent */
    planHeader: null as Img,
    /** assets/art/ui/reminders_hero.png — the pet jumping happily under a sample notification, 1200×1200 transparent */
    remindersHero: null as Img,
    /** assets/art/ui/paywall_hero.png — dog and cat together, celebratory, 1536×1024 transparent */
    paywallHero: null as Img,
    /** assets/art/ui/streak_flame.png — friendly flame/paw mascot for streaks, 512×512 transparent */
    streak: null as Img,
  },
  /** assets/art/badges/<key>.png — 512×512 transparent medals; null = built-in medal */
  badges: {} as Record<string, Img>,
  /** assets/art/challenges/<key>.png — 1024×1024 transparent, pet doing the activity; null = care icon */
  challenges: {} as Record<string, Img>,
  /** assets/art/tips/<id>.png — 1024×1024 transparent; null = care icon */
  tips: {} as Record<string, Img>,
};

export type CareArtType = keyof typeof ART.care;
