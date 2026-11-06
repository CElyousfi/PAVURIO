/**
 * ClipStage — a pet played entirely from its approved generated videos (dog: DogStage, cat: CatStage).
 *
 * - `idle` loops (ping-pong) while nothing else is happening.
 * - Actions (`celebrate`, `eat`, `drink`) play once, crossfading in and out of idle.
 * - Every clip is drawn twice, a gray sketch and the real coat, and the coat is revealed from the
 *   bottom by the day's progress (the Waterllama-style color-in), so it stays consistent in every state.
 * - Frames come from 12-frame WebP sheets (24 fps for idle/sleep/idle2/celebrate, 12 fps for the
 *   long actions). The frame clock runs on the UI thread (Reanimated frame callback): each frame only
 *   moves a sheet window in an animated style, so a busy JS thread never makes the pet stutter.
 *   React re-renders only when playback crosses into the next sheet (every 0.5–1 s), to mount the
 *   upcoming sheet ahead of time. An action starts only after its first sheets have loaded.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { FrameInfo } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { BurstLayer } from './Burst';
import type { PetClipName, PetRigProps } from './PetRig';

type Ref = { cx: number; bottom: number; height: number };
export type ClipMeta = {
  origin: number[];
  sc: number;
  frames: number;
  fps: number;
  per: number;
  cols: number;
  chunks: number;
  fw: number;
  fh: number;
  loop: boolean;
  pingpong: boolean;
  /** cat videos each frame the pet differently: per-clip sitting reference */
  anchor?: Ref;
};

/** Everything species-specific about a clip-driven pet. */
export type ClipKit = {
  clips: Record<string, ClipMeta>;
  img: Record<string, Record<string, number[]>>;
  /** shared sitting reference when clips don't carry their own */
  anchor: Ref;
  palettes: string[];
  /** accessory drawn into the video itself (no overlay needed) */
  nativeAccessory: string;
  accessories: string[];
  overlayPrefix: string;
  /** sitting pet height, fraction of stage height */
  petH: number;
  /** runtime-dyed coats: per clip, the base coat split into layers (tools/art/dye.py) */
  dye?: Record<string, Record<'fur_body' | 'fur_patch' | 'fur_shade' | 'fur_feat', number[]>>;
  dyeOf?: (paletteId: string) => { body: string; patch: string } | null;
  /** clip actually played for a request (null = nothing to play) */
  resolve: (name: PetClipName) => string | null;
  base: (rest: boolean) => string;
};

/** Stage proportions (relative to the stage width). */
const ASPECT = 1.05;
const PAWS = 0.9; // paw line, fraction of stage height

/**
 * Sheets to keep decoded for a layer. Short clips keep all; ping-pong loops keep both neighbours (they
 * play back and forth); actions keep the current sheet and the next. A paused clock keeps only the
 * sheet it is showing (an idle under a playing action, a pet on a page that isn't on screen).
 */
function sheetsToKeep(c: ClipMeta, chunk: number, running: boolean): number[] {
  const last = c.chunks - 1;
  const k = Math.max(0, Math.min(last, chunk));
  if (!running) return [k];
  if (c.chunks <= 3) return [...Array(c.chunks).keys()];
  if (c.loop) return Array.from(new Set([Math.max(0, k - 1), k, Math.min(last, k + 1)]));
  return Array.from(new Set([k, Math.min(last, k + 1)]));
}

/**
 * UI-thread frame clock. The current frame is a shared value (no React render per frame); the sheet
 * window that is mounted follows React state, which changes every `per` frames. The worklet never
 * steps outside the mounted sheets: if JS is late mounting the next one, the pet holds its frame
 * (and catches up by time) instead of going blank.
 * `run` identifies one playback (clip + nonce): sheet state from a previous run is never reused.
 */
