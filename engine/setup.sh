#!/usr/bin/env bash
# 새 작업 세션에서 한 번 실행: 빌드·목소리 검사에 필요한 도구를 설치하고 일레븐랩스 연결을 확인합니다.
#   bash engine/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ ffmpeg"
command -v ffmpeg >/dev/null || { apt-get update -qq && apt-get install -y -qq ffmpeg >/dev/null; }

echo "▶ Node (Playwright — Chromium은 환경에 설치된 것을 사용)"
[ -d node_modules/playwright ] || npm install --silent

echo "▶ Python: 오디오 합성 + 목소리 검사(torch·resemblyzer·librosa)"
# resemblyzer가 요구하는 webrtcvad는 소스 빌드가 실패하는 환경이 있어, 미리 빌드된 webrtcvad-wheels를 쓰고 resemblyzer는 --no-deps로 설치합니다.
python3 -m pip install -q numpy scipy soundfile librosa torch "setuptools<81" webrtcvad-wheels 2>&1 | grep -v "WARNING: Running pip as the 'root'" || true
python3 -m pip install -q --no-deps resemblyzer 2>&1 | grep -v "WARNING: Running pip as the 'root'" || true
python3 -c "import numpy, scipy, soundfile, librosa, torch, resemblyzer, webrtcvad" || { echo "  파이썬 패키지 설치 실패"; exit 1; }
echo "  파이썬 패키지 OK"

echo "▶ 일레븐랩스 연결"
python3 engine/audio/eleven_clone.py --check
