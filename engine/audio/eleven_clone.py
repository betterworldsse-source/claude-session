"""샘플 녹음으로 일레븐랩스 '인스턴트 보이스 클론'을 만들고, 목소리 ID를 voice.json 에 저장합니다.

사용법:
    python3 engine/audio/eleven_clone.py 샘플.m4a [샘플2.m4a …] [--name "채널 목소리"] [--use-in 01-parental-leave]

- 샘플은 잡음·울림 없이 1~2분이면 충분합니다(3분 넘게는 효과가 거의 없습니다).
- 만든 목소리는 일레븐랩스 계정의 My Voices 에 남아, 다음 에피소드부터 녹음 없이 계속 씁니다.
- --use-in 을 주면 그 에피소드의 script.json 이 채널 목소리({"use": "channel"})를 쓰도록 바꿉니다.
필요: 환경 변수 ELEVENLABS_API_KEY, 네트워크에서 api.elevenlabs.io 허용.
"""

import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("ELEVENLABS_BASE_URL", "https://api.elevenlabs.io")


def to_mp3(src: Path, dst: Path) -> None:
    """일레븐랩스 권장 형식(MP3 192kbps 이상)으로 변환합니다. 소리 자체는 손대지 않습니다."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "44100",
                    "-c:a", "libmp3lame", "-b:a", "192k", str(dst)], check=True)


def multipart(fields: dict, files: list) -> tuple:
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for path in files:
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="{path.name}"\r\n'
                 "Content-Type: audio/mpeg\r\n\r\n").encode() + path.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def main(argv: list) -> None:
    name, use_in, config = "채널 목소리", "", ROOT / "voice.json"
    samples = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a in ("--name", "--use-in", "--config"):
            val = argv[i + 1]
            if a == "--name":
                name = val
            elif a == "--use-in":
                use_in = val
            else:
                config = Path(val)
            i += 2
            continue
        samples.append(Path(a))
        i += 1
    if not samples:
        sys.exit(__doc__)
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not key:
        sys.exit("ELEVENLABS_API_KEY 환경 변수가 없습니다. 작업 환경 설정에서 등록한 뒤 새 세션에서 다시 실행하세요.")

    with tempfile.TemporaryDirectory() as tmp:
        mp3s = []
        for k, sp in enumerate(samples):
            dst = Path(tmp) / f"sample_{k + 1}.mp3"
            to_mp3(sp, dst)
            mp3s.append(dst)
        body, ctype = multipart({"name": name, "description": "YouTube narration voice (instant clone)"}, mp3s)
        req = urllib.request.Request(f"{BASE}/v1/voices/add", data=body, method="POST",
                                     headers={"xi-api-key": key, "Content-Type": ctype, "Accept": "application/json"})
        try:
            res = json.loads(urllib.request.urlopen(req, timeout=300).read())
        except urllib.error.HTTPError as exc:
            sys.exit(f"일레븐랩스 오류 {exc.code}: {exc.read()[:400].decode('utf-8', 'replace')}")
    vid = res.get("voice_id")
    if not vid:
        sys.exit(f"목소리 ID를 받지 못했습니다: {res}")

    cfg = json.loads(config.read_text(encoding="utf-8"))
    cfg.update(name=name, voiceId=vid)
    config.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"복제 목소리 생성: {name} ({vid}) → {config}")
    if res.get("requires_verification"):
        print("⚠️  일레븐랩스에서 목소리 확인(verification)을 요구합니다. 사이트의 My Voices 에서 확인해 주세요.")

    if use_in:
        sp = ROOT / "episodes" / use_in / "script.json"
        script = json.loads(sp.read_text(encoding="utf-8"))
        script["voice"] = {"use": "channel"}
        sp.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{use_in}: 채널 목소리를 쓰도록 바꿨습니다. 이제 `bash engine/build.sh {use_in}` 로 다시 빌드하세요.")


if __name__ == "__main__":
    main(sys.argv[1:])
