#!/usr/bin/env python3
"""UI 효과음(SFX) 절차적 합성 — 잔잔한 가족 채널용 부드러운 효과음 8종 (샘플 없이 수학만으로).

사용법:
    python3 engine/audio/sfx.py --out assets/sfx

출력 (48 kHz · 스테레오 · 24-bit WAV, 피크 ≈ -6 dBFS, 부드러운 시작 · 페이드아웃, 짧은 꼬리, 고정 시드):
    pop      0.12 s  말랑한 버블 팝 (900→520 Hz 하강 글라이드 + 작은 트랜지언트)
    tick     0.08 s  부드러운 우드블록 체크 틱 (1.8 kHz 몸통)
    ding     1.40 s  은은한 벨 (A5, 비조화 배음)
    coin     0.60 s  B6 → E7 두 음 차임 (동전/혜택 금액)
    whoosh   0.70 s  공기 같은 전환음 (저→고 대역 스윕, 좌→우 이동)
    sparkle  0.90 s  F 펜타토닉 상행 작은 종 6음 + 가벼운 리버브
    swell    1.60 s  리버스 심벌 느낌의 라이저 + 희미한 F장조 화음 반짝임 (타이틀 카드 직전)
    click    0.05 s  아주 여린 UI 클릭 (목록 항목)
"""

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
PEAK_DB = -6.0
SEED = 20260926


def midi_hz(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def taxis(dur: float) -> np.ndarray:
    return np.arange(int(round(dur * SR))) / SR


def ramp(n: int) -> np.ndarray:
    """0 → 1 raised-cosine 램프 (첫 샘플 0)."""
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(n, 1))


def fade(x: np.ndarray, fin: float, fout: float) -> np.ndarray:
    """시작·끝을 raised-cosine으로 정확히 0까지 (클릭 방지). 제자리 수정."""
    ni, no = int(round(fin * SR)), int(round(fout * SR))
    sh = (-1,) + (1,) * (x.ndim - 1)
    x[:ni] *= ramp(ni).reshape(sh)
    x[len(x) - no:] *= ramp(no)[::-1].reshape(sh)
    return x


def bw(order: int, fc, btype: str) -> np.ndarray:
    return signal.butter(order, fc, btype=btype, fs=SR, output="sos")


def stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """등전력 팬 (중앙이면 좌우 모두 원래 크기)."""
    th = (pan + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2.0)


def partials(t: np.ndarray, f0: float, spec) -> np.ndarray:
    """(주파수 비율, 진폭, 감쇠 시간 τ, 위상) 목록 → 지수 감쇠 사인들의 합 (종·차임 음색)."""
    return sum(a * np.exp(-t / tau) * np.sin(2 * np.pi * f0 * r * t + ph) for r, a, tau, ph in spec)


def note_at(t: np.ndarray, t0: float, fn, attack: float = 0.002) -> np.ndarray:
    """t0에 시작하는 음 (시작 전은 0, 시작은 짧은 raised-cosine 어택)."""
    y = np.zeros_like(t)
    on = t >= t0
    tt = t[on] - t0
    y[on] = fn(tt) * np.minimum(1.0, 0.5 - 0.5 * np.cos(np.pi * np.minimum(tt / attack, 1.0)))
    return y


def small_reverb(x: np.ndarray, rng, rt60: float, wet: float, predelay: float = 0.012) -> np.ndarray:
    """짧은 합성 스테레오 리버브 (좌우 독립 노이즈 × 지수 감쇠, 5 kHz 위는 어둡게)."""
    n = int(min(1.4 * rt60, 1.5) * SR)
    t = np.arange(n) / SR
    pre = int(predelay * SR)
    ir = np.zeros((pre + n, 2))
    for ch in range(2):
        tail = signal.sosfilt(bw(2, 5000, "lowpass"), rng.standard_normal(n)) * np.exp(-6.9078 * t / rt60)
        tail = fade(tail, 0.004, 0.05)
        ir[pre:, ch] = tail / np.sqrt(np.sum(tail ** 2))
    y = np.stack([signal.fftconvolve(x[:, ch], ir[:, ch])[:len(x)] for ch in range(2)], axis=1)
    y *= np.sqrt(np.mean(x ** 2) / (np.mean(y ** 2) + 1e-20))
    return (1 - wet) * x + wet * y


def stft_filter(x: np.ndarray, gain_fn) -> np.ndarray:
    """시간에 따라 변하는 필터: STFT 각 프레임에 gain_fn(f, 프레임 시각) 마스크를 곱한다."""
    f, tt, z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
    z *= gain_fn(np.maximum(f, 1.0)[:, None], tt[None, :])
    return signal.istft(z, fs=SR, nperseg=1024, noverlap=768)[1][:len(x)]


