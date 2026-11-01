/** Shared form & layout pieces for the care, records and moments screens. */
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleButton, Icon, Label, Pill, T } from './primitives';
import { colors, font, radius, softShadow } from './theme';
import { tapFeedback } from '../native/haptics';
import { Bouncy, Enter, motionReduced } from './motion';
import { springs, usePress } from './springs';
import { addDays, dayKeyOf, parseDayKey } from '../domain/time';
import { lang, t } from '../i18n';
import { capitalize, formatHM, monthNames, monthNamesShort, uses24h, weekdayInitials } from '../i18n/dates';

const APressable = Animated.createAnimatedComponent(Pressable);

/** "Oct 31, 2026" in English, "31 oct. 2026" in French. */
export function formatDateLong(key: string | null | undefined): string {
  if (!key) return '—';
  const d = parseDayKey(key);
  const mon = monthNamesShort()[d.getMonth()];
  if (lang() !== 'en') return `${d.getDate()} ${mon} ${d.getFullYear()}`;
  return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
}

export function ScreenHeader({ title, onClose, onBack, right }: { title: string; onClose?: () => void; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? <CircleButton icon="back" label={t('Back')} onPress={onBack} size={46} /> : <View style={{ width: 46 }} />}
      <T weight="black" style={styles.headerTitle} accessibilityRole="header" numberOfLines={1}>
        {title}
      </T>
      {onClose ? <CircleButton icon="close" label={t('Close')} onPress={onClose} size={46} /> : right ?? <View style={{ width: 46 }} />}
    </View>
  );
}

export function TabTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.tabTitle}>
      <View style={{ flex: 1 }}>
        <T weight="black" style={{ fontSize: 30 }} accessibilityRole="header">
          {title}
        </T>
        {subtitle ? <T style={{ color: colors.muted, fontSize: 15, marginTop: 2 }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor={colors.faint} {...rest} style={[styles.input, rest.multiline && { minHeight: 90, textAlignVertical: 'top' }]} accessibilityLabel={label} />
    </View>
  );
}

export function Chip({ label, on, onPress, color = colors.ink, tint = colors.line }: { label: string; on: boolean; onPress: () => void; color?: string; tint?: string }) {
  const press = usePress(0.93);
  return (
    <APressable
      {...press.handlers}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.chip, { backgroundColor: on ? color : tint }, press.style]}
    >
      <T weight="xbold" style={{ color: on ? '#FFFFFF' : color === colors.ink ? colors.inkSoft : color, fontSize: 15 }}>
        {label}
      </T>
    </APressable>
  );
}

export function Card({ children, style, onPress, accessibilityLabel, enter }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; enter?: number }) {
  const body = !onPress ? (
    <View style={[styles.card, softShadow, style]}>{children}</View>
  ) : (
    <Bouncy accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.975} style={[styles.card, softShadow, style]}>
      {children}
    </Bouncy>
  );
  return enter == null ? body : <Enter index={enter}>{body}</Enter>;
}

export function EmptyState({ title, body, action, onAction, art }: { title: string; body: string; action?: string; onAction?: () => void; art?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      {art}
      <T weight="black" style={{ fontSize: 20, textAlign: 'center', marginTop: 8 }}>
        {title}
      </T>
      <T style={{ color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 21 }}>{body}</T>
      {action && onAction ? <Pill label={action} onPress={onAction} style={{ marginTop: 18, minWidth: 220 }} /> : null}
    </View>
  );
}

