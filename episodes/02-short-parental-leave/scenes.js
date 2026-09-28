// 2화: 1주·2주 단기 육아휴직 — 장면 정의
// 흐름: 훅(방학·아플 때 1주·2주) → 오늘 알아볼 두 가지 → ① 쓸 수 있는 조건 → ② 쓰는 방법과 급여 → ③ 헷갈리는 포인트 → ④ 신청 방법 → 정리
// 1화와 같은 시각 언어: "타일 1칸 = 하루", 카드 뒤집기, 떨어지는 블록. 모든 타이밍은 문장/자막 시작 시각 기준입니다.
import { ease, P, clamp, lerp, wave, mount, tf, opacity, enter, pop, drop, rise, prepDraw, draw, icon } from '../../engine/web/engine.js';
import { coverScene } from '../../engine/web/cover.js';
import { avatar, family, blink, coins, baby } from '../../engine/web/art.js';

export const asOf = '2026년 9월 기준';

export const chapters = {
  1: { label: '1', sub: '쓸 수 있는 조건', cardChip: '첫 번째', title: '쓸 수 있는 조건', cardSub: '누가, 언제 쓸 수 있을까', short: '조건', color: 'mint', icon: 'user-check', card: ['#2DBFA4', '#138C78'] },
  2: { label: '2', sub: '쓰는 방법과 급여', cardChip: '두 번째', title: '쓰는 방법과 급여', cardSub: '1주·2주, 얼마를 받을까', short: '급여', color: 'gold', icon: 'coins', card: ['#F9A12B', '#E0700A'] },
  3: { label: '3', sub: '헷갈리는 포인트 4가지', cardChip: '꼭 짚고 갈 것', title: '헷갈리는 포인트', cardSub: '자주 묻는 질문 4가지', short: '포인트', color: 'coral', icon: 'circle-help', card: ['#FF8C74', '#E4553E'] },
  4: { label: '4', sub: '신청 방법', cardChip: '마지막 체크', title: '신청 방법', cardSub: '사유별 기한 → 회사 → 고용24', short: '신청', color: 'blue', icon: 'clipboard-check', card: ['#5B9BFA', '#2F6FE0'] },
  5: { label: '정리', sub: '3줄 요약', title: '정리', short: '정리', color: 'lav', icon: 'list-checks', card: null },
};

// 헷갈리는 포인트 태그 (쇼츠 화면도 이 표를 씁니다)
export const SYS = {
  cond: { label: '쓸 수 있는 조건', color: 'mint', icon: 'user-check' },
  use: { label: '쓰는 방법', color: 'gold', icon: 'calendar-range' },
};

// ------------------------------------------------------------------ 공용 조각 (1화와 같은 모양)

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

// 사유 4가지 (조건 장면·인트로·요약에서 같이 씀)
const REASONS = [
  { ic: 'building-2', name: '휴원·휴교', sub: '어린이집·유치원·학교', color: 'blue' },
  { ic: 'sun', name: '방학', sub: '기간 전체가 방학 안', color: 'gold' },
  { ic: 'hospital', name: '입원', sub: '질병·사고로 입원', color: 'coral' },
  { ic: 'shield-alert', name: '감염병 격리', sub: '격리·등원·등교 중지', color: 'lav' },
];