def finalize(x: np.ndarray, fin: float, fout: float) -> np.ndarray:
    """페이드 → DC 제거(한 창 모양으로 빼서 양끝 0 유지) → 피크 -6 dBFS 정규화."""
    if x.ndim == 1:
        x = stereo(x)
    x = fade(x.copy(), fin, fout)
    w = np.hanning(len(x))
    x -= (x.mean(axis=0) / w.mean())[None, :] * w[:, None]
    x *= 10 ** (PEAK_DB / 20) / np.abs(x).max()
    assert np.isfinite(x).all() and np.abs(x[0]).max() == 0 and np.abs(x[-1]).max() == 0
    return x


# ============================================================ 효과음

def pop(rng) -> np.ndarray:
    t = taxis(0.12)
    f = 520 + 380 * np.exp(-t / 0.018)                       # 900 → 520 Hz 빠른 하강 글라이드
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = (np.sin(ph) + 0.12 * np.sin(2 * ph)) * np.exp(-t / 0.028)
    tr = signal.sosfilt(bw(2, (1500, 5000), "bandpass"), rng.standard_normal(len(t))) * np.exp(-t / 0.0015)
    return finalize(body + 0.10 * tr / np.abs(tr).max(), 0.0015, 0.03)


def tick(rng) -> np.ndarray:
    t = taxis(0.08)
    wood = partials(t, 1800, [(1.0, 1.0, 0.012, 0.0), (1.64, 0.30, 0.007, 0.5), (0.53, 0.20, 0.016, 1.1)])
    nz = signal.sosfilt(bw(2, (2000, 6000), "bandpass"), rng.standard_normal(len(t))) * np.exp(-t / 0.0012)
    x = signal.sosfilt(bw(2, 7000, "lowpass"), wood + 0.25 * nz / np.abs(nz).max())
    return finalize(x, 0.001, 0.02)


def ding(rng) -> np.ndarray:
    t = taxis(1.4)
    f0 = midi_hz(81)                                          # A5 = 880 Hz (BGM F장조의 3음)
    x = partials(t, f0, [(1.0, 1.0, 0.50, 0.0), (1.0017, 0.35, 0.45, 1.3),   # 1.5 Hz 맥놀이 (은은한 떨림)
                         (2.0, 0.18, 0.28, 0.4), (2.76, 0.10, 0.16, 2.1), (5.40, 0.035, 0.07, 0.9)])
    x = small_reverb(stereo(fade(x, 0.003, 0.0)), rng, rt60=1.0, wet=0.18)
    return finalize(x, 0.003, 0.35)


def coin(rng) -> np.ndarray:
    t = taxis(0.6)

    def chime(f0: float, tau: float):
        return lambda tt: partials(tt, f0, [(1.0, 1.0, tau, 0.0), (2.0, 0.22, 0.05, 0.3), (2.76, 0.07, 0.03, 1.0)])

    t2 = 0.075
    n1 = note_at(t, 0.0, chime(midi_hz(95), 0.06))            # B6
    gate = np.ones_like(t)                                    # 두 번째 음이 나오면 첫 음을 20 ms에 걸쳐 멈춤
    k0, k1 = int(t2 * SR), int((t2 + 0.02) * SR)
    gate[k0:k1], gate[k1:] = ramp(k1 - k0)[::-1], 0.0
    n2 = note_at(t, t2, chime(midi_hz(100), 0.16))            # E7
    x = signal.sosfilt(bw(2, 9000, "lowpass"), stereo(n1 * gate, -0.12) + stereo(n2, 0.12), axis=0)
    return finalize(small_reverb(x, rng, rt60=0.7, wet=0.12), 0.002, 0.15)


def whoosh(rng) -> np.ndarray:
    dur = 0.7
    t = taxis(dur)
    base, side = rng.standard_normal(len(t)), rng.standard_normal(len(t))
    w = lambda tt: np.clip(tt / dur, 0, 1) ** 0.75          # noqa: E731 (시간 왜곡: 앞쪽에서 빨리 올라감)

    def band(f, tt):                                          # 중심 300 Hz → 6.5 kHz로 올라가는 대역통과 (±0.8 옥타브)
        fc = 300 * (6500 / 300) ** w(tt)
        return np.exp(-0.5 * (np.log2(f / fc) / 0.8) ** 2)

    x = np.stack([stft_filter(base, band), stft_filter(0.8 * base + 0.6 * side, band)], axis=1)
    env = np.sin(np.pi * w(t)) ** 2                           # 올라갔다 사라지는 모양 (정점 ≈ 0.28 s)
    th = (-0.35 + 0.7 * t / dur + 1) * np.pi / 4              # 좌 → 우로 살짝 이동
    x *= (env * np.sqrt(2))[:, None] * np.stack([np.cos(th), np.sin(th)], axis=1)
    return finalize(signal.sosfilt(bw(2, 9000, "lowpass"), x, axis=0), 0.01, 0.06)


