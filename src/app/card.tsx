/**
 * Memory Card editor: pick the owner's photos for each window, reorder them, pan / pinch to frame,
 * set the optional title and name/date line, preview, then save or share an image at exactly
 * 1080×1920 (Story) or 1080×1350 (Post). Nothing is generated or altered: photos are only cropped
 * by the frame. A card can't be exported with an empty window.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, PanResponderInstance, PixelRatio, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Moment, getMoment, listMoments } from '../data/memoriesRepo';
import { DEFAULT_FRAMING, Framing, MAX_ZOOM, panBy } from '../domain/memories';
import { dayKeyOf } from '../domain/time';
import { monthNames } from '../i18n/dates';
import { CardCanvas, CardPhoto } from '../features/CardCanvas';
import { CardFormat, FORMAT_SIZE, TEMPLATES, TemplateId, fillSlots, layoutFor, missingSlots, prefillPhotos, swapSlots, templateFor } from '../features/memoryCards';
import { MomentThumb } from '../features/MemoriesKit';
import { pickPhotos, saveImageToLibrary, shareImage } from '../native/media';
import { errorFeedback, photoFeedback, selectFeedback } from '../native/haptics';
import { useApp } from '../state/AppState';
import { Sheet, formatDateLong } from '../ui/forms';
import { Bouncy, ConfettiRain } from '../ui/motion';
import { Icon, Label, Pill, SoftPill, T } from '../ui/primitives';
import { colors, font } from '../ui/theme';
import { t, tn } from '../i18n';

let seq = 0;
/** Real decoded size (orientation applied): stored sizes can be missing or pre-rotation. */
const sizeOf = (uri: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) =>
    Image.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      () => reject(new Error(t('This photo couldn’t be opened.'))),
    ),
  );
async function toPhoto(uri: string): Promise<CardPhoto> {
  const size = await sizeOf(uri);
  return { uri, w: size.w, h: size.h, framing: DEFAULT_FRAMING, key: `p${++seq}` };
}
/** Loads several photos, skipping any that can't be opened. */
async function toPhotos(uris: string[]): Promise<CardPhoto[]> {
  const out = await Promise.all(uris.map((u) => toPhoto(u).catch(() => null)));
  return out.filter(Boolean) as CardPhoto[];
}

