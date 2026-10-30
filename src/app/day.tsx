import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { PetRig } from '../animation/PetRig';
import { CARE, SPECIES_CARE, formatAmount } from '../domain/care';
import { progressSentence } from '../domain/progress';
import { addDays, dayKeyOf, formatClock, formatDayTitle, isToday } from '../domain/time';
import { useApp, useDay } from '../state/AppState';
import { CareIcon } from '../ui/CareIcon';
import { CircleButton, Label, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { tapFeedback } from '../native/haptics';

export default function DayDetail() {
  const params = useLocalSearchParams<{ day?: string }>();
  const [dayKey, setDayKey] = useState(params.day ?? dayKeyOf(new Date()));
  const { pet } = useApp();
  const { events, progress, loading } = useDay(dayKey);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 520);
  const [picking, setPicking] = useState(false);

  if (!pet) return null;
  const today = isToday(dayKey);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + 30 }}>
        <View style={{ width: W, paddingHorizontal: 20 }}>
          <View style={styles.topRow}>
            <View style={styles.nav}>
              <CircleButton icon="chevL" label="Previous day" onPress={() => setDayKey((k) => addDays(k, -1))} size={44} />
              <T weight="black" style={styles.dayTitle} accessibilityRole="header">
                {formatDayTitle(dayKey)}
              </T>
              <CircleButton
                icon="chevR"
                label="Next day"
                onPress={() => !today && setDayKey((k) => addDays(k, 1))}
                size={44}
                style={{ opacity: today ? 0.3 : 1 }}
              />
            </View>
            <CircleButton icon="close" label="Close" onPress={() => router.back()} />
          </View>

          <Animated.View key={dayKey} entering={FadeIn.duration(250)} style={{ alignItems: 'center' }}>
            <PetRig
              species={pet.species}
              appearance={pet.appearance}
              size={Math.min(200, W * 0.5)}
              progress={progress.planned > 0 ? progress.ratio : events.length ? 1 : 0}
              rug={{ bands: progress.bands, planned: progress.planned }}
            />
            <T weight="black" style={styles.big}>
              {progress.planned > 0 ? `${progress.done}/${progress.planned}` : events.length}
            </T>
            <T style={styles.sub}>{progressSentence(progress)}</T>
            {events.length > progress.done ? (
              <T weight="xbold" style={styles.extra}>
                {events.length} logged in total
              </T>
            ) : null}
          </Animated.View>

          <View style={styles.list}>
            {!loading && events.length === 0 ? (
              <View style={styles.empty}>
                <T weight="xbold" style={{ fontSize: 17, color: colors.inkSoft }}>
                  Nothing logged {today ? 'yet today' : 'on this day'}
                </T>
                <T style={{ color: colors.muted, marginTop: 4, textAlign: 'center' }}>
                  Missed something? Add it below with the time it happened.
                </T>
              </View>
            ) : null}
            {events.map((e, i) => (
              <Animated.View key={e.id} entering={FadeInDown.delay(i * 40)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${CARE[e.type].label}, ${formatAmount(e.type, e.amount)}, at ${formatClock(e.occurredAt)}. Edit`}
                  onPress={() => {
                    tapFeedback();
                    router.push({ pathname: '/log/[type]', params: { type: e.type, eventId: e.id } });
                  }}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
                  testID={`event-${i}`}
                >
                  <CareIcon type={e.type} size={46} />
                  <View style={{ flex: 1 }}>
                    <T weight="black" style={{ fontSize: 18, color: CARE[e.type].color }}>
                      {CARE[e.type].label}
                    </T>
                    <T weight="xbold" style={{ fontSize: 15 }}>
                      {formatAmount(e.type, e.amount)}
                    </T>
                    {e.note ? (
                      <T style={{ color: colors.muted, fontSize: 14 }} numberOfLines={2}>
                        {e.note}
                      </T>
                    ) : null}
                  </View>
                  <T weight="xbold" style={styles.time}>
                    {formatClock(e.occurredAt)}
                  </T>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          <View style={{ alignItems: 'center', gap: 12, marginTop: 10 }}>
            {events.length > 0 ? <Label>Tap an entry to edit or delete it</Label> : null}
            {picking ? (
              <Animated.View entering={FadeInDown} style={styles.picker}>
                {SPECIES_CARE[pet.species].map((t) => (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityLabel={`Add missed ${CARE[t].label}`}
                    onPress={() => {
                      setPicking(false);
                      router.push({ pathname: '/log/[type]', params: { type: t, day: dayKey } });
                    }}
                    style={styles.pickItem}
                  >
                    <CareIcon type={t} size={44} />
                    <Label style={{ fontSize: 10, marginTop: 2 }}>{CARE[t].label}</Label>
                  </Pressable>
                ))}
              </Animated.View>
            ) : (
              <SoftPill label="Add a missed entry" onPress={() => setPicking(true)} />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayTitle: { fontSize: 18, minWidth: 96, textAlign: 'center' },
  big: { fontSize: 44, lineHeight: 50, color: colors.brand, marginTop: 4 },
  sub: { color: colors.muted, fontSize: 16 },
  extra: { color: colors.brand, fontSize: 15, marginTop: 4 },
  list: { marginTop: 22, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  time: { color: colors.muted, fontSize: 16 },
  empty: { alignItems: 'center', paddingVertical: 18 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, backgroundColor: colors.canvasWarm, padding: 12, borderRadius: 24 },
  pickItem: { alignItems: 'center', width: 64 },
});

