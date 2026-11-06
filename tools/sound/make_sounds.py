"""Pavurio's sound effects, synthesised from scratch (no samples, nothing copied from other apps).
Usage (repo root): python3 tools/sound/make_sounds.py   → assets/sounds/<name>.m4a (+ docs/sounds preview .wav)

One palette so every sound belongs together: a soft wooden marimba and a glassy bell, tuned to the same
key (E major pentatonic, warmer than the usual C-major "ding"), short and quiet. Feedback for small actions
is a few dozen milliseconds; only real moments (a full day, a badge) get a little melody."""
import os
import subprocess
import numpy as np

SR = 44100
OUT = 'assets/sounds'
PREVIEW = '/tmp/pavurio-sounds'
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW, exist_ok=True)

# E major pentatonic, in Hz
E4, Fs4, Gs4, B4, Cs5, E5, Fs5, Gs5, B5, Cs6, E6, Fs6, Gs6, B6 = (329.63, 369.99, 415.30, 493.88, 554.37, 659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51, 1479.98, 1661.22, 1975.53)
B3, E3, Gs3 = 246.94, 164.81, 207.65


def t(sec):
    return np.arange(int(SR * sec)) / SR


def env(n, attack=0.004, decay=0.25):
    x = np.arange(n) / SR
    a = np.clip(x / attack, 0, 1)
    return a * np.exp(-x / decay)


def tail(sig, ms=25):
    """every note fades out over its last few ms: a cut-off note would click"""
    n = min(len(sig), int(SR * ms / 1000))
    sig = sig.copy()
    sig[-n:] *= np.linspace(1, 0, n) ** 2
    return sig


def marimba(f, dur=0.45, decay=0.16, bright=1.0):
    x = t(dur)
    # a bar's partials (1, ~4, ~9.9) decay much faster than the fundamental: the soft "wooden" knock
    s = np.sin(2 * np.pi * f * x) * np.exp(-x / decay)
    s += 0.32 * bright * np.sin(2 * np.pi * f * 3.93 * x) * np.exp(-x / (decay * 0.22))
    s += 0.10 * bright * np.sin(2 * np.pi * f * 9.8 * x) * np.exp(-x / (decay * 0.08))
    return tail(s * np.clip(x / 0.002, 0, 1))


def bell(f, dur=0.9, decay=0.35, index=1.2):
    x = t(dur)
    # gentle FM bell: modulator at 3.5x gives a glassy, not metallic, shimmer
    I = index * np.exp(-x / (decay * 0.5))
    s = np.sin(2 * np.pi * f * x + I * np.sin(2 * np.pi * f * 3.5 * x))
    return tail(s * env(len(x), 0.003, decay))


def pop(f0=520, f1=1100, dur=0.07):
    x = t(dur)
    f = f0 + (f1 - f0) * (x / dur) ** 0.5
    ph = 2 * np.pi * np.cumsum(f) / SR
    return tail(np.sin(ph) * np.sin(np.pi * np.clip(x / dur, 0, 1)) ** 1.5, 5)


