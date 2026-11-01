import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeInUp, runOnJS, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CARE, CareType, careAllowedFor, clampAmount, isCareType } from '../../domain/care';
import { dayKeyOf, defaultOccurredAt, formatClock, formatDayTitle, isToday, parseDayKey } from '../../domain/time';
import { newId } from '../../domain/ids';
import { CareEvent, ValidationError, getEvent, logCare, updateEvent, voidEvent } from '../../data/repo';
import { useApp } from '../../state/AppState';
import { confirmOccurrence } from '../../features/careLink';
import { CareIcon } from '../../ui/CareIcon';
import { CircleButton, Icon, Pill, SoftPill, T } from '../../ui/primitives';
import { colors, font } from '../../ui/theme';
import { errorFeedback, tapFeedback } from '../../native/haptics';
import { motionReduced, springs } from '../../ui/motion';
import { t } from '../../i18n';

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
  const { pet, db, bump, signalLogged, markLogged, schedules } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const W = Math.min(width, 520);

  const type: CareType | null = params.type && isCareType(params.type) ? params.type : null;
  const [editing, setEditing] = useState<CareEvent | null>(null);
  const dayKey = editing ? dayKeyOf(new Date(editing.occurredAt)) : params.day ?? dayKeyOf(new Date());
  const tpl = type ? CARE[type] : null;
  const spec = tpl?.amount ?? null;

  const [amount, setAmount] = useState<number>(spec?.default ?? 0);
  const [occurredAt, setOccurredAt] = useState<number>(() => defaultOccurredAt(dayKey));
  const [timeLabel, setTimeLabel] = useState<string>(isToday(dayKey) ? t('Now') : t('Noon'));
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationId = useRef(newId());

  // Edit mode: load the record being corrected.
  useEffect(() => {
    if (!params.eventId) return;
    getEvent(db, params.eventId).then((e) => {
      if (!e || e.voidedAt) {
        router.back();
        return;
      }
      setEditing(e);
      if (e.amount != null) setAmount(e.amount);
      setOccurredAt(e.occurredAt);
      setTimeLabel(formatClock(e.occurredAt));
      if (e.note) {
        setNote(e.note);
        setShowNote(true);
      }
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
    if (!hasOrigin && !motionReduced()) fly.value = withSpring(1, { damping: 15, stiffness: 170, mass: 0.9 });
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
    fly.value = withSpring(1, { damping: 17, stiffness: 150, mass: 0.9 });
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
    fly.value = withTiming(0, { duration: 230, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(run)();
    });
  };
  const nudge = (dir: 1 | -1) => {
    if (!spec || !type) return;
    tapFeedback();
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
        await updateEvent(db, editing.id, { amount: spec ? amount : undefined, occurredAt, note: showNote ? note : null });
        bump();
        router.back();
        return;
      }
      // 1) persist in a transaction (idempotent on mutationId) …
      const saved = await logCare(db, {
        petId: pet.id,
        type,
        occurredAt,
        amount: spec ? amount : null,
        note: showNote ? note : null,
        mutationId: mutationId.current,
      });
      // 2) tick the matching scheduled occurrence (never blocks the save) …
      await confirmOccurrence(db, schedules, saved, params.occ && params.scheduleId ? { scheduleId: params.scheduleId, key: params.occ } : null).catch((e) =>
        console.warn('[pavurio] could not link log to schedule', e),
      );
      // 3) … only then refresh UI. Badges wait for the pet's reaction (markLogged), which starts once Home is back.
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
    await voidEvent(db, editing.id);
    bump();
    router.back();
  };

  const level = spec ? amount / (spec.presets[spec.presets.length - 1] * 1.25) : 0.7;
  const objSize = Math.min(W * 0.86, height * 0.4, 360);
  const minuteBased = spec?.unit === 'min';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.col, { width: W }]}>
          <View style={styles.topRow}>
            <View style={[styles.dayChip, { backgroundColor: tpl.tint }]}>
              <T weight="xbold" style={{ color: tpl.color, fontSize: 14 }}>
                {pet.name} · {formatDayTitle(dayKey)}
              </T>
            </View>
            <CircleButton icon="close" label={t('Close without saving')} onPress={() => !leaving && router.back()} />
          </View>

          <T style={styles.hint}>{editing ? t('Edit {label}', { label: tpl.label.toLowerCase() }) : tpl.hint}</T>

          <View style={[styles.objectWrap, { height: objSize + 10 }]}>
            <Animated.View ref={objRef} collapsable={false} onLayout={onObjLayout} style={[objStyle, !placed && { opacity: 0 }]}>
              <CareIcon type={type} size={objSize} level={level} ring={minuteBased} />
            </Animated.View>
            {spec ? (
              <Animated.View entering={motionReduced() ? undefined : FadeIn.delay(200).duration(220)} style={[styles.stepper, { backgroundColor: tpl.tint, top: objSize * 0.6 - 46, right: objSize * 0.02 }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={t('More, add {n} {unit}', { n: spec.step, unit: spec.unit })} onPress={() => nudge(1)} hitSlop={8} style={styles.stepHit} testID="amount-up">
                  <Icon name="up" size={26} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('Less, remove {n} {unit}', { n: spec.step, unit: spec.unit })} onPress={() => nudge(-1)} hitSlop={8} style={styles.stepHit} testID="amount-down">
                  <Icon name="down" size={26} />
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          <Animated.View entering={motionReduced() ? undefined : FadeInUp.delay(hasOrigin ? 120 : 60).duration(260).springify().damping(18)} style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          {spec ? (
            <>
              <T weight="black" style={styles.amount} accessibilityLiveRegion="polite" testID="amount">
                {amount}
                <T weight="black" style={styles.unit}>
                  {' '}
                  {spec.unit}
                </T>
              </T>
              <View style={styles.chips}>
                {spec.presets.map((p) => (
                  <Chip key={p} label={`${p}`} on={p === amount} color={tpl.color} tint={tpl.tint} onPress={() => setAmount(p)} />
                ))}
              </View>
            </>
          ) : (
            <T weight="black" style={[styles.amount, { fontSize: 34 }]}>
              {t('Litter box cleaned')}
            </T>
          )}

          <View style={[styles.chips, { marginTop: 14 }]}>
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
          <T style={styles.when}>{t('at {time}', { time: formatClock(occurredAt) })}</T>

          {showNote ? (
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
          ) : null}

          {error ? (
            <T style={styles.error} accessibilityLiveRegion="assertive">
              {error}
            </T>
          ) : null}

          <View style={styles.ctaRow}>
            <Pill
              label={editing ? t('SAVE CHANGES') : tpl.cta}
              color={tpl.color}
              onPress={save}
              loading={saving}
              style={{ flex: 1, maxWidth: 300 }}
              testID="save-care"
            />
            <CircleButton
              icon="more"
              label={showNote ? t('Hide note') : t('Add a note')}
              onPress={() => setShowNote((s) => !s)}
              size={56}
              style={{ backgroundColor: tpl.tint }}
            />
          </View>
          {editing ? (
            <SoftPill label={t('Delete this entry')} color={colors.danger} tint={colors.dangerSoft} onPress={remove} style={{ alignSelf: 'center', marginTop: 16 }} />
          ) : null}
          </Animated.View>
        </View>
      </ScrollView>
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
        tapFeedback();
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
  root: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: 'center' },
  col: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayChip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center' },
  hint: { fontSize: 17, color: colors.muted, marginTop: 18 },
  objectWrap: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  stepper: { position: 'absolute', borderWidth: 3, borderColor: '#FFFFFF', width: 64, height: 92, borderRadius: 32, alignItems: 'center', justifyContent: 'center', opacity: 0.96 },
  stepHit: { width: 64, height: 46, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: 56, lineHeight: 64, color: colors.ink, marginTop: 4 },
  unit: { fontSize: 30, color: colors.inkSoft, fontFamily: font.black },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  when: { color: colors.muted, marginTop: 8, fontSize: 14 },
  note: {
    alignSelf: 'stretch',
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.canvasWarm,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14,
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: 12, textAlign: 'center' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22, alignSelf: 'stretch', justifyContent: 'center' },
});
