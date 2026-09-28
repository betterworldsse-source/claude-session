# 출산·육아 정보 유튜브 영상 스튜디오

대본(JSON)만 쓰면 **내레이션 → 모션그래픽 → 배경음악·효과음 → 자막 → 썸네일**까지 한 번에 만들어 주는 영상 제작 파이프라인입니다.
모든 그래픽은 HTML/SVG로 직접 그리고, 시간 t에 대한 순수 함수로 계산하므로 같은 입력이면 매번 같은 영상이 나옵니다.

## 1화: 육아휴직 6개월 연장 제도 & 6+6 부모육아휴직제 (2026년 9월 기준)

구성: 훅(부부 최대 3년·4,000만 원) → 오늘 소개할 제도 두 가지 → ① 6개월 연장 제도(성립 조건) → ② 6+6 부모육아휴직제(어떤 제도인지·월급별 표) → ③ 헷갈리는 포인트 4가지 → ④ 신청 방법 3단계 → 3줄 요약. 내레이션은 '~입니다' 체입니다.

| 파일 | 내용 |
|---|---|
| `episodes/01-parental-leave/output/01-parental-leave_1080p.mp4` | 완성 영상 (1920×1080, 30fps, 약 4분 15초, -14 LUFS) |
| `episodes/01-parental-leave/output/shorts/*.mp4` | 쇼츠 4편 (1080×1920, 헷갈리는 포인트별) · 구성은 `shorts.json` |
| `episodes/01-parental-leave/thumbnail.png` | 유튜브 썸네일 (1280×720) |
| `episodes/01-parental-leave/subtitles.srt` | 유튜브 자막 업로드용 SRT |
| `episodes/01-parental-leave/youtube.md` | 제목 후보 · 설명란(챕터 포함) · 태그 · 고정 댓글 |
| `episodes/01-parental-leave/script.md` | 타임코드가 붙은 대본 |
| `episodes/01-parental-leave/script.json` | 대본 원본 (자막 표기 / TTS 발음 분리) |
| `episodes/01-parental-leave/recording.md` | 내 목소리 녹음 가이드 (대본과 자동 동기화) |
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
node engine/render.mjs shorts 01-parental-leave              # 세로 쇼츠 (mix.wav 필요)
python3 engine/docs.py 01-parental-leave                     # 대본 문서 · 유튜브 챕터
```

## 내레이션을 내 목소리로 바꾸기

현재 내레이션은 **가이드용 합성 음성**(Google 번역 TTS)입니다. 채널 목소리는 **일레븐랩스 복제 목소리**로 쓰는 것을 기본으로 합니다.
어떤 방식이든 영상이 목소리에 맞춰집니다. 모든 그래픽·자막·효과음이 문장(자막 구절) 시작 시각에 묶여 있어 목소리 길이가 바뀌면 자동으로 다시 계산됩니다.

### A. 일레븐랩스 복제 목소리 (채널 기본, 한 번 만들면 계속 사용)

1. 일레븐랩스 Starter 이상 요금제에 가입합니다(인스턴트 보이스 클로닝).
2. 작업 환경 설정(클라우드 환경 메뉴 → Edit)에서 두 가지를 추가하고 **새 세션**을 엽니다.
   - 네트워크 접근: `api.elevenlabs.io` 허용
   - 환경 변수: `ELEVENLABS_API_KEY` (키는 채팅에 붙여 넣지 않습니다)
3. 1~2분 분량의 깨끗한 샘플로 목소리를 만듭니다. 목소리 ID가 `voice.json`에 저장되고, 에피소드가 채널 목소리를 쓰도록 바뀝니다.
   ```bash
   python3 engine/audio/eleven_clone.py 샘플.m4a --name "채널 목소리" --use-in 01-parental-leave
   bash engine/build.sh 01-parental-leave
   ```
   일레븐랩스 사이트에서 직접 만든 경우에는 `voice.json`의 `voiceId`만 채우고 `script.json`의 `"voice"`를 `{"use": "channel"}`로 바꿉니다.
4. 새 에피소드는 `script.json`에 `"voice": {"use": "channel"}`만 넣으면 같은 목소리로 만들어집니다. 문장마다 앞뒤 문장을 함께 넘겨 억양을 잇고, 만든 음성은 `.cache/tts`에 저장돼 다시 빌드해도 과금되지 않습니다.
5. 목소리 설정(모델 `eleven_multilingual_v2`, 안정성·유사도·속도)은 `voice.json`의 `settings`에서 조정합니다. 요금제를 해지하면 목소리는 계정에 남지만, 다시 구독하기 전까지는 쓸 수 없습니다.

### B. 직접 녹음

1. `episodes/<에피소드>/recording.md`의 번호 순서대로 한 번에 녹음합니다. 번호가 바뀔 때마다 2~3초 쉽니다.
2. `python3 engine/audio/split_voice.py <에피소드> 녹음.m4a [12.m4a …]` 로 번호별로 잘라 `overrides/`에 넣습니다. 특정 문장만 녹음 파일로 바꾸는 것도 이 방식입니다(`overrides/<문장id>.wav`가 있으면 어떤 엔진보다 우선).
3. `bash engine/build.sh <에피소드>` 로 다시 빌드합니다.

## 새 에피소드 만들기

`episodes/<새-에피소드>/` 폴더에 `script.json`(대본), `scenes.js`(장면), `thumbnail.js`(썸네일)를 만들고 같은 명령으로 빌드합니다.
공용 엔진은 `engine/`에 있습니다: `web/engine.js`(타임라인·애니메이션), `web/art.js`(캐릭터 일러스트), `web/styles.css`(디자인 토큰).

## 라이선스 · 출처

- 폰트: [Pretendard](https://github.com/orioncactus/pretendard) — SIL Open Font License 1.1 (`assets/fonts/Pretendard-LICENSE.txt`)
- 제목 폰트: [Jua](https://fonts.google.com/specimen/Jua) — SIL Open Font License 1.1 (`assets/fonts/Jua-OFL.txt`)
- 아이콘: [Lucide](https://lucide.dev) — ISC License (`assets/icons/Lucide-LICENSE.txt`)
- 캐릭터 일러스트, 배경음악, 효과음: 이 저장소의 코드로 직접 그리고 합성한 창작물(외부 샘플·음원 미사용)
- 내레이션: Google 번역 TTS로 만든 가이드 음성 — 위 "내레이션을 내 목소리로 바꾸기" 참고
