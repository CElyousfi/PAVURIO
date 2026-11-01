import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { PetAvatar } from '../animation/PetAvatar';
import { defaultAppearance } from '../domain/appearance';
import { CHALLENGES } from '../domain/challenges';
import { TIPS } from '../content/tips';
import { PREVIEW_PLANS, Plan, loadPlans, purchase, restore, storeState, yearlySaving } from '../native/purchases';
import { scheduleTrialReminder } from '../native/notifications';
import { useApp } from '../state/AppState';
import { CircleButton, Icon, T } from '../ui/primitives';
import { colors, font } from '../ui/theme';
import { Bouncy, ConfettiRain, Enter, Float, PopIn, Pulse, Shimmer } from '../ui/motion';
import { errorFeedback, successFeedback } from '../native/haptics';
import { t, tn } from '../i18n';
import { LEGAL } from '../config/links';
import { ART } from '../ui/art';
import { Scene } from '../ui/Scene';

type Reason = 'onboarding' | 'pets' | 'story' | 'challenge' | 'tip' | 'stats' | 'settings' | 'feed';

const HEADLINE: Record<Reason, () => string> = {
  onboarding: () => t('Give {name} the very best care'),
  pets: () => t('Room for the whole family'),
  story: () => t('Relive every month together'),
  challenge: () => t('Unlock every challenge'),
  tip: () => t('Unlock every care tip'),
  stats: () => t('See the whole story'),
  settings: () => t('Give {name} the very best care'),
  feed: () => t('Give {name} the very best care'),
};

function perks() {
  const proChallenges = CHALLENGES.filter((c) => c.pro).length;
  const proTips = TIPS.filter((x) => x.pro).length;
  return [
    { color: '#B07A4F', tint: '#F6ECE2', icon: 'paw' as const, title: t('Every pet in one place'), body: t('Dogs and cats, each with their own day, routines, records and stories.') },
    { color: '#7C5CE6', tint: '#EEE8FE', icon: 'trophy' as const, title: tn(proChallenges, '{n} extra challenge', '{n} extra challenges'), body: t('Perfect Five, Brushing Habit, Playtime Fortnight and more — with badges to earn.') },
    { color: '#0C8FD1', tint: '#DDF3FE', icon: 'chart' as const, title: t('Weeks & months of history'), body: t('Stacked charts of every care, so you can spot changes over time.') },
    { color: '#FF6B9A', tint: '#FFE6EF', icon: 'film' as const, title: t('Monthly stories'), body: t('A 30-day recap built from the care you logged, ready to share.') },
    { color: '#C77800', tint: '#FFF1DC', icon: 'bulb' as const, title: tn(proTips, '{n} more care tip', '{n} more care tips'), body: t('Short, friendly guides for meals, weight, litter and a calm home.') },
    { color: '#0E9AA5', tint: '#DDF6F7', icon: 'heart' as const, title: t('Support a small team'), body: t('Pro keeps Pavurio ad-free and independent.') },
  ];
}

const PERK_ART: Record<string, keyof typeof ART.icons> = { paw: 'paw', trophy: 'trophy', chart: 'chart', film: 'calendar', bulb: 'shield', heart: 'heart' };

