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
 * - The colour-in edge is feathered and breathes slightly, like a water line, instead of a hard cut.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { FrameInfo } from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import { CareRug } from './CareRug';
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
  /** clip actually played for a request (null = nothing to play) */
  resolve: (name: PetClipName) => string | null;
  base: (rest: boolean) => string;
};

/** Stage proportions (relative to the stage width). */
const ASPECT = 1.05;
const PAWS = 0.9; // paw line, fraction of stage height

/**
 * UI-thread frame clock. Returns the current frame as a shared value (no React re-render per frame)
 * and the current sheet index as React state (changes every `per` frames, to mount sheets ahead).
 */
function useFrameClock(kit: ClipKit, name: string, running: boolean, onEnd?: () => void) {
  const c = kit.clips[name];
  const frame = useSharedValue(0);
  const t0 = useSharedValue(-1);
  const ended = useSharedValue(false);
  const [chunk, setChunk] = useState(0);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const fireEnd = useCallback(() => endRef.current?.(), []);
  const n = c.frames;
  const fps = c.fps;
  const loop = c.loop;
  const pingpong = c.pingpong;
  const tick = useCallback(
    (info: FrameInfo) => {
      'worklet';
      if (t0.value < 0) t0.value = info.timestamp;
      let i = Math.floor(((info.timestamp - t0.value) / 1000) * fps);
      if (loop) {
        const period = pingpong ? Math.max(1, 2 * n - 2) : n;
        i %= period;
        if (pingpong && i >= n) i = period - i;
      } else if (i >= n) {
        if (!ended.value) {
          ended.value = true;
          frame.value = n - 1;
          runOnJS(fireEnd)();
        }
        return;
      }
      if (i !== frame.value) frame.value = i;
    },
    [n, fps, loop, pingpong, frame, t0, ended, fireEnd],
  );
  const cb = useFrameCallback(tick, false);
  useEffect(() => {
    // a new clip (or a restart) begins at frame 0
    t0.value = -1;
    ended.value = false;
    frame.value = 0;
    setChunk(0);
  }, [name, frame, t0, ended]);
  useEffect(() => {
    if (running) {
      // (re)start from frame 0: a replayed action must be able to end again
      t0.value = -1;
      ended.value = false;
      frame.value = 0;
      setChunk(0);
    }
    cb.setActive(running);
    return () => cb.setActive(false);
  }, [running, cb, t0, ended, frame]);
  const per = c.per;
  useAnimatedReaction(
    () => Math.floor(frame.value / per),
    (k, prev) => {
      if (k !== prev) runOnJS(setChunk)(k);
    },
    [per],
  );
  return { frame, chunk };
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
function SheetImage({ c, k, source, frame, s, onLoad }: { c: ClipMeta; k: number; source: number; frame: SharedValue<number>; s: number; onLoad?: () => void }) {
  const inChunk = Math.min(c.per, c.frames - k * c.per);
  const rows = Math.ceil(inChunk / c.cols);
  const fw = c.fw * s;
  const fh = c.fh * s;
  const style = useAnimatedStyle(() => {
    const f = frame.value;
    const visible = Math.floor(f / c.per) === k;
    if (!visible) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const local = f % c.per;
    return { opacity: 1, transform: [{ translateX: -(local % c.cols) * fw }, { translateY: -Math.floor(local / c.cols) * fh }] };
  });
  return (
    <Animated.Image
      source={source}
      fadeDuration={0}
      onLoad={onLoad}
      style={[{ position: 'absolute', width: c.cols * fw, height: rows * fh, left: -2, top: -2 }, style]}
    />
  );
}

/** One layer of a clip (sketch, coat or accessory): the current sheet plus the ones needed next. */
function SheetLayer({
  kit,
  name,
  sheets,
  frame,
  chunk,
  s,
  onLoaded,
}: {
  kit: ClipKit;
  name: string;
  sheets: number[];
  frame: SharedValue<number>;
  chunk: number;
  s: number;
  onLoaded?: () => void;
}) {
  const c = kit.clips[name];
  // loops are short (≤3 sheets): keep them all; actions keep the current sheet and the next two
  const keep = c.loop || c.chunks <= 3 ? [...Array(c.chunks).keys()] : Array.from(new Set([chunk, Math.min(c.chunks - 1, chunk + 1), Math.min(c.chunks - 1, chunk + 2)]));
  return (
    <>
      {keep.map((k) => (
        <SheetImage key={k} c={c} k={k} source={sheets[k]} frame={frame} s={s} onLoad={k === 0 ? onLoaded : undefined} />
      ))}
    </>
  );
}

function ClipView({
  kit,
  name,
  frame,
  chunk,
  palette,
  bandana,
  fill,
  geo,
  onReady,
}: {
  kit: ClipKit;
  name: string;
  frame: SharedValue<number>;
  chunk: number;
  palette: string;
  bandana: string;
  fill: SharedValue<number>;
  geo: Geo;
  onReady?: () => void;
}) {
  const sheets = kit.img[name];
  const r = useMemo(() => frameRect(kit, name, geo), [kit, name, geo]);
  const loaded = useRef(0);
  const overlay = bandana !== kit.nativeAccessory;
  const need = overlay ? 3 : 2;
  const markLoaded = useCallback(() => {
    loaded.current += 1;
    if (loaded.current === need) onReady?.();
  }, [need, onReady]);
  // inset the window by 2px so rounding at small sizes never shows the neighbouring frame of the sheet
  const I = 2;
  const box = { position: 'absolute' as const, left: r.left + I, top: r.top + I, width: r.width - 2 * I, height: r.height - 2 * I, overflow: 'hidden' as const };
  return (
    <>
      <View pointerEvents="none" style={box}>
        <SheetLayer kit={kit} name={name} sheets={sheets.sketch} frame={frame} chunk={chunk} s={r.s} onLoaded={markLoaded} />
      </View>
      <FillClip fill={fill} geo={geo} petH={kit.petH}>
        {(main) => (
          <View style={{ position: 'absolute', left: geo.w, width: geo.w, bottom: 0, height: geo.h }}>
            <View pointerEvents="none" style={box}>
              <SheetLayer kit={kit} name={name} sheets={sheets[palette] ?? sheets[kit.palettes[0]]} frame={frame} chunk={chunk} s={r.s} onLoaded={main ? markLoaded : undefined} />
              {overlay ? <SheetLayer kit={kit} name={name} sheets={sheets[`${kit.overlayPrefix}${bandana}`]} frame={frame} chunk={chunk} s={r.s} onLoaded={main ? markLoaded : undefined} /> : null}
            </View>
          </View>
        )}
      </FillClip>
    </>
  );
}

/**
 * Bottom-anchored reveal window, 3× stage width so props beside the pet (bowls) are not cut off.
 * The edge is feathered: the coat is drawn again in two slightly taller, fainter windows, so the
 * line between sketch and colour reads as a soft water line. It breathes ±1.5 pt while partly filled.
 */
const FEATHER = 0.045; // of stage height
const FEATHER_STEPS = [
  { at: 1, opacity: 0.22 },
  { at: 0.5, opacity: 0.45 },
] as const;

function FillClip({ fill, geo, petH, children }: { fill: SharedValue<number>; geo: Geo; petH: number; children: (main: boolean) => React.ReactNode }) {
  const h = geo.h;
  const FILL_TOP = PAWS - petH * 1.08;
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(bob);
  }, [bob]);
  const reveal = (extra: number) => {
    'worklet';
    const f = Math.max(0, Math.min(1, fill.value));
    if (f >= 1) return 2 * h;
    const base = ((1 - PAWS) + (PAWS - FILL_TOP) * f) * h;
    if (f <= 0) return base; // nothing coloured above the paws yet: no feather, no motion
    const partial = Math.min(1, f * 12) * Math.min(1, (1 - f) * 12); // fade the edge effects in/out at 0 % and 100 %
    return base + (extra * FEATHER * h + (bob.value - 0.5) * 3) * partial;
  };
  const main = useAnimatedStyle(() => ({ height: reveal(0) }));
  const f1 = useAnimatedStyle(() => ({ height: reveal(FEATHER_STEPS[0].at), opacity: fill.value > 0 && fill.value < 1 ? FEATHER_STEPS[0].opacity : 0 }));
  const f2 = useAnimatedStyle(() => ({ height: reveal(FEATHER_STEPS[1].at), opacity: fill.value > 0 && fill.value < 1 ? FEATHER_STEPS[1].opacity : 0 }));
  const frame = { left: -geo.w, width: geo.w * 3 };
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.clip, frame, f1]}>
        {children(false)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.clip, frame, f2]}>
        {children(false)}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.clip, frame, main]}>
        {children(true)}
      </Animated.View>
    </>
  );
}

