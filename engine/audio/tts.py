"""대본(script.json) → 문장별 내레이션 생성 → 타임라인/자막/내레이션 트랙 산출.

사용법:
    python3 engine/audio/tts.py episodes/01-parental-leave

산출물 (build/<episode>/):
    lines/<line-id>.wav   문장별 음성 (48kHz mono, 속도·음량 보정 완료)
    narration.wav         타임라인에 맞춰 배치한 전체 내레이션
    timeline.json         장면/문장/자막 청크의 시작·끝 시각
그리고 episodes/<episode>/subtitles.srt 를 갱신합니다.

직접 녹음한 목소리로 바꾸려면 overrides/<line-id>.wav 파일을 넣고 다시 실행하세요.
해당 문장은 TTS 대신 녹음 파일을 사용하며, 영상 타이밍도 녹음 길이에 맞춰 다시 계산됩니다.
"""

import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
ROOT = Path(__file__).resolve().parents[2]


def fetch_tts(text: str, lang: str, cache_dir: Path) -> Path:
    key = hashlib.sha1(f"{lang}:{text}".encode()).hexdigest()[:16]
    out = cache_dir / f"{key}.mp3"
    if out.exists() and out.stat().st_size > 1000:
        return out
    query = urllib.parse.urlencode({"ie": "UTF-8", "client": "gtx", "tl": lang, "q": text})
    url = "https://translate.googleapis.com/translate_tts?" + query
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=30).read()
            if len(data) < 1000:
                raise RuntimeError(f"too small response ({len(data)} bytes)")
            out.write_bytes(data)
            time.sleep(0.4)
            return out
        except Exception as exc:  # 네트워크 오류는 지수 백오프로 재시도
            wait = 2 ** (attempt + 1)
            print(f"  TTS 재시도 {attempt + 1}/5 ({exc}); {wait}s 대기", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"TTS 실패: {text}")


