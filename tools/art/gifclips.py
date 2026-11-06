"""Turn the Honey & Tabby GIFs (docs/art/gifs) into the animated pet's clips (the PetRig / ClipStage format).
Usage (repo root):  python3 tools/art/gifclips.py dog   |   python3 tools/art/gifclips.py cat
then:               python3 tools/art/dye.py dog        |   python3 tools/art/dye.py cat
Writes assets/pets/<species>/clips (sheets + clips.json) and src/animation/<species>Clips.ts.

Every clip is drawn in each drawn coat, as a gray sketch (the Waterllama-style colour-in) and as
accessory overlays (dog bandana / cat collar colours). Only the character is recoloured: props,
sparkles and confetti keep the colours they were drawn with."""
import json, math, os, sys
import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gifkit import frames as gif_frames, main_mask  # noqa: E402

SPECIES = sys.argv[1] if len(sys.argv) > 1 else 'dog'
OUT = f'assets/pets/{SPECIES}/clips'

# name: (gif, frame indices or None for all, loop, pingpong, sitting-height factor)
# The factor says how tall the character in this clip's first frame is compared with the same pet
# sitting upright (a lying dog is ~0.6 of its sitting height), so every clip shows the pet at one size.
DOG = {
    'idle': ('dog_cheer', [0, 7], True, True, 1.0),
    'sleep': ('dog_sleep', None, True, False, 0.66),
    'celebrate': ('dog_cheer', None, False, False, 1.0),
    'hello': ('dog_wave', None, False, False, 1.0),
    'idle2': ('dog_wave', None, False, False, 1.0),
    'eat': ('dog_eat', None, False, False, 1.0),
    'drink': ('dog_drink', None, False, False, 1.0),
    'walk': ('dog_trot', None, False, False, 1.0),
    'play': ('dog_play', None, False, False, 1.0),
    'meds': ('dog_meds', None, False, False, 1.0),
}
CAT = {
    'idle': ('cat_happy', None, True, False, 1.0),
    'sleep': ('cat_doze', None, True, False, 0.8),
    'celebrate': ('cat_wave', None, False, False, 1.0),
    'hello': ('cat_wave', None, False, False, 1.0),
    'idle2': ('cat_yarn', None, False, False, 1.0),
    'eat': ('cat_eat', None, False, False, 0.86),
    'drink': ('cat_drink', None, False, False, 0.86),
    'walk': ('cat_trot', None, False, False, 1.0),
    'play': ('cat_play', None, False, False, 0.84),
}
CLIPS = DOG if SPECIES == 'dog' else CAT


def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---- coats (same colour logic as the original video pipeline, tools/art/clips.py)
def recolor(rgb, pal):
    if pal == 'honey':
        return rgb
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1] / 255, hsv[:, :, 2] / 255
    warm = (h >= 8) & (h <= 32)
    w = smooth(s, 0.12, 0.6)
    if pal == 'cocoa':
        nh, ns, nv = np.full_like(h, 10), s * 0.95, v * (1 - 0.45 * w) - 0.03 * (1 - w)
    if pal == 'snow':
        nh, ns, nv = np.full_like(h, 18), s * 0.30, v * (1 - 0.10 * w)
    if pal == 'midnight':
        nh, ns, nv = np.full_like(h, 112), s * 0.22, v * (1 - 0.64 * w)
    o = np.stack([np.where(warm, nh, h), np.where(warm, np.clip(ns, 0, 1) * 255, s * 255), np.where(warm, np.clip(nv, 0, 1) * 255, v * 255)], -1).astype(np.uint8)
    return cv2.cvtColor(o, cv2.COLOR_HSV2RGB)


CAT_COATS = {'ginger': ('#F6A55E', '#DD7A2C'), 'tuxedo': ('#4A4A53', '#2A2A30'), 'cream': ('#ECD7BE', '#C9AA8A')}


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


def cat_recolor(rgb, pal):
    if pal == 'tabby':
        return rgb
    r = rgb.astype(np.float32)
    mx, mn = r.max(2), r.min(2)
    L = 0.3 * r[:, :, 0] + 0.59 * r[:, :, 1] + 0.11 * r[:, :, 2]
    coat, patch = (hexrgb(c) for c in CAT_COATS[pal])
    # this cat's gray fur: coat ~150, stripes ~105; outlines (<70) and white fur (>205) stay as drawn
    t = ((L - 105) / 45)[:, :, None]
    o = patch + (coat - patch) * t
    w = (smooth(L, 58, 78) * (1 - smooth(L, 190, 215)) * (1 - smooth(mx - mn, 18, 34)))[:, :, None]
    return np.clip(r * (1 - w) + o * w, 0, 255).astype(np.uint8)


