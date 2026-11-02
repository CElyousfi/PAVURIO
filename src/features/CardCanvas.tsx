/**
 * Renders a Memory Card: the owner's photos in the template's windows, the template art on top and
 * the title / footer text in its white pills. Everything is laid out in the export's pixel space
 * (1080×1920 or 1080×1350) and multiplied by `scale`, so the preview and the export are the same layout.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CardFormat, TemplateId, layoutFor } from './memoryCards';
import { TEMPLATE_ART } from './memoryTemplateArt.generated';
import { DEFAULT_FRAMING, Framing, coverRect } from '../domain/memories';
import { font } from '../ui/theme';

export type CardPhoto = { uri: string; w: number; h: number; framing: Framing; key: string };

/** Deterministic text sizing (same on every platform): as big as the pill allows for this text. */
export function fitFont(text: string, box: { w: number; h: number }, maxRatio: number, charW = 0.56): number {
  const len = Math.max(1, [...text].length);
  return Math.max(12, Math.min(box.h * maxRatio, (box.w * 0.94) / (len * charW)));
}

export function CardCanvas({
  template,
  format,
  photos,
  title,
  footer,
  scale,
  selected,
  emptyColor = '#EAF7F8',
  emptyLabel,
  onImageLoad,
  slotHandlers,
}: {
  template: TemplateId;
  format: CardFormat;
  photos: (CardPhoto | null)[];
  title: string;
  footer: string;
  scale: number;
  selected?: number | null;
  emptyColor?: string;
  /** shown in empty windows while editing (never exported: export needs every window filled) */
  emptyLabel?: (i: number) => React.ReactNode;
  /** called once per image: true when it decoded, false when it failed */
  onImageLoad?: (ok: boolean) => void;
  slotHandlers?: (i: number) => object;
}) {
  const L = layoutFor(template, format);
  const s = scale;
  const titleSize = fitFont(title, L.title, 0.4);
  const footerSize = fitFont(footer, L.footer, 0.36, 0.48);
  return (
    <View style={{ width: L.w * s, height: L.h * s, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
      {L.slots.map((slot, i) => {
        const p = photos[i];
        const r = p ? coverRect(p.w, p.h, slot, p.framing ?? DEFAULT_FRAMING) : null;
        return (
          <View
            key={i}
            {...(slotHandlers ? slotHandlers(i) : {})}
            style={{ position: 'absolute', left: slot.x * s, top: slot.y * s, width: slot.w * s, height: slot.h * s, borderRadius: slot.r * s, overflow: 'hidden', backgroundColor: emptyColor }}
          >
            {p && r ? (
              <Image
                source={{ uri: p.uri }}
                onLoad={() => onImageLoad?.(true)}
                onError={() => onImageLoad?.(false)}
                resizeMode="cover"
                style={{ position: 'absolute', left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s }}
                accessibilityIgnoresInvertColors
              />
            ) : emptyLabel ? (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{emptyLabel(i)}</View>
            ) : null}
          </View>
        );
      })}
      <Image source={TEMPLATE_ART[template][format]} onLoad={() => onImageLoad?.(true)} onError={() => onImageLoad?.(false)} style={{ position: 'absolute', left: 0, top: 0, width: L.w * s, height: L.h * s }} pointerEvents="none" />
      {selected != null && L.slots[selected] ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (L.slots[selected].x - 6) * s,
            top: (L.slots[selected].y - 6) * s,
            width: (L.slots[selected].w + 12) * s,
            height: (L.slots[selected].h + 12) * s,
            borderRadius: (L.slots[selected].r + 6) * s,
            borderWidth: Math.max(2, 10 * s),
            borderColor: '#14B8C4',
          }}
        />
      ) : null}
      {title ? (
        <View pointerEvents="none" style={[styles.box, { left: L.title.x * s, top: L.title.y * s, width: L.title.w * s, height: L.title.h * s }]}>
          <Text numberOfLines={1} style={{ fontFamily: font.black, fontSize: titleSize * s, color: '#23304A', textAlign: 'center' }} allowFontScaling={false}>
            {title}
          </Text>
        </View>
      ) : null}
      {footer ? (
        <View pointerEvents="none" style={[styles.box, { left: L.footer.x * s, top: L.footer.y * s, width: L.footer.w * s, height: L.footer.h * s }]}>
          <Text numberOfLines={1} style={{ fontFamily: font.xbold, fontSize: footerSize * s, color: '#3D4A63', textAlign: 'center' }} allowFontScaling={false}>
            {footer}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
