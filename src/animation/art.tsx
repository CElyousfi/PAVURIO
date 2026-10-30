/**
 * Original Pavurio character art, drawn as layered vectors so every part can be rigged in code.
 * Style follows docs/art/character-sheet-reference.png: soft rounded shapes, big glossy eyes,
 * flat fills, no outlines, a single accessory pop (dog bandana / cat collar + bell).
 *
 * All parts share one coordinate space: viewBox 0 0 300 330.
 */
import React from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Species } from '../domain/care';
import type { Accessory, Palette } from '../domain/appearance';

export const VB_W = 300;
export const VB_H = 330;
/** vertical extent of the character used for the "color-in" fill */
export const ART_TOP = 18;
export const ART_BOTTOM = 314;

export type Paint = {
  coat: string;
  patch: string;
  light: string;
  pink: string;
  shade: string;
  blush: string;
  ink: string;
  white: string;
  acc: string;
  accDark: string;
};

export function colorPaint(p: Palette, a: Accessory): Paint {
  return {
    coat: p.coat,
    patch: p.patch,
    light: p.light,
    pink: p.pink,
    shade: p.shade,
    blush: p.pink,
    ink: '#2B2D3A',
    white: '#FFFFFF',
    acc: a.color,
    accDark: a.dark,
  };
}

/** The un-colored "pencil sketch" state. Never used to imply sadness or neglect. */
export const SKETCH: Paint = {
  coat: '#ECEDEF',
  patch: '#E1E3E7',
  light: '#F5F6F7',
  pink: '#E1E3E7',
  shade: '#E1E3E7',
  blush: 'transparent',
  ink: '#2B2D3A',
  white: '#FFFFFF',
  acc: '#E1E3E7',
  accDark: '#D6D8DD',
};

type Part = (p: Paint) => React.ReactElement;

export type SpeciesArt = {
  pivots: {
    tail: [number, number];
    neck: [number, number];
    earL: [number, number];
    earR: [number, number];
    eyes: [number, number];
  };
  earsBehindHead: boolean;
  tail: Part;
  body: Part;
  accessory: Part;
  earL: Part;
  earR: Part;
  head: Part;
  face: Part;
  eyes: Part;
  happyEyes: Part;
  tongue: Part;
};

const mirror = (children: React.ReactNode) => <G transform={`translate(${VB_W} 0) scale(-1 1)`}>{children}</G>;

// ------------------------------------------------------------------ shared face bits

const eyePair = (p: Paint, cxL: number, cxR: number, cy: number, rx: number, ry: number) => (
  <G>
    {[cxL, cxR].map((cx) => (
      <G key={cx}>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.ink} />
        <Circle cx={cx + rx * 0.32} cy={cy - ry * 0.36} r={rx * 0.36} fill={p.white} />
        <Circle cx={cx - rx * 0.3} cy={cy + ry * 0.38} r={rx * 0.15} fill={p.white} opacity={0.85} />
      </G>
    ))}
  </G>
);

const happyPair = (p: Paint, cxL: number, cxR: number, cy: number, w: number) => (
  <G>
    {[cxL, cxR].map((cx) => (
      <Path
        key={cx}
        d={`M${cx - w} ${cy + 4} Q${cx} ${cy - w * 1.15} ${cx + w} ${cy + 4}`}
        stroke={p.ink}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    ))}
  </G>
);

// ------------------------------------------------------------------ DOG
// Matches the approved GPT board (docs/art/gpt-board-v1.png): cream face with orange eye
// patches and a cream blaze to the crown, curly orange tuft, long orange ears hanging from
// the top of the head, tongue out, cream body with orange patches, fluffy tail on the left.

const dogEar = (p: Paint) => (
  <G>
    <Path d="M104 62 C72 50 42 72 36 118 C30 164 40 204 64 210 C86 214 96 186 99 154 C102 122 112 86 104 62 Z" fill={p.patch} />
    <Path d="M84 84 C64 92 54 124 54 156 C54 178 62 190 70 186 C80 170 84 140 88 108 Z" fill={p.shade} opacity={0.45} />
  </G>
);

const dogEyePatch = (p: Paint) => (
  <Path d="M72 118 C68 82 94 60 126 58 C136 72 138 94 134 114 C130 134 114 146 94 146 C82 144 74 134 72 118 Z" fill={p.patch} />
);