def sketch(rgb):
    r = rgb.astype(np.float32)
    L = 0.3 * r[:, :, 0] + 0.59 * r[:, :, 1] + 0.11 * r[:, :, 2]
    V = r.max(2)
    coat = np.clip(232 + (L - 200) * 0.09, 224, 244)
    line = 118 + V * 0.12
    w = 1 - smooth(V, 92, 128)
    g = coat * (1 - w) + line * w
    return np.stack([g, g, np.clip(g + 3, 0, 255)], -1).astype(np.uint8)


def lum(rgb):
    """the art's own shading in gray: laid over the colour-in bands (luminosity blend) without tinting edges"""
    r = rgb.astype(np.float32)
    g = 0.3 * r[:, :, 0] + 0.59 * r[:, :, 1] + 0.11 * r[:, :, 2]
    return np.stack([g, g, g], -1).astype(np.uint8)


def hue_overlay(rgb, alpha, sel, t, vboost=1.0):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    th, sm, vm = t
    hsv[:, :, 0] = th
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sm, 0, 255)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * vm * vboost, 0, 255)
    o = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    m = cv2.GaussianBlur(sel.astype(np.float32), (0, 0), 0.9)
    return o, (np.minimum(m, alpha / 255) * 255).astype(np.uint8)


BAND = {'coral': (176, 0.82, 1.12), 'leaf': (48, 1.0, 0.95), 'sun': (22, 1.15, 1.15), 'berry': (136, 0.8, 1.0)}
COLLAR = {'teal': (88, 1.0, 0.95), 'leaf': (48, 1.0, 0.95), 'sun': (22, 1.1, 1.1), 'berry': (136, 0.85, 1.0)}


def bandana(rgb, main):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    return (hsv[:, :, 0] > 74) & (hsv[:, :, 0] < 97) & (hsv[:, :, 1] > 95) & (hsv[:, :, 2] > 55) & main