// ------------------------------------------------------------------ 1. 도입부: 훅(방학·아플 때 1주·2주) → 오늘 알아볼 두 가지
const intro = {
  id: 'intro',
  build(root, c) {
    const H0b = c.at('h0', 1), H1 = c.at('h1'), H1b = c.at('h1', 1), I1 = c.at('i1'), I2 = c.at('i2'), I3 = c.at('i3'), I4 = c.at('i4');
    const hd = header(root, {
      y: 140, size: 88,
      lines: [
        { html: '방학이나 <span class="hl-coral">아이가 아플 때</span>', at: 0.12 },
        { html: '육아휴직을 딱 <span class="hl-gold">1주</span>·<span class="hl-blue">2주</span>만', at: H0b },
        { html: '오늘 알아볼 <span class="hl-coral">두 가지</span>', at: I1 },
        { html: '헷갈리는 포인트와 <span class="hl-blue">신청 방법</span>까지', at: I4 },
      ],
    });
    // 훅: 방학·아플 때 칩 → 1주(7일)·2주(14일) 카드 → 시행일 도장
    const W = 770, H = 430, X = [170, 980], Y = 360;
    const hook = mount(root, `
      <div class="abs row" style="left:0;top:270px;width:1920px;justify-content:center;gap:22px">
        <div class="chip white" data-r="cS" style="height:66px;font-size:32px;padding:0 28px">${icon('sun', { size: 34, color: '#E0700A' })}방학</div>
        <div class="chip white" data-r="cH" style="height:66px;font-size:32px;padding:0 28px">${icon('thermometer', { size: 34, color: '#E4553E' })}아이가 아플 때</div>
      </div>
      <div class="card col" data-r="hA" style="left:${X[0]}px;top:${Y}px;width:${W}px;height:${H}px;align-items:center;padding-top:44px">
        <div class="row" style="gap:16px">${badge('calendar-days', 'gold')}<div style="font-size:40px;font-weight:800;color:var(--ink-2)">단기 육아휴직</div></div>
        <div class="disp" style="margin-top:26px;font-size:150px;line-height:1;color:var(--gold-2)">1주</div>
        <div style="margin-top:2px;font-size:30px;font-weight:700;color:var(--ink-3)">7일</div>
      </div>
      <div class="card col" data-r="hB" style="left:${X[1]}px;top:${Y}px;width:${W}px;height:${H}px;align-items:center;padding-top:44px">
        <div class="row" style="gap:16px">${badge('calendar-range', 'blue')}<div style="font-size:40px;font-weight:800;color:var(--ink-2)">단기 육아휴직</div></div>
        <div class="disp" style="margin-top:26px;font-size:150px;line-height:1;color:var(--blue-2)">2주</div>
        <div style="margin-top:2px;font-size:30px;font-weight:700;color:var(--ink-3)">14일</div>
      </div>
      <div class="abs col center" data-r="stamp" style="left:815px;top:${Y + 150}px;width:290px;height:130px;border-radius:24px;border:5px solid var(--coral);color:var(--coral-2);background:rgba(255,255,255,0.94);font-weight:880;box-shadow:var(--shadow-sm)">
        <div style="font-size:28px;letter-spacing:0.02em">2026. 8. 20.</div><div style="font-size:44px;letter-spacing:0.1em">시행</div>
      </div>`);
    const tA = dayTiles(root, { x: X[0] + (W - (7 * 52 - 8)) / 2, y: Y + 356, n: 7, size: 44, gap: 8, cls: 'gold', ref: 'ta' });
    const tB = dayTiles(root, { x: X[1] + (W - (14 * 44 - 6)) / 2, y: Y + 360, n: 14, size: 38, gap: 6, cls: 'blue', ref: 'tb', radius: 10 });
    // 오늘 알아볼 두 가지: 뒤집히는 카드
    const numDot = (n, color) => `<div class="center" style="width:64px;height:64px;border-radius:32px;background:var(--${color});color:#fff;font-size:36px;font-weight:880;flex:none">${n}</div>`;
    const PW = 770, PH = 440, PY = 330;
    const reasonMini = REASONS.map((k) => `<div class="col center" style="gap:10px;width:150px">${badge(k.ic, k.color, 84)}<div style="font-size:24px;font-weight:760;color:var(--ink-2);white-space:nowrap">${k.name}</div></div>`).join('');
    const back1 = `
      <div class="abs row" style="left:44px;top:40px;gap:18px">${numDot(1, 'mint')}<div style="font-size:40px;font-weight:820;letter-spacing:-0.035em;white-space:nowrap">누가 · 언제 쓸 수 있나</div></div>
      <div class="abs row" style="left:0;top:138px;width:${PW}px;justify-content:center;gap:16px;align-items:center">
        ${icon('baby', { size: 46, color: '#138C78' })}<span class="disp" style="font-size:52px;color:var(--mint-2)">만 8세 · 초2 이하</span>
      </div>
      <div class="abs row" style="left:0;top:230px;width:${PW}px;justify-content:center;gap:14px">${reasonMini}</div>
      <div class="abs" style="left:0;top:376px;width:${PW}px;text-align:center;font-size:30px;font-weight:680;color:var(--ink-2)">자녀 나이 + <b style="color:var(--mint-2)">사유 4가지</b> 중 하나</div>`;
    const back2 = `
      <div class="abs row" style="left:44px;top:40px;gap:18px">${numDot(2, 'gold')}<div style="font-size:40px;font-weight:820;letter-spacing:-0.035em;white-space:nowrap">어떻게 쓰고 · 얼마 받나</div></div>
      <div class="abs row" style="left:0;top:136px;width:${PW}px;justify-content:center;gap:22px;align-items:center">
        <div class="block gold" style="position:relative;width:170px;height:110px;border-radius:26px;display:flex;align-items:center;justify-content:center"><span class="disp" style="font-size:54px;color:#7A4A00">1주</span></div>
        <span class="disp" style="font-size:40px;color:var(--ink-3)">또는</span>
        <div class="block blue" style="position:relative;width:170px;height:110px;border-radius:26px;display:flex;align-items:center;justify-content:center"><span class="disp" style="font-size:54px;color:#fff">2주</span></div>
      </div>
      <div class="abs col" style="left:0;top:270px;width:${PW}px;align-items:center">
        <div style="font-size:30px;font-weight:720;color:var(--ink-2)">2주 급여 (첫 육아휴직 기준)</div>
        <div class="disp" style="font-size:66px;color:var(--gold-2);line-height:1.25">약 110만~120만 원</div>
      </div>`;
    const slot = (i, back) => `
      <div class="abs" data-r="s${i}" style="left:${X[i]}px;top:${PY}px;width:${PW}px;height:${PH}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${PW}px;height:${PH}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:210px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${PW}px;height:${PH}px">${back}</div>
      </div>`;
    const nchip = (ref, n, color, text) => `<div class="chip" data-r="${ref}" style="height:70px;font-size:34px;padding:0 32px 0 14px;background:var(--${color});color:#fff;box-shadow:0 14px 30px rgba(31,42,55,0.16)"><div class="center" style="width:48px;height:48px;border-radius:24px;background:#fff;color:var(--${color}-2);font-size:28px;font-weight:880">${n}</div>${text}</div>`;
    const r = mount(root, `${slot(0, back1)}${slot(1, back2)}
      <div class="abs row" style="left:0;top:806px;width:1920px;justify-content:center;gap:22px">
        ${nchip('c3', 3, 'coral', '헷갈리는 포인트 4가지')}${nchip('c4', 4, 'blue', '신청 방법')}
      </div>`);
    const tOpen = [I2, I3];
    const hookOut = I1 - 0.35;
    c.sfx(0.35, 'pop', 0.5); c.sfx(0.75, 'pop', 0.5);
    c.sfx(H0b + 0.15, 'whoosh', 0.3);
    for (let i = 0; i < 7; i++) c.sfx(H0b + 0.55 + i * 0.05, 'tick', 0.22);
    c.sfx(H1 + 0.2, 'click', 0.7);
    c.sfx(I1 + 0.2, 'pop', 0.4); c.sfx(I1 + 0.32, 'pop', 0.4);
    tOpen.forEach((o) => { c.sfx(o, 'whoosh', 0.25); c.sfx(o + 0.25, 'pop', 0.5); });
    c.sfx(I3 + 0.9, 'coin', 0.55);
    c.sfx(I4 + 0.45, 'click', 0.6); c.sfx(I4 + 0.75, 'click', 0.6);
    return (t) => {
      hd(t);
      pop(hook.cS, t, 0.3, { out: H0b - 0.1 });
      pop(hook.cH, t, 0.7, { out: H0b - 0.1 });
      enter(hook.hA, t, H0b + 0.1, { dx: -60, dy: 30, out: hookOut });
      enter(hook.hB, t, H0b + 0.3, { dx: 60, dy: 30, out: hookOut });
      tA.forEach((el, i) => drop(el, t, H0b + 0.55 + i * 0.05, { h: 60, out: hookOut }));
      tB.forEach((el, i) => drop(el, t, H0b + 0.75 + i * 0.035, { h: 60, out: hookOut }));
      pop(hook.stamp, t, H1 + 0.15, { r: -8, s0: 1.8, e: ease.outCubic, d: 0.35, out: hookOut });
      [0, 1].forEach((i) => {
        enter(r[`s${i}`], t, I1 + 0.15 + i * 0.12, { dy: 50 });
        flip(r[`f${i}`], r[`b${i}`], t, tOpen[i], 0.5);
        focusCard(r[`s${i}`], r[`b${i}`], t, t >= tOpen[i] && t < (i === 0 ? I3 : I4), tOpen[i], i === 0 ? 'mint' : 'gold');
      });
      pop(r.c3, t, I4 + 0.45, { r: wave(t, 2.4, 1.5) });
      pop(r.c4, t, I4 + 0.75, { r: wave(t, 2.6, -1.5) });
      void H1b;
    };
  },
};

