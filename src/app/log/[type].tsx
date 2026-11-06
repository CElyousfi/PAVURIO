import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeInUp, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CARE, CareType, careAllowedFor, clampAmount, isCareType, unitLabel } from '../../domain/care';
import { dailyGoal, givenToday, portionOf } from '../../domain/progress';
import { dayKeyOf, defaultOccurredAt, formatClock, formatDayTitle, isToday, parseDayKey } from '../../domain/time';
import { newId } from '../../domain/ids';
import { CareEvent, ValidationError, getEvent, logCare, updateEvent } from '../../data/repo';
import { removeCareEvent, walkIdFromEvent } from '../../data/walkRepo';
import { useApp, useDay } from '../../state/AppState';
import { confirmOccurrence } from '../../features/careLink';
import { Vessel } from '../../ui/Vessel';
import { RollingNumber } from '../../ui/Rolling';
import { ProductPicker } from '../../features/supplies';
import { Sheet } from '../../ui/forms';
import { confirmAsync } from '../../ui/confirm';
import { CircleButton, Pill, SoftPill, T } from '../../ui/primitives';
import { colors, font } from '../../ui/theme';
import { errorFeedback, logFeedback, selectFeedback, tickFeedback } from '../../native/haptics';
import { motionReduced, springs } from '../../ui/motion';
import { t, tn } from '../../i18n';

type TimeOption = { label: string; at: number };

function timeOptions(dayKey: string, now: Date): TimeOption[] {
  if (isToday(dayKey, now)) {
    const ms = now.getTime();
    return [
      { label: t('Now'), at: ms },
      { label: t('15 min ago'), at: ms - 15 * 60_000 },
      { label: t('30 min ago'), at: ms - 30 * 60_000 },
      { label: t('1 h ago'), at: ms - 60 * 60_000 },
      { label: t('2 h ago'), at: ms - 120 * 60_000 },
    ].filter((o) => dayKeyOf(new Date(o.at)) === dayKey);
  }
  const d = parseDayKey(dayKey);
  const at = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0).getTime();
  return [
    { label: t('Morning'), at: at(8) },
    { label: t('Noon'), at: at(12) },
    { label: t('Afternoon'), at: at(16) },
    { label: t('Evening'), at: at(19) },
    { label: t('Night'), at: at(22) },
  ];
}

