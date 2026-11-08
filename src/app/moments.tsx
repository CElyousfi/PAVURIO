/**
 * Memories — the pet's scrapbook. Today's little moment on top, then three views:
 * Moments (by month, virtualized), Milestones (a timeline + upcoming anniversaries) and On This Day.
 * Stories and Memory Cards are one tap away.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Moment, listMilestones, listMoments, onThisDay } from '../data/memoriesRepo';
import { listEventsBetween } from '../data/repo';
import { MILESTONES, MILESTONE_EMOJI, MILESTONE_LABEL, groupByMonth, momentLabel, nextAnniversary } from '../domain/memories';
import { StoryRange, storyWindow } from '../domain/stories';
import { dayKeyOf, parseDayKey } from '../domain/time';
import { monthNames } from '../i18n/dates';
import { useApp } from '../state/AppState';
import { AnniversaryCard, MEM_COLORS, MomentThumb, TodayMomentCard } from '../features/MemoriesKit';
import { EmptyState, TabTitle, formatDateLong } from '../ui/forms';
import { CircleButton, T, Column } from '../ui/primitives';
import { Bouncy } from '../ui/motion';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';
import { Sticker, moodSticker } from '../ui/Sticker';
import { colors } from '../ui/theme';
import { t, tn } from '../i18n';
import { Segmented } from '../ui/Segmented';

type View3 = 'moments' | 'milestones' | 'onthisday';
type Row = { key: string; kind: 'month'; month: string; count: number } | { key: string; kind: 'row'; items: Moment[] };
const COLS = 3;
const GAP = 8;

export default function MemoriesTab() {
  const { pet, db, version, pro } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 560);
  const [tab, setTab] = useState<View3>('moments');
  const [favOnly, setFavOnly] = useState(false);
  const [items, setItems] = useState<Moment[] | null>(null);
  const [milestones, setMilestones] = useState<Moment[]>([]);
  const [otd, setOtd] = useState<{ years: number; moment: Moment }[]>([]);
  const [ready, setReady] = useState<Record<StoryRange, boolean>>({ week: false, month: false });
  const today = dayKeyOf(new Date());

  useEffect(() => {
    if (!pet) return;
    listMoments(db, pet.id).then(setItems);
    listMilestones(db, pet.id).then(setMilestones);
    onThisDay(db, pet.id, today).then(setOtd);
    // a story is offered only with at least 3 logs in its window (same rule as buildStory)
    (['week', 'month'] as StoryRange[]).forEach((r) => {
      const w = storyWindow(r, today);
      const [y, m, d] = w.from.split('-').map(Number);
      listEventsBetween(db, pet.id, new Date(y, m - 1, d).getTime(), Date.now() + 1).then((ev) => setReady((s) => ({ ...s, [r]: ev.length >= 3 })));
    });
  }, [db, pet, version, today]);

  const tile = (W - 40 - GAP * (COLS - 1)) / COLS;
  const rows = useMemo<Row[]>(() => {
    const src = (items ?? []).filter((m) => !favOnly || m.favorite);
    const out: Row[] = [];
    for (const g of groupByMonth(src)) {
      out.push({ key: `m-${g.month}`, kind: 'month', month: g.month, count: g.items.length });
      for (let i = 0; i < g.items.length; i += COLS) out.push({ key: `r-${g.items[i].id}`, kind: 'row', items: g.items.slice(i, i + COLS) });
    }
    return out;
  }, [items, favOnly]);

  const open = useCallback((m: Moment) => {
    if (m.kind === 'adventure' && m.walkId) router.push({ pathname: '/adventure', params: { id: m.walkId } });
    else router.push({ pathname: '/moment', params: { id: m.id } });
  }, []);

  if (!pet) return null;
  const monthLabel = (k: string) => {
    const d = parseDayKey(`${k}-01`);
    const name = monthNames()[d.getMonth()];
    return d.getFullYear() === new Date().getFullYear() ? name : `${name} ${d.getFullYear()}`;
  };

  const header = (
    <View style={{ gap: 4 }}>
      <TodayMomentCard width={W - 40} compact />
      <AnniversaryCard />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <Bouncy accessibilityRole="button" accessibilityLabel={t('Memory Cards')} onPress={() => router.push('/cards')} style={[styles.entry, { backgroundColor: MEM_COLORS.pink }]} testID="open-cards">
          {/* on narrow phones the title gets the whole tile, so "Memory" never breaks mid-word */}
          {W >= 400 ? <Sticker name={moodSticker(pet.species, 'love')} size={54} /> : null}
          <View style={{ flex: 1 }}>
            <T weight="black" style={{ fontSize: 15.5 }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t('Memory Cards')}
            </T>
            <T weight="xbold" style={{ fontSize: 12, color: colors.muted }} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t('Frame your photos')}
            </T>
          </View>
        </Bouncy>
        {(['week', 'month'] as StoryRange[]).map((r) => (
          <Bouncy
            key={r}
            disabled={!ready[r]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready[r] }}
            accessibilityLabel={r === 'week' ? t('Play this week story') : t('Play this month story')}
            onPress={() => (r === 'month' && !pro ? router.push({ pathname: '/paywall', params: { reason: 'story' } }) : router.push({ pathname: '/story', params: { range: r } }))}
            scaleTo={0.96}
            style={[styles.story, { opacity: ready[r] ? 1 : 0.5 }, r === 'month' && { backgroundColor: '#FFE9D6' }]}
            testID={`story-${r}`}
          >
            <Sticker name={r === 'week' ? 'duo_hug' : moodSticker(pet.species, 'party')} size={40} />
            <T weight="black" style={{ fontSize: 12.5, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {r === 'week' ? t('This week') : t('This month')}
            </T>
          </Bouncy>
        ))}
      </View>

      <Segmented
        style={{ marginTop: 18 }}
        height={38}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'moments', label: t('Moments'), testID: 'mem-tab-moments' },
          { key: 'milestones', label: t('Milestones'), testID: 'mem-tab-milestones' },
          { key: 'onthisday', label: t('On This Day'), testID: 'mem-tab-onthisday' },
        ]}
      />

      {tab === 'moments' && items?.length ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Bouncy accessibilityRole="button" accessibilityState={{ selected: favOnly }} accessibilityLabel={t('Favorites only')} onPress={() => setFavOnly(!favOnly)} style={[styles.filter, favOnly && { backgroundColor: MEM_COLORS.pink }]}>
            <T weight="black" style={{ fontSize: 13, color: favOnly ? MEM_COLORS.pinkInk : colors.inkSoft }}>
              {favOnly ? '♥ ' : '♡ '}
              {t('Favorites')}
            </T>
          </Bouncy>
        </View>
      ) : null}
    </View>
  );

  const empty =
    tab === 'moments' ? (
      items === null ? null : (
        <EmptyState
          title={favOnly ? t('No favorites yet') : t('Your first moment')}
          body={favOnly ? t('Tap ♡ on a photo to keep it here.') : t("First bath, a new trick, a lazy Sunday — add a photo and it shows up in {name}'s stories.", { name: pet.name })}
          art={!favOnly && ART.scenes.moments ? <Scene art={ART.scenes.moments} width={150} height={186} border={5} tilt={3} style={{ marginBottom: 8 }} /> : undefined}
        />
      )
    ) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <Column>
      <TabTitle title={t('Memories')} subtitle={t('Photos & milestones with {name}', { name: pet.name })} right={<CircleButton icon="plus" label={t('Add a moment')} onPress={() => router.push('/memory')} size={50} />} />
      {tab === 'moments' ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          ListHeaderComponent={header}
          ListEmptyComponent={empty ?? undefined}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={9}
          removeClippedSubviews
          renderItem={({ item }) =>
            item.kind === 'month' ? (
              <View style={styles.monthHead} accessibilityRole="header">
                <T weight="black" style={{ fontSize: 19 }}>
                  {monthLabel(item.month)}
                </T>
                <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
                  {tn(item.count, '1 moment', '{n} moments')}
                </T>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: GAP, marginBottom: GAP }}>
                {item.items.map((m) => {
                  const label = momentLabel(m, t);
                  return (
                    <Bouncy key={m.id} accessibilityRole="imagebutton" accessibilityLabel={`${label || t('Photo')}, ${formatDateLong(m.date)}${m.favorite ? `, ${t('Favorite')}` : ''}`} onPress={() => open(m)} scaleTo={0.96}>
                      <MomentThumb m={m} size={{ w: tile, h: tile * 1.2 }} species={pet.species} />
                      {m.milestone || m.kind === 'adventure' ? (
                        <View style={styles.tag}>
                          <T style={{ fontSize: 11 }}>{m.milestone ? MILESTONE_EMOJI[m.milestone] : '🐾'}</T>
                        </View>
                      ) : null}
                      <T weight="xbold" style={styles.tileDay}>
                        {parseDayKey(m.date).getDate()}
                      </T>
                    </Bouncy>
                  );
                })}
              </View>
            )
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {header}
          {tab === 'milestones' ? <MilestonesView milestones={milestones} open={open} /> : <OnThisDayView items={otd} open={open} />}
        </ScrollView>
      )}
      </Column>
    </View>
  );
}

