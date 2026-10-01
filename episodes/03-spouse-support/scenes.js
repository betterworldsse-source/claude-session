// 3화: 달라진 배우자 출산휴가 (배우자 지원 3종 세트, 2026. 9. 18. 시행) — 장면 정의
// 흐름: 표지(5초) → 훅(출산예정일 50일 전부터) → 오늘 알아볼 세 가지 → ① 배우자 출산전후휴가 → ② 임신 중 육아휴직
//       → ③ 배우자 유산·사산휴가 → ④ 헷갈리는 포인트 → ⑤ 신청 방법 → 정리 → 상담·다음 영상
// 1·2화와 같은 시각 언어: 가로 시간축(1칸 = 하루), 카드 뒤집기, 떨어지는 블록. 모든 타이밍은 문장/자막 시작 시각 기준입니다.
import { ease, P, clamp, lerp, wave, mount, tf, opacity, enter, pop, drop, rise, prepDraw, draw, icon } from '../../engine/web/engine.js';
import { coverScene } from '../../engine/web/cover.js';
import { family, blink, coins, baby, mom, dad } from '../../engine/web/art.js';

export const asOf = '2026년 9월 기준';

export const chapters = {
  1: { label: '1', sub: '배우자 출산전후휴가', cardChip: '첫 번째', title: '출산전후휴가', cardSub: '배우자 출산휴가, 출산예정일 50일 전부터', short: '출산전후휴가', color: 'mint', icon: 'calendar-range', card: ['#2DBFA4', '#138C78'] },
  2: { label: '2', sub: '배우자 임신 중 육아휴직', cardChip: '두 번째', title: '임신 중 육아휴직', cardSub: '유산·조산 위험이 있으면 출산 전에도', short: '임신 중', color: 'gold', icon: 'baby', card: ['#F9A12B', '#E0700A'] },
  3: { label: '3', sub: '배우자 유산·사산휴가', cardChip: '세 번째 · 신설', title: '유산·사산휴가', cardSub: '아내 곁을 지키는 5일', short: '유산·사산', color: 'lav', icon: 'hand-heart', card: ['#9C8CFF', '#6F5EE8'] },
  4: { label: '4', sub: '헷갈리는 포인트 4가지', cardChip: '꼭 짚고 갈 것', title: '헷갈리는 포인트', cardSub: '자주 묻는 질문 4가지', short: '포인트', color: 'coral', icon: 'circle-help', card: ['#FF8C74', '#E4553E'] },
  5: { label: '5', sub: '신청 방법', cardChip: '마지막 체크', title: '신청 방법', cardSub: '회사 → 진단서·기한 → 고용24', short: '신청', color: 'blue', icon: 'clipboard-check', card: ['#5B9BFA', '#2F6FE0'] },
  6: { label: '정리', sub: '3줄 요약', title: '정리', short: '정리', color: 'mint', icon: 'list-checks', card: null },
};

// 헷갈리는 포인트 태그 (쇼츠 화면도 이 표를 씁니다)
export const SYS = {
  leave: { label: '배우자 출산전후휴가', color: 'mint', icon: 'calendar-range' },
  pay: { label: '급여', color: 'gold', icon: 'coins' },
};

// ------------------------------------------------------------------ 공용 조각 (1·2화와 같은 모양)

function header(root, { y = 128, size = 76, lines }) {
  const box = Math.round(size * 1.24);
  const r = mount(root, `
    <div class="abs" style="left:0;top:${y}px;width:1920px;height:${box}px">
      ${lines.map((l, i) => `<div class="abs" style="left:0;top:0;width:1920px;height:${box}px;overflow:hidden;text-align:center"><div class="h1" data-r="hdL${i}" style="font-size:${size}px">${l.html}</div></div>`).join('')}
    </div>`);
  return (t) => {
    lines.forEach((l, i) => {
      const next = lines[i + 1];
      rise(r[`hdL${i}`], t, l.at, { out: next ? next.at - 0.05 : l.out ?? null, od: 0.35 });
    });
  };
}

function qaHead(root, { n, sys, q, tChip, tQ, qSize = 50 }) {
  const s = SYS[sys];
  const r = mount(root, `
    <div class="abs row" data-r="qaChip" style="left:150px;top:150px;gap:14px">
      <div class="chip" style="height:54px;font-size:27px;padding:0 22px;border:3px solid var(--red);color:var(--red);background:rgba(255,255,255,0.75)">${icon('circle-help', { size: 28, stroke: 2.4 })}헷갈리는 포인트 ${n}</div>
      <div class="chip ${s.color}" style="height:54px;font-size:27px;padding:0 22px">${icon(s.icon, { size: 28 })}${s.label}</div>
    </div>
    <div class="abs row" data-r="qaQ" style="left:150px;top:230px;gap:26px"><div class="qbadge">Q</div><div style="font-size:${qSize}px;font-weight:780;letter-spacing:-0.03em;white-space:nowrap">${q}</div></div>`);
  return (t) => {
    enter(r.qaChip, t, tChip, { dx: -24, dy: 0 });
    enter(r.qaQ, t, tQ, { dy: 24 });
  };
}

/** 하루 = 타일 1칸. n칸을 cols칸씩 줄 바꿈 */
function dayTiles(root, { x, y, n, cols = n, size = 44, gap = 8, cls = 'gold', ref, radius = 12 }) {
  let html = '';
  for (let i = 0; i < n; i++) {
    const c = typeof cls === 'function' ? cls(i) : cls;
    html += `<div class="tile ${c}" data-r="${ref}${i}" style="left:${x + (i % cols) * (size + gap)}px;top:${y + Math.floor(i / cols) * (size + gap)}px;width:${size}px;height:${size}px;border-radius:${radius}px"></div>`;
  }
  const r = mount(root, html);
  return Array.from({ length: n }, (_, i) => r[`${ref}${i}`]);
}

