# 출산·육아 정보 유튜브 영상 스튜디오

대본(JSON)만 쓰면 **내레이션 → 모션그래픽 → 배경음악·효과음 → 자막 → 썸네일**까지 한 번에 만들어 주는 영상 제작 파이프라인입니다.
모든 그래픽은 HTML/SVG로 직접 그리고, 시간 t에 대한 순수 함수로 계산하므로 같은 입력이면 매번 같은 영상이 나옵니다.

## 1화: 육아휴직 1년 6개월 & 6+6 부모육아휴직제 (2026년 9월 기준)

| 파일 | 내용 |
|---|---|
| `episodes/01-parental-leave/output/육아휴직_1년6개월_6플러스6_정리.mp4` | 완성 영상 (1920×1080, 30fps, 5분 10초, -14 LUFS) |
| `episodes/01-parental-leave/thumbnail.png` | 유튜브 썸네일 (1280×720) |
| `episodes/01-parental-leave/subtitles.srt` | 유튜브 자막 업로드용 SRT |
| `episodes/01-parental-leave/youtube.md` | 제목 후보 · 설명란(챕터 포함) · 태그 · 고정 댓글 |
| `episodes/01-parental-leave/script.md` | 타임코드가 붙은 대본 |
| `episodes/01-parental-leave/script.json` | 대본 원본 (자막 표기 / TTS 발음 분리) |
| `episodes/01-parental-leave/scenes.js` | 장면별 모션그래픽 코드 |

### 사실관계 (영상에 쓴 기준)
- **육아휴직 1년 6개월** (2025.2.23 시행): 같은 자녀에 대해 부모가 각각 3개월 이상 사용 / 한부모 / 중증 장애아동의 부모 → 6개월 추가. 맞벌이 부부 합산 최대 3년. 최대 4번 분할. 이미 1년을 다 쓴 경우도 요건 충족 시 추가 가능(자녀 만 8세 이하·초2 이하). 연장 신청 시 배우자의 3개월 사용 증빙 필요.
- **6+6 부모육아휴직제**: 자녀 생후 18개월 이내 부모 모두 육아휴직 시작(동시·순차 무관) → 각자 첫 6개월 통상임금 100%, 월 상한 250·250·300·350·400·450만 원(1인 최대 2,000만 원). 특례 기간은 나중에 휴직한 사람의 사용 개월 수만큼(최대 6개월). 먼저 쓴 사람은 일반 급여 수령 후 차액 소급.
- **일반 육아휴직 급여** (2025.1.1~): 1~3개월 100%(상한 250만), 4~6개월 100%(상한 200만), 7개월~ 80%(상한 160만). 급여 신청은 고용24, 휴직 종료 후 12개월 이내.
- 2026.8.20 단기 육아휴직(1·2주 단위, 연 1회, 분할 횟수 미포함), 2026.9.18 배우자 출산전후휴가 개편은 이 영상의 핵심 내용과 충돌하지 않음을 확인했습니다.

## 다시 만들기

```bash
npm install                          # Playwright (Chromium은 환경에 설치된 것을 사용)
pip install numpy scipy soundfile    # 오디오 합성
# ffmpeg(libx264) 필요
bash engine/build.sh 01-parental-leave
```

단계별로 돌리고 싶다면:

```bash
python3 engine/audio/tts.py episodes/01-parental-leave       # 내레이션 + 타임라인 + 자막
node engine/render.mjs preview 01-parental-leave 12 95 180   # 특정 시점 스틸컷 확인
node engine/render.mjs video 01-parental-leave --workers 4   # 영상 렌더
python3 engine/audio/mix.py 01-parental-leave                # 믹스 + 합치기 → build/…/final.mp4
node engine/render.mjs thumb 01-parental-leave               # 썸네일
python3 engine/docs.py 01-parental-leave                     # 대본 문서 · 유튜브 챕터
```

## 내레이션을 내 목소리로 바꾸기

현재 내레이션은 **가이드용 합성 음성**(Google 번역 TTS)입니다. 상업적 이용 조건이 명확하지 않으므로, 수익화할 채널이라면 본인 목소리나 상업 이용이 허용된 TTS로 바꾸는 것을 권장합니다.

1. `episodes/01-parental-leave/script.md`를 보며 문장별로 녹음합니다.
2. 파일 이름을 문장 ID로 맞춰 `episodes/01-parental-leave/overrides/`에 넣습니다. 예: `h1.wav`, `h2.wav`, … (`script.json`의 `id`)
3. `bash engine/build.sh 01-parental-leave` 를 실행하면 녹음 길이에 맞춰 **그래픽·자막 타이밍이 자동으로 다시 계산**됩니다.

## 새 에피소드 만들기

`episodes/<새-에피소드>/` 폴더에 `script.json`(대본), `scenes.js`(장면), `thumbnail.js`(썸네일)를 만들고 같은 명령으로 빌드합니다.
공용 엔진은 `engine/`에 있습니다: `web/engine.js`(타임라인·애니메이션), `web/art.js`(캐릭터 일러스트), `web/styles.css`(디자인 토큰).

## 라이선스 · 출처

- 폰트: [Pretendard](https://github.com/orioncactus/pretendard) — SIL Open Font License 1.1 (`assets/fonts/Pretendard-LICENSE.txt`)
- 아이콘: [Lucide](https://lucide.dev) — ISC License (`assets/icons/Lucide-LICENSE.txt`)
- 캐릭터 일러스트, 배경음악, 효과음: 이 저장소의 코드로 직접 그리고 합성한 창작물(외부 샘플·음원 미사용)
- 내레이션: Google 번역 TTS로 만든 가이드 음성 — 위 "내레이션을 내 목소리로 바꾸기" 참고
