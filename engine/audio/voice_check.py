#!/usr/bin/env python3
"""채널 목소리 일관성 검사: 문장마다 '사용자 원본 샘플과 같은 사람 목소리인지'를 점수로 봅니다.

  python3 engine/audio/voice_check.py 01-parental-leave            # 점수표
  python3 engine/audio/voice_check.py 01-parental-leave --retake 4  # 튀는 문장을 seed 1~4로 다시 만들어 가장 비슷한 테이크를 script.json에 저장

- 기준 목소리는 일레븐랩스 목소리에 올라가 있는 원본 샘플(voice.json 의 voiceId)을 받아 .cache/voice_ref.mp3 로 둡니다.
- 점수는 화자 임베딩(resemblyzer) 코사인 유사도입니다. 짧은 문장은 같은 사람이어도 점수가 낮게 나오므로,
  원본 샘플을 같은 길이로 잘랐을 때의 점수(기대값)와의 차이(gap)로 튀는 문장을 찾습니다.
- 필요: pip install torch resemblyzer librosa "setuptools<81"   (tts.py 로 build/<ep>/lines 가 먼저 있어야 합니다)
"""
import argparse
import json
import sys
import urllib.request
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
import tts  # noqa: E402

import librosa  # noqa: E402
from resemblyzer import VoiceEncoder, preprocess_wav  # noqa: E402

SR = 16000
ENC = VoiceEncoder("cpu", verbose=False)


def load(path) -> np.ndarray:
    return preprocess_wav(librosa.load(str(path), sr=SR)[0])


def reference(voice: dict) -> tuple:
    """원본 샘플의 평균 임베딩과, 길이별 기대 점수 곡선(초 → 점수)."""
    ref_path = ROOT / ".cache" / "voice_ref.mp3"
    if not ref_path.exists():
        base = f"{tts.ELEVEN_BASE}/v1/voices/{voice['voiceId']}"
        info = json.loads(urllib.request.urlopen(base, timeout=60).read())
        samples = info.get("samples") or []
        if not samples:
            sys.exit("목소리에 원본 샘플이 없습니다. 기준 녹음 파일을 .cache/voice_ref.mp3 로 두면 됩니다.")
        ref_path.parent.mkdir(parents=True, exist_ok=True)
        ref_path.write_bytes(urllib.request.urlopen(f"{base}/samples/{samples[0]['sample_id']}/audio", timeout=120).read())
    w = load(ref_path)
    seg = [w[i:i + 10 * SR] for i in range(0, len(w) - 5 * SR, 10 * SR)]
    ref = np.mean([ENC.embed_utterance(s) for s in seg], axis=0)
    ref /= np.linalg.norm(ref)
    curve = []
    for sec in (1.5, 2.5, 4, 6, 9):
        n = int(sec * SR)
        curve.append((sec, float(np.mean([ENC.embed_utterance(w[i:i + n]) @ ref for i in range(0, len(w) - n, n)]))))
    return ref, curve


def expected(curve, sec: float) -> float:
    xs, ys = zip(*curve)
    return float(np.interp(sec, xs, ys))


def score_wav(wav: np.ndarray, ref) -> float:
    return float(ENC.embed_utterance(wav) @ ref)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--retake", type=int, default=0, help="튀는 문장마다 시도할 seed 개수")
    ap.add_argument("--gap", type=float, default=0.065, help="기대값보다 이만큼 낮으면 튀는 문장으로 봄")
    args = ap.parse_args()

    ep = ROOT / "episodes" / args.episode
    script_path = ep / "script.json"
    script = json.loads(script_path.read_text(encoding="utf-8"))
    voice = tts.resolve_voice(script["voice"])
    lines_dir = ROOT / "build" / script["episode"] / "lines"
    ref, curve = reference(voice)

    rows = []
    for scene in script["scenes"]:
        for line in scene.get("lines", []):
            if (ep / "overrides" / f"{line['id']}.wav").exists():
                continue
            wav = load(lines_dir / f"{line['id']}.wav")
            sec = len(wav) / SR
            s = score_wav(wav, ref)
            rows.append({"line": line, "sec": sec, "score": s, "gap": expected(curve, sec) - s})
    gaps = np.array([r["gap"] for r in rows])
    print(f"문장 {len(rows)}개 · 평균 점수 {np.mean([r['score'] for r in rows]):.3f} · 기대값과의 차이 평균 {gaps.mean():.3f} 최대 {gaps.max():.3f}")
    for r in rows:
        mark = "⚠" if r["gap"] > args.gap else " "
        print(f" {mark} {r['line']['id']:>4} {r['sec']:4.1f}s 점수 {r['score']:.3f} 차이 {r['gap']:+.3f}")

    if not args.retake:
        return
    if voice.get("unit") == "scene":
        sys.exit("--retake 는 문장 단위(unit: line) 목소리에서만 씁니다.")
    spoken = [l["tts"].replace("|", " ") for sc in script["scenes"] for l in sc.get("lines", [])]
    order = [l["id"] for sc in script["scenes"] for l in sc.get("lines", [])]
    cache = ROOT / ".cache" / "tts"
    changed = 0
    for r in rows:
        if r["gap"] <= args.gap:
            continue
        line = r["line"]
        i = order.index(line["id"])
        prev_text = spoken[i - 1] if i > 0 else ""
        next_text = spoken[i + 1] if i + 1 < len(spoken) else ""
        best = (r["gap"], line.get("seed"))
        for seed in range(1, args.retake + 1):
            if seed == line.get("seed"):
                continue
            mp3 = tts.fetch_eleven(spoken[i], voice, cache, prev_text, next_text, seed)
            audio = tts.trim_silence(tts.decode(mp3, voice.get("tempo", 1.0)))
            wav = preprocess_wav(librosa.resample(audio, orig_sr=tts.SR, target_sr=SR))
            gap = expected(curve, len(wav) / SR) - score_wav(wav, ref)
            print(f"   {line['id']:>4} seed {seed}: 차이 {gap:+.3f}")
            if gap < best[0]:
                best = (gap, seed)
        if best[1] != line.get("seed"):
            line["seed"] = best[1]
            changed += 1
            print(f"   → {line['id']} seed {best[1]} 사용 (차이 {r['gap']:+.3f} → {best[0]:+.3f})")
    if changed:
        script_path.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"script.json 에 {changed}개 문장의 seed 를 저장했습니다. tts.py 를 다시 돌리면 반영됩니다.")


if __name__ == "__main__":
    main()