const setCls = (el, cls, base = 'tile') => { const c = `${base} ${cls}`; if (el.className !== c) el.className = c; };
const OK_BADGE = `<svg viewBox="0 0 48 48" width="100%" height="100%"><circle cx="24" cy="24" r="23" fill="#22B573"/><path d="M13 25l7.5 7.5L35 17" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NO_BADGE = `<svg viewBox="0 0 48 48" width="100%" height="100%"><circle cx="24" cy="24" r="23" fill="#F0525A"/><path d="M16 16l16 16M32 16L16 32" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/></svg>`;
const LAV_BG = 'linear-gradient(160deg,#A99BFF,var(--lav))';
const LAV_SHADOW = 'inset 0 -6px 0 rgba(31,42,55,0.14)';

function flip(front, back, t, t0, d = 0.5) {
  const p = clamp((t - t0) / d);
  const k = Math.abs(Math.cos(Math.PI * p));
  const showBack = p >= 0.5;
  tf(front, { sx: showBack ? 1 : Math.max(0.001, k), o: showBack ? 0 : 1 });
  tf(back, { sx: showBack ? Math.max(0.001, k) : 1, o: showBack ? 1 : 0 });
}

/** 카드 강조: 테두리 링 + 살짝 확대 */
function focusCard(slot, back, t, on, t0, color) {
  back.style.boxShadow = on ? `0 0 0 5px var(--${color}), var(--shadow)` : 'var(--shadow)';
  slot.style.zIndex = on ? 2 : 1;
  const sc = 1 + 0.03 * (on ? P(t, t0 + 0.4, 0.4) : 0);
  slot.style.transform += ` scale(${sc.toFixed(4)})`;
}

const badge = (ic, color, s = 78) => `<div class="icon-badge" style="width:${s}px;height:${s}px;border-radius:${Math.round(s * 0.3)}px;background:var(--${color}-soft);color:var(--${color}-2)">${icon(ic, { size: Math.round(s * 0.56) })}</div>`;

/** 가로 막대(구간). origin: 'left'이면 왼쪽에서, 'right'이면 오른쪽에서 자라납니다 */
const seg = (ref, x, y, w, h, bg, radius, origin = 'left') =>
  `<div class="abs" data-r="${ref}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${radius};background:${bg};transform-origin:${origin === 'left' ? '0' : '100%'} 50%"></div>`;
const GOLD_BG = 'linear-gradient(160deg,#FFCB5C,var(--gold))';
const MINT_BG = 'linear-gradient(160deg,#3CC7AE,var(--mint))';
const GRAY_BG = 'linear-gradient(160deg,#D6DBE2,#BCC3CD)';
/** 막대가 자라나는 애니메이션 */
const grow = (el, t, t0, d = 0.7, out = null) => tf(el, { sx: Math.max(0.001, P(t, t0, d, ease.outCubic)), o: clamp((t - t0) / 0.12) * (out == null ? 1 : 1 - P(t, out, 0.35)) });
const numDot = (n, color, s = 58) => `<div class="center" style="width:${s}px;height:${s}px;border-radius:${s / 2}px;background:var(--${color});color:#fff;font-size:${Math.round(s * 0.55)}px;font-weight:880;flex:none">${n}</div>`;

// ------------------------------------------------------------------ 1. 도입부: 훅(출산예정일 50일 전부터) → 오늘 알아볼 세 가지
const intro = {
  id: 'intro',
  build(root, c) {
    const H0b = c.at('h0', 1), H0c = c.at('h0', 2), H1 = c.at('h1'), H1b = c.at('h1', 1), I1 = c.at('i1'), I2 = c.at('i2'), I3 = c.at('i3'), I4 = c.at('i4'), I5 = c.at('i5');
    const hd = header(root, {
      y: 140, size: 84,
      lines: [
        { html: '이제 <span class="hl-blue">아빠도</span> 출산 전에', at: 0.12 },
        { html: '출산예정일 <span class="hl-gold">50일 전</span>부터', at: H0b },
        { html: '<span class="hl-coral">배우자 지원 3종 세트</span>', at: H1b },
        { html: '오늘 알아볼 <span class="hl-coral">세 가지</span>', at: I1 },
        { html: '헷갈리는 포인트와 <span class="hl-blue">신청 방법</span>까지', at: I5 },
      ],
    });
    // 훅: 시간축 — 출산예정일 기준, 원래는 출산 후 120일(민트) → 이제 출산 전 50일(금색)이 붙음
    const M = 830, K = 6, AY = 600;
    const gx = M - 50 * K, mx = M + 120 * K;
    const hook = mount(root, `
      <div class="card" data-r="hk" style="left:150px;top:290px;width:1620px;height:500px"></div>
      <div class="abs" data-r="dd" style="left:196px;top:356px">${dad({ w: 200 })}</div>
      <div class="abs" data-r="ax" style="left:430px;top:${AY - 3}px;width:1260px;height:6px;border-radius:3px;background:rgba(31,42,55,0.14);transform-origin:0 50%"></div>
      ${seg('gs', gx, AY - 30, M - gx, 60, GOLD_BG, '30px 0 0 30px', 'right')}
      ${seg('ms', M, AY - 30, mx - M, 60, MINT_BG, '0 30px 30px 0', 'left')}
      <div class="abs" data-r="mk" style="left:${M - 3}px;top:486px;width:6px;height:200px;border-radius:3px;background:#1F2A37"></div>
      <div class="abs" data-r="bb" style="left:${M - 54}px;top:372px">${badge('baby', 'coral', 108)}</div>
      <div class="abs chip white" data-r="mkL" style="left:${M - 96}px;top:306px;height:54px;font-size:27px;padding:0 22px">출산예정일</div>
      <div class="abs chip" data-r="gL" style="left:${gx + 14}px;top:660px;height:58px;font-size:28px;padding:0 20px;background:var(--gold);color:#fff">${icon('sparkles', { size: 28 })}출산 전 50일</div>
      <div class="abs chip mint" data-r="mL" style="left:${M + 250}px;top:660px;height:58px;font-size:28px;padding:0 22px">출산 후 120일</div>
      <div class="abs col center" data-r="stamp" style="left:1440px;top:318px;width:290px;height:130px;border-radius:24px;border:5px solid var(--coral);color:var(--coral-2);background:rgba(255,255,255,0.94);font-weight:880;box-shadow:var(--shadow-sm)">
        <div style="font-size:28px;letter-spacing:0.02em">2026. 9. 18.</div><div style="font-size:44px;letter-spacing:0.1em">시행</div>
      </div>`);
    // 오늘 알아볼 세 가지: 뒤집히는 카드
    const PW = 520, PH = 440, PY = 320, PX = [130, 700, 1270];
    const face = (n, color, title, big, sub, ic) => `
      <div class="abs row" style="left:30px;top:32px;gap:14px">${numDot(n, color)}<div style="font-size:33px;font-weight:820;letter-spacing:-0.035em;white-space:nowrap">${title}</div></div>
      <div class="abs" style="left:${(PW - 128) / 2}px;top:122px">${badge(ic, color, 128)}</div>
      <div class="abs disp" style="left:0;top:274px;width:${PW}px;text-align:center;font-size:52px;color:var(--${color}-2);white-space:nowrap">${big}</div>
      <div class="abs" style="left:0;top:356px;width:${PW}px;text-align:center;font-size:28px;font-weight:700;color:var(--ink-2);white-space:nowrap">${sub}</div>`;
    const backs = [
      face(1, 'mint', '배우자 출산전후휴가', '출산 50일 전부터', '20일 · 모두 유급', 'calendar-range'),
      face(2, 'gold', '임신 중 육아휴직', '출산 전에도', '유산·조산 위험이 있으면', 'baby'),
      face(3, 'lav', '배우자 유산·사산휴가', '5일 · 3일 유급', '새로 생긴 휴가', 'hand-heart'),
    ];
    const slot = (i, back) => `
      <div class="abs" data-r="s${i}" style="left:${PX[i]}px;top:${PY}px;width:${PW}px;height:${PH}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${PW}px;height:${PH}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:200px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${PW}px;height:${PH}px">${back}</div>
      </div>`;
    const nchip = (ref, n, color, text) => `<div class="chip" data-r="${ref}" style="height:70px;font-size:34px;padding:0 32px 0 14px;background:var(--${color});color:#fff;box-shadow:0 14px 30px rgba(31,42,55,0.16)"><div class="center" style="width:48px;height:48px;border-radius:24px;background:#fff;color:var(--${color}-2);font-size:28px;font-weight:880">${n}</div>${text}</div>`;
    const r = mount(root, `${backs.map((b, i) => slot(i, b)).join('')}
      <div class="abs row" style="left:0;top:800px;width:1920px;justify-content:center;gap:22px">
        ${nchip('c4', 4, 'coral', '헷갈리는 포인트 4가지')}${nchip('c5', 5, 'blue', '신청 방법')}
      </div>`);
    const tOpen = [I2, I3, I4];
    const hookOut = I1 - 0.35;
    const COL = ['mint', 'gold', 'lav'];
    c.sfx(0.3, 'pop', 0.45);
    c.sfx(0.55, 'whoosh', 0.25);
    c.sfx(0.95, 'pop', 0.5);
    c.sfx(1.3, 'whoosh', 0.3);
    c.sfx(H0b + 0.1, 'whoosh', 0.35);
    c.sfx(H0b + 0.75, 'sparkle', 0.5);
    c.sfx(H1 + 0.2, 'click', 0.7);
    c.sfx(I1 + 0.2, 'pop', 0.4); c.sfx(I1 + 0.32, 'pop', 0.4); c.sfx(I1 + 0.44, 'pop', 0.4);
    tOpen.forEach((o) => { c.sfx(o, 'whoosh', 0.25); c.sfx(o + 0.25, 'pop', 0.5); });
    c.sfx(I5 + 0.45, 'click', 0.6); c.sfx(I5 + 0.75, 'click', 0.6);
    return (t) => {
      hd(t);
      enter(hook.hk, t, 0.15, { dy: 40, out: hookOut });
      enter(hook.dd, t, 0.3, { dy: 30, s0: 0.9, y: wave(t, 3, 4), out: hookOut });
      blink(hook.dd, t, 1);
      tf(hook.ax, { sx: Math.max(0.001, P(t, 0.45, 0.7, ease.outCubic)), o: 1 - P(t, hookOut, 0.35) });
      enter(hook.mk, t, 0.8, { dy: 20, s0: 1, out: hookOut });
      pop(hook.bb, t, 0.95, { out: hookOut });
      pop(hook.mkL, t, 1.1, { out: hookOut });
      grow(hook.ms, t, 1.3, 0.8, hookOut);
      pop(hook.mL, t, 1.9, { out: hookOut });
      grow(hook.gs, t, H0b + 0.1, 0.75, hookOut);
      pop(hook.gL, t, H0b + 0.75, { r: wave(t, 2.4, 1.2), out: hookOut });
      pop(hook.stamp, t, H1 + 0.15, { r: -8, s0: 1.8, e: ease.outCubic, d: 0.35, out: hookOut });
      [0, 1, 2].forEach((i) => {
        enter(r[`s${i}`], t, I1 + 0.15 + i * 0.12, { dy: 50 });
        flip(r[`f${i}`], r[`b${i}`], t, tOpen[i], 0.5);
        focusCard(r[`s${i}`], r[`b${i}`], t, t >= tOpen[i] && t < (i < 2 ? tOpen[i + 1] : I5), tOpen[i], COL[i]);
      });
      pop(r.c4, t, I5 + 0.45, { r: wave(t, 2.4, 1.5) });
      pop(r.c5, t, I5 + 0.75, { r: wave(t, 2.6, -1.5) });
      void H0c;
    };
  },
};

// ------------------------------------------------------------------ 2. ① 배우자 출산전후휴가: 이름이 바뀌고, 출산예정일 50일 전부터
const before = {
  id: 'before',
  build(root, c) {
    const B1b = c.at('b1', 1), B2 = c.at('b2'), B2b = c.at('b2', 1), B3 = c.at('b3'), B3b = c.at('b3', 1);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '<span class="hl-mint">배우자 출산휴가</span>', at: c.in + 0.1 },
        { html: '이름이 <span class="hl-mint">배우자 출산전후휴가</span>로', at: B1b },
        { html: '원래는 <span class="hl-coral">출산 후 120일</span> 안에만', at: B2 },
        { html: '이제 <span class="hl-gold">출산예정일 50일 전</span>부터', at: B2b },
        { html: '<span class="hl-blue">검진 동행</span> · <span class="hl-blue">출산 준비</span>도 함께', at: B3 },
      ],
    });
    // 이름표: 배우자 출산휴가 → 배우자 출산전후휴가 (뒤집기)
    const NW = 900, NH = 120, NX = (1920 - NW) / 2, NY = 292;
    const name = mount(root, `
      <div class="abs" data-r="nm" style="left:${NX}px;top:${NY}px;width:${NW}px;height:${NH}px">
        <div class="card row center" data-r="n0" style="left:0;top:0;width:${NW}px;height:${NH}px;gap:18px;font-size:54px;font-weight:860;letter-spacing:-0.03em">${icon('file-text', { size: 52, color: '#8A94A3' })}배우자 출산휴가</div>
        <div class="card row center" data-r="n1" style="left:0;top:0;width:${NW}px;height:${NH}px;gap:18px;font-size:54px;font-weight:860;letter-spacing:-0.03em;box-shadow:0 0 0 5px var(--mint), var(--shadow)">${icon('badge-check', { size: 52, color: '#14997F' })}<span>배우자 출산<span style="color:var(--gold-2)">전후</span>휴가</span></div>
      </div>`);
    // 시간축
    const M = 900, K = 5.6, AY = 640;
    const gx = M - 50 * K, mx = M + 120 * K;
    const tl = mount(root, `
      <div class="card" data-r="box" style="left:150px;top:450px;width:1620px;height:380px"></div>
      <div class="abs" data-r="ax" style="left:250px;top:${AY - 3}px;width:1420px;height:6px;border-radius:3px;background:rgba(31,42,55,0.14);transform-origin:0 50%"></div>
      ${seg('gs', gx, AY - 30, M - gx, 60, GOLD_BG, '30px 0 0 30px', 'right')}
      ${seg('ms', M, AY - 30, mx - M, 60, MINT_BG, '0 30px 30px 0', 'left')}
      <div class="abs" data-r="mk" style="left:${M - 3}px;top:540px;width:6px;height:190px;border-radius:3px;background:#1F2A37"></div>
      <div class="abs chip white" data-r="mkL" style="left:${M + 18}px;top:478px;height:52px;font-size:26px;padding:0 20px">${icon('baby', { size: 28, color: '#E4553E' })}출산(예정)일</div>
      <div class="abs chip mint" data-r="mL" style="left:${M + 230}px;top:698px;height:56px;font-size:28px;padding:0 22px">원래: 출산 후 120일</div>
      <div class="abs chip" data-r="gL" style="left:${gx - 30}px;top:698px;height:56px;font-size:28px;padding:0 20px;background:var(--gold);color:#fff">${icon('sparkles', { size: 28 })}이제: 50일 전부터</div>
      <div class="abs chip white" data-r="e1" style="left:${gx - 190}px;top:476px;height:58px;font-size:28px;padding:0 22px">${icon('stethoscope', { size: 30, color: '#2F6FE0' })}검진 동행</div>
      <div class="abs chip white" data-r="e2" style="left:${gx + 40}px;top:476px;height:58px;font-size:28px;padding:0 22px">${icon('backpack', { size: 30, color: '#2F6FE0' })}출산 준비</div>`);
    c.sfx(c.in + 0.2, 'pop', 0.45);
    c.sfx(B1b + 0.05, 'whoosh', 0.3); c.sfx(B1b + 0.3, 'ding', 0.5);
    c.sfx(B2 + 0.2, 'whoosh', 0.3);
    c.sfx(B2b + 0.1, 'whoosh', 0.35); c.sfx(B2b + 0.8, 'sparkle', 0.5);
    c.sfx(B3 + 0.1, 'pop', 0.45); c.sfx(B3b + 0.1, 'pop', 0.45);
    return (t) => {
      hd(t);
      enter(name.nm, t, c.in + 0.15, { dy: 30 });
      flip(name.n0, name.n1, t, B1b, 0.5);
      enter(tl.box, t, B2 - 0.2, { dy: 40 });
      tf(tl.ax, { sx: Math.max(0.001, P(t, B2 - 0.05, 0.6, ease.outCubic)), o: clamp((t - B2 + 0.05) / 0.12) });
      enter(tl.mk, t, B2 + 0.1, { dy: 20, s0: 1 });
      pop(tl.mkL, t, B2 + 0.2, {});
      grow(tl.ms, t, B2 + 0.35, 0.8);
      pop(tl.mL, t, B2 + 0.9, {});
      grow(tl.gs, t, B2b + 0.1, 0.75);
      pop(tl.gL, t, B2b + 0.8, { r: wave(t, 2.4, 1.2) });
      pop(tl.e1, t, B3 + 0.1, { dy: 20 });
      pop(tl.e2, t, B3b + 0.1, { dy: 20 });
      tl.mL.style.opacity = (+tl.mL.style.opacity * (t >= B2b + 0.8 ? 0.55 : 1)).toFixed(3);
    };
  },
};

// ------------------------------------------------------------------ 3. ① 20일 모두 유급 + 우선지원대상기업은 정부가 최대 약 168만 원
const days = {
  id: 'days',
  build(root, c) {
    const B4b = c.at('b4', 1), B5 = c.at('b5'), B5b = c.at('b5', 1), B5c = c.at('b5', 2);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '휴가는 그대로 <span class="hl-mint">20일</span>', at: c.in + 0.05 },
        { html: '20일 <span class="hl-gold">모두 유급</span>', at: B4b },
        { html: '<span class="hl-blue">우선지원대상기업</span>이라면', at: B5 },
        { html: '정부 지원 최대 <span class="hl-gold">약 168만 원</span>', at: B5c },
      ],
    });
    const LX = 150, LW = 760, RX = 950, RW = 820, Y = 300, HH = 500;
    const S = 58, G = 10, GX = LX + (LW - (10 * (S + G) - G)) / 2;
    const r = mount(root, `
      <div class="card" data-r="L" style="left:${LX}px;top:${Y}px;width:${LW}px;height:${HH}px">
        <div class="abs row" style="left:40px;top:34px;gap:14px;font-size:34px;font-weight:820">${icon('calendar-days', { size: 38 })}배우자 출산전후휴가 <span class="hl-mint">20일</span></div>
        <div class="abs row" data-r="paid" style="left:0;top:376px;width:${LW}px;justify-content:center;gap:12px;font-size:36px;font-weight:840;color:var(--gold-2)">${icon('coins', { size: 40 })}20일 모두 유급</div>
      </div>
      <div class="card" data-r="R" style="left:${RX}px;top:${Y}px;width:${RW}px;height:${HH}px">
        <div class="abs row" data-r="g0" style="left:40px;top:34px;gap:18px">${badge('building-2', 'blue', 96)}<div class="col" style="gap:2px"><div style="font-size:38px;font-weight:840">우선지원대상기업</div><div style="font-size:26px;font-weight:650;color:var(--ink-3)">중소기업 등</div></div></div>
        <div class="abs row" data-r="g1" style="left:40px;top:172px;gap:12px"><div class="chip blue" style="height:60px;font-size:30px;padding:0 24px">${icon('hand-coins', { size: 32 })}20일치 급여를 정부가 지원</div></div>
        <div class="abs row" data-r="g2" style="left:40px;top:262px;gap:12px;align-items:baseline;color:var(--gold-2)"><span style="font-size:34px;font-weight:800;color:var(--ink-2)">최대</span><span class="disp" style="font-size:112px;line-height:1.1">약 168만</span><span class="disp" style="font-size:56px">원</span></div>
        <div class="abs" data-r="g3" style="left:40px;top:414px;font-size:24px;font-weight:620;color:var(--ink-3)">하루 상한 8만 4,210원 × 20일 · 2026년 기준</div>
      </div>
      <div class="abs" data-r="coinFly" style="left:0;top:0">${coins(3, 90)}</div>`);
    const tiles = dayTiles(root, { x: GX, y: Y + 124, n: 20, cols: 10, size: S, gap: G, cls: 'mint', ref: 'd', radius: 14 });
    for (let i = 0; i < 8; i++) c.sfx(c.in + 0.35 + i * 0.09, 'tick', 0.22);
    c.sfx(B4b + 0.1, 'coin', 0.6);
    c.sfx(B5 + 0.1, 'whoosh', 0.3); c.sfx(B5 + 0.3, 'pop', 0.45);
    c.sfx(B5b + 0.1, 'pop', 0.45);
    c.sfx(B5c + 0.2, 'coin', 0.75);
    return (t) => {
      hd(t);
      enter(r.L, t, c.in + 0.1, { dy: 50 });
      tiles.forEach((el, i) => {
        drop(el, t, c.in + 0.35 + i * 0.045, { h: 60 });
        setCls(el, t >= B4b + 0.1 + i * 0.03 ? 'gold' : 'mint');
      });
      pop(r.paid, t, B4b + 0.4, {});
      enter(r.R, t, B5 - 0.1, { dy: 50 });
      enter(r.g0, t, B5 + 0.2, { dx: 30, dy: 0 });
      enter(r.g1, t, B5b + 0.05, { dx: 30, dy: 0 });
      pop(r.g2, t, B5c + 0.15, { s0: 0.7 });
      enter(r.g3, t, B5c + 0.9, { dy: 10 });
      const fp = P(t, B5c + 0.15, 0.9, ease.inOutCubic);
      tf(r.coinFly, { x: lerp(480, 1300, fp), y: lerp(560, 600, fp) - Math.sin(fp * Math.PI) * 180, o: fp > 0 && fp < 1 ? 1 : 0 });
    };
  },
};

// ------------------------------------------------------------------ 4. ② 임신 중 육아휴직: 원래는 출생 후부터 → 유산·조산 위험 진단 시 출산 전에도 → 기간 차감·횟수 불포함
const pregnant = {
  id: 'pregnant',
  build(root, c) {
    const C1b = c.at('c1', 1), C2 = c.at('c2'), C2b = c.at('c2', 1), C3 = c.at('c3'), C3b = c.at('c3', 1), C4 = c.at('c4'), C4b = c.at('c4', 1);
    const outA = C4 - 0.3;
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '<span class="hl-gold">임신 중 육아휴직</span>', at: c.in + 0.1 },
        { html: '원래 아빠 육아휴직은 <span class="hl-coral">출생 후</span>부터', at: C1b },
        { html: '아내에게 <span class="hl-gold">유산·조산 위험</span>이 있으면', at: C2 },
        { html: '<span class="hl-gold">출산 전</span>에도 육아휴직 가능', at: C2b },
        { html: '<span class="hl-blue">고위험 임신 진단</span>을 받은 날부터', at: C3 },
        { html: '기간에선 <span class="hl-coral">빠지고</span>, 횟수엔 <span class="hl-mint">안 들어가요</span>', at: C4 },
      ],
    });
    // A. 시간축: 왼쪽 '임신 중' 구역, 가운데 출생, 오른쪽 '출생 후'
    const BX = 150, BY = 300, BW = 1620, BH = 520, M = 980, Z0 = 360, Z1 = 1690;
    const A = mount(root, `
      <div class="card" data-r="box" style="left:${BX}px;top:${BY}px;width:${BW}px;height:${BH}px"></div>
      <div class="abs" data-r="zone" style="left:${Z0}px;top:${BY + 30}px;width:${M - Z0}px;height:${BH - 60}px;border-radius:26px;background:rgba(139,124,246,0.10)"></div>
      <div class="abs row" data-r="zL" style="left:${Z0 + 24}px;top:${BY + 44}px;gap:10px;font-size:30px;font-weight:820;color:var(--lav-2)">${icon('heart', { size: 32 })}임신 중</div>
      <div class="abs row" data-r="zR" style="left:${M + 30}px;top:${BY + 44}px;gap:10px;font-size:30px;font-weight:820;color:var(--mint-2)">${icon('baby', { size: 32 })}출생 후</div>
      <div class="abs" data-r="mk" style="left:${M - 3}px;top:${BY + 30}px;width:6px;height:${BH - 60}px;border-radius:3px;background:#1F2A37"></div>
      <div class="abs chip white" data-r="mkL" style="left:${M - 60}px;top:${BY + BH - 44}px;height:52px;font-size:26px;padding:0 20px">출생</div>
      <div class="abs" data-r="r1L" style="left:190px;top:${BY + 150}px;font-size:34px;font-weight:840;color:var(--ink-2)">원래</div>
      <div class="abs" data-r="r2L" style="left:190px;top:${BY + 330}px;font-size:34px;font-weight:840;color:var(--ink-2)">이제</div>
      ${seg('p1', M, BY + 130, 520, 84, MINT_BG, '0 22px 22px 0', 'left')}
      <div class="abs row" data-r="p1t" style="left:${M + 30}px;top:${BY + 150}px;gap:10px;font-size:32px;font-weight:840;color:#fff">${icon('user-check', { size: 34 })}아빠 육아휴직</div>
      <div class="abs row center" data-r="lk" style="left:${Z0 + 150}px;top:${BY + 128}px;width:300px;height:88px;gap:12px;border-radius:22px;border:4px dashed rgba(31,42,55,0.2);color:var(--ink-3);font-size:30px;font-weight:800">${icon('lock', { size: 34 })}사용 불가</div>
      <div class="abs chip coral" data-r="risk" style="left:${Z0 + 40}px;top:${BY + 236}px;height:58px;font-size:28px;padding:0 22px;background:var(--coral);color:#fff">${icon('triangle-alert', { size: 30 })}유산·조산 위험</div>
      ${seg('p2', M - 380, BY + 310, 380, 84, GOLD_BG, '22px 0 0 22px', 'right')}
      ${seg('p2b', M, BY + 310, 520, 84, MINT_BG, '0 22px 22px 0', 'left')}
      <div class="abs row" data-r="p2t" style="left:${M - 350}px;top:${BY + 330}px;gap:10px;font-size:32px;font-weight:840;color:#7A4A00">${icon('sparkles', { size: 32 })}출산 전에도</div>
      <div class="abs" data-r="doc" style="left:${M - 500}px;top:${BY + 300}px">${badge('file-text', 'blue', 104)}</div>
      <div class="abs chip blue" data-r="docL" style="left:${M - 560}px;top:${BY + 418}px;height:52px;font-size:26px;padding:0 20px">${icon('stethoscope', { size: 28 })}진단받은 날부터</div>`);
    // B. 전체 기간에서는 차감, 나눠 쓰는 횟수(최대 4번)에는 안 들어감 — 2화와 같은 모양
    const MX = 330, MS = 92, MG = 12;
    const B = mount(root, `
      <div class="card" data-r="bar" style="left:150px;top:310px;width:1620px;height:250px">
        <div class="abs" style="left:44px;top:32px;font-size:34px;font-weight:820">전체 육아휴직 기간 <span style="color:var(--ink-3);font-weight:700">(1칸 = 1개월)</span></div>
      </div>
      <div class="abs chip coral" data-r="minus" style="left:${MX + 10 * (MS + MG) - 60}px;top:318px;height:56px;font-size:29px;padding:0 22px;background:var(--coral);color:#fff">${icon('scissors', { size: 30 })}쓴 만큼 차감</div>
      <div class="card" data-r="cnt" style="left:150px;top:590px;width:1620px;height:230px">
        <div class="abs" style="left:44px;top:32px;font-size:34px;font-weight:820">나눠 쓰는 횟수 <span style="color:var(--ink-3);font-weight:700">(최대 4번)</span></div>
        <div class="abs row" style="left:44px;top:100px;gap:20px">
          ${[1, 2, 3, 4].map((n) => `<div class="center" style="width:96px;height:96px;border-radius:48px;border:4px dashed rgba(31,42,55,0.2);font-size:36px;font-weight:840;color:var(--ink-3)">${n}</div>`).join('')}
        </div>
        <div class="abs row" data-r="keep" style="left:560px;top:98px;gap:18px;height:100px;padding:0 34px;border-radius:50px;background:var(--mint-soft);color:var(--mint-2);font-size:36px;font-weight:840">
          <span style="width:52px;height:52px;display:inline-block">${OK_BADGE}</span>임신 중 육아휴직은 횟수에 안 들어가요
        </div>
      </div>`);
    const months = dayTiles(root, { x: MX, y: 420, n: 12, size: MS, gap: MG, cls: 'mint', ref: 'mo', radius: 18 });
    const cut = mount(root, `<div class="tile gold" data-r="cut" style="left:${MX + 10 * (MS + MG)}px;top:420px;width:${2 * MS + MG}px;height:${MS}px;border-radius:18px"></div>`).cut;
    c.sfx(c.in + 0.2, 'pop', 0.45);
    c.sfx(C1b + 0.2, 'whoosh', 0.3); c.sfx(C1b + 0.9, 'click', 0.5);
    c.sfx(C2 + 0.3, 'pop', 0.5);
    c.sfx(C2b + 0.1, 'whoosh', 0.35); c.sfx(C2b + 0.7, 'sparkle', 0.5);
    c.sfx(C3 + 0.2, 'pop', 0.5); c.sfx(C3b + 0.1, 'ding', 0.45);
    for (let i = 0; i < 6; i++) c.sfx(C4 + 0.2 + i * 0.05, 'tick', 0.2);
    c.sfx(C4 + 1.0, 'whoosh', 0.35);
    c.sfx(C4b + 0.3, 'sparkle', 0.5);
    return (t) => {
      hd(t);
      enter(A.box, t, c.in + 0.1, { dy: 40, out: outA });
      enter(A.zone, t, c.in + 0.3, { dy: 0, s0: 0.98, out: outA });
      enter(A.zL, t, c.in + 0.4, { dx: -16, dy: 0, out: outA });
      enter(A.zR, t, c.in + 0.5, { dx: 16, dy: 0, out: outA });
      enter(A.mk, t, c.in + 0.35, { dy: 20, s0: 1, out: outA });
      pop(A.mkL, t, c.in + 0.5, { out: outA });
      enter(A.r1L, t, C1b, { dx: -16, dy: 0, out: outA });
      grow(A.p1, t, C1b + 0.2, 0.7, outA);
      enter(A.p1t, t, C1b + 0.6, { dx: -16, dy: 0, out: outA });
      pop(A.lk, t, C1b + 0.9, { out: outA });
      pop(A.risk, t, C2 + 0.3, { r: wave(t, 2.2, 1), out: outA });
      enter(A.r2L, t, C2b - 0.1, { dx: -16, dy: 0, out: outA });
      grow(A.p2, t, C2b + 0.1, 0.7, outA);
      grow(A.p2b, t, C2b + 0.1, 0.7, outA);
      enter(A.p2t, t, C2b + 0.6, { dx: 16, dy: 0, out: outA });
      pop(A.doc, t, C3 + 0.2, { out: outA });
      pop(A.docL, t, C3b + 0.1, { out: outA });
      A.lk.style.filter = t >= C2b + 0.1 ? 'opacity(0.45)' : 'none';
      enter(B.bar, t, C4 + 0.05, { dy: 40 });
      months.forEach((el, i) => drop(el, t, C4 + 0.2 + i * 0.04, { h: 50 }));
      // 마지막 두 칸(쓴 기간)이 떨어져 나감
      const cp = P(t, C4 + 1.1, 0.7, ease.inCubic);
      drop(cut, t, C4 + 0.2 + 10 * 0.04, { h: 50, y: 160 * cp, o: 1 - cp });
      [10, 11].forEach((k) => { months[k].style.visibility = t >= C4 + 0.95 ? 'hidden' : months[k].style.visibility; });
      pop(B.minus, t, C4 + 1.0, {});
      enter(B.cnt, t, C4b - 0.1, { dy: 40 });
      pop(B.keep, t, C4b + 0.3, {});
    };
  },
};

// ------------------------------------------------------------------ 5. ③ 배우자 유산·사산휴가(신설): 5일, 처음 3일 유급, 20일 안에 신청
const loss = {
  id: 'loss',
  build(root, c) {
    const D1b = c.at('d1', 1), D2 = c.at('d2'), D2b = c.at('d2', 1), D2c = c.at('d2', 2), D3 = c.at('d3'), D3b = c.at('d3', 1);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '배우자 <span class="hl-lav">유산·사산휴가</span> 신설', at: c.in + 0.1 },
        { html: '힘든 시기, <span class="hl-lav">아내 곁</span>을 지키도록', at: D1b },
        { html: '남편에게도 최대 <span class="hl-lav">5일</span>', at: D2b },
        { html: '처음 <span class="hl-gold">3일은 유급</span>', at: D2c },
        { html: '그날부터 <span class="hl-coral">20일 안에</span> 신청', at: D3 },
      ],
    });
    const LX = 150, LW = 560, RX = 750, RW = 1020, Y = 300, HH = 380;
    const TS = 150, TG = 22, TX = RX + (RW - (5 * (TS + TG) - TG)) / 2, TY = Y + 150;
    const r = mount(root, `
      <div class="card" data-r="L" style="left:${LX}px;top:${Y}px;width:${LW}px;height:${HH}px;background:linear-gradient(180deg,#fff,#F5F3FF)">
        <div class="abs" style="left:40px;top:70px">${mom({ w: 210, shirt: '#B7A9FF' })}</div>
        <div class="abs" style="left:280px;top:62px">${dad({ w: 220 })}</div>
        <div class="abs" data-r="hh" style="left:${(LW - 96) / 2}px;top:22px">${badge('hand-heart', 'lav', 96)}</div>
      </div>
      <div class="card" data-r="R" style="left:${RX}px;top:${Y}px;width:${RW}px;height:${HH}px">
        <div class="abs row" style="left:40px;top:34px;gap:14px;font-size:34px;font-weight:820">${icon('calendar-days', { size: 38 })}휴가 <span class="hl-lav">5일</span></div>
        <div class="abs chip" data-r="new" style="left:${RW - 170}px;top:30px;height:54px;font-size:27px;padding:0 22px;background:var(--lav);color:#fff">${icon('sparkles', { size: 28 })}신설</div>
        <div class="abs row" data-r="paidL" style="left:${TX - RX}px;top:${TY - Y + TS + 18}px;width:${3 * (TS + TG) - TG}px;justify-content:center;gap:10px;font-size:32px;font-weight:840;color:var(--gold-2)">${icon('coins', { size: 36 })}유급 3일</div>
        <div class="abs row" data-r="freeL" style="left:${TX - RX + 3 * (TS + TG)}px;top:${TY - Y + TS + 18}px;width:${2 * (TS + TG) - TG}px;justify-content:center;font-size:30px;font-weight:760;color:var(--ink-3)">무급 2일</div>
      </div>
      <div class="abs row" style="left:0;top:716px;width:1920px;justify-content:center;gap:24px">
        <div class="chip" data-r="k1" style="height:74px;font-size:33px;padding:0 30px;background:var(--ink);color:#fff;box-shadow:var(--shadow)">${icon('calendar-clock', { size: 36 })}유산·사산한 날부터 20일 안에 신청</div>
      </div>
      <div class="abs row" style="left:0;top:812px;width:1920px;justify-content:center">
        <div class="chip blue" data-r="k2" style="height:66px;font-size:30px;padding:0 28px">${icon('building-2', { size: 32 })}우선지원대상기업: 3일치 급여를 정부가 지원 (통상임금 100%)</div>
      </div>`);
    const tiles = dayTiles(root, { x: TX, y: TY, n: 5, size: TS, gap: TG, cls: 'empty', ref: 't', radius: 30 });
    c.sfx(c.in + 0.2, 'pop', 0.35);
    c.sfx(D1b + 0.2, 'sparkle', 0.3);
    for (let i = 0; i < 5; i++) c.sfx(D2b + 0.15 + i * 0.12, 'tick', 0.2);
    c.sfx(D2c + 0.2, 'coin', 0.4);
    c.sfx(D3 + 0.2, 'pop', 0.4);
    c.sfx(D3b + 0.2, 'pop', 0.4);
    return (t) => {
      hd(t);
      enter(r.L, t, c.in + 0.1, { dy: 40 });
      pop(r.hh, t, D1b + 0.1, { y: wave(t, 3, 3) });
      enter(r.R, t, D2 - 0.1, { dy: 40 });
      pop(r.new, t, D2 + 0.3, {});
      // 5칸 모두 휴가(보라) → 처음 3칸은 유급(금색), 나머지 2칸은 무급(회색)
      tiles.forEach((el, i) => {
        drop(el, t, D2b + 0.15 + i * 0.12, { h: 70 });
        const turn = i < 3 ? t >= D2c + 0.2 + i * 0.1 : t >= D2c + 0.6;
        setCls(el, turn ? (i < 3 ? 'gold' : 'gray') : '');
        el.style.background = turn ? '' : LAV_BG;
        el.style.boxShadow = turn ? '' : LAV_SHADOW;
      });
      enter(r.paidL, t, D2c + 0.4, { dy: 14 });
      enter(r.freeL, t, D2c + 0.7, { dy: 14 });
      pop(r.k1, t, D3 + 0.15, {});
      pop(r.k2, t, D3b + 0.15, {});
    };
  },
};

// ------------------------------------------------------------------ 공용: 헷갈리는 포인트용 시간축 카드
function qaAxis(root, { y = 520, h = 330, m = 900, ref = 'q' }) {
  return mount(root, `
    <div class="card" data-r="${ref}Box" style="left:150px;top:${y}px;width:1620px;height:${h}px"></div>
    <div class="abs" data-r="${ref}Ax" style="left:230px;top:${y + h / 2 + 20}px;width:1460px;height:6px;border-radius:3px;background:rgba(31,42,55,0.14);transform-origin:0 50%"></div>
    <div class="abs" data-r="${ref}Mk" style="left:${m - 2}px;top:${y + 40}px;width:4px;height:${h - 80}px;background:repeating-linear-gradient(180deg,#8A94A3 0 12px,transparent 12px 22px)"></div>
    <div class="abs chip white" data-r="${ref}MkL" style="left:${m - 90}px;top:${y + 16}px;height:50px;font-size:25px;padding:0 20px">${icon('calendar', { size: 26, color: '#8A94A3' })}출산예정일</div>`);
}

// ------------------------------------------------------------------ 6. 헷갈리는 포인트 1: 예정일보다 늦게 태어나면?
const qa1 = {
  id: 'qa1',
  build(root, c) {
    const Qa = c.at('a1q', 1), Qb = c.at('a1q', 2), A = c.at('a1a'), A2 = c.at('a1a', 1), A3 = c.at('a1a', 2);
    const head = qaHead(root, { n: 1, sys: 'leave', q: '예정일보다 늦게 태어나면?', tChip: c.in, tQ: Qa });
    const M = 900, Y = 500, H = 340, AY = Y + H / 2 + 20;
    const ax = qaAxis(root, { y: Y, h: H, m: M });
    const S = 62, G = 10, X0 = M - 5 * (S + G) - 20;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:80px;color:var(--mint-2)">걱정 마세요, 그대로 인정!</div>
      <div class="abs chip gold" data-r="used" style="left:${X0}px;top:${AY - S - 70}px;height:50px;font-size:25px;padding:0 20px;background:var(--gold);color:#fff">미리 쓴 휴가</div>
      <div class="abs" data-r="born" style="left:${M + 300 - 54}px;top:${AY - 150}px">${badge('baby', 'coral', 108)}</div>
      <div class="abs chip coral" data-r="bornL" style="left:${M + 300 - 100}px;top:${AY + 40}px;height:52px;font-size:26px;padding:0 20px;background:var(--coral);color:#fff">실제 출생</div>
      <div class="abs" data-r="arr" style="left:${M + 30}px;top:${AY - 36}px;color:#E4553E">${icon('arrow-right', { size: 64, stroke: 3 })}</div>
      <div class="abs" data-r="ok" style="left:${X0 + 176}px;top:${AY - S - 82}px;width:70px;height:70px">${OK_BADGE}</div>
      <div class="abs chip mint" data-r="okL" style="left:${X0 - 10}px;top:${AY + 40}px;height:54px;font-size:27px;padding:0 22px">${icon('badge-check', { size: 30 })}법정 휴가로 인정</div>`);
    const used = dayTiles(root, { x: X0, y: AY - S - 4, n: 5, size: S, gap: G, cls: 'gold', ref: 'u', radius: 14 });
    c.sfx(c.in + 0.1, 'pop', 0.45);
    for (let i = 0; i < 5; i++) c.sfx(Qa + 0.4 + i * 0.07, 'tick', 0.22);
    c.sfx(Qb + 0.2, 'whoosh', 0.3);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A2 + 0.3, 'pop', 0.5);
    c.sfx(A3 + 0.3, 'ding', 0.55);
    return (t) => {
      head(t);
      enter(ax.qBox, t, c.in + 0.2, { dy: 40 });
      tf(ax.qAx, { sx: Math.max(0.001, P(t, c.in + 0.3, 0.6, ease.outCubic)), o: clamp((t - c.in - 0.3) / 0.12) });
      enter(ax.qMk, t, c.in + 0.5, { dy: 10, s0: 1 });
      pop(ax.qMkL, t, c.in + 0.6, {});
      used.forEach((el, i) => drop(el, t, Qa + 0.4 + i * 0.07, { h: 60 }));
      pop(r.used, t, Qa + 0.9, {});
      enter(r.arr, t, Qb + 0.2, { dx: -30, dy: 0 });
      pop(r.born, t, Qb + 0.5, {});
      pop(r.bornL, t, Qb + 0.7, {});
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      pop(r.ok, t, A2 + 0.3, {});
      pop(r.okL, t, A3 + 0.3, {});
    };
  },
};

