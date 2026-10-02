#!/usr/bin/env python3
"""Synthesize the game's original sound effects (one file per Audio cue).

    python3 tools/synth_audio.py      -> assets/audio/<cue>.ogg

Everything is generated from oscillators, filtered noise and envelopes, so
there are no licensing questions. Cue names match src/client/Spectacle/Audio.luau.
"""
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44100
OUT = Path(__file__).resolve().parents[1] / "assets" / "audio"
rng = np.random.default_rng(7)


def t(d):
    return np.linspace(0, d, int(SR * d), endpoint=False)


def env(n, a=0.005, r=0.2, curve=3.0):
    x = np.linspace(0, 1, n)
    att = np.clip(x / max(a, 1e-4) * (n / SR), 0, 1) if a else 1
    return att * (1 - x) ** curve


def noise(d):
    return rng.uniform(-1, 1, int(SR * d))


def lowpass(x, k):
    # one-pole low-pass; k in (0,1], smaller = darker
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc)
        y[i] = acc
    return y


def sweep(d, f0, f1, shape="sine"):
    tt = t(d)
    f = f0 * (f1 / f0) ** (tt / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == "square":
        return np.sign(np.sin(ph))
    if shape == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    return np.sin(ph)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def echo(x, delay=0.18, fb=0.45, taps=4):
    out = np.copy(x)
    for i in range(1, taps + 1):
        d = int(SR * delay * i)
        pad = np.concatenate([np.zeros(d), x * fb**i])
        out = mix(out, pad)
    return out


CUES = {}
CUES["ui_click"] = lambda: sweep(0.04, 2400, 900, "square") * env(int(SR * 0.04), 0, 0, 4) * 0.4
CUES["ui_pop"] = lambda: sweep(0.12, 500, 1500) * env(int(SR * 0.12), 0, 0, 2)
CUES["whoosh_small"] = lambda: lowpass(noise(0.35), 0.15) * np.sin(np.linspace(0, np.pi, int(SR * 0.35)))
CUES["whoosh_big"] = lambda: lowpass(noise(0.9), 0.07) * np.sin(np.linspace(0, np.pi, int(SR * 0.9))) ** 0.6
CUES["pebble_windup"] = lambda: sweep(0.4, 200, 700) * 0.3 * np.linspace(0, 1, int(SR * 0.4))
CUES["pebble_plink"] = lambda: mix(sweep(0.25, 2600, 1800) * env(int(SR * 0.25), 0, 0, 6), lowpass(noise(0.05), 0.5) * 0.4)
CUES["pebble_echo"] = lambda: echo(sweep(0.15, 2200, 1600) * env(int(SR * 0.15), 0, 0, 6), 0.21, 0.5, 5)
CUES["shovel_scrape"] = lambda: lowpass(noise(0.4), 0.3) * env(int(SR * 0.4), 0.02, 0, 1.5)
CUES["pick_clang"] = lambda: mix(*(np.sin(2 * np.pi * f * t(0.6)) * env(int(SR * 0.6), 0, 0, 5) / (i + 1) for i, f in enumerate([780, 1240, 2010, 3150])))
CUES["jack_loop"] = lambda: np.tile(lowpass(noise(0.045), 0.4) * env(int(SR * 0.045), 0, 0, 2), 12)
CUES["fuse_hiss"] = lambda: (noise(1.2) - lowpass(noise(1.2), 0.3)) * 0.4
CUES["tick"] = lambda: sweep(0.03, 1800, 1700, "square") * env(int(SR * 0.03), 0, 0, 3) * 0.6
CUES["boom_small"] = lambda: mix(lowpass(noise(1.4), 0.04) * env(int(SR * 1.4), 0, 0, 2.5), sweep(0.6, 120, 40) * env(int(SR * 0.6), 0, 0, 2))
CUES["boom_big"] = lambda: mix(lowpass(noise(3.0), 0.02) * env(int(SR * 3.0), 0, 0, 1.8) * 1.2, sweep(1.5, 80, 25) * env(int(SR * 1.5), 0, 0, 1.5))
CUES["engine"] = lambda: lowpass(sweep(2.0, 55, 60, "saw"), 0.08) * (1 + 0.3 * np.sin(2 * np.pi * 9 * t(2.0)))
CUES["horn"] = lambda: mix(sweep(0.7, 330, 330, "saw"), sweep(0.7, 415, 415, "saw")) * env(int(SR * 0.7), 0.02, 0, 0.5) * 0.5
CUES["drill"] = lambda: lowpass(mix(sweep(2.5, 140, 420, "saw"), noise(2.5) * 0.3), 0.25)
CUES["rumble"] = lambda: lowpass(noise(3.0), 0.01) * 3
CUES["beam"] = lambda: mix(sweep(2.0, 300, 900), sweep(2.0, 303, 905)) * np.linspace(0.2, 1, int(SR * 2.0)) * 0.5
CUES["siren"] = lambda: np.sin(2 * np.pi * np.cumsum(600 + 250 * np.sin(2 * np.pi * 1.2 * t(1.0))) / SR) * 0.5
CUES["sonic"] = lambda: mix(lowpass(noise(1.5), 0.05) * env(int(SR * 1.5), 0, 0, 3), sweep(0.3, 60, 30) * env(int(SR * 0.3), 0, 0, 1))
CUES["find"] = lambda: mix(*(np.sin(2 * np.pi * f * t(0.9)) * env(int(SR * 0.9), 0, 0, 3) * (0.6 if i else 1) for i, f in enumerate([880, 1320, 1760])))
CUES["fanfare"] = lambda: np.concatenate([np.sin(2 * np.pi * f * t(d)) * env(int(SR * d), 0.01, 0, 1.2) for f, d in [(523, 0.18), (659, 0.18), (784, 0.18), (1047, 0.6)]])
CUES["crack"] = lambda: (noise(0.35) - lowpass(noise(0.35), 0.4)) * env(int(SR * 0.35), 0, 0, 6)
CUES["swing"] = lambda: lowpass(noise(0.3), 0.2) * np.sin(np.linspace(0, np.pi, int(SR * 0.3)))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in CUES.items():
        audio = norm(np.asarray(fn(), dtype=np.float64))
        fade = min(len(audio), 400)
        audio[-fade:] *= np.linspace(1, 0, fade)
        sf.write(OUT / f"{name}.ogg", audio.astype(np.float32), SR, format="OGG", subtype="VORBIS")
    print(f"wrote {len(CUES)} cues to {OUT}")


if __name__ == "__main__":
    main()