// ------------------------------------------------------------------ 2. 어떤 제도: 원래 급여는 30일 이상 → 이제 1주·2주도 급여
const what = {
  id: 'what',
  build(root, c) {
    const W1b = c.at('w1', 1), W1c = c.at('w1', 2), W2 = c.at('w2'), W2b = c.at('w2', 1);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '<span class="hl-mint">단기 육아휴직</span>이란?', at: c.in + 0.15 },
        { html: '원래 급여는 <span class="hl-coral">30일 이상</span> 쉬어야', at: W1b },
        { html: '이제 <span class="hl-gold">1주</span>·<span class="hl-blue">2주</span>만 쉬어도 급여', at: W2 },
      ],
    });
    const box = mount(root, '<div class="card" data-r="box" style="left:150px;top:350px;width:1620px;height:450px"></div>').box;
    const TX = 400, S = 36, G = 6;
    const lb = mount(root, `
      <div class="abs" data-r="l1" style="left:196px;top:420px;font-size:36px;font-weight:820;color:var(--ink-2)">원래</div>
      <div class="abs" data-r="l2" style="left:196px;top:610px;font-size:36px;font-weight:820;color:var(--ink-2)">이제</div>
      <div class="abs chip coral" data-r="k1" style="left:${TX}px;top:486px;height:52px;font-size:27px;padding:0 20px">${icon('lock', { size: 28 })}30일 이상 쉬어야 급여</div>
      <div class="abs chip gold" data-r="k2" style="left:${TX}px;top:676px;height:52px;font-size:27px;padding:0 20px">1주(7일)</div>
      <div class="abs chip blue" data-r="k3" style="left:${TX + 14 * (S + G) + 18}px;top:604px;height:52px;font-size:27px;padding:0 20px">2주(14일)</div>
      <div class="abs row" data-r="pay" style="left:1240px;top:590px;gap:14px;height:84px;padding:0 30px;border-radius:42px;background:var(--mint);color:#fff;font-size:36px;font-weight:840;box-shadow:0 14px 30px rgba(20,153,127,0.28)">${icon('coins', { size: 40 })}급여 나옵니다</div>`);
    const row1 = dayTiles(root, { x: TX, y: 422, n: 30, size: S, gap: G, cls: 'gray', ref: 'r1', radius: 9 });
    const row2 = dayTiles(root, { x: TX, y: 612, n: 14, size: S, gap: G, cls: (i) => (i < 7 ? 'gold' : 'blue'), ref: 'r2', radius: 9 });
    for (let i = 0; i < 6; i++) c.sfx(W1c + 0.1 + i * 0.12, 'tick', 0.22);
    c.sfx(W1c + 1.0, 'pop', 0.5);
    for (let i = 0; i < 4; i++) c.sfx(W2 + 0.3 + i * 0.1, 'tick', 0.28);
    c.sfx(W2b + 0.2, 'coin', 0.7);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(lb.l1, t, c.in + 0.3, { dx: -16, dy: 0 });
      enter(lb.l2, t, c.in + 0.4, { dx: -16, dy: 0 });
      row1.forEach((el, i) => drop(el, t, W1c + 0.05 + i * 0.025, { h: 50 }));
      pop(lb.k1, t, W1c + 1.0, {});
      row2.forEach((el, i) => drop(el, t, W2 + 0.3 + i * 0.05, { h: 60 }));
      pop(lb.k2, t, W2 + 0.7, {});
      pop(lb.k3, t, W2 + 1.1, {});
      pop(lb.pay, t, W2b + 0.15, { r: wave(t, 2.2, 1.2) });
    };
  },
};

// ------------------------------------------------------------------ 3. 조건 두 가지: 자녀 나이 + 사유 4가지
const target = {
  id: 'target',
  build(root, c) {
    const C1b = c.at('c1', 1), C1c = c.at('c1', 2), C2 = c.at('c2'), R = [1, 2, 3, 4].map((k) => c.at('c2', k)), C3 = c.at('c3'), C3b = c.at('c3', 1);
    const hd = header(root, { y: 150, lines: [{ html: '조건은 <span class="hl-mint">두 가지</span>', at: c.in + 0.1 }] });
    const LW = 560, RX = 760, RW = 1010, Y = 300, HH = 500;
    const r = mount(root, `
      <div class="card" data-r="L" style="left:150px;top:${Y}px;width:${LW}px;height:${HH}px">
        <div class="abs center" style="left:28px;top:28px;width:60px;height:60px;border-radius:30px;background:var(--mint);color:#fff;font-size:32px;font-weight:880">1</div>
        <div class="abs" style="left:108px;top:36px;font-size:38px;font-weight:840">자녀 나이</div>
        <div class="abs" data-r="bb" style="left:${(LW - 170) / 2}px;top:108px">${baby({ w: 170 })}</div>
        <div class="abs disp" data-r="a1" style="left:0;top:300px;width:${LW}px;text-align:center;font-size:58px;color:var(--mint-2)">만 8세 이하</div>
        <div class="abs" data-r="or" style="left:0;top:376px;width:${LW}px;text-align:center;font-size:28px;font-weight:700;color:var(--ink-3)">또는</div>
        <div class="abs disp" data-r="a2" style="left:0;top:412px;width:${LW}px;text-align:center;font-size:52px;color:var(--mint-2)">초등 2학년 이하</div>
      </div>
      <div class="card" data-r="R" style="left:${RX}px;top:${Y}px;width:${RW}px;height:${HH}px">
        <div class="abs center" style="left:28px;top:28px;width:60px;height:60px;border-radius:30px;background:var(--coral);color:#fff;font-size:32px;font-weight:880">2</div>
        <div class="abs" style="left:108px;top:36px;font-size:38px;font-weight:840">사유 4가지 중 <span class="hl-coral">하나</span></div>
        ${REASONS.map((k, i) => `
          <div class="abs row" data-r="q${i}" style="left:${40 + (i % 2) * 470}px;top:${130 + Math.floor(i / 2) * 176}px;width:450px;height:156px;gap:22px;padding:0 24px;border-radius:28px;background:var(--${k.color}-soft)">
            ${badge(k.ic, k.color, 104).replace('background:var(--' + k.color + '-soft)', 'background:#fff')}
            <div class="col" style="gap:6px"><div style="font-size:40px;font-weight:850;letter-spacing:-0.03em;color:var(--${k.color}-2);white-space:nowrap">${k.name}</div><div style="font-size:24px;font-weight:650;color:var(--ink-2);white-space:nowrap">${k.sub}</div></div>
          </div>`).join('')}
      </div>
      <div class="abs row" style="left:0;top:830px;width:1920px;justify-content:center">
        <div class="chip" data-r="gap" style="height:70px;font-size:33px;padding:0 30px;background:var(--ink);color:#fff;box-shadow:var(--shadow)">${icon('heart-handshake', { size: 36 })}돌봄 공백이 생겼을 때 쓰는 휴직</div>
      </div>`);
    c.sfx(C1b + 0.1, 'pop', 0.5); c.sfx(C1c + 0.1, 'pop', 0.5);
    R.forEach((k) => c.sfx(k + 0.05, 'pop', 0.45));
    c.sfx(C3b + 0.1, 'ding', 0.5);
    return (t) => {
      hd(t);
      enter(r.L, t, c.in + 0.15, { dy: 50 });
      enter(r.R, t, c.in + 0.3, { dy: 50 });
      enter(r.bb, t, C1b - 0.1, { dy: 30, s0: 0.8, y: wave(t, 3, 4) });
      pop(r.a1, t, C1b + 0.1, {});
      enter(r.or, t, C1c - 0.1, { dy: 10 });
      pop(r.a2, t, C1c + 0.1, {});
      R.forEach((k, i) => pop(r[`q${i}`], t, k, { s0: 0.6 }));
      const onL = t >= C1b && t < C2, onR = t >= C2 && t < C3;
      r.L.style.boxShadow = onL ? '0 0 0 5px var(--mint), var(--shadow)' : 'var(--shadow)';
      r.R.style.boxShadow = onR ? '0 0 0 5px var(--coral), var(--shadow)' : 'var(--shadow)';
      pop(r.gap, t, C3b + 0.05, {});
    };
  },
};

