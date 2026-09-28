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
    write_recording_guide(ep_dir, script, timeline)
    print("\n".join(chapters))


# 녹음할 때 헷갈리기 쉬운 표기 → 읽는 법
READ_HINTS = [
    ("6+6", "육 플러스 육"), ("고용24", "고용 이십사"), ("1350", "일삼오공"),
    ("1,350만", "천삼백오십만"), ("2,000만", "이천만"), ("1·2주", "일 주, 이 주"), ("1주·2주", "일 주, 이 주"),
]


def write_recording_guide(ep_dir: Path, script: dict, timeline: dict) -> None:
    """script.json 과 항상 일치하는 녹음 가이드(recording.md)를 만듭니다."""
    n = sum(len(s.get("lines", [])) for s in script["scenes"])
    mins = timeline["duration"] / 60
    ep = ep_dir.name
    out = [
        f"# 🎙️ 내 목소리 녹음 가이드 ({script['title']} · 약 {mins:.0f}분)", "",
        "## 꼭 지켜 주세요 (자동으로 자르는 기준)", "",
        "1. **번호가 바뀔 때마다 2~3초 쉬어 주세요.** 이 긴 쉼을 기준으로 번호별로 자동으로 자릅니다.",
        "2. **같은 번호 안의 문장들은 이어서** 읽어 주세요. 마침표에서는 평소처럼 짧게만 쉽니다.",
        "3. 읽다가 틀려도 **그 번호를 다시 읽지 말고 끝까지** 읽어 주세요. 끝난 뒤 틀린 번호만 따로 녹음해 "
        "`12.m4a`처럼 번호를 파일 이름으로 붙여 함께 보내 주시면 그 부분만 바꿉니다. (처음부터 다시 녹음해도 됩니다.)",
        "4. 번호와 굵은 글씨의 구간 제목은 읽지 않습니다.", "",
        "## 녹음 방법", "",
        "- 조용한 방에서 휴대폰 **음성 메모(녹음) 앱**을 켜고, 입과 휴대폰 사이를 한 뼘(20cm) 정도 띄워 주세요. "
        "에어컨·선풍기는 꺼 주시고, 녹음 앱에 고음질(무손실) 설정이 있으면 켜 주세요.",
        "- 녹음 버튼을 누르고 **2초쯤 조용히 있다가** 1번부터 읽어 주세요.",
        "- 본 녹음 전에 1~2번만 시험 삼아 녹음해 들어 보시면 좋습니다.",
        "- 문장 끝은 적힌 대로 '~입니다' 체로 읽되, 딱딱한 뉴스보다는 차분하게 설명하듯 읽어 주세요. "
        "속도는 평소보다 살짝 또박또박이면 충분합니다. 천천히 읽어도 영상이 목소리 길이에 맞춰 자동으로 늘어납니다.", "",
        "## 보내는 방법 (둘 중 편한 것)", "",
        "- **Google Drive**: 녹음 파일(m4a·mp3·wav 모두 가능)을 드라이브에 올리고 파일 이름을 알려 주세요.",
        f"- **GitHub**: 작업 브랜치의 `episodes/{ep}/recordings/` 폴더에 올려 주세요.", "",
        "녹음을 받으면 번호별로 잘라 넣고, 영상의 그래픽·자막 타이밍을 **목소리 길이에 맞춰 다시 계산**합니다. 본편과 쇼츠가 함께 바뀝니다.", "",
        f"## 읽을 문장 ({n}개)", "", "| # | 문장 | 읽는 법 |", "|---|---|---|",
    ]
    i = 0
    for scene in script["scenes"]:
        if scene.get("ytChapter") and scene.get("lines"):
            out.append(f"|  | **{scene['ytChapter'].split(':')[0].strip()}** |  |")
        for l in scene.get("lines", []):
            i += 1
            text = l["text"].replace("|", " ")
            hints = [f"'{k}' → {v}" for k, v in READ_HINTS if k in text]
            out.append(f"| {i} | {text} | {' · '.join(hints)} |")
    (ep_dir / "recording.md").write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "01-parental-leave")