def sparkle(rng) -> np.ndarray:
    t = taxis(0.9)
    x = np.zeros((len(t), 2))
    for i, m in enumerate((84, 86, 89, 91, 93, 96)):         # C6 D6 F6 G6 A6 C7 (F 펜타토닉 상행)
        f0 = midi_hz(m)
        spec = [(1.0, 1.0, 0.10, 0.0), (2.0, 0.15, 0.05, 0.4), (2.76, 0.08, 0.03, 1.1)]   # 짧게 울려 음이 또렷하게
        bell = lambda tt, f0=f0, spec=spec: partials(tt, f0, spec)   # noqa: E731
        x += stereo(note_at(t, i * 0.055, bell) * 0.87 ** i, 0.25 if i % 2 == 0 else -0.25)  # 점점 여리게
    x = signal.sosfilt(bw(2, 10000, "lowpass"), x, axis=0)
    return finalize(small_reverb(x, rng, rt60=1.0, wet=0.25), 0.002, 0.25)


def swell(rng) -> np.ndarray:
    dur, tp = 1.6, 1.46                                       # tp: 정점 (그 뒤 0.14 s 페이드)
    t = taxis(dur)
    a, b = rng.standard_normal(len(t)), rng.standard_normal(len(t))

    def cymbal(f, tt):                                        # 1.5 kHz 위 심벌 대역, 차오를수록 밝아짐
        fc = 1500 * (9000 / 1500) ** (np.clip(tt / tp, 0, 1) ** 1.5)
        return 1 / (1 + (f / fc) ** 4) / (1 + (1500 / f) ** 4)

    nz = np.stack([stft_filter(a, cymbal), stft_filter(0.3 * a + 0.95 * b, cymbal)], axis=1)
    rise = np.exp(np.minimum(t - tp, 0) / 0.30)               # 역재생 감쇠 모양의 크레셴도
    chord = np.zeros(len(t))
    for i, m in enumerate((77, 81, 84, 89)):                  # F5 A5 C6 F6 (F장조) + ±4 cent 코러스
        for c in (-4, 4):
            chord += np.sin(2 * np.pi * midi_hz(m) * 2 ** (c / 1200) * t + i + c)
    shimmer = chord * (1 + 0.15 * np.sin(2 * np.pi * 5.5 * t)) * rise   # 노이즈와 같은 크레셴도
    nz /= np.abs(nz).max()
    x = nz * rise[:, None] + stereo(0.022 * shimmer)          # 화음은 희미하게 (노이즈 대비 -5 → 정점 -14 dB)
    return finalize(x, 0.02, dur - tp)


def click(rng) -> np.ndarray:
    t = taxis(0.05)
    x = partials(t, 2200, [(1.0, 1.0, 0.003, 0.0), (1.64, 0.25, 0.002, 0.7)])
    nz = signal.sosfilt(bw(2, 6000, "lowpass"), rng.standard_normal(len(t))) * np.exp(-t / 0.0008)
    x = signal.sosfilt(bw(2, 7000, "lowpass"), x + 0.08 * nz / np.abs(nz).max())
    return finalize(x, 0.0008, 0.015)


SFX = {"pop": pop, "tick": tick, "ding": ding, "coin": coin,
       "whoosh": whoosh, "sparkle": sparkle, "swell": swell, "click": click}


def main() -> None:
    ap = argparse.ArgumentParser(description="UI 효과음 합성")
    ap.add_argument("--out", default="assets/sfx", help="출력 폴더")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    print(f"{'file':<13}{'dur(s)':>7}{'peak dBFS':>11}{'RMS dBFS':>10}{'DC L':>10}{'DC R':>10}")
    for i, (name, fn) in enumerate(SFX.items()):
        x = fn(np.random.default_rng([SEED, i]))
        path = out / f"{name}.wav"
        sf.write(path, x, SR, subtype="PCM_24")
        y, sr = sf.read(path, always_2d=True)                 # 저장된 24-bit 파일로 검증
        dc = y.mean(axis=0)
        print(f"{path.name:<13}{len(y) / sr:7.3f}{20 * np.log10(np.abs(y).max()):11.2f}"
              f"{20 * np.log10(np.sqrt(np.mean(y ** 2))):10.2f}{dc[0]:+10.1e}{dc[1]:+10.1e}")


if __name__ == "__main__":
    main()