function useFrameClock(kit: ClipKit, name: string, run: string, running: boolean, onEnd?: () => void) {
  const c = kit.clips[name];
  const frame = useSharedValue(0);
  // in-between: the following frame and how far we are towards it (0..1), for cross-blending
  const next = useSharedValue(0);
  const blend = useSharedValue(0);
  // opacities for the two layers: the next frame comes in fully before the current one goes, so the
  // body never turns see-through (only the moving edges blend)
  const topA = useSharedValue(0);
  const baseA = useSharedValue(1);
  const t0 = useSharedValue(-1);
  const ended = useSharedValue(false);
  const lo = useSharedValue(0);
  const hi = useSharedValue(0);
  const runId = useSharedValue(0);
  const runRef = useRef(0);
  const [state, setState] = useState<{ run: string; k: number }>({ run, k: 0 });
  const chunk = state.run === run ? state.k : 0;
  const keep = sheetsToKeep(c, chunk, running);
  const keepLo = Math.min(...keep);
  const keepHi = Math.max(...keep);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  // an end from an earlier run (queued on the UI thread just before a restart) is ignored
  const fireEnd = useCallback((id: number) => {
    if (id === runRef.current) endRef.current?.();
  }, []);
  const n = c.frames;
  const fps = c.fps;
  const loop = c.loop;
  const pingpong = c.pingpong;
  const per = c.per;
  const tick = useCallback(
    (info: FrameInfo) => {
      'worklet';
      if (t0.value < 0) t0.value = info.timestamp;
      const p = ((info.timestamp - t0.value) / 1000) * fps;
      const raw = Math.floor(p);
      const frac = p - raw;
      const map = (j: number) => {
        if (!loop) return Math.min(j, n - 1);
        const period = pingpong ? Math.max(1, 2 * n - 2) : n;
        let m = j % period;
        if (pingpong && m >= n) m = period - m;
        return m;
      };
      if (!loop && raw >= n) {
        if (!ended.value && Math.floor((n - 1) / per) <= hi.value) {
          ended.value = true;
          frame.value = n - 1;
          blend.value = 0;
          topA.value = 0;
          baseA.value = 1;
          runOnJS(fireEnd)(runId.value);
        }
        return;
      }
      let i = map(raw);
      // stay inside the mounted sheets
      const k = Math.floor(i / per);
      let held = false;
      if (k > hi.value) {
        i = Math.min(n - 1, (hi.value + 1) * per - 1);
        held = true;
      } else if (k < lo.value) {
        i = lo.value * per;
        held = true;
      }
      let j = !loop && raw + 1 >= n ? i : map(raw + 1);
      const kj = Math.floor(j / per);
      if (held || kj > hi.value || kj < lo.value) j = i;
      if (i !== frame.value) frame.value = i;
      if (j !== next.value) next.value = j;
      const b = j === i ? 0 : frac;
      blend.value = b;
      topA.value = b < 0.5 ? b * 2 : 1;
      baseA.value = b < 0.5 ? 1 : 2 - b * 2;
    },
    [n, fps, loop, pingpong, per, frame, next, blend, topA, baseA, t0, ended, lo, hi, runId, fireEnd],
  );
  const cb = useFrameCallback(tick, false);
  // publish the mounted window to the worklet once React has committed it
  useEffect(() => {
    lo.value = keepLo;
    hi.value = keepHi;
  }, [keepLo, keepHi, lo, hi]);
  useEffect(() => {
    // every start or stop is a new run: restart from frame 0 (the worklet clamps to mounted sheets)
    runRef.current += 1;
    runId.value = runRef.current;
    if (running) {
      t0.value = -1;
      ended.value = false;
      setState({ run, k: 0 });
    }
    cb.setActive(running);
    return () => cb.setActive(false);
  }, [running, run, cb, t0, ended, runId]);
  useAnimatedReaction(
    () => Math.floor(frame.value / per),
    (k, prev) => {
      if (k !== prev) runOnJS(setState)({ run, k });
    },
    [per, run],
  );
  return { frame, next, blend, topA, baseA, keep };
}

type Geo = { w: number; h: number };

/**
 * All clips share the generated videos' framing, so they are placed with ONE transform from video
 * pixels to stage points: the sitting idle dog's head centre, paw line and height define it.
 * `s` converts sheet pixels (video pixels × sc) to stage points.
 */
