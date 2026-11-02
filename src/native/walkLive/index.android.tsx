/**
 * Android: an ongoing notification (expo-widgets custom notification, Jetpack Compose layout) with
 * Pause / Resume / Finish buttons that work from the lock screen without opening the app. Each press is
 * handled natively by the layout below and stored in the notification's props with its timestamp; the app
 * applies it to the walk when it runs (immediately if it's alive, via the interaction event).
 */
import React from 'react';
import { Button, Column, Row, Text } from '@expo/ui/jetpack-compose';
import { padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { addUserInteractionListener, createCustomNotification } from 'expo-widgets';
import type { WalkLiveAction, WalkLiveProps } from './types';
export type { WalkLiveAction, WalkLiveProps } from './types';

const WalkNotification = createCustomNotification<WalkLiveProps>('PavurioWalk', (props: WalkLiveProps) => {
  'widget';
  const paused = props.status === 'paused';
  const finished = props.status === 'finished';
  const mins = (end: number) => Math.max(0, Math.round((end - props.startedAt - props.pausedMs) / 60000));
  const line = finished ? props.finishedText : paused && props.pausedAt != null ? `${props.pausedText} · ${mins(props.pausedAt)} min` : props.since;
  const head = (
    <Column modifiers={[weight(1)]}>
      <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{finished ? props.title : paused ? props.pausedText : props.walking}</Text>
      <Text style={{ fontSize: 13 }} color="#6B7280">
        {line}
      </Text>
    </Column>
  );
  const buttons = finished ? null : (
    <Row horizontalArrangement={{ spacedBy: 8 }}>
      <Button
        onClick={
          (() =>
            paused
              ? { status: 'active', pausedAt: null, pausedMs: props.pausedMs + Math.max(0, Date.now() - (props.pausedAt ?? Date.now())) }
              : { status: 'paused', pausedAt: Date.now() }) as unknown as () => void
        }
        colors={{ containerColor: '#E6F7F8', contentColor: '#0E8F98' }}
      >
        <Text>{paused ? props.resume : props.pause}</Text>
      </Button>
      <Button onClick={(() => ({ status: 'finished', finishAt: Date.now() })) as unknown as () => void} colors={{ containerColor: '#14B8C4', contentColor: '#FFFFFF' }}>
        <Text>{props.finish}</Text>
      </Button>
    </Row>
  );
  return {
    collapsed: (
      <Row verticalAlignment="center" modifiers={[padding(12, 8, 12, 8)]}>
        {head}
        {buttons}
      </Row>
    ),
    expanded: (
      <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[padding(14, 12, 14, 12)]}>
        <Row verticalAlignment="center">{head}</Row>
        {buttons}
      </Column>
    ),
  };
});

const ID = 'pavurio-walk';
export const walkLiveSupported = true;

export async function showWalkLive(props: WalkLiveProps): Promise<void> {
  try {
    const cur = await WalkNotification.get(ID);
    if (cur) await cur.update(props, { ongoing: props.status !== 'finished', autoCancel: props.status === 'finished' });
    else await WalkNotification.post(props, { id: ID, ongoing: true, title: props.walking, text: props.since, url: 'pavurio://walk', channelId: 'walk-live', alertOnlyOnce: true });
  } catch (e) {
    console.warn('[pavurio] walk notification failed', e);
  }
}

export async function endWalkLive(): Promise<void> {
  try {
    await WalkNotification.cancelAll();
  } catch {
    /* nothing to end */
  }
}

/** What the lock screen did while the app wasn't looking (null when no walk notification is up). */
export async function readWalkLive(walkId: string): Promise<WalkLiveProps | null> {
  try {
    const cur = await WalkNotification.get(ID);
    if (!cur) return null;
    const p = await cur.getProps();
    return p.walkId === walkId ? p : null;
  } catch {
    return null;
  }
}

export function onWalkLiveAction(cb: (action: WalkLiveAction, walkId: string, at: number) => void): () => void {
  const sub = addUserInteractionListener(async (e) => {
    if (e.source !== 'PavurioWalk') return;
    const cur = await WalkNotification.get(ID).catch(() => null);
    const p = cur ? await cur.getProps().catch(() => null) : null;
    if (!p) return;
    const action: WalkLiveAction = p.status === 'finished' ? 'finish' : p.status === 'paused' ? 'pause' : 'resume';
    cb(action, p.walkId, e.timestamp);
  });
  return () => sub.remove();
}
