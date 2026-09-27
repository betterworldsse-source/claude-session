"""한 번에 녹음한 내레이션 파일을 문장별로 잘라 overrides/<문장id>.wav 로 저장합니다.

사용법:
    python3 engine/audio/split_voice.py 01-parental-leave 내녹음.m4a

녹음 방법: script.json 의 문장을 순서대로 읽되, 문장과 문장 사이에 1~2초 쉬어 주세요.
문장 안의 짧은 쉼(쉼표 등)보다 문장 사이의 쉼이 길기만 하면, 가장 긴 쉼 (문장 수 - 1)개를
경계로 삼아 자동으로 나눕니다. 이후 `bash engine/build.sh <ep>` 를 실행하면 영상 타이밍이
녹음 길이에 맞춰 다시 계산됩니다.
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
ROOT = Path(__file__).resolve().parents[2]


def load_clean(path: Path) -> np.ndarray:
    """디코딩 + 저역 잡음 제거 + 가벼운 노이즈 리덕션 (48kHz mono)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
           "-af", "highpass=f=75,afftdn=nf=-28", "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def voiced_regions(x: np.ndarray, hop_s: float = 0.01):
    hop = int(hop_s * SR)
    frames = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1)) + 1e-9)
    # 잡음 바닥 기준 적응형 임계값
    floor = np.percentile(db, 10)
    peak = np.percentile(db, 95)
    thr = floor + max(10.0, (peak - floor) * 0.3)
    v = db > thr
    # 아주 짧은 구멍(0.12s 이하)은 메움
    i = 0
    while i < frames:
        if not v[i]:
            j = i
            while j < frames and not v[j]:
                j += 1
            if 0 < i and j < frames and (j - i) * hop_s <= 0.12:
                v[i:j] = True
            i = j
        else:
            i += 1
    regions, i = [], 0
    while i < frames:
        if v[i]:
            j = i
            while j < frames and v[j]:
                j += 1
            if (j - i) * hop_s >= 0.08:  # 잡음성 짧은 소리 무시
                regions.append((i * hop_s, j * hop_s))
            i = j
        else:
            i += 1
    return regions


def main(ep: str, rec: str) -> None:
    ep_dir = ROOT / "episodes" / ep
    script = json.loads((ep_dir / "script.json").read_text(encoding="utf-8"))
    ids = [l["id"] for s in script["scenes"] for l in s.get("lines", [])]
    texts = [l["text"].replace("|", " ") for s in script["scenes"] for l in s.get("lines", [])]
    n = len(ids)

    x = load_clean(Path(rec))
    regions = voiced_regions(x)
    if len(regions) < n:
        sys.exit(f"소리 구간이 {len(regions)}개뿐이라 {n}개 문장으로 나눌 수 없어요. 문장 사이를 조금 더 길게 쉬어 녹음해 주세요.")
    gaps = [(regions[k + 1][0] - regions[k][1], k) for k in range(len(regions) - 1)]
    chosen = sorted(gaps, reverse=True)[: n - 1]
    cuts = sorted(k for _, k in chosen)
    shortest_cut = min(g for g, _ in chosen)
    longest_inner = max([g for g, k in gaps if k not in cuts], default=0.0)
    print(f"문장 경계 쉼: 최소 {shortest_cut:.2f}s · 문장 안 최장 쉼: {longest_inner:.2f}s")
    if shortest_cut - longest_inner < 0.15:
        print("⚠️  문장 사이 쉼과 문장 안 쉼의 차이가 작아요. 결과를 꼭 확인해 주세요.")

    bounds, start = [], 0
    for k in cuts + [len(regions) - 1]:
        bounds.append((regions[start][0], regions[k][1]))
        start = k + 1

    out = ep_dir / "overrides"
    out.mkdir(exist_ok=True)
    pad = 0.06
    for (a, b), lid, text in zip(bounds, ids, texts):
        seg = x[max(0, int((a - pad) * SR)) : int((b + pad) * SR)]
        f = int(0.01 * SR)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        sf.write(out / f"{lid}.wav", seg, SR, subtype="PCM_24")
        print(f"  {lid:>3} {b - a:5.2f}s  {text}")
    print(f"→ {out} 에 {n}개 저장. 이제 `bash engine/build.sh {ep}` 로 다시 빌드하세요.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("사용법: python3 engine/audio/split_voice.py <episode> <녹음파일>")
    main(sys.argv[1], sys.argv[2])
