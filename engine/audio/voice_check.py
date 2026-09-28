#!/usr/bin/env python3
"""채널 목소리 일관성 검사: 새 에피소드의 문장이 '확정된 채널 목소리'(기준 에피소드)와 같은 목소리·속도·억양인지 봅니다.

  python3 engine/audio/voice_check.py --save-style 01-parental-leave   # 사용자가 확정한 에피소드로 기준(voice_style.json) 저장
  python3 engine/audio/voice_check.py 02-short-parental-leave          # 문장별 점수표
  python3 engine/audio/voice_check.py 02-short-parental-leave --retake 5  # 기준에서 벗어난 문장을 seed 1~5로 다시 만들어 가장 가까운 테이크를 script.json에 저장

기준(voice_style.json)
- 목소리: 기준 에피소드 문장들의 평균 화자 임베딩(resemblyzer). 짧은 문장은 같은 목소리여도 점수가 낮으므로
  문장 길이에 따른 기대 점수(기준 에피소드에서 추정)와 비교합니다.
- 속도: 초당 음절 수, 억양: 목소리 높낮이의 표준편차(반음). 기준 에피소드의 평균·표준편차와 비교합니다.
- 점수(off): 목소리가 기대보다 먼 정도 + 속도·억양이 기준에서 벗어난 정도(표준편차 단위). 2 이상이면 ⚠.
기준 파일이 없으면 일레븐랩스 원본 샘플(.cache/voice_ref.mp3)과의 유사도만 봅니다.
필요: pip install torch resemblyzer librosa "setuptools<81"   (tts.py 로 build/<ep>/lines 가 먼저 있어야 합니다)
"""
import argparse
import json
import re
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
STYLE = ROOT / "voice_style.json"


def load(path) -> np.ndarray:
    return preprocess_wav(librosa.load(str(path), sr=SR)[0])


def pitch_var(wav: np.ndarray) -> float:
    """억양 폭: 목소리 높낮이의 표준편차(반음)."""
    f0, voiced, _ = librosa.pyin(wav, fmin=70, fmax=350, sr=SR, frame_length=1024, hop_length=160)
    f = f0[voiced & ~np.isnan(f0)]
    return float(np.std(12 * np.log2(f / np.median(f)))) if len(f) > 10 else 0.0


def syllables(text: str) -> int:
    return len(re.findall(r"[가-힣]", text))


def measure(wav: np.ndarray, tts_text: str) -> dict:
    sec = len(wav) / SR
    return {"emb": ENC.embed_utterance(wav), "sec": sec, "rate": syllables(tts_text) / sec, "pv": pitch_var(wav)}


def episode_lines(ep: str):
    script = json.loads((ROOT / "episodes" / ep / "script.json").read_text(encoding="utf-8"))
    lines = [l for sc in script["scenes"] for l in sc.get("lines", [])]
    return script, lines