function MilestonesView({ milestones, open }: { milestones: Moment[]; open: (m: Moment) => void }) {
  const { pet } = useApp();
  if (!pet) return null;
  const today = dayKeyOf(new Date());
  const birthday = nextAnniversary('birthday', pet.birthDate, today);
  const gotcha = nextAnniversary('adoption', pet.adoptionDate, today);
  const have = new Set(milestones.map((m) => m.milestone));
  const suggestions = MILESTONES.filter((k) => !have.has(k) && k !== 'custom' && k !== 'holiday' && k !== 'special').slice(0, 4);
  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      {birthday ? <Upcoming emoji="🎂" title={t('{name} turns {n}', { name: pet.name, n: birthday.years })} day={birthday.day} days={birthday.daysAway} /> : null}
      {gotcha ? <Upcoming emoji="💛" title={tn(gotcha.years, '{n} year together', '{n} years together')} day={gotcha.day} days={gotcha.daysAway} /> : null}
      {!pet.birthDate && !pet.adoptionDate ? (
        <Bouncy accessibilityRole="button" accessibilityLabel={t('Add birthday')} onPress={() => router.push({ pathname: '/pet', params: { id: pet.id } })} style={styles.hintCard}>
          <T weight="xbold" style={{ color: colors.inkSoft, fontSize: 14 }}>
            {t("Add {name}'s birthday or adoption day to celebrate milestones →", { name: pet.name })}
          </T>
        </Bouncy>
      ) : null}

      {milestones.length ? (
        <View style={{ marginTop: 6 }}>
          {milestones.map((m, i) => {
            const label = momentLabel(m, t);
            return (
              <Bouncy key={m.id} accessibilityRole="button" accessibilityLabel={`${label}, ${formatDateLong(m.date)}`} onPress={() => open(m)} style={styles.tl} scaleTo={0.98}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlLine, i === 0 && { top: 28 }, i === milestones.length - 1 && { bottom: '50%' }]} />
                  <View style={styles.tlDot}>
                    <T style={{ fontSize: 16 }}>{m.milestone ? MILESTONE_EMOJI[m.milestone] : '★'}</T>
                  </View>
                </View>
                <View style={{ flex: 1, paddingVertical: 10 }}>
                  <T weight="black" style={{ fontSize: 16 }} numberOfLines={1}>
                    {label}
                  </T>
                  <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
                    {formatDateLong(m.date)}
                  </T>
                </View>
                {m.photoUri ? <MomentThumb m={m} size={56} radius={14} species={pet.species} /> : null}
              </Bouncy>
            );
          })}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 14, gap: 6 }}>
          <Sticker name={moodSticker(pet.species, 'trophy')} size={110} />
          <T weight="black" style={{ fontSize: 17 }}>
            {t('Big days live here')}
          </T>
          <T style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{t('Mark a moment as a milestone and it joins {name}’s timeline.', { name: pet.name })}</T>
        </View>
      )}

      {suggestions.length ? (
        <View style={{ gap: 8, marginTop: 4 }}>
          <T weight="black" style={{ fontSize: 15, color: colors.inkSoft }}>
            {t('Add a milestone')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...suggestions, 'custom' as const].map((k) => (
              <Bouncy key={k} accessibilityRole="button" accessibilityLabel={t(MILESTONE_LABEL[k])} onPress={() => router.push({ pathname: '/memory', params: { milestone: k } })} style={styles.sugg}>
                <T weight="black" style={{ fontSize: 13.5, color: MEM_COLORS.warmInk }}>
                  {MILESTONE_EMOJI[k]} {t(MILESTONE_LABEL[k])}
                </T>
              </Bouncy>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function OnThisDayView({ items, open }: { items: { years: number; moment: Moment }[]; open: (m: Moment) => void }) {
  const { pet } = useApp();
  const { width } = useWindowDimensions();
  if (!pet) return null;
  const w = Math.min(width, 560) - 40;
  if (!items.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
        <Sticker name={moodSticker(pet.species, 'sleep')} size={110} />
        <T weight="black" style={{ fontSize: 17 }}>
          {t('Nothing from this day yet')}
        </T>
        <T style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>{t('Photos you add today will come back here next year.')}</T>
      </View>
    );
  }
  return (
    <View style={{ gap: 16, marginTop: 10 }}>
      {items.map(({ years, moment }) => (
        <Bouncy key={moment.id} accessibilityRole="imagebutton" accessibilityLabel={tn(years, '1 year ago today', '{n} years ago today')} onPress={() => open(moment)} scaleTo={0.98}>
          <MomentThumb m={moment} size={{ w, h: w * 0.75 }} radius={24} species={pet.species} />
          <View style={styles.otdTag}>
            <T weight="black" style={{ fontSize: 14 }}>
              {tn(years, '1 year ago today', '{n} years ago today')}
            </T>
          </View>
          {momentLabel(moment, t) ? (
            <T weight="black" style={{ fontSize: 16, marginTop: 8 }}>
              {momentLabel(moment, t)}
            </T>
          ) : null}
        </Bouncy>
      ))}
    </View>
  );
}

function Upcoming({ emoji, title, day, days }: { emoji: string; title: string; day: string; days: number }) {
  const when = days === 0 ? t('Today!') : days === 1 ? t('Tomorrow') : tn(days, 'in {n} day', 'in {n} days');
  return (
    <View style={styles.milestone} accessibilityLabel={`${title}, ${when}`}>
      <T style={{ fontSize: 26 }}>{emoji}</T>
      <View style={{ flex: 1 }}>
        <T weight="black" style={{ fontSize: 16 }}>
          {title}
        </T>
        <T style={{ color: colors.muted, fontSize: 13 }}>{formatDateLong(day)}</T>
      </View>
      <T weight="black" style={{ color: days === 0 ? '#E58A00' : colors.brand, fontSize: 14 }}>
        {when}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  entry: { flex: 1.6, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 22 },
  story: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 22, backgroundColor: colors.brandSoft },
  seg: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 4, marginTop: 18 },
  segBtn: { flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#FFFFFF', shadowColor: '#23304A', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.card },
  monthHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  tag: { position: 'absolute', top: 6, left: 6, backgroundColor: '#FFFFFFE6', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  tileDay: { position: 'absolute', bottom: 6, left: 8, color: '#FFFFFF', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4 },
  hintCard: { padding: 14, borderRadius: 18, backgroundColor: colors.canvasWarm, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: '#FFF8EC' },
  tl: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  tlRail: { width: 36, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  tlLine: { position: 'absolute', top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: '#FFE2B8' },
  tlDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: MEM_COLORS.warm, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  sugg: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: MEM_COLORS.warm },
  otdTag: { position: 'absolute', top: 12, left: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
