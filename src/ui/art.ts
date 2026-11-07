/**
 * ART REGISTRY: the single place where static illustrations are plugged into the app.
 *
 * Every entry is `null` until the real artwork exists. To add a piece of art:
 *   1. put the PNG at the path in the comment (see docs/art/CHATGPT_ART_BRIEF.md for specs);
 *   2. replace `null` with `require('<that path>')` (relative to this file: '../../assets/art/...').
 * Screens fall back to the built-in vector drawing while an entry is null, so nothing breaks.
 */
import type { SceneArt } from './Scene';
import type { StickerName } from './Sticker';

type Img = number | null;

export const ART = {
  /**
   * Care illustrations (ChatGPT, Nov 2026; tools/art/careicons.py → assets/art/care2, 512 px webp).
   * One picture per care: the log card and the Home row show it as a gray silhouette that fills
   * with its real colours (FillArt), every list shows it in colour. Objects only: the pets themselves
   * are always the animated Honey & Tabby (Sticker / PetRig).
   */
  care: {
    meal: require('../../assets/art/care2/meal.webp') as Img,
    water: require('../../assets/art/care2/water.webp') as Img,
    walk: require('../../assets/art/care2/walk.webp') as Img,
    play: require('../../assets/art/care2/play.webp') as Img,
    grooming: require('../../assets/art/pantry/icon_tools.webp') as Img,
    litter: require('../../assets/art/care2/litter.webp') as Img,
    medication: require('../../assets/art/pantry/icon_supplements.webp') as Img,
  },
  /** Pavurio Adventures (ChatGPT final set, tools/art/adventures2.py) */
  adventures: {
    adventure_saved: require('../../assets/art/adventures/adventure_saved.webp'),
    badge_cloud: require('../../assets/art/adventures/badge_cloud.webp'),
    badge_early: require('../../assets/art/adventures/badge_early.webp'),
    badge_first: require('../../assets/art/adventures/badge_first.webp'),
    badge_five: require('../../assets/art/adventures/badge_five.webp'),
    badge_golden: require('../../assets/art/adventures/badge_golden.webp'),
    badge_spring: require('../../assets/art/adventures/badge_spring.webp'),
    badge_ten: require('../../assets/art/adventures/badge_ten.webp'),
    badge_together: require('../../assets/art/adventures/badge_together.webp'),
    passport_cover: require('../../assets/art/adventures/passport_cover.webp'),
    stopwatch: require('../../assets/art/adventures/stopwatch.webp'),
    t_afternoon: require('../../assets/art/adventures/t_afternoon.webp'),
    t_evening: require('../../assets/art/adventures/t_evening.webp'),
    t_golden: require('../../assets/art/adventures/t_golden.webp'),
    t_morning: require('../../assets/art/adventures/t_morning.webp'),
    t_night: require('../../assets/art/adventures/t_night.webp'),
    w_cloudy: require('../../assets/art/adventures/w_cloudy.webp'),
    w_cold: require('../../assets/art/adventures/w_cold.webp'),
    w_hot: require('../../assets/art/adventures/w_hot.webp'),
    w_night: require('../../assets/art/adventures/w_night.webp'),
    w_partly: require('../../assets/art/adventures/w_partly.webp'),
    w_rainy: require('../../assets/art/adventures/w_rainy.webp'),
    w_snow: require('../../assets/art/adventures/w_snow.webp'),
    w_storm: require('../../assets/art/adventures/w_storm.webp'),
    w_sunny: require('../../assets/art/adventures/w_sunny.webp'),
    walk_ready: require('../../assets/art/adventures/walk_ready.webp'),
    walk_scene: require('../../assets/art/adventures/walk_scene.webp'),
  } as Record<string, number>,
  /** Honey & Tabby scenes for whole sections (Nov 2026; sources in docs/art/duo-src) */
  duo: {
    /** Care: routines & visits */
    routines: require('../../assets/art/duo/routines.webp'),
    /** Summary and Achievements */
    awards: require('../../assets/art/duo/awards.webp'),
    /** Privacy policy, Terms of use, backup and data safety */
    privacy: require('../../assets/art/duo/privacy.webp'),
  },
  /** section illustrations from the same set */
  section: {
    calendar: require('../../assets/art/icons/ui_calendar.webp'),
    records: require('../../assets/art/care2/records.webp'),
    medication: require('../../assets/art/pantry/icon_supplements.webp'),
    leash: require('../../assets/art/care2/walk_leash.webp'),
  },
  ui: {
    /** assets/art/ui/welcome_badge.png — small icon above the welcome headline, 512×512 transparent */
    welcomeBadge: require('../../assets/art/ui/welcome_badge.png') as Img,
    /** day with nothing logged: the pet by its bowl, hopeful */
    emptyDay: 'dog_eat' as StickerName,
    /** Smart Reminders card */
    remindersHero: 'duo_hug' as StickerName,
    /** paywall hero */
    paywallHero: { pet: 'duo_party', tint: '#FFE7A8' } as SceneArt,
    /** streak flame (PR #4 atlas B, EDSR 4x) */
    streak: require('../../assets/art/icons/flame.webp') as Img,
  },
  /** GPT's 14 badge medals (docs/art/gpt-badges/sheet.png → tools/art/badges.py, 512 px) */
  badges: {
    family: require('../../assets/art/badges/family.webp'),
    hydration: require('../../assets/art/badges/hydration.webp'),
    first_log: require('../../assets/art/badges/first_log.webp'),
    walker: require('../../assets/art/badges/walker.webp'),
    streak3: require('../../assets/art/badges/streak3.webp'),
    groomer: require('../../assets/art/badges/groomer.webp'),
    routine: require('../../assets/art/badges/routine.webp'),
    record: require('../../assets/art/badges/record.webp'),
    weight: require('../../assets/art/badges/weight.webp'),
    meds: require('../../assets/art/badges/meds.webp'),
    birthday: require('../../assets/art/badges/birthday.webp'),
    moment: require('../../assets/art/badges/moment.webp'),
    streak7: require('../../assets/art/badges/streak7.webp'),
    challenge1: require('../../assets/art/badges/challenge1.webp'),
  } as Record<string, Img>,
  /** object icons from PR #4 (no characters): paywall perks, empty and error states */
  icons: {
    gift: require('../../assets/art/icons/gift.webp'),
    gem: require('../../assets/art/icons/gem.webp'),
    infinity: require('../../assets/art/icons/infinity.webp'),
    shield: require('../../assets/art/icons/shield.webp'),
    offline: require('../../assets/art/icons/offline.webp'),
    error: require('../../assets/art/icons/error.webp'),
    noReminders: require('../../assets/art/icons/no_reminders.webp'),
    paw: require('../../assets/art/icons/ui_paw.webp'),
    trophy: require('../../assets/art/icons/ui_trophy.webp'),
    chart: require('../../assets/art/icons/ui_chart.webp'),
    heart: require('../../assets/art/icons/ui_heart.webp'),
    calendar: require('../../assets/art/icons/ui_calendar.webp'),
  },
  /** Scene cards: the animated pets on a soft tinted card (Scene). */
  scenes: {
    premium: { pet: 'duo_party', tint: '#FFE7A8' },
    records: { pet: 'dog_meds', tint: '#DDF3E4' },
    moments: { pet: 'duo_camera', tint: '#FFE3EC' },
    appointments: { pet: 'duo_laugh', tint: '#E3ECFF' },
    weigh: { pet: 'dog_cheer', tint: '#E8F5D6' },
    trophy: { pet: 'dog_cheer', tint: '#FFF0C2' },
  } as Record<string, SceneArt>,
  /** tip id -> scene card; missing = care icon */
  tips: {
    water: { pet: 'cat_drink', tint: '#DFF2FB' },
    'walk-sniff': { pet: 'dog_trot', tint: '#E4F4DA' },
    'cat-play': { pet: 'cat_play', tint: '#F3E6FB' },
    brush: { pet: 'cat_happy', tint: '#FDEBDD' },
    meals: { pet: 'dog_eat', tint: '#FFEBD9' },
    weigh: { pet: 'dog_cheer', tint: '#E8F5D6' },
    calm: { pet: 'cat_bed', tint: '#E7EAFB' },
    litter: { pet: 'cat_walk', tint: '#F1ECE4' },
  } as Record<string, SceneArt | undefined>,
};

export type CareArtType = keyof typeof ART.care;
