#!/usr/bin/env python3
"""배경음악(BGM) 절차적 합성 — 샘플·다운로드 없이 수학만으로 만드는 저작권 프리 음원.

사용법:
    python3 engine/audio/bgm.py --duration 312.0 --out build/01-parental-leave/bgm.wav \
        [--sections 0,26.4,130.5,228.9,291.7]

음악 설계
    84 BPM · 4/4 · F장조 · 8마디 화성 루프
      | Fmaj9 | Am7 | Dm9 | Bbmaj7 | Gm9 | C7sus4 → C7 | Am7 | Bbmaj7 | (→ Fmaj9)
    악기(전부 합성): 펠트 피아노(가산 합성) · 오르골(F 펜타토닉 2마디 모티프) · 서브 베이스 ·
                    디튠 패드 · 아주 여린 셰이커/브러시(중간 구간만)
    구성: intro(피아노+패드, 2초 페이드인) → A(+베이스·오르골) → B(모티프 변주, +셰이커)
          → C(+브러시, 가장 풍성) → outro(피아노+오르골+패드) → 마지막 Fmaj9 울림 + 4초 페이드아웃
    구간 경계는 --sections 시각에서 가장 가까운 마디선으로 맞추고, 각 구간은 Fmaj9에서 새 프레이즈로
    시작한다(직전 마디는 IV 또는 V 턴어라운드). 레이어 증감은 1마디 크로스페이드.

출력: 48 kHz · 스테레오 · 24-bit WAV, 정확히 duration 초, 통합 음량 -20 LUFS, True Peak ≤ -1.5 dBTP.
고정 시드라 매번 같은 파일이 나온다.
"""

import argparse
import json
import re
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import ndimage, signal

SR = 48000
PAD_SR = 16000              # 패드는 1.2 kHz 이하만 쓰므로 16 kHz로 합성 후 업샘플 (속도)
BPM = 84.0
BEAT = 60.0 / BPM           # 0.714 s
BAR = 4 * BEAT              # 2.857 s
SEED = 20260926
MIN_FADE = 0.005            # 모든 음 버퍼 양끝 최소 페이드 (클릭 방지)
PEDAL_LAG = 0.03            # 화음이 바뀐 뒤 댐퍼 페달을 바꾸는 지연
RING_MIN = 5.0              # 마지막 Fmaj9가 울릴 최소 시간
FADE_IN, FADE_OUT = 2.0, 4.0
TARGET_LUFS = -20.0
TP_LIMIT = -1.5             # 사양 상한 (dBTP)
TP_GOAL = -2.0              # 내부 목표 (0.5 dB 여유)
WET_DB = -11.0              # 리버브 wet/dry RMS 비 = 0.28 ≈ 22% wet
SECTION_NAMES = ("intro", "A", "B", "C", "outro")
DEFAULT_SECTIONS = "0,26.4,130.5,228.9,291.7"

# ============================================================ 음악 이론 · 음표 표

