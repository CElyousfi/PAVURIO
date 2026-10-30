/**
 * Plays a pre-rendered animation clip (frames cut from the generated videos) frame by frame.
 * Frames live in sprite sheets of 24 (6×4), one sheet per chunk, so only one or two sheets are
 * decoded at a time. The clip is scaled and positioned so its first (sitting) frame lines up with
 * the layered rig: same height from head to paws, same paw line, same head centre.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { DOG_CLIPS, DOG_CLIP_IMG, DogClipName } from './dogClips';

export type ClipGeometry = { k: number; top: number; paws: number; cx: number };

type Props = {
  name: DogClipName;
  palette: string;
  bandana: string;
  geo: ClipGeometry;
  onEnd: () => void;
};

export function ClipPlayer({ name, palette, bandana, geo, onEnd }: Props) {
  const c = DOG_CLIPS[name];
  const [frame, setFrame] = useState(0);
  const ended = useRef(false);

  useEffect(() => {
    ended.current = false;
    setFrame(0);
    let f = 0;
    const t = setInterval(() => {
      f += 1;
      if (f >= c.frames) {
        clearInterval(t);
        if (!ended.current) {
          ended.current = true;
          onEnd();
        }
        return;
      }
      setFrame(f);
    }, 1000 / c.fps);
    return () => clearInterval(t);
    // restart only when a new clip is requested
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const imgs = DOG_CLIP_IMG[name];
  const coat = imgs[palette] ?? imgs.honey;
  const band = bandana !== 'teal' ? imgs[`band_${bandana}`] : undefined;

  // align clip to the rig
  const s = ((geo.paws - geo.top) * geo.k) / (c.ref.bottom - c.ref.top);
  const fw = c.fw * s;
  const fh = c.fh * s;
  const left = geo.cx * geo.k - c.ref.cx * s;
  const top = geo.paws * geo.k - c.ref.bottom * s;

  const chunk = Math.floor(frame / c.per);
  const local = frame % c.per;
  const col = local % c.cols;
  const row = Math.floor(local / c.cols);
  const framesInChunk = Math.min(c.per, c.frames - chunk * c.per);
  const sheetW = c.cols * fw;
  const sheetH = Math.ceil(framesInChunk / c.cols) * fh;
  const next = chunk + 1 < c.chunks ? chunk + 1 : -1;
  const nextRows = next >= 0 ? Math.ceil(Math.min(c.per, c.frames - next * c.per) / c.cols) : 0;

  const sheet = (src: number, key: string) => (
    <Image
      key={key}
      source={src}
      fadeDuration={0}
      style={{ position: 'absolute', width: sheetW, height: sheetH, left: -col * fw, top: -row * fh }}
    />
  );

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width: fw, height: fh, overflow: 'hidden' }}>
      {sheet(coat[chunk], `c${chunk}`)}
      {band ? sheet(band[chunk], `b${chunk}`) : null}
      {/* decode the next chunk ahead of time, invisibly */}
      {next >= 0 ? (
        <Image
          source={coat[next]}
          fadeDuration={0}
          style={{ position: 'absolute', width: sheetW, height: nextRows * fh, left: 0, top: 0, opacity: 0 }}
        />
      ) : null}
    </View>
  );
}
