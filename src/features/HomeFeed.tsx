/**
 * The cards under the pet on Home, in the order an owner needs them: what needs doing (next care),
 * what needs buying (pantry), what's worth remembering (today's moment, visits), then the week's
 * rhythm, care tips, the week's story and Paw Passport milestones.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { PetAvatar } from '../animation/PetAvatar';
import { TIPS, tipText } from '../content/tips';
import { Appointment, upcomingAppointments } from '../data/careRepo';
import { badgesFor } from '../domain/badges';
import { CareType } from '../domain/care';
import { dayComplete } from '../domain/streak';
import { addDays, dayKeyOf, formatClock, parseDayKey } from '../domain/time';
import { weekdayInitials } from '../i18n/dates';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { useCloud } from '../state/Cloud';
import { Medal } from './Medal';
import { NextCareCard } from './NextCare';
import { SuppliesCard } from './supplies';
import { AnniversaryCard, TodayMomentCard } from './MemoriesKit';
import { CareIcon } from '../ui/CareIcon';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';
import { Bouncy, Enter, PopIn } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { formatDateLong } from '../ui/forms';
import { t, tn } from '../i18n';

export const TIP_ICON: Record<string, CareType> = { water: 'water', 'walk-sniff': 'walk', 'cat-play': 'play', brush: 'grooming', meals: 'meal', weigh: 'meal', litter: 'litter', calm: 'play' };

export function Flame({ size = 34, color = '#FF7A1A', lit = true }: { size?: number; color?: string; lit?: boolean }) {
  if (ART.ui.streak) return <Image source={ART.ui.streak} style={{ width: size, height: size, tintColor: lit ? undefined : '#F3D9BF' }} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5c.6 3.2 4.8 5.4 4.8 10.3A4.8 4.8 0 0 1 12 21.5a4.8 4.8 0 0 1-4.8-4.8c0-2.4 1.3-3.8 2.4-5 .2 1.4.9 2.4 1.9 2.8-.6-3.5.4-6.6.5-8.9z" fill={lit ? color : '#D7DBE1'} />
      <Path d="M12 21.5a2.6 2.6 0 0 1-2.6-2.6c0-1.5 1.1-2.3 1.8-3.2.3 1 .9 1.4 1.5 1.6-.2-1.2.4-2.3.9-3 .9 1.3 1.6 2.6 1.6 4.6a2.6 2.6 0 0 1-3.2 2.6z" fill={lit ? '#FFD23F' : '#EEF0F3'} />
    </Svg>
  );
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <View style={styles.sectionHead}>
        <T weight="black" style={{ fontSize: 21, flex: 1 }} accessibilityRole="header">
          {title}
        </T>
        {action && onAction ? (
          <Bouncy accessibilityRole="button" accessibilityLabel={action} onPress={onAction} hitSlop={8}>
            <T weight="black" style={{ color: colors.brand, fontSize: 14 }}>
              {action}
            </T>
          </Bouncy>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function HomeFeed({ width }: { width: number }) {
  const { pet, pro, db, plan, version } = useApp();
  const cloudState = useCloud();
  const { byDay, earned } = useEngagement();
  const [visits, setVisits] = useState<Appointment[]>([]);
  useEffect(() => {
    if (pet) upcomingAppointments(db, pet.id, Date.now(), 2).then((a) => setVisits(a.filter((x) => x.at < Date.now() + 7 * 86_400_000)));
  }, [db, pet, version]);

  const today = dayKeyOf(new Date());
  const week = useMemo(() => {
    const d = parseDayKey(today);
    const monday = addDays(today, -((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [today]);

  if (!pet) return null;
  const tips = TIPS.filter((x) => x.species.includes(pet.species));
  const cardW = Math.min(width - 40, 300);
  const days = weekdayInitials();
  const weekDone = week.filter((k) => k <= today && dayComplete(plan, byDay.get(k))).length;

  return (
    <View style={{ width, paddingHorizontal: 20, paddingBottom: 120 }}>
      {/* next scheduled care, Clucky's "Next wakeup" */}
      <Enter index={0}>
        <NextCareCard width={width} />
      </Enter>

      {/* the shelf: what's running low and when to buy */}
      <Enter index={0}>
        <SuppliesCard />
      </Enter>

      {/* Pavurio Memories: today's little moment + birthday / adoption prompt */}
      <Enter index={1}>
        <TodayMomentCard width={width - 40} />
      </Enter>
      <AnniversaryCard />

      {/* visits soon */}
      {visits.length ? (
        <Enter index={1}>
          <Bouncy onPress={() => router.push({ pathname: '/appointment', params: { id: visits[0].id } })} style={[styles.visit]} accessibilityRole="button">
            <View style={styles.visitDate}>
              <T weight="black" style={{ fontSize: 11, color: '#FFFFFFC0' }}>
                {formatDateLong(dayKeyOf(new Date(visits[0].at))).split(' ')[0].toUpperCase()}
              </T>
              <T weight="black" style={{ fontSize: 22, color: '#FFFFFF', marginTop: -2 }}>
                {new Date(visits[0].at).getDate()}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 13, color: colors.brand, letterSpacing: 1 }}>
                {t('UPCOMING VISIT')}
              </T>
              <T weight="black" style={{ fontSize: 17 }} numberOfLines={1}>
                {visits[0].title}
              </T>
              <T style={{ color: colors.muted, fontSize: 13 }}>{formatClock(visits[0].at)}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Bouncy>
        </Enter>
      ) : null}

      {/* the week's rhythm: a happy face for every day the plan was coloured in — no streak pressure */}
      <Enter index={2}>
        <Bouncy onPress={() => router.push('/achievements')} style={[styles.streak]} accessibilityRole="button" accessibilityLabel={t('{n} of 7 days coloured in this week', { n: weekDone })} testID="feed-week">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 20 }}>
                {t('This week')}
              </T>
              <T weight="xbold" style={{ color: colors.muted, fontSize: 14 }}>
                {weekDone ? tn(weekDone, '1 day coloured in', '{n} days coloured in') : t('Every day you colour in gets a happy face')}
              </T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </View>
          <View style={styles.weekRow}>
            {week.map((k) => {
              const done = dayComplete(plan, byDay.get(k));
              const isT = k === today;
              return (
                <View key={k} style={{ alignItems: 'center', gap: 4 }}>
                  {/* a happy pet face for every day the plan was coloured in */}
                  <View style={[styles.weekDot, done && styles.weekDone, isT && !done && { borderColor: '#FF8A1F', borderWidth: 2.5 }]}>
                    {done ? (
                      <PopIn delay={isT ? 250 : 0}>
                        <PetAvatar species={pet.species} size={34} mood="happy" />
                      </PopIn>
                    ) : isT ? (
                      <View style={{ opacity: 0.45 }}>
                        <PetAvatar species={pet.species} size={30} mood="sleep" />
                      </View>
                    ) : null}
                  </View>
                  <T weight="black" style={{ fontSize: 11, color: isT ? colors.ink : colors.muted }}>
                    {days[parseDayKey(k).getDay()]}
                  </T>
                </View>
              );
            })}
          </View>
        </Bouncy>
      </Enter>


      {/* tips */}
      <Section title={t('Care tips')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }} decelerationRate="fast" snapToInterval={cardW * 0.72 + 12}>
          {tips.map((tip) => {
            const locked = tip.pro && !pro;
            return (
              <Bouncy
                key={tip.id}
                onPress={() => (locked ? router.push({ pathname: '/paywall', params: { reason: 'tip' } }) : router.push({ pathname: '/tip', params: { id: tip.id } }))}
                style={[styles.tip, { width: cardW * 0.72, backgroundColor: tip.tint }]}
                accessibilityRole="button"
                accessibilityLabel={tipText(tip.title)}
                testID={`tip-${tip.id}`}
              >
                <T weight="black" style={{ color: tip.color, fontSize: 11, letterSpacing: 1.4 }}>
                  {tipText(tip.kicker).toUpperCase()}
                </T>
                <T weight="black" style={{ fontSize: 18, marginTop: 4, lineHeight: 22 }} numberOfLines={3}>
                  {tipText(tip.title)}
                </T>
                <View style={{ flex: 1 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  {locked ? <LockChip /> : <T weight="black" style={{ color: tip.color, fontSize: 13 }}>{t('Read · 3 cards')}</T>}
                  {ART.tips[tip.id] ? <Scene source={ART.tips[tip.id]!} width={78} height={86} border={3} tilt={4} /> : <CareIcon type={TIP_ICON[tip.id] ?? 'meal'} size={64} />}
                </View>
              </Bouncy>
            );
          })}
        </ScrollView>
      </Section>

      {/* story */}
      <Enter index={6}>
        <Bouncy onPress={() => router.push({ pathname: '/story', params: { range: 'week' } })} style={[styles.story]} accessibilityRole="button" accessibilityLabel={t('Play this week story')}>
          <View style={styles.storyRing}>
            <PetAvatar species={pet.species} appearance={pet.appearance} size={64} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="black" style={{ color: '#FFFFFFC8', fontSize: 12, letterSpacing: 1.4 }}>
              {t('YOUR WEEK')}
            </T>
            <T weight="black" style={{ color: '#FFFFFF', fontSize: 19 }}>
              {t("{name}'s week in a story", { name: pet.name })}
            </T>
          </View>
          <View style={styles.play}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d="M7 4.5v15l12-7.5z" fill={colors.brand} />
            </Svg>
          </View>
        </Bouncy>
      </Enter>

      {/* badges */}
      <Section title={t('Achievements')} action={t('{n} of {total}', { n: badgesFor(pet.species).filter((b) => earned.includes(b.key)).length, total: badgesFor(pet.species).length })} onAction={() => router.push('/achievements')}>
        <Bouncy onPress={() => router.push('/achievements')} style={[styles.badges]} accessibilityRole="button" accessibilityLabel={t('Open achievements')}>
          {badgesFor(pet.species)
            .sort((a, b) => Number(earned.includes(b.key)) - Number(earned.includes(a.key)))
            .slice(0, 5)
            .map((b) => (
              <Medal key={b.key} def={b} size={54} locked={!earned.includes(b.key)} />
            ))}
        </Bouncy>
      </Section>

      {/* account: guests are backed up, but only a saved account survives a new phone */}
      {cloudState.enabled && cloudState.user?.anonymous ? (
        <Enter index={7}>
          <Bouncy scaleTo={0.975} onPress={() => router.push('/account')} style={[styles.save]} accessibilityRole="button" testID="feed-save-account">
            {ART.icons.shield ? <Image source={ART.icons.shield} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 17 }}>
                {t('Keep {name} safe', { name: pet.name })}
              </T>
              <T style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{t('Save your account to get your pets back on a new phone.')}</T>
            </View>
            <Icon name="chevR" size={18} color={colors.faint} />
          </Bouncy>
        </Enter>
      ) : null}

      {/* pro */}
      {!pro ? (
        <Enter index={8}>
          <View style={styles.pro}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T weight="black" style={{ color: colors.brand, fontSize: 22, lineHeight: 26 }}>
                  {t('Go Pro for {name}', { name: pet.name })}
                </T>
                <T style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{t('Every care tip, more pets, monthly stories and the full history. Free trial included when available.')}</T>
              </View>
              {ART.scenes.premium ? (
                <Scene source={ART.scenes.premium} width={86} height={112} border={3} tilt={5} style={{ marginLeft: 10 }} />
              ) : (
                <View style={styles.proAv}>
                  <PetAvatar species={pet.species} appearance={pet.appearance} size={76} />
                </View>
              )}
            </View>
            <Bouncy onPress={() => router.push({ pathname: '/paywall', params: { reason: 'feed' } })} style={styles.proBtn} accessibilityRole="button" testID="feed-pro">
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 17 }}>
                {t('See Pavurio Pro')}
              </T>
            </Bouncy>
          </View>
        </Enter>
      ) : null}
    </View>
  );
}

