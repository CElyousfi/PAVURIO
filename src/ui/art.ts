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
    /** Honey & Tabby hugging, transparent (ChatGPT duo hero, 1024 px) — Smart Reminders card */
    remindersHero: require('../../assets/art/scenes/duo.webp') as Img,
    /** crowned Honey & Tabby scene card (batch 01 #10, EDSR 4x) — paywall hero */
    paywallHero: require('../../assets/art/scenes/premium.webp') as Img,
    /** assets/art/ui/streak_flame.png — friendly flame/paw mascot for streaks, 512×512 transparent */
    streak: null as Img,
  },
  /** assets/art/badges/<key>.png — 512×512 transparent medals; missing = built-in medal */
  badges: {} as Record<string, Img>,
  /**
   * Scene cards (rounded, coloured backgrounds) cut from ChatGPT's illustration sheets and upscaled 4x
   * (tools/art/scenes.py). Audit + screen mapping: docs/art/ILLUSTRATION_AUDIT_01_02.md.
   * Render them as cards (rounded corners, cover), never on top of other art.
   */
  scenes: {
    premium: require('../../assets/art/scenes/premium.webp') as Img,
    records: require('../../assets/art/scenes/records.webp') as Img,
    moments: require('../../assets/art/scenes/moments.webp') as Img,
    appointments: require('../../assets/art/scenes/appointments.webp') as Img,
    weigh: require('../../assets/art/scenes/weigh.webp') as Img,
    trophy: require('../../assets/art/scenes/trophy.webp') as Img,
  },
  /** challenge key -> scene card; missing = care icon (litter7 waits for a redo, see the audit) */
  challenges: {
    walk7: require('../../assets/art/scenes/walk.webp'),
    walk30: require('../../assets/art/scenes/walk.webp'),
    water7: require('../../assets/art/scenes/water.webp'),
    play14: require('../../assets/art/scenes/play.webp'),
    brush10: require('../../assets/art/scenes/brushing.webp'),
    perfect5: require('../../assets/art/scenes/trophy.webp'),
  } as Record<string, Img>,
  /** tip id -> scene card; missing = care icon */
  tips: {
    water: require('../../assets/art/scenes/water.webp'),
    'walk-sniff': require('../../assets/art/scenes/walk.webp'),
    'cat-play': require('../../assets/art/scenes/play.webp'),
    brush: require('../../assets/art/scenes/brushing.webp'),
    meals: require('../../assets/art/scenes/meals.webp'),
    weigh: require('../../assets/art/scenes/weigh.webp'),
    calm: require('../../assets/art/scenes/bed.webp'),
  } as Record<string, Img>,
};

export type CareArtType = keyof typeof ART.care;