PC = {"C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
PC_NAME = {v: k for k, v in PC.items()}
F_MAJOR = {PC[n] for n in "F G A Bb C D E".split()}
F_PENTA = {PC[n] for n in "F G A C D".split()}


def nm(m: int) -> str:
    return f"{PC_NAME[m % 12]}{m // 12 - 1}"


def parse_note(s: str) -> int:
    g = re.fullmatch(r"([A-G]b?)(\d)", s)
    return PC[g.group(1)] + 12 * (int(g.group(2)) + 1)


def midi_hz(m: float) -> float:
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


QUALITY = {  # 근음으로부터의 반음 간격 (R, 3/4, 5, 7, 9)
    "maj9": (0, 4, 7, 11, 14), "m7": (0, 3, 7, 10), "m9": (0, 3, 7, 10, 14),
    "maj7": (0, 4, 7, 11), "7sus4": (0, 5, 7, 10), "7": (0, 4, 7, 10),
}
CHORDS = {"Fmaj9": ("F", "maj9"), "Am7": ("A", "m7"), "Dm9": ("D", "m9"), "Bbmaj7": ("Bb", "maj7"),
          "Gm9": ("G", "m9"), "C7sus4": ("C", "7sus4"), "C7": ("C", "7")}
# 오르골 선율이 피할 음 (화음 구성음과 반음 충돌): Am7의 F(b13), C7의 F(11), C7sus4의 A(b7과 반음)
AVOID = {"Am7": {PC["F"]}, "C7": {PC["F"]}, "C7sus4": {PC["A"]}}


def chord_pcs(name: str) -> set:
    root, q = CHORDS[name]
    return {(PC[root] + i) % 12 for i in QUALITY[q]}


LOOP = (  # 8마디 루프: 마디별 ((박 위치, 화음), ...)
    ((0, "Fmaj9"),), ((0, "Am7"),), ((0, "Dm9"),), ((0, "Bbmaj7"),),
    ((0, "Gm9"),), ((0, "C7sus4"), (2, "C7")), ((0, "Am7"),), ((0, "Bbmaj7"),),
)
FINAL = ((0, "Fmaj9"),)

# 피아노: 왼손 근음 | 오른손 4음. 윗성부는 G4-A4-Bb4 근처에 머물고(오르골 선율 아래),
# 안성부는 공통음 유지 + 순차 진행 (예: Dm9→Bbmaj7: C4→A3, E4→D4, F4·A4 유지).
PIANO = {
    "Fmaj9":  (53, (57, 60, 64, 67)),   # F3  | A3 C4 E4 G4
    "Am7":    (57, (60, 64, 67, 69)),   # A3  | C4 E4 G4 A4
    "Dm9":    (50, (60, 64, 65, 69)),   # D3  | C4 E4 F4 A4
    "Bbmaj7": (46, (57, 62, 65, 69)),   # Bb2 | A3 D4 F4 A4
    "Gm9":    (55, (58, 62, 65, 69)),   # G3  | Bb3 D4 F4 A4
    "C7sus4": (48, (55, 60, 65, 70)),   # C3  | G3 C4 F4 Bb4 (4도 쌓기)
    "C7":     (48, (55, 60, 64, 70)),   # C3  | G3 C4 E4 Bb4 (F4→E4 해결)
}
PIANO_FINAL = (53, (57, 60, 64, 67, 72))  # 마지막 Fmaj9: F3 | A3 C4 E4 G4 C5
PAD = {  # 저역 근음 + 가이드톤(3·7도) 중심, 공통음은 끊지 않고 이어감
    "Fmaj9":  (41, 53, 57, 64),   # F2 F3 A3 E4
    "Am7":    (45, 55, 60, 64),   # A2 G3 C4 E4
    "Dm9":    (50, 53, 60, 64),   # D3 F3 C4 E4
    "Bbmaj7": (46, 53, 57, 62),   # Bb2 F3 A3 D4
    "Gm9":    (43, 53, 58, 62),   # G2 F3 Bb3 D4
    "C7sus4": (48, 55, 58, 65),   # C3 G3 Bb3 F4
    "C7":     (48, 55, 58, 64),   # C3 G3 Bb3 E4
}
BASS = {"Fmaj9": 29, "Am7": 33, "Dm9": 38, "Bbmaj7": 34, "Gm9": 31, "C7sus4": 36, "C7": 36}   # F1–F2 근음
BASS5 = {"Fmaj9": 36, "Am7": 40, "Dm9": 33, "Bbmaj7": 29, "Gm9": 38, "C7sus4": 31, "C7": 31}  # 3박 5음


def _motif(spec: dict) -> dict:
    return {s: tuple((b, parse_note(n), v) for b, n, v in notes) for s, notes in spec.items()}


# 오르골 모티프 (슬롯 → (박, 음, 세기)). 2마디 = 콜(3음) + 응답(2~3음), 4번 반복하며 화음 따라 변형.
MOTIF_A = _motif({
    0: [(0.0, "C6", .90), (1.5, "A5", .70), (2.5, "G5", .75)],
    1: [(0.0, "C6", .85), (2.0, "G5", .70)],
    2: [(0.0, "D6", .90), (1.5, "C6", .70), (2.5, "A5", .75)],
    3: [(0.0, "D6", .85), (2.0, "A5", .70)],
    4: [(0.0, "D6", .90), (1.5, "A5", .70), (2.5, "G5", .75)],
    5: [(0.0, "F5", .80), (2.0, "G5", .75)],
    6: [(0.0, "C6", .90), (1.5, "A5", .70), (2.5, "G5", .75)],
    7: [(0.0, "A5", .80), (2.0, "F5", .70)],
})
MOTIF_B = _motif({  # B 구간: 상행 콜 + 당김음 응답
    0: [(0.0, "F5", .75), (1.0, "A5", .70), (2.0, "C6", .85)],
    1: [(0.5, "D6", .60), (1.0, "C6", .75), (2.5, "A5", .70)],
    2: [(0.0, "F5", .75), (1.0, "A5", .70), (2.0, "D6", .85)],
    3: [(0.5, "C6", .60), (1.0, "A5", .75), (2.5, "F5", .70)],
    4: [(0.0, "G5", .75), (1.0, "A5", .70), (2.0, "D6", .85)],
    5: [(0.5, "D6", .60), (1.0, "C6", .75), (2.5, "G5", .70)],
    6: [(0.0, "G5", .75), (1.0, "A5", .70), (2.0, "C6", .85)],
    7: [(0.5, "D6", .60), (1.0, "C6", .75), (2.5, "A5", .70)],
})
FINAL_MOTIF = _motif({0: [(0.0, "C6", .70), (1.5, "A5", .55), (3.0, "F5", .50)]})[0]
CALL_SLOTS = (0, 2, 4, 6)


def vary(motif: dict) -> dict:
    """짝수 번째 반복용 변주: 콜 마디는 2·3번째 음 순서 교환, 응답 마디는 마지막 음을 8분음표 늦춤."""
    out = {}
    for slot, notes in motif.items():
        notes = list(notes)
        if slot in CALL_SLOTS and len(notes) >= 3:
            (b1, m1, v1), (b2, m2, v2) = notes[1], notes[2]
            notes[1], notes[2] = (b1, m2, v1), (b2, m1, v2)
        elif notes[-1][0] + 0.5 < 4:
            b, m, v = notes[-1]
            notes[-1] = (b + 0.5, m, v)
        out[slot] = tuple(notes)
    return out


def thin(motif: dict, scale: float = 0.85) -> dict:
    """아웃트로: 각 마디 첫 박 음만 남기고 조금 여리게."""
    return {s: tuple((b, m, v * scale) for b, m, v in notes if b == 0.0) for s, notes in motif.items()}


MOTIFS = {  # 구간 → 루프 반복 회차별 모티프 (회차 % 개수)
    "A": (MOTIF_A, vary(MOTIF_A)),
    "B": (MOTIF_B, vary(MOTIF_B)),
    "C": (MOTIF_A, MOTIF_B, vary(MOTIF_A), vary(MOTIF_B)),
    "outro": (thin(MOTIF_A),),
}

# 편곡: 구간별 피아노 리듬 (박, 종류, 세기). R=전체 롤, U=오른손, T=윗 두 음
PIANO_PATTERN = {
    "intro": ((0.0, "R", 0.80), (1.5, "U", 0.50)),
    "A":     ((0.0, "R", 0.86), (1.5, "U", 0.56)),
    "B":     ((0.0, "R", 0.86), (1.5, "U", 0.56), (3.0, "T", 0.40)),
    "C":     ((0.0, "R", 0.90), (1.5, "U", 0.60), (3.0, "U", 0.46), (3.5, "T", 0.36)),
    "outro": ((0.0, "R", 0.80), (1.5, "U", 0.48)),
}
BASS_FIFTH_SLOTS = {"A": (), "B": (3, 7), "C": (0, 1, 3, 4)}
SHAKER_VEL = (0.55, 0.90, 0.60, 0.95, 0.55, 0.90, 0.60, 1.00)   # 8분음표, '앤'에 강세
LEVELS = {  # 구간별 레이어 음량 (선형, 보정 후 곱함). 0 → 해당 구간에서 연주하지 않음
    "piano":    {"intro": 0.72, "A": 1.00, "B": 1.00, "C": 1.00, "outro": 0.90},
    "pad":      {"intro": 1.00, "A": 0.85, "B": 0.90, "C": 1.10, "outro": 1.00},
    "bass":     {"intro": 0.00, "A": 1.00, "B": 1.00, "C": 1.00, "outro": 0.00},
    "musicbox": {"intro": 0.00, "A": 1.00, "B": 1.00, "C": 1.05, "outro": 0.90},
    "shaker":   {"intro": 0.00, "A": 0.00, "B": 1.00, "C": 1.00, "outro": 0.00},
    "brush":    {"intro": 0.00, "A": 0.00, "B": 0.00, "C": 1.00, "outro": 0.00},
}
REL_DB = {"pad": -9.0, "bass": -6.0, "musicbox": -8.0}   # 피아노 대비 K-가중 음량 (C 구간 기준)
PERC_REL_DB, BRUSH_VS_SHAKER_DB = -12.0, -2.0            # 타악기 합계는 피아노보다 12 dB 작게
SENDS = {"piano": 0.9, "pad": 0.7, "bass": 0.0, "musicbox": 1.6, "shaker": 0.35, "brush": 0.5}


def validate_tables() -> None:
    """음표 표 검증: F장조 밖의 음(B natural 등) 금지, 보이싱 ⊆ 화음, 음역, 가이드톤, 오르골 충돌음."""
    for name, (root, q) in CHORDS.items():
        pcs = chord_pcs(name)
        assert pcs <= F_MAJOR, f"{name}: F장조 밖의 음 {[PC_NAME[p] for p in pcs - F_MAJOR]}"
        lh, rh = PIANO[name]
        assert lh % 12 == PC[root] and lh < rh[0] and list(rh) == sorted(rh), name
        assert {m % 12 for m in (lh, *rh)} <= pcs, f"{name}: 피아노 보이싱에 화음 밖의 음"
        guide = {(PC[root] + QUALITY[q][1]) % 12, (PC[root] + QUALITY[q][3]) % 12}
        assert guide <= {m % 12 for m in rh}, f"{name}: 오른손에 3(4)도·7도 필요"
        assert 46 <= lh <= 58 and 55 <= rh[0] and rh[-1] <= 76, f"{name}: 음역 (Bb2–E5)"
        assert {m % 12 for m in PAD[name]} <= pcs and PAD[name][0] % 12 == PC[root], name
        assert BASS[name] % 12 == PC[root] and 29 <= BASS[name] <= 41 and 29 <= BASS5[name] <= 41
        assert BASS5[name] % 12 == (PC[root] + 7) % 12, f"{name}: 5음"
    assert {m % 12 for m in (PIANO_FINAL[0], *PIANO_FINAL[1])} <= chord_pcs("Fmaj9")
    variants = [m for ms in MOTIFS.values() for m in ms] + [MOTIF_A, MOTIF_B]
    for motif in variants:
        for slot, notes in motif.items():
            for beat, m, _ in notes:
                chord = [c for b, c in LOOP[slot] if beat >= b][-1]
                assert 77 <= m <= 86 and m % 12 in F_PENTA, f"오르골 음 {nm(m)} (F5–D6 펜타토닉)"
                assert m % 12 not in AVOID.get(chord, ()), f"오르골 {nm(m)} 이(가) {chord} 와 충돌"
    for _, m, _ in FINAL_MOTIF:
        assert m % 12 in F_PENTA and m % 12 not in AVOID.get("Fmaj9", ())


# ============================================================ 곡 구성 (마디 계획)

@dataclass
class Bar:
    index: int
    section: str
    slot: int            # 루프 슬롯 0–7 (구간 마지막 마디는 턴어라운드로 바뀔 수 있음)
    loop: int            # 구간 안에서 몇 번째 루프인지 (모티프 변주 선택)
    final: bool = False  # 마지막 Fmaj9 (끝까지 울림)

    @property
    def t0(self) -> float:
        return self.index * BAR

    @property
    def chords(self):
        return FINAL if self.final else LOOP[self.slot]

    def chord_at(self, beat: float) -> tuple:
        """박 위치의 (화음 이름, 화음 구간 끝 시각)."""
        cs = self.chords
        k = max(i for i, (b, _) in enumerate(cs) if beat >= b)
        end = self.t0 + (cs[k + 1][0] * BEAT if k + 1 < len(cs) else BAR)
        return cs[k][1], end


def turnaround(slot: int) -> int:
    """구간 마지막 마디 → 다음 구간 첫 Fmaj9로: IV(Bbmaj7) 또는 V(C7sus4→C7)."""
    if slot in (3, 5, 7):
        return slot
    return 5 if slot == 4 else 7


def build_plan(duration: float, times: list) -> tuple:
    end_bar = max(1, int(np.floor((duration - RING_MIN) / BAR)))
    starts = [min(max(int(round(t / BAR)), 0), end_bar) for t in times]
    starts[0] = 0
    for i in range(1, len(starts)):
        starts[i] = max(starts[i], starts[i - 1])
    bars = []
    for i, name in enumerate(SECTION_NAMES):
        b0, b1 = starts[i], (starts[i + 1] if i + 1 < len(starts) else end_bar)
        for j in range(b1 - b0):   # 구간마다 루프를 Fmaj9부터 새로 시작
            bars.append(Bar(b0 + j, name, j % 8, j // 8))
        if b1 > b0:
            bars[-1].slot = turnaround(bars[-1].slot)
    bars.append(Bar(end_bar, "outro", 0, 0, final=True))
    return bars, starts, end_bar


def section_spans(bars: list, duration: float) -> list:
    heads = []
    for b in bars:
        if not heads or heads[-1][0] != b.section:
            heads.append((b.section, b.t0))
    return [(n, t, heads[i + 1][1] if i + 1 < len(heads) else duration) for i, (n, t) in enumerate(heads)]


def chord_label(b: Bar) -> str:
    return "C7sus4>C7" if len(b.chords) > 1 else b.chords[0][1]


def print_tables() -> None:
    print("[화성표] 8마디 루프 · F장조 · MIDI 번호 (C4 = 60)")
    print(f"  {'bar':<4}{'chord':<8}{'piano  LH | RH':<44}{'pad':<18}{'bass':<14}music box  A / B")
    for slot, chords in enumerate(LOOP):
        for k, (beat, ch) in enumerate(chords):
            lh, rh = PIANO[ch]
            piano = f"{nm(lh)}({lh}) | " + " ".join(f"{nm(m)}({m})" for m in rh)
            pad = " ".join(nm(m) for m in PAD[ch])
            bass = f"{nm(BASS[ch])}({BASS[ch]})/{nm(BASS5[ch])}"
            lab = f"{slot + 1}{'ab'[k] if len(chords) > 1 else ''}"
            mb = ""
            if k == 0:
                mb = " ".join(nm(m) for _, m, _ in MOTIF_A[slot]) + "  /  " + \
                     " ".join(nm(m) for _, m, _ in MOTIF_B[slot])
            print(f"  {lab:<4}{ch:<8}{piano:<44}{pad:<18}{bass:<14}{mb}")
    lh, rh = PIANO_FINAL
    print(f"  end Fmaj9   {nm(lh)}({lh}) | " + " ".join(f"{nm(m)}({m})" for m in rh)
          + "   music box " + " ".join(nm(m) for _, m, _ in FINAL_MOTIF))
    print("  검증 통과: 모든 음 F장조(Bb, E natural), 보이싱 ⊆ 화음, 3·7도 포함, 오르골 F5–D6 펜타토닉·충돌음 없음")


def print_plan(bars: list, times: list, starts: list, spans: list) -> None:
    print(f"\n[구성] 84 BPM · 1마디 = {BAR:.3f}s")
    for name, t0, t1 in spans:
        sec = [b for b in bars if b.section == name]
        req = times[SECTION_NAMES.index(name)]
        print(f"  {name:<6} 요청 {req:6.1f}s → 마디 {sec[0].index:3d}–{sec[-1].index:3d}  ({t0:6.2f}–{t1:6.2f}s)")
        labels = [chord_label(b) + ("(end)" if b.final else "") for b in sec]
        for k in range(0, len(labels), 8):
            print("         " + " ".join(f"{x:<10}" for x in labels[k:k + 8]))


# ============================================================ DSP 헬퍼

def ramp(n: int) -> np.ndarray:
    """0 → 1 raised-cosine 램프 (첫 샘플 0)."""
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / max(n, 1))


def fade_edges(x: np.ndarray, fade_in: float = MIN_FADE, fade_out: float = MIN_FADE, sr: int = SR) -> np.ndarray:
    """버퍼 양끝을 0까지 부드럽게 (모든 음 버퍼에 최소 5 ms → 클릭 없음). 제자리 수정."""
    ni = min(len(x), int(round(max(fade_in, MIN_FADE) * sr)))
    no = min(len(x), int(round(max(fade_out, MIN_FADE) * sr)))
    x[:ni] *= ramp(ni).reshape((-1,) + (1,) * (x.ndim - 1))
    x[len(x) - no:] *= ramp(no)[::-1].reshape((-1,) + (1,) * (x.ndim - 1))
    return x


def pan_gains(pan: float) -> tuple:
    th = (pan + 1.0) * np.pi / 4.0      # 등전력 팬
    return np.cos(th), np.sin(th)


def add_mono(bus: np.ndarray, x: np.ndarray, start: int, pan: float = 0.0) -> None:
    assert start >= 0
    if start >= len(bus):
        return
    n = min(len(x), len(bus) - start)
    gl, gr = pan_gains(pan)
    bus[start:start + n, 0] += gl * x[:n]
    bus[start:start + n, 1] += gr * x[:n]


def bw(order: int, fc, btype: str, sr: int = SR) -> np.ndarray:
    return signal.butter(order, fc, btype=btype, fs=sr, output="sos")


def rbj(kind: str, f0: float, gain_db: float, q: float = 0.707) -> np.ndarray:
    """RBJ Audio-EQ-Cookbook biquad (highshelf / peak) → sos."""
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    cw, alpha = np.cos(w0), np.sin(w0) / (2 * q)
    if kind == "peak":
        b = [1 + alpha * a, -2 * cw, 1 - alpha * a]
        den = [1 + alpha / a, -2 * cw, 1 - alpha / a]
    else:  # highshelf
        sq = 2 * np.sqrt(a) * alpha
        b = [a * ((a + 1) + (a - 1) * cw + sq), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - sq)]
        den = [(a + 1) - (a - 1) * cw + sq, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - sq]
    return np.array([b + den]) / den[0]


# BS.1770 K-가중 필터 (48 kHz 계수)
K_SOS = np.array([[1.53512485958697, -2.69169618940638, 1.19839281085285, 1.0, -1.69065929318241, 0.73248077421585],
                  [1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621]])


def kpower(x: np.ndarray) -> float:
    y = signal.sosfilt(K_SOS, x.astype(np.float64), axis=0)
    return float(np.mean(np.sum(y * y, axis=1)))


def lufs(x: np.ndarray) -> float:
    """ITU-R BS.1770-4 통합 음량 (400 ms 블록, 75% 겹침, -70 LUFS 절대 · -10 LU 상대 게이트)."""
    y = signal.sosfilt(K_SOS, x.astype(np.float64), axis=0)
    cs = np.concatenate([[0.0], np.cumsum(np.sum(y * y, axis=1))])
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    st = np.arange(0, len(y) - blk + 1, hop)
    z = (cs[st + blk] - cs[st]) / blk
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return float(-0.691 + 10 * np.log10(z.mean()))


def true_peak_db(x: np.ndarray, os: int = 4) -> float:
    """4배 오버샘플링 True Peak. 샘플 피크보다 6 dB 넘게 낮은 블록은 후보에서 제외 (속도)."""
    blk, pad = 4096, 32
    nb = -(-len(x) // blk)
    a = np.zeros((nb * blk, x.shape[1]))
    a[:len(x)] = np.abs(x)
    bmax = a.reshape(nb, -1).max(axis=1)
    peak = float(bmax.max())
    for i in np.flatnonzero(bmax >= peak * 0.5):
        s, e = max(0, i * blk - pad), min(len(x), (i + 1) * blk + pad)
        y = signal.resample_poly(x[s:e], os, 1, axis=0)
        lo = (i * blk - s) * os
        peak = max(peak, float(np.abs(y[lo:lo + (min(len(x), (i + 1) * blk) - i * blk) * os]).max()))
    return 20 * np.log10(peak + 1e-20)


# ============================================================ 악기

class FeltPiano:
    """가산 합성 펠트 피아노: 배음 ≤10개(약한 비조화성), 2단 지수 감쇠, 두 줄 유니즌 디튠, 여린 해머 노크."""
    TILT = {"soft": 2.5, "mid": 2.1, "loud": 1.8, "end": 2.1}      # 배음 기울기 (클수록 어두움)
    ATTACK = {"soft": 0.014, "mid": 0.012, "loud": 0.010, "end": 0.014}

    def __init__(self):
        self.cache = {}

    @staticmethod
    def layer(vel: float) -> str:
        return "soft" if vel < 0.5 else ("mid" if vel < 0.75 else "loud")

    def note(self, midi: int, layer: str) -> np.ndarray:
        if (midi, layer) not in self.cache:
            self.cache[(midi, layer)] = self._synth(midi, layer)
        return self.cache[(midi, layer)]

    def _synth(self, midi: int, layer: str) -> np.ndarray:
        rng = np.random.default_rng([SEED, 11, midi, list(self.TILT).index(layer)])
        f0 = midi_hz(midi)
        n = int((8.0 if layer == "end" else 3.5) * SR)   # 일반 음은 화음 전환 때 댐핑되므로 3.5 s면 충분
        t = np.arange(n) / SR
        tau_fast = 0.30 * (262.0 / f0) ** 0.2                        # 초기 타건음
        tau_slow = 3.0 * (262.0 / f0) ** 0.35 * (1.6 if layer == "end" else 1.0)   # 여음 (저음일수록 길게)
        out, norm = np.zeros(n), 0.0
        for k in range(1, 11):
            fk = k * f0 * np.sqrt(1.0 + 3e-4 * k * k)                  # 현의 비조화성
            if fk > 4500:
                break
            ak = k ** -self.TILT[layer]
            env = 0.6 * np.exp(-t * (1 + 0.35 * (k - 1)) / tau_fast) + 0.4 * np.exp(-t * (1 + 0.45 * (k - 1)) / tau_slow)
            strings = sum(np.sin(2 * np.pi * fk * 2 ** (c / 1200) * t + rng.uniform(0, 2 * np.pi)) for c in (-0.8, 0.8))
            out += 0.5 * ak * env * strings
            norm += ak
        out /= norm
        m = int(0.06 * SR)                                              # 펠트 해머 노크 (-30 dB)
        knock = signal.sosfilt(bw(2, 1000, "lowpass"), rng.standard_normal(m)) * np.exp(-t[:m] / 0.012)
        out[:m] += 0.03 * fade_edges(knock / np.abs(knock).max(), 0.005, 0.02)
        return fade_edges(out, self.ATTACK[layer], 0.03).astype(np.float32)


def musicbox_tone(midi: int) -> np.ndarray:
    """오르골/칼림바: 사인 + 희미한 2·3배음, 빠른 감쇠 (-40 dB까지 약 1 s)."""
    f0, n = midi_hz(midi), int(1.9 * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.22)
         + 0.10 * np.sin(2 * np.pi * 2 * f0 * t + 0.7) * np.exp(-t / 0.09)
         + 0.035 * np.sin(2 * np.pi * 3 * f0 * t + 1.9) * np.exp(-t / 0.05))
    return fade_edges(x, 0.005, 0.03).astype(np.float32)


def bass_tone(midi: int, dur: float, rel: float = 0.09) -> np.ndarray:
    """서브 베이스: 사인 + 약한 2배음, 20 ms 부드러운 어택, 약간 감쇠 후 유지, 90 ms 릴리스."""
    n_on = int(dur * SR)
    n = n_on + int(rel * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * midi_hz(midi) * t
    env = 0.75 + 0.25 * np.exp(-t / 0.8)
    env[n_on:] *= ramp(n - n_on)[::-1]
    return fade_edges((np.sin(ph) + 0.22 * np.sin(2 * ph)) * env, 0.020)


def blep_saw(f: float, n: int, phase0: float, sr: int) -> np.ndarray:
    """PolyBLEP 대역 제한 톱니파."""
    dt = f / sr
    ph = (phase0 + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def tri_wave(f: float, n: int, phase0: float, sr: int) -> np.ndarray:
    """삼각파 (배음이 1/k² 로 줄고 패드는 1.2 kHz LPF를 거치므로 단순 계산으로 충분)."""
    ph = (phase0 + f / sr * np.arange(n)) % 1.0
    return 2.0 * np.abs(2.0 * ph - 1.0) - 1.0


def pad_note(midi: int, n_sus: int, rng, atk: float = 1.5, rel: float = 1.5) -> np.ndarray:
    """패드 한 음: 디튠 톱니 2 + 삼각 1 (좌·우·중앙), 1.5 s 어택/릴리스, 느린 음량 LFO. 16 kHz 스테레오."""
    sr = PAD_SR
    n_rel = int(rel * sr)
    n = n_sus + n_rel
    out = np.zeros((n, 2))
    for cents, pan, kind in ((-7, -0.5, "saw"), (7, 0.5, "saw"), (0, 0.0, "tri")):
        f = midi_hz(midi) * 2 ** (cents / 1200)
        v = blep_saw(f, n, rng.uniform(), sr) if kind == "saw" else 0.9 * tri_wave(f, n, rng.uniform(), sr)
        gl, gr = pan_gains(pan)
        out[:, 0] += gl * v
        out[:, 1] += gr * v
    env = np.ones(n)
    na = int(atk * sr)
    env[:min(na, n)] = ramp(na)[:min(na, n)]
    tr = np.arange(n_rel) / sr
    env[n_sus:] = env[max(n_sus - 1, 0)] * np.exp(-tr / 0.38) * ramp(n_rel)[::-1]   # 현재 값에서 릴리스
    t = np.arange(n) / sr
    env *= 1 + 0.08 * np.sin(2 * np.pi * 0.07 * t + rng.uniform(0, 2 * np.pi))
    return fade_edges(out * env[:, None], MIN_FADE, MIN_FADE, sr)


def noise_hit(rng, dur: float, band: tuple, atk: float, tau: float) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = signal.sosfilt(bw(2, band, "bandpass"), rng.standard_normal(n + 1024))[1024:] * np.exp(-t / tau)
    x = fade_edges(x, atk, 0.012)
    return (x / np.abs(x).max()).astype(np.float32)


# ============================================================ 레이어 렌더링

def render_piano(bars: list, n: int, rng) -> np.ndarray:
    piano = FeltPiano()
    ev = []  # (시각, midi, 세기, 레이어, 댐핑 시각)
    for b in bars:
        if LEVELS["piano"][b.section] <= 0:
            continue
        if b.final:   # 마지막 Fmaj9: 천천히 굴려서 끝까지 울림
            lh, rh = PIANO_FINAL
            notes = (lh, *rh)
            t0 = b.t0 + rng.uniform(0, 0.008)
            for i, m in enumerate(notes):
                w = 1.05 if i == len(notes) - 1 else 0.92
                ev.append((t0 + i * 0.045, m, 0.78 * w * rng.uniform(0.9, 1.1), "end", np.inf))
            continue
        pattern = PIANO_PATTERN[b.section]
        if len(b.chords) > 1:   # C7sus4 → C7: 1박과 3박에 화음
            pattern = [p for p in pattern if not 1.0 <= p[0] < 2.0] + [(2.0, "R", pattern[0][2] * 0.85)]
        for beat, kind, vel in pattern:
            chord, seg_end = b.chord_at(beat)
            lh, rh = PIANO[chord]
            notes = {"R": (lh, *rh), "U": rh, "T": rh[-2:]}[kind]
            roll = {"R": 0.022, "U": 0.010, "T": 0.008}[kind]
            t_ev = max(0.0, b.t0 + beat * BEAT + rng.uniform(-0.008, 0.008))   # ±8 ms
            for i, m in enumerate(notes):
                w = 1.08 if i == len(notes) - 1 else (0.95 if kind == "R" and i == 0 else 0.90)
                v = float(np.clip(vel * w * rng.uniform(0.9, 1.1), 0.05, 1.0))  # ±10%
                ev.append((t_ev + i * roll * rng.uniform(0.8, 1.2), m, v, FeltPiano.layer(v), seg_end + PEDAL_LAG))
    ev.sort()
    nxt, seen = [None] * len(ev), {}
    for i in range(len(ev) - 1, -1, -1):   # 같은 음의 다음 타건 (재타건 시 이전 음 댐핑)
        nxt[i] = seen.get(ev[i][1])
        seen[ev[i][1]] = ev[i][0]
    bus = np.zeros((n, 2), np.float32)
    for i, (t, m, v, layer, t_damp) in enumerate(ev):
        t_off, rel = t_damp, 0.22
        if nxt[i] is not None and nxt[i] < t_off:
            t_off, rel = nxt[i], 0.06
        buf = piano.note(m, layer)
        n_on = len(buf) if np.isinf(t_off) else max(1, int(round((t_off - t) * SR)))
        n_rel = int(rel * SR)
        ln = min(len(buf), n_on + n_rel)
        x = buf[:ln] * np.float32(v ** 1.6)
        if n_on < ln:
            x[n_on:] *= ramp(n_rel)[::-1][:ln - n_on]
        add_mono(bus, fade_edges(x), int(round(t * SR)), float(np.clip((m - 60) / 36, -0.35, 0.35)))
    print(f"  piano    {len(ev):5d} notes, {len(piano.cache)} unique renders")
    return signal.sosfilt(bw(2, 3500, "lowpass"), bus, axis=0).astype(np.float32)


def render_musicbox(bars: list, n: int, rng) -> np.ndarray:
    bus, cache, k = np.zeros((n, 2), np.float32), {}, 0
    for b in bars:
        if LEVELS["musicbox"][b.section] <= 0:
            continue
        opts = MOTIFS[b.section]
        notes = FINAL_MOTIF if b.final else opts[b.loop % len(opts)][b.slot]
        for beat, m, vel in notes:
            if m not in cache:
                cache[m] = musicbox_tone(m)
            t = max(0.0, b.t0 + beat * BEAT + rng.uniform(-0.008, 0.008))
            v = vel * rng.uniform(0.9, 1.1)
            comp = (midi_hz(m) / 880.0) ** -1.2   # 등청감 보정: 1 kHz 위(C6·D6)는 여리게 → 내레이션 대역 비움
            add_mono(bus, cache[m] * np.float32(v ** 1.5 * comp), int(round(t * SR)), 0.3 if k % 2 == 0 else -0.3)
            k += 1
    print(f"  musicbox {k:5d} notes")
    return signal.sosfilt(bw(2, 6000, "lowpass"), bus, axis=0).astype(np.float32)


def render_bass(bars: list, n: int, rng) -> np.ndarray:
    ev = []
    for b in bars:
        if b.final or LEVELS["bass"][b.section] <= 0:
            continue
        ch0 = b.chords[0][1]
        ev.append([b.t0, BASS[ch0], 0.9, b.t0 + BAR])
        if len(b.chords) > 1:
            ev.append([b.t0 + 2 * BEAT, BASS[b.chords[1][1]], 0.8, b.t0 + BAR])
        elif b.slot in BASS_FIFTH_SLOTS[b.section]:
            ev.append([b.t0 + 2 * BEAT, BASS5[ch0], 0.7, b.t0 + BAR])
    for e in ev:
        e[0] = max(0.0, e[0] + rng.uniform(-0.008, 0.008))
        e[2] *= rng.uniform(0.9, 1.1)
    bus = np.zeros((n, 2), np.float32)
    for i, (t, m, v, bar_end) in enumerate(ev):
        t_next = ev[i + 1][0] if i + 1 < len(ev) else np.inf
        off = t_next + 0.015 if t_next < bar_end + BAR * 0.5 else bar_end   # 레가토
        add_mono(bus, bass_tone(m, off - t).astype(np.float32) * np.float32(v), int(round(t * SR)))
    print(f"  bass     {len(ev):5d} notes")
    return signal.sosfilt(bw(2, 200, "lowpass"), bus, axis=0).astype(np.float32)


def render_pad(bars: list, n: int, rng, duration: float) -> np.ndarray:
    segs = []   # 화음 구간 (시작, 끝, 화음)
    for b in bars:
        for beat, ch in b.chords:
            _, end = b.chord_at(beat)
            segs.append((b.t0 + beat * BEAT, end, ch))
    runs, active = [], {}
    for t0, _, ch in segs:   # 공통음은 끊지 않고 이어서 (보이스 리딩 패드)
        now = set(PAD[ch])
        for m in [m for m in active if m not in now]:
            runs.append((m, active.pop(m), t0))
        for m in now:
            active.setdefault(m, t0)
    runs += [(m, t0, duration + 2.0) for m, t0 in active.items()]
    nb = n // 3 + 2
    bus = np.zeros((nb, 2))
    for m, t0, t1 in sorted(runs, key=lambda r: (r[1], r[0])):
        if LEVELS["pad"][[b for b in bars if b.t0 <= t0 + 1e-6][-1].section] <= 0:
            continue
        x = pad_note(m, int(round((t1 - t0) * PAD_SR)), rng)
        s = int(round(t0 * PAD_SR))
        k = min(len(x), nb - s)
        bus[s:s + k] += x[:k]
    bus = signal.sosfilt(np.vstack([bw(2, 80, "highpass", PAD_SR), bw(4, 1200, "lowpass", PAD_SR)]), bus, axis=0)
    print(f"  pad      {len(runs):5d} voice-led notes (x3 detuned voices)")
    return signal.resample_poly(bus, 3, 1, axis=0)[:n].astype(np.float32)


def render_perc(bars: list, n: int, rng) -> tuple:
    shakers = [noise_hit(rng, 0.14, (4500, 9500), 0.006, 0.032) for _ in range(6)]
    brushes = [noise_hit(rng, 0.34, (2500, 7000), 0.018, 0.070) for _ in range(4)]
    shaker, brush = np.zeros((n, 2), np.float32), np.zeros((n, 2), np.float32)
    cnt = [0, 0]
    for b in bars:
        if b.final:
            continue
        if LEVELS["shaker"][b.section] > 0:
            for k in range(8):
                t = max(0.0, b.t0 + k * BEAT / 2 + rng.uniform(-0.008, 0.008))
                v = SHAKER_VEL[k] * rng.uniform(0.9, 1.1)
                add_mono(shaker, shakers[rng.integers(len(shakers))] * np.float32(v), int(round(t * SR)), 0.3)
                cnt[0] += 1
        if LEVELS["brush"][b.section] > 0:
            for beat in (1, 3):   # 2·4박
                t = max(0.0, b.t0 + beat * BEAT + rng.uniform(-0.008, 0.008))
                v = (0.9 if beat == 1 else 1.0) * rng.uniform(0.9, 1.1)
                add_mono(brush, brushes[rng.integers(len(brushes))] * np.float32(v), int(round(t * SR)), -0.2)
                cnt[1] += 1
    print(f"  shaker   {cnt[0]:5d} hits · brush {cnt[1]} hits")
    return shaker, brush


# ============================================================ 믹스 · 공간 · 마스터

def level_curve(layer: str, spans: list, n: int) -> np.ndarray:
    """구간별 음량 → 1마디 raised-cosine 크로스페이드 (들어오는 레이어는 경계 뒤, 나가는 레이어는 경계 앞)."""
    g = np.full(n, LEVELS[layer][spans[0][0]], dtype=np.float32)
    nr = int(round(BAR * SR))
    for (p, _, _), (name, t, _) in zip(spans, spans[1:]):
        v0, v1 = LEVELS[layer][p], LEVELS[layer][name]
        if v0 == v1:
            continue
        i0 = max(0, int(round((t - BAR if v1 == 0 else t) * SR)))
        i1 = min(n, i0 + nr)
        g[i0:i1] = v0 + (v1 - v0) * ramp(nr)[:i1 - i0]
        g[i1:] = v1
    return g


def make_ir(rng, rt60: float = 1.8, length: float = 2.4, predelay: float = 0.02) -> np.ndarray:
    """합성 스테레오 IR: 좌우 독립 노이즈 × 지수 감쇠(대역별 RT60), 고역은 빨리 사라지는 어두운 꼬리."""
    n = int(length * SR)
    t = np.arange(n) / SR
    bands = ((bw(2, 500, "lowpass"), 1.0), (bw(2, (500, 4000), "bandpass"), 0.95), (bw(2, 4000, "highpass"), 0.45))
    pre = int(predelay * SR)
    ir = np.zeros((pre + n, 2))
    for ch in range(2):
        noise = rng.standard_normal(n)
        tail = sum(signal.sosfilt(s, noise) * np.exp(-6.9078 * t / (rt60 * k)) for s, k in bands)
        tail = fade_edges(signal.sosfilt(bw(2, 6500, "lowpass"), tail), 0.006, 0.05)
        ir[pre:, ch] = tail / np.sqrt(np.sum(tail ** 2))
    return ir


def rt60_estimate(ir: np.ndarray) -> float:
    """Schroeder 역적분 EDC의 -5 → -35 dB 기울기(T30)로 RT60 추정."""
    e = np.sum(ir ** 2, axis=1)
    edc = 10 * np.log10(np.cumsum(e[::-1])[::-1] / e.sum() + 1e-20)
    i5, i35 = np.argmax(edc <= -5), np.argmax(edc <= -35)
    return 2.0 * (i35 - i5) / SR


def glue_compress(x: np.ndarray, thresh: float = -21.0, ratio: float = 1.6, knee: float = 10.0,
                  attack: float = 0.04, release: float = 0.4) -> tuple:
    """소프트 니 RMS 컴프레서 (5 ms 블록 검출 → dB 도메인 어택/릴리스 → 샘플 보간)."""
    hop, win = int(0.005 * SR), int(0.03 * SR)
    cs = np.concatenate([[0.0], np.cumsum(np.mean(x.astype(np.float64) ** 2, axis=1))])
    c = np.arange(0, len(x), hop)
    a, b = np.clip(c - win // 2, 0, len(x)), np.clip(c + win // 2, 0, len(x))
    over = 10 * np.log10((cs[b] - cs[a]) / np.maximum(b - a, 1) + 1e-12) - thresh
    gr = np.where(over <= -knee / 2, 0.0, np.where(over >= knee / 2, over * (1 / ratio - 1),
                  (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    ca, cr = np.exp(-hop / (attack * SR)), np.exp(-hop / (release * SR))
    sm, g = np.empty_like(gr), 0.0
    for i, v in enumerate(gr):
        k = ca if v < g else cr
        g = k * g + (1 - k) * v
        sm[i] = g
    gain = 10 ** (np.interp(np.arange(len(x)), c, sm) / 20)
    return x * gain[:, None], sm


def peak_limit(x: np.ndarray, ceiling_db: float) -> np.ndarray:
    """안전용 피크 리미터 (±4 ms 최소값 + 이동 평균으로 부드럽게). 보통은 동작하지 않는다."""
    need = np.minimum(1.0, 10 ** (ceiling_db / 20) / np.maximum(np.abs(x).max(axis=1), 1e-12))
    if need.min() >= 1.0:
        return x
    w = int(0.004 * SR)
    g = ndimage.uniform_filter1d(ndimage.minimum_filter1d(need, 2 * w + 1), w)
    return x * g[:, None]


def band_energy(x: np.ndarray, edges=(20, 250, 1000, 4000, SR / 2 + 1)) -> np.ndarray:
    """모노 합의 대역별 에너지 비율 (Welch PSD 합)."""
    f, p = signal.welch(x.mean(axis=1) if x.ndim == 2 else x, fs=SR, nperseg=8192, noverlap=0, detrend=False)
    e = np.array([p[(f >= lo) & (f < hi)].sum() for lo, hi in zip(edges, edges[1:])])
    return e / p[f >= edges[0]].sum()


def verify(path: Path, spans: list) -> dict:
    """저장된 파일을 다시 읽어 검증. ffmpeg loudnorm 측정은 병렬로 돌린다."""
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
           "-af", f"loudnorm=I={TARGET_LUFS}:TP={TP_LIMIT}:LRA=11:print_format=json", "-f", "null", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    x, sr = sf.read(path, always_2d=True)
    info = sf.info(path)
    dc = x.mean(axis=0)
    print(f"  {path}: {len(x) / sr:.3f} s ({len(x)} frames) · {sr} Hz · {info.channels} ch · {info.subtype}")
    print(f"    peak {20 * np.log10(np.abs(x).max()):.2f} dBFS · RMS {20 * np.log10(np.sqrt(np.mean(x ** 2))):.2f} dBFS"
          f" · DC L {dc[0]:+.1e} R {dc[1]:+.1e} · NaN/inf {'없음' if np.isfinite(x).all() else '있음!'}")
    print(f"    내부 BS.1770: {lufs(x):.2f} LUFS · true peak {true_peak_db(x):.2f} dBTP (4x oversampling)")
    sec = [(nm_, lufs(x[int(a * SR):int(b * SR)])) for nm_, a, b in spans]
    print("    구간별 음량: " + " · ".join(f"{k} {v:.1f}" for k, v in sec) + " LUFS")
    lo, lm, hm, hi = band_energy(x)
    print(f"    스펙트럼 에너지 비율: <250 Hz {100 * lo:.1f}% · 250 Hz–4 kHz {100 * (lm + hm):.1f}% "
          f"(그중 1–4 kHz {100 * hm:.1f}%) · >4 kHz {100 * hi:.2f}%")
    hf = signal.sosfilt(bw(8, 14000, "highpass"), x, axis=0)
    clk = " · ".join(f"{k} {20 * np.log10(np.abs(hf[int(a * SR):int(b * SR)]).max() + 1e-20):.0f}" for k, a, b in spans)
    print(f"    클릭 검사 (14 kHz 이상 피크, dBFS; B·C는 셰이커 노이즈): {clk} · 첫/끝 샘플 "
          f"{np.abs(x[0]).max():.0e}/{np.abs(x[-1]).max():.0e}")
    err = proc.communicate()[1]
    ln = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", err, re.S).group(0))
    print(f"    ffmpeg loudnorm: integrated {ln['input_i']} LUFS · true peak {ln['input_tp']} dBTP · "
          f"LRA {ln['input_lra']} LU")
    return ln


# ============================================================ 메인

def main() -> None:
    ap = argparse.ArgumentParser(description="절차적 BGM 합성 (F장조 84 BPM 로파이 피아노 + 오르골)")
    ap.add_argument("--duration", type=float, required=True, help="길이(초)")
    ap.add_argument("--out", required=True, help="출력 WAV 경로")
    ap.add_argument("--sections", default=DEFAULT_SECTIONS, help="intro,A,B,C,outro 시작 시각(초)")
    args = ap.parse_args()
    t_start = time.time()
    times = [float(v) for v in args.sections.split(",")]
    if len(times) == 4 and times[0] > 0:
        times = [0.0] + times
    if len(times) != 5:
        raise SystemExit("--sections 는 intro,A,B,C,outro 5개의 시작 시각이어야 합니다")

    validate_tables()
    print_tables()
    n = int(round(args.duration * SR))
    bars, starts, end_bar = build_plan(args.duration, times)
    spans = section_spans(bars, args.duration)
    print_plan(bars, times, starts, spans)
    print(f"  마지막 Fmaj9: 마디 {end_bar} ({end_bar * BAR:.2f}s)부터 {args.duration - end_bar * BAR:.2f}s 울림, "
          f"마지막 {FADE_OUT:.0f}s 페이드아웃")

    print("\n[합성]")
    layers = {"piano": render_piano(bars, n, np.random.default_rng([SEED, 1])),
              "pad": render_pad(bars, n, np.random.default_rng([SEED, 4]), args.duration),
              "bass": render_bass(bars, n, np.random.default_rng([SEED, 3])),
              "musicbox": render_musicbox(bars, n, np.random.default_rng([SEED, 2]))}
    layers["shaker"], layers["brush"] = render_perc(bars, n, np.random.default_rng([SEED, 5]))

    # --- 레이어 음량 보정: C 구간(모든 레이어가 연주)에서 피아노 대비 K-가중 음량을 목표치로
    c_span = next(((a, b) for s, a, b in spans if s == "C"), (0.0, args.duration))
    i0, i1 = int(c_span[0] * SR), int(c_span[1] * SR)
    pw = {k: kpower(v[i0:i1]) for k, v in layers.items()}
    gains = {"piano": 1.0}
    for k, rel in REL_DB.items():
        gains[k] = np.sqrt(pw["piano"] * 10 ** (rel / 10) / pw[k]) if pw[k] > 0 else 1.0
    br = np.sqrt(pw["shaker"] / pw["brush"] * 10 ** (BRUSH_VS_SHAKER_DB / 10)) if pw["brush"] > 0 else 0.0
    p_perc = pw["shaker"] + br ** 2 * pw["brush"]
    g_perc = np.sqrt(pw["piano"] * 10 ** (PERC_REL_DB / 10) / p_perc) if p_perc > 0 else 0.0
    gains["shaker"], gains["brush"] = g_perc, g_perc * br
    rms_c = {k: np.sqrt(np.mean((gains[k] * v[i0:i1].astype(np.float64)) ** 2)) for k, v in layers.items()}
    perc_rms = np.sqrt(rms_c["shaker"] ** 2 + rms_c["brush"] ** 2)
    db = lambda r: f"{10 * np.log10(r):+6.1f}" if r > 0 else "   off"   # noqa: E731
    print(f"\n[레이어 밸런스] C 구간({c_span[0]:.1f}–{c_span[1]:.1f}s), 피아노 대비 K-가중 음량")
    for k in layers:
        print(f"  {k:<9}{db(gains[k] ** 2 * pw[k] / pw['piano'])} LU")
    print(f"  percussion total {db(gains['shaker'] ** 2 * p_perc / pw['piano']).strip()} LU (K-weighted) · "
          f"plain RMS {db((perc_rms / rms_c['piano']) ** 2).strip()} dB vs piano")

    # --- 구간 오토메이션 적용 후 드라이 버스 + 리버브 센드
    dry = np.zeros((n, 2))
    send = np.zeros((n, 2))
    band_rows = {}
    for k, v in layers.items():
        v *= np.float32(gains[k]) * level_curve(k, spans, n)[:, None]
        dry += v
        send += SENDS[k] * v
        band_rows[k] = np.mean(v.astype(np.float64) ** 2) * band_energy(v, (20, 1000, 4000, SR / 2 + 1))[1]
    del layers
    tot14 = sum(band_rows.values())
    print("  1–4 kHz 대역 에너지 기여 (내레이션 대역): " +
          " · ".join(f"{k} {100 * e / tot14:.1f}%" for k, e in sorted(band_rows.items(), key=lambda kv: -kv[1])))

    ir = make_ir(np.random.default_rng([SEED, 6]))
    send = signal.sosfilt(bw(2, 180, "highpass"), send, axis=0)
    wet = np.stack([signal.oaconvolve(send[:, c], ir[:, c])[:n] for c in range(2)], axis=1)
    wet *= 10 ** (WET_DB / 20) * np.sqrt(np.mean(dry ** 2) / np.mean(wet ** 2))
    print(f"\n[공간] IR RT60(T30 추정) {rt60_estimate(ir):.2f}s · pre-delay 20 ms · "
          f"wet/dry RMS {WET_DB:.1f} dB (≈{100 * 10 ** (WET_DB / 20) / (1 + 10 ** (WET_DB / 20)):.0f}% wet)")
    mix = dry + wet
    del dry, wet, send

    # --- 마스터: 35 Hz HPF · 2.8 kHz 살짝 비움(-1.5 dB) · 6 kHz 하이셸프 -6 dB · 12 kHz LPF
    eq = np.vstack([bw(4, 35, "highpass"), rbj("peak", 2800, -1.5, 0.9), rbj("highshelf", 6000, -6.0), bw(2, 12000, "lowpass")])
    mix = signal.sosfilt(eq, mix, axis=0)
    mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
    mix, gr = glue_compress(mix)
    print(f"[글루 컴프] 평균 GR {gr.mean():.2f} dB · 최대 GR {gr.min():.2f} dB")
    fi, fo = min(n, int(FADE_IN * SR)), min(n, int(FADE_OUT * SR))
    fades = np.ones(n)
    fades[:fi] = ramp(fi)
    fades[n - fo:] *= ramp(fo)[::-1]
    mix *= fades[:, None]

    # --- 음량 정규화 + True Peak 확인
    for _ in range(4):
        mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
        tp = true_peak_db(mix)
        if tp <= TP_GOAL:
            break
        mix = peak_limit(mix, TP_GOAL - 0.3 - (tp - 20 * np.log10(np.abs(mix).max())))
    w = np.hanning(n)
    mix -= (mix.mean(axis=0) / w.mean())[None, :] * w[:, None]   # DC 제거 (양끝 0 유지)
    assert np.isfinite(mix).all() and np.abs(mix).max() < 1.0

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out, mix, SR, subtype="PCM_24")

    # --- 검증 (저장된 24-bit 파일 기준)
    print("\n[검증]")
    ln = verify(out, spans)
    if abs(float(ln["input_i"]) - TARGET_LUFS) > 0.3:   # ffmpeg 측정과 어긋나면 그 기준으로 한 번 보정
        mix *= 10 ** ((TARGET_LUFS - float(ln["input_i"])) / 20)
        sf.write(out, mix, SR, subtype="PCM_24")
        print("  ffmpeg 측정 기준으로 재보정:")
        ln = verify(out, spans)
    ok = abs(float(ln["input_i"]) - TARGET_LUFS) <= 0.5 and float(ln["input_tp"]) <= TP_LIMIT
    print(f"    {'OK' if ok else '확인 필요'}: 목표 {TARGET_LUFS} LUFS, TP ≤ {TP_LIMIT} dBTP · 소요 {time.time() - t_start:.1f}s")


if __name__ == "__main__":
    main()