function LockChip() {
  return (
    <View style={styles.lock}>
      <Svg width={12} height={12} viewBox="0 0 24 24">
        <Path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z" stroke="#FFFFFF" strokeWidth={2.6} fill="none" strokeLinejoin="round" />
      </Svg>
      <T weight="black" style={{ color: '#FFFFFF', fontSize: 11, letterSpacing: 1 }}>
        PRO
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  save: { marginTop: 26, backgroundColor: colors.card, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  streak: { backgroundColor: '#FFF6EC', borderRadius: 28, padding: 18, marginTop: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  weekDone: { backgroundColor: '#FFE9D2', borderColor: '#FFB766' },
  weekDot: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F2E3D2' },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 14, marginTop: 12 },
  visitDate: { width: 52, height: 56, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  cdot: { width: 18, height: 18, borderRadius: 9 },
  tip: { height: 190, borderRadius: 26, padding: 16 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  story: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.brand, borderRadius: 28, padding: 16, marginTop: 26 },
  storyRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 24, padding: 16 },
  pro: { marginTop: 26, borderRadius: 28, padding: 20, backgroundColor: '#E8FAFB', borderWidth: 1.5, borderColor: '#BDEEF1' },
  proAv: { width: 90, height: 90, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginLeft: 10 },
  proBtn: { marginTop: 16, height: 54, borderRadius: 27, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
