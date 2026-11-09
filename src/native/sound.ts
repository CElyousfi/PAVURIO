/**
 * Pavurio's sound effects (tools/sound/make_sounds.py → assets/sounds, list in docs/SOUNDS.md).
 * Sounds mix with the user's music and stay quiet when the phone is on silent. Turned off with the
 * "Sounds" setting.
 *
 * On Android every expo-audio player call (creating one, play, seek, volume) BLOCKS the JavaScript
 * thread until the UI thread has run it, and each player is a whole ExoPlayer holding a media decoder.
 * Keeping one player per sound (22 of them by the end of setup) can exhaust the phone's decoders and
 * freeze the app mid-tap: the save after "Start with this plan" froze there with its spinner turning.
 * So: at most MAX_PLAYERS players (least recently used one is released), and a sound never plays inside
 * the handler that changes the screen — it's queued for the next macrotask, after the UI work.
 */
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { SOURCES } from './soundSources';
export type SoundName = keyof typeof SOURCES;

let enabled = true;
let modeSet = false;
/** live players, least recently used first */
const players = new Map<SoundName, AudioPlayer>();
export const MAX_PLAYERS = 6;
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
    const have = players.get(name);
    if (have) {
      // most recently used goes to the end
      players.delete(name);
      players.set(name, have);
      return have;
    }
    while (players.size >= MAX_PLAYERS) {
      const [oldest, p] = players.entries().next().value as [SoundName, AudioPlayer];
      players.delete(oldest);
      try {
        p.remove();
      } catch {
        // already gone
      }
    }
    const p = createAudioPlayer(SOURCES[name]);
    players.set(name, p);
    return p;
  } catch {
    return null;
  }
}

/** for tests: how many players are alive */
export function livePlayers(): SoundName[] {
  return [...players.keys()];
}

/** Load the sounds used right away (taps, logging) so the first one isn't late. */
export function preloadSounds(names: SoundName[] = ['tap', 'select', 'tick', 'log']) {
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
  // after the handler's own work (state updates, navigation) has gone out: see the file comment
  setTimeout(() => playNow(name, volume), 0);
}

function playNow(name: SoundName, volume: number) {
  if (!enabled) return;
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