// ------------------------------------------------------------------ 4. 쓰는 방법: 1주 또는 2주, 자녀별 연 1회 → 기간에선 차감, 횟수엔 불포함
const rules = {
  id: 'rules',
  build(root, c) {
    const R1b = c.at('r1', 1), R1c = c.at('r1', 2), R2 = c.at('r2'), R2b = c.at('r2', 1);
    const out1 = R2 - 0.3;
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '<span class="hl-gold">1주</span> 또는 <span class="hl-blue">2주</span>, 하나를 골라서', at: c.in + 0.1 },
        { html: '자녀 한 명당 <span class="hl-gold">1년에 한 번</span>', at: R1c },
        { html: '기간에선 <span class="hl-coral">빠지고</span>, 횟수엔 <span class="hl-mint">안 들어가요</span>', at: R2 },
      ],
    });
    const A = mount(root, `
      <div class="abs row" style="left:0;top:330px;width:1920px;justify-content:center;gap:60px;align-items:center">
        <div class="block gold" data-r="b1" style="position:relative;width:420px;height:250px;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="disp" style="font-size:120px;line-height:1;color:#7A4A00">1주</span><span style="font-size:32px;font-weight:800;color:#8A5A10">7일 연속</span></div>
        <span class="disp" data-r="or" style="font-size:60px;color:var(--ink-3)">또는</span>
        <div class="block blue" data-r="b2" style="position:relative;width:420px;height:250px;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="disp" style="font-size:120px;line-height:1;color:#fff">2주</span><span style="font-size:32px;font-weight:800;color:#E6EEFF">14일 연속</span></div>
      </div>
      <div class="abs row" style="left:0;top:640px;width:1920px;justify-content:center">
        <div class="card row" data-r="once" style="position:relative;gap:26px;height:150px;padding:0 50px">
          ${avatar('baby', 104)}
          <div class="col" style="gap:4px"><div style="font-size:30px;font-weight:700;color:var(--ink-3)">자녀 1명당</div><div class="disp" style="font-size:62px;color:var(--gold-2)">1년에 1번</div></div>
          ${badge('calendar-check', 'gold', 96)}
        </div>
      </div>`);
    // 전체 기간 12칸(1칸 = 1개월)에서 2주 차감 + 나눠 쓰기 횟수(최대 4번)는 그대로
    const MX = 330, MS = 92, MG = 12;
    const B = mount(root, `
      <div class="card" data-r="bar" style="left:150px;top:310px;width:1620px;height:250px">
        <div class="abs" style="left:44px;top:32px;font-size:34px;font-weight:820">전체 육아휴직 기간 <span style="color:var(--ink-3);font-weight:700">(1칸 = 1개월)</span></div>
      </div>
      <div class="abs chip coral" data-r="minus" style="left:${MX + 11 * (MS + MG) - 40}px;top:318px;height:56px;font-size:29px;padding:0 22px;background:var(--coral);color:#fff">${icon('scissors', { size: 30 })}2주만큼 차감</div>
      <div class="card" data-r="cnt" style="left:150px;top:590px;width:1620px;height:230px">
        <div class="abs" style="left:44px;top:32px;font-size:34px;font-weight:820">나눠 쓰는 횟수 <span style="color:var(--ink-3);font-weight:700">(최대 4번)</span></div>
        <div class="abs row" style="left:44px;top:100px;gap:20px">
          ${[1, 2, 3, 4].map((n) => `<div class="center" style="width:96px;height:96px;border-radius:48px;border:4px dashed rgba(31,42,55,0.2);font-size:36px;font-weight:840;color:var(--ink-3)">${n}</div>`).join('')}
        </div>
        <div class="abs row" data-r="keep" style="left:560px;top:98px;gap:18px;height:100px;padding:0 34px;border-radius:50px;background:var(--mint-soft);color:var(--mint-2);font-size:38px;font-weight:840">
          <span style="width:52px;height:52px;display:inline-block">${OK_BADGE}</span>단기 육아휴직은 횟수에 안 들어가요
        </div>
      </div>`);
    const months = dayTiles(root, { x: MX, y: 420, n: 12, size: MS, gap: MG, cls: 'mint', ref: 'mo', radius: 18 });
    const cut = mount(root, `<div class="tile gold" data-r="cut" style="left:${MX + 11 * (MS + MG) + MS / 2}px;top:420px;width:${MS / 2}px;height:${MS}px;border-radius:0 18px 18px 0"></div>`).cut;
    c.sfx(R1b + 0.1, 'pop', 0.5); c.sfx(R1b + 0.5, 'pop', 0.5);
    c.sfx(R1c + 0.2, 'ding', 0.5);
    for (let i = 0; i < 6; i++) c.sfx(R2 + 0.2 + i * 0.05, 'tick', 0.2);
    c.sfx(R2 + 1.0, 'whoosh', 0.35);
    c.sfx(R2b + 0.3, 'sparkle', 0.5);
    return (t) => {
      hd(t);
      pop(A.b1, t, R1b + 0.05, { out: out1 });
      enter(A.or, t, R1b + 0.3, { dy: 10, out: out1 });
      pop(A.b2, t, R1b + 0.45, { out: out1 });
      enter(A.once, t, R1c + 0.1, { dy: 30, out: out1 });
      enter(B.bar, t, R2 + 0.05, { dy: 40 });
      months.forEach((el, i) => drop(el, t, R2 + 0.2 + i * 0.04, { h: 50 }));
      // 마지막 칸 절반(2주)이 떨어져 나감
      const cp = P(t, R2 + 1.1, 0.7, ease.inCubic);
      drop(cut, t, R2 + 0.2 + 11 * 0.04, { h: 50, y: 160 * cp, o: 1 - cp });
      if (t >= R2 + 1.0) months[11].style.width = `${MS / 2}px`; else months[11].style.width = `${MS}px`;
      pop(B.minus, t, R2 + 1.0, {});
      enter(B.cnt, t, R2b - 0.1, { dy: 40 });
      pop(B.keep, t, R2b + 0.3, {});
    };
  },
};

