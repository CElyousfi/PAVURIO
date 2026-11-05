/**
 * iOS: a Live Activity on the Lock Screen and in the Dynamic Island. The elapsed time is a SwiftUI timer
 * (`Text` with `timerInterval`), so it ticks on its own with no updates from the app; `pauseTime` freezes it
 * while paused. Pause / Resume / Finish buttons send an interaction event to the app (expo-widgets runs them
 * as App Intents); the app applies it to the walk and updates the activity. Tapping the activity opens the walk.
 * Known limit: if iOS has fully terminated Pavurio, a button press may not reach it — the walk keeps timing
 * and can be paused or finished in the app.
 */
import React from 'react';
import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { aspectRatio, buttonStyle, font, foregroundStyle, frame, monospacedDigit, padding, resizable, tint } from '@expo/ui/swift-ui/modifiers';
import { addUserInteractionListener, createLiveActivity, type LiveActivity } from 'expo-widgets';
import type { WalkLiveAction, WalkLiveProps } from './types';
export type { WalkLiveAction, WalkLiveProps } from './types';

const WalkActivity = createLiveActivity<WalkLiveProps>('PavurioWalk', (props: WalkLiveProps) => {
  'widget';
  const paused = props.status === 'paused';
  const finished = props.status === 'finished';
  // the timer counts from the start shifted by the time spent paused, frozen at the pause
  const from = new Date(props.startedAt + props.pausedMs);
  const timer = finished ? (
    <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.finishedText}</Text>
  ) : (
    <Text
      timerInterval={{ lower: from, upper: new Date(from.getTime() + 12 * 3600 * 1000) }}
      countsDown={false}
      pauseTime={paused && props.pausedAt != null ? new Date(props.pausedAt) : undefined}
      modifiers={[font({ size: 34, weight: 'heavy', design: 'rounded' }), monospacedDigit(), foregroundStyle('#14B8C4')]}
    />
  );
  const buttons = finished ? null : (
    <HStack spacing={10}>
      <Button
        target={paused ? 'resume' : 'pause'}
        label={paused ? props.resume : props.pause}
        modifiers={[buttonStyle('bordered'), tint('#14B8C4')]}
      />
      <Button target="finish" label={props.finish} modifiers={[buttonStyle('borderedProminent'), tint('#14B8C4')]} />
    </HStack>
  );
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
        {props.art ? (
          <HStack>
            <Spacer />
            <VStack modifiers={[frame({ height: 58 })]}>
              <Image uiImage={props.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} />
            </VStack>
            <Spacer />
          </HStack>
        ) : null}
        <HStack>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 15, weight: 'bold', design: 'rounded' })]}>{finished ? props.title : paused ? props.pausedText : props.walking}</Text>
            <Text modifiers={[font({ size: 13 }), foregroundStyle('#6B7280')]}>{props.since}</Text>
          </VStack>
          <Spacer />
          {timer}
        </HStack>
        {buttons}
      </VStack>
    ),
    compactLeading: <Text>🐾</Text>,
    compactTrailing: finished ? (
      <Text>✓</Text>
    ) : (
      <Text
        timerInterval={{ lower: from, upper: new Date(from.getTime() + 12 * 3600 * 1000) }}
        countsDown={false}
        pauseTime={paused && props.pausedAt != null ? new Date(props.pausedAt) : undefined}
        modifiers={[monospacedDigit(), foregroundStyle('#14B8C4')]}
      />
    ),
    minimal: <Text>🐾</Text>,
    expandedLeading: <Text modifiers={[font({ size: 15, weight: 'bold' })]}>{props.petName}</Text>,
    expandedTrailing: timer,
    expandedBottom: buttons ?? <Text>{props.finishedText}</Text>,
  };
});

let current: LiveActivity<WalkLiveProps> | null = null;
let lastProps: WalkLiveProps | null = null;

function instance(): LiveActivity<WalkLiveProps> | null {
  if (current) return current;
  try {
    current = WalkActivity.getInstances()[0] ?? null;
  } catch {
    current = null;
  }
  return current;
}

export const walkLiveSupported = true;

export async function showWalkLive(props: WalkLiveProps): Promise<void> {
  try {
    lastProps = props;
    const cur = instance();
    if (cur) await cur.update(props);
    else current = WalkActivity.start(props, 'pavurio://walk');
  } catch (e) {
    console.warn('[pavurio] live activity failed', e);
  }
}

export async function endWalkLive(): Promise<void> {
  try {
    for (const a of WalkActivity.getInstances()) await a.end('immediate');
  } catch {
    /* nothing to end */
  }
  current = null;
  lastProps = null;
}

/** iOS can't read an activity's props back: presses reach the app through the interaction event. */
export async function readWalkLive(_walkId: string): Promise<WalkLiveProps | null> {
  return null;
}

export function onWalkLiveAction(cb: (action: WalkLiveAction, walkId: string, at: number) => void): () => void {
  const sub = addUserInteractionListener((e) => {
    if (e.source !== 'PavurioWalk') return;
    const action: WalkLiveAction | null = e.target === 'finish' ? 'finish' : e.target === 'pause' ? 'pause' : e.target === 'resume' ? 'resume' : null;
    if (!action) return;
    cb(action, lastProps?.walkId ?? '', e.timestamp);
  });
  return () => sub.remove();
}
