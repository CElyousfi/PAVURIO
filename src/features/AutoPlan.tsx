/**
 * The automatic plan, on screen: a short "About {name}" form (age, size, weight, food), and the plan
 * built from it — every care with how often, how much and when, ready in one tap. Tapping a care opens
 * its settings: each value starts at the recommendation, with the usual range shown under it.
 * Used by onboarding and the Plan screen.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CARE, CareType, Species, formatAmount } from '../domain/care';
import { AGE_PICKS, StageId } from '../domain/lifeStage';
import { portionStepFor, Choice, FoodKind, PetProfile, PlanBasis, Range, SIZES, Target, inRange, portionFor, withCount, daysFor } from '../domain/carePlan';
import { CareIcon } from '../ui/CareIcon';
import { Vessel } from '../ui/Vessel';
import { RollingNumber } from '../ui/Rolling';
import { Sheet, TimeField } from '../ui/forms';
import { Bouncy, Pop, motionReduced } from '../ui/motion';
import { Icon, T } from '../ui/primitives';
import { colors } from '../ui/theme';
import { selectFeedback, tickFeedback } from '../native/haptics';
import { formatHM, weekdayNamesShort } from '../i18n/dates';
import { t, tn } from '../i18n';
import { stageLabel } from './RoutineGuide';
import { useApp } from '../state/AppState';
import { basisFor } from '../data/autoPlan';

const LB = 0.45359237;
const hm = (tm: string) => formatHM(Number(tm.slice(0, 2)), Number(tm.slice(3, 5)));

export function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  if (unit === 'lb') return `${Math.round((kg / LB) * 10) / 10} lb`;
  return `${Math.round(kg * 10) / 10} kg`;
}

function sizeRange(kg: [number | null, number | null], unit: 'kg' | 'lb'): string {
  const f = (v: number) => (unit === 'lb' ? String(Math.round(v / LB)) : String(v));
  if (kg[0] == null) return t('under {w}', { w: `${f(kg[1]!)} ${unit}` });
  if (kg[1] == null) return t('over {w}', { w: `${f(kg[0])} ${unit}` });
  return `${f(kg[0])}–${f(kg[1])} ${unit}`;
}

// ------------------------------------------------------------------ about

/** `unsure`: the owner doesn't know the age; the plan then assumes an adult and says so */
export type About = { stage: StageId | null; months: number | null; profile: PetProfile; kg: number; kgTouched: boolean; unsure?: boolean };

