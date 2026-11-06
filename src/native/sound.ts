/**
 * Pavurio's sound effects (tools/sound/make_sounds.py → assets/sounds, list in docs/SOUNDS.md).
 * One small player per sound, created on first use and kept: replaying is a seek + play, so a sound
 * answers a tap with no delay. Sounds mix with the user's music and stay quiet when the phone is on
 * silent. Turned off with the "Sounds" setting.
 */
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCES = {
  tap: require('../../assets/sounds/tap.m4a'),
  select: require('../../assets/sounds/select.m4a'),
  tick: require('../../assets/sounds/tick.m4a'),
  toggle_on: require('../../assets/sounds/toggle_on.m4a'),
  toggle_off: require('../../assets/sounds/toggle_off.m4a'),
  pop: require('../../assets/sounds/pop.m4a'),
  slide_1: require('../../assets/sounds/slide_1.m4a'),
  slide_2: require('../../assets/sounds/slide_2.m4a'),
  slide_3: require('../../assets/sounds/slide_3.m4a'),
  slide_done: require('../../assets/sounds/slide_done.m4a'),
  log: require('../../assets/sounds/log.m4a'),
  complete: require('../../assets/sounds/complete.m4a'),
  badge: require('../../assets/sounds/badge.m4a'),
  save: require('../../assets/sounds/save.m4a'),
  undo: require('../../assets/sounds/undo.m4a'),
  delete: require('../../assets/sounds/delete.m4a'),
  error: require('../../assets/sounds/error.m4a'),
  restock: require('../../assets/sounds/restock.m4a'),
  photo: require('../../assets/sounds/photo.m4a'),
  walk_start: require('../../assets/sounds/walk_start.m4a'),
  pet: require('../../assets/sounds/pet.m4a'),
  open: require('../../assets/sounds/open.m4a'),
} as const;
export type SoundName = keyof typeof SOURCES;

let enabled = true;
let modeSet = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};
// the same sound twice within this window plays once (two handlers for one tap, a fast wheel)
const last: Partial<Record<SoundName, number>> = {};
const MIN_GAP: Partial<Record<SoundName, number>> = { tick: 45, tap: 60, select: 60 };

export function setSoundsEnabled(v: boolean) {
  enabled = v;
}
export function soundsEnabled() {
  return enabled;
}

function mode() {
  if (modeSet) return;
  modeSet = true;
  // mix with music, never take audio focus; silent mode silences us like any polite app
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
}

function player(name: SoundName): AudioPlayer | null {
  try {
    if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
    return players[name]!;
  } catch {
    return null;
  }
}

/** Load the sounds used right away (taps, logging) so the first one isn't late. */
export function preloadSounds(names: SoundName[] = ['tap', 'select', 'tick', 'log', 'slide_1', 'slide_done', 'pop']) {
  if (Platform.OS === 'web') return;
  mode();
  for (const n of names) player(n);
}

let pendingTap: ReturnType<typeof setTimeout> | null = null;

export function playSound(name: SoundName, volume = 1) {
  if (!enabled) return;
  if (name === 'tap') {
    // a button's own sound (select, log, delete…) usually follows in the same tap: the generic tap waits a
    // moment and steps aside if anything else plays, so one press is one sound
    if (pendingTap) clearTimeout(pendingTap);
    pendingTap = setTimeout(() => {
      pendingTap = null;
      play('tap', volume);
    }, 16);
    return;
  }
  if (pendingTap) {
    clearTimeout(pendingTap);
    pendingTap = null;
  }
  play(name, volume);
}

function play(name: SoundName, volume: number) {
  const now = Date.now();
  if (now - (last[name] ?? 0) < (MIN_GAP[name] ?? 30)) return;
  last[name] = now;
  mode();
  const p = player(name);
  if (!p) return;
  try {
    p.volume = volume;
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // a sound is never worth an error
  }
}
