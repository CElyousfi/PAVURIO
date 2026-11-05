/**
 * iOS home-screen and Lock Screen widgets (WidgetKit through expo-widgets) and the care Live Activity.
 *
 * - "Pavurio" (PavurioToday): the one scene that matters right now (domain/widgets.ts), drawn with the
 *   app's own illustrations, with a timeline for the next 24 hours so it changes on its own: the walk
 *   becomes due, medicine time, the evening photo, night. Small, medium and Lock Screen sizes.
 * - "Pantry" (PavurioPantry): what's on the shelf and how long it lasts.
 * - Care Live Activity (PavurioCare): when an important care (medicine, a meal, a walk) is coming up
 *   within the hour, a countdown on the Lock Screen and in the Dynamic Island with a Done button.
 *
 * Layout functions run inside the widget extension: they only see their props and the environment.
 */
import React from 'react';
import { Button, HStack, Image, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  minimumScaleFactor,
  padding,
  progressViewStyle,
  resizable,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { addUserInteractionListener, createLiveActivity, createWidget } from 'expo-widgets';
import type { Db } from '../../data/db';
import { getPortions, logCare } from '../../data/repo';
import { listSchedules } from '../../data/careRepo';
import { confirmOccurrence } from '../../features/careLink';
import { buildTimeline } from '../../domain/widgets';
import { CARE, isCareType } from '../../domain/care';
import { portionOf } from '../../domain/progress';
import { t } from '../../i18n';
import { widgetArt } from './art';
import { emptyPantryLine, loadWidgetData, pantryTitle, widgetTime } from './data';
import type { CareLiveProps, PantryProps, TodayProps } from './types';

export const widgetsSupported = true;

// ------------------------------------------------------------------ Today

const TodayWidget = createWidget<TodayProps>('PavurioToday', (p: TodayProps, env) => {
  'widget';
  const family = env.widgetFamily ?? 'systemSmall';
  const url = `pavurio://${p.route}`;
  const countdown =
    p.countdownTo > 0 ? <Text date={new Date(p.countdownTo)} dateStyle="relative" modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(p.accent)]} /> : null;
  const bar =
    p.progressLabel !== '' ? (
      <VStack alignment="leading" spacing={3}>
        <ProgressView value={p.progress} modifiers={[progressViewStyle('linear'), tint(p.accent)]} />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#6B7280')]}>{p.progressLabel}</Text>
      </VStack>
    ) : null;

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[widgetURL(url)]}>
        <ProgressView value={p.progress} modifiers={[progressViewStyle('circular')]} />
        <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' })]}>{p.short}</Text>
      </ZStack>
    );
  }
  if (family === 'accessoryInline') {
    return <Text modifiers={[widgetURL(url)]}>{p.inline}</Text>;
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(url)]}>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), minimumScaleFactor(0.8)]}>{p.title}</Text>
        <Text modifiers={[font({ size: 12 }), minimumScaleFactor(0.8)]}>{p.body}</Text>
        {p.progressLabel !== '' ? <ProgressView value={p.progress} modifiers={[progressViewStyle('linear')]} /> : null}
      </VStack>
    );
  }
  const art = p.art !== '' ? <Image uiImage={p.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} /> : null;
  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 12 }), containerBackground(p.tint, 'widget'), widgetURL(url)]}>
        <HStack>
          <Spacer />
          <VStack modifiers={[frame({ height: 64 })]}>{art}</VStack>
          <Spacer />
        </HStack>
        <Text modifiers={[font({ size: 14, weight: 'heavy', design: 'rounded' }), minimumScaleFactor(0.75)]}>{p.title}</Text>
        {countdown ?? <Text modifiers={[font({ size: 11 }), foregroundStyle('#6B7280'), minimumScaleFactor(0.8)]}>{p.body}</Text>}
        {bar}
      </VStack>
    );
  }
  return (
    <HStack spacing={12} modifiers={[padding({ all: 14 }), containerBackground(p.tint, 'widget'), widgetURL(url)]}>
      <VStack modifiers={[frame({ width: 118 })]}>{art}</VStack>
      <VStack alignment="leading" spacing={5}>
        <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(p.accent)]}>{p.petName}</Text>
        <Text modifiers={[font({ size: 17, weight: 'heavy', design: 'rounded' }), minimumScaleFactor(0.75)]}>{p.title}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#4B5563'), minimumScaleFactor(0.8)]}>{p.body}</Text>
        {countdown}
        <Spacer />
        {bar}
      </VStack>
    </HStack>
  );
});