export function ClipStage({
  kit,
  appearance,
  size,
  progress = 1,
  interactive = false,
  onTap,
  rug,
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

  const onActionReady = useCallback(() => {
    setActionReady((was) => was || true);
    mix.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  }, [mix]);

  // safety: if images never report onLoad (some platforms skip it for cached assets), start anyway
  useEffect(() => {
    if (!action || actionReady) return;
    const t = setTimeout(onActionReady, 350);
    return () => clearTimeout(t);
  }, [action, actionReady, onActionReady]);

  const idleRunning = active && !reduceMotion && !(action && actionReady);
  const idle = useFrameClock(kit, base, idleRunning);

  // ambient variety: now and then look around / wag (daytime, only while nothing else plays)
  useEffect(() => {
    if (!ambient || rest || !active || reduceMotion || action) return;
    const timer = setTimeout(() => start('idle2', Date.now()), 14_000 + Math.random() * 12_000);
    return () => clearTimeout(timer);
  }, [ambient, rest, active, reduceMotion, action, start]);
  const act = useFrameClock(kit, action ? `${action.name}` : base, !!action && actionReady && active, finish);

  const idleStyle = useAnimatedStyle(() => ({ opacity: 1 - mix.value }));
  const actionStyle = useAnimatedStyle(() => ({ opacity: mix.value }));

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
      {rug ? (
        <CareRug bands={rug.bands} planned={rug.planned} w={geo.w} h={geo.h} cy={PAWS * geo.h - geo.h * 0.005} rx={geo.w * 0.44} ry={geo.h * 0.06} />
      ) : (
        <Shadow geo={geo} />
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, idleStyle]}>
        <ClipView kit={kit} key={base} name={base} frame={idle.frame} chunk={idle.chunk} palette={palette} bandana={bandana} fill={fill} geo={geo} />
      </Animated.View>
      {action ? (
        <Animated.View key={action.nonce} pointerEvents="none" style={[StyleSheet.absoluteFill, actionStyle]}>
          <ClipView
            kit={kit}
            name={action.name}
            frame={act.frame}
            chunk={act.chunk}
            palette={palette}
            bandana={bandana}
            fill={fill}
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
  clip: { position: 'absolute', bottom: 0, overflow: 'hidden' },
});