export default function LogCard() {
  const params = useLocalSearchParams<{ type: string; day?: string; eventId?: string; scheduleId?: string; occ?: string; ox?: string; oy?: string; os?: string }>();
  const { pet, db, bump, signalLogged, markLogged, schedules, plan, portions } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);

  const type: CareType | null = params.type && isCareType(params.type) ? params.type : null;
  const [editing, setEditing] = useState<CareEvent | null>(null);
  const dayKey = editing ? dayKeyOf(new Date(editing.occurredAt)) : params.day ?? dayKeyOf(new Date());
  const tpl = type ? CARE[type] : null;
  const spec = tpl?.amount ?? null;

  // starts at the owner's usual portion (set with the plan), not a generic default
  const [amount, setAmount] = useState<number>(type && spec ? portionOf(type, portions) : 0);
  const { events: dayEvents } = useDay(dayKey);
  const [occurredAt, setOccurredAt] = useState<number>(() => defaultOccurredAt(dayKey));
  const [timeLabel, setTimeLabel] = useState<string>(isToday(dayKey) ? t('Now') : t('Noon'));
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationId = useRef(newId());
  const confirmedTwice = useRef(false);
  // which product this meal / dose comes out of (the pet's usual one unless changed)
  const [supplyId, setSupplyId] = useState<string | null>(null);

  // Edit mode: load the record being corrected.
  useEffect(() => {
    if (!params.eventId) return;
    getEvent(db, params.eventId).then((e) => {
      if (!e || e.voidedAt) {
        router.back();
        return;
      }
      // a timed walk is edited as its adventure (duration, note, photo stay in step everywhere)
      const walkId = walkIdFromEvent(e);
      if (walkId) {
        router.replace({ pathname: '/adventure', params: { id: walkId } });
        return;
      }
      setEditing(e);
      if (e.amount != null) setAmount(e.amount);
      if (e.supplyId) setSupplyId(e.supplyId);
      setOccurredAt(e.occurredAt);
      setTimeLabel(formatClock(e.occurredAt));
      if (e.note) setNote(e.note);
    });
  }, [db, params.eventId]);

  const pop = useSharedValue(1);

  // ---- the object grows out of the icon that was tapped on Home, and shrinks back into it on save
  const origin = params.ox && params.oy && params.os ? { x: Number(params.ox), y: Number(params.oy), s: Number(params.os) } : null;
  const hasOrigin = !!origin && !motionReduced();
  const fly = useSharedValue(motionReduced() ? 1 : 0); // 0 = at the icon (or small), 1 = in place
  const from = useSharedValue({ dx: 0, dy: 0, scale: 0.82 });
  const [placed, setPlaced] = useState(!hasOrigin);
  // no origin (opened from the timeline or a notification): a soft pop instead of a flight
  useEffect(() => {
    if (!hasOrigin && !motionReduced()) fly.value = withTiming(1, { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [hasOrigin, fly]);
  const objRef = useRef<React.ComponentRef<typeof View>>(null);
  const measured = useRef(false);
  const gone = useRef(false);
  useEffect(
    () => () => {
      gone.current = true;
    },
    [],
  );
  /** show the object: from the measured origin when we have it, otherwise a soft pop in place */
  const place = () => {
    if (measured.current) return;
    measured.current = true;
    setPlaced(true);
    fly.value = withTiming(1, { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) });
  };
  const onObjLayout = () => {
    if (!hasOrigin || measured.current) return;
    const node = objRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return place();
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (measured.current) return;
      from.value = { dx: origin!.x - (x + w / 2), dy: origin!.y - (y + h / 2), scale: origin!.s / Math.max(1, w) };
      place();
    });
    setTimeout(place, 120); // measurement never answered: never leave the object invisible
  };
  const objStyle = useAnimatedStyle(() => {
    const p = fly.value;
    const f = from.value;
    return {
      opacity: Math.min(1, p * 2.5),
      transform: [{ translateX: f.dx * (1 - p) }, { translateY: f.dy * (1 - p) }, { scale: (f.scale + (1 - f.scale) * p) * pop.value }],
    };
  });
  /** shrink back into the Home icon, then leave (once; never after the screen was dismissed some other way) */
  const [leaving, setLeaving] = useState(false);
  const leave = (then: () => void) => {
    if (!hasOrigin || !measured.current || motionReduced()) return then();
    setLeaving(true);
    const run = () => {
      if (!gone.current) then();
    };
    // a small dip first (anticipation), then the object drops back into the icon
    pop.value = withTiming(0.95, { duration: 70, easing: Easing.out(Easing.quad) });
    fly.value = withDelay(70, withTiming(0, { duration: 210, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(run)();
    }));
  };
  const nudge = (dir: 1 | -1) => {
    if (!spec || !type) return;
    tickFeedback();
    setAmount((a) => clampAmount(type, a + dir * spec.step));
    pop.value = withSequence(withTiming(dir > 0 ? 1.06 : 0.95, { duration: 80 }), withSpring(1, springs.pop));
  };

  const options = useMemo(() => timeOptions(dayKey, new Date()), [dayKey]);

  if (!pet || !type || !tpl || !careAllowedFor(pet.species, type)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, alignItems: 'center' }]}>
        <T weight="black" style={{ fontSize: 22 }}>
          {t("This care type isn't available.")}
        </T>
        <Pill label={t('BACK')} onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateEvent(db, editing.id, { amount: spec ? amount : undefined, occurredAt, note: note.trim() ? note : null, ...(supplyId ? { supplyId } : {}) });
        bump();
        router.back();
        return;
      }
      // an accidental second log (a double tap, two people feeding the same pet): ask first
      const recent = dayEvents.find((e) => e.type === type && Math.abs(e.recordedAt - Date.now()) < 3 * 60_000);
      if (recent && !confirmedTwice.current) {
        const mins = Math.max(1, Math.round((Date.now() - recent.recordedAt) / 60_000));
        const ok = await confirmAsync(
          t('Log {label} again?', { label: tpl.label.toLowerCase() }),
          tn(mins, '{name} already has one logged a minute ago.', '{name} already has one logged {n} minutes ago.', { name: pet.name }),
          t('Log again'),
          'confirm',
        );
        if (!ok) {
          setSaving(false);
          return;
        }
        confirmedTwice.current = true;
      }
      // 1) persist in a transaction (idempotent on mutationId) …
      const saved = await logCare(db, {
        petId: pet.id,
        type,
        occurredAt,
        amount: spec ? amount : null,
        note: note.trim() ? note : null,
        mutationId: mutationId.current,
        supplyId: type === 'meal' || type === 'medication' ? supplyId : null,
      });
      // 2) tick the matching scheduled occurrence (never blocks the save) …
      await confirmOccurrence(db, schedules, saved, params.occ && params.scheduleId ? { scheduleId: params.scheduleId, key: params.occ } : null).catch((e) =>
        console.warn('[pavurio] could not link log to schedule', e),
      );
      // 3) … only then refresh UI. Badges wait for the pet's reaction (markLogged), which starts once Home is back.
      logFeedback();
      markLogged();
      bump();
      signalLogged({ eventId: saved.id, type });
      leave(() => {
        if (router.canGoBack()) router.back();
      });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save. Your entry was not recorded — please try again.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setShowNote(false);
    await removeCareEvent(db, editing.id);
    bump();
    // let the sheet's Modal close before leaving the screen
    setTimeout(() => router.back(), 220);
  };

  // picture level: what's already been given today plus this amount, against the owner's own daily goal
  // (times a day × their portion, from the plan) — never a generic scale
  const others = type ? dayEvents.filter((e) => e.type === type && e.id !== editing?.id) : [];
  const goal = type ? (spec ? dailyGoal(type, plan, portions) : Math.max(1, plan[type] ?? 0)) : 1;
  const before = type ? givenToday(type, others, portions) : 0;
  const after = before + (spec ? amount : 1);
  const level = Math.max(0, Math.min(1, after / goal));
  const objSize = Math.min(W * 0.9, height * 0.46, 400);
  const steps = spec && type ? [...new Set([...spec.presets, portionOf(type, portions)])].sort((a, b) => a - b) : [];
  const prevPreset = spec ? [...steps].reverse().find((p) => p < amount) : undefined;
  const nextPreset = spec ? steps.find((p) => p > amount) : undefined;
  const u = (n: number) => (spec ? (spec.unit === 'min' ? ' min' : spec.unit === 'dose' ? ` ${unitLabel('dose', n)}` : spec.unit) : '');
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  const showDay = !!editing || !isToday(dayKey);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <View style={[styles.col, { width: W, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.topRow}>
          {showDay ? (
            <View style={[styles.dayChip, { backgroundColor: tpl.tint }]}>
              <T weight="xbold" style={{ color: tpl.color, fontSize: 14 }}>
                {editing ? t('Edit {label}', { label: tpl.label.toLowerCase() }) : `${pet.name} · ${formatDayTitle(dayKey)}`}
              </T>
            </View>
          ) : (
            <View />
          )}
          <CircleButton icon="close" label={t('Close without saving')} onPress={() => !leaving && router.back()} />
        </View>

        <View style={styles.objectWrap}>
          <Animated.View ref={objRef} collapsable={false} onLayout={onObjLayout} style={[objStyle, !placed && { opacity: 0 }]} accessibilityLabel={tpl.hint}>
            <Vessel type={type} color={tpl.color} level={level} size={objSize} onStep={spec ? nudge : undefined} />
          </Animated.View>
        </View>

        <Animated.View entering={motionReduced() ? undefined : FadeInUp.delay(hasOrigin ? 120 : 60).duration(260).springify().damping(18)} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          {spec ? (
            <View style={styles.amountRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={prevPreset != null ? `${fmt(prevPreset)}${u(prevPreset)}` : ''} disabled={prevPreset == null} onPress={() => prevPreset != null && setAmount(prevPreset)} style={styles.side}>
                <T weight="black" style={styles.sideText} numberOfLines={1}>
                  {prevPreset != null ? `${fmt(prevPreset)}${u(prevPreset)}` : ''}
                </T>
              </Pressable>
              {/* the amount rolls like an odometer as it changes (Clucky's steppers) */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${fmt(amount)}${u(amount)}`} testID="amount">
                <RollingNumber value={fmt(amount)} size={52} lineHeight={60} />
                <T weight="black" style={[styles.unit, { lineHeight: 60 }]}>
                  {u(amount)}
                </T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={nextPreset != null ? `${fmt(nextPreset)}${u(nextPreset)}` : ''} disabled={nextPreset == null} onPress={() => nextPreset != null && setAmount(nextPreset)} style={styles.side}>
                <T weight="black" style={styles.sideText} numberOfLines={1}>
                  {nextPreset != null ? `${fmt(nextPreset)}${u(nextPreset)}` : ''}
                </T>
              </Pressable>
            </View>
          ) : (
            <T weight="black" style={[styles.amount, { fontSize: 30, lineHeight: 38 }]}>
              {t('Litter box cleaned')}
            </T>
          )}
          <T style={styles.when}>{timeLabel === t('Now') ? formatClock(occurredAt) : `${timeLabel} · ${formatClock(occurredAt)}`}</T>
          <View style={[styles.goalChip, { backgroundColor: tpl.tint }]} testID="goal">
            <T weight="xbold" style={{ color: tpl.color, fontSize: 13 }}>
              {spec
                ? t('{given} of {goal} today', { given: `${fmt(after)}${u(after)}`.trim(), goal: `${fmt(goal)}${u(goal)}`.trim() })
                : t('{given} of {goal} today', { given: String(after), goal: String(goal) })}
            </T>
          </View>

          {type === 'meal' || type === 'medication' ? <ProductPicker type={type} amount={editing ? 0 : spec ? amount : 1} value={supplyId} onChange={setSupplyId} /> : null}
          {error ? (
            <T style={styles.error} accessibilityLiveRegion="assertive">
              {error}
            </T>
          ) : null}

          <View style={styles.ctaRow}>
            <Pill label={editing ? t('SAVE CHANGES') : tpl.cta} color={tpl.color} onPress={save} loading={saving} style={{ minWidth: 210 }} testID="save-care" />
            <CircleButton icon="more" label={t('Time and note')} onPress={() => setShowNote(true)} size={52} style={{ backgroundColor: tpl.tint, shadowOpacity: 0, elevation: 0 }} testID="log-more" />
          </View>
        </Animated.View>
      </View>

      <Sheet visible={showNote} onClose={() => setShowNote(false)} title={t('When and notes')}>
        <View style={[styles.chips, { marginTop: 4 }]}>
          {options.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              on={timeLabel === o.label}
              color={colors.ink}
              tint={colors.line}
              onPress={() => {
                setOccurredAt(o.at);
                setTimeLabel(o.label);
              }}
            />
          ))}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('Add a note (optional)')}
          placeholderTextColor={colors.faint}
          style={styles.note}
          maxLength={500}
          multiline
          accessibilityLabel={t('Note')}
        />
        <Pill label={t('Done')} onPress={() => setShowNote(false)} color={tpl.color} style={{ marginTop: 16 }} />
        {editing ? <SoftPill label={t('Delete this entry')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} style={{ alignSelf: 'center', marginTop: 12 }} /> : null}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, on, color, tint, onPress }: { label: string; on: boolean; color: string; tint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        selectFeedback();
        onPress();
      }}
      style={[styles.chip, { backgroundColor: on ? color : tint }]}
    >
      <T weight="xbold" style={{ color: on ? '#FFFFFF' : color === colors.ink ? colors.inkSoft : color, fontSize: 15 }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center' },
  col: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  dayChip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center' },
  objectWrap: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  side: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  sideText: { fontSize: 22, color: colors.line },
  amount: { fontSize: 52, lineHeight: 60, color: colors.ink },
  unit: { fontSize: 52, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  when: { color: colors.faint, marginTop: 2, fontSize: 14 },
  goalChip: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  note: {
    alignSelf: 'stretch',
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 14,
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, justifyContent: 'center' },
});