function frameRect(kit: ClipKit, name: string, g: Geo) {
  const c = kit.clips[name];
  const A = c.anchor ?? kit.anchor;
  const k = (kit.petH * g.h) / A.height; // stage points per video pixel
  return {
    s: k / c.sc,
    left: g.w / 2 + (c.origin[0] - A.cx) * k,
    top: PAWS * g.h + (c.origin[1] - A.bottom) * k,
    width: c.fw * (k / c.sc),
    height: c.fh * (k / c.sc),
  };
}

/** One sheet image of a clip: shows its frame when the clock is inside this sheet, else hides. */
function SheetImage({ c, k, source, frame, s, onLoad, tint, mixv }: { c: ClipMeta; k: number; source: number; frame: SharedValue<number>; s: number; onLoad?: () => void; tint?: string; mixv?: SharedValue<number> }) {
  const inChunk = Math.min(c.per, c.frames - k * c.per);
  const rows = Math.ceil(inChunk / c.cols);
  const fw = c.fw * s;
  const fh = c.fh * s;
  const style = useAnimatedStyle(() => {
    const f = frame.value;
    const visible = Math.floor(f / c.per) === k;
    if (!visible) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const local = f % c.per;
    return { opacity: mixv ? mixv.value : 1, transform: [{ translateX: -(local % c.cols) * fw }, { translateY: -Math.floor(local / c.cols) * fh }] };
  });
  return (
    <Animated.Image
      source={source}
      fadeDuration={0}
      onLoad={onLoad}
      style={[{ position: 'absolute', width: c.cols * fw, height: rows * fh, left: -2, top: -2 }, tint ? { tintColor: tint } : null, style]}
    />
  );
}

/** One layer of a clip (sketch, coat or accessory): the sheets the clock has asked to keep. */
function SheetLayer({ kit, name, sheets, frame, keep, s, onLoaded, tint, smooth }: { kit: ClipKit; name: string; sheets: number[]; frame: SharedValue<number>; keep: number[]; s: number; onLoaded?: () => void; tint?: string; smooth?: Smooth }) {
  const c = kit.clips[name];
  return (
    <>
      {keep.map((k) =>
        sheets[k] != null ? <SheetImage key={k} c={c} k={k} source={sheets[k]} frame={frame} s={s} tint={tint} mixv={smooth?.baseA} onLoad={k === 0 ? onLoaded : undefined} /> : null,
      )}
      {/* low-fps clips: the following frame fades in over this one between ticks, so 12 fps moves like 60 */}
      {smooth
        ? keep.map((k) => (sheets[k] != null ? <SheetImage key={`n${k}`} c={c} k={k} source={sheets[k]} frame={smooth.next} s={s} tint={tint} mixv={smooth.topA} /> : null))
        : null}
    </>
  );
}

type Smooth = { next: SharedValue<number>; topA: SharedValue<number>; baseA: SharedValue<number> };
/** clips generated at a low frame rate get in-between blending; 24 fps loops are already smooth */
const BLEND_BELOW_FPS = 20;

/** Flat silhouette colour of the not-yet-coloured pet (Waterllama's light gray). */
export const SILHOUETTE = '#EEF0F3';

type StackBand = { color: string; from: number; to: number };