// ------------------------------------------------------------------ 5. 급여: 쉰 날짜만큼 → 100%·상한 250만 원 → 2주 약 110만~120만 원 → 전액 바로
const pay = {
  id: 'pay',
  build(root, c) {
    const Y1b = c.at('y1', 1), Y2 = c.at('y2'), Y2b = c.at('y2', 1), Y3 = c.at('y3'), Y3b = c.at('y3', 1), Y4 = c.at('y4'), Y4b = c.at('y4', 1);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '급여는 <span class="hl-gold">쉰 날짜만큼</span>', at: c.in + 0.1 },
        { html: '처음 쓰면 <span class="hl-gold">통상임금 100%</span>', at: Y2 },
        { html: '2주면 약 <span class="hl-gold">110만~120만 원</span>', at: Y3b },
      ],
    });
    const LX = 150, LW = 760, RX = 950, RW = 820, Y = 300, HH = 480;
    const S = 54, G = 10, GX = LX + (LW - (10 * (S + G) - G)) / 2;
    const r = mount(root, `
      <div class="card" data-r="L" style="left:${LX}px;top:${Y}px;width:${LW}px;height:${HH}px">
        <div class="abs row" style="left:40px;top:34px;gap:14px;font-size:34px;font-weight:820">${icon('calendar-days', { size: 38 })}한 달 중 <span class="hl-gold">2주</span> 쉬면</div>
        <div class="abs" data-r="frm" style="left:0;top:392px;width:${LW}px;text-align:center;font-size:30px;font-weight:720;color:var(--ink-2)">한 달 급여 × <b style="color:var(--gold-2)">쉰 날</b> ÷ 그 달 날짜 수</div>
      </div>
      <div class="card" data-r="R" style="left:${RX}px;top:${Y}px;width:${RW}px;height:${HH}px">
        <div class="abs row" style="left:40px;top:34px;gap:14px;font-size:34px;font-weight:820">${icon('coins', { size: 38 })}첫 육아휴직 기준</div>
        <div class="abs row" data-r="g1" style="left:40px;top:110px;gap:14px"><div class="chip gold" style="height:62px;font-size:32px;padding:0 24px">통상임금 100%</div><div class="chip gold" style="height:62px;font-size:32px;padding:0 24px">월 상한 250만 원</div></div>
        <div class="abs" data-r="g2" style="left:40px;top:212px;font-size:28px;font-weight:700;color:var(--ink-3)">통상임금 월 250만 원 이상 · 2주 쉬면</div>
        <div class="abs row" data-r="g3" style="left:40px;top:258px;gap:12px;align-items:baseline;color:var(--gold-2)"><span class="disp" style="font-size:56px">약</span><span class="disp" style="font-size:104px;line-height:1.1">110만~120만</span><span class="disp" style="font-size:56px">원</span></div>
        <div class="abs" data-r="g4" style="left:40px;top:404px;font-size:23px;font-weight:620;color:var(--ink-3)">그 달의 날짜 수에 따라 금액이 조금씩 다릅니다</div>
      </div>
      <div class="abs row" style="left:0;top:812px;width:1920px;justify-content:center">
        <div class="chip" data-r="full" style="height:72px;font-size:34px;padding:0 32px;background:var(--mint);color:#fff;box-shadow:0 14px 30px rgba(20,153,127,0.28)">${icon('hand-coins', { size: 38 })}복직 뒤로 미루는 금액 없이 전액 바로</div>
      </div>
      <div class="abs" data-r="coinFly" style="left:0;top:0">${coins(3, 90)}</div>`);
    const days = dayTiles(root, { x: GX, y: Y + 118, n: 30, cols: 10, size: S, gap: G, cls: 'empty', ref: 'd', radius: 12 });
    c.sfx(Y1b + 0.1, 'whoosh', 0.3);
    for (let i = 0; i < 7; i++) c.sfx(Y1b + 0.3 + i * 0.08, 'tick', 0.25);
    c.sfx(Y2b + 0.1, 'pop', 0.5); c.sfx(Y2b + 0.35, 'pop', 0.5);
    c.sfx(Y3b + 0.25, 'coin', 0.75);
    c.sfx(Y4b + 0.1, 'sparkle', 0.5);
    return (t) => {
      hd(t);
      enter(r.L, t, c.in + 0.15, { dy: 50 });
      enter(r.R, t, c.in + 0.3, { dy: 50 });
      days.forEach((el, i) => {
        enter(el, t, c.in + 0.3 + i * 0.012, { dy: 14 });
        setCls(el, i < 14 && t >= Y1b + 0.3 + i * 0.04 ? 'gold' : 'empty');
      });
      enter(r.frm, t, Y1b + 1.0, { dy: 14 });
      enter(r.g1, t, Y2b + 0.05, { dx: 30, dy: 0 });
      enter(r.g2, t, Y3 + 0.1, { dy: 14 });
      pop(r.g3, t, Y3b + 0.2, { s0: 0.7 });
      enter(r.g4, t, Y3b + 1.0, { dy: 10 });
      pop(r.full, t, Y4b + 0.05, {});
      const fp = P(t, Y3b + 0.2, 0.9, ease.inOutCubic);
      tf(r.coinFly, { x: lerp(560, 1500, fp), y: lerp(560, 560, fp) - Math.sin(fp * Math.PI) * 180, o: fp > 0 && fp < 1 ? 1 : 0 });
      void Y4;
    };
  },
};