# ------------------------------------------------------------------ 기준 저장
def save_style(ep: str) -> None:
    script, lines = episode_lines(ep)
    d = ROOT / "build" / script["episode"] / "lines"
    ms = [measure(load(d / f"{l['id']}.wav"), l["tts"]) for l in lines]
    embs = np.array([m["emb"] for m in ms])
    c = embs.mean(axis=0)
    c /= np.linalg.norm(c)
    # 자기 자신을 뺀 평균과의 유사도 (자기 포함 시 점수가 부풀려짐)
    loo = []
    for i in range(len(ms)):
        ci = np.delete(embs, i, axis=0).mean(axis=0)
        loo.append(float(embs[i] @ (ci / np.linalg.norm(ci))))
    x = np.log([m["sec"] for m in ms])
    a, b = np.polyfit(x, loo, 1)
    resid = np.array(loo) - (a * x + b)
    rates = np.array([m["rate"] for m in ms])
    pvs = np.array([m["pv"] for m in ms])
    style = {
        "from": ep, "note": "사용자가 확정한 에피소드의 목소리·속도·억양. 새 에피소드는 이 기준에 맞춥니다.",
        "sim_fit": [round(float(a), 5), round(float(b), 5)], "sim_sd": round(float(resid.std()), 5),
        "rate": [round(float(rates.mean()), 3), round(float(rates.std()), 3)],
        "pitch_var": [round(float(pvs.mean()), 3), round(float(pvs.std()), 3)],
        "centroid": [round(float(v), 6) for v in c],
    }
    STYLE.write_text(json.dumps(style, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{STYLE.name} 저장: {ep} · 문장 {len(ms)}개 · 속도 {rates.mean():.2f}±{rates.std():.2f}음절/초 · 억양 {pvs.mean():.2f}±{pvs.std():.2f}")


# ------------------------------------------------------------------ 점수
class House:
    def __init__(self, s: dict):
        self.c = np.array(s["centroid"])
        self.a, self.b = s["sim_fit"]
        self.sd = max(s["sim_sd"], 0.005)
        self.rate, self.rate_sd = s["rate"]
        self.pv, self.pv_sd = s["pitch_var"]

    def score(self, m: dict) -> dict:
        sim = float(m["emb"] @ self.c)
        z_sim = (self.a * np.log(m["sec"]) + self.b - sim) / self.sd
        z_rate = (m["rate"] - self.rate) / self.rate_sd
        z_pv = (m["pv"] - self.pv) / self.pv_sd
        off = max(0.0, z_sim) + 0.5 * abs(z_rate) + 0.5 * abs(z_pv)
        return {"sim": sim, "z_sim": z_sim, "z_rate": z_rate, "z_pv": z_pv, "off": off}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", nargs="?")
    ap.add_argument("--save-style", metavar="EP", help="확정된 에피소드로 기준(voice_style.json)을 저장")
    ap.add_argument("--retake", type=int, default=0, help="기준에서 벗어난 문장마다 시도할 seed 개수")
    ap.add_argument("--limit", type=float, default=2.0, help="점수(off)가 이보다 크면 다시 만듦")
    args = ap.parse_args()
    if args.save_style:
        save_style(args.save_style)
        return
    if not STYLE.exists():
        sys.exit("voice_style.json 이 없습니다. 먼저 --save-style <확정된 에피소드> 로 기준을 저장하세요.")
    house = House(json.loads(STYLE.read_text(encoding="utf-8")))

    ep = ROOT / "episodes" / args.episode
    script_path = ep / "script.json"
    script, lines = episode_lines(args.episode)
    voice = tts.resolve_voice(script["voice"])
    lines_dir = ROOT / "build" / script["episode"] / "lines"

    rows = []
    for line in lines:
        if (ep / "overrides" / f"{line['id']}.wav").exists():
            continue
        m = measure(load(lines_dir / f"{line['id']}.wav"), line["tts"])
        rows.append({"line": line, **m, **house.score(m)})
    offs = np.array([r["off"] for r in rows])
    rates = np.array([r["rate"] for r in rows])
    pvs = np.array([r["pv"] for r in rows])
    print(f"기준 {json.loads(STYLE.read_text())['from']} · 문장 {len(rows)}개 · 점수 평균 {offs.mean():.2f} 최대 {offs.max():.2f} · "
          f"속도 {rates.mean():.2f}(기준 {house.rate:.2f}) · 억양 {pvs.mean():.2f}(기준 {house.pv:.2f})")
    for r in rows:
        mark = "⚠" if r["off"] > args.limit else " "
        print(f" {mark} {r['line']['id']:>4} {r['sec']:4.1f}s 점수 {r['off']:.2f} · 목소리 {r['z_sim']:+.1f} 속도 {r['z_rate']:+.1f} 억양 {r['z_pv']:+.1f}")

    if not args.retake:
        return
    spoken = [l["tts"].replace("|", " ") for l in lines]
    context = [l.get("ttsContext", l["tts"]).replace("|", " ") for l in lines]
    order = [l["id"] for l in lines]
    cache = ROOT / ".cache" / "tts"
    changed = 0
    for r in rows:
        if r["off"] <= args.limit:
            continue
        line = r["line"]
        i = order.index(line["id"])
        prev_text = context[i - 1] if i > 0 else ""
        next_text = context[i + 1] if i + 1 < len(context) else ""
        best = (r["off"], line.get("seed"))
        for seed in [None] + list(range(1, args.retake + 1)):
            if seed == line.get("seed"):
                continue
            mp3 = tts.fetch_eleven(spoken[i], voice, cache, prev_text, next_text, seed)
            audio = tts.normalize_rms(tts.trim_silence(tts.decode(mp3, voice.get("tempo", 1.0))))
            wav = preprocess_wav(librosa.resample(audio, orig_sr=tts.SR, target_sr=SR))
            sc = house.score(measure(wav, line["tts"]))
            print(f"   {line['id']:>4} seed {seed}: 점수 {sc['off']:.2f} · 목소리 {sc['z_sim']:+.1f} 속도 {sc['z_rate']:+.1f} 억양 {sc['z_pv']:+.1f}")
            if sc["off"] < best[0]:
                best = (sc["off"], seed)
        if best[1] != line.get("seed"):
            if best[1] is None:
                line.pop("seed", None)
            else:
                line["seed"] = best[1]
            changed += 1
            print(f"   → {line['id']} seed {best[1]} 사용 (점수 {r['off']:.2f} → {best[0]:.2f})")
    if changed:
        script_path.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"script.json 에 {changed}개 문장의 seed 를 저장했습니다. tts.py 를 다시 돌리면 반영됩니다.")


if __name__ == "__main__":
    main()