export function AboutPet({
  species,
  name,
  about,
  estimateKg,
  unit,
  onChange,
  ageKnown = false,
  allowUnsure = false,
}: {
  species: Species;
  name: string;
  about: About;
  /** the typical weight for the chosen age and size (shown until the owner sets their own) */
  estimateKg: number | null;
  unit: 'kg' | 'lb';
  onChange: (a: About) => void;
  /** the exact birthday is known: the age row is hidden */
  ageKnown?: boolean;
  /** offer "I'm not sure" for the age (setup) */
  allowUnsure?: boolean;
}) {
  const kg = about.kgTouched ? about.kg : (estimateKg ?? about.kg);
  const step = unit === 'lb' ? (kg / LB < 10 ? 0.2 : 1) * LB : kg < 5 ? 0.1 : 0.5;
  const setKg = (d: 1 | -1) => {
    tickFeedback();
    const next = Math.max(0.3, Math.min(120, Math.round((kg + d * step) * 100) / 100));
    onChange({ ...about, kg: next, kgTouched: true });
  };
  const grown = about.months != null && about.months >= 12;
  return (
    <View style={{ gap: 18 }}>
      {!ageKnown ? (
        <Group title={t('Age')}>
          <View style={styles.wrap}>
            {AGE_PICKS[species].map((a) => (
              <Chip
                key={a.stage}
                label={stageLabel(species, a.stage)}
                on={about.stage === a.stage}
                onPress={() => onChange({ ...about, stage: a.stage, months: a.months, unsure: false })}
                testID={`about-age-${a.stage}`}
                wide
              />
            ))}
            {allowUnsure ? (
              <Chip label={t('I’m not sure')} on={!!about.unsure} onPress={() => onChange({ ...about, stage: null, months: null, unsure: true })} testID="about-age-unsure" wide />
            ) : null}
          </View>
          {about.unsure ? <T style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>{t('No problem: we’ll start with an adult’s plan. Add the age anytime and the plan adjusts.')}</T> : null}
        </Group>
      ) : null}
      <Group title={grown || species === 'cat' ? t('Size') : t('Size when grown')}>
        <View style={styles.wrap}>
          {SIZES[species].map((s) => (
            <Chip key={s.id} label={t(s.label)} sub={sizeRange(s.kg, unit)} on={about.profile.size === s.id} onPress={() => onChange({ ...about, profile: { ...about.profile, size: s.id } })} testID={`about-size-${s.id}`} />
          ))}
        </View>
      </Group>
      <Group title={t('Weight now')}>
        <View style={styles.stepRow}>
          <Bouncy scaleTo={0.88} onPress={() => setKg(-1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('Less')} testID="about-kg-minus">
            <T weight="black" style={styles.stepTxt}>
              −
            </T>
          </Bouncy>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T weight="black" style={{ fontSize: 24 }} accessibilityLiveRegion="polite">
              {formatWeight(kg, unit)}
            </T>
            <T weight="xbold" style={{ fontSize: 12, color: about.kgTouched ? colors.brand : colors.muted }}>
              {about.kgTouched ? t('Your weigh-in') : t('Estimated — adjust if you know it')}
            </T>
          </View>
          <Bouncy scaleTo={0.88} onPress={() => setKg(1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('More')} testID="about-kg-plus">
            <Icon name="plus" size={18} />
          </Bouncy>
        </View>
      </Group>
      <Group title={t('What does {name} eat?', { name })}>
        <View style={styles.wrap}>
          {(['dry', 'wet', 'mixed'] as FoodKind[]).map((f) => (
            <Chip
              key={f}
              label={f === 'dry' ? t('Dry food') : f === 'wet' ? t('Wet food') : t('Both')}
              on={about.profile.food === f}
              onPress={() => onChange({ ...about, profile: { ...about.profile, food: f } })}
              testID={`about-food-${f}`}
            />
          ))}
        </View>
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T weight="black" style={{ fontSize: 13, letterSpacing: 1.2, color: colors.muted }}>
        {title.toUpperCase()}
      </T>
      {children}
    </View>
  );
}

function Chip({ label, sub, on, onPress, testID, wide }: { label: string; sub?: string; on: boolean; onPress: () => void; testID?: string; wide?: boolean }) {
  return (
    <Bouncy
      onPress={() => {
        selectFeedback();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={[styles.chip, wide && styles.chipWide, on && styles.chipOn]}
      testID={testID}
      haptic={false}
    >
      <T weight="black" style={{ fontSize: 15, color: on ? '#FFFFFF' : colors.ink, textAlign: 'center' }}>
        {label}
      </T>
      {sub ? (
        <T weight="xbold" style={{ fontSize: 11, color: on ? '#FFFFFFCC' : colors.muted, textAlign: 'center' }}>
          {sub}
        </T>
      ) : null}
    </Bouncy>
  );
}

// ------------------------------------------------------------------ plan

/** "3× a day", "2 days a week", "Every 4 weeks" */
export function countLabel(kind: Choice['kind'] | Target['kind'], n: number): string {
  if (kind === 'interval') return tn(n, 'Every week', 'Every {n} weeks');
  if (kind === 'weekly') return tn(n, '{n} day a week', '{n} days a week');
  return t('{n}× a day', { n });
}

/** "2× a day · 135 g each" */
export function choiceSummary(c: Choice): string {
  if (!c.on) return t('Not in the plan');
  const how = countLabel(c.kind, c.count);
  return c.portion != null ? `${how} · ${t('{amount} each', { amount: formatAmount(c.care, c.portion) })}` : how;
}

export function PlanReview({ unit, name, basis, targets, choices, onChange }: { unit: 'kg' | 'lb'; name: string; basis: PlanBasis; targets: Target[]; choices: Choice[]; onChange: (c: Choice[]) => void }) {
  const [open, setOpen] = useState<CareType | null>(null);
  const target = targets.find((x) => x.care === open);
  const choice = choices.find((x) => x.care === open);
  const dow = weekdayNamesShort();
  return (
    <View style={{ gap: 10 }}>
      {choices.map((c, i) => {
        const meta = CARE[c.care];
        return (
          <Animated.View key={c.care} entering={motionReduced() ? undefined : FadeInDown.delay(60 + i * 70).springify().damping(16)}>
            <Bouncy onPress={() => setOpen(c.care)} style={[styles.row, !c.on && { opacity: 0.55 }]} accessibilityRole="button" testID={`plan-row-${c.care}`}>
              <CareIcon type={c.care} size={46} />
              <View style={{ flex: 1, gap: 1 }}>
                <T weight="black" style={{ fontSize: 17, color: meta.color }}>
                  {meta.label}
                </T>
                <T weight="black" style={{ fontSize: 15 }}>
                  {choiceSummary(c)}
                </T>
                {c.on ? (
                  <T weight="xbold" style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                    {c.kind === 'weekly' ? `${c.days.map((d) => dow[d]).join(' · ')} · ${hm(c.times[0] ?? '19:00')}` : c.kind === 'interval' ? hm(c.times[0] ?? '19:00') : c.times.map(hm).join(' · ')}
                  </T>
                ) : null}
              </View>
              {c.on ? <T style={{ fontSize: 15, opacity: c.remind ? 1 : 0.35 }}>{c.remind ? '🔔' : '🔕'}</T> : null}
              <Icon name="chevR" size={18} color={colors.faint} />
            </Bouncy>
          </Animated.View>
        );
      })}
      {target && choice ? (
        <TargetSheet
          key={target.care}
          name={name}
          unit={unit}
          basis={basis}
          target={target}
          choice={choice}
          onClose={() => setOpen(null)}
          onSave={(c) => {
            onChange(choices.map((x) => (x.care === c.care ? c : x)));
            setOpen(null);
          }}
        />
      ) : null}
    </View>
  );
}

const portionStep = portionStepFor;

function TargetSheet({ name, unit, basis, target, choice, onClose, onSave }: { name: string; unit: 'kg' | 'lb'; basis: PlanBasis; target: Target; choice: Choice; onClose: () => void; onSave: (c: Choice) => void }) {
  const [c, setC] = useState<Choice>(choice);
  return (
    <Sheet visible onClose={onClose} title={CARE[c.care].label}>
      <View style={{ gap: 8, paddingBottom: 6 }}>
        <CarePage name={name} unit={unit} basis={basis} target={target} choice={c} onChange={setC} size={190} />
        <Bouncy
          onPress={() => onSave(c.kind === 'weekly' && c.days.length === 0 ? { ...c, days: daysFor(c.count, target.days) } : c)}
          style={[styles.save, { backgroundColor: CARE[c.care].color }]}
          accessibilityRole="button"
          testID="rec-save"
        >
          <T weight="black" style={{ color: '#FFFFFF', fontSize: 16, letterSpacing: 1 }}>
            {t('SAVE')}
          </T>
        </Bouncy>
      </View>
    </Sheet>
  );
}

function FoodNote({ basis, unit, name, count, portion }: { basis: PlanBasis; unit: 'kg' | 'lb'; name: string; count: number; portion: number }) {
  const daily = Math.round(portion * count);
  const mixed = basis.profile.food === 'mixed' && basis.food.total > 0;
  const share = basis.food.total > 0 ? daily / basis.food.total : 1;
  return (
    <View style={styles.note}>
      <T style={{ fontSize: 13, color: colors.inkSoft, lineHeight: 19 }}>
        {t('{amount} a day for {name} at {weight}.', { amount: formatAmount('meal', daily), name, weight: formatWeight(basis.kg, unit) })}{' '}
        {mixed ? t('About {dry} g of dry food and {wet} g of wet food.', { dry: Math.round(basis.food.dry * share), wet: Math.round(basis.food.wet * share) }) + ' ' : ''}
        {t('Food labels vary: check yours, and adjust if {name} gets too round or too thin.', { name })}
      </T>
    </View>
  );
}

/** A value with − / +, the recommendation and the usual range under it. Going outside is allowed. */
export function RecStepper({
  label,
  value,
  range,
  format,
  formatRange,
  onStep,
  min = 0,
  max = Infinity,
  testID,
}: {
  label: string;
  value: number;
  range: Range;
  format: (v: number) => string;
  /** how the range ends are written (defaults to `format`) */
  formatRange?: (v: number) => string;
  onStep: (d: 1 | -1) => void;
  min?: number;
  max?: number;
  testID?: string;
}) {
  const ok = inRange(range, value);
  const step = (d: 1 | -1) => {
    tickFeedback();
    onStep(d);
  };
  return (
    <View style={styles.rec}>
      <View style={styles.stepRow}>
        <View style={{ flex: 1 }}>
          <T weight="xbold" style={{ color: colors.muted, fontSize: 13 }}>
            {label}
          </T>
          <Pop trigger={value} amount={0.2}>
            <T weight="black" style={{ fontSize: 22 }} accessibilityLiveRegion="polite" testID={testID ? `${testID}-value` : undefined}>
              {format(value)}
            </T>
          </Pop>
        </View>
        <Bouncy scaleTo={0.88} onPress={() => value > min && step(-1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('Less')} testID={testID ? `${testID}-minus` : undefined}>
          <T weight="black" style={styles.stepTxt}>
            −
          </T>
        </Bouncy>
        <Bouncy scaleTo={0.88} onPress={() => value < max && step(1)} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={t('More')} testID={testID ? `${testID}-plus` : undefined}>
          <Icon name="plus" size={18} />
        </Bouncy>
      </View>
      <View style={styles.recLine}>
        <T weight="xbold" style={{ fontSize: 12, color: value === range.rec ? colors.brand : colors.inkSoft }}>
          {value === range.rec ? `✓ ${t('Recommended')}` : t('Recommended: {value}', { value: format(range.rec) })}
        </T>
        <T weight="xbold" style={{ fontSize: 12, color: colors.muted }}>
          {range.min === range.max ? '' : t('Usual: {min} to {max}', { min: (formatRange ?? format)(range.min), max: (formatRange ?? format)(range.max) })}
        </T>
      </View>
      {!ok ? <T style={{ fontSize: 12, color: '#C27700' }}>{t('Outside the usual range. That’s fine if your vet advised it.')}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.card, justifyContent: 'center', flexGrow: 1 },
  chipWide: { flexBasis: '46%' },
  chipOn: { backgroundColor: colors.brand },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 24, lineHeight: 26 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 22, padding: 12, paddingRight: 14 },
  rec: { backgroundColor: colors.card, borderRadius: 20, padding: 14, gap: 6 },
  recLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  note: { backgroundColor: '#FFF6E5', borderRadius: 16, padding: 12 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 40, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  addBack: { height: 50, paddingHorizontal: 26, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  side: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  sideText: { fontSize: 18, color: colors.faint },
  warn: { fontSize: 12, color: '#C27700', textAlign: 'center', marginTop: 2 },
  countPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', borderRadius: 28, padding: 6, marginTop: 12 },
  countBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  timesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 },
  bell: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  save: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

/** What today's plan is built from for the active pet (null while loading or when the age is unknown). */
export function usePlanBasis(): PlanBasis | null | undefined {
  const { db, pet, version } = useApp();
  const [b, setB] = useState<PlanBasis | null | undefined>(undefined);
  useEffect(() => {
    if (!pet) return;
    let live = true;
    basisFor(db, pet).then((x) => live && setB(x));
    return () => {
      live = false;
    };
  }, [db, pet, version]);
  return b;
}

/** A target's headline: walks say how long, from the plan's numbers; the rest come from the guide. */
export function targetHeadline(tg: Target): string {
  if (tg.care === 'walk') {
    const each = portionFor(tg, tg.count.rec)?.rec ?? 0;
    return tn(tg.count.rec, '{n} walk a day of about {min} minutes', '{n} walks a day of about {min} minutes', { min: each });
  }
  if (tg.kind === 'interval' && tg.care === 'medication') return tn(tg.count.rec, 'Parasite prevention every week', 'Parasite prevention every {n} weeks');
  return t(tg.guide.headline);
}

/**
 * One care, full page, with the app's own controls: the bowl (or ball, brush…) fills with the amount and
 * is dragged up / down to change it, exactly like logging; then how many times, when, and the reminder.
 */
export function CarePage({ name, unit, basis, target, choice, onChange, size }: { name: string; unit: 'kg' | 'lb'; basis: PlanBasis; target: Target; choice: Choice; onChange: (c: Choice) => void; size: number }) {
  const c = choice;
  const meta = CARE[c.care];
  const weekly = c.kind === 'weekly';
  const interval = c.kind === 'interval';
  const spec = meta.amount;
  const pr = interval ? null : portionFor(target, c.count);
  const portion = c.portion;
  const hasAmount = !!(pr && portion != null && spec);
  const stepOf = (v: number) => portionStep(c.care, v);
  const nudge = (d: 1 | -1) => {
    if (!hasAmount || !spec || portion == null) return;
    const s = stepOf(portion);
    onChange({ ...c, portion: Math.max(spec.min, Math.min(spec.max, Math.round((portion + d * s) / s) * s)) });
  };
  // the recommendation fills the picture to about 80%: more shows as fuller, less as emptier
  const level = !c.on ? 0 : hasAmount && pr ? Math.max(0.12, Math.min(1, portion! / (pr.rec / 0.8))) : 0.85;
  const fmtN = (v: number) => String(Math.round(v * 100) / 100);
  const u = spec ? (spec.unit === 'min' ? ' min' : spec.unit) : '';
  const dow = weekdayNamesShort();
  const ok = !hasAmount || !pr ? true : inRange(pr, portion!);
  const countOk = inRange(target.count, c.count);
  return (
    <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
      <View style={{ opacity: c.on ? 1 : 0.35 }}>
        <Vessel type={c.care} color={meta.color} level={level} size={size} onStep={hasAmount && c.on ? nudge : undefined} testIDPrefix="care-amount" />
      </View>
      {!c.on ? (
        <Bouncy onPress={() => onChange({ ...c, on: true })} style={[styles.addBack, { backgroundColor: meta.color }]} accessibilityRole="button" testID="care-on">
          <T weight="black" style={{ color: '#FFFFFF', fontSize: 15, letterSpacing: 0.8 }}>
            {t('ADD TO THE PLAN')}
          </T>
        </Bouncy>
      ) : (
        <>
          {hasAmount ? (
            <>
              <View style={styles.amountRow}>
                <Pressable onPress={() => nudge(-1)} style={styles.side} accessibilityRole="button" accessibilityLabel={t('Less')}>
                  <T weight="black" style={styles.sideText}>
                    {portion! - stepOf(portion!) >= (spec?.min ?? 0) ? `${fmtN(portion! - stepOf(portion!))}${u}` : ''}
                  </T>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessible accessibilityLabel={formatAmount(c.care, portion!)} accessibilityLiveRegion="polite" testID="care-amount">
                  <RollingNumber value={fmtN(portion!)} size={46} lineHeight={54} />
                  <T weight="black" style={{ fontSize: 30, lineHeight: 50, color: colors.ink }}>
                    {u}
                  </T>
                </View>
                <Pressable onPress={() => nudge(1)} style={styles.side} accessibilityRole="button" accessibilityLabel={t('More')}>
                  <T weight="black" style={styles.sideText}>{`${fmtN(portion! + stepOf(portion!))}${u}`}</T>
                </Pressable>
              </View>
              <T weight="xbold" style={{ fontSize: 13, color: portion === pr!.rec ? colors.brand : colors.muted, textAlign: 'center' }}>
                {portion === pr!.rec ? `✓ ${t('Recommended')} · ` : `${t('Recommended: {value}', { value: formatAmount(c.care, pr!.rec) })} · `}
                {t('Usual: {min} to {max} each', { min: formatAmount(c.care, pr!.min), max: formatAmount(c.care, pr!.max) })}
              </T>
              {!ok ? <T style={styles.warn}>{t('Outside the usual range. That’s fine if your vet advised it.')}</T> : null}
            </>
          ) : null}

          <View style={[styles.countPill, { backgroundColor: meta.tint }]}>
            <Bouncy scaleTo={0.88} onPress={() => c.count > 1 && onChange(withCount(target, c, c.count - 1))} style={styles.countBtn} accessibilityRole="button" accessibilityLabel={t('Less')} testID="care-count-minus" haptic={false}>
              <T weight="black" style={styles.stepTxt}>
                −
              </T>
            </Bouncy>
            <Pop trigger={c.count} amount={0.25} style={{ flex: 1, alignItems: 'center' }}>
              <T weight="black" style={{ fontSize: 19, color: meta.color }} testID="care-count">
                {countLabel(c.kind, c.count)}
              </T>
            </Pop>
            <Bouncy scaleTo={0.88} onPress={() => c.count < (interval ? 12 : weekly ? 7 : 8) && onChange(withCount(target, c, c.count + 1))} style={styles.countBtn} accessibilityRole="button" accessibilityLabel={t('More')} testID="care-count-plus" haptic={false}>
              <Icon name="plus" size={18} />
            </Bouncy>
          </View>
          <T weight="xbold" style={{ fontSize: 12, color: c.count === target.count.rec ? colors.brand : colors.muted, marginTop: 4 }}>
            {c.count === target.count.rec ? `✓ ${t('Recommended')}` : t('Recommended: {value}', { value: countLabel(c.kind, target.count.rec) })}
            {target.count.min !== target.count.max ? ` · ${t('Usual: {min} to {max}', { min: target.count.min, max: target.count.max })}` : ''}
          </T>
          {!countOk ? <T style={styles.warn}>{t('Outside the usual range. That’s fine if your vet advised it.')}</T> : null}

          {weekly ? (
            <View style={[styles.days, { alignSelf: 'stretch', marginTop: 10 }]}>
              {dow.map((d, i) => {
                const on = c.days.includes(i);
                return (
                  <Bouncy
                    key={i}
                    onPress={() => {
                      const days = on ? c.days.filter((x) => x !== i) : [...c.days, i].sort();
                      if (days.length) onChange({ ...c, days, count: days.length });
                    }}
                    style={[styles.day, on && { backgroundColor: meta.color }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <T weight="black" style={{ fontSize: 12, color: on ? '#FFFFFF' : colors.ink }}>
                      {d}
                    </T>
                  </Bouncy>
                );
              })}
            </View>
          ) : null}

          <View style={styles.timesRow}>
            {(weekly || interval ? c.times.slice(0, 1) : c.times).map((tm, i) => (
              <TimeField key={`${i}-${c.times.length}`} compact label={meta.label} value={tm} color={meta.color} onChange={(v) => onChange({ ...c, times: c.times.map((x, j) => (j === i ? v : x)) })} />
            ))}
            <Bouncy
              onPress={() => {
                selectFeedback();
                onChange({ ...c, remind: !c.remind });
              }}
              style={[styles.bell, c.remind && { backgroundColor: meta.color, borderColor: meta.color }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: c.remind }}
              accessibilityLabel={t('Remind me')}
              testID="care-remind"
              haptic={false}
            >
              <T weight="black" style={{ fontSize: 14, color: c.remind ? '#FFFFFF' : colors.muted }}>
                {c.remind ? `🔔 ${t('Reminder on')}` : `🔕 ${t('No reminder')}`}
              </T>
            </Bouncy>
          </View>

          {c.care === 'meal' && portion != null ? <FoodNote basis={basis} unit={unit} name={name} count={c.count} portion={portion} /> : null}
          {interval ? (
            <View style={[styles.note, { alignSelf: 'stretch', marginTop: 10 }]}>
              <T style={{ fontSize: 13, color: colors.inkSoft, lineHeight: 19 }}>{t('Use the product, dose and rhythm your vet recommends. Pavurio keeps the rhythm and reminds you.')}</T>
            </View>
          ) : null}

          <Bouncy onPress={() => onChange({ ...c, on: false })} style={{ padding: 10, marginTop: 2 }} accessibilityRole="button" testID="care-off">
            <T weight="black" style={{ color: colors.faint, fontSize: 13, letterSpacing: 0.6 }}>
              {t('{name} doesn’t need this', { name })}
            </T>
          </Bouncy>
        </>
      )}
    </View>
  );
}