// ------------------------------------------------------------------ 6. 헷갈리는 포인트 1: 1주씩 두 번?
const qa1 = {
  id: 'qa1',
  build(root, c) {
    const Qa = c.at('a1q', 1), A = c.at('a1a'), A2 = c.at('a1a', 1), A3 = c.at('a1a', 2);
    const head = qaHead(root, { n: 1, sys: 'use', q: '1주씩 두 번 나눠 쓰기?', tChip: c.in, tQ: Qa });
    const S = 50, G = 8, X = 480;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--red)">아닙니다, 한 번에 이어서!</div>
      <div class="card" data-r="p1" style="left:150px;top:490px;width:1620px;height:160px">
        <div class="abs" style="left:40px;top:56px;font-size:34px;font-weight:800;color:var(--ink-2)">1주 + 1주</div>
        <div class="abs" data-r="x1" style="left:1500px;top:36px;width:88px;height:88px">${NO_BADGE}</div>
      </div>
      <div class="card" data-r="p2" style="left:150px;top:680px;width:1620px;height:160px">
        <div class="abs" style="left:40px;top:56px;font-size:34px;font-weight:800;color:var(--ink-2)">1주 또는 2주</div>
        <div class="abs" data-r="x2" style="left:1500px;top:36px;width:88px;height:88px">${OK_BADGE}</div>
      </div>`);
    const a = dayTiles(root, { x: X, y: 545, n: 7, size: S, gap: G, cls: 'gold', ref: 'a' });
    const b = dayTiles(root, { x: X + 7 * (S + G) + 80, y: 545, n: 7, size: S, gap: G, cls: 'gold', ref: 'b' });
    const d = dayTiles(root, { x: X, y: 735, n: 14, size: S, gap: G, cls: (i) => (i < 7 ? 'gold' : 'blue'), ref: 'd' });
    c.sfx(c.in + 0.1, 'pop', 0.45);
    for (let i = 0; i < 4; i++) c.sfx(Qa + 0.5 + i * 0.15, 'tick', 0.25);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A + 0.6, 'pop', 0.5);
    c.sfx(A2 + 0.3, 'whoosh', 0.3);
    c.sfx(A3 + 0.2, 'ding', 0.5);
    return (t) => {
      head(t);
      enter(r.p1, t, Qa + 0.3, { dy: 30 });
      a.forEach((el, i) => drop(el, t, Qa + 0.5 + i * 0.04, { h: 60 }));
      b.forEach((el, i) => drop(el, t, Qa + 0.9 + i * 0.04, { h: 60 }));
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      pop(r.x1, t, A + 0.6, {});
      [...a, ...b].forEach((el) => { el.style.filter = t >= A + 0.6 ? 'saturate(0.35)' : 'none'; });
      enter(r.p2, t, A2 + 0.1, { dy: 30 });
      d.forEach((el, i) => drop(el, t, A2 + 0.3 + i * 0.04, { h: 60 }));
      pop(r.x2, t, A3 + 0.2, {});
    };
  },
};

// ------------------------------------------------------------------ 7. 헷갈리는 포인트 2: 아이가 둘이면?
const qa2 = {
  id: 'qa2',
  build(root, c) {
    const Qa = c.at('a2q', 1), A = c.at('a2a'), A2 = c.at('a2a', 1);
    const head = qaHead(root, { n: 2, sys: 'use', q: '아이가 둘이면?', tChip: c.in, tQ: Qa });
    const kid = (i, suit, name) => `
      <div class="card col" data-r="k${i}" style="left:${330 + i * 660}px;top:500px;width:600px;height:330px;align-items:center;padding-top:30px">
        <div style="height:170px">${baby({ w: 150, suit })}</div>
        <div style="margin-top:6px;font-size:36px;font-weight:820">${name}</div>
        <div class="row" style="margin-top:14px;gap:12px"><div class="chip gold" style="height:54px;font-size:28px;padding:0 20px">${icon('calendar-check', { size: 30 })}1년에 1번</div></div>
        <div class="abs" data-r="ok${i}" style="right:-18px;top:-18px;width:76px;height:76px">${OK_BADGE}</div>
      </div>`;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--mint-2)">자녀별로 한 번씩!</div>
      ${kid(0, '#FFC94D', '첫째')}${kid(1, '#8CC8FF', '둘째')}`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A2 + 0.2, 'pop', 0.5); c.sfx(A2 + 0.6, 'pop', 0.5);
    c.sfx(A2 + 1.0, 'ding', 0.5);
    return (t) => {
      head(t);
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      enter(r.k0, t, A + 0.4, { dy: 40 });
      enter(r.k1, t, A + 0.6, { dy: 40 });
      pop(r.ok0, t, A2 + 0.2, {});
      pop(r.ok1, t, A2 + 0.6, {});
    };
  },
};

// ------------------------------------------------------------------ 8. 헷갈리는 포인트 3: 방학이면 언제든?
const qa3 = {
  id: 'qa3',
  build(root, c) {
    const Qa = c.at('a3q', 1), A = c.at('a3a'), A2 = c.at('a3a', 1);
    const head = qaHead(root, { n: 3, sys: 'cond', q: '방학이면 언제든 쓸 수 있을까?', tChip: c.in, tQ: Qa });
    const BX = 420, BW = 1000, Y = 560;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:80px;color:var(--mint-2)">휴직 기간 <span style="color:var(--gold-2)">전체</span>가 방학 안에</div>
      <div class="abs" data-r="band" style="left:${BX}px;top:${Y}px;width:${BW}px;height:250px;border-radius:30px;background:linear-gradient(180deg,rgba(255,201,77,0.18),rgba(255,201,77,0.42));border:4px solid rgba(245,165,36,0.5)">
        <div class="abs row" style="left:26px;top:18px;gap:10px;font-size:32px;font-weight:820;color:var(--gold-2)">${icon('sun', { size: 36 })}방학</div>
      </div>
      <div class="abs" data-r="end" style="left:${BX + BW - 2}px;top:${Y - 40}px;width:5px;height:330px;border-radius:3px;background:var(--gold)"></div>
      <div class="abs chip gold" data-r="endL" style="left:${BX + BW - 70}px;top:${Y - 100}px;height:52px;font-size:27px;padding:0 20px;background:var(--gold);color:#fff">${icon('school', { size: 28 })}개학</div>
      <div class="block blue" data-r="in" style="left:${BX + 220}px;top:${Y + 90}px;width:360px;height:80px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:840;color:#fff">2주</div>
      <div class="abs" data-r="okIn" style="left:${BX + 540}px;top:${Y + 60}px;width:72px;height:72px">${OK_BADGE}</div>
      <div class="block blue" data-r="over" style="left:${BX + BW - 200}px;top:${Y + 180}px;width:360px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:840;color:#fff;opacity:.9">2주</div>
      <div class="abs" data-r="noOver" style="left:${BX + BW + 140}px;top:${Y + 164}px;width:72px;height:72px">${NO_BADGE}</div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A + 0.9, 'pop', 0.5);
    c.sfx(A2 + 0.3, 'whoosh', 0.3);
    c.sfx(A2 + 0.8, 'pop', 0.5);
    return (t) => {
      head(t);
      enter(r.band, t, Qa + 0.4, { dy: 30 });
      enter(r.end, t, Qa + 0.7, { dy: 0, s0: 1 });
      pop(r.endL, t, Qa + 0.8, {});
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      drop(r.in, t, A + 0.5, { h: 120 });
      pop(r.okIn, t, A + 0.9, {});
      drop(r.over, t, A2 + 0.2, { h: 120 });
      pop(r.noOver, t, A2 + 0.8, {});
    };
  },
};