/** Bottom sheet built on Modal: dims the screen, slides up, closes on backdrop tap. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  // the Modal stays mounted while the sheet slides out, so closing is as smooth as opening
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0); // 0 = hidden, 1 = shown
  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = motionReduced() ? 1 : withSpring(1, springs.gentle);
    } else if (mounted) {
      if (motionReduced()) {
        p.value = 0;
        setMounted(false);
      } else {
        p.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) runOnJS(setMounted)(false);
        });
      }
    }
  }, [visible, mounted, p]);
  const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - p.value) * 420 }] }));
  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('Close')} accessibilityRole="button" />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, panel]}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <T weight="black" style={{ fontSize: 20, flex: 1 }}>
              {title}
            </T>
            <CircleButton icon="close" label={t('Close')} onPress={onClose} size={40} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function MonthGrid({
  month,
  selected,
  onSelect,
  dots,
  maxDay,
}: {
  /** any day key inside the month to show */
  month: string;
  selected: string | null;
  onSelect: (key: string) => void;
  /** colored dots per day */
  dots?: Record<string, string[]>;
  /** days after this are disabled */
  maxDay?: string;
}) {
  const first = parseDayKey(month);
  const y = first.getFullYear();
  const m = first.getMonth();
  const startDow = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const today = dayKeyOf(new Date());
  const cells: (string | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => dayKeyOf(new Date(y, m, i + 1)))];
  while (cells.length % 7) cells.push(null);
  return (
    <View>
      <View style={styles.weekRow}>
        {weekdayInitials().map((d, i) => (
          <T key={i} weight="black" style={styles.weekHead}>
            {d}
          </T>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }).map((_, r) => (
        <View key={r} style={styles.weekRow}>
          {cells.slice(r * 7, r * 7 + 7).map((k, i) => {
            if (!k) return <View key={i} style={styles.dayCell} />;
            const disabled = !!maxDay && k > maxDay;
            const sel = k === selected;
            const isToday = k === today;
            return (
              <Pressable
                key={k}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={formatDateLong(k)}
                accessibilityState={{ selected: sel, disabled }}
                onPress={() => {
                  tapFeedback();
                  onSelect(k);
                }}
                style={styles.dayCell}
              >
                <View style={[styles.dayBubble, sel && { backgroundColor: colors.ink }, !sel && isToday && { backgroundColor: colors.brandSoft }]}>
                  <T weight={sel || isToday ? 'black' : 'bold'} style={{ color: sel ? '#FFFFFF' : disabled ? colors.faint : isToday ? colors.brand : colors.ink, fontSize: 16 }}>
                    {Number(k.slice(8))}
                  </T>
                </View>
                <View style={styles.dotRow}>
                  {(dots?.[k] ?? []).slice(0, 4).map((c, j) => (
                    <View key={j} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const d = parseDayKey(month);
  const shift = (delta: number) => onChange(dayKeyOf(new Date(d.getFullYear(), d.getMonth() + delta, 1)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <CircleButton icon="chevL" label={t('Previous month')} onPress={() => shift(-1)} size={40} />
      <T weight="black" style={{ fontSize: 18 }}>
        {capitalize(monthNames()[d.getMonth()])} {d.getFullYear()}
      </T>
      <CircleButton icon="chevR" label={t('Next month')} onPress={() => shift(1)} size={40} />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  allowClear,
  maxDay,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowClear?: boolean;
  maxDay?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value ?? dayKeyOf(new Date()));
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('{label}: {value}', { label, value: value ? formatDateLong(value) : t('not set') })}
        onPress={() => {
          setMonth(value ?? dayKeyOf(new Date()));
          setOpen(true);
        }}
        style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}
      >
        <T weight="bold" style={{ flex: 1, fontSize: 17, color: value ? colors.ink : colors.faint }}>
          {value ? formatDateLong(value) : placeholder ?? t('Choose a date')}
        </T>
        <Icon name="chevR" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <MonthNav month={month} onChange={setMonth} />
        <MonthGrid
          month={month}
          selected={value}
          maxDay={maxDay}
          onSelect={(k) => {
            onChange(k);
            setOpen(false);
          }}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Chip label={t('Today')} on={false} onPress={() => (onChange(dayKeyOf(new Date())), setOpen(false))} />
          {!maxDay ? <Chip label={t('In 1 year')} on={false} onPress={() => (onChange(addDays(dayKeyOf(new Date()), 365)), setOpen(false))} /> : null}
          {allowClear && value ? <Chip label={t('Clear')} on={false} onPress={() => (onChange(null), setOpen(false))} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

// ------------------------------------------------------------- time picker (5-minute steps)

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(':').map(Number);
  const set = (hh: number, mm: number) => onChange(`${String((hh + 24) % 24).padStart(2, '0')}:${String((mm + 60) % 60).padStart(2, '0')}`);
  const pretty = useMemo(() => formatHM(h, m), [h, m]);
  const h24 = uses24h();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${pretty}`} onPress={() => setOpen(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
        <T weight="black" style={{ flex: 1, fontSize: 18 }}>
          {pretty}
        </T>
        <Icon name="chevR" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || t('Time')}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginVertical: 8 }}>
          <Spinner label={t('Hour')} value={h24 ? h : h % 12 || 12} onUp={() => set(h + 1, m)} onDown={() => set(h - 1, m)} />
          <T weight="black" style={{ fontSize: 40 }}>
            :
          </T>
          <Spinner label={t('Minutes')} value={String(m).padStart(2, '0')} onUp={() => set(h + (m >= 55 ? 1 : 0), m + 5 - (m % 5))} onDown={() => set(h - (m < 5 ? 1 : 0), m - (m % 5 || 5))} />
          {h24 ? null : (
            <View style={{ gap: 8 }}>
              <Chip label="AM" on={h < 12} onPress={() => h >= 12 && set(h - 12, m)} />
              <Chip label="PM" on={h >= 12} onPress={() => h < 12 && set(h + 12, m)} />
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center' }}>
          {['07:00', '08:00', '12:00', '18:00', '20:00'].map((tm) => (
            <Chip key={tm} label={formatShort(tm)} on={value === tm} onPress={() => onChange(tm)} />
          ))}
        </View>
        <Pill label={t('DONE')} onPress={() => setOpen(false)} style={{ marginTop: 16 }} />
      </Sheet>
    </View>
  );
}

function formatShort(time: string) {
  const [h, m] = time.split(':').map(Number);
  if (uses24h()) return `${h}h${m ? String(m).padStart(2, '0') : ''}`;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}

function Spinner({ label, value, onUp, onDown }: { label: string; value: string | number; onUp: () => void; onDown: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('{label} up', { label })} onPress={() => (tapFeedback(), onUp())} style={styles.spinBtn} hitSlop={6}>
        <Icon name="up" />
      </Pressable>
      <T weight="black" style={{ fontSize: 40, minWidth: 64, textAlign: 'center' }}>
        {value}
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel={t('{label} down', { label })} onPress={() => (tapFeedback(), onDown())} style={styles.spinBtn} hitSlop={6}>
        <Icon name="down" />
      </Pressable>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>{children}</View>;
}

export function Scroll({ children, bottom = 120 }: { children: React.ReactNode; bottom?: number }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/** Full-screen modal form: header, scrolling body, sticky footer with the primary action. */
export function ModalScreen({
  title,
  onClose,
  children,
  footer,
  error,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  error?: string | null;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + 8 }}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flex: 1 }}>
        <ScreenHeader title={title} onClose={onClose} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer || error ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 14, gap: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
            {error ? (
              <T weight="xbold" style={{ color: colors.danger, textAlign: 'center' }} accessibilityLiveRegion="polite">
                {error}
              </T>
            ) : null}
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function Toggle({ label, body, value, onChange }: { label: string; body?: string; value: boolean; onChange: (v: boolean) => void }) {
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = motionReduced() ? (value ? 1 : 0) : withSpring(value ? 1 : 0, { damping: 16, stiffness: 260 });
  }, [value, on]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: on.value * 20 }, { scaleX: 1 + Math.sin(on.value * Math.PI) * 0.25 }] }));
  const track = useAnimatedStyle(() => ({ backgroundColor: on.value > 0.5 ? colors.brand : colors.faint }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onChange(!value);
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
    >
      <View style={{ flex: 1 }}>
        <T weight="black" style={{ fontSize: 16 }}>
          {label}
        </T>
        {body ? <T style={{ color: colors.muted, fontSize: 14, marginTop: 2, lineHeight: 19 }}>{body}</T> : null}
      </View>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 50, height: 30, borderRadius: 15, backgroundColor: colors.faint, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  headerTitle: { fontSize: 20, flex: 1, textAlign: 'center' },
  tabTitle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  input: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.canvasWarm,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.ink,
  },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.card - 6, padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  backdrop: { backgroundColor: 'rgba(20,26,40,0.4)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 12 },
  weekRow: { flexDirection: 'row' },
  weekHead: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 12, marginBottom: 6 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayBubble: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dotRow: { flexDirection: 'row', gap: 2, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  spinBtn: { width: 54, height: 40, borderRadius: 20, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