// ------------------------------------------------------------------ Pantry

const PantryWidget = createWidget<PantryProps>('PavurioPantry', (p: PantryProps, env) => {
  'widget';
  const small = env.widgetFamily === 'systemSmall';
  const rows = p.items.slice(0, small ? 2 : 3).map((it, i) => (
    <VStack key={String(i)} alignment="leading" spacing={2}>
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), minimumScaleFactor(0.8)]}>{it.name}</Text>
        <Spacer />
        {small ? null : <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(it.color)]}>{it.label}</Text>}
      </HStack>
      <ProgressView value={it.level} modifiers={[progressViewStyle('linear'), tint(it.color)]} />
      {small ? <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(it.color), minimumScaleFactor(0.8)]}>{it.label}</Text> : null}
    </VStack>
  ));
  return (
    <HStack spacing={12} modifiers={[padding({ all: 14 }), containerBackground('#FFF6EC', 'widget'), widgetURL('pavurio://supplies')]}>
      {small ? null : (
        <VStack modifiers={[frame({ width: 104 })]}>
          {p.art !== '' ? <Image uiImage={p.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} /> : null}
        </VStack>
      )}
      <VStack alignment="leading" spacing={8}>
        <Text modifiers={[font({ size: 14, weight: 'heavy', design: 'rounded' }), foregroundStyle('#E26A00')]}>{p.title}</Text>
        {p.items.length ? rows : <Text modifiers={[font({ size: 12 }), foregroundStyle('#6B7280')]}>{p.empty}</Text>}
        <Spacer />
      </VStack>
    </HStack>
  );
});

// ------------------------------------------------------------------ care Live Activity

const CareActivity = createLiveActivity<CareLiveProps>('PavurioCare', (p: CareLiveProps) => {
  'widget';
  const when = <Text date={new Date(p.at)} dateStyle="relative" modifiers={[font({ size: 15, weight: 'heavy', design: 'rounded' }), foregroundStyle(p.accent)]} />;
  const done = <Button target="done" label={p.doneLabel} modifiers={[buttonStyle('borderedProminent'), tint(p.accent)]} />;
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 14 })]}>
        {p.art !== '' ? (
          <VStack modifiers={[frame({ width: 64, height: 64 })]}>
            <Image uiImage={p.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} />
          </VStack>
        ) : null}
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ size: 15, weight: 'bold', design: 'rounded' })]}>{p.title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#6B7280')]}>{p.body}</Text>
          {when}
        </VStack>
        <Spacer />
        {done}
      </HStack>
    ),
    compactLeading: <Text>{p.emoji}</Text>,
    compactTrailing: <Text date={new Date(p.at)} dateStyle="timer" modifiers={[foregroundStyle(p.accent)]} />,
    minimal: <Text>{p.emoji}</Text>,
    expandedLeading: (
      <VStack modifiers={[frame({ width: 52, height: 52 })]}>{p.art !== '' ? <Image uiImage={p.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} /> : <Text>{p.emoji}</Text>}</VStack>
    ),
    expandedTrailing: when,
    expandedBottom: (
      <HStack>
        <VStack alignment="leading">
          <Text modifiers={[font({ size: 15, weight: 'bold' })]}>{p.title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#9CA3AF')]}>{p.body}</Text>
        </VStack>
        <Spacer />
        {done}
      </HStack>
    ),
  };
});

const EMOJI: Record<string, string> = { meal: '🍽️', walk: '🐾', water: '💧', medication: '💊', grooming: '✨', play: '🎾', litter: '🧹' };
const LIVE_TYPES = new Set(['medication', 'meal', 'walk']);
const LIVE_BEFORE = 60 * 60_000;
const LIVE_AFTER = 2 * 3_600_000;
let careKey: string | null = null;
let carePet: string | null = null;

// ------------------------------------------------------------------ sync

let running: Promise<void> | null = null;
let again = false;

