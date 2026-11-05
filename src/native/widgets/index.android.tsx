/**
 * Android home-screen widgets (Glance through expo-widgets): the same smart "Pavurio" scene and the
 * Pantry, with the app's illustrations. Android has no timelines, so the scene is refreshed whenever the
 * app syncs (every data change, every return to the app, and the periodic background task).
 * A tap anywhere opens the matching screen: the whole widget is one button whose target the widget
 * provider turns into a deep link (plugins/withWidgetTapOpens.js).
 */
import React from 'react';
import { Box, Button, Column, Image, LinearProgressIndicator, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, fillMaxWidth, height, paddingAll, size, weight, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';
import type { Db } from '../../data/db';
import { sceneAt } from '../../domain/widgets';
import { t } from '../../i18n';
import { widgetArt } from './art';
import { emptyPantryLine, loadWidgetData, pantryTitle, widgetTime } from './data';
import type { PantryProps, TodayProps } from './types';

export const widgetsSupported = true;

const TodayWidget = createWidget<TodayProps>('PavurioToday', (p: TodayProps) => {
  'widget';
  return (
    <Button {...({ target: `open:${p.route}` } as object)} modifiers={[fillMaxSize()]}>
      <Row verticalAlignment="center" modifiers={[fillMaxSize(), background(p.tint), paddingAll(12)]}>
        {p.art !== '' ? <Image source={{ uri: p.art }} contentScale="fit" modifiers={[size(84, 84)]} /> : null}
        <Spacer modifiers={[width(10)]} />
        <Column modifiers={[weight(1)]}>
          <Text color={p.accent} style={{ fontWeight: 'bold', fontSize: 12 }}>
            {p.petName}
          </Text>
          <Text maxLines={2} style={{ fontWeight: 'bold', fontSize: 16 }}>
            {p.title}
          </Text>
          <Text maxLines={2} color="#4B5563" style={{ fontSize: 13 }}>
            {p.body}
          </Text>
          {p.progressLabel !== '' ? (
            <Column modifiers={[fillMaxWidth()]}>
              <Spacer modifiers={[height(6)]} />
              <LinearProgressIndicator progress={p.progress} color={p.accent} modifiers={[fillMaxWidth()]} />
              <Text color="#6B7280" style={{ fontSize: 11 }}>
                {p.progressLabel}
              </Text>
            </Column>
          ) : null}
        </Column>
      </Row>
    </Button>
  );
});

const PantryWidget = createWidget<PantryProps>('PavurioPantry', (p: PantryProps) => {
  'widget';
  return (
    <Button {...({ target: 'open:supplies' } as object)} modifiers={[fillMaxSize()]}>
      <Row verticalAlignment="center" modifiers={[fillMaxSize(), background('#FFF6EC'), paddingAll(12)]}>
        {p.art !== '' ? <Image source={{ uri: p.art }} contentScale="fit" modifiers={[size(72, 72)]} /> : null}
        <Spacer modifiers={[width(10)]} />
        <Column modifiers={[weight(1)]}>
          <Text color="#E26A00" style={{ fontWeight: 'bold', fontSize: 14 }}>
            {p.title}
          </Text>
          {p.items.length ? (
            p.items.map((it, i) => (
              <Column key={String(i)} modifiers={[fillMaxWidth()]}>
                <Spacer modifiers={[height(4)]} />
                <Row modifiers={[fillMaxWidth()]}>
                  <Text maxLines={1} style={{ fontWeight: 'bold', fontSize: 13 }} modifiers={[weight(1)]}>
                    {it.name}
                  </Text>
                  <Text maxLines={1} color={it.color} style={{ fontSize: 12 }}>
                    {it.label}
                  </Text>
                </Row>
                <LinearProgressIndicator progress={it.level} color={it.color} modifiers={[fillMaxWidth()]} />
              </Column>
            ))
          ) : (
            <Box>
              <Text color="#6B7280" style={{ fontSize: 12 }}>
                {p.empty}
              </Text>
            </Box>
          )}
        </Column>
      </Row>
    </Button>
  );
});

let running: Promise<void> | null = null;

export function syncWidgets(db: Db): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      const now = Date.now();
      const [art, data] = await Promise.all([widgetArt().catch(() => ({}) as Record<string, string>), loadWidgetData(db, now)]);
      if (!data) {
        TodayWidget.updateSnapshot({ petName: 'Pavurio', title: t('Add your pet to get started'), body: '', progress: 0, progressLabel: '', countdownTo: 0, route: '', accent: '#14B8C4', tint: '#E4F7F8', art: '', short: '', inline: '' });
        return;
      }
      const s = sceneAt(data.input, now, widgetTime, true);
      TodayWidget.updateSnapshot({
        petName: data.input.petName,
        title: s.title,
        body: s.countdownTo ? `${s.body}` : s.body,
        progress: s.progress,
        progressLabel: s.progressLabel,
        countdownTo: s.countdownTo,
        route: s.route,
        accent: s.accent,
        tint: s.tint,
        art: art[s.art] ?? '',
        short: '',
        inline: '',
      });
      PantryWidget.updateSnapshot({ title: pantryTitle(), items: data.pantry, empty: emptyPantryLine(), art: art.pantry ?? '' });
    } catch (e) {
      console.warn('[pavurio] widgets', e);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Android has no care Live Activity: its reminders are notifications with a Done action. */
export function listenToWidgetActions(_db: Db, _onChange: () => void): () => void {
  return () => {};
}