def collar(rgb, main):
    """The red collar: red shapes touching the golden bell (the open mouth and pink props are red too)."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    red = ((hsv[:, :, 0] <= 8) | (hsv[:, :, 0] >= 172)) & (hsv[:, :, 1] > 140) & (hsv[:, :, 2] > 90) & main
    bell = (hsv[:, :, 0] >= 18) & (hsv[:, :, 0] <= 32) & (hsv[:, :, 1] > 150) & (hsv[:, :, 2] > 170) & main
    n, lab, st, _ = cv2.connectedComponentsWithStats(bell.astype(np.uint8), 8)
    if n <= 1:
        return np.zeros_like(red)
    b = 1 + int(np.argmax(st[1:, 4]))
    near = cv2.dilate((lab == b).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    n2, lab2 = cv2.connectedComponents(red.astype(np.uint8), connectivity=8)
    keep = np.unique(lab2[near & red])
    return np.isin(lab2, keep[keep > 0])


# ---- build
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
manifest = {}
PER, COLS = 12, 4
for name, (gif, pick, loop, pingpong, factor) in CLIPS.items():
    allf, durs = gif_frames(gif)
    idx = pick if pick is not None else list(range(len(allf)))
    fr = [allf[i] for i in idx]
    dur = float(np.mean([durs[i] for i in idx]))
    fps = round(1000 / dur, 2) if pick is None else 1.6  # the two-frame idle breathes slowly
    al = [f[:, :, 3] for f in fr]
    mains = [main_mask(a) for a in al]
    U = np.zeros_like(al[0], bool)
    for a in al:
        U |= a > 10
    ys, xs = np.where(U)
    Hh, Ww = U.shape
    x0, x1, y0, y1 = max(0, xs.min() - 6), min(Ww, xs.max() + 7), max(0, ys.min() - 6), min(Hh, ys.max() + 7)
    fw, fh = x1 - x0, y1 - y0
    # sitting reference from the character in the first frame (not props or sparkles)
    m0 = mains[0]
    r0, c0 = np.where(m0)
    top, bottom = int(r0.min()), int(r0.max())
    upper = m0[top:top + int((bottom - top) * 0.45)]
    cx = float(np.where(upper)[1].mean())
    native = {'cx': cx, 'bottom': float(bottom), 'height': float((bottom - top) / factor)}
    n = len(fr)
    rows = math.ceil(min(n, PER) / COLS)
    sc = min(1.0, 2000 / (COLS * fw), 1500 / (rows * fh))
    tw, th = int(fw * sc), int(fh * sc)
    chunks = math.ceil(n / PER)
    sizes = {}

    def sheet(tag, color_fn=None, overlay_fn=None):
        for ci in range(chunks):
            ids = list(range(ci * PER, min(n, (ci + 1) * PER)))
            rws = math.ceil(len(ids) / COLS)
            S = np.zeros((rws * th, COLS * tw, 4), np.uint8)
            for j, i in enumerate(ids):
                f = fr[i][y0:y1, x0:x1]
                rgb, A = f[:, :, :3], f[:, :, 3]
                M = mains[i][y0:y1, x0:x1]
                if overlay_fn:
                    rgb, A = overlay_fn(rgb, A, M)
                elif color_fn:
                    rgb = color_fn(rgb) if tag in ('sketch', 'lum') else np.where(M[:, :, None], color_fn(rgb), rgb)
                rgba = cv2.resize(np.dstack([rgb, A]), (tw, th), interpolation=cv2.INTER_AREA)
                r, c = divmod(j, COLS)
                S[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = rgba
            p = f'{OUT}/{name}_{tag}_{ci}.webp'
            Image.fromarray(S).save(p, 'WEBP', quality=80, alpha_quality=85, method=6)
            sizes[tag] = sizes.get(tag, 0) + os.path.getsize(p) // 1024

    if SPECIES == 'cat':
        for pal in ['tabby', *CAT_COATS]:
            sheet(pal, lambda x, p=pal: cat_recolor(x, p))
        sheet('sketch', sketch)
        sheet('lum', lum)
        for col, t in COLLAR.items():
            sheet(f'collar_{col}', overlay_fn=lambda rgb, A, M, t=t: hue_overlay(rgb, A, collar(rgb, M), t, 1.12))
    else:
        for pal in ['honey', 'cocoa', 'snow', 'midnight']:
            sheet(pal, lambda x, p=pal: recolor(x, p))
        sheet('sketch', sketch)
        sheet('lum', lum)
        for b, t in BAND.items():
            sheet(f'band_{b}', overlay_fn=lambda rgb, A, M, t=t: hue_overlay(rgb, A, bandana(rgb, M), t))
    ref = {k: v * sc for k, v in {'cx': cx - x0, 'bottom': bottom - y0, 'top': top - y0}.items()}
    manifest[name] = {
        'gif': gif,
        'origin': [int(x0), int(y0)],
        'sc': float(sc),
        'native': native,
        'anchor': native,
        'loop': loop,
        'pingpong': pingpong,
        'frames': n,
        'fps': fps,
        'per': PER,
        'cols': COLS,
        'chunks': chunks,
        'fw': tw,
        'fh': th,
        'ref': ref,
    }
    print(name, gif, n, 'frames', f'{fps}fps', tw, 'x', th, sizes, flush=True)
manifest['_anchor'] = manifest['idle']['native']
json.dump(manifest, open(f'{OUT}/clips.json', 'w'), indent=1)

# ---- TypeScript asset map
if SPECIES == 'cat':
    tags = ['tabby', *CAT_COATS, 'sketch', 'lum', *[f'collar_{c}' for c in COLLAR]]
    L = ["/* Generated by tools/art/gifclips.py (assets/pets/cat/clips). Do not edit by hand. */", "import clips from '../../assets/pets/cat/clips/clips.json';", "", "export const CAT_CLIPS = clips;", "export type CatClipName = Exclude<keyof typeof clips, '_anchor'>;", "export type CatClipSheets = Record<string, number[]>;", "", "export const CAT_CLIP_IMG: Record<CatClipName, CatClipSheets> = {"]
else:
    tags = ['honey', 'cocoa', 'snow', 'midnight', 'sketch', 'lum', *[f'band_{b}' for b in BAND]]
    L = ["/* Generated by tools/art/gifclips.py (assets/pets/dog/clips). Do not edit by hand. */", "import clips from '../../assets/pets/dog/clips/clips.json';", "", "export const DOG_CLIPS = clips;", "export type DogClipName = Exclude<keyof typeof clips, '_anchor'>;", "export const DOG_ANCHOR = clips._anchor;", "export type DogClipSheets = Record<string, number[]>;", "", "export const DOG_CLIP_IMG: Record<DogClipName, DogClipSheets> = {"]
for name, c in manifest.items():
    if name.startswith('_'):
        continue
    L.append(f"  {name}: {{")
    for t in tags:
        L.append(f"    {t}: [" + ', '.join(f"require('../../assets/pets/{SPECIES}/clips/{name}_{t}_{i}.webp')" for i in range(c['chunks'])) + "],")
    L.append("  },")
L.append("};\n")
open(f'src/animation/{SPECIES}Clips.ts', 'w').write('\n'.join(L))
