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
pip install -q numpy scipy soundfile librosa torch resemblyzer "setuptools<81" 2>&1 | grep -v "WARNING: Running pip as the 'root'" || true
python3 -c "import numpy, scipy, soundfile, librosa, torch, resemblyzer" && echo "  파이썬 패키지 OK"

echo "▶ 일레븐랩스 연결"
python3 engine/audio/eleven_clone.py --check