/** Rebuild everything the widgets and the care Live Activity show. Coalesced; safe to call often. */
export function syncWidgets(db: Db): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      const now = Date.now();
      const [art, data] = await Promise.all([widgetArt().catch(() => ({}) as Record<string, string>), loadWidgetData(db, now)]);
      if (!data) {
        TodayWidget.updateSnapshot(emptyToday());
        PantryWidget.updateSnapshot({ title: pantryTitle(), items: [], empty: emptyPantryLine(), art: art.pantry ?? '' });
        await endCareLive();
        return;
      }
      const timeline = buildTimeline(data.input, now, widgetTime);
      TodayWidget.updateTimeline(
        timeline.map((e) => ({
          date: new Date(e.at),
          props: {
            petName: data.input.petName,
            title: e.scene.title,
            body: e.scene.body,
            progress: e.scene.progress,
            progressLabel: e.scene.progressLabel,
            countdownTo: e.scene.countdownTo,
            route: e.scene.route,
            accent: e.scene.accent,
            tint: e.scene.tint,
            art: art[e.scene.art] ?? '',
            short: e.scene.progressLabel ? `${Math.round(e.scene.progress * 100)}%` : '🐾',
            inline: e.scene.countdownTo ? `${e.scene.title} · ${widgetTime(e.scene.countdownTo)}` : e.scene.title,
          },
        })),
      );
      PantryWidget.updateSnapshot({ title: pantryTitle(), items: data.pantry, empty: emptyPantryLine(), art: art.pantry ?? '' });
      await syncCareLive(data, art);
    } catch (e) {
      console.warn('[pavurio] widgets', e);
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncWidgets(db);
    }
  });
  return running;
}

function emptyToday(): TodayProps {
  return { petName: 'Pavurio', title: t('Add your pet to get started'), body: '', progress: 0, progressLabel: '', countdownTo: 0, route: '', accent: '#14B8C4', tint: '#E4F7F8', art: '', short: '🐾', inline: 'Pavurio' };
}

/** Start, update or end the care countdown so it always matches the next important care. */
async function syncCareLive(data: NonNullable<Awaited<ReturnType<typeof loadWidgetData>>>, art: Record<string, string>) {
  const now = Date.now();
  const n = data.next;
  const show = n && LIVE_TYPES.has(n.type) && n.at - now <= LIVE_BEFORE && now - n.at <= LIVE_AFTER;
  if (!show) return endCareLive();
  const name = data.input.petName;
  const label = isCareType(n.type) ? CARE[n.type].label : n.title;
  const props: CareLiveProps = {
    key: n.key,
    type: n.type,
    title: n.type === 'medication' ? t('Medicine time for {name} 💊', { name }) : n.type === 'walk' ? t('{name} is ready for a walk 🐾', { name }) : t('{name} is getting hungry 🍽️', { name }),
    body: `${n.title} · ${widgetTime(n.at)}`,
    at: n.at,
    art: art[n.type === 'walk' ? 'walk' : n.type === 'meal' ? 'pantry' : 'care'] ?? '',
    emoji: EMOJI[n.type] ?? '🐾',
    accent: n.type === 'medication' ? '#E5484D' : '#14B8C4',
    doneLabel: n.type === 'medication' ? t('Given ✓') : t('Done'),
    label,
  };
  try {
    const cur = CareActivity.getInstances()[0];
    if (cur && careKey === n.key) await cur.update(props, new Date(n.at + LIVE_AFTER));
    else {
      if (cur) await cur.end('immediate');
      CareActivity.start(props, n.type === 'walk' && data.input.species === 'dog' ? 'pavurio://walk' : `pavurio://log/${n.type}`);
      careKey = n.key;
      carePet = data.petId;
    }
  } catch (e) {
    console.warn('[pavurio] care live activity', e);
  }
}

async function endCareLive() {
  try {
    for (const a of CareActivity.getInstances()) await a.end('immediate');
  } catch {
    /* nothing running */
  }
  careKey = null;
}

/**
 * "Done" on the care Live Activity: log the care for the right pet (idempotent with the reminder's
 * own Done, same key), tick the routine, and refresh.
 */
export function listenToWidgetActions(db: Db, onChange: () => void): () => void {
  const sub = addUserInteractionListener(async (e) => {
    if (e.source !== 'PavurioCare' || e.target !== 'done' || !careKey || !carePet) return;
    const key = careKey;
    try {
      const schedules = await listSchedules(db, carePet);
      const sch = schedules.find((s) => key.startsWith(`${s.id}@`));
      const ct = sch?.type ?? null;
      if (!ct || !isCareType(ct)) return;
      const portions = await getPortions(db, carePet);
      const saved = await logCare(db, { petId: carePet, type: ct, occurredAt: Date.now(), amount: CARE[ct].amount ? portionOf(ct, portions) : null, mutationId: `notif:${key}` });
      if (sch) await confirmOccurrence(db, schedules, saved, { scheduleId: sch.id, key }).catch(() => null);
      await endCareLive();
      onChange();
    } catch (err) {
      console.warn('[pavurio] live activity done', err);
    }
  });
  return () => sub.remove();
}
