#!/usr/bin/env python3
"""대본 검사기: 사용자가 지적한 발음·표현 문제를 목소리를 만들기 전에 잡습니다(크레딧 0).

  python3 engine/audio/script_lint.py 03-spouse-support      # 검사 결과 보기

tts.py 는 이 검사를 먼저 돌리고, '오류'가 있는 문장은 새로 만들지 않습니다(잠긴·이미 만든 문장은 그대로 씀).
새로운 지적이 나오면 아래 규칙에 추가해서 같은 문제가 다시 나오지 않게 합니다.

오류(만들기 전에 반드시 고침)
- 발음 표기(tts)에 숫자·기호(%, ~): 숫자는 한글로, 단위와 붙여 씁니다(이백오십만원, 육개월).
- '만 원'처럼 띄운 돈 단위: '백육십팔만/원'으로 끊어 읽음(3화 지적) → '백육십팔만원'.
- '20일 치'처럼 띄운 '치': '이십일/치'로 끊어 읽음(3화 지적) → '이십일치'.
- '할 수 있'처럼 띄운 '수': '쓸/수/있습니다'로 끊어 읽음 → '할수 있'.
- 자막(text)과 발음(tts)의 '|' 나눔 개수가 다름.
주의(검토 후 그대로 둘 수 있음)
- '쓸 수 있'처럼 ㅆ과 '수'가 겹침: '쓸/쑤'로 세게 읽힘(3화 지적) → '사용이 가능합니다', '가능해요'.
- '퍼센트': '백퍼센트'가 어색하게 읽힘(2화 지적) → '통상임금 전액'처럼 말로.
- '일주'·'이주': 기계처럼 들림 → '일주일'·'이주일'.
- 가운뎃점(·) 나열: 조사를 넣어 풀어 읽기(휴원·휴교 → 휴원이나 휴교).
- 화면에 없는 쉼표가 발음 표기에만 있음.
- 영어 글자: 한글로 풀어 쓰기.
- 에피소드 전체에서 '쓰다'가 6번 넘거나 한 문장에 두 번: '사용할 수 있다', '사용이 가능하다', '가능합니다' 등과 섞기(3화 지적).
- '덜 일하', '월급을 지키' 같은 표현: 제도의 목적(건강·안전한 출산·돌봄) 중심으로(3화 지적).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ERRORS = [
    (re.compile(r"\d"), "숫자는 한글로 씁니다(예: 이백오십만원, 육개월)"),
    (re.compile(r"[%~]"), "기호(%, ~)는 말로 풀어 씁니다"),
    (re.compile(r"[일이삼사오육칠팔구십백천만억] 원"), "돈 단위는 붙여 씁니다('만 원' → '만원'): 띄우면 '만/원'으로 끊어 읽습니다"),
    (re.compile(r"(일|월|년|주일|개월) 치"), "'치'는 붙여 씁니다('이십일 치' → '이십일치')"),
    (re.compile(r"\S 수 (있|없)"), "'할 수 있'은 '할수 있'처럼 붙여 씁니다"),
]
WARNS = [
    (re.compile(r"쓸 ?수 ?(있|없)"), "ㅆ과 '수'가 겹쳐 세게 읽힙니다 → '사용이 가능합니다', '가능해요' 등"),
    (re.compile(r"퍼센트"), "'퍼센트'가 어색하게 읽힐 수 있습니다 → '전액'처럼 말로 풀기"),
    (re.compile(r"(?<![가-힣])(일|이)주(?!일)"), "'일주·이주'는 기계처럼 들립니다 → '일주일·이주일'"),
    (re.compile(r"·"), "가운뎃점 나열은 조사를 넣어 풀어 씁니다(휴원·휴교 → 휴원이나 휴교)"),
    (re.compile(r"[A-Za-z]"), "영어 글자는 한글로 풀어 씁니다"),
]
TEXT_WARNS = [
    (re.compile(r"덜 일하|월급을 지키|월급 그대로"), "제도의 목적(임신부 건강·안전한 출산·아이 돌봄) 중심으로 소개합니다"),
]
SSEU = re.compile(r"쓸|쓰는|쓴|써|쓰고|쓰면|쓰기")


def lint_line(line: dict) -> tuple:
    """(오류 목록, 주의 목록)"""
    tts, text = line.get("tts", ""), line.get("text", "")
    errs = [msg for pat, msg in ERRORS if pat.search(tts)]
    if len(text.split("|")) != len(tts.split("|")):
        errs.append("자막(text)과 발음(tts)의 '|' 나눔 개수가 다릅니다")
    warns = [msg for pat, msg in WARNS if pat.search(tts)]
    warns += [msg for pat, msg in TEXT_WARNS if pat.search(text)]
    if tts.count(",") > text.count(","):
        warns.append("화면에 없는 쉼표가 발음 표기에만 있습니다")
    if len(SSEU.findall(text)) >= 2:
        warns.append("한 문장에 '쓰다'가 두 번 이상 나옵니다 → '사용' 등과 섞기")
    return errs, warns


def lint_episode(script: dict) -> dict:
    lines = [l for sc in script["scenes"] for l in sc.get("lines", [])]
    per = {l["id"]: lint_line(l) for l in lines}
    n_sseu = sum(len(SSEU.findall(l["text"])) for l in lines)
    episode_warns = []
    if n_sseu > 6:
        episode_warns.append(f"에피소드 전체에 '쓰다'가 {n_sseu}번 나옵니다(6번 이하 권장) → '사용할 수 있다', '사용이 가능하다' 등과 섞기")
    return {"lines": per, "episode": episode_warns}


def report(script: dict, out=sys.stdout) -> int:
    """검사 결과를 출력하고 오류 개수를 돌려줍니다."""
    res = lint_episode(script)
    n_err = 0
    for lid, (errs, warns) in res["lines"].items():
        for m in errs:
            print(f"  ✗ {lid}: {m}", file=out)
            n_err += 1
        for m in warns:
            print(f"  △ {lid}: {m}", file=out)
    for m in res["episode"]:
        print(f"  △ 전체: {m}", file=out)
    n_warn = sum(len(w) for _, w in res["lines"].values()) + len(res["episode"])
    print(f"대본 검사: 오류 {n_err} · 주의 {n_warn}", file=out)
    return n_err


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("사용법: python3 engine/audio/script_lint.py <에피소드>")
    ep = sys.argv[1].rstrip("/").split("/")[-1]
    sc = json.loads((ROOT / "episodes" / ep / "script.json").read_text(encoding="utf-8"))
    sys.exit(1 if report(sc) else 0)