export const DOG: SpeciesArt = {
  pivots: { tail: [102, 290], neck: [150, 196], earL: [98, 70], earR: [202, 70], eyes: [150, 124] },
  earsBehindHead: false,
  tail: (p) => (
    <G>
      <Path d="M104 294 C72 300 44 288 38 262 C34 240 50 226 64 234 C66 218 86 214 92 230 C104 242 108 268 104 294 Z" fill={p.coat} />
      <Circle cx={58} cy={258} r={11} fill={p.light} opacity={0.75} />
      <Circle cx={76} cy={240} r={8} fill={p.light} opacity={0.6} />
    </G>
  ),
  body: (p) => (
    <G>
      <Ellipse cx={96} cy={286} rx={30} ry={26} fill={p.coat} />
      <Ellipse cx={204} cy={286} rx={30} ry={26} fill={p.coat} />
      <Path d="M94 306 C84 254 104 196 150 194 C196 196 216 254 206 306 Q150 320 94 306 Z" fill={p.coat} />
      {/* orange patches */}
      <Path d="M92 300 C80 268 90 230 112 214 C120 240 118 276 108 304 Z" fill={p.patch} opacity={0.9} />
      <Ellipse cx={206} cy={252} rx={14} ry={20} fill={p.patch} opacity={0.75} />
      {/* chest */}
      <Path d="M118 212 C132 202 168 202 182 212 C190 250 178 290 150 298 C122 290 110 250 118 212 Z" fill={p.light} />
      <Rect x={120} y={236} width={24} height={74} rx={12} fill={p.light} />
      <Rect x={156} y={236} width={24} height={74} rx={12} fill={p.light} />
      <Ellipse cx={84} cy={308} rx={20} ry={9} fill={p.light} />
      <Ellipse cx={216} cy={308} rx={20} ry={9} fill={p.light} />
      <Ellipse cx={132} cy={309} rx={17} ry={9} fill={p.light} />
      <Ellipse cx={168} cy={309} rx={17} ry={9} fill={p.light} />
      <Path d="M127 305 L127 312 M137 305 L137 312 M163 305 L163 312 M173 305 L173 312" stroke={p.shade} strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
  accessory: (p) => (
    <G>
      <Path d="M112 202 Q150 218 188 202 L182 214 Q150 268 118 214 Z" fill={p.acc} />
      <Path d="M106 196 Q150 216 194 196 L192 208 Q150 228 108 208 Z" fill={p.accDark} />
      <G fill={p.white} opacity={0.95}>
        <Ellipse cx={150} cy={238} rx={7} ry={6} />
        <Circle cx={141} cy={229} r={3} />
        <Circle cx={147} cy={225} r={3} />
        <Circle cx={153} cy={225} r={3} />
        <Circle cx={159} cy={229} r={3} />
      </G>
    </G>
  ),
  earL: dogEar,
  earR: (p) => mirror(dogEar(p)),
  head: (p) => (
    <G>
      <Ellipse cx={92} cy={150} rx={26} ry={24} fill={p.light} />
      <Ellipse cx={208} cy={150} rx={26} ry={24} fill={p.light} />
      <Ellipse cx={150} cy={124} rx={84} ry={74} fill={p.light} />
      {dogEyePatch(p)}
      {mirror(dogEyePatch(p))}
      {/* curly tuft */}
      <Path d="M126 62 C122 46 136 36 148 44 C154 30 176 34 172 52 C182 50 186 62 176 68 C160 60 140 60 126 62 Z" fill={p.patch} />
      {/* muzzle */}
      <Ellipse cx={150} cy={152} rx={40} ry={29} fill={p.white} opacity={0.75} />
    </G>
  ),
  face: (p) => (
    <G>
      <Ellipse cx={100} cy={158} rx={12} ry={7} fill={p.blush} opacity={0.35} />
      <Ellipse cx={200} cy={158} rx={12} ry={7} fill={p.blush} opacity={0.35} />
      {/* small tongue always out (approved master) */}
      <Path d="M143 157 Q142 171 150 172 Q158 171 157 157 Z" fill="#FB8781" />
      <Ellipse cx={150} cy={140} rx={13} ry={9} fill={p.ink} />
      <Ellipse cx={146} cy={137} rx={4.5} ry={2.4} fill={p.white} opacity={0.6} />
      <Path
        d="M150 149 L150 155 M132 152 Q141 162 150 155 Q159 162 168 152"
        stroke={p.ink}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  ),
  eyes: (p) => eyePair(p, 118, 182, 122, 10.5, 12.5),
  happyEyes: (p) => happyPair(p, 118, 182, 122, 11),
  tongue: () => (
    <G>
      <Path d="M141 156 Q140 184 150 185 Q160 184 159 156 Z" fill="#FB8781" />
      <Path d="M150 160 L150 176" stroke="#E2656A" strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
};

// ------------------------------------------------------------------ CAT
// Matches the approved GPT board: gray tabby head with forehead stripes either side of a
// white blaze that widens into a big white muzzle, pink inner ears, dark whiskers, coral
// collar with gold bell, gray body with white bib and paws, curled tail on the left.

const catEar = (p: Paint) => (
  <G>
    <Path d="M68 104 L78 36 Q82 26 92 32 L132 72 Z" fill={p.coat} />
    <Path d="M82 92 L87 48 L116 76 Z" fill={p.pink} />
  </G>
);

export const CAT: SpeciesArt = {
  pivots: { tail: [110, 300], neck: [150, 198], earL: [100, 80], earR: [200, 80], eyes: [150, 130] },
  earsBehindHead: true,
  tail: (p) => (
    <G>
      <Path d="M112 302 C74 308 46 296 42 270 C40 250 56 238 72 246" stroke={p.coat} strokeWidth={30} strokeLinecap="round" fill="none" />
      <Path d="M70 300 L66 286 M50 286 L58 276 M44 262 L58 262" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
    </G>
  ),
  body: (p) => (
    <G>
      <Ellipse cx={100} cy={288} rx={28} ry={24} fill={p.coat} />
      <Ellipse cx={200} cy={288} rx={28} ry={24} fill={p.coat} />
      <Path d="M98 306 C90 252 108 198 150 196 C192 198 210 252 202 306 Q150 318 98 306 Z" fill={p.coat} />
      <Path d="M104 246 L116 250 M102 264 L116 266 M196 246 L184 250 M198 264 L184 266" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
      <Path d="M120 208 C134 200 166 200 180 208 C188 252 174 294 150 300 C126 294 112 252 120 208 Z" fill={p.light} />
      <Rect x={122} y={238} width={22} height={72} rx={11} fill={p.light} />
      <Rect x={156} y={238} width={22} height={72} rx={11} fill={p.light} />
      <Ellipse cx={88} cy={308} rx={18} ry={8} fill={p.light} />
      <Ellipse cx={212} cy={308} rx={18} ry={8} fill={p.light} />
      <Ellipse cx={133} cy={309} rx={15} ry={8} fill={p.light} />
      <Ellipse cx={167} cy={309} rx={15} ry={8} fill={p.light} />
    </G>
  ),
  accessory: (p) => (
    <G>
      <Path d="M110 198 Q150 216 190 198 L190 210 Q150 228 110 210 Z" fill={p.acc} />
      <Circle cx={150} cy={226} r={10} fill="#FFC83D" />
      <Path d="M141 224 L159 224" stroke="#D99A10" strokeWidth={2} />
      <Circle cx={150} cy={230} r={2.4} fill="#B57B07" />
      <Circle cx={146} cy={221} r={2.4} fill="#FFFFFF" opacity={0.7} />
    </G>
  ),
  earL: catEar,
  earR: (p) => mirror(catEar(p)),
  head: (p) => (
    <G>
      <Path d="M60 148 L44 156 L62 162 L52 172 L76 168 Z" fill={p.coat} />
      <Path d="M240 148 L256 156 L238 162 L248 172 L224 168 Z" fill={p.coat} />
      <Ellipse cx={150} cy={130} rx={92} ry={70} fill={p.coat} />
      {/* white blaze widening into the muzzle */}
      <Path
        d="M150 80 C158 80 162 98 166 112 C192 118 222 134 226 162 C220 188 186 200 150 200 C114 200 80 188 74 162 C78 134 108 118 134 112 C138 98 142 80 150 80 Z"
        fill={p.light}
      />
      <Path d="M126 70 L130 92 M108 78 L116 96 M174 70 L170 92 M192 78 L184 96" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
      <Path d="M64 118 L82 122 M236 118 L218 122" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
    </G>
  ),
  face: (p) => (
    <G>
      <Ellipse cx={104} cy={160} rx={12} ry={7} fill={p.blush} opacity={0.35} />
      <Ellipse cx={196} cy={160} rx={12} ry={7} fill={p.blush} opacity={0.35} />
      <Path d="M143 146 L157 146 L150 155 Z" fill="#F67475" strokeLinejoin="round" />
      <Path
        d="M150 155 L150 159 M139 159 Q145 166 150 159 Q155 166 161 159"
        stroke={p.ink}
        strokeWidth={2.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M112 156 L64 148 M112 164 L66 172 M188 156 L236 148 M188 164 L234 172"
        stroke={p.ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.85}
      />
    </G>
  ),
  eyes: (p) => eyePair(p, 118, 182, 130, 10.5, 12.5),
  happyEyes: (p) => happyPair(p, 118, 182, 130, 12),
  tongue: () => (
    <G>
      <Ellipse cx={150} cy={165} rx={6.5} ry={5.5} fill="#FB8781" />
    </G>
  ),
};

export const ART: Record<Species, SpeciesArt> = { dog: DOG, cat: CAT };