def noise(dur, lo, hi, seed=1):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    w = rng.standard_normal(n)
    spec = np.fft.rfft(w)
    fr = np.fft.rfftfreq(n, 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(spec, n)


def whoosh(dur=0.28, up=True):
    x = t(dur)
    w = noise(dur, 600, 6000, seed=7)
    # a moving band (swept by amplitude-modulating two bands) reads as air passing by
    lo = noise(dur, 500, 1400, seed=3)
    hi = noise(dur, 2500, 7000, seed=5)
    p = x / dur if up else 1 - x / dur
    s = lo * (1 - p) + hi * p + 0.3 * w
    return s * np.sin(np.pi * x / dur) ** 2


def place(parts, total=None):
    """parts: list of (start_sec, signal, gain)"""
    end = max(int(st * SR) + len(sig) for st, sig, _ in parts)
    n = max(end, int((total or 0) * SR))
    out = np.zeros(n)
    for st, sig, g in parts:
        i = int(st * SR)
        out[i:i + len(sig)] += sig * g
    return out


def finish(sig, peak):
    sig = sig - np.mean(sig)
    m = np.max(np.abs(sig)) or 1
    sig = sig / m * peak
    # 3 ms fade at both ends: never a click
    f = int(SR * 0.003)
    sig[:f] *= np.linspace(0, 1, f)
    sig[-f:] *= np.linspace(1, 0, f)
    return sig


def tiny_room(sig, mix=0.12):
    """a hint of space so the sounds aren't dry; two short taps, no long tail"""
    out = np.copy(sig)
    for d, g in ((0.031, 0.5), (0.053, 0.3)):
        i = int(SR * d)
        out[i:] += sig[:-i] * g * mix
    return out


S = {}
# --- small, frequent
S['tap'] = (finish(marimba(Gs5, 0.09, 0.03, 0.6), 0.35), 'any button')
S['select'] = (finish(place([(0, pop(700, 1250, 0.05), 0.7), (0.012, marimba(B5, 0.12, 0.045, 0.5), 0.6)]), 0.45), 'picking an option')
S['tick'] = (finish(marimba(E6, 0.035, 0.008, 0.3), 0.22), 'wheel and slider detents')
S['toggle_on'] = (finish(place([(0, marimba(E5, 0.08, 0.03), 1), (0.045, marimba(B5, 0.1, 0.035), 1)]), 0.4), 'switch on')
S['toggle_off'] = (finish(place([(0, marimba(B5, 0.08, 0.03), 1), (0.045, marimba(E5, 0.1, 0.035), 1)]), 0.35), 'switch off')
S['pop'] = (finish(place([(0, pop(380, 900, 0.09), 1), (0.03, marimba(Gs5, 0.15, 0.05), 0.4)]), 0.5), 'creating something (the jelly +)')
# --- slide to confirm: rising plucks while dragging, then the release
S['slide_1'] = (finish(marimba(E5, 0.12, 0.05, 0.7), 0.32), 'slide, first quarter')
S['slide_2'] = (finish(marimba(Gs5, 0.12, 0.05, 0.7), 0.34), 'slide, half way')
S['slide_3'] = (finish(marimba(B5, 0.12, 0.05, 0.7), 0.36), 'slide, almost there')
S['slide_done'] = (finish(tiny_room(place([(0, whoosh(0.22, True), 0.35), (0.11, marimba(E6, 0.5, 0.2), 0.9), (0.11, bell(E6, 0.7, 0.3, 0.6), 0.35)])), 0.7), 'slide completed')
# --- care
S['log'] = (finish(tiny_room(place([(0, marimba(B5, 0.4, 0.14), 0.9), (0.075, marimba(E6, 0.6, 0.22), 1.0), (0.075, bell(E6, 0.8, 0.3, 0.8), 0.25)])), 0.75), 'a care logged')
S['complete'] = (finish(tiny_room(place([
    (0.00, marimba(E5, 0.4, 0.15), 0.8), (0.09, marimba(Gs5, 0.4, 0.15), 0.85), (0.18, marimba(B5, 0.4, 0.15), 0.9),
    (0.27, marimba(E6, 0.9, 0.35), 1.0), (0.27, bell(E6, 1.2, 0.45, 1.0), 0.4), (0.27, bell(B5, 1.2, 0.45, 0.8), 0.25), (0.27, bell(Gs5, 1.2, 0.45, 0.8), 0.2),
]), 0.2), 0.8), 'everything done today, walk finished, Pro unlocked')
S['badge'] = (finish(tiny_room(place(
    [(0.035 * i, bell(f, 0.5, 0.18, 0.7), 0.5) for i, f in enumerate((B5, Cs6, E6, Fs6, Gs6, B6))]
    + [(0.24, marimba(E6, 0.9, 0.35), 0.9), (0.24, bell(E5, 1.2, 0.5, 1.2), 0.45), (0.24, bell(B5, 1.2, 0.5, 0.9), 0.3)]
), 0.2), 0.8), 'a badge or milestone')
S['save'] = (finish(tiny_room(place([(0, marimba(Gs5, 0.3, 0.1), 0.8), (0.06, marimba(B5, 0.45, 0.16), 0.9)])), 0.6), 'something saved')
S['undo'] = (finish(place([(0, marimba(B5, 0.15, 0.05, 0.6), 0.8), (0.07, marimba(Fs5, 0.25, 0.08, 0.6), 0.8)]), 0.45), 'undo')
S['delete'] = (finish(place([(0, pop(420, 160, 0.12), 1.0), (0.0, marimba(B3, 0.25, 0.07, 0.4), 0.7)]), 0.5), 'something removed')
S['error'] = (finish(place([(0, marimba(Fs4, 0.18, 0.07, 0.5), 0.9), (0.1, marimba(E4, 0.3, 0.1, 0.5), 0.9)]), 0.5), 'something went wrong (soft, never a buzzer)')
S['restock'] = (finish(tiny_room(place([(0, marimba(Gs6, 0.15, 0.04), 0.6), (0.05, bell(B6, 0.45, 0.16, 0.9), 0.6), (0.11, bell(E6, 0.7, 0.25, 0.9), 0.6), (0.11, marimba(E6, 0.4, 0.14), 0.6)])), 0.65), 'bought / restocked')
S['photo'] = (finish(tiny_room(place([(0, noise(0.018, 2000, 9000, 11) * np.hanning(int(SR * 0.018)), 0.9), (0.05, noise(0.022, 1200, 6000, 13) * np.hanning(int(SR * 0.022)), 0.7), (0.12, marimba(B5, 0.35, 0.12), 0.6), (0.18, marimba(E6, 0.5, 0.18), 0.7)])), 0.6), 'a photo or moment kept')
S['walk_start'] = (finish(tiny_room(place([(0, marimba(E5, 0.2, 0.07), 0.8), (0.08, marimba(B5, 0.2, 0.07), 0.85), (0.16, marimba(E6, 0.4, 0.14), 0.9)])), 0.65), 'a walk starts')
S['pet'] = (finish(place([(0, pop(300, 720, 0.13), 0.9), (0.06, marimba(E6, 0.18, 0.05), 0.25)]), 0.45), 'tapping the pet')
S['open'] = (finish(whoosh(0.18, True), 0.12), 'a sheet opens')

lines = ['# Pavurio sounds (generated by tools/sound/make_sounds.py)', '', '| Sound | Used for | Length |', '|---|---|---|']
for name, (sig, use) in S.items():
    wav = f'{PREVIEW}/{name}.wav'
    pcm = (np.clip(sig, -1, 1) * 32767).astype('<i2')
    import wave
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '96k', f'{OUT}/{name}.m4a'], check=True)
    lines.append(f'| `{name}` | {use} | {len(sig) / SR * 1000:.0f} ms |')
    print(name, f'{len(sig) / SR:.2f}s', os.path.getsize(f'{OUT}/{name}.m4a'), 'B')
open('docs/SOUNDS.md', 'w').write('\n'.join(lines) + '\n')