// ------------------------------------------------------------------ 7. 헷갈리는 포인트 2: 일찍 태어나면 남은 휴가는 언제까지?
const qa2 = {
  id: 'qa2',
  build(root, c) {
    const Qa = c.at('a2q', 1), Qb = c.at('a2q', 2), A = c.at('a2a'), A2 = c.at('a2a', 1);
    const head = qaHead(root, { n: 2, sys: 'leave', q: '일찍 태어나면, 남은 휴가는 언제까지?', tChip: c.in, tQ: Qa, qSize: 48 });
    const M = 1000, E = 700, K = 5.6, Y = 500, H = 340, AY = Y + H / 2 + 20;
    const ax = qaAxis(root, { y: Y, h: H, m: M });
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:80px;color:var(--mint-2)">실제 출생일부터 <span style="color:var(--gold-2)">120일</span></div>
      <div class="abs" data-r="born" style="left:${E - 54}px;top:${AY - 150}px">${badge('baby', 'coral', 108)}</div>
      <div class="abs chip coral" data-r="bornL" style="left:${E - 100}px;top:${AY + 40}px;height:52px;font-size:26px;padding:0 20px;background:var(--coral);color:#fff">실제 출생</div>
      <div class="abs row" data-r="wrong" style="left:${M}px;top:${AY - 104}px;width:${120 * K}px;height:40px;border-radius:20px;border:4px dashed rgba(31,42,55,0.22);justify-content:center;font-size:23px;font-weight:760;color:var(--ink-3)">예정일부터 120일?</div>
      <div class="abs" data-r="no" style="left:${M + 120 * K + 14}px;top:${AY - 112}px;width:58px;height:58px">${NO_BADGE}</div>
      ${seg('right', E, AY - 22, 120 * K, 44, MINT_BG, '22px', 'left')}
      <div class="abs chip mint" data-r="rightL" style="left:${E + 120 * K / 2 - 110}px;top:${AY + 40}px;height:52px;font-size:26px;padding:0 20px">${icon('calendar-check', { size: 28 })}출생일부터 120일</div>
      <div class="abs" data-r="ok" style="left:${E + 120 * K + 14}px;top:${AY - 31}px;width:62px;height:62px">${OK_BADGE}</div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(Qa + 0.4, 'pop', 0.5);
    c.sfx(Qb + 0.2, 'whoosh', 0.3);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A + 0.5, 'pop', 0.4);
    c.sfx(A2 + 0.2, 'whoosh', 0.35); c.sfx(A2 + 0.9, 'ding', 0.55);
    return (t) => {
      head(t);
      enter(ax.qBox, t, c.in + 0.2, { dy: 40 });
      tf(ax.qAx, { sx: Math.max(0.001, P(t, c.in + 0.3, 0.6, ease.outCubic)), o: clamp((t - c.in - 0.3) / 0.12) });
      enter(ax.qMk, t, c.in + 0.5, { dy: 10, s0: 1 });
      pop(ax.qMkL, t, c.in + 0.6, {});
      pop(r.born, t, Qa + 0.4, {});
      pop(r.bornL, t, Qa + 0.6, {});
      enter(r.wrong, t, Qb + 0.2, { dx: -20, dy: 0 });
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      pop(r.no, t, A + 0.5, {});
      grow(r.right, t, A2 + 0.2, 0.8);
      pop(r.rightL, t, A2 + 0.8, {});
      pop(r.ok, t, A2 + 0.9, {});
    };
  },
};

