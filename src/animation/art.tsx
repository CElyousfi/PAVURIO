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

// ------------------------------------------------------------------ DOG

const dogEar = (p: Paint) => (
  <G>
    <Path d="M92 74 C58 66 34 104 38 150 C40 176 64 184 77 162 C88 142 98 112 106 88 Z" fill={p.patch} />
    <Path d="M80 92 C62 98 54 124 56 146 C58 158 66 160 71 150 C78 134 84 114 88 98 Z" fill={p.shade} opacity={0.35} />
  </G>
);

const eyePair = (p: Paint, cxL: number, cxR: number, cy: number, rx: number, ry: number) => (
  <G>
    {[cxL, cxR].map((cx) => (
      <G key={cx}>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={p.ink} />
        <Circle cx={cx + rx * 0.35} cy={cy - ry * 0.38} r={rx * 0.38} fill={p.white} />
        <Circle cx={cx - rx * 0.32} cy={cy + ry * 0.35} r={rx * 0.17} fill={p.white} opacity={0.9} />
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

export const DOG: SpeciesArt = {
  pivots: { tail: [204, 262], neck: [150, 196], earL: [96, 82], earR: [204, 82], eyes: [150, 128] },
  earsBehindHead: false,
  tail: (p) => (
    <G>
      <Path d="M196 268 C236 262 262 236 262 198 C262 182 248 176 239 188 C240 218 224 240 192 248 Z" fill={p.coat} />
      <Path d="M262 198 C262 182 248 176 239 188 C240 196 240 204 238 210 C248 210 258 206 262 198 Z" fill={p.patch} />
    </G>
  ),
  body: (p) => (
    <G>
      {/* back legs / haunches */}
      <Ellipse cx={96} cy={286} rx={30} ry={26} fill={p.coat} />
      <Ellipse cx={204} cy={286} rx={30} ry={26} fill={p.coat} />
      <Ellipse cx={210} cy={280} rx={17} ry={15} fill={p.patch} opacity={0.9} />
      {/* torso */}
      <Path d="M94 306 C84 254 104 196 150 194 C196 196 216 254 206 306 Q150 320 94 306 Z" fill={p.coat} />
      {/* chest */}
      <Path d="M120 214 C132 204 168 204 180 214 C188 250 176 288 150 296 C124 288 112 250 120 214 Z" fill={p.light} />
      {/* front legs */}
      <Rect x={120} y={236} width={24} height={74} rx={12} fill={p.light} />
      <Rect x={156} y={236} width={24} height={74} rx={12} fill={p.light} />
      {/* paws */}
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
      <Ellipse cx={88} cy={142} rx={28} ry={26} fill={p.coat} />
      <Ellipse cx={212} cy={142} rx={28} ry={26} fill={p.coat} />
      <Ellipse cx={150} cy={122} rx={86} ry={74} fill={p.coat} />
      {/* cap with central blaze */}
      <Path
        d="M66 120 C64 74 104 48 150 48 C196 48 236 74 234 120 C214 104 192 98 170 106 C164 92 136 92 130 106 C108 98 86 104 66 120 Z"
        fill={p.patch}
      />
      <Path d="M140 50 Q150 30 162 48 Q154 44 148 54 Z" fill={p.patch} />
      {/* muzzle */}
      <Ellipse cx={150} cy={152} rx={42} ry={31} fill={p.light} />
    </G>
  ),
  face: (p) => (
    <G>
      <Ellipse cx={98} cy={158} rx={13} ry={8} fill={p.blush} opacity={0.45} />
      <Ellipse cx={202} cy={158} rx={13} ry={8} fill={p.blush} opacity={0.45} />
      <Path d="M139 138 Q150 132 161 138 Q161 148 150 151 Q139 148 139 138 Z" fill={p.ink} />
      <Ellipse cx={146} cy={138} rx={4} ry={2.2} fill={p.white} opacity={0.6} />
      <Path
        d="M150 151 L150 157 M135 156 Q143 166 150 157 Q157 166 165 156"
        stroke={p.ink}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  ),
  eyes: (p) => eyePair(p, 116, 184, 126, 11.5, 13.5),
  happyEyes: (p) => happyPair(p, 116, 184, 126, 12),
  tongue: (p) => (
    <G>
      <Path d="M142 159 Q141 180 150 181 Q159 180 158 159 Z" fill="#FF7A93" />
      <Path d="M150 162 L150 174" stroke="#E2546F" strokeWidth={2} strokeLinecap="round" />
    </G>
  ),
};

// ------------------------------------------------------------------ CAT

const catEar = (p: Paint) => (
  <G>
    <Path d="M70 100 L80 36 Q84 26 94 32 L130 72 Z" fill={p.coat} />
    <Path d="M84 88 L89 48 L114 74 Z" fill={p.pink} />
  </G>
);

export const CAT: SpeciesArt = {
  pivots: { tail: [198, 292], neck: [150, 198], earL: [100, 82], earR: [200, 82], eyes: [150, 132] },
  earsBehindHead: true,
  tail: (p) => (
    <G>
      <Path
        d="M196 296 C246 296 270 262 262 214 C258 192 268 176 282 182"
        stroke={p.coat}
        strokeWidth={24}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M246 286 L258 274 M262 256 L274 252 M262 232 L276 232 M262 210 L274 206"
        stroke={p.patch}
        strokeWidth={7}
        strokeLinecap="round"
      />
    </G>
  ),
  body: (p) => (
    <G>
      <Ellipse cx={100} cy={288} rx={28} ry={24} fill={p.coat} />
      <Ellipse cx={200} cy={288} rx={28} ry={24} fill={p.coat} />
      <Path d="M98 306 C90 252 108 198 150 196 C192 198 210 252 202 306 Q150 318 98 306 Z" fill={p.coat} />
      <Path d="M104 248 L116 252 M102 266 L116 268 M196 248 L184 252 M198 266 L184 268" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
      <Path d="M124 212 C136 204 164 204 176 212 C182 252 170 290 150 296 C130 290 118 252 124 212 Z" fill={p.light} />
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
      <Path d="M58 150 L44 158 L62 162 L52 172 L74 168 Z" fill={p.coat} />
      <Path d="M242 150 L256 158 L238 162 L248 172 L226 168 Z" fill={p.coat} />
      <Ellipse cx={150} cy={130} rx={92} ry={70} fill={p.light} />
      {/* tabby cap with inverted V down to the nose */}
      <Path
        d="M58 136 C56 86 100 60 150 60 C200 60 244 86 242 136 C224 128 196 120 176 124 L150 152 L124 124 C104 120 76 128 58 136 Z"
        fill={p.coat}
      />
      <Path d="M150 64 L150 86 M131 68 L135 86 M169 68 L165 86" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
      <Path d="M62 112 L80 116 M238 112 L220 116" stroke={p.patch} strokeWidth={6} strokeLinecap="round" />
    </G>
  ),
  face: (p) => (
    <G>
      <Ellipse cx={100} cy={160} rx={13} ry={8} fill={p.blush} opacity={0.45} />
      <Ellipse cx={200} cy={160} rx={13} ry={8} fill={p.blush} opacity={0.45} />
      <Path d="M142 148 L158 148 L150 157 Z" fill="#FF8AA2" strokeLinejoin="round" />
      <Path
        d="M150 157 L150 161 M139 161 Q145 168 150 161 Q155 168 161 161"
        stroke={p.ink}
        strokeWidth={2.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M118 156 L80 150 M118 163 L82 168 M182 156 L220 150 M182 163 L218 168"
        stroke="#C5C9D1"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </G>
  ),
  eyes: (p) => eyePair(p, 118, 182, 132, 10.5, 12.5),
  happyEyes: (p) => happyPair(p, 118, 182, 132, 11),
  tongue: () => (
    <G>
      <Ellipse cx={150} cy={166} rx={6.5} ry={5.5} fill="#FF7A93" />
    </G>
  ),
};

export const ART: Record<Species, SpeciesArt> = { dog: DOG, cat: CAT };