export default function CardEditor() {
  const params = useLocalSearchParams<{ template?: string; moment?: string; format?: string }>();
  const { pet, db } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [tpl, setTpl] = useState<TemplateId>(templateFor(params.template ?? 'daily').id);
  const [format, setFormat] = useState<CardFormat>(params.format === 'post' ? 'post' : 'story');
  const [slots, setSlots] = useState<(CardPhoto | null)[]>(() => fillSlots(templateFor(params.template ?? 'daily').id, []));
  const [sel, setSel] = useState(0);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [footer, setFooter] = useState('');
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'share'>(null);
  const [exportScale, setExportScale] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const shotRef = useRef<React.ComponentRef<typeof View>>(null);
  /** the owner changed the photos: the first-load suggestions must not overwrite them */
  const touched = useRef(false);
  const loads = useRef({ n: 0, failed: false, resolve: null as null | ((ok: boolean) => void), need: 0 });
  const today = dayKeyOf(new Date());
  const def = templateFor(tpl);
  const L = layoutFor(tpl, format);

  // the owner's photo moments + the starting selection
  useEffect(() => {
    if (!pet) return;
    let cancelled = false;
    (async () => {
      const all = (await listMoments(db, pet.id, { withPhoto: true })).filter((m) => m.photoUri);
      setMoments(all);
      const first = params.moment ? await getMoment(db, params.moment) : null;
      const chosen = first?.photoUri ? [first, ...prefillPhotos(tpl, all.filter((m) => m.id !== first.id), today)] : prefillPhotos(tpl, all, today);
      const photos = await toPhotos(chosen.slice(0, templateFor(tpl).slots).map((m) => m.photoUri!));
      if (cancelled || touched.current) return;
      setSlots(fillSlots(tpl, photos));
      if (!cancelled) setFooter((f) => f || `${pet.name} · ${formatDateLong(first?.date ?? today)}`);
    })();
    return () => {
      cancelled = true;
    };
    // first load only: later template changes keep the owner's choices
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, pet]);

  useEffect(() => {
    if (!pet || titleTouched) return;
    setTitle(t(def.title, { name: pet.name, month: monthNames()[new Date().getMonth()] }));
  }, [def, pet, titleTouched]);

  // gestures: drag to pan the photo inside its window, two fingers to zoom; a tap selects the window
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const maxW = Math.min(width, 560) - 40;
  const maxH = Math.max(260, height * (preview ? 0.72 : 0.5));
  const scale = Math.min(maxW / L.w, maxH / L.h);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const layoutRef = useRef(L);
  layoutRef.current = L;

  const responders = useMemo<PanResponderInstance[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        let start: Framing = DEFAULT_FRAMING;
        let startDist = 0;
        let count = 0;
        let base = { dx: 0, dy: 0 };
        let moved = false;
        const dist = (e: { nativeEvent: { touches: readonly { pageX: number; pageY: number }[] } }) => {
          const [a, b] = e.nativeEvent.touches;
          return a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
        };
        // every change in the number of fingers starts again from the photo's current framing
        const rebase = (e: { nativeEvent: { touches: readonly { pageX: number; pageY: number }[] } }, g: { dx: number; dy: number }) => {
          start = slotsRef.current[i]?.framing ?? DEFAULT_FRAMING;
          startDist = dist(e);
          count = e.nativeEvent.touches.length;
          base = { dx: g.dx, dy: g.dy };
        };
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: (e, g) => {
            moved = false;
            rebase(e, g);
            setSel(i);
          },
          onPanResponderMove: (e, g) => {
            const p = slotsRef.current[i];
            const slot = layoutRef.current.slots[i];
            if (!p || !slot) return;
            if (e.nativeEvent.touches.length !== count) rebase(e, g);
            let next: Framing;
            if (count >= 2 && startDist) {
              next = { ...start, zoom: Math.min(MAX_ZOOM, Math.max(1, start.zoom * (dist(e) / startDist))) };
            } else {
              const dx = g.dx - base.dx;
              const dy = g.dy - base.dy;
              if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
              // the photo follows the finger
              next = panBy(p.w, p.h, slot, start, dx / scaleRef.current, dy / scaleRef.current);
            }
            moved = true;
            touched.current = true;
            setSlots((cur) => cur.map((x, j) => (j === i && x ? { ...x, framing: next } : x)));
          },
          onPanResponderRelease: () => {
            if (!moved && !slotsRef.current[i]) setPicker(true);
          },
        });
      }),
    [],
  );

  const missing = missingSlots(tpl, slots);

  const changeTemplate = (id: TemplateId) => {
    selectFeedback();
    touched.current = true;
    setTpl(id);
    setSlots((cur) => fillSlots(id, cur.filter(Boolean) as CardPhoto[]));
    setSel(0);
  };

  const fillFrom = (photos: CardPhoto[]) => {
    touched.current = true;
    const next = slotsRef.current.slice();
    let at = sel;
    for (const p of photos) {
      // the selected window first, then the next empty ones
      if (at !== sel || next[at] === undefined) {
        while (at < next.length && next[at]) at++;
        if (at >= next.length) at = next.findIndex((x) => !x);
      }
      if (at < 0 || at >= next.length) break;
      next[at] = p;
      at++;
    }
    setSlots(next);
    const empty = next.findIndex((x) => !x);
    if (empty >= 0) setSel(empty);
    else setPicker(false);
  };

  const fromGallery = async () => {
    setError(null);
    try {
      const picked = await pickPhotos('library', true);
      if (!picked?.length) return;
      fillFrom(await toPhotos(picked.map((p) => p.uri)));
      setPicker(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not open photos.'));
    }
  };

  const zoomBy = (f: number) =>
    setSlots((cur) => cur.map((x, j) => (j === sel && x ? { ...x, framing: { ...x.framing, zoom: Math.min(MAX_ZOOM, Math.max(1, x.framing.zoom * f)) } } : x)));
  const nudge = (dx: number, dy: number) =>
    setSlots((cur) => cur.map((x, j) => (j === sel && x ? { ...x, framing: { ...x.framing, ox: Math.max(-1, Math.min(1, x.framing.ox + dx)), oy: Math.max(-1, Math.min(1, x.framing.oy + dy)) } } : x)));

  /** Renders the card off screen at the exact export size and captures it as a JPEG. */
  const render = useCallback(async (): Promise<string> => {
    const need = slots.filter(Boolean).length + 1;
    const ready = new Promise<boolean>((resolve) => {
      loads.current = { n: 0, failed: false, need, resolve };
      setTimeout(() => resolve(false), 8000); // a photo that never loads must not leave an empty window
    });
    setExportScale(1 / PixelRatio.get());
    const ok = await ready;
    loads.current.resolve = null;
    if (!ok) {
      setExportScale(null);
      throw new Error(t('A photo in this card couldn’t be loaded. Replace it and try again.'));
    }
    await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 250 : 120));
    const size = FORMAT_SIZE[format];
    const raw = await captureRef(shotRef as unknown as Parameters<typeof captureRef>[0], {
      format: 'jpg',
      quality: 0.95,
      result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
    });
    setExportScale(null);
    // normalize to the exact pixel size (re-encoding also guarantees no metadata travels along)
    const ref = await ImageManipulator.manipulate(raw).resize({ width: size.w, height: size.h }).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.93, base64: Platform.OS === 'web' });
    return Platform.OS === 'web' && out.base64 ? `data:image/jpeg;base64,${out.base64}` : out.uri;
  }, [slots, format]);

  const onLoad = useCallback((ok: boolean) => {
    const l = loads.current;
    if (!l.resolve) return;
    if (!ok) {
      l.resolve(false);
      l.resolve = null;
      return;
    }
    l.n++;
    if (l.n >= l.need) {
      l.resolve(true);
      l.resolve = null;
    }
  }, []);

  const run = async (kind: 'save' | 'share') => {
    if (busy) return;
    if (missing) {
      setError(tn(missing, 'Add 1 more photo to finish the card.', 'Add {n} more photos to finish the card.'));
      errorFeedback();
      return;
    }
    setError(null);
    setBusy(kind);
    try {
      const uri = await render();
      if (kind === 'save') {
        await saveImageToLibrary(uri);
        setDone(Date.now());
        photoFeedback();
      } else {
        await shareImage(uri, title || t('Memory Card'));
      }
    } catch (e) {
      setExportScale(null);
      setError(e instanceof Error && e.message ? e.message : t('The card couldn’t be saved. Please try again.'));
      errorFeedback();
    } finally {
      setBusy(null);
    }
  };

  if (!pet) return null;
  const selPhoto = slots[sel];
  const thumbW = 52;

  return (
    <View style={styles.root}>
      {/* off-screen export copy (exact pixels), painted under the editor */}
      {exportScale ? (
        <View ref={shotRef} collapsable={false} pointerEvents="none" style={styles.shot}>
          <CardCanvas template={tpl} format={format} photos={slots} title={title.trim()} footer={footer.trim()} scale={exportScale} onImageLoad={onLoad} />
        </View>
      ) : null}

      <View style={[styles.page, { paddingTop: insets.top + 6 }]}>
        <ConfettiRain fireKey={done} count={40} />
        <View style={styles.header}>
          <Bouncy accessibilityRole="button" accessibilityLabel={preview ? t('Back to editing') : t('Close')} onPress={() => (preview ? setPreview(false) : router.back())} style={styles.round} testID="card-close">
            <Icon name={preview ? 'back' : 'close'} />
          </Bouncy>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T weight="black" style={{ fontSize: 18 }}>
              {preview ? t('Preview') : t(def.name)}
            </T>
            <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
              {format === 'story' ? t('Story · 1080 × 1920') : t('Post · 1080 × 1350')}
            </T>
          </View>
          <View style={styles.formatToggle} accessibilityRole="radiogroup">
            {(['story', 'post'] as CardFormat[]).map((f) => (
              <Bouncy key={f} accessibilityRole="radio" accessibilityState={{ checked: format === f }} accessibilityLabel={f === 'story' ? t('Story') : t('Post')} onPress={() => setFormat(f)} haptic={false} style={[styles.fmt, format === f && styles.fmtOn]} testID={`fmt-${f}`}>
                <T weight="black" style={{ fontSize: 12.5, color: format === f ? colors.ink : colors.muted }}>
                  {f === 'story' ? t('Story') : t('Post')}
                </T>
              </Bouncy>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140, alignItems: 'center' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled>
          <View style={styles.canvasWrap} accessibilityLabel={t('Card preview')} testID="card-canvas">
            <CardCanvas
              template={tpl}
              format={format}
              photos={slots}
              title={title.trim()}
              footer={footer.trim()}
              scale={scale}
              selected={preview ? null : sel}
              emptyLabel={
                preview
                  ? undefined
                  : (i) => (
                      <View style={{ alignItems: 'center' }}>
                        <T weight="black" style={{ fontSize: Math.max(18, 70 * scale), color: colors.brand }}>
                          +
                        </T>
                        {L.slots.length <= 4 ? (
                          <T weight="xbold" style={{ fontSize: 12, color: colors.brand }}>
                            {t('Photo {n}', { n: i + 1 })}
                          </T>
                        ) : null}
                      </View>
                    )
              }
              slotHandlers={preview ? undefined : (i) => responders[i].panHandlers}
            />
          </View>

          {!preview ? (
            <View style={{ width: maxW, gap: 14, marginTop: 14 }}>
              {/* windows: select / reorder / replace */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Label style={{ flex: 1 }}>{tn(def.slots, '1 photo', '{n} photos') + (missing ? ` · ${tn(missing, '1 to add', '{n} to add')}` : '')}</Label>
                  {L.slots.length > 1 && selPhoto ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <SmallBtn label="◀" a11y={t('Move photo earlier')} disabled={sel === 0} onPress={() => ((touched.current = true), setSlots((c) => swapSlots(c, sel, sel - 1)), setSel(sel - 1))} />
                      <SmallBtn label="▶" a11y={t('Move photo later')} disabled={sel === L.slots.length - 1} onPress={() => ((touched.current = true), setSlots((c) => swapSlots(c, sel, sel + 1)), setSel(sel + 1))} />
                    </View>
                  ) : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {slots.map((p, i) => (
                    <Bouncy
                      key={i}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel === i }}
                      accessibilityLabel={p ? t('Photo {n}', { n: i + 1 }) : t('Empty window {n}, add a photo', { n: i + 1 })}
                      onPress={() => {
                        setSel(i);
                        if (!p) setPicker(true);
                      }}
                      style={[styles.slotThumb, { width: thumbW, height: thumbW }, sel === i && styles.slotOn]}
                    >
                      {p ? <Image source={{ uri: p.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <T weight="black" style={{ color: colors.brand, fontSize: 20 }}>+</T>}
                      <View style={styles.slotNum}>
                        <T weight="black" style={{ fontSize: 10, color: '#FFF' }}>
                          {i + 1}
                        </T>
                      </View>
                    </Bouncy>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <SoftPill small label={selPhoto ? t('Replace photo') : t('Add photo')} onPress={() => setPicker(true)} />
                  {selPhoto ? (
                    <>
                      <SmallBtn label="−" a11y={t('Zoom out')} disabled={selPhoto.framing.zoom <= 1} onPress={() => zoomBy(1 / 1.15)} />
                      <SmallBtn label="+" a11y={t('Zoom in')} disabled={selPhoto.framing.zoom >= MAX_ZOOM} onPress={() => zoomBy(1.15)} />
                      <SmallBtn label="←" a11y={t('Move left')} onPress={() => nudge(-0.2, 0)} />
                      <SmallBtn label="→" a11y={t('Move right')} onPress={() => nudge(0.2, 0)} />
                      <SmallBtn label="↑" a11y={t('Move up')} onPress={() => nudge(0, -0.2)} />
                      <SmallBtn label="↓" a11y={t('Move down')} onPress={() => nudge(0, 0.2)} />
                      <SoftPill small label={t('Remove')} color={colors.inkSoft} tint={colors.line} onPress={() => setSlots((c) => c.map((x, j) => (j === sel ? null : x)))} />
                    </>
                  ) : null}
                </View>
                {selPhoto ? (
                  <T weight="xbold" style={{ color: colors.muted, fontSize: 12 }}>
                    {t('Drag the photo to frame it. Pinch to zoom.')}
                  </T>
                ) : null}
              </View>

              <View style={{ gap: 6 }}>
                <Label>{t('Title (optional)')}</Label>
                <TextInput
                  value={title}
                  onChangeText={(v) => {
                    setTitle(v);
                    setTitleTouched(true);
                  }}
                  maxLength={40}
                  placeholder={t('No title')}
                  placeholderTextColor={colors.faint}
                  style={styles.input}
                  accessibilityLabel={t('Title (optional)')}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Label>{t('Name & date (optional)')}</Label>
                <TextInput value={footer} onChangeText={setFooter} maxLength={36} placeholder={t('Nothing')} placeholderTextColor={colors.faint} style={styles.input} accessibilityLabel={t('Name & date (optional)')} />
              </View>

              <View style={{ gap: 8 }}>
                <Label>{t('Template')}</Label>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {TEMPLATES.map((x) => (
                    <Bouncy key={x.id} accessibilityRole="radio" accessibilityState={{ checked: x.id === tpl }} accessibilityLabel={t(x.name)} onPress={() => changeTemplate(x.id)} style={[styles.tplChip, x.id === tpl && { backgroundColor: colors.ink }]}>
                      <T weight="black" style={{ fontSize: 13, color: x.id === tpl ? '#FFF' : colors.inkSoft }}>
                        {t(x.name)}
                      </T>
                    </Bouncy>
                  ))}
                </ScrollView>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {error ? (
            <T weight="xbold" style={{ color: colors.danger, textAlign: 'center' }} accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : done ? (
            <T weight="xbold" style={{ color: '#3E8E1F', textAlign: 'center' }} accessibilityLiveRegion="polite">
              {Platform.OS === 'web' ? t('Card downloaded!') : t('Saved to your photos!')}
            </T>
          ) : null}
          {preview ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Pill label={busy === 'save' ? t('Saving…') : t('SAVE')} onPress={() => run('save')} loading={busy === 'save'} disabled={!!busy} style={{ minWidth: 0, paddingHorizontal: 12 }} testID="card-save" />
              </View>
              <View style={{ flex: 1 }}>
                <Pill label={t('SHARE')} color={colors.brand} onPress={() => run('share')} loading={busy === 'share'} disabled={!!busy} style={{ minWidth: 0, paddingHorizontal: 12 }} testID="card-share" />
              </View>
            </View>
          ) : (
            <Pill
              label={missing ? tn(missing, 'ADD 1 MORE PHOTO', 'ADD {n} MORE PHOTOS') : t('PREVIEW')}
              onPress={() => {
                if (!missing) return setPreview(true);
                const empty = slots.findIndex((x) => !x);
                if (empty >= 0) setSel(empty);
                setPicker(true);
              }}
              testID="card-preview"
            />
          )}
        </View>
      </View>

      <Sheet visible={picker} onClose={() => setPicker(false)} title={t('Choose a photo')}>
        <SoftPill label={t('Choose from Gallery')} onPress={fromGallery} />
        {moments.length ? (
          <>
            <Label style={{ marginTop: 14, marginBottom: 8 }}>{t('From {name}’s memories', { name: pet.name })}</Label>
            <ScrollView style={{ maxHeight: height * 0.45 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {moments.map((m) => {
                const used = slots.some((s) => s?.uri === m.photoUri);
                const size = (Math.min(width, 560) - 40 - 18) / 4;
                return (
                  <Bouncy
                    key={m.id}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`${formatDateLong(m.date)}${used ? `, ${t('in the card')}` : ''}`}
                    onPress={async () => fillFrom(await toPhotos([m.photoUri!]))}
                    style={{ opacity: used ? 0.45 : 1 }}
                  >
                    <MomentThumb m={m} size={size} radius={12} species={pet.species} />
                  </Bouncy>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <T style={{ color: colors.muted, marginTop: 12, textAlign: 'center' }}>{t('Photos you add to Memories show up here.')}</T>
        )}
      </Sheet>

      {busy ? (
        <View style={styles.busy} pointerEvents="auto" accessibilityLiveRegion="polite" accessibilityLabel={t('Making your card…')}>
          <ActivityIndicator color="#FFF" size="large" />
          <T weight="black" style={{ color: '#FFF', marginTop: 10 }}>
            {t('Making your card…')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

function SmallBtn({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Bouncy accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.small, disabled && { opacity: 0.35 }]} haptic={false}>
      <T weight="black" style={{ fontSize: 16 }}>
        {label}
      </T>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  shot: { position: 'absolute', left: 0, top: 0 },
  page: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, maxWidth: 600, width: '100%', alignSelf: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  formatToggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 999, padding: 3 },
  fmt: { paddingHorizontal: 10, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fmtOn: { backgroundColor: '#FFFFFF' },
  canvasWrap: { borderRadius: 14, overflow: 'hidden', shadowColor: '#23304A', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4, backgroundColor: '#FFF' },
  slotThumb: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  slotOn: { borderColor: colors.brand },
  slotNum: { position: 'absolute', left: 3, bottom: 3, backgroundColor: 'rgba(20,26,40,0.55)', borderRadius: 999, paddingHorizontal: 5 },
  small: { minWidth: 40, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  input: { height: 50, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: font.bold, fontSize: 16, color: colors.ink },
  tplChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.card },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: '#FFFFFFF2', borderTopWidth: 1, borderTopColor: colors.line },
  busy: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,26,40,0.55)', alignItems: 'center', justifyContent: 'center' },
});
