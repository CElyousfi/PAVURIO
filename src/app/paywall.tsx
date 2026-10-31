import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PetAvatar } from '../animation/PetAvatar';
import { defaultAppearance } from '../domain/appearance';
import { Plan, loadPlans, purchase, restore, storeState } from '../native/purchases';
import { useApp } from '../state/AppState';
import { CircleButton, Icon, Pill, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { errorFeedback, successFeedback, tapFeedback } from '../native/haptics';
import { t } from '../i18n';

const PERKS = () => [
  { title: t('Every pet in one place'), body: t('Add the whole family — dogs and cats, each with their own day, routines and records.') },
  { title: t('Monthly stories'), body: t('A 30-day recap built from the care you logged, ready to share.') },
  { title: t('Support a small team'), body: t('Pro keeps Pavurio ad-free and independent.') },
];
const ALWAYS_FREE = () => t('Reminders, health records, attachments, weekly stories and data export stay free — always.');
const periodWord = (p: string) => (p === 'year' ? t('year') : p === 'month' ? t('month') : p === 'once' ? t('once') : p);

export default function Paywall() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const { pro, setPro } = useApp();
  const insets = useSafeAreaInsets();
  const store = storeState();
  const [plans, setPlans] = useState<Plan[] | null>(store.configured ? null : []);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!store.configured) return;
    loadPlans()
      .then((p) => {
        setPlans(p);
        setSel(p.find((x) => x.period === 'year')?.id ?? p[0]?.id ?? null);
      })
      .catch(() => {
        setPlans([]);
        setMsg(t("Couldn't reach the store. Check your connection and try again."));
      });
  }, [store.configured]);

  const buy = async () => {
    const plan = plans?.find((p) => p.id === sel);
    if (!plan || busy) return;
    setBusy('buy');
    setMsg(null);
    try {
      const ok = await purchase(plan);
      if (ok) {
        await setPro(true);
        successFeedback();
        router.back();
      }
    } catch (e) {
      errorFeedback();
      setMsg(e instanceof Error ? e.message : t('The purchase did not go through. You were not charged.'));
    } finally {
      setBusy(null);
    }
  };
  const doRestore = async () => {
    if (busy) return;
    setBusy('restore');
    setMsg(null);
    try {
      const ok = await restore();
      await setPro(ok);
      setMsg(ok ? t('Pro restored. Welcome back!') : t('No previous Pro purchase was found for this account.'));
      if (ok) successFeedback();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('Could not restore right now.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20 }}>
          <CircleButton icon="close" label={t('Close')} onPress={() => router.back()} size={44} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={styles.hero}>
            <View style={[styles.av, { left: 18, transform: [{ rotate: '-8deg' }] }]}>
              <PetAvatar species="cat" appearance={defaultAppearance('cat')} size={96} />
            </View>
            <View style={[styles.av, { right: 18, transform: [{ rotate: '8deg' }] }]}>
              <PetAvatar species="dog" appearance={defaultAppearance('dog')} size={96} />
            </View>
          </View>
          <T weight="black" style={styles.h1} accessibilityRole="header">
            Pavurio <T weight="black" style={{ color: colors.brand, fontSize: 34 }}>Pro</T>
          </T>
          {params.reason === 'pets' ? (
            <T style={styles.sub}>{t('The free plan covers one pet. Go Pro to add more.')}</T>
          ) : (
            <T style={styles.sub}>{t('More pets, more stories.')}</T>
          )}

          <View style={{ gap: 14, marginTop: 22 }}>
            {PERKS().map((p) => (
              <View key={p.title} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={styles.check}>
                  <Icon name="check" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="black" style={{ fontSize: 16 }}>
                    {p.title}
                  </T>
                  <T style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}>{p.body}</T>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.free}>
            <T weight="xbold" style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 18 }}>
              {ALWAYS_FREE()}
            </T>
          </View>

          {pro ? (
            <View style={[styles.free, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft }]}>
              <T weight="black" style={{ color: colors.brand, textAlign: 'center' }}>
                {t('You have Pro. Thank you!')}
              </T>
            </View>
          ) : !store.configured ? (
            <View style={[styles.free, { backgroundColor: '#FFF8EC', borderColor: '#FFE7BF' }]}>
              <T weight="black" style={{ fontSize: 15 }}>
                {t('Not available yet')}
              </T>
              <T style={{ color: colors.inkSoft, fontSize: 14, marginTop: 4, lineHeight: 19 }}>
                {store.reason} {t('Nothing will be charged.')}
              </T>
            </View>
          ) : plans == null ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
          ) : (
            <View style={{ gap: 10, marginTop: 20 }}>
              {plans.map((p) => {
                const on = p.id === sel;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t('{title} {price} per {period}', { title: p.title, price: p.price, period: periodWord(p.period) })}
                    onPress={() => {
                      tapFeedback();
                      setSel(p.id);
                    }}
                    style={[styles.plan, on && { borderColor: colors.brand, backgroundColor: '#F2FBFC' }]}
                  >
                    <View style={[styles.radio, on && { borderColor: colors.brand }]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <T weight="black" style={{ flex: 1, fontSize: 16 }}>
                      {p.period === 'year' ? t('Yearly') : p.period === 'month' ? t('Monthly') : p.period === 'once' ? t('Lifetime') : p.title}
                    </T>
                    <T weight="black" style={{ fontSize: 16 }}>
                      {p.price}
                      {p.period && p.period !== 'once' ? <T style={{ color: colors.muted, fontSize: 13 }}> /{periodWord(p.period)}</T> : null}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          )}
          {msg ? (
            <T weight="xbold" style={{ textAlign: 'center', marginTop: 14, color: colors.inkSoft }} accessibilityLiveRegion="polite">
              {msg}
            </T>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 14, gap: 10 }}>
          {!pro && store.configured ? <Pill label={t('CONTINUE')} onPress={buy} loading={busy === 'buy'} disabled={!sel} /> : <Pill label={t('CLOSE')} onPress={() => router.back()} />}
          {store.configured ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('Restore purchases')} onPress={doRestore} style={{ alignSelf: 'center', padding: 6 }}>
              <T weight="black" style={{ color: colors.muted, fontSize: 13, letterSpacing: 1 }}>
                {busy === 'restore' ? t('RESTORING…') : t('RESTORE PURCHASES')}
              </T>
            </Pressable>
          ) : null}
          {store.configured ? (
            <T style={{ color: colors.faint, fontSize: 11, textAlign: 'center', lineHeight: 15 }}>
              {t('Subscriptions renew automatically until cancelled in your store account settings at least 24 hours before the period ends.')}
            </T>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  hero: { height: 130, marginTop: 4, alignItems: 'center' },
  av: { position: 'absolute', top: 6, width: 116, height: 116, borderRadius: 34, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  h1: { fontSize: 34, textAlign: 'center', marginTop: 8 },
  sub: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 4 },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  free: { marginTop: 20, padding: 14, borderRadius: 18, backgroundColor: colors.canvasWarm, borderWidth: 1.5, borderColor: colors.line },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: 2, borderColor: colors.line },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
});
