/**
 * Shared pieces of Pavurio Adventures: weather card, town picker, passport stamps.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Sheet } from '../ui/forms';
import { T } from '../ui/primitives';
import { Bouncy } from '../ui/motion';
import { colors, font } from '../ui/theme';
import { ART } from '../ui/art';
import { FillArt } from '../ui/FillArt';
import { Sticker, weatherSticker } from '../ui/Sticker';
import { Advice, Place, TempUnit, WeatherArt, WeatherSnapshot, conditionLabel, formatTemp, walkAdvice, weatherArt } from '../domain/weather';
import { AdventureBadgeId, TimeOfDay } from '../domain/walks';
import { searchPlaces } from '../native/weather';
import { t } from '../i18n';

export const WEATHER_ART: Record<WeatherArt, number> = {
  sunny: ART.adventures.w_sunny,
  partly: ART.adventures.w_partly,
  cloudy: ART.adventures.w_cloudy,
  rain: ART.adventures.w_rainy,
  storm: ART.adventures.w_storm,
  snow: ART.adventures.w_snow,
  hot: ART.adventures.w_hot,
  cold: ART.adventures.w_cold,
  night: ART.adventures.w_night,
};

export const TIME_ART: Record<TimeOfDay, number> = {
  morning: ART.adventures.t_morning,
  afternoon: ART.adventures.t_afternoon,
  golden: ART.adventures.t_golden,
  evening: ART.adventures.t_evening,
  night: ART.adventures.t_night,
};

export const BADGE_ART: Record<AdventureBadgeId, number> = {
  first: ART.adventures.badge_first,
  early: ART.adventures.badge_early,
  golden: ART.adventures.badge_golden,
  cloud: ART.adventures.badge_cloud,
  spring: ART.adventures.badge_spring,
  five: ART.adventures.badge_five,
  ten: ART.adventures.badge_ten,
  fifty: ART.adventures.badge_together,
};

const ADVICE_TINT: Record<Advice['level'], { bg: string; fg: string }> = {
  ok: { bg: '#E6F7F8', fg: '#0E8F98' },
  caution: { bg: '#FFF4E0', fg: '#B26A00' },
  danger: { bg: '#FDECEC', fg: '#C1272D' },
};

/** Today's weather at the owner's town, or the one-time "choose your town" prompt. */
export function WeatherCard({
  weather,
  place,
  loading,
  unit,
  onChoosePlace,
}: {
  weather: WeatherSnapshot | null;
  place: Place | null;
  loading: boolean;
  unit: TempUnit;
  onChoosePlace: () => void;
}) {
  if (!place) {
    return (
      <Bouncy scaleTo={0.98} onPress={onChoosePlace} accessibilityRole="button" accessibilityLabel={t('Choose your town for the weather')} style={[styles.card, styles.row]} testID="weather-choose">
        <Image source={WEATHER_ART.partly} style={styles.art} />
        <View style={{ flex: 1 }}>
          <T weight="black" style={{ fontSize: 17 }}>
            {t('Where do you walk?')}
          </T>
          <T style={styles.muted}>{t('Choose your town once to see the weather before each walk. No location tracking.')}</T>
        </View>
      </Bouncy>
    );
  }
  const art = weatherArt(weather);
  const advice = walkAdvice(weather);
  const tint = ADVICE_TINT[advice.level];
  return (
    <View style={styles.card} testID="weather-card">
      <View style={styles.row}>
        {art ? <Image source={WEATHER_ART[art]} style={styles.art} accessibilityIgnoresInvertColors /> : <View style={[styles.art, styles.artEmpty]}>{loading ? <ActivityIndicator color={colors.brand} /> : null}</View>}
        <View style={{ flex: 1 }}>
          {weather?.available ? (
            <>
              <T weight="black" style={styles.temp} accessibilityLabel={`${formatTemp(weather.tempC, unit)}, ${conditionLabel(weather.condition)}`}>
                {formatTemp(weather.tempC, unit)}
              </T>
              <T weight="xbold" style={{ fontSize: 15 }}>
                {conditionLabel(weather.condition)}
                {weather.rainChance != null ? `  ·  ${t('{n}% rain', { n: Math.round(weather.rainChance) })}` : ''}
              </T>
            </>
          ) : (
            <T weight="xbold" style={{ fontSize: 15 }}>
              {loading ? t('Checking the weather…') : t('Weather unavailable')}
            </T>
          )}
          <Pressable onPress={onChoosePlace} accessibilityRole="button" accessibilityLabel={t('Change town, now {place}', { place: place.name })} hitSlop={8}>
            <T style={[styles.muted, { textDecorationLine: 'underline' }]}>{place.name}</T>
          </Pressable>
        </View>
        {/* Honey or Tabby dressed for the weather */}
        {weatherSticker(art) ? <Sticker name={weatherSticker(art)!} size={84} style={{ marginVertical: -8 }} /> : null}
      </View>
      {!loading ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.advice, { backgroundColor: tint.bg }]} accessibilityRole="text" testID={`advice-${advice.level}`}>
          <T weight="xbold" style={{ color: tint.fg, fontSize: 14, textAlign: 'center' }}>
            {advice.text}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** One-time town picker (Open-Meteo geocoding): type, pick, remembered. */
export function PlacePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: Place) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<(Place & { region: string | null })[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (!visible) return;
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setErr(null);
      return;
    }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await searchPlaces(query);
        if (n === seq.current) {
          setResults(r);
          setErr(r.length ? null : t('No town found. Try another spelling.'));
        }
      } catch {
        if (n === seq.current) setErr(t('Can’t search right now. Check your connection.'));
      } finally {
        if (n === seq.current) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Your town')}>
      <T style={[styles.muted, { marginBottom: 10 }]}>{t('Used only to look up the weather. Pavurio never tracks where you walk.')}</T>
      <TextInput maxFontSizeMultiplier={1.4}
        value={q}
        onChangeText={setQ}
        placeholder={t('Search a town or city')}
        placeholderTextColor={colors.faint}
        autoFocus
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel={t('Search a town or city')}
        testID="place-search"
      />
      <View style={{ minHeight: 120, marginTop: 8 }}>
        {busy ? <ActivityIndicator color={colors.brand} style={{ marginTop: 12 }} /> : null}
        {err ? <T style={[styles.muted, { marginTop: 10 }]}>{err}</T> : null}
        {results.map((p, i) => (
          <Bouncy key={`${p.lat},${p.lon},${i}`} scaleTo={0.98} onPress={() => onPick({ name: p.name, country: p.country, lat: p.lat, lon: p.lon, tz: p.tz })} style={styles.result} accessibilityRole="button" testID={`place-${i}`}>
            <T weight="black" style={{ fontSize: 16 }}>
              {p.name}
            </T>
            <T style={styles.muted}>{[p.region, p.country].filter(Boolean).join(', ')}</T>
          </Bouncy>
        ))}
      </View>
    </Sheet>
  );
}

/** A passport stamp: full colour when earned; a gray picture of itself while locked (the app's "not yet" look). */
export function Stamp({ id, size, earned }: { id: AdventureBadgeId; size: number; earned: boolean }) {
  if (!earned) return <FillArt source={BADGE_ART[id]} size={size} level={0} />;
  return <Image source={BADGE_ART[id]} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}

/** Time-of-day picture (a small landscape tile), kept whole at any size. */
export function TimeArt({ tod, size }: { tod: TimeOfDay; size: number }) {
  return <Image source={TIME_ART[tod]} style={{ width: size, height: size * 0.75, borderRadius: size * 0.12 }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 26, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  art: { width: 76, height: 76 },
  artEmpty: { borderRadius: 38, backgroundColor: '#FFF6E6', alignItems: 'center', justifyContent: 'center' },
  temp: { fontSize: 34, lineHeight: 40, color: colors.ink },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  advice: { borderRadius: 16, paddingVertical: 9, paddingHorizontal: 12 },
  input: { height: 52, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: font.bold, fontSize: 17, color: colors.ink },
  result: { paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
});