// ------------------------------------------------------------------ 9. 헷갈리는 포인트 4: 회사가 거부할 수 있나?
const qa4 = {
  id: 'qa4',
  build(root, c) {
    const Qa = c.at('a4q', 1), A = c.at('a4a'), A2 = c.at('a4a', 1), A3 = c.at('a4a', 2);
    const head = qaHead(root, { n: 4, sys: 'cond', q: '회사가 거부할 수 있을까?', tChip: c.in, tQ: Qa });
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--mint-2)">아닙니다, 허용해야 합니다</div>
      <div class="card" data-r="co" style="left:150px;top:500px;width:790px;height:320px">
        <div class="abs" style="left:44px;top:44px">${badge('building-2', 'blue', 120)}</div>
        <div class="abs" style="left:196px;top:56px;font-size:40px;font-weight:840">회사</div>
        <div class="abs" style="left:196px;top:112px;font-size:28px;font-weight:650;color:var(--ink-2)">조건을 갖춰 신청하면</div>
        <div class="abs row" data-r="ok" style="left:44px;top:200px;gap:14px;height:84px;padding:0 30px;border-radius:42px;background:var(--mint-soft);color:var(--mint-2);font-size:36px;font-weight:850">
          <span style="width:48px;height:48px;display:inline-block">${OK_BADGE}</span>허용해야 합니다
        </div>
      </div>
      <div class="card" data-r="warn" style="left:980px;top:500px;width:790px;height:320px">
        <div class="abs" style="left:44px;top:44px">${badge('triangle-alert', 'coral', 120)}</div>
        <div class="abs" style="left:196px;top:56px;font-size:40px;font-weight:840">거부하거나 불이익을 주면</div>
        <div class="abs" style="left:196px;top:112px;font-size:28px;font-weight:650;color:var(--ink-2)">해고·불리한 처우 포함</div>
        <div class="abs row" data-r="pen" style="left:44px;top:200px;gap:14px;height:84px;padding:0 30px;border-radius:42px;background:var(--red);color:#fff;font-size:36px;font-weight:850;box-shadow:0 14px 30px rgba(240,82,90,0.28)">
          ${icon('ban', { size: 40, stroke: 2.6 })}처벌 대상입니다
        </div>
      </div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A2 + 0.9, 'ding', 0.5);
    c.sfx(A3 + 0.9, 'pop', 0.6);
    return (t) => {
      head(t);
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      enter(r.co, t, A2 + 0.1, { dx: -40, dy: 0 });
      pop(r.ok, t, A2 + 0.9, {});
      enter(r.warn, t, A3 + 0.1, { dx: 40, dy: 0 });
      pop(r.pen, t, A3 + 0.9, {});
    };
  },
};

// ------------------------------------------------------------------ 10. 신청 방법: 사유별 기한 → 회사에 신청(증빙) → 고용24 급여
const steps = {
  id: 'steps',
  build(root, c) {
    const P1b = c.at('p1', 1), P1c = c.at('p1', 2), P2 = c.at('p2'), P3 = c.at('p3');
    const hd = header(root, { y: 140, lines: [{ html: '신청은 <span class="hl-blue">이렇게</span>', at: c.in + 0.05 }] });
    const W = 480, H = 470, X = [150, 720, 1290], Y = 290;
    const line = (ic, color, a, b) => `<div class="row" style="gap:18px;margin-top:10px">${badge(ic, color, 84)}<div class="col" style="gap:2px"><div style="font-size:28px;font-weight:720;color:var(--ink-2)">${a}</div><div style="font-size:44px;font-weight:860;color:var(--${color}-2);letter-spacing:-0.03em;white-space:nowrap">${b}</div></div></div>`;
    const items = [
      { color: 'blue', title: '기한 확인', at: P1b, body: `<div class="abs col" style="left:44px;top:150px;gap:24px">${line('sun', 'gold', '방학', '30일 전까지')}${line('thermometer', 'coral', '휴원·입원·격리', '당일도 가능')}</div>` },
      { color: 'lav', title: '회사에 신청', at: P2, body: `<div class="abs" style="left:${(W - 120) / 2}px;top:130px">${badge('file-text', 'lav', 120)}</div><div class="abs" style="left:0;top:270px;width:${W}px;text-align:center;font-size:30px;font-weight:720;color:var(--ink-2);line-height:1.5">사유 증빙을 함께<br><span style="font-size:25px;color:var(--ink-3)">방학 안내문 · 입원확인서 등</span></div>` },
      { color: 'mint', title: '급여 신청', at: P3, body: `<div class="abs" style="left:${(W - 120) / 2}px;top:130px">${badge('laptop', 'mint', 120)}</div><div class="abs" style="left:0;top:270px;width:${W}px;text-align:center;font-size:30px;font-weight:720;color:var(--ink-2);line-height:1.5">휴직을 다 쓴 뒤<br><b class="disp" style="font-size:52px;color:var(--mint-2)">고용24</b></div>` },
    ];
    const card = (k, i) => `
      <div class="abs" data-r="s${i}" style="left:${X[i]}px;top:${Y}px;width:${W}px;height:${H}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${W}px;height:${H}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:180px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${W}px;height:${H}px">
          <div class="abs center" style="left:30px;top:30px;width:56px;height:56px;border-radius:28px;background:var(--${k.color});color:#fff;font-size:30px;font-weight:880">${i + 1}</div>
          <div class="abs" style="left:104px;top:34px;font-size:42px;font-weight:840;letter-spacing:-0.035em">${k.title}</div>
          ${k.body}
        </div>
      </div>`;
    const arrow = (i) => `<div class="abs center" data-r="a${i}" style="left:${X[i] + W + 2}px;top:${Y + H / 2 - 44}px;width:86px;height:88px;color:#AAB3C0">${icon('arrow-right', { size: 58, stroke: 3 })}</div>`;
    const r = mount(root, `${items.map(card).join('')}${arrow(0)}${arrow(1)}`);
    items.forEach((k) => { c.sfx(k.at, 'whoosh', 0.25); c.sfx(k.at + 0.25, 'pop', 0.5); });
    c.sfx(P1c + 0.2, 'tick', 0.5);
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
    };
  },
};

