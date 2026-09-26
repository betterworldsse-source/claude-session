"""타임라인을 바탕으로 대본 문서(script.md)와 유튜브 챕터를 갱신합니다.

사용법: python3 engine/docs.py 01-parental-leave
- episodes/<ep>/script.md 를 새로 씁니다 (장면별 타임코드 + 내레이션).
- episodes/<ep>/youtube.md 안의 <!-- chapters:start --> ~ <!-- chapters:end --> 구간을 갱신합니다.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def tc(sec: float) -> str:
    s = int(sec)
    return f"{s // 60:02d}:{s % 60:02d}"


def main(ep: str) -> None:
    ep_dir = ROOT / "episodes" / ep
    script = json.loads((ep_dir / "script.json").read_text(encoding="utf-8"))
    timeline = json.loads((ROOT / "build" / ep / "timeline.json").read_text(encoding="utf-8"))
    scenes = {s["id"]: s for s in timeline["scenes"]}
    lines = {l["id"]: l for l in timeline["lines"]}

    chapters = [f"{tc(scenes[s['id']]['start'])} {s['ytChapter']}" for s in script["scenes"] if s.get("ytChapter")]

    md = [f"# {script['title']}", "", f"- 기준일: {script['asOf']}",
          f"- 전체 길이: {tc(timeline['duration'])} ({timeline['duration']:.1f}초)",
          "- 자막 파일: `subtitles.srt` · 장면 코드: `scenes.js` · 원본 데이터: `script.json`", ""]
    for s in script["scenes"]:
        sc = scenes[s["id"]]
        head = s.get("ytChapter") or s.get("label") or s["id"]
        md.append(f"## [{tc(sc['start'])}] {head}")
        md.append("")
        if not s.get("lines"):
            md.append("_(내레이션 없음 · 타이틀 애니메이션)_")
            md.append("")
            continue
        for ln in s["lines"]:
            l = lines[ln["id"]]
            md.append(f"- `{tc(l['start'])}` {ln['text'].replace('|', ' ')}")
        md.append("")
    (ep_dir / "script.md").write_text("\n".join(md), encoding="utf-8")

    yt = ep_dir / "youtube.md"
    if yt.exists():
        text = yt.read_text(encoding="utf-8")
        a, b = "<!-- chapters:start -->", "<!-- chapters:end -->"
        if a in text and b in text:
            pre, rest = text.split(a, 1)
            _, post = rest.split(b, 1)
            text = pre + a + "\n" + "\n".join(chapters) + "\n" + b + post
            yt.write_text(text, encoding="utf-8")
    print("\n".join(chapters))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "01-parental-leave")