function ClipView({
  kit,
  name,
  frame,
  keep,
  palette,
  bandana,
  fill,
  stack,
  geo,
  onReady,
  smooth: smoothIn,
  dye,
}: {
  dye?: { body: string; patch: string } | null;
  kit: ClipKit;
  name: string;
  frame: SharedValue<number>;
  smooth?: Smooth;
  keep: number[];
  palette: string;
  bandana: string;
  fill: SharedValue<number>;
  stack?: StackBand[];
  geo: Geo;
  onReady?: () => void;
}) {
  const sheets = kit.img[name];
  const smooth = kit.clips[name].fps < BLEND_BELOW_FPS ? smoothIn : undefined;
  const r = useMemo(() => frameRect(kit, name, geo), [kit, name, geo]);
  const loaded = useRef(0);
  const silhouette = !!stack;
  const overlay = !silhouette && bandana !== kit.nativeAccessory;
  const need = overlay ? 2 : 1;
  const markLoaded = useCallback(() => {
    loaded.current += 1;
    if (loaded.current === need) onReady?.();
  }, [need, onReady]);
  // inset the window by 2px so rounding at small sizes never shows the neighbouring frame of the sheet
  const I = 2;
  const box = { position: 'absolute' as const, left: r.left + I, top: r.top + I, width: r.width - 2 * I, height: r.height - 2 * I, overflow: 'hidden' as const };
  const coat = sheets[palette] ?? sheets[kit.palettes[0]];
  const layers = dye ? kit.dye?.[name] : undefined;
  if (!silhouette && dye && layers) {
    // a dyed coat: flat coat + patch colours, the art's shading multiplied over them, then everything
    // that isn't fur (outlines, eyes, nose, collar, bowls) drawn as it is
    return (
      <View pointerEvents="none" style={box}>
        <SheetLayer kit={kit} name={name} sheets={layers.fur_body} frame={frame} keep={keep} s={r.s} smooth={smooth} tint={dye.body} />
        <SheetLayer kit={kit} name={name} sheets={layers.fur_patch} frame={frame} keep={keep} s={r.s} smooth={smooth} tint={dye.patch} />
        <View style={[StyleSheet.absoluteFill, styles.multiply]}>
          <SheetLayer kit={kit} name={name} sheets={layers.fur_shade} frame={frame} keep={keep} s={r.s} smooth={smooth} />
        </View>
        <SheetLayer kit={kit} name={name} sheets={layers.fur_feat} frame={frame} keep={keep} s={r.s} smooth={smooth} onLoaded={markLoaded} />
        {overlay ? <SheetLayer kit={kit} name={name} sheets={sheets[`${kit.overlayPrefix}${bandana}`]} frame={frame} keep={keep} s={r.s} smooth={smooth} onLoaded={markLoaded} /> : null}
      </View>
    );
  }
  if (!silhouette) {
    // character view: the pet in its real colours
    return (
      <View pointerEvents="none" style={box}>
        <SheetLayer kit={kit} name={name} sheets={coat} frame={frame} keep={keep} s={r.s} smooth={smooth} onLoaded={markLoaded} />
        {overlay ? <SheetLayer kit={kit} name={name} sheets={sheets[`${kit.overlayPrefix}${bandana}`]} frame={frame} keep={keep} s={r.s} smooth={smooth} onLoaded={markLoaded} /> : null}
      </View>
    );
  }
  // Waterllama view: a flat light silhouette, filled from the paws with flat colour bands
  const alpha = sheets[kit.palettes[0]];
  return (
    <>
      <View pointerEvents="none" style={box}>
        <SheetLayer kit={kit} name={name} sheets={alpha} frame={frame} keep={keep} s={r.s} smooth={smooth} tint={SILHOUETTE} onLoaded={markLoaded} />
      </View>
      {stack!.map((band, i) => (
        <BandWindow key={i} band={band} first={i === 0} fill={fill} geo={geo} petH={kit.petH}>
          <View pointerEvents="none" style={box}>
            <SheetLayer kit={kit} name={name} sheets={alpha} frame={frame} keep={keep} s={r.s} smooth={smooth} tint={band.color} />
          </View>
        </BandWindow>
      ))}
      {/* the art's own shading laid over the flat colours (luminosity blend): eyes, ears and fur lines stay
          readable on the gray and pick up each band's colour, like the llama's face showing through its fill */}
      <View pointerEvents="none" style={[box, styles.detail]}>
        <SheetLayer kit={kit} name={name} sheets={sheets.lum ?? coat} frame={frame} keep={keep} s={r.s} smooth={smooth} />
      </View>
    </>
  );
}