// ------------------------------------------------------------------ 11. 3줄 요약
const summary = {
  id: 'summary',
  build(root, c) {
    const items = [
      { color: 'mint', ic: 'user-check', title: '<span class="hl-mint">만 8세·초2 이하</span> + 사유 4가지', sub: '휴원·휴교 · 방학 · 입원 · 감염병 격리/등원 중지 → 1주 또는 2주', at: c.at('u1') },
      { color: 'gold', ic: 'calendar-range', title: '<span class="hl-gold">자녀별 연 1회</span>', sub: '전체 육아휴직 기간에서는 빠지고, 나눠 쓰는 횟수에는 들어가지 않습니다', at: c.at('u2') },
      { color: 'blue', ic: 'laptop', title: '방학 <span class="hl-blue">30일 전</span> · 급한 경우 <span class="hl-blue">당일</span>', sub: '급여는 휴직을 다 쓴 뒤 고용24에서 신청합니다', at: c.at('u3') },
    ];
    const hd = header(root, { y: 130, lines: [{ html: '<span class="hl-blue">3줄</span> 요약', at: c.in }] });
    const Y = [290, 490, 690];
    const col2 = (k) => `${k.color}-2`;
    const r = mount(root, items.map((k, i) => `
      <div class="card" data-r="it${i}" style="left:200px;top:${Y[i]}px;width:1520px;height:172px">
        <div class="abs center" style="left:34px;top:40px;width:92px;height:92px;border-radius:28px;background:var(--${k.color}-soft);color:var(--${col2(k)})">${icon(k.ic, { size: 50 })}</div>
        <div class="abs disp" style="left:156px;top:30px;font-size:52px">${k.title}</div>
        <div class="abs" style="left:156px;top:106px;font-size:26px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
        <svg class="abs" style="left:1400px;top:46px" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="var(--${k.color}-soft)"/>
          <path data-r="ck${i}" d="M22 42 L35 55 L60 27" fill="none" stroke="var(--${col2(k)})" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`).join(''));
    items.forEach((k, i) => { prepDraw(r[`ck${i}`]); c.sfx(k.at + 0.1, 'pop', 0.45); c.sfx(k.at + 1.6, 'tick', 0.55); });
    return (t) => {
      hd(t);
      items.forEach((k, i) => {
        enter(r[`it${i}`], t, k.at - 0.1, { dx: 60, dy: 0, e: ease.outCubic, d: 0.6 });
        draw(r[`ck${i}`], t, k.at + 1.4, 0.45);
      });
    };
  },
};

// ------------------------------------------------------------------ 12. 아웃트로: 상담 안내 + 다음 영상 예고
const outro = {
  id: 'outro',
  noExit: true,
  build(root, c) {
    const O1 = c.at('o1'), O2 = c.at('o2'), O2b = c.at('o2', 1);
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
      <div class="abs disp" data-r="nt" style="left:150px;top:300px;font-size:112px">달라진 <span class="hl-gold">배우자 출산휴가</span></div>
      <div class="abs" data-r="ns" style="left:154px;top:450px;font-size:36px;font-weight:700;color:var(--ink-2)">2026년 9월 18일부터 달라진 내용을 정리합니다</div>
      <div class="abs" data-r="w1" style="left:1500px;top:250px">${badge('baby', 'coral', 150)}</div>
      <div class="abs" data-r="w2" style="left:1300px;top:280px">${badge('calendar-plus', 'blue', 130)}</div>
      <div class="abs" data-r="fam" style="left:150px;top:560px">${family(420)}</div>
      <div class="abs row" data-r="btns" style="left:700px;top:660px;gap:28px">
        <div class="row" data-r="sub" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#F0525A;color:#fff;font-size:40px;font-weight:840;box-shadow:0 16px 36px rgba(240,82,90,0.3)">${icon('bell', { size: 42, stroke: 2.4 })}<span data-r="subTxt">구독</span></div>
        <div class="row" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#fff;color:var(--ink);font-size:40px;font-weight:840;box-shadow:var(--shadow)">${icon('thumbs-up', { size: 42, stroke: 2.4 })}좋아요</div>
      </div>
      <div class="abs col center" data-r="disc" style="left:0;top:862px;width:1920px;font-size:24px;font-weight:600;color:var(--ink-3);line-height:1.6">
        <div>본 영상은 2026년 9월 기준 정보입니다. 개인별 적용 여부는 고용노동부(☎1350)·고용24에서 확인하시기 바랍니다.</div>
        <div>참고: 남녀고용평등과 일·가정 양립 지원에 관한 법률 · 고용보험법 및 시행령 · 고용노동부 안내</div>
      </div>`);
    const out1 = O2 - 0.3;
    const tClick = O2b + 0.9;
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
      enter(r.ns, t, O2 + 0.7, { dy: 16 });
      drop(r.w1, t, O2 + 0.8, { h: 170 });
      drop(r.w2, t, O2 + 1.0, { h: 170 });
      enter(r.fam, t, O2b, { dy: 40, s0: 0.9, y: wave(t, 3, 5) });
      blink(r.fam, t, 4);
      enter(r.btns, t, O2b + 0.3, { dy: 30 });
      const pressed = t >= tClick;
      setHtml(r.subTxt, pressed ? '구독중' : '구독');
      r.sub.style.background = pressed ? '#8A94A3' : '#F0525A';
      tf(r.sub, { s: pressed ? 1 - 0.08 * Math.sin(Math.PI * clamp((t - tClick) / 0.25)) : 1 });
      enter(r.disc, t, c.lend('o2') + 0.5, { dy: 10 });
      opacity(root, 1 - P(t, END - 0.7, 0.7, ease.inOutSine));
    };
  },
};

const cover = coverScene({ n: 2, title: '1주·2주 단기 육아휴직' });

export const scenes = [cover, intro, what, target, rules, pay, qa1, qa2, qa3, qa4, steps, summary, outro];
