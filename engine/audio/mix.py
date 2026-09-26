"""내레이션 + 배경음악(자동 덕킹) + 효과음 → 최종 믹스 → 영상과 합치기.

사용법:
    python3 engine/audio/mix.py 01-parental-leave [--no-mux]

입력:  build/<ep>/narration.wav, build/<ep>/bgm.wav, build/<ep>/sfx.json, assets/sfx/*.wav,
       build/<ep>/timeline.json, build/<ep>/video_noaudio.mp4
출력:  build/<ep>/mix.wav (48kHz 스테레오, -14 LUFS / -1.5 dBTP)
       build/<ep>/final.mp4
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
ROOT = Path(__file__).resolve().parents[2]

# 레벨 설정 (dB). BGM은 약 -20 LUFS로 만들어진다고 가정
VOICE_LUFS = -17.0      # 내레이션 목표 라우드니스(마스터링 전)
BGM_OPEN_DB = -3.5      # 말이 없을 때 배경음악 게인
BGM_DUCK_DB = -12.5     # 말할 때 배경음악 게인
SFX_DB = -10.0          # 효과음 공통 게인
HOLD = 0.9              # 이 시간보다 짧은 쉼에서는 음악을 올리지 않음(펌핑 방지)


def load(path: Path, channels: int) -> np.ndarray:
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != SR:
        raise ValueError(f"{path}: {sr}Hz (48000Hz 필요)")
    if x.shape[1] == 1 and channels == 2:
        x = np.repeat(x, 2, axis=1)
    elif x.shape[1] == 2 and channels == 1:
        x = x.mean(axis=1, keepdims=True)
    return x


def lufs(path: Path) -> float:
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", out)
    return float(m[-1])


def voice_envelope(voice: np.ndarray, n: int) -> np.ndarray:
    """말하는 구간 1, 쉬는 구간 0 → 짧은 쉼은 메우고 부드럽게 보간한 게인 곡선(0~1)."""
    hop = SR // 100  # 10ms
    frames = n // hop + 1
    v = np.zeros(frames)
    mono = voice[:, 0]
    for i in range(frames):
        seg = mono[i * hop : (i + 1) * hop]
        if len(seg):
            v[i] = np.sqrt(np.mean(seg ** 2))
    active = (20 * np.log10(v + 1e-9)) > -42
    # 짧은 쉼 메우기
    idx = np.where(active)[0]
    hold = int(HOLD * 100)
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= hold:
            active[a:b] = True
    # 비대칭 1차 평활: 내려갈 때 빠르게(0.12s), 올라갈 때 천천히(0.7s)
    env = np.zeros(frames)
    cur = 0.0
    a_dn = 1 - np.exp(-1 / (0.12 * 100))
    a_up = 1 - np.exp(-1 / (0.7 * 100))
    # 말 시작 전에 미리 내려가도록 활성 구간을 0.15s 앞당김
    lead = 15
    act = np.concatenate([active[lead:], np.zeros(lead, bool)])
    for i in range(frames):
        target = 1.0 if act[i] else 0.0
        cur += (target - cur) * (a_dn if target > cur else a_up)
        env[i] = cur
    t_env = np.arange(frames) * hop
    return np.interp(np.arange(n), t_env, env).astype(np.float32)


def main(ep: str, mux: bool = True) -> None:
    build = ROOT / "build" / ep
    timeline = json.loads((build / "timeline.json").read_text(encoding="utf-8"))
    fps = timeline["fps"]
    frames = round(timeline["duration"] * fps)
    n = round(frames / fps * SR)

    voice = load(build / "narration.wav", 2)
    voice = np.pad(voice, ((0, max(0, n - len(voice))), (0, 0)))[:n]
    v_lufs = lufs(build / "narration.wav")
    voice *= 10 ** ((VOICE_LUFS - v_lufs) / 20)
    print(f"voice {v_lufs:.1f} LUFS → {VOICE_LUFS} LUFS")

    bgm = load(build / "bgm.wav", 2)
    bgm = np.pad(bgm, ((0, max(0, n - len(bgm))), (0, 0)))[:n]
    env = voice_envelope(voice, n)
    gain_db = BGM_OPEN_DB + (BGM_DUCK_DB - BGM_OPEN_DB) * env
    bgm *= (10 ** (gain_db / 20))[:, None]

    sfx = np.zeros((n, 2), np.float32)
    events = json.loads((build / "sfx.json").read_text(encoding="utf-8"))
    cache = {}
    for e in events:
        name = e["name"]
        if name not in cache:
            p = ROOT / "assets" / "sfx" / f"{name}.wav"
            cache[name] = load(p, 2) if p.exists() else None
            if cache[name] is None:
                print(f"  (효과음 없음: {name})")
        clip = cache[name]
        if clip is None:
            continue
        i0 = int(e["t"] * SR)
        if i0 >= n:
            continue
        seg = clip[: n - i0] * (e["gain"] * 10 ** (SFX_DB / 20))
        sfx[i0 : i0 + len(seg)] += seg
    print(f"sfx events {len(events)}")

    mix = voice + bgm + sfx
    # 끝부분 페이드아웃
    fade = int(1.2 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    pre = build / "mix_pre.wav"
    sf.write(pre, mix, SR, subtype="FLOAT")

    # 2패스 loudnorm (유튜브 기준 -14 LUFS, true peak -1.5 dBTP)
    first = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(pre), "-af",
         "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    meas = json.loads(first[first.rindex("{") : first.rindex("}") + 1])
    af = (
        "loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
        f"measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
        f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']},aresample=48000"
    )
    out = build / "mix.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(pre), "-af", af, "-c:a", "pcm_s24le", str(out)], check=True)
    print(f"mix → {out}  (final {lufs(out):.1f} LUFS)")

    if mux:
        # 렌더 원본(CRF 16)은 용량이 커서, 화질 차이가 거의 없는 CRF 20으로 다시 압축해 100MB 이하로 맞춤
        video = build / "video_noaudio.mp4"
        final = build / "final.mp4"
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(out),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-tune", "animation", "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-shortest", "-movflags", "+faststart", str(final),
        ], check=True)
        print(f"final → {final} ({final.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "01-parental-leave", mux="--no-mux" not in sys.argv)
