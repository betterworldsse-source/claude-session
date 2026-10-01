"""대본(script.json) → 문장별 내레이션 생성 → 타임라인/자막/내레이션 트랙 산출.

사용법:
    python3 engine/audio/tts.py episodes/01-parental-leave

산출물 (build/<episode>/):
    lines/<line-id>.wav   문장별 음성 (48kHz mono, 속도·음량 보정 완료)
    narration.wav         타임라인에 맞춰 배치한 전체 내레이션
    timeline.json         장면/문장/자막 청크의 시작·끝 시각
그리고 episodes/<episode>/subtitles.srt 를 갱신합니다.

    python3 engine/audio/tts.py episodes/01-parental-leave --lock   # 지금 쓰인 음성을 확정본으로 잠금

확정본 잠금(voice/): 사용자가 확정한 에피소드는 문장별 일레븐랩스 음성을 episodes/<ep>/voice/<문장id>.mp3 로 저장하고,
voice/lock.json 에 요청 내용의 지문(tag)을 적어 둡니다. 다시 빌드할 때 문장·설정·seed·앞뒤 문장이 같으면 잠긴 파일을 그대로 씁니다
(일레븐랩스는 같은 요청도 생성할 때마다 목소리가 달라지므로, 잠금이 있어야 언제 다시 만들어도 같은 소리가 납니다).
바뀐 문장만 새로 만들어지고, 그 경우 "잠금과 다름"으로 표시됩니다. 확인이 끝나면 --lock 으로 다시 잠급니다.

직접 녹음한 목소리로 바꾸려면 overrides/<line-id>.wav 파일을 넣고 다시 실행하세요.
해당 문장은 TTS 대신 녹음 파일을 사용하며, 영상 타이밍도 녹음 길이에 맞춰 다시 계산됩니다.

음성 엔진 (script.json 의 "voice"):
    {"engine": "google-translate-tts", "lang": "ko", "tempo": 1.14}   가이드용 합성 음성
    {"use": "channel"}                                               채널 공용 목소리(voice.json) 사용
voice.json 의 "engine": "elevenlabs" 는 일레븐랩스 복제 목소리로 문장별 음성을 만듭니다.
환경 변수 ELEVENLABS_API_KEY 가 필요하고, 같은 문장은 .cache/tts 에 저장돼 다시 과금되지 않습니다.
"""

import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
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


ELEVEN_BASE = os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io")
# 크레딧이 드는 새 생성은 사용자 허락을 받은 뒤에만 합니다(2026-10 크레딧 소진 이후 규칙).
# ELEVEN_OK=1 이 없으면 잠금·캐시에 없는 문장을 만들지 않고, 필요한 글자 수(≈크레딧)만 알려 주고 멈춥니다.
PAID_OK = os.environ.get("ELEVEN_OK") == "1"
PENDING = []  # (문장 id, 글자 수)


class NeedCredits(Exception):
    """허락(ELEVEN_OK=1) 없이 새로 만들어야 하는 요청."""
ELEVEN_SETUP = ("설정: 작업 환경 편집 → API credentials → Add credential "
                "(Allowed websites: api.elevenlabs.io, 헤더 이름 xi-api-key, 접두사 없음, 값: API 키). "
                "또는 환경 변수 ELEVENLABS_API_KEY + 네트워크 허용(api.elevenlabs.io). 설정은 새 세션부터 적용됩니다.")
ELEVEN_SETTINGS = {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True, "speed": 1.0}


USED = {}  # 이번 실행에서 쓴 문장별 (tag, mp3 경로) — --lock 이 확정본으로 복사합니다