def decode(path: Path, tempo: float) -> np.ndarray:
    """오디오 파일을 48kHz mono float32로 디코딩하면서 속도·톤 보정을 적용."""
    filters = [f"aresample={SR}"]
    if abs(tempo - 1.0) > 1e-3:
        filters.append(f"atempo={tempo:.4f}")
    filters += [
        "highpass=f=70",
        "equalizer=f=220:t=q:w=1.0:g=1.5",   # 약간의 따뜻함
        "equalizer=f=3200:t=q:w=1.2:g=2.0",  # 발음 명료도
        "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2",
    ]
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(path), "-ac", "1",
        "-af", ",".join(filters), "-f", "f32le", "-",
    ]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def trim_silence(x: np.ndarray, thresh_db: float = -42.0, keep: float = 0.03) -> np.ndarray:
    win = int(0.01 * SR)
    if len(x) < win * 3:
        return x
    frames = len(x) // win
    rms = np.sqrt(np.mean(x[: frames * win].reshape(frames, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-12)
    voiced = np.where(db > thresh_db)[0]
    if len(voiced) == 0:
        return x
    start = max(0, voiced[0] * win - int(keep * SR))
    end = min(len(x), (voiced[-1] + 1) * win + int(keep * SR))
    y = x[start:end].copy()
    fade = int(0.008 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def normalize_rms(x: np.ndarray, target_db: float = -19.0) -> np.ndarray:
    # 무음 구간을 제외한 RMS로 문장 간 음량을 맞춤
    win = int(0.02 * SR)
    frames = len(x) // win
    seg = x[: frames * win].reshape(frames, win)
    rms = np.sqrt(np.mean(seg ** 2, axis=1))
    active = rms[rms > 10 ** (-40 / 20)]
    level = np.sqrt(np.mean(active ** 2)) if len(active) else np.sqrt(np.mean(x ** 2))
    gain = 10 ** (target_db / 20) / max(level, 1e-6)
    y = x * gain
    peak = np.max(np.abs(y))
    if peak > 0.89:
        y *= 0.89 / peak
    return y


SPOKEN = re.compile(r"[가-힣A-Za-z0-9]")


def weight(segment: str) -> float:
    """자막 청크 시간 배분용 가중치: 발화 음절 수 + 쉼표/마침표 휴지."""
    w = len(SPOKEN.findall(segment))
    w += 1.2 * segment.count(",")
    w += 2.0 * len(re.findall(r"[.?!]", segment))
    return max(w, 1.0)


def fmt_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main(ep_dir: str) -> None:
    ep_path = (ROOT / ep_dir).resolve()
    script = json.loads((ep_path / "script.json").read_text(encoding="utf-8"))
    build = ROOT / "build" / script["episode"]
    (build / "lines").mkdir(parents=True, exist_ok=True)
    cache = ROOT / ".cache" / "tts"
    cache.mkdir(parents=True, exist_ok=True)
    overrides = ep_path / "overrides"

    voice = script["voice"]
    timing = script["timing"]
    clips = {}

    for scene in script["scenes"]:
        for line in scene.get("lines", []):
            lid = line["id"]
            override = overrides / f"{lid}.wav"
            if override.exists():
                audio = trim_silence(decode(override, 1.0))
                source = "override"
            else:
                mp3 = fetch_tts(line["tts"].replace("|", " "), voice["lang"], cache)
                audio = trim_silence(decode(mp3, voice["tempo"]))
                source = "tts"
            audio = normalize_rms(audio)
            sf.write(build / "lines" / f"{lid}.wav", audio, SR, subtype="PCM_24")
            clips[lid] = audio
            print(f"{lid:>4} {len(audio) / SR:5.2f}s [{source}] {line['text'].replace('|', ' ')}")

    # 타임라인 계산
    t = 0.0
    scenes_out, lines_out, chunks_out = [], [], []
    for scene in script["scenes"]:
        start = t
        if "lines" not in scene:
            t += scene["duration"]
        else:
            t += scene.get("leadIn", timing["leadIn"])
            n = len(scene["lines"])
            for i, line in enumerate(scene["lines"]):
                dur = len(clips[line["id"]]) / SR
                ls, le = t, t + dur
                texts = line["text"].split("|")
                spoken = line["tts"].split("|")
                if len(texts) != len(spoken):
                    raise ValueError(f"{line['id']}: 자막/TTS 분할 개수가 다릅니다")
                ws = [weight(s) for s in spoken]
                total = sum(ws)
                cs = ls
                chunks = []
                for text, w in zip(texts, ws):
                    ce = cs + dur * w / total
                    chunks.append({"text": text.strip(), "start": round(cs, 3), "end": round(ce, 3)})
                    cs = ce
                chunks_out.extend(chunks)
                lines_out.append({
                    "id": line["id"], "scene": scene["id"], "start": round(ls, 3), "end": round(le, 3),
                    "text": line["text"].replace("|", " "), "chunks": chunks,
                })
                t = le
                if i < n - 1:
                    t += line.get("pauseAfter", 0.0) + timing["lineGap"]
            t += scene.get("tail", timing["tail"])
        scenes_out.append({"id": scene["id"], "chapter": scene.get("chapter"), "start": round(start, 3), "end": round(t, 3)})

    total = t
    narration = np.zeros(int(np.ceil(total * SR)) + SR, dtype=np.float32)
    for line in lines_out:
        clip = clips[line["id"]]
        i0 = int(round(line["start"] * SR))
        narration[i0 : i0 + len(clip)] += clip
    sf.write(build / "narration.wav", narration, SR, subtype="PCM_24")

    timeline = {"duration": round(total, 3), "fps": 30, "scenes": scenes_out, "lines": lines_out}
    (build / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8")

    srt = []
    for i, c in enumerate(chunks_out, 1):
        srt.append(f"{i}\n{fmt_srt(c['start'])} --> {fmt_srt(c['end'])}\n{c['text']}\n")
    (ep_path / "subtitles.srt").write_text("\n".join(srt), encoding="utf-8")

    mins, secs = divmod(total, 60)
    print(f"\n총 길이 {int(mins)}분 {secs:04.1f}초 · 문장 {len(lines_out)}개 · 자막 {len(chunks_out)}개")
    for s in scenes_out:
        print(f"  {s['id']:<11} {s['start']:7.2f} → {s['end']:7.2f}  ({s['end'] - s['start']:5.2f}s)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "episodes/01-parental-leave")
