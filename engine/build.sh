#!/usr/bin/env bash
# 에피소드 전체 빌드: 내레이션 → 효과음 큐 → 배경음악 → 영상 렌더 → 믹스/합치기 → 썸네일 → 문서 → 쇼츠
#   사용법: bash engine/build.sh 01-parental-leave
set -euo pipefail
cd "$(dirname "$0")/.."
EP="${1:-01-parental-leave}"
B="build/$EP"

echo "▶ 1/8 내레이션 · 타임라인"
python3 engine/audio/tts.py "episodes/$EP"

echo "▶ 2/8 효과음 큐 추출"
node engine/render.mjs sfx "$EP"

echo "▶ 3/8 배경음악 (장면 구간에 맞춰 섹션 전환)"
read -r DUR SECTIONS < <(python3 - "$B/timeline.json" <<'PY'
import json, sys
tl = json.load(open(sys.argv[1], encoding="utf-8"))
s = {x["id"]: x["start"] for x in tl["scenes"]}
pick = lambda *ks: next(s[k] for k in ks if k in s)
cuts = [0.0, pick("roadmap", "title", "basic"), pick("concept66", "caps"), pick("qa1", "scenario", "summary"), pick("outro")]
print(f"{tl['duration'] + 0.5:.2f}", ",".join(f"{c:.2f}" for c in cuts))
PY
)
python3 engine/audio/bgm.py --duration "$DUR" --out "$B/bgm.wav" --sections "$SECTIONS"
[ -d assets/sfx ] || python3 engine/audio/sfx.py --out assets/sfx

echo "▶ 4/8 영상 렌더 (1920×1080 30fps)"
node engine/render.mjs video "$EP" --workers "${WORKERS:-4}"

echo "▶ 5/8 오디오 믹스 · 합치기"
python3 engine/audio/mix.py "$EP"

echo "▶ 6/8 썸네일"
node engine/render.mjs thumb "$EP"

echo "▶ 7/8 대본 문서 · 유튜브 챕터"
python3 engine/docs.py "$EP"

if [ -f "episodes/$EP/shorts.json" ]; then
  echo "▶ 8/8 세로 쇼츠 (1080×1920)"
  node engine/render.mjs shorts "$EP"
fi

mkdir -p "episodes/$EP/output" && cp "$B/final.mp4" "episodes/$EP/output/${EP}_1080p.mp4"
echo "✅ 완료: episodes/$EP/output/${EP}_1080p.mp4"
