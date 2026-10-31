import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetRig, PetClipName } from '../animation/PetRig';
import { getSetting, logCare, setSetting, ValidationError } from '../data/repo';
import { newId } from '../domain/ids';
import { careAllowedFor } from '../domain/care';
import { confirmOccurrence } from '../features/careLink';
import { bumpCounter } from '../data/engageRepo';
import { useApp } from '../state/AppState';
import { ScreenHeader } from '../ui/forms';
import { Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, tapFeedback } from '../native/haptics';
import { confirmAsync } from '../ui/confirm';
import { t } from '../i18n';

/** Persisted so a walk keeps timing if the app is closed or the phone locks. */
type TimerState = { startedAt: number; pausedAt: number | null; pausedMs: number };
const KEY = 'walkTimer';

function elapsed(t: TimerState | null, now: number) {
  if (!t) return 0;
  return Math.max(0, (t.pausedAt ?? now) - t.startedAt - t.pausedMs);
}
function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function WalkTimer() {
  const { pet, db, bump, schedules, signalLogged, reduceMotion } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [timer, setT] = useState<TimerState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ name: PetClipName; nonce: number } | null>(null);
  const mutationId = useRef(newId());

  useEffect(() => {
    getSetting(db, KEY).then((raw) => {
      try {
        if (raw) setT(JSON.parse(raw));
      } catch {
        /* ignore a corrupt value */
      }
      setLoaded(true);
    });
  }, [db]);

  const running = !!timer && timer.pausedAt == null;
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [running]);

  // the dog walks along while the timer runs
  useEffect(() => {
    if (running && pet?.species === 'dog' && !reduceMotion) setClip({ name: 'walk', nonce: Date.now() });
    else setClip(null);
  }, [running, pet?.species, reduceMotion]);

  const persist = async (next: TimerState | null) => {
    setT(next);
    setNow(Date.now());
    await setSetting(db, KEY, next ? JSON.stringify(next) : '');
  };

  if (!pet || !loaded) return null;
  if (!careAllowedFor(pet.species, 'walk')) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, alignItems: 'center' }]}>
        <T weight="black" style={{ fontSize: 20 }}>
          {t('Walks are for dogs.')}
        </T>
        <Pill label={t('BACK')} onPress={() => router.back()} style={{ marginTop: 20 }} />
      </View>
    );
  }

  const ms = elapsed(timer, now);
  const start = () => {
    tapFeedback();
    mutationId.current = newId();
    void persist({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  };
  const pause = () => {
    tapFeedback();
    if (!timer) return;
    void persist(timer.pausedAt == null ? { ...timer, pausedAt: Date.now() } : { ...timer, pausedMs: timer.pausedMs + (Date.now() - timer.pausedAt), pausedAt: null });
  };
  const discard = async () => {
    if (!(await confirmAsync(t('Discard this walk?'), t('Nothing will be saved.'), t('Discard')))) return;
    await persist(null);
  };
  const finish = async () => {
    if (!timer || saving) return;
    setSaving(true);
    setError(null);
    try {
      const minutes = Math.max(1, Math.round(ms / 60_000));
      const saved = await logCare(db, { petId: pet.id, type: 'walk', occurredAt: timer.startedAt, amount: minutes, note: null, mutationId: mutationId.current });
      await confirmOccurrence(db, schedules, saved).catch(() => null);
      await persist(null);
      await bumpCounter(db, `walksTimed:${pet.id}`);
      bump();
      signalLogged({ eventId: saved.id, type: 'walk' });
      router.dismissTo('/');
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : t('Could not save the walk. Please try again.'));
      errorFeedback();
      setSaving(false);
    }
  };

  const petSize = Math.min(width * 0.8, height * 0.36, 340);
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1 }}>
        <ScreenHeader title={t('Walk')} onClose={() => router.back()} />
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <Label>{!timer ? t('Ready when you are') : running ? t('Walking with {name}', { name: pet.name }) : t('Paused')}</Label>
          <T weight="black" style={styles.clock} accessibilityRole="timer" accessibilityLabel={t('Elapsed {time}', { time: clock(ms) })}>
            {clock(ms)}
          </T>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PetRig
            species={pet.species}
            appearance={pet.appearance}
            size={petSize}
            progress={1}
            clip={clip}
            onClipEnd={() => (running ? setClip({ name: 'walk', nonce: Date.now() }) : setClip(null))}
            active
            reduceMotion={reduceMotion}
            accessibilityLabel={pet.name}
          />
        </View>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {error ? (
            <T weight="xbold" style={{ color: colors.danger, textAlign: 'center' }}>
              {error}
            </T>
          ) : null}
          {!timer ? (
            <Pill label={t('START WALK')} color="#58C322" onPress={start} testID="walk-start" />
          ) : (
            <>
              <Pill label={t('FINISH · {n} MIN', { n: Math.max(1, Math.round(ms / 60_000)) })} color="#58C322" onPress={finish} loading={saving} testID="walk-finish" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SoftPill label={running ? t('Pause') : t('Resume')} color="#3E8E17" tint="#E6F7DA" onPress={pause} style={{ flex: 1 }} />
                <SoftPill label={t('Discard')} color={colors.danger} tint={colors.dangerSoft} onPress={discard} style={{ flex: 1 }} />
              </View>
            </>
          )}
          <T style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>{t('The timer keeps going if you close the app.')}</T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  clock: { fontSize: 72, lineHeight: 80, color: '#58C322', letterSpacing: -1, fontVariant: ['tabular-nums'] },
});
