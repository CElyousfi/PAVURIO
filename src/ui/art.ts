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
    meal: { empty: null as Img, half: null as Img, full: null as Img },
    /** assets/art/care/water_low.png, water_half.png, water_full.png */
    water: { empty: null as Img, half: null as Img, full: null as Img },
    /** assets/art/care/walk.png */
    walk: null as Img,
    /** assets/art/care/play.png */
    play: null as Img,
    /** assets/art/care/grooming.png */
    grooming: null as Img,
    /** assets/art/care/litter.png */
    litter: null as Img,
  },
  ui: {
    /** assets/art/ui/welcome_badge.png — small icon above the welcome headline, 512×512 transparent */
    welcomeBadge: null as Img,
    /** assets/art/ui/empty_day.png — pet next to an empty bowl, hopeful and happy, 1024×1024 transparent */
    emptyDay: null as Img,
    /** assets/art/ui/plan_header.png — dog and cat looking at a checklist, 1536×1024 transparent */
    planHeader: null as Img,
  },
  cat: {
    /** assets/art/cat/avatar.png — cat head bust for small avatars, 512×512 transparent */
    avatar: null as Img,
  },
};

export type CareArtType = keyof typeof ART.care;