function PerkIcon({ icon, color }: { icon: ReturnType<typeof perks>[number]['icon']; color: string }) {
  const art = ART.icons[PERK_ART[icon]];
  if (art) return <Image source={art} style={{ width: 34, height: 34 }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  const p = { stroke: color, strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {icon === 'paw' && (
        <>
          <Path d="M12 20c-3.4 0-5.5-1.6-5.5-3.8 0-2.6 2.6-4.7 5.5-4.7s5.5 2.1 5.5 4.7C17.5 18.4 15.4 20 12 20z" {...p} />
          <Circle cx={6} cy={9.5} r={1.8} {...p} />
          <Circle cx={9.5} cy={6} r={1.8} {...p} />
          <Circle cx={14.5} cy={6} r={1.8} {...p} />
          <Circle cx={18} cy={9.5} r={1.8} {...p} />
        </>
      )}
      {icon === 'trophy' && <Path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" {...p} />}
      {icon === 'chart' && <Path d="M4 20h16M6 20v-6M10 20V9M14 20v-8M18 20V5" {...p} />}
      {icon === 'film' && <Path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM10 9l5 3-5 3z" {...p} />}
      {icon === 'bulb' && <Path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" {...p} />}
      {icon === 'heart' && <Path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" {...p} />}
    </Svg>
  );
}

const periodLabel = (p: Plan) =>
  p.period === 'year' ? t('Yearly') : p.period === 'month' ? t('Monthly') : p.period === 'week' ? t('Weekly') : p.period === 'once' ? t('Lifetime') : p.title;
const perWord = (p: Plan) => (p.period === 'year' ? t('/year') : p.period === 'month' ? t('/month') : p.period === 'week' ? t('/week') : '');

export default function Paywall() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason = ((params.reason as Reason) in HEADLINE ? params.reason : 'settings') as Reason;
  const { pro, setPro, pet } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const store = storeState();
  const [plans, setPlans] = useState<Plan[] | null>(store.configured ? null : PREVIEW_PLANS);
  const [sel, setSel] = useState<string | null>(store.configured ? null : 'preview_annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confetti, setConfetti] = useState<number | null>(null);

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

  const selected = plans?.find((p) => p.id === sel) ?? null;
  const saving = useMemo(() => (plans ? yearlySaving(plans) : null), [plans]);
  const trial = selected?.trialDays ?? 0;
  const name = pet?.name ?? t('your pet');
  const cw = Math.min(width, 560) - 48;

  const close = () => {
    if (reason === 'onboarding') router.replace('/');
    else router.back();
  };

  const buy = async () => {
    if (!selected || busy) return;
    if (selected.preview) {
      setMsg(storeState().reason ?? t("The store isn't connected in this build yet."));
      errorFeedback();
      return;
    }
    setBusy('buy');
    setMsg(null);
    try {
      const ok = await purchase(selected);
      if (ok) {
        await setPro(true);
        if (selected.trialDays > 0) await scheduleTrialReminder(selected.trialDays).catch(() => null);
        successFeedback();
        setConfetti(Date.now());
        setSuccess(true);
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
      if (ok) {
        successFeedback();
        setConfetti(Date.now());
        setSuccess(true);
      } else setMsg(t('No previous Pro purchase was found for this account.'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t('Could not restore right now.'));
    } finally {
      setBusy(null);
    }
  };

  const ctaLabel = pro ? t('You have Pro') : trial > 0 ? tn(trial, 'Start my {n}-day free trial', 'Start my {n}-day free trial') : t('Continue');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1 }}>
        <View style={styles.top}>
          <Animated.View entering={FadeIn.delay(reason === 'onboarding' ? 1200 : 0)}>
            <CircleButton icon="close" label={t('Close')} onPress={close} size={44} />
          </Animated.View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {/* hero */}
          <View style={styles.hero}>
            <View style={styles.glow} />
            {ART.ui.paywallHero ? (
              <Float style={{ position: 'absolute', alignSelf: 'center', top: 0 }} period={2800} amount={6}>
                <Scene source={ART.ui.paywallHero} width={142} height={178} border={5} tilt={-4} />
              </Float>
            ) : (
              <>
                <Float style={[styles.av, { left: cw / 2 - 128, transform: [{ rotate: '-8deg' }] }]} period={2600}>
                  <PetAvatar species="cat" appearance={defaultAppearance('cat')} size={100} />
                </Float>
                <Float style={[styles.av, { left: cw / 2 + 8, top: 2, transform: [{ rotate: '7deg' }] }]} period={3100} amount={8}>
                  <PetAvatar species="dog" appearance={pet?.species === 'dog' ? pet.appearance : defaultAppearance('dog')} size={100} />
                </Float>
              </>
            )}
            <PopIn delay={350} style={styles.proBadge}>
              <T weight="black" style={{ color: '#FFFFFF', fontSize: 13, letterSpacing: 2 }}>
                PRO
              </T>
            </PopIn>
          </View>
          <Animated.View entering={FadeInDown.delay(120).springify().damping(16)}>
            <T weight="black" style={styles.kicker}>
              ✓ {tn(CHALLENGES.length, '{n} challenge', '{n} challenges')} · {tn(TIPS.length, '{n} care tip', '{n} care tips')}
            </T>
            <T weight="black" style={styles.h1} accessibilityRole="header">
              {HEADLINE[reason]().replace('{name}', name)}
            </T>
          </Animated.View>

          {/* plans */}
          {pro ? (
            <View style={[styles.note, { backgroundColor: colors.brandSoft, borderColor: colors.brandSoft, marginTop: 22 }]}>
              <T weight="black" style={{ color: colors.brand, textAlign: 'center', fontSize: 16 }}>
                {t('You have Pro. Thank you!')}
              </T>
            </View>
          ) : plans == null ? (
            <ActivityIndicator color={colors.brand} style={{ marginVertical: 40 }} />
          ) : (
            <View style={{ gap: 10, marginTop: 22 }} accessibilityRole="radiogroup">
              {plans.map((p, i) => {
                const on = p.id === sel;
                const best = p.period === 'year';
                return (
                  <Enter key={p.id} index={i}>
                    <Bouncy
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${periodLabel(p)} ${p.price}`}
                      onPress={() => setSel(p.id)}
                      style={[styles.plan, on ? styles.planOn : null]}
                      scaleTo={0.97}
                    >
                      <SelectGlow on={on} />
                      {best && (saving || p.trialDays) ? (
                        <View style={styles.flag}>
                          <T weight="black" style={styles.flagText}>
                            {saving ? t('SAVE {n}%', { n: saving }) : t('BEST VALUE')}
                          </T>
                        </View>
                      ) : null}
                      <View style={[styles.radio, on && { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' }]}>
                        {on ? (
                          <Animated.View entering={ZoomIn.springify().damping(12)}>
                            <Icon name="check" size={14} color={colors.brand} />
                          </Animated.View>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <T weight="black" style={{ fontSize: 18, color: on ? '#FFFFFF' : colors.ink }}>
                            {periodLabel(p)}
                          </T>
                          {p.period === 'once' && ART.icons.infinity ? <Image source={ART.icons.infinity} style={{ width: 30, height: 18 }} resizeMode="contain" /> : null}
                          {p.period === 'year' && ART.icons.gem ? <Image source={ART.icons.gem} style={{ width: 18, height: 22 }} resizeMode="contain" /> : null}
                        </View>
                        <T weight="xbold" style={{ fontSize: 14, color: on ? '#FFFFFFD8' : colors.muted, marginTop: 1 }}>
                          {p.trialDays > 0
                            ? tn(p.trialDays, '{n} day free, then {price}{per}', '{n} days free, then {price}{per}', { price: p.price, per: perWord(p) })
                            : p.period === 'once'
                              ? t('Pay once, yours forever')
                              : `${p.price}${perWord(p)}`}
                        </T>
                      </View>
                      {p.perMonth ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <T weight="black" style={{ fontSize: 16, color: on ? '#FFFFFF' : colors.ink }}>
                            {p.perMonth}
                          </T>
                          <T weight="xbold" style={{ fontSize: 11, color: on ? '#FFFFFFC0' : colors.muted }}>
                            {t('per month')}
                          </T>
                        </View>
                      ) : (
                        <T weight="black" style={{ fontSize: 16, color: on ? '#FFFFFF' : colors.ink }}>
                          {p.price}
                        </T>
                      )}
                    </Bouncy>
                  </Enter>
                );
              })}
              {plans.some((p) => p.preview) ? (
                <T style={{ color: colors.faint, fontSize: 11, textAlign: 'center' }}>{t('Preview prices — the store is not connected in this build.')}</T>
              ) : null}
            </View>
          )}

          {/* trial timeline */}
          {!pro && trial > 0 ? (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.timeline}>
              <T weight="black" style={{ fontSize: 17, marginBottom: 12 }}>
                {t('How your free trial works')}
              </T>
              {[
                { c: colors.brand, title: t('Today'), body: t('Everything in Pro unlocks. No payment now.') },
                { c: '#FFB020', title: tn(Math.max(1, trial - 2), 'Day {n}', 'Day {n}'), body: t('We send you a reminder that your trial is ending.') },
                { c: colors.ink, title: tn(trial, 'Day {n}', 'Day {n}'), body: t('Your subscription starts, unless you cancel before.') },
              ].map((s, i, arr) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center', width: 26 }}>
                    {i === 0 && ART.icons.gift ? <Image source={ART.icons.gift} style={{ width: 26, height: 26 }} resizeMode="contain" /> : <View style={[styles.dot, { backgroundColor: s.c }]} />}
                    {i < arr.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 14 : 0 }}>
                    <T weight="black" style={{ fontSize: 15 }}>
                      {s.title}
                    </T>
                    <T style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 19 }}>{s.body}</T>
                  </View>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {/* what you get */}
          <T weight="black" style={[styles.h2, { marginTop: 28 }]}>
            {t('What you get')}
          </T>
          <View style={{ gap: 10, marginTop: 12 }}>
            {perks().map((p, i) => (
              <Enter key={p.title} index={i + 2}>
                <View style={[styles.perk, { backgroundColor: p.tint }]}>
                  <View style={[styles.perkIcon, { backgroundColor: '#FFFFFF' }]}>
                    <PerkIcon icon={p.icon} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T weight="black" style={{ fontSize: 16, color: p.color }}>
                      {p.title}
                    </T>
                    <T style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 19 }}>{p.body}</T>
                  </View>
                </View>
              </Enter>
            ))}
          </View>

          <View style={styles.note}>
            <T weight="xbold" style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 18 }}>
              {t('Free forever: daily care logging, reminders, health records with attachments, weekly stories, achievements and data export.')}
            </T>
          </View>

          {msg ? (
            <View style={{ alignItems: 'center', marginTop: 14, gap: 6 }}>
              {plans?.length === 0 && ART.icons.offline ? <Image source={ART.icons.offline} style={{ width: 64, height: 52 }} resizeMode="contain" /> : null}
              <T weight="xbold" style={{ textAlign: 'center', color: colors.inkSoft }} accessibilityLiveRegion="polite">
                {msg}
              </T>
            </View>
          ) : null}

          <View style={styles.legal}>
            <Pressable accessibilityRole="button" onPress={doRestore} hitSlop={6}>
              <T weight="black" style={styles.legalText}>
                {busy === 'restore' ? t('RESTORING…') : t('RESTORE')}
              </T>
            </Pressable>
            <T style={styles.legalText}>·</T>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(LEGAL.terms)} hitSlop={6}>
              <T weight="black" style={styles.legalText}>
                {t('TERMS')}
              </T>
            </Pressable>
            <T style={styles.legalText}>·</T>
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(LEGAL.privacy)} hitSlop={6}>
              <T weight="black" style={styles.legalText}>
                {t('PRIVACY')}
              </T>
            </Pressable>
          </View>
          {!pro && selected && selected.period !== 'once' ? (
            <T style={{ color: colors.faint, fontSize: 11, textAlign: 'center', lineHeight: 15, marginTop: 8 }}>
              {Platform.OS === 'ios'
                ? t('Payment is charged to your Apple ID at confirmation of purchase. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your App Store account settings.')
                : t('The subscription renews automatically unless cancelled in Google Play at least 24 hours before the end of the current period.')}
            </T>
          ) : null}
        </ScrollView>

        {/* sticky CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {!pro ? (
            <>
              <Pulse active={!busy} amount={0.025} period={1800}>
                <Bouncy onPress={buy} accessibilityRole="button" accessibilityLabel={ctaLabel} style={styles.cta} disabled={!selected || !!busy} testID="paywall-cta">
                  {busy === 'buy' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <T weight="black" style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
                      {ctaLabel}
                    </T>
                  )}
                  <Shimmer width={cw} height={62} />
                </Bouncy>
              </Pulse>
              <T weight="xbold" style={styles.sub}>
                {trial > 0 ? t('No payment now · Cancel anytime') : selected?.period === 'once' ? t('One payment · No subscription') : t('Cancel anytime')}
              </T>
            </>
          ) : (
            <Bouncy onPress={close} style={styles.cta} accessibilityRole="button">
              <T weight="black" style={styles.ctaText}>
                {t('CLOSE')}
              </T>
            </Bouncy>
          )}
        </View>
      </View>

      <ConfettiRain fireKey={confetti} />
      <Modal visible={success} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.scrim}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.success}>
            <PopIn delay={150}>
              <View style={styles.successAv}>
                <PetAvatar species={pet?.species ?? 'dog'} appearance={pet?.appearance ?? defaultAppearance('dog')} size={110} />
              </View>
            </PopIn>
            <T weight="black" style={{ fontSize: 26, textAlign: 'center', marginTop: 14, color: '#FFFFFF' }}>
              {t("You're all set!")}
            </T>
            <T style={{ color: '#FFFFFFD8', textAlign: 'center', marginTop: 6, fontSize: 15, lineHeight: 21 }}>{t('Pro is unlocked. {name} thanks you!', { name })}</T>
            <Bouncy onPress={() => (setSuccess(false), close())} style={styles.successBtn} accessibilityRole="button">
              <T weight="black" style={{ color: colors.brand, fontSize: 17, letterSpacing: 1 }}>
                {t("LET'S GO")}
              </T>
            </Bouncy>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/** The selected plan's brand fill fades in under the content instead of snapping. */
function SelectGlow({ on }: { on: boolean }) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.value = withSpring(on ? 1 : 0, { damping: 18, stiffness: 220 });
  }, [on, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 22, backgroundColor: colors.brand }, a]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, height: 48, zIndex: 2 },
  hero: { height: ART.ui.paywallHero ? 196 : 150, marginTop: -6 },
  glow: { position: 'absolute', alignSelf: 'center', top: 10, width: 230, height: 130, borderRadius: 80, backgroundColor: colors.brandSoft },
  av: { position: 'absolute', top: 14, width: 120, height: 120, borderRadius: 36, backgroundColor: '#FFF4E3', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 4, borderColor: '#FFFFFF' },
  proBadge: { position: 'absolute', alignSelf: 'center', bottom: -4, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 14 },
  kicker: { color: '#E58A00', fontSize: 15, textAlign: 'center', marginTop: 10 },
  h1: { fontSize: 29, lineHeight: 35, textAlign: 'center', marginTop: 4 },
  h2: { fontSize: 21, textAlign: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 24, backgroundColor: '#EAF8F9', borderWidth: 2, borderColor: 'transparent' },
  planOn: { borderColor: colors.brand },
  flag: { position: 'absolute', top: -10, right: 16, backgroundColor: '#FF4F8B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  flagText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  timeline: { marginTop: 22, padding: 18, borderRadius: 24, backgroundColor: colors.canvasWarm, borderWidth: 1.5, borderColor: colors.line },
  dot: { width: 16, height: 16, borderRadius: 8, marginTop: 2 },
  line: { flex: 1, width: 3, backgroundColor: colors.line, marginVertical: 2 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22 },
  perkIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: colors.canvasWarm, borderWidth: 1.5, borderColor: colors.line },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 20 },
  legalText: { color: colors.muted, fontSize: 12, letterSpacing: 1 },
  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 8, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.line },
  cta: { height: 62, borderRadius: 31, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 20 },
  ctaText: { color: '#FFFFFF', fontSize: 19, fontFamily: font.black, letterSpacing: 0.4 },
  sub: { textAlign: 'center', color: colors.muted, fontSize: 13 },
  scrim: { flex: 1, backgroundColor: 'rgba(14,19,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  success: { width: '100%', maxWidth: 360, borderRadius: 32, padding: 26, alignItems: 'center', backgroundColor: colors.brand },
  successAv: { width: 130, height: 130, borderRadius: 40, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  successBtn: { marginTop: 20, height: 54, paddingHorizontal: 40, borderRadius: 27, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