/**
 * One band of colour: a window over the stage between the band's bottom and top (as fractions of the
 * pet's height), cut at the current fill level so the band pours in as the level rises. The content
 * inside stays fixed in stage coordinates. 3× stage width so props beside the pet (bowls) are included.
 */
function BandWindow({ band, first, fill, geo, petH, children }: { band: StackBand; first: boolean; fill: SharedValue<number>; geo: Geo; petH: number; children: React.ReactNode }) {
  const h = geo.h;
  const FILL_TOP = PAWS - petH * 1.08;
  const from = band.from;
  const to = band.to;
  const win = useAnimatedStyle(() => {
    const f = Math.max(0, Math.min(1, fill.value));
    const y = (v: number) => (PAWS - (PAWS - FILL_TOP) * v) * h;
    const topF = Math.min(to, f);
    if (topF <= from) return { top: 0, height: 0 };
    // the first band also covers everything under the paw line; a full pet covers to the very top
    const bottom = first ? h : y(from);
    const top = topF >= 0.999 ? 0 : y(topF);
    return { top, height: Math.max(0, bottom - top) };
  });
  const inner = useAnimatedStyle(() => {
    const f = Math.max(0, Math.min(1, fill.value));
    const topF = Math.min(to, f);
    const top = topF >= 0.999 ? 0 : (PAWS - (PAWS - FILL_TOP) * topF) * h;
    return { transform: [{ translateY: -top }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.band, { left: -geo.w, width: geo.w * 3 }, win]}>
      <Animated.View style={[{ position: 'absolute', left: geo.w, top: 0, width: geo.w, height: h }, inner]}>{children}</Animated.View>
    </Animated.View>
  );
}

export function ClipStage({
  kit,
  appearance,
  size,
  progress = 1,
  interactive = false,
  onTap,
  stack,
  bursts,
  accessibilityLabel,
  clip,
  onClipEnd,
  active = true,
  reduceMotion = false,
  rest = false,
  ambient = false,
}: PetRigProps & { kit: ClipKit }) {
  const base = kit.base(rest);
  const geo = useMemo(() => ({ w: size, h: size * ASPECT }), [size]);
  const palette = kit.palettes.includes(appearance.paletteId) ? appearance.paletteId : kit.palettes[0];
  const dye = useMemo(() => kit.dyeOf?.(appearance.paletteId) ?? null, [kit, appearance.paletteId]);
  const bandana = kit.accessories.includes(appearance.accessoryId) ? appearance.accessoryId : kit.nativeAccessory;

  // ---- color-in
  const fill = useSharedValue(progress);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      fill.value = progress;
      return;
    }
    fill.value = withTiming(progress, { duration: 800, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [progress, fill]);

  // ---- action state (external request via `clip`, or a tap)
  const [action, setAction] = useState<{ name: string; nonce: number } | null>(null);
  const [actionReady, setActionReady] = useState(false);
  const mix = useSharedValue(0); // 0 = idle visible, 1 = action visible
  const current = useRef(0); // nonce of the action currently owned by the stage

  const start = useCallback(
    (requested: PetClipName, nonce: number) => {
      const name = kit.resolve(requested);
      if (!name) return;
      current.current = nonce;
      // a new action interrupts: show idle until the new clip's first sheets are decoded
      mix.value = 0;
      setActionReady(false);
      setAction({ name, nonce });
    },
    [mix, kit],
  );

  useEffect(() => {
    if (!clip || reduceMotion) return;
    if (kit.resolve(clip.name)) start(clip.name, clip.nonce);
    else onClipEnd?.(); // this pet has no video for it yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip, reduceMotion, start]);

  const clearAction = useCallback(
    (nonce: number) => {
      if (nonce !== current.current) return; // a newer action already took over
      setAction(null);
      setActionReady(false);
      onClipEnd?.();
    },
    [onClipEnd],
  );
  const finish = useCallback(() => {
    const nonce = current.current;
    mix.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(clearAction)(nonce);
    });
  }, [mix, clearAction]);

  // leaving the screen ends any action (it would otherwise restart from frame 0 on return)
  useEffect(() => {
    if (!active && action) {
      mix.value = 0;
      clearAction(current.current);
    }
  }, [active, action, mix, clearAction]);

  // once per action: a late second "ready" (fallback timer, then the real onLoad) must not cancel the
  // closing fade, or the action would freeze on its last frame
  const readyFor = useRef(-1);
  const onActionReady = useCallback(() => {
    if (readyFor.current === current.current) return;
    readyFor.current = current.current;
    setActionReady(true);
    mix.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  }, [mix]);

  // safety: if images never report onLoad (some platforms skip it for cached assets), start anyway
  useEffect(() => {
    if (!action || actionReady) return;
    const t = setTimeout(onActionReady, 350);
    return () => clearTimeout(t);
  }, [action, actionReady, onActionReady]);

  const idleRunning = active && !reduceMotion && !(action && actionReady);
  const idle = useFrameClock(kit, base, base, idleRunning);

  // ambient variety: now and then look around / wag (daytime, only while nothing else plays)
  useEffect(() => {
    if (!ambient || rest || !active || reduceMotion || action) return;
    const timer = setTimeout(() => start('idle2', Date.now()), 14_000 + Math.random() * 12_000);
    return () => clearTimeout(timer);
  }, [ambient, rest, active, reduceMotion, action, start]);
  const act = useFrameClock(kit, action ? action.name : base, action ? `${action.name}:${action.nonce}` : `none:${base}`, !!action && actionReady && active && !reduceMotion, finish);

  // the incoming pose arrives fully before the outgoing one leaves, so the pet never looks see-through
  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, Math.min(1, (mix.value - 0.5) * 2)) }));
  const actionStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, mix.value * 2) }));

  // ---- touch: a tap plays the happy clip (visual only, never logs care)
  const startRef = useRef({ x: 0, y: 0, t: 0 });
  const handlers = interactive
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          startRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY, t: Date.now() };
        },
        onResponderRelease: (e: GestureResponderEvent) => {
          const moved = Math.hypot(e.nativeEvent.locationX - startRef.current.x, e.nativeEvent.locationY - startRef.current.y);
          if (moved > 14 || Date.now() - startRef.current.t > 450) return;
          onTap?.();
          if (!action && !reduceMotion) start(rest ? 'hello' : 'celebrate', Date.now());
        },
      }
    : {};

  return (
    <View
      style={{ width: geo.w, height: geo.h }}
      accessible
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={interactive ? 'Tap to say hello. This does not log any care.' : undefined}
      {...handlers}
    >
      {stack ? null : <Shadow geo={geo} />}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, idleStyle]}>
        <ClipView kit={kit} key={base} name={base} frame={idle.frame} smooth={idle} keep={idle.keep} palette={palette} dye={dye} bandana={bandana} fill={fill} stack={stack} geo={geo} />
      </Animated.View>
      {action ? (
        <Animated.View key={action.nonce} pointerEvents="none" style={[StyleSheet.absoluteFill, actionStyle]}>
          <ClipView
            kit={kit}
            name={action.name}
            frame={act.frame}
            smooth={act}
            keep={act.keep}
            palette={palette}
            dye={dye}
            bandana={bandana}
            fill={fill}
            stack={stack}
            geo={geo}
            onReady={onActionReady}
          />
        </Animated.View>
      ) : null}
      {bursts && bursts.length > 0 ? <BurstLayer bursts={bursts} w={geo.w} h={geo.h} /> : null}
    </View>
  );
}

function Shadow({ geo }: { geo: Geo }) {
  return (
    <Svg width={geo.w} height={geo.h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Ellipse cx={geo.w / 2} cy={PAWS * geo.h} rx={geo.w * 0.3} ry={geo.h * 0.022} fill="#23304A" opacity={0.07} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  detail: { mixBlendMode: 'luminosity', opacity: 0.42 },
  multiply: { mixBlendMode: 'multiply' },
  band: { position: 'absolute', overflow: 'hidden' },
});
