/**
 * The routine guide: one card per care with what's generally recommended for the pet's species and age,
 * and a button that turns it into a real routine (reminders at the suggested times + the daily plan).
 * The advice follows the life stage, so it changes by itself as the pet grows.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARE, formatAmount } from '../domain/care';
import { Target, portionFor, recommendedChoice, targetsFor } from '../domain/carePlan';
import { applyChoices } from '../data/autoPlan';
import { choiceSummary, targetHeadline, usePlanBasis } from '../features/AutoPlan';
import { requestPermission } from '../native/notifications';
import { useApp } from '../state/AppState';
import { ageLabel, guideStateOf, markGuideSeen, stageLabel } from '../features/RoutineGuide';
import { Sticker, careSticker, moodSticker } from '../ui/Sticker';
import { ART } from '../ui/art';
import { Bouncy, Float, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { formatHM, weekdayNamesShort } from '../i18n/dates';
import { successFeedback, tapFeedback, completeFeedback } from '../native/haptics';
import { t } from '../i18n';
import { Missing } from '../ui/Missing';
import { track } from '../native/analytics';

const PURPLE = '#7C5CE6';
const DOW = () => weekdayNamesShort();
const hm = (tm: string) => formatHM(Number(tm.slice(0, 2)), Number(tm.slice(3, 5)));

export default function Guide() {
  const { pet, db, bump, schedules, portions } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const g = pet ? guideStateOf(pet, null) : null;
  const basis = usePlanBasis();
  const recs: Target[] = basis ? targetsFor(basis) : [];

  // no age yet: the plan screen asks for it (with size and food) and builds everything
  useEffect(() => {
    if (pet && g && !g.known) router.replace('/plan');
  }, [pet, g]);

  useEffect(() => {
    if (pet && g?.known) track('guide_opened', { stage: g.stage });
    if (pet && g?.known) void markGuideSeen(db, pet).then(bump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.id, g?.stage, g?.known]);

  if (!pet || !g) return <Missing />;
  if (!g.known || !basis) return <View style={[styles.root, { backgroundColor: '#EEE8FE' }]} />;
  const pages = recs.length + 2;
  const last = pages - 1;

  const go = (i: number) => {
    tapFeedback();
    pager.current?.scrollTo({ x: i * W, animated: !motionReduced() });
    setPage(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / W));

  const existing = (r: Target) => schedules.find((s) => s.type === r.care && s.enabled && (r.kind === 'interval' ? !!s.everyDays : !s.everyDays));
  const apply = async (r: Target) => {
    if (r.kind === 'visit') return router.push('/appointment');
    const c = recommendedChoice(r);
    if (!c) return;
    await applyChoices(db, pet, basis, [c]);
    setApplied((a) => ({ ...a, [r.care]: true }));
    track('routine_applied', { care: r.care, all: false });
    successFeedback();
    if (c.remind) requestPermission(db).catch(() => null);
    bump();
  };
  const applyAll = async () => {
    const all = recs
      .filter((r) => !applied[r.care])
      .map(recommendedChoice)
      .filter((c): c is NonNullable<typeof c> => !!c);
    await applyChoices(db, pet, basis, all);
    setApplied(Object.fromEntries(recs.map((r) => [r.care, true])));
    track('routine_applied', { care: 'all', all: true });
    completeFeedback();
    requestPermission(db).catch(() => null);
    bump();
  };

  const tint = page === 0 || page === last ? '#EEE8FE' : CARE[recs[page - 1].care].tint;
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
          <Bouncy onPress={() => router.push('/plan')} style={styles.leave} accessibilityRole="button" scaleTo={0.92}>
            <T weight="black" style={{ fontSize: 13, letterSpacing: 1.2, color: '#00000077' }}>
              {ageLabel(g.months).toUpperCase()}
            </T>
          </Bouncy>
        </View>
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
                        {targetHeadline(r)}
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
            // already set up exactly as recommended: nothing to do
            const rc = recommendedChoice(r);
            const same = !!ex && !!rc && ex.times.join() === rc.times.join() && ex.days.join() === rc.days.join() && (rc.portion == null || portions[r.care] === rc.portion);
            const done = applied[r.care] || same;
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
                    {targetHeadline(r)}
                  </T>
                  <T style={styles.body}>{t(r.guide.why)}</T>
                  <Float style={{ alignItems: 'center', marginVertical: 10 }} amount={5}>
                    {r.care === 'litter' && ART.care.litter ? (
                      <Image source={ART.care.litter} style={{ width: 150, height: 150 }} resizeMode="contain" />
                    ) : (
                      <Sticker name={careSticker(r.care, pet.species)} size={140} />
                    )}
                  </Float>
                  {r.kind !== 'visit' ? <PlanBox r={r} /> : null}
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
                    </View>
                  ) : null}
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {r.guide.points.map((p) => (
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
                  <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    <Bouncy onPress={() => router.push('/plan')} style={{ padding: 10 }} accessibilityRole="button" testID={`guide-adjust-${r.care}`}>
                      <T weight="black" style={{ color: meta.color, fontSize: 14 }}>
                        {t('Adjust in {name}’s plan', { name: pet.name })}
                      </T>
                    </Bouncy>
                    {r.care === 'medication' ? (
                      <Bouncy onPress={() => router.push('/appointment')} style={{ padding: 10 }} accessibilityRole="button" testID="guide-vet">
                        <T weight="black" style={{ color: meta.color, fontSize: 14 }}>
                          {t('Add a vet visit')}
                        </T>
                      </Bouncy>
                    ) : null}
                  </View>
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
              {t('Set up every routine at once. Reminders only where they help, and the plan grows with {name}.', { name: pet.name })}
            </T>
            <Bouncy onPress={() => router.push('/plan')} style={{ padding: 12, marginTop: 6 }} accessibilityRole="button" testID="guide-adjust">
              <T weight="black" style={{ color: PURPLE, fontSize: 15 }}>
                {t('Adjust the numbers first')}
              </T>
            </Bouncy>
          </View>
        </ScrollView>

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
      </View>
    </View>
  );
}

/** The recommendation in numbers: how often and how much, with the usual range. */
function PlanBox({ r }: { r: Target }) {
  const c = recommendedChoice(r);
  const pr = portionFor(r, r.count.rec);
  if (!c) return null;
  return (
    <View style={styles.planBox}>
      <T weight="black" style={{ fontSize: 18, color: CARE[r.care].color, textAlign: 'center' }}>
        {choiceSummary(c)}
      </T>
      {pr && pr.min !== pr.max ? (
        <T weight="xbold" style={{ fontSize: 12, color: colors.muted, textAlign: 'center' }}>
          {t('Usual: {min} to {max} each', { min: formatAmount(r.care, pr.min), max: formatAmount(r.care, pr.max) })}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  planBox: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 2, marginBottom: 10 },
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
