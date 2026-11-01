import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Appointment, Measurement, listAppointments, listMeasurements, upcomingAppointments } from '../../data/careRepo';
import { listEventsBetween } from '../../data/repo';
import { CARE } from '../../domain/care';
import { describeDays, formatTime24to12 } from '../../domain/schedule';
import { addDays, dayKeyOf, dayRange, formatClock, parseDayKey } from '../../domain/time';
import { KindIcon, OccurrenceRow, kindMeta } from '../../features/routines';
import { useApp, useOccurrences } from '../../state/AppState';
import { Card, MonthGrid, MonthNav, Sheet, TabTitle, formatDateLong } from '../../ui/forms';
import { CircleButton, Icon, Label, T } from '../../ui/primitives';
import { colors } from '../../ui/theme';
import { tapFeedback } from '../../native/haptics';
import { Bouncy, Enter } from '../../ui/motion';
import { ART } from '../../ui/art';
import { Scene } from '../../ui/Scene';
import { formatWeight, toUnit } from '../../features/weight';
import { t, tn } from '../../i18n';
import { monthNamesShort, weekdayNamesShort } from '../../i18n/dates';

const DOW = (i: number) => weekdayNamesShort()[i].replace('.', '');

export default function CareTab() {
  const { pet, db, bump, version, schedules, settings } = useApp();
  const insets = useSafeAreaInsets();
  const today = dayKeyOf(new Date());
  const [day, setDay] = useState(today);
  const [monthOpen, setMonthOpen] = useState(false);
  const [month, setMonth] = useState(today);
  const [addOpen, setAddOpen] = useState(false);
  const occ = useOccurrences(day);
  const [dayAppts, setDayAppts] = useState<Appointment[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [weights, setWeights] = useState<Measurement[]>([]);
  const [logCount, setLogCount] = useState(0);
  const [monthDots, setMonthDots] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!pet) return;
    let alive = true;
    const { start, end } = dayRange(parseDayKey(day));
    Promise.all([
      listAppointments(db, pet.id, start, end),
      upcomingAppointments(db, pet.id, Date.now(), 5),
      listMeasurements(db, pet.id),
      listEventsBetween(db, pet.id, start, end),
    ]).then(([a, u, w, ev]) => {
      if (!alive) return;
      setDayAppts(a);
      setUpcoming(u);
      setWeights(w);
      setLogCount(ev.length);
    });
    return () => {
      alive = false;
    };
  }, [db, pet, day, version]);

  // month dots: care colours logged per day + appointments
  useEffect(() => {
    if (!pet || !monthOpen) return;
    const d = parseDayKey(month);
    const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    Promise.all([listEventsBetween(db, pet.id, from, to), listAppointments(db, pet.id, from, to)]).then(([ev, ap]) => {
      const dots: Record<string, string[]> = {};
      for (const e of ev) {
        const k = dayKeyOf(new Date(e.occurredAt));
        const c = CARE[e.type].color;
        dots[k] = dots[k] ?? [];
        if (!dots[k].includes(c)) dots[k].push(c);
      }
      for (const a of ap) {
        const k = dayKeyOf(new Date(a.at));
        dots[k] = [colors.ink, ...(dots[k] ?? [])];
      }
      setMonthDots(dots);
    });
  }, [db, pet, month, monthOpen, version]);

  const week = useMemo(() => {
    const d = parseDayKey(day);
    const sunday = addDays(day, -d.getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  }, [day]);

  if (!pet) return null;
  const latest = weights[weights.length - 1];
  const prev = weights[weights.length - 2];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <TabTitle
        title={t('Care')}
        subtitle={t("{name}'s routines & visits", { name: pet.name })}
        right={<CircleButton icon="plus" label={t('Add to care')} onPress={() => setAddOpen(true)} size={50} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        {/* week strip */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <T weight="black" style={{ fontSize: 17, flex: 1 }}>
              {day === today ? t('Today') : formatDateLong(day)}
            </T>
            <Bouncy
              accessibilityRole="button"
              accessibilityLabel={t('Open month calendar')}
              onPress={() => {
                setMonth(day);
                setMonthOpen(true);
              }}
              style={styles.monthBtn}
              hitSlop={6}
            >
              <T weight="black" style={{ color: colors.brand, fontSize: 13, letterSpacing: 1 }}>
                {t('MONTH')}
              </T>
            </Bouncy>
          </View>
          <View style={styles.week}>
            <CircleButton icon="chevL" label={t('Previous week')} onPress={() => setDay(addDays(day, -7))} size={34} />
            {week.map((k) => {
              const sel = k === day;
              const isT = k === today;
              return (
                <Bouncy
                  key={k}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={formatDateLong(k)}
                  onPress={() => {
                    tapFeedback();
                    setDay(k);
                  }}
                  style={[styles.wday, sel && { backgroundColor: colors.ink }]}
                >
                  <T weight="xbold" style={{ fontSize: 11, color: sel ? '#FFFFFFB0' : colors.muted }}>
                    {DOW(parseDayKey(k).getDay()).toUpperCase()}
                  </T>
                  <T weight="black" style={{ fontSize: 17, color: sel ? '#FFFFFF' : isT ? colors.brand : colors.ink }}>
                    {Number(k.slice(8))}
                  </T>
                </Bouncy>
              );
            })}
            <CircleButton icon="chevR" label={t('Next week')} onPress={() => setDay(addDays(day, 7))} size={34} />
          </View>
        </View>

        {/* agenda */}
        <Card enter={0}>
          <Label>{t('Agenda')}</Label>
          {occ.length === 0 && dayAppts.length === 0 ? (
            <View style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {ART.icons.noReminders ? <Image source={ART.icons.noReminders} style={{ width: 64, height: 60 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
              <T style={{ color: colors.muted, lineHeight: 21, flex: 1 }}>
                {schedules.length === 0
                  ? t("No routines yet. Add {name}'s meals, walks or medication and get a gentle reminder.", { name: pet.name })
                  : t('Nothing scheduled this day.')}
              </T>
            </View>
          ) : null}
          {dayAppts.map((a) => (
            <Bouncy scaleTo={0.975} key={a.id} accessibilityRole="button" accessibilityLabel={t('Appointment {title} at {time}', { title: a.title, time: formatClock(a.at) })} onPress={() => router.push({ pathname: '/appointment', params: { id: a.id } })} style={styles.apptRow}>
              <View style={styles.apptIcon}>
                <CalendarGlyph />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="black" style={{ fontSize: 16 }} numberOfLines={1}>
                  {a.title}
                </T>
                <T style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                  {formatClock(a.at)}
                  {a.location ? ` · ${a.location}` : ''}
                  {a.doneAt ? ` · ${t('Done')}` : ''}
                </T>
              </View>
              <Icon name="chevR" size={18} color={colors.faint} />
            </Bouncy>
          ))}
          {occ.map((o, oi) => (
            <Enter key={o.key} index={oi}>
              <OccurrenceRow o={o} db={db} species={pet.species} bump={bump} />
            </Enter>
          ))}
          <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel={t('Open care log for this day')} onPress={() => router.push({ pathname: '/day', params: { day } })} style={styles.logLink}>
            <T weight="xbold" style={{ color: colors.brand, fontSize: 14 }}>
              {logCount === 0 ? t('No care logged') : tn(logCount, '{n} care entry logged', '{n} care entries logged')} · {t('Open log')}
            </T>
          </Bouncy>
        </Card>

        {/* routines */}
        <View>
          <SectionHead title={t('Routines')} action={t('New')} onAction={() => router.push('/schedule')} />
          {schedules.length === 0 ? (
            <Card enter={1} onPress={() => router.push('/schedule')} accessibilityLabel={t('Create a routine')}>
              <T weight="black" style={{ fontSize: 16 }}>
                {t('Set up a routine')}
              </T>
              <T style={{ color: colors.muted, marginTop: 4, lineHeight: 20 }}>
                {t('Breakfast at 8, a walk at 6, a pill every evening — pick times and days, and Pavurio reminds you.')}
              </T>
            </Card>
          ) : (
            <Card enter={1} style={{ paddingVertical: 6 }}>
              {schedules.map((s, i) => (
                <Bouncy
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('Edit routine {title}', { title: s.title })}
                  onPress={() => router.push({ pathname: '/schedule', params: { id: s.id } })}
                  style={[styles.routine, i > 0 && styles.divider]}
                >
                  <KindIcon type={s.type} size={40} />
                  <View style={{ flex: 1 }}>
                    <T weight="black" style={{ fontSize: 16 }} numberOfLines={1}>
                      {s.title}
                    </T>
                    <T style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                      {describeDays(s.days)} · {s.times.map(formatTime24to12).join(', ')}
                    </T>
                  </View>
                  {!s.enabled ? (
                    <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
                      {t('PAUSED')}
                    </T>
                  ) : s.remind ? (
                    <BellGlyph color={kindMeta(s.type).color} />
                  ) : null}
                  <Icon name="chevR" size={18} color={colors.faint} />
                </Bouncy>
              ))}
            </Card>
          )}
        </View>

        {/* appointments */}
        <View>
          <SectionHead title={t('Upcoming visits')} action={t('Add')} onAction={() => router.push('/appointment')} />
          {upcoming.length === 0 ? (
            <Card enter={2} onPress={() => router.push('/appointment')} accessibilityLabel={t('Add an appointment')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {ART.scenes.appointments ? <Scene source={ART.scenes.appointments} width={78} height={66} radius={16} /> : null}
                <T style={{ color: colors.muted, lineHeight: 20, flex: 1 }}>{t('Vet, groomer or sitter — add a visit and get reminded the day before.')}</T>
              </View>
            </Card>
          ) : (
            <Card style={{ paddingVertical: 6 }}>
              {upcoming.map((a, i) => (
                <Bouncy scaleTo={0.975} key={a.id} accessibilityRole="button" accessibilityLabel={t('Edit {title}', { title: a.title })} onPress={() => router.push({ pathname: '/appointment', params: { id: a.id } })} style={[styles.routine, i > 0 && styles.divider]}>
                  <View style={styles.dateBadge}>
                    <T weight="black" style={{ fontSize: 11, color: colors.brand }}>
                      {monthNamesShort()[new Date(a.at).getMonth()].replace('.', '').toUpperCase()}
                    </T>
                    <T weight="black" style={{ fontSize: 18, marginTop: -2 }}>
                      {new Date(a.at).getDate()}
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="black" style={{ fontSize: 16 }} numberOfLines={1}>
                      {a.title}
                    </T>
                    <T style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                      {DOW(new Date(a.at).getDay())} · {formatClock(a.at)}
                      {a.location ? ` · ${a.location}` : ''}
                    </T>
                  </View>
                  <Icon name="chevR" size={18} color={colors.faint} />
                </Bouncy>
              ))}
            </Card>
          )}
        </View>

        {/* weight */}
        <View>
          <SectionHead title={t('Weight')} action={t('Log')} onAction={() => router.push({ pathname: '/weight', params: { add: '1' } })} />
          <Card enter={3} onPress={() => router.push('/weight')} accessibilityLabel={t('Open weight history')}>
            {latest ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <T weight="black" style={{ fontSize: 28 }}>
                    {formatWeight(latest, settings.weightUnit)}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 13 }}>
                    {formatDateLong(dayKeyOf(new Date(latest.at)))}
                    {prev ? ` · ${t('{delta} since last', { delta: deltaText(toUnit(latest, settings.weightUnit) - toUnit(prev, settings.weightUnit), settings.weightUnit) })}` : ''}
                  </T>
                </View>
                <Spark values={weights.slice(-10).map((w) => toUnit(w, settings.weightUnit))} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {ART.scenes.weigh ? <Scene source={ART.scenes.weigh} width={78} height={66} radius={16} /> : null}
                <T style={{ color: colors.muted, lineHeight: 20, flex: 1 }}>{t("Track {name}'s weight over time. Your vet will love the chart.", { name: pet.name })}</T>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      <Sheet visible={monthOpen} onClose={() => setMonthOpen(false)} title={t('Calendar')}>
        <MonthNav month={month} onChange={setMonth} />
        <MonthGrid
          month={month}
          selected={day}
          dots={monthDots}
          onSelect={(k) => {
            setDay(k);
            setMonthOpen(false);
          }}
        />
      </Sheet>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title={t('Add to care')}>
        {[
          { label: t('Routine & reminder'), body: t('Meals, walks, medication — on a schedule'), go: () => router.push('/schedule') },
          { label: t('Appointment'), body: t('Vet, groomer, sitter'), go: () => router.push('/appointment') },
          { label: t('Weight'), body: t("Log {name}'s weight today", { name: pet.name }), go: () => router.push({ pathname: '/weight', params: { add: '1' } }) },
          { label: t('Walk timer'), body: t('Time a walk and save it'), go: () => router.push('/walk') },
        ].map((o) => (
          <Bouncy
            key={o.label}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            onPress={() => {
              setAddOpen(false);
              tapFeedback();
              setTimeout(o.go, 220);
            }}
            style={styles.addRow}
          >
            <View style={{ flex: 1 }}>
              <T weight="black" style={{ fontSize: 17 }}>
                {o.label}
              </T>
              <T style={{ color: colors.muted, fontSize: 14 }}>{o.body}</T>
            </View>
            <Icon name="chevR" size={20} color={colors.faint} />
          </Bouncy>
        ))}
      </Sheet>
    </View>
  );
}

function deltaText(d: number, unit: 'kg' | 'lb') {
  const r = Math.round(d * 10) / 10;
  if (r === 0) return t('no change');
  return `${r > 0 ? '+' : '−'}${Math.abs(r)} ${unit}`;
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <T weight="black" style={{ fontSize: 19, flex: 1 }} accessibilityRole="header">
        {title}
      </T>
      {action && onAction ? (
        <Bouncy scaleTo={0.975} accessibilityRole="button" accessibilityLabel={`${action} ${title}`} onPress={onAction} hitSlop={8} style={styles.monthBtn}>
          <T weight="black" style={{ color: colors.brand, fontSize: 13, letterSpacing: 1 }}>
            {action.toUpperCase()}
          </T>
        </Bouncy>
      ) : null}
    </View>
  );
}

export function Spark({ values, w = 110, h = 44, color = colors.brand }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * (w - 8), 4 + (1 - (v - min) / span) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={w} height={h}>
      <Path d={d} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4.5} fill={color} />
    </Svg>
  );
}

function CalendarGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M5 6h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6zM3.5 10.5h17M8 3.5v4M16 3.5v4" stroke="#FFFFFF" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function BellGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityLabel={t('Reminders on')}>
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  monthBtn: { paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wday: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  apptIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logLink: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  routine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  dateBadge: { width: 44, height: 48, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
});
