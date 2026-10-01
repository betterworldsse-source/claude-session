#!/usr/bin/env python3
"""발음 확인: 문장별 음성을 일레븐랩스 음성 인식(/v1/speech-to-text)으로 받아 적어 대본과 비교합니다.

  python3 engine/audio/stt_check.py 02-short-parental-leave          # 전체 문장
  python3 engine/audio/stt_check.py 02-short-parental-leave h1 a1q   # 일부 문장만

- 자막 표기(text)와 발음 표기(tts) 중 더 가까운 쪽과 비교해, 95% 미만이면 !! 로 표시합니다.
- 숫자 표기 차이(예: '2주일' ↔ '이주일')는 표시될 수 있으니 받아 적은 글을 보고 판단합니다.
  실제 오독(예: 단기→당일, 생후→세모)이면 그 문장의 "seed"를 바꿔 다시 만듭니다.
- tts.py 로 build/<ep>/lines 가 먼저 있어야 합니다.
"""
import difflib
import os
import json
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
import tts  # noqa: E402

norm = lambda t: re.sub(r"[^가-힣0-9]", "", t)  # noqa: E731


def transcribe(wav: Path) -> str:
    with tempfile.TemporaryDirectory() as d:
        mp3 = Path(d) / "a.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-b:a", "64k", str(mp3)], check=True)
        r = subprocess.run(["curl", "-sS", "-X", "POST", f"{tts.ELEVEN_BASE}/v1/speech-to-text",
                            "-F", "model_id=scribe_v1", "-F", "language_code=kor", "-F", "tag_audio_events=false",
                            "-F", f"file=@{mp3}"], capture_output=True, text=True)
    return json.loads(r.stdout).get("text", "?")


def main() -> None:
    ep, only = sys.argv[1], set(sys.argv[2:])
    script = json.loads((ROOT / "episodes" / ep / "script.json").read_text(encoding="utf-8"))
    lines = [l for sc in script["scenes"] for l in sc.get("lines", []) if not only or l["id"] in only]
    d = ROOT / "build" / script["episode"] / "lines"
    # 일레븐랩스 음성 인식은 분당 약 330크레딧(문장 단위로 보내면 더 듭니다) — 2026-10 크레딧 소진의 큰 원인이었습니다.
    # 기본 발음 확인은 사용자가 미리보기를 듣는 것으로 하고, 이 확인은 허락받은 뒤 ELEVEN_STT_OK=1 일 때만 합니다.
    import soundfile as sf
    secs = sum(sf.info(str(d / f"{l['id']}.wav")).duration for l in lines)
    if os.environ.get("ELEVEN_STT_OK") != "1":
        sys.exit(f"일레븐랩스 음성 인식: {len(lines)}문장 · {secs / 60:.1f}분 ≈ {secs / 60 * 330:.0f}크레딧 이상. "
                 "기본 발음 확인은 사용자가 듣는 것으로 합니다. 꼭 필요하면 사용자 허락 후 ELEVEN_STT_OK=1 로 실행하세요.")
    with ThreadPoolExecutor(4) as ex:
        heard = list(ex.map(lambda l: transcribe(d / f"{l['id']}.wav"), lines))
    bad = 0
    for l, h in zip(lines, heard):
        r = max(difflib.SequenceMatcher(None, norm(l["text"].replace("|", " ")), norm(h)).ratio(),
                difflib.SequenceMatcher(None, norm(l["tts"].replace("|", " ")), norm(h)).ratio())
        if r < 0.95:
            bad += 1
            print(f"!! {l['id']:>4} {r:.2f} 들린 글: {h}\n        대본: {l['text'].replace('|', ' ')}")
    print(f"확인 {len(lines)}문장 · 확인 필요 {bad}문장")


if __name__ == "__main__":
    main()