// ------------------------------------------------------------------ 8. 헷갈리는 포인트 3: 몇 번까지 나눠도 되나? — 최대 세 번 나눠 네 번
const qa3 = {
  id: 'qa3',
  build(root, c) {
    const Qa = c.at('a3q', 1), A = c.at('a3a'), A2 = c.at('a3a', 1), A3 = c.at('a3a', 2);
    const head = qaHead(root, { n: 3, sys: 'leave', q: '몇 번까지 나눠도 될까?', tChip: c.in, tQ: Qa });
    const S = 58, G = 8, GAP = 56, Y = 610;
    const GROUPS = [8, 5, 4, 3];
    const W0 = 20 * (S + G) - G + 3 * GAP, X0 = (1920 - W0) / 2;
    // 쪼개기 전(한 줄) / 쪼갠 뒤(네 덩어리) 위치
    const pos0 = [], pos1 = [];
    let gi = 0, k = 0;
    for (let i = 0; i < 20; i++) {
      pos0.push(X0 + 1.5 * GAP + i * (S + G));
      pos1.push(X0 + i * (S + G) + gi * GAP);
      k += 1; if (k === GROUPS[gi]) { gi += 1; k = 0; }
    }
    const starts = [0, 8, 13, 17];
    const gx = (g) => pos1[starts[g]], gw = (g) => GROUPS[g] * (S + G) - G;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:80px;color:var(--mint-2)">세 번 나눠서, 최대 <span style="color:var(--gold-2)">네 번</span></div>
      <div class="card" data-r="box" style="left:150px;top:490px;width:1620px;height:350px"></div>
      ${[0, 1, 2, 3].map((g) => `<div class="abs chip gold" data-r="gl${g}" style="left:${gx(g) + gw(g) / 2 - 62}px;top:${Y - 76}px;height:52px;font-size:26px;padding:0 18px;background:var(--gold);color:#fff">${g + 1}번째 · ${GROUPS[g]}일</div>`).join('')}
      ${[1, 2, 3].map((g) => `<div class="abs" data-r="sc${g}" style="left:${gx(g) - GAP / 2 - 22}px;top:${Y + 8}px;color:#E4553E">${icon('scissors', { size: 44, stroke: 2.4 })}</div>`).join('')}
      <div class="abs row" style="left:0;top:${Y + 104}px;width:1920px;justify-content:center">
        <div class="chip mint" data-r="all" style="height:62px;font-size:30px;padding:0 26px">${icon('circle-check', { size: 32 })}출산 전에 20일을 모두 써도 OK</div>
      </div>`);
    const tiles = dayTiles(root, { x: 0, y: Y, n: 20, size: S, gap: G, cls: 'gold', ref: 'd', radius: 14 });
    for (let i = 0; i < 8; i++) c.sfx(Qa + 0.3 + i * 0.08, 'tick', 0.2);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    [1, 2, 3].forEach((g) => c.sfx(A + 0.5 + g * 0.18, 'pop', 0.45));
    c.sfx(A2 + 0.2, 'ding', 0.5);
    c.sfx(A3 + 0.2, 'sparkle', 0.5);
    return (t) => {
      head(t);
      enter(r.box, t, c.in + 0.2, { dy: 40 });
      const sp = P(t, A + 0.5, 0.7, ease.inOutCubic);
      tiles.forEach((el, i) => drop(el, t, Qa + 0.3 + i * 0.04, { h: 60, x: lerp(pos0[i], pos1[i], sp) - i * (S + G) }));
      [1, 2, 3].forEach((g) => pop(r[`sc${g}`], t, A + 0.5 + g * 0.18, { r: -20 }));
      [0, 1, 2, 3].forEach((g) => pop(r[`gl${g}`], t, A2 + 0.1 + g * 0.15, {}));
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      pop(r.all, t, A3 + 0.15, {});
    };
  },
};

// ------------------------------------------------------------------ 9. 헷갈리는 포인트 4: 대기업이면 급여는?
const qa4 = {
  id: 'qa4',
  build(root, c) {
    const Qa = c.at('a4q', 1), A = c.at('a4a'), A2 = c.at('a4a', 1), A3 = c.at('a4a', 2);
    const head = qaHead(root, { n: 4, sys: 'pay', q: '대기업에 다니면 급여는?', tChip: c.in, tQ: Qa });
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:80px;color:var(--mint-2)">대기업도 <span style="color:var(--gold-2)">20일 모두 유급</span></div>
      <div class="card" data-r="sm" style="left:150px;top:490px;width:790px;height:340px">
        <div class="abs" style="left:40px;top:40px">${badge('store', 'blue', 110)}</div>
        <div class="abs" style="left:180px;top:48px;font-size:38px;font-weight:840">우선지원대상기업</div>
        <div class="abs" style="left:180px;top:100px;font-size:27px;font-weight:650;color:var(--ink-3)">중소기업 등</div>
        <div class="abs row" data-r="sm1" style="left:40px;top:182px;gap:12px;height:66px;padding:0 24px;border-radius:33px;background:var(--blue-soft);color:var(--blue-2);font-size:30px;font-weight:840">${icon('hand-coins', { size: 34 })}정부가 급여 지원 (최대 약 168만 원)</div>
        <div class="abs row" data-r="sm2" style="left:40px;top:262px;gap:10px;font-size:26px;font-weight:700;color:var(--ink-2)">${icon('info', { size: 28 })}통상임금과의 차액은 회사가 줍니다</div>
      </div>
      <div class="card" data-r="bg" style="left:980px;top:490px;width:790px;height:340px">
        <div class="abs" style="left:40px;top:40px">${badge('building-2', 'gold', 110)}</div>
        <div class="abs" style="left:180px;top:48px;font-size:38px;font-weight:840">대기업</div>
        <div class="abs" style="left:180px;top:100px;font-size:27px;font-weight:650;color:var(--ink-3)">정부 급여 지원은 없지만</div>
        <div class="abs row" data-r="bg1" style="left:40px;top:182px;gap:12px;height:66px;padding:0 24px;border-radius:33px;background:var(--mint);color:#fff;font-size:30px;font-weight:840;box-shadow:0 12px 26px rgba(20,153,127,0.25)"><span style="width:40px;height:40px;display:inline-block">${OK_BADGE}</span>회사가 20일 임금을 그대로</div>
        <div class="abs row" data-r="bg2" style="left:40px;top:262px;gap:10px;font-size:26px;font-weight:700;color:var(--ink-2)">${icon('info', { size: 28 })}20일 모두 유급이 법으로 정해져 있어요</div>
      </div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(Qa + 0.3, 'pop', 0.4);
    c.sfx(A + 0.1, 'click', 0.5);
    c.sfx(A + 0.4, 'pop', 0.45);
    c.sfx(A2 + 0.1, 'click', 0.7);
    c.sfx(A3 + 0.4, 'ding', 0.55);
    return (t) => {
      head(t);
      enter(r.sm, t, Qa + 0.3, { dx: -40, dy: 0 });
      enter(r.bg, t, Qa + 0.5, { dx: 40, dy: 0 });
      pop(r.sm1, t, A + 0.4, {});
      enter(r.sm2, t, A + 0.9, { dy: 10 });
      pop(r.ans, t, A2, { s0: 0.8, d: 0.5 });
      pop(r.bg1, t, A3 + 0.3, {});
      enter(r.bg2, t, A3 + 0.8, { dy: 10 });
      r.bg.style.boxShadow = t >= A2 ? '0 0 0 5px var(--mint), var(--shadow)' : 'var(--shadow)';
    };
  },
};

// ------------------------------------------------------------------ 10. 신청 방법: 회사에 신청 → 임신 중 육아휴직은 진단서·7일 전 → 고용24 급여
const steps = {
  id: 'steps',
  build(root, c) {
    const P1b = c.at('p1', 1), P2 = c.at('p2'), P2b = c.at('p2', 1), P2c = c.at('p2', 2), P3 = c.at('p3'), P3b = c.at('p3', 1);
    const hd = header(root, { y: 140, lines: [{ html: '신청은 <span class="hl-blue">이렇게</span>', at: c.in + 0.05 }] });
    const W = 480, H = 470, X = [150, 720, 1290], Y = 290;
    const items = [
      { color: 'blue', title: '회사에 신청', at: c.at('p1'), body: `<div class="abs" style="left:${(W - 120) / 2}px;top:128px">${badge('file-text', 'blue', 120)}</div><div class="abs" style="left:0;top:270px;width:${W}px;text-align:center;font-size:30px;font-weight:720;color:var(--ink-2);line-height:1.5">출산예정일과<br><b style="font-size:40px;color:var(--blue-2)">휴가 날짜</b>를 적어서</div>` },
      { color: 'gold', title: '임신 중 육아휴직', at: P2, body: `<div class="abs row" style="left:44px;top:132px;gap:16px">${badge('stethoscope', 'gold', 96)}<div style="font-size:32px;font-weight:800;color:var(--ink-2)">진단서와 함께</div></div><div class="abs col" style="left:44px;top:260px;gap:6px"><div data-r="d7" class="disp" style="font-size:66px;color:var(--gold-2);line-height:1.1">7일 전까지</div><div data-r="d30" style="font-size:27px;font-weight:700;color:var(--ink-3)">보통 육아휴직은 <s>30일 전</s></div></div>` },
      { color: 'mint', title: '급여 신청', at: P3, body: `<div class="abs" style="left:${(W - 120) / 2}px;top:128px">${badge('laptop', 'mint', 120)}</div><div class="abs" style="left:0;top:262px;width:${W}px;text-align:center;font-size:28px;font-weight:720;color:var(--ink-2);line-height:1.5">우선지원대상기업은<br>휴가를 사용한 뒤<br><b class="disp" style="font-size:52px;color:var(--mint-2)">고용24</b></div>` },
    ];
    const card = (k, i) => `
      <div class="abs" data-r="s${i}" style="left:${X[i]}px;top:${Y}px;width:${W}px;height:${H}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${W}px;height:${H}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:180px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${W}px;height:${H}px">
          <div class="abs center" style="left:30px;top:30px;width:56px;height:56px;border-radius:28px;background:var(--${k.color});color:#fff;font-size:30px;font-weight:880">${i + 1}</div>
          <div class="abs" style="left:104px;top:34px;font-size:40px;font-weight:840;letter-spacing:-0.035em;white-space:nowrap">${k.title}</div>
          ${k.body}
        </div>
      </div>`;
    const arrow = (i) => `<div class="abs center" data-r="a${i}" style="left:${X[i] + W + 2}px;top:${Y + H / 2 - 44}px;width:86px;height:88px;color:#AAB3C0">${icon('arrow-right', { size: 58, stroke: 3 })}</div>`;
    const r = mount(root, `${items.map(card).join('')}${arrow(0)}${arrow(1)}`);
    items.forEach((k) => { c.sfx(k.at, 'whoosh', 0.25); c.sfx(k.at + 0.25, 'pop', 0.5); });
    c.sfx(P1b + 0.2, 'tick', 0.5);
    c.sfx(P2b + 0.2, 'ding', 0.45);
    c.sfx(P3b + 0.3, 'tick', 0.5);
    return (t) => {
      hd(t);
      items.forEach((k, i) => {
        enter(r[`s${i}`], t, c.in + 0.2 + i * 0.12, { dy: 50 });
        flip(r[`f${i}`], r[`b${i}`], t, k.at, 0.5);
        const until = i < 2 ? items[i + 1].at : c.end - 0.6;
        focusCard(r[`s${i}`], r[`b${i}`], t, t >= k.at && t < until, k.at, k.color);
      });
      enter(r.a0, t, P2 - 0.3, { dx: -16, dy: 0 });
      enter(r.a1, t, P3 - 0.3, { dx: -16, dy: 0 });
      tf(r.d7, { s: 1 + 0.06 * Math.sin(Math.PI * P(t, P2b + 0.1, 0.5)) });
      opacity(r.d30, P(t, P2c, 0.4));
    };
  },
};

// ------------------------------------------------------------------ 11. 3줄 요약 ("3줄로 요약하면 이렇습니다")
const summary = {
  id: 'summary',
  build(root, c) {
    const items = [
      { color: 'mint', ic: 'calendar-range', title: '출산예정일 <span class="hl-mint">50일 전</span> ~ 출산 후 120일', sub: '배우자 출산전후휴가 20일, 모두 유급 · 세 번 나눠 최대 네 번', at: c.at('u1') },
      { color: 'gold', ic: 'baby', title: '<span class="hl-gold">유산·조산 위험</span>이면 출산 전 육아휴직', sub: '진단받은 날부터 · 휴직 7일 전까지 신청 · 나눠 쓰는 횟수엔 안 들어감', at: c.at('u2') },
      { color: 'lav', ic: 'hand-heart', title: '배우자 <span class="hl-lav">유산·사산휴가 5일</span>', sub: '처음 3일 유급 · 유산·사산한 날부터 20일 안에 신청', at: c.at('u3') },
    ];
    const hd = header(root, { y: 130, lines: [{ html: '<span class="hl-blue">3줄</span> 요약', at: c.in }] });
    const Y = [290, 490, 690];
    const col2 = (k) => `${k.color}-2`;
    const r = mount(root, items.map((k, i) => `
      <div class="card" data-r="it${i}" style="left:200px;top:${Y[i]}px;width:1520px;height:172px">
        <div class="abs center" style="left:34px;top:40px;width:92px;height:92px;border-radius:28px;background:var(--${k.color}-soft);color:var(--${col2(k)})">${icon(k.ic, { size: 50 })}</div>
        <div class="abs disp" style="left:156px;top:30px;font-size:52px;white-space:nowrap">${k.title}</div>
        <div class="abs" style="left:156px;top:106px;font-size:26px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
        <svg class="abs" style="left:1400px;top:46px" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="var(--${k.color}-soft)"/>
          <path data-r="ck${i}" d="M22 42 L35 55 L60 27" fill="none" stroke="var(--${col2(k)})" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`).join(''));
    items.forEach((k, i) => { prepDraw(r[`ck${i}`]); c.sfx(k.at + 0.1, 'pop', 0.45); c.sfx(k.at + 1.6, 'tick', 0.55); });
    c.sfx(c.in + 0.1, 'whoosh', 0.3);
    return (t) => {
      hd(t);
      items.forEach((k, i) => {
        enter(r[`it${i}`], t, k.at - 0.1, { dx: 60, dy: 0, e: ease.outCubic, d: 0.6 });
        draw(r[`ck${i}`], t, k.at + 1.4, 0.45);
      });
    };
  },
};

// ------------------------------------------------------------------ 12. 아웃트로: 상담 안내 + 다음 영상(임신기·육아기 근로시간 단축) 예고
const outro = {
  id: 'outro',
  noExit: true,
  build(root, c) {
    const O1 = c.at('o1'), O2 = c.at('o2'), O2b = c.at('o2', 1), O2c = c.at('o2', 2);
    const END = c.end;
    const r = mount(root, `
      <div class="abs disp" data-r="h1" style="left:0;top:150px;width:1920px;text-align:center;font-size:80px">헷갈릴 땐 <span class="hl-blue">여기서 확인!</span></div>
      <div class="card col center" data-r="cA" style="left:330px;top:330px;width:600px;height:400px">
        <div class="icon-badge" style="width:120px;height:120px;border-radius:36px;background:var(--blue-soft);color:var(--blue-2)">${icon('phone', { size: 64 })}</div>
        <div style="margin-top:26px;font-size:32px;font-weight:720;color:var(--ink-2)">고용노동부 고객상담센터</div>
        <div class="disp num" style="margin-top:6px;font-size:110px;color:var(--blue-2)">1350</div>
      </div>
      <div class="card col center" data-r="cB" style="left:990px;top:330px;width:600px;height:400px">
        <div class="icon-badge" style="width:120px;height:120px;border-radius:36px;background:var(--mint-soft);color:var(--mint-2)">${icon('laptop', { size: 64 })}</div>
        <div style="margin-top:26px;font-size:32px;font-weight:720;color:var(--ink-2)">급여 신청</div>
        <div class="disp" style="margin-top:6px;font-size:100px;color:var(--mint-2)">고용24</div>
        <div style="font-size:26px;font-weight:650;color:var(--ink-3)">www.work24.go.kr</div>
      </div>
      <div class="abs chip gold" data-r="nx" style="left:150px;top:210px;height:62px;font-size:32px;padding:0 26px;background:var(--gold);color:#fff">${icon('bell', { size: 32 })}다음 영상</div>
      <div class="abs disp" data-r="nt" style="left:150px;top:300px;font-size:112px">근로시간 단축 <span class="hl-gold">두 가지</span></div>
      <div class="abs" data-r="ns" style="left:154px;top:450px;font-size:36px;font-weight:700;color:var(--ink-2)">임신기·육아기 — 건강한 임신과 출산, 육아를 돕는 제도</div>
      <div class="abs" data-r="w1" style="left:1500px;top:250px">${badge('clock', 'blue', 150)}</div>
      <div class="abs" data-r="w2" style="left:1300px;top:280px">${badge('heart', 'coral', 130)}</div>
      <div class="abs" data-r="fam" style="left:150px;top:560px">${family(420)}</div>
      <div class="abs row" data-r="btns" style="left:700px;top:660px;gap:28px">
        <div class="row" data-r="sub" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#F0525A;color:#fff;font-size:40px;font-weight:840;box-shadow:0 16px 36px rgba(240,82,90,0.3)">${icon('bell', { size: 42, stroke: 2.4 })}<span data-r="subTxt">구독</span></div>
        <div class="row" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#fff;color:var(--ink);font-size:40px;font-weight:840;box-shadow:var(--shadow)">${icon('thumbs-up', { size: 42, stroke: 2.4 })}좋아요</div>
      </div>
      <div class="abs col center" data-r="disc" style="left:0;top:862px;width:1920px;font-size:24px;font-weight:600;color:var(--ink-3);line-height:1.6">
        <div>본 영상은 2026년 9월 기준 정보입니다. 개인별 적용 여부는 고용노동부(☎1350)·고용24에서 확인하시기 바랍니다.</div>
        <div>참고: 남녀고용평등과 일·가정 양립 지원에 관한 법률 · 고용보험법 · 고용노동부 보도자료(배우자 지원 3종 세트, 2026. 9.)</div>
      </div>`);
    const out1 = O2 - 0.3;
    const tClick = O2c + 0.6;
    c.sfx(O1 + 0.2, 'pop', 0.5);
    c.sfx(O1 + 0.5, 'pop', 0.5);
    c.sfx(O2 + 0.2, 'ding', 0.5);
    c.sfx(O2 + 0.9, 'pop', 0.45);
    c.sfx(tClick, 'click', 0.8);
    c.sfx(tClick + 0.6, 'sparkle', 0.45);
    const setHtml = (el, h) => { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } };
    return (t) => {
      enter(r.h1, t, O1 - 0.2, { dy: 24, out: out1 });
      enter(r.cA, t, O1 + 0.1, { dy: 40, out: out1 });
      enter(r.cB, t, O1 + 0.4, { dy: 40, out: out1 });
      pop(r.nx, t, O2, {});
      enter(r.nt, t, O2 + 0.25, { dy: 30 });
      enter(r.ns, t, O2b, { dy: 16 });
      drop(r.w1, t, O2 + 0.8, { h: 170 });
      drop(r.w2, t, O2 + 1.0, { h: 170 });
      enter(r.fam, t, O2c - 0.2, { dy: 40, s0: 0.9, y: wave(t, 3, 5) });
      blink(r.fam, t, 4);
      enter(r.btns, t, O2c, { dy: 30 });
      const pressed = t >= tClick;
      setHtml(r.subTxt, pressed ? '구독중' : '구독');
      r.sub.style.background = pressed ? '#8A94A3' : '#F0525A';
      tf(r.sub, { s: pressed ? 1 - 0.08 * Math.sin(Math.PI * clamp((t - tClick) / 0.25)) : 1 });
      enter(r.disc, t, c.lend('o2') + 0.5, { dy: 10 });
      opacity(root, 1 - P(t, END - 0.7, 0.7, ease.inOutSine));
    };
  },
};

const cover = coverScene({ n: 3, title: '달라진 배우자 출산휴가' });

export const scenes = [cover, intro, before, days, pregnant, loss, qa1, qa2, qa3, qa4, steps, summary, outro];