def fetch_eleven(text: str, voice: dict, cache_dir: Path, prev_text: str = "", next_text: str = "", seed=None,
                 lock_dir: Path = None, lid: str = None) -> Path:
    """일레븐랩스 text-to-speech 로 한 문장을 만듭니다. 앞뒤 문장을 함께 넘겨 억양이 이어지게 합니다.
    lock_dir(episodes/<ep>/voice)에 같은 요청의 확정본이 있으면 그 파일을 씁니다."""
    key = os.environ.get("ELEVENLABS_API_KEY", "")  # 없으면 작업 환경의 API 자격 증명이 요청에 키를 붙입니다
    vid = voice.get("voiceId") or os.environ.get("ELEVENLABS_VOICE_ID", "")
    if not vid:
        sys.exit("복제 목소리 ID가 없습니다. engine/audio/eleven_clone.py 로 목소리를 만들면 voice.json 에 채워집니다.")
    body = {"text": text, "model_id": voice.get("model", "eleven_multilingual_v2"),
            "voice_settings": {**ELEVEN_SETTINGS, **voice.get("settings", {})}}
    if voice.get("languageCode"):
        body["language_code"] = voice["languageCode"]
    if seed is not None:  # 문장의 "seed"를 바꾸면 같은 문장을 다른 테이크로 다시 만듭니다
        body["seed"] = seed
    if voice.get("stitch", True):
        if prev_text:
            body["previous_text"] = prev_text
        if next_text:
            body["next_text"] = next_text
    fmt = voice.get("outputFormat", "mp3_44100_128")
    tag = hashlib.sha1(json.dumps({"v": vid, "b": body, "f": fmt}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
    if lock_dir is not None and lid:
        lock_file = lock_dir / "lock.json"
        locked = json.loads(lock_file.read_text(encoding="utf-8")) if lock_file.exists() else {}
        if locked.get(lid) == tag and (lock_dir / f"{lid}.mp3").exists():
            USED[lid] = (tag, lock_dir / f"{lid}.mp3", "locked")
            return lock_dir / f"{lid}.mp3"
        if lid in locked:
            print(f"  {lid}: 잠금과 다름 → 새로 만듭니다", file=sys.stderr)
    out = cache_dir / f"eleven_{tag}.mp3"
    if lid:
        USED[lid] = (tag, out, "new")
    if out.exists() and out.stat().st_size > 1000:
        return out
    if not PAID_OK:
        PENDING.append((lid or text[:12], len(text)))
        raise NeedCredits(lid)
    url = f"{ELEVEN_BASE}/v1/text-to-speech/{vid}?output_format={fmt}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    for attempt in range(5):
        headers = {"Content-Type": "application/json", "Accept": "audio/mpeg"}
        if key:
            headers["xi-api-key"] = key
        req = urllib.request.Request(url, data=data, method="POST", headers=headers)
        try:
            audio = urllib.request.urlopen(req, timeout=180).read()
            if len(audio) < 1000:
                raise RuntimeError(f"too small response ({len(audio)} bytes)")
            out.write_bytes(audio)
            return out
        except urllib.error.HTTPError as exc:
            detail = exc.read()[:400].decode("utf-8", "replace")
            if exc.code in (401, 403):
                sys.exit(f"일레븐랩스 인증 실패 (HTTP {exc.code}): {detail}\n{ELEVEN_SETUP}")
            if exc.code != 429 and exc.code < 500:
                sys.exit(f"일레븐랩스 오류 {exc.code}: {detail}")
            wait = 2 ** (attempt + 1)
            print(f"  일레븐랩스 재시도 {attempt + 1}/5 (HTTP {exc.code}); {wait}s 대기", file=sys.stderr)
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            wait = 2 ** (attempt + 1)
            print(f"  일레븐랩스 재시도 {attempt + 1}/5 ({exc}); {wait}s 대기", file=sys.stderr)
            time.sleep(wait)
    sys.exit(f"api.elevenlabs.io 에 연결하지 못했습니다.\n{ELEVEN_SETUP}")


def fetch_eleven_scene(texts: list, voice: dict, cache_dir: Path, seed=None) -> tuple:
    """장면의 문장들을 한 번에 읽혀 억양을 자연스럽게 잇고, 글자별 타임스탬프로 문장 경계를 돌려줍니다.
    반환: (mp3 경로, [(문장 시작초, 문장 끝초), …])"""
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    vid = voice.get("voiceId") or os.environ.get("ELEVENLABS_VOICE_ID", "")
    if not vid:
        sys.exit("복제 목소리 ID가 없습니다. engine/audio/eleven_clone.py 로 목소리를 만들면 voice.json 에 채워집니다.")
    text = " ".join(texts)
    body = {"text": text, "model_id": voice.get("model", "eleven_v3"),
            "voice_settings": {**ELEVEN_SETTINGS, **voice.get("settings", {})}}
    if voice.get("languageCode"):
        body["language_code"] = voice["languageCode"]
    if seed is not None:  # 장면의 "seed"를 바꾸면 같은 문장을 다른 읽기로 다시 만듭니다
        body["seed"] = seed
    fmt = voice.get("outputFormat", "mp3_44100_128")
    tag = hashlib.sha1(json.dumps({"v": vid, "b": body, "f": fmt, "ts": 1}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]
    out = cache_dir / f"eleven_scene_{tag}.mp3"
    align_path = cache_dir / f"eleven_scene_{tag}.json"
    if not (out.exists() and align_path.exists()) and not PAID_OK:
        PENDING.append(("scene", len(text)))
        raise NeedCredits("scene")
    if not (out.exists() and align_path.exists()):
        url = f"{ELEVEN_BASE}/v1/text-to-speech/{vid}/with-timestamps?output_format={fmt}"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        for attempt in range(5):
            headers = {"Content-Type": "application/json"}
            if key:
                headers["xi-api-key"] = key
            req = urllib.request.Request(url, data=data, method="POST", headers=headers)
            try:
                res = json.loads(urllib.request.urlopen(req, timeout=300).read())
                out.write_bytes(base64.b64decode(res["audio_base64"]))
                align_path.write_text(json.dumps(res["alignment"], ensure_ascii=False), encoding="utf-8")
                break
            except urllib.error.HTTPError as exc:
                detail = exc.read()[:400].decode("utf-8", "replace")
                if exc.code in (401, 403):
                    sys.exit(f"일레븐랩스 인증 실패 (HTTP {exc.code}): {detail}\n{ELEVEN_SETUP}")
                if exc.code != 429 and exc.code < 500:
                    sys.exit(f"일레븐랩스 오류 {exc.code}: {detail}")
                wait = 2 ** (attempt + 1)
                print(f"  일레븐랩스 재시도 {attempt + 1}/5 (HTTP {exc.code}); {wait}s 대기", file=sys.stderr)
                time.sleep(wait)
            except (urllib.error.URLError, TimeoutError, KeyError, ValueError) as exc:
                wait = 2 ** (attempt + 1)
                print(f"  일레븐랩스 재시도 {attempt + 1}/5 ({exc}); {wait}s 대기", file=sys.stderr)
                time.sleep(wait)
        else:
            sys.exit(f"api.elevenlabs.io 에 연결하지 못했습니다.\n{ELEVEN_SETUP}")
    al = json.loads(align_path.read_text(encoding="utf-8"))
    chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    if "".join(chars) != text:
        raise RuntimeError("타임스탬프 글자가 요청 문장과 다릅니다")
    spans, pos = [], 0
    for t in texts:
        idx = [i for i in range(pos, pos + len(t)) if not chars[i].isspace()]
        spans.append((starts[idx[0]], ends[idx[-1]]))
        pos += len(t) + 1
    return out, spans


def resolve_voice(voice: dict) -> dict:
    """{"use": "channel"} 이면 저장소 루트의 voice.json(채널 공용 목소리)을 읽습니다."""
    if voice.get("use") == "channel":
        base = json.loads((ROOT / "voice.json").read_text(encoding="utf-8"))
        return {**base, **{k: v for k, v in voice.items() if k != "use"}}
    return voice


def decode(path: Path, tempo: float, treble: float = 0.0) -> np.ndarray:
    """오디오 파일을 48kHz mono float32로 디코딩하면서 속도·톤 보정을 적용.
    treble: 6kHz 위 고역 조절(dB). ㅅ·ㅆ 마찰음이 세게 들리면 에피소드 voice에 "treble": -2 처럼 둡니다(1·2화는 0)."""
    filters = [f"aresample={SR}"]
    if abs(tempo - 1.0) > 1e-3:
        filters.append(f"atempo={tempo:.4f}")
    filters += [
        "highpass=f=70",
        "equalizer=f=220:t=q:w=1.0:g=1.5",   # 약간의 따뜻함
        "equalizer=f=3200:t=q:w=1.2:g=2.0",  # 발음 명료도
        "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2",
    ]
    if abs(treble) > 1e-3:
        filters.append(f"highshelf=f=6000:g={treble:.1f}")
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


def main(ep_dir: str, lock: bool = False) -> None:
    ep_path = (ROOT / ep_dir).resolve()
    script = json.loads((ep_path / "script.json").read_text(encoding="utf-8"))
    build = ROOT / "build" / script["episode"]
    (build / "lines").mkdir(parents=True, exist_ok=True)
    cache = ROOT / ".cache" / "tts"
    cache.mkdir(parents=True, exist_ok=True)
    overrides = ep_path / "overrides"

    voice = resolve_voice(script["voice"])
    engine = voice.get("engine", "google-translate-tts")
    timing = script["timing"]
    clips = {}
    spoken_all = [l["tts"].replace("|", " ") for sc in script["scenes"] for l in sc.get("lines", [])]
    # 앞뒤 문장에 넘기는 글: "ttsContext"가 있으면 그것을 씁니다(한 문장만 고칠 때 이웃 문장의 테이크를 그대로 두기 위함)
    context_all = [l.get("ttsContext", l["tts"]).replace("|", " ") for sc in script["scenes"] for l in sc.get("lines", [])]
    idx = 0

    scene_unit = engine == "elevenlabs" and voice.get("unit") == "scene"
    for scene in script["scenes"]:
        pieces = {}
        if scene_unit and scene.get("lines"):
            # 장면 전체를 한 번에 읽힌 뒤 문장 사이 무음의 가운데에서 자릅니다
            texts = [l["tts"].replace("|", " ") for l in scene["lines"]]
            try:
                mp3, spans = fetch_eleven_scene(texts, voice, cache, scene.get("seed"))
            except NeedCredits:
                idx += len(scene["lines"])
                continue
            tempo = voice.get("tempo", 1.0)
            full = decode(mp3, tempo, voice.get("treble", 0.0))
            cuts = [0.0] + [(spans[i][1] + spans[i + 1][0]) / 2 for i in range(len(spans) - 1)] + [len(full) / SR * tempo]
            for i, l in enumerate(scene["lines"]):
                a, b = int(cuts[i] / tempo * SR), int(cuts[i + 1] / tempo * SR)
                pieces[l["id"]] = trim_silence(full[a:b])
        for line in scene.get("lines", []):
            lid = line["id"]
            text = spoken_all[idx]
            prev_text = context_all[idx - 1] if idx > 0 else ""
            next_text = context_all[idx + 1] if idx + 1 < len(context_all) else ""
            idx += 1
            override = overrides / f"{lid}.wav"
            if override.exists():
                audio = trim_silence(decode(override, 1.0))
                source = "override"
            elif lid in pieces:
                audio = pieces[lid]
                source = "eleven·scene"
            elif engine == "elevenlabs":
                try:
                    mp3 = fetch_eleven(text, voice, cache, prev_text, next_text, line.get("seed"), ep_path / "voice", lid)
                except NeedCredits:
                    continue
                audio = trim_silence(decode(mp3, voice.get("tempo", 1.0), voice.get("treble", 0.0)))
                source = "eleven·잠금" if USED.get(lid, (0, 0, ""))[2] == "locked" else "eleven"
            else:
                mp3 = fetch_tts(text, voice.get("lang", "ko"), cache)
                audio = trim_silence(decode(mp3, voice.get("tempo", 1.0)))
                source = "tts"
            audio = normalize_rms(audio)
            sf.write(build / "lines" / f"{lid}.wav", audio, SR, subtype="PCM_24")
            clips[lid] = audio
            print(f"{lid:>4} {len(audio) / SR:5.2f}s [{source}] {line['text'].replace('|', ' ')}")

    if PENDING:
        total = sum(n for _, n in PENDING)
        print(f"\n일레븐랩스로 새로 만들어야 하는 문장 {len(PENDING)}개 · {total}글자(≈ {total}크레딧): "
              + ", ".join(i for i, _ in PENDING))
        sys.exit("크레딧이 드는 작업이라 멈췄습니다. 사용자에게 예상 크레딧을 알리고 허락받은 뒤 ELEVEN_OK=1 을 붙여 다시 실행하세요.")

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


def lock_voice(ep_dir: str) -> None:
    """이번 실행에서 쓴 일레븐랩스 음성을 episodes/<ep>/voice/ 에 확정본으로 저장합니다."""
    import shutil
    vdir = (ROOT / ep_dir).resolve() / "voice"
    vdir.mkdir(exist_ok=True)
    lock = {}
    for lid, (tag, path, _) in USED.items():
        dst = vdir / f"{lid}.mp3"
        if Path(path).resolve() != dst.resolve():
            shutil.copyfile(path, dst)
        lock[lid] = tag
    for f in vdir.glob("*.mp3"):  # 대본에서 빠진 문장의 옛 파일 정리
        if f.stem not in lock:
            f.unlink()
    (vdir / "lock.json").write_text(json.dumps(lock, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"확정본 잠금: {len(lock)}문장 → {vdir.relative_to(ROOT)}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ep_arg = args[0] if args else "episodes/01-parental-leave"
    main(ep_arg)
    if "--lock" in sys.argv:
        lock_voice(ep_arg)
