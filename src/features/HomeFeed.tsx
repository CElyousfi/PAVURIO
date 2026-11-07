/**
 * Under the pet on Home, in the order an owner needs them:
 *  1. what does my pet need today? (next care)
 *  2. what should I buy? (pantry — only when something actually needs attention)
 *  3. a moment worth remembering (today's photo, birthdays, visits)
 * then the week's rhythm and one row of shortcuts. Everything else lives one tap away.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { PetAvatar } from '../animation/PetAvatar';
import { TIPS, tipText } from '../content/tips';
import { Appointment, upcomingAppointments } from '../data/careRepo';
import { CareType } from '../domain/care';
import { dayComplete } from '../domain/streak';
import { addDays, dayKeyOf, formatClock, parseDayKey } from '../domain/time';
import { weekdayInitials } from '../i18n/dates';
import { useApp } from '../state/AppState';
import { useEngagement } from '../state/Engagement';
import { useCloud } from '../state/Cloud';
import { NextCareCard } from './NextCare';
import { GuideCard } from './RoutineGuide';
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

export function HomeFeed({ width }: { width: number }) {
  const { pet, pro, db, plan, version } = useApp();
  const cloudState = useCloud();
  const { byDay } = useEngagement();
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
  const tipOfDay = tips.length ? tips[Math.floor(parseDayKey(today).getTime() / 86_400_000) % tips.length] : null;
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


      {/* everything else, one tap away (not a long feed of big cards) */}
      <Enter index={3}>
        <View style={styles.shortcuts}>
          {[
            { key: 'moments', label: t('Memories'), icon: ART.icons.gift, go: () => router.push('/moments') },
            { key: 'records', label: t('Records'), icon: ART.icons.heart, go: () => router.push('/records') },
            { key: 'summary', label: t('Summary'), icon: ART.duo.awards, go: () => router.push('/summary') },
            pet.species === 'dog'
              ? { key: 'passport', label: t('Paw Passport'), icon: ART.icons.paw, go: () => router.push('/passport') }
              : { key: 'achievements', label: t('Milestones'), icon: ART.duo.awards, go: () => router.push('/achievements') },
          ].map((x) => (
            <Bouncy key={x.key} scaleTo={0.94} onPress={x.go} accessibilityRole="button" accessibilityLabel={x.label} style={styles.shortcut} testID={`home-${x.key}`}>
              {x.icon ? <Image source={x.icon} style={{ width: 40, height: 40 }} resizeMode="contain" /> : null}
              <T weight="black" style={{ fontSize: 12.5, textAlign: 'center' }} numberOfLines={1}>
                {x.label}
              </T>
            </Bouncy>
          ))}
        </View>
      </Enter>

      {/* the routine guide: until the age is known, and again each time the pet reaches a new life stage */}
      <GuideCard enter={4} />

      {/* one care tip a day, small */}
      {tipOfDay ? (
        <Enter index={4}>
          <Bouncy
            scaleTo={0.97}
            onPress={() => (tipOfDay.pro && !pro ? router.push({ pathname: '/paywall', params: { reason: 'tip' } }) : router.push({ pathname: '/tip', params: { id: tipOfDay.id } }))}
            style={[styles.tipRow, { backgroundColor: tipOfDay.tint }]}
            accessibilityRole="button"
            accessibilityLabel={`${t('Care tip')}: ${tipText(tipOfDay.title)}`}
            testID={`tip-${tipOfDay.id}`}
          >
            {ART.tips[tipOfDay.id] ? <Scene art={ART.tips[tipOfDay.id]!} width={52} height={58} border={3} tilt={4} /> : <CareIcon type={TIP_ICON[tipOfDay.id] ?? 'meal'} size={48} />}
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ color: tipOfDay.color, fontSize: 11, letterSpacing: 1.2 }}>
                {t('CARE TIP')}
              </T>
              <T weight="black" style={{ fontSize: 15, lineHeight: 19 }} numberOfLines={2}>
                {tipText(tipOfDay.title)}
              </T>
            </View>
            {tipOfDay.pro && !pro ? <LockChip /> : <Icon name="chevR" size={18} color={colors.faint} />}
          </Bouncy>
        </Enter>
      ) : null}

      {/* account: guests are backed up, but only a saved account survives a new phone */}
      {cloudState.enabled && cloudState.user?.anonymous ? (
        <Enter index={7}>
          <Bouncy scaleTo={0.975} onPress={() => router.push('/account')} style={[styles.save]} accessibilityRole="button" testID="feed-save-account">
            {ART.duo.privacy ? <Image source={ART.duo.privacy} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
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

      {/* Pro: one quiet line (the timely offers come from Pro moments, never from a big card) */}
      {!pro ? (
        <Bouncy scaleTo={0.97} onPress={() => router.push({ pathname: '/paywall', params: { reason: 'feed' } })} style={styles.proRow} accessibilityRole="button" testID="feed-pro">
          <T weight="black" style={{ color: colors.brand, fontSize: 15, flex: 1 }}>
            {t('Pavurio Pro: more pets, coats, stories & full history')}
          </T>
          <Icon name="chevR" size={18} color={colors.brand} />
        </Bouncy>
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
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 14 },
  shortcut: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 12, marginTop: 14 },
  proRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#E8FAFB' },
  pro: { marginTop: 26, borderRadius: 28, padding: 20, backgroundColor: '#E8FAFB', borderWidth: 1.5, borderColor: '#BDEEF1' },
  proAv: { width: 90, height: 90, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginLeft: 10 },
  proBtn: { marginTop: 16, height: 54, borderRadius: 27, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
