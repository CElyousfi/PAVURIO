/**
 * The routine guide: one card per care with what's generally recommended for the pet's species and age,
 * and a button that turns it into a real routine (reminders at the suggested times + the daily plan).
 * The advice follows the life stage, so it changes by itself as the pet grows.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CARE } from '../domain/care';
import { AGE_PICKS, approxBirthDate } from '../domain/lifeStage';
import { guideFor, type Rec } from '../content/routineGuide';
import { createSchedule, updateSchedule } from '../data/careRepo';
import { setPlan, setSetting, updatePet } from '../data/repo';
import { requestPermission } from '../native/notifications';
import { useApp } from '../state/AppState';
import { ageLabel, guideStateOf, markGuideSeen, stageLabel } from '../features/RoutineGuide';
import { Sticker, careSticker, moodSticker } from '../ui/Sticker';
import { ART } from '../ui/art';
import { Bouncy, Float, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { formatHM, weekdayNamesShort } from '../i18n/dates';
import { selectFeedback, successFeedback, tapFeedback, completeFeedback } from '../native/haptics';
import { t, tn } from '../i18n';
import { Missing } from '../ui/Missing';

const PURPLE = '#7C5CE6';
const DOW = () => weekdayNamesShort();
const hm = (tm: string) => formatHM(Number(tm.slice(0, 2)), Number(tm.slice(3, 5)));

export default function Guide() {
  const { pet, db, bump, schedules, plan, portions } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const g = pet ? guideStateOf(pet, null) : null;
  const recs = pet && g?.known ? guideFor(pet.species, g.stage) : [];

  useEffect(() => {
    if (pet && g?.known) void markGuideSeen(db, pet).then(bump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.id, g?.stage, g?.known]);

  if (!pet || !g) return <Missing />;
  const pages = g.known ? recs.length + 2 : 1;
  const last = pages - 1;

  const go = (i: number) => {
    tapFeedback();
    pager.current?.scrollTo({ x: i * W, animated: !motionReduced() });
    setPage(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));

  const pickAge = async (months: number) => {
    selectFeedback();
    await updatePet(db, pet.id, { birthDate: approxBirthDate(months) });
    await setSetting(db, `birthApprox:${pet.id}`, '1');
    bump();
  };

  const existing = (r: Rec) => schedules.find((s) => s.type === r.care && s.enabled);
  const apply = async (r: Rec, quiet = false) => {
    if (r.kind === 'visit') return router.push('/appointment');
    const title = CARE[r.care].label;
    const input = {
      petId: pet.id,
      type: r.care,
      title,
      times: r.times,
      days: r.days ?? [],
      remind: true,
    };
    const ex = existing(r);
    if (ex)
      await updateSchedule(db, ex.id, {
        ...input,
        title: ex.title || title,
        startDate: ex.startDate,
        endDate: ex.endDate,
      });
    else await createSchedule(db, input);
    if (r.kind === 'daily') await setPlan(db, pet, { ...plan, [r.care]: r.times.length }, r.portion ? { ...portions, [r.care]: r.portion } : portions);
    setApplied((a) => ({ ...a, [r.care]: true }));
    if (!quiet) {
      successFeedback();
      requestPermission(db).catch(() => null);
      bump();
    }
  };
  const applyAll = async () => {
    // one routine at a time: the plan is written per care, each step builds on the last
    let p = { ...plan };
    let por = { ...portions };
    for (const r of recs) {
      if (r.kind === 'visit' || applied[r.care]) continue;
      const title = CARE[r.care].label;
      const input = {
        petId: pet.id,
        type: r.care,
        title,
        times: r.times,
        days: r.days ?? [],
        remind: true,
      };
      const ex = existing(r);
      if (ex)
        await updateSchedule(db, ex.id, {
          ...input,
          title: ex.title || title,
          startDate: ex.startDate,
          endDate: ex.endDate,
        });
      else await createSchedule(db, input);
      if (r.kind === 'daily') {
        p = { ...p, [r.care]: r.times.length };
        if (r.portion) por = { ...por, [r.care]: r.portion };
      }
    }
    await setPlan(db, pet, p, por);
    setApplied(Object.fromEntries(recs.map((r) => [r.care, true])));
    completeFeedback();
    requestPermission(db).catch(() => null);
    bump();
  };

  const tint = page === 0 || page === last || !g.known ? '#EEE8FE' : CARE[recs[page - 1].care].tint;
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: tint,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={{ width: W, alignSelf: 'center', flex: 1 }}>
        <View style={styles.top}>
          <Bouncy onPress={() => router.back()} style={styles.leave} accessibilityRole="button" accessibilityLabel={t('Close')} scaleTo={0.92}>
            <T weight="black" style={{ fontSize: 13, letterSpacing: 1.2, color: '#00000055' }}>
              {t('LEAVE')}
            </T>
          </Bouncy>
          {g.known ? (
            <Bouncy onPress={() => router.push({ pathname: '/pet', params: { id: pet.id } })} style={styles.leave} accessibilityRole="button" scaleTo={0.92}>
              <T weight="black" style={{ fontSize: 13, letterSpacing: 1.2, color: '#00000077' }}>
                {ageLabel(g.months).toUpperCase()}
              </T>
            </Bouncy>
          ) : null}
        </View>
        {g.known ? (
          <View style={styles.bars}>
            {Array.from({ length: pages }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    backgroundColor: i <= page ? colors.ink : '#FFFFFF99',
                    flex: i === page ? 1.6 : 1,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {!g.known ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 26,
              paddingBottom: 20,
            }}
          >
            <Animated.View entering={FadeIn}>
              <T weight="black" style={{ color: PURPLE, fontSize: 13, letterSpacing: 1.6 }}>
                {t('ROUTINE GUIDE')}
              </T>
              <T weight="black" style={styles.title}>
                {t('How old is {name}?', { name: pet.name })}
              </T>
              <T style={styles.body}>
                {t('Meals, walks and care change a lot as pets grow. Pick an age and we’ll show what’s generally recommended — it updates as {name} grows.', { name: pet.name })}
              </T>
            </Animated.View>
            <View style={{ gap: 10, marginTop: 22 }}>
              {AGE_PICKS[pet.species].map((a, i) => (
                <Animated.View key={a.stage} entering={motionReduced() ? undefined : FadeInDown.delay(80 + i * 60)}>
                  <Bouncy onPress={() => pickAge(a.months)} style={styles.ageRow} accessibilityRole="radio" testID={`guide-age-${a.stage}`}>
                    <T weight="black" style={{ fontSize: 16, flex: 1 }}>
                      {stageLabel(pet.species, a.stage)}
                    </T>
                    <Icon name="chevR" size={18} color={colors.faint} />
                  </Bouncy>
                </Animated.View>
              ))}
            </View>
            <Bouncy onPress={() => router.push({ pathname: '/pet', params: { id: pet.id } })} style={{ alignSelf: 'center', padding: 14, marginTop: 8 }} accessibilityRole="button">
              <T weight="black" style={{ color: PURPLE, fontSize: 15 }}>
                {t('I know the exact birthday')}
              </T>
            </Bouncy>
          </ScrollView>
        ) : (
          <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={32} style={{ flex: 1 }}>
            {/* intro */}
            <View style={{ width: W }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingHorizontal: 26,
                  paddingTop: 22,
                  paddingBottom: 20,
                }}
              >
                <T weight="black" style={{ color: PURPLE, fontSize: 13, letterSpacing: 1.6 }}>
                  {stageLabel(pet.species, g.stage).toUpperCase()}
                </T>
                <T weight="black" style={styles.title}>
                  {t('{name}’s routine guide', { name: pet.name })}
                </T>
                <T style={styles.body}>
                  {t('What vets generally recommend at {name}’s age, care by care. Set any of it up as a routine in one tap — you can change it anytime in Care.', { name: pet.name })}
                </T>
                <View style={{ gap: 8, marginTop: 20 }}>
                  {recs.map((r) => (
                    <Bouncy key={r.care} onPress={() => go(recs.indexOf(r) + 1)} style={styles.summaryRow} accessibilityRole="button">
                      <View style={[styles.swatch, { backgroundColor: CARE[r.care].color }]} />
                      <View style={{ flex: 1 }}>
                        <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
                          {CARE[r.care].label}
                        </T>
                        <T weight="black" style={{ fontSize: 15 }} numberOfLines={2}>
                          {t(r.headline)}
                        </T>
                      </View>
                      {applied[r.care] ? <Icon name="check" size={18} color={colors.brand} /> : <Icon name="chevR" size={18} color={colors.faint} />}
                    </Bouncy>
                  ))}
                </View>
                <T style={styles.note}>{t('General guidance for healthy pets. Breed, size and health matter: your vet knows {name} best.', { name: pet.name })}</T>
              </ScrollView>
            </View>

            {recs.map((r) => {
              const meta = CARE[r.care];
              const ex = existing(r);
              const done = applied[r.care];
              return (
                <View key={r.care} style={{ width: W }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      paddingHorizontal: 24,
                      paddingTop: 18,
                      paddingBottom: 20,
                    }}
                  >
                    <T
                      weight="black"
                      style={{
                        color: meta.color,
                        fontSize: 13,
                        letterSpacing: 1.6,
                      }}
                    >
                      {meta.label.toUpperCase()}
                    </T>
                    <T weight="black" style={styles.title}>
                      {t(r.headline)}
                    </T>
                    <T style={styles.body}>{t(r.why)}</T>
                    <Float style={{ alignItems: 'center', marginVertical: 10 }} amount={5}>
                      {r.care === 'litter' && ART.care.litter ? <Image source={ART.care.litter} style={{ width: 150, height: 150 }} resizeMode="contain" /> : <Sticker name={careSticker(r.care, pet.species)} size={140} />}
                    </Float>
                    {r.kind !== 'visit' ? (
                      <View style={styles.timeRow}>
                        {r.kind === 'weekly' && r.days ? (
                          <View style={styles.chip}>
                            <T weight="black" style={{ fontSize: 13 }}>
                              {r.days.map((d) => DOW()[d]).join(' · ')}
                            </T>
                          </View>
                        ) : null}
                        {r.times.map((tm) => (
                          <View key={tm} style={styles.chip}>
                            <T weight="black" style={{ fontSize: 13 }}>
                              {hm(tm)}
                            </T>
                          </View>
                        ))}
                        {r.portion ? (
                          <View style={styles.chip}>
                            <T weight="black" style={{ fontSize: 13 }}>
                              {tn(r.portion, '{n} min', '{n} min')}
                            </T>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={{ gap: 10, marginTop: 12 }}>
                      {r.points.map((p) => (
                        <View key={p.title} style={styles.point}>
                          <T weight="black" style={{ fontSize: 15 }}>
                            {t(p.title)}
                          </T>
                          <T
                            style={{
                              color: colors.inkSoft,
                              fontSize: 14,
                              lineHeight: 20,
                              marginTop: 3,
                            }}
                          >
                            {t(p.body)}
                          </T>
                        </View>
                      ))}
                    </View>
                    <Bouncy
                      onPress={() => (done ? undefined : apply(r))}
                      style={[styles.setup, { backgroundColor: done ? colors.card : meta.color }]}
                      accessibilityRole="button"
                      testID={`guide-apply-${r.care}`}
                    >
                      <T
                        weight="black"
                        style={{
                          color: done ? colors.ink : '#FFFFFF',
                          fontSize: 15,
                          letterSpacing: 0.8,
                        }}
                      >
                        {done ? t('ROUTINE SET ✓') : r.kind === 'visit' ? t('ADD A VET VISIT') : ex ? t('UPDATE MY ROUTINE') : t('SET UP THIS ROUTINE')}
                      </T>
                    </Bouncy>
                    {ex && !done && r.kind !== 'visit' ? (
                      <T
                        style={{
                          color: colors.muted,
                          fontSize: 12,
                          textAlign: 'center',
                          marginTop: 6,
                        }}
                      >
                        {t('Replaces the times of your current routine.')}
                      </T>
                    ) : null}
                  </ScrollView>
                </View>
              );
            })}

            {/* the end: everything in one tap */}
            <View
              style={{
                width: W,
                paddingHorizontal: 26,
                paddingTop: 30,
                alignItems: 'center',
              }}
            >
              <Sticker name={moodSticker(pet.species, 'party')} size={170} />
              <T weight="black" style={[styles.title, { textAlign: 'center' }]}>
                {t('That’s {name}’s day', { name: pet.name })}
              </T>
              <T style={[styles.body, { textAlign: 'center' }]}>
                {t('Set up every routine at once, with reminders at the suggested times. We’ll bring new advice when {name} reaches the next stage.', { name: pet.name })}
              </T>
            </View>
          </ScrollView>
        )}

        {g.known ? (
          <View
            style={{
              paddingHorizontal: 22,
              gap: 6,
              alignItems: 'center',
              paddingTop: 8,
            }}
          >
            {page === last ? (
              <>
                <Bouncy onPress={applyAll} style={[styles.cta, { backgroundColor: PURPLE }]} accessibilityRole="button" testID="guide-apply-all">
                  <T weight="black" style={{ color: '#FFFFFF', fontSize: 17, letterSpacing: 1 }}>
                    {recs.every((r) => r.kind === 'visit' || applied[r.care]) ? t('ALL SET ✓') : t('SET UP EVERYTHING')}
                  </T>
                </Bouncy>
                <Bouncy onPress={() => router.back()} style={{ height: 40, justifyContent: 'center' }} accessibilityRole="button">
                  <T
                    weight="black"
                    style={{
                      color: colors.ink,
                      fontSize: 14,
                      letterSpacing: 1,
                    }}
                  >
                    {t('DONE')}
                  </T>
                </Bouncy>
              </>
            ) : (
              <Bouncy onPress={() => go(page + 1)} style={[styles.cta, { backgroundColor: colors.ink }]} accessibilityRole="button" testID="guide-next">
                <T weight="black" style={{ color: '#FFFFFF', fontSize: 18, letterSpacing: 1 }}>
                  {t('NEXT')}
                </T>
              </Bouncy>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  leave: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFFAA',
    justifyContent: 'center',
  },
  bars: { flexDirection: 'row', gap: 6, paddingHorizontal: 26, marginTop: 16 },
  bar: { height: 6, borderRadius: 3 },
  title: { fontSize: 30, lineHeight: 36, marginTop: 6, color: colors.ink },
  body: { fontSize: 16, color: colors.inkSoft, marginTop: 10, lineHeight: 24 },
  note: { fontSize: 12, color: colors.muted, marginTop: 18, lineHeight: 17 },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFFCC',
    borderRadius: 20,
    padding: 12,
  },
  swatch: { width: 10, height: 34, borderRadius: 5 },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  point: { backgroundColor: '#FFFFFFCC', borderRadius: 20, padding: 14 },
  setup: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  cta: {
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 260,
    paddingHorizontal: 34,
  },
});
