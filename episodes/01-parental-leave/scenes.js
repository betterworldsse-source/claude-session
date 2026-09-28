// 1화: 육아휴직 6개월 연장 제도 & 6+6 부모육아휴직제 — 장면 정의
// 흐름: 훅 → 오늘 소개할 제도 두 가지 → ① 6개월 연장 제도(성립 조건) → ② 6+6(어떤 제도인지·월급별 표) → ③ 헷갈리는 포인트 → ④ 신청 방법 → 정리
// 각 장면은 build(root, ctx)에서 DOM을 만들고, 시간 t를 받는 update 함수를 돌려줍니다.
// ctx.at('문장id', k) = 해당 문장의 k번째 자막 청크가 시작되는 시각(초)
// 모든 타이밍이 문장/자막 기준이라, 내 목소리로 녹음을 바꿔도 그래픽이 자동으로 따라갑니다.
// 시각 언어: "블록 1개 = 1개월", "블록 1개 = 50만 원" — 블록이 떨어져 쌓이며 설명합니다.
import { ease, P, clamp, lerp, wave, mount, tf, opacity, enter, pop, drop, rise, countTo, prepDraw, draw, icon } from '../../engine/web/engine.js';
import { coverScene } from '../../engine/web/cover.js';
import { avatar, family, blink, coins } from '../../engine/web/art.js';

export const asOf = '2026년 9월 기준';

// label·sub: 왼쪽 위 파트 칩 / cardChip·title·cardSub: 챕터 전환 카드
export const chapters = {
  1: { label: '1', sub: '육아휴직 6개월 연장 제도', cardChip: '첫 번째 제도', title: '6개월 연장 제도', cardSub: '육아휴직이 1년 6개월이 되는 조건', short: '연장', color: 'mint', icon: 'calendar-plus', card: ['#2DBFA4', '#138C78'] },
  2: { label: '2', sub: '6+6 부모육아휴직제', cardChip: '두 번째 제도', title: '6+6 부모육아휴직제', cardSub: '첫 6개월 급여를 통상임금 100%로', short: '6+6', color: 'gold', icon: 'coins', card: ['#F9A12B', '#E0700A'] },
  3: { label: '3', sub: '헷갈리는 포인트 4가지', cardChip: '꼭 짚고 갈 것', title: '헷갈리는 포인트', cardSub: '자주 묻는 질문 4가지', short: '포인트', color: 'coral', icon: 'circle-help', card: ['#FF8C74', '#E4553E'] },
  4: { label: '4', sub: '신청 방법 3단계', cardChip: '마지막 체크', title: '신청 방법', cardSub: '회사 → 고용24, 3단계', short: '신청', color: 'blue', icon: 'clipboard-check', card: ['#5B9BFA', '#2F6FE0'] },
  5: { label: '정리', sub: '3줄 요약', title: '정리', short: '정리', color: 'lav', icon: 'list-checks', card: null },
};

// 헷갈리는 포인트가 어느 제도에 관한 것인지 표시하는 태그
export const SYS = {
  ext: { label: '6개월 연장 제도', color: 'mint', icon: 'calendar-plus' },
  six: { label: '6+6 부모육아휴직제', color: 'gold', icon: 'coins' },
};

// ------------------------------------------------------------------ 공용 조각

/** 가운데 정렬 헤더(Jua 제목). lines: [{html, at}] 순서대로 교체 */
function header(root, { y = 128, size = 76, lines }) {
  const box = Math.round(size * 1.24);
  const r = mount(root, `
    <div class="abs" style="left:0;top:${y}px;width:1920px;height:${box}px">
      ${lines.map((l, i) => `<div class="abs" style="left:0;top:0;width:1920px;height:${box}px;overflow:hidden;text-align:center"><div class="h1" data-r="hdL${i}" style="font-size:${size}px">${l.html}</div></div>`).join('')}
    </div>`);
  return (t) => {
    lines.forEach((l, i) => {
      const next = lines[i + 1];
      rise(r[`hdL${i}`], t, l.at, { out: next ? next.at - 0.05 : null, od: 0.35 });
    });
  };
}

/** "헷갈리는 포인트 N" + 해당 제도 태그 + Q 질문 줄 */
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

function tileRow(parent, { x, y, n, cls = 'mint', size = 58, gap = 12, ref }) {
  let html = `<div class="abs" data-r="${ref}" style="left:${x}px;top:${y}px;width:${n * size + (n - 1) * gap}px;height:${size}px">`;
  for (let i = 0; i < n; i++) {
    const c = typeof cls === 'function' ? cls(i) : cls;
    html += `<div class="tile ${c}" data-r="${ref}_${i}" style="left:${i * (size + gap)}px;top:0;width:${size}px;height:${size}px"></div>`;
  }
  html += '</div>';
  const r = mount(parent, html);
  return Array.from({ length: n }, (_, i) => r[`${ref}_${i}`]);
}

const setCls = (el, cls, base = 'tile') => { const c = `${base} ${cls}`; if (el.className !== c) el.className = c; };
const setHtml = (el, h) => { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } };
const LOCK = icon('lock', { size: 24, stroke: 2.4 });
const CHECK = icon('check', { size: 30, stroke: 3.4 });
const OK_BADGE = `<svg viewBox="0 0 48 48" width="100%" height="100%"><circle cx="24" cy="24" r="23" fill="#22B573"/><path d="M13 25l7.5 7.5L35 17" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NO_BADGE = `<svg viewBox="0 0 48 48" width="100%" height="100%"><circle cx="24" cy="24" r="23" fill="#F0525A"/><path d="M16 16l16 16M32 16L16 32" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/></svg>`;

function growW(el, t, t0, d, w, e = ease.inOutCubic) {
  const p = P(t, t0, d, e);
  el.style.width = `${(w * p).toFixed(1)}px`;
  opacity(el, p > 0 ? 1 : 0);
  return p;
}

function flip(front, back, t, t0, d = 0.5) {
  const p = clamp((t - t0) / d);
  const k = Math.abs(Math.cos(Math.PI * p));
  const showBack = p >= 0.5;
  tf(front, { sx: showBack ? 1 : Math.max(0.001, k), o: showBack ? 0 : 1 });
  tf(back, { sx: showBack ? Math.max(0.001, k) : 1, o: showBack ? 1 : 0 });
}

/** 50만 원 블록 계단. counts[i]개 블록을 쌓은 기둥들 */
function stairs(root, { x0, base, bw, bh, gap, pitch, counts, cls = 'gold', ref }) {
  let html = '';
  counts.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      html += `<div class="block ${cls}" data-r="${ref}_${i}_${k}" style="left:${x0 + i * pitch}px;top:${base - (k + 1) * (bh + gap)}px;width:${bw}px;height:${bh}px;border-radius:${Math.round(bh * 0.3)}px"></div>`;
    }
  });
  const r = mount(root, html);
  return counts.map((n, i) => Array.from({ length: n }, (_, k) => r[`${ref}_${i}_${k}`]));
}

// ------------------------------------------------------------------ 1. 도입부: 훅(부부 최대 3년·4천만 원) → 오늘 소개할 제도 두 가지
const intro = {
  id: 'intro',
  build(root, c) {
    const H0 = c.at('h0'), H0b = c.at('h0', 1), I1 = c.at('i1'), I2 = c.at('i2'), I3 = c.at('i3'), I4 = c.at('i4');
    const hd = header(root, {
      y: 150, size: 92,
      lines: [
        { html: '부부가 <span class="hl-coral">함께</span> 쓰면', at: 0.12 },
        { html: '오늘 소개할 육아휴직 제도 <span class="hl-coral">2가지</span>', at: I1 },
        { html: '헷갈리는 포인트와 <span class="hl-blue">신청 방법</span>까지', at: I4 },
      ],
    });
    const W = 770, H = 440, X = [170, 980], Y = 330;
    // 훅: 기간 최대 3년 · 급여 최대 4,000만 원
    const badge = (ic, color) => `<div class="icon-badge" style="width:78px;height:78px;border-radius:24px;background:var(--${color}-soft);color:var(--${color}-2)">${icon(ic, { size: 44 })}</div>`;
    const hook = mount(root, `
      <div class="card col" data-r="hA" style="left:${X[0]}px;top:${Y}px;width:${W}px;height:${H}px;align-items:center;padding-top:54px">
        <div class="row" style="gap:16px">${badge('calendar-plus', 'mint')}<div style="font-size:40px;font-weight:800;color:var(--ink-2)">육아휴직 기간</div></div>
        <div class="disp" style="margin-top:40px;font-size:156px;line-height:1;color:var(--mint-2)">최대 3년</div>
        <div style="margin-top:40px;font-size:30px;font-weight:650;color:var(--ink-3)">부부 합산 · 각자 1년 6개월</div>
      </div>
      <div class="card col" data-r="hB" style="left:${X[1]}px;top:${Y}px;width:${W}px;height:${H}px;align-items:center;padding-top:54px">
        <div class="row" style="gap:16px">${badge('coins', 'gold')}<div style="font-size:40px;font-weight:800;color:var(--ink-2)">첫 6개월 급여</div></div>
        <div class="row" style="margin-top:40px;align-items:baseline;gap:10px;color:var(--gold-2)"><span class="disp" style="font-size:62px">최대</span><span class="disp num" data-r="amt" style="font-size:140px;line-height:1">0</span><span class="disp" style="font-size:62px">만 원</span></div>
        <div style="margin-top:40px;font-size:30px;font-weight:650;color:var(--ink-3)">부부 합산 · 6+6 부모육아휴직제</div>
      </div>`);
    const numDot = (n, color) => `<div class="center" style="width:64px;height:64px;border-radius:32px;background:var(--${color});color:#fff;font-size:36px;font-weight:880;flex:none">${n}</div>`;
    const cap = (html) => `<div class="abs" style="left:0;top:366px;width:${W}px;text-align:center;font-size:30px;font-weight:680;color:var(--ink-2)">${html}</div>`;
    // ① 기간: 1년 → 1년 6개월 + 18칸 블록 줄 (12칸 + 6칸)
    const TS = 32, TG = 4, TX = Math.round((W - (18 * (TS + TG) - TG)) / 2);
    let tiles = '';
    for (let i = 0; i < 18; i++) tiles += `<div class="tile ${i < 12 ? 'mint' : 'gold'}" data-r="t${i}" style="left:${TX + i * (TS + TG)}px;top:300px;width:${TS}px;height:${TS}px;border-radius:9px"></div>`;
    const back1 = `
      <div class="abs row" style="left:44px;top:40px;gap:18px">${numDot(1, 'mint')}<div style="font-size:40px;font-weight:820;letter-spacing:-0.035em;white-space:nowrap">육아휴직 6개월 연장 제도</div></div>
      <div class="abs row" style="left:0;top:132px;width:${W}px;justify-content:center;gap:24px;align-items:center">
        <span class="disp" style="font-size:74px;color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:6px">1년</span>
        ${icon('arrow-right', { size: 64, stroke: 3, color: '#1FAF96' })}
        <span class="disp" style="font-size:108px;color:var(--mint-2)">1년 6개월</span>
      </div>
      ${tiles}
      ${cap('휴직 <b style="color:var(--mint-2)">기간</b>이 늘어나는 제도')}`;
    // ② 급여: 첫 6개월 상한 + 미니 계단
    const V = [250, 250, 300, 350, 400, 450], SW = 40, SG = 10, SX = Math.round((W - (6 * (SW + SG) - SG)) / 2);
    let mini = '';
    V.forEach((v, i) => { const h = Math.round((v / 450) * 46); mini += `<div class="block gold" data-r="st${i}" style="left:${SX + i * (SW + SG)}px;top:${334 - h}px;width:${SW}px;height:${h}px;border-radius:8px"></div>`; });
    const back2 = `
      <div class="abs row" style="left:44px;top:40px;gap:18px">${numDot(2, 'gold')}<div style="font-size:40px;font-weight:820;letter-spacing:-0.035em;white-space:nowrap">6+6 부모육아휴직제</div></div>
      <div class="abs col" style="left:0;top:122px;width:${W}px;align-items:center">
        <div style="font-size:32px;font-weight:720;color:var(--ink-2)">첫 6개월 급여 상한</div>
        <div class="disp" style="font-size:94px;color:var(--gold-2);line-height:1.2">최대 월 450만 원</div>
      </div>
      ${mini}
      ${cap('휴직 <b style="color:var(--gold-2)">급여</b>가 늘어나는 제도')}`;
    const slot = (i, back) => `
      <div class="abs" data-r="s${i}" style="left:${X[i]}px;top:${Y}px;width:${W}px;height:${H}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${W}px;height:${H}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:210px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${W}px;height:${H}px">${back}</div>
      </div>`;
    const nchip = (ref, n, color, text) => `<div class="chip" data-r="${ref}" style="height:70px;font-size:34px;padding:0 32px 0 14px;background:var(--${color});color:#fff;box-shadow:0 14px 30px rgba(31,42,55,0.16)"><div class="center" style="width:48px;height:48px;border-radius:24px;background:#fff;color:var(--${color}-2);font-size:28px;font-weight:880">${n}</div>${text}</div>`;
    const r = mount(root, `${slot(0, back1)}${slot(1, back2)}
      <div class="abs row" style="left:0;top:806px;width:1920px;justify-content:center;gap:22px">
        ${nchip('c3', 3, 'coral', '헷갈리는 포인트 4가지')}${nchip('c4', 4, 'blue', '신청 방법 3단계')}
      </div>`);
    const tOpen = [I2, I3];
    const hookOut = I1 - 0.35;
    c.sfx(H0 + 0.3, 'pop', 0.55);
    c.sfx(H0b + 0.1, 'pop', 0.55);
    c.sfx(H0b + 1.35, 'coin', 0.7);
    c.sfx(I1 + 0.2, 'pop', 0.4); c.sfx(I1 + 0.32, 'pop', 0.4);
    tOpen.forEach((o) => { c.sfx(o, 'whoosh', 0.25); c.sfx(o + 0.25, 'pop', 0.5); });
    c.sfx(I2 + 1.3, 'sparkle', 0.5);
    c.sfx(I3 + 0.95, 'coin', 0.55);
    c.sfx(I4 + 0.45, 'click', 0.6);
    c.sfx(I4 + 0.75, 'click', 0.6);
    return (t) => {
      hd(t);
      enter(hook.hA, t, H0 + 0.2, { dx: -60, dy: 30, out: hookOut });
      enter(hook.hB, t, H0b, { dx: 60, dy: 30, out: hookOut });
      countTo(hook.amt, t, H0b + 0.2, 1.2, 0, 4000);
      [0, 1].forEach((i) => {
        enter(r[`s${i}`], t, I1 + 0.15 + i * 0.12, { dy: 50 });
        flip(r[`f${i}`], r[`b${i}`], t, tOpen[i], 0.5);
        const focus = t >= tOpen[i] && t < (i === 0 ? I3 : I4);
        r[`b${i}`].style.boxShadow = focus ? `0 0 0 5px var(--${i === 0 ? 'mint' : 'gold'}), var(--shadow)` : 'var(--shadow)';
        r[`s${i}`].style.zIndex = focus ? 2 : 1;
        const sc = 1 + 0.03 * (focus ? P(t, tOpen[i] + 0.4, 0.4) : 0);
        r[`s${i}`].style.transform += ` scale(${sc.toFixed(4)})`;
      });
      for (let i = 0; i < 18; i++) drop(r[`t${i}`], t, i < 12 ? I2 + 0.45 + i * 0.03 : I2 + 1.25 + (i - 12) * 0.08, { h: 40 });
      V.forEach((_, i) => drop(r[`st${i}`], t, I3 + 0.85 + i * 0.08, { h: 36 }));
      pop(r.c3, t, I4 + 0.45, { r: wave(t, 2.4, 1.5) });
      pop(r.c4, t, I4 + 0.75, { r: wave(t, 2.6, -1.5) });
    };
  },
};

// ------------------------------------------------------------------ PART 1 공용: 엄마/아빠 블록 줄
const RS = 58, RG = 12;
const ROW_X = 300;
function parentRows(root, { n = 18, y1, y2, prefix, cls = 'empty' }) {
  const r = mount(root, `
    <div class="abs" data-r="${prefix}Av1" style="left:${ROW_X - 118}px;top:${y1 - 16}px">${avatar('mom', 90)}</div>
    <div class="abs" data-r="${prefix}Av2" style="left:${ROW_X - 118}px;top:${y2 - 16}px">${avatar('dad', 90)}</div>
    <div class="abs" data-r="${prefix}Lb1" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y1 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>
    <div class="abs" data-r="${prefix}Lb2" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y2 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>`);
  const a = tileRow(root, { x: ROW_X, y: y1, n, size: RS, gap: RG, cls, ref: `${prefix}A` });
  const b = tileRow(root, { x: ROW_X, y: y2, n, size: RS, gap: RG, cls, ref: `${prefix}B` });
  return { a, b, av1: r[`${prefix}Av1`], av2: r[`${prefix}Av2`], lb1: r[`${prefix}Lb1`], lb2: r[`${prefix}Lb2`] };
}

// ------------------------------------------------------------------ 3. 기본 1년 + 조건 채우면 6개월
const basic = {
  id: 'basic',
  build(root, c) {
    const B2 = c.at('b1', 1), B3 = c.at('b1', 2), B4 = c.at('b1', 3);
    const tMom = B2 + 0.15, tDad = B2 + 0.85, tPlus = B4 + 0.1;
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '<span class="hl-mint">6개월 연장</span> 제도', at: c.in + 0.15 },
        { html: '기본은 부모 각자 <span class="hl-mint">1년</span>', at: B2 },
        { html: '조건 채우면 <span class="hl-gold">+6개월</span>', at: B3 },
      ],
    });
    const box = mount(root, '<div class="card" data-r="box" style="left:150px;top:380px;width:1620px;height:380px"></div>').box;
    const rows = parentRows(root, { y1: 470, y2: 620, prefix: 'p', cls: 'coral' });
    rows.b.forEach((el) => setCls(el, 'blue'));
    rows.a.forEach((el, i) => { if (i >= 12) { setCls(el, 'locked'); el.innerHTML = LOCK; } });
    rows.b.forEach((el, i) => { if (i >= 12) { setCls(el, 'locked'); el.innerHTML = LOCK; } });
    const stamp = mount(root, `
      <div class="abs col center" data-r="stamp" style="left:1420px;top:282px;width:250px;height:120px;border-radius:22px;border:5px solid var(--coral);color:var(--coral-2);background:rgba(255,255,255,0.92);font-weight:880">
        <div style="font-size:26px;letter-spacing:0.02em">2025. 2. 23.</div><div style="font-size:40px;letter-spacing:0.1em">시행</div>
      </div>`).stamp;
    c.sfx(tMom + 0.3, 'tick', 0.3); c.sfx(tMom + 0.7, 'tick', 0.3); c.sfx(tDad + 0.3, 'tick', 0.3); c.sfx(tDad + 0.7, 'tick', 0.3);
    c.sfx(tPlus + 0.2, 'pop', 0.6);
    c.sfx(B3 + 0.15, 'click', 0.6);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(rows.av1, t, c.in + 0.2, { dx: -24, dy: 0 });
      enter(rows.av2, t, c.in + 0.3, { dx: -24, dy: 0 });
      rows.a.forEach((el, i) => drop(el, t, i < 12 ? tMom + i * 0.045 : tPlus + (i - 12) * 0.07, { h: 80 }));
      rows.b.forEach((el, i) => drop(el, t, i < 12 ? tDad + i * 0.045 : tPlus + 0.25 + (i - 12) * 0.07, { h: 44 }));
      const plus = t >= tPlus + 0.6;
      setHtml(rows.lb1, plus ? '<span class="hl-gold">1년 6개월</span>' : '<span class="hl-coral">엄마 1년</span>');
      setHtml(rows.lb2, plus ? '<span class="hl-gold">1년 6개월</span>' : '<span class="hl-blue">아빠 1년</span>');
      const lx = lerp(-6 * (RS + RG), 0, P(t, tPlus + 0.5, 0.6, ease.inOutCubic));
      enter(rows.lb1, t, tMom + 0.9, { x: lx, dx: -16, dy: 0 });
      enter(rows.lb2, t, tDad + 0.9, { x: lx, dx: -16, dy: 0 });
      pop(stamp, t, B3 + 0.1, { r: -8, s0: 1.8, e: ease.outCubic, d: 0.35 });
    };
  },
};

// ------------------------------------------------------------------ 4. 추가 6개월 조건 3가지
const conditions = {
  id: 'conditions',
  build(root, c) {
    const opens = [c.at('c1', 1), c.at('c1', 3), c.at('c1', 4)];
    const hd = header(root, {
      y: 150,
      lines: [{ html: '셋 중 <span class="hl-gold">하나만</span> 해당돼도 1년 6개월', at: c.in + 0.1 }],
    });
    const cards = [
      {
        n: 1, color: 'mint', title: '부모 <span class="hl-mint">각각 3개월</span> 이상',
        art: `<div class="row" style="gap:18px">${avatar('mom', 96)}<div style="font-size:40px;font-weight:800;color:var(--ink-3)">+</div>${avatar('dad', 96)}</div>`,
        desc: '같은 자녀에 대해<br>엄마·아빠 모두 육아휴직<br><b style="color:var(--ink)">3개월 이상</b> 사용',
      },
      {
        n: 2, color: 'coral', title: '<span class="hl-coral">한부모</span>',
        art: `<div class="row" style="gap:18px">${avatar('mom', 96)}${avatar('baby', 96)}</div>`,
        desc: '한부모 가정의<br>엄마 또는 아빠',
      },
      {
        n: 3, color: 'lav', title: '<span class="hl-lav">중증 장애아동</span> 부모',
        art: `<div class="icon-badge" style="width:116px;height:116px;border-radius:58px;background:var(--lav-soft);color:var(--lav-2)">${icon('hand-heart', { size: 66, stroke: 2 })}</div>`,
        desc: '장애 정도가 심한<br>장애인으로 등록된<br>자녀의 부모',
      },
    ];
    const W = 500, X = [170, 710, 1250];
    const r = mount(root, cards.map((k, i) => `
      <div class="abs" data-r="k${i}" style="left:${X[i]}px;top:320px;width:${W}px;height:500px">
        <div class="card col center" data-r="k${i}f" style="left:0;top:0;width:${W}px;height:500px;background:rgba(255,255,255,0.75)">
          <div class="icon-badge" style="width:120px;height:120px;border-radius:60px;background:var(--gold-soft);color:var(--gold-2)">${icon('lock', { size: 60 })}</div>
          <div class="disp" style="margin-top:26px;font-size:44px;color:var(--ink-3)">조건 ${k.n}</div>
        </div>
        <div class="card col" data-r="k${i}b" style="left:0;top:0;width:${W}px;height:500px;align-items:center;padding-top:40px">
          <div class="abs center" style="left:28px;top:28px;width:60px;height:60px;border-radius:30px;background:var(--${k.color});color:#fff;font-size:32px;font-weight:880">${k.n}</div>
          <div style="height:130px;display:flex;align-items:center">${k.art}</div>
          <div style="margin-top:26px;font-size:44px;font-weight:840;letter-spacing:-0.035em;white-space:nowrap">${k.title}</div>
          <div style="margin-top:18px;font-size:30px;font-weight:600;line-height:1.45;color:var(--ink-2);text-align:center">${k.desc}</div>
        </div>
      </div>`).join(''));
    opens.forEach((o) => { c.sfx(o, 'whoosh', 0.25); c.sfx(o + 0.25, 'pop', 0.5); });
    return (t) => {
      hd(t);
      const endFocus = c.end - 1.0;
      cards.forEach((k, i) => {
        enter(r[`k${i}`], t, c.in + 0.15 + i * 0.12, { dy: 50 });
        flip(r[`k${i}f`], r[`k${i}b`], t, opens[i], 0.5);
        const until = i < 2 ? opens[i + 1] : endFocus;
        const focus = t >= opens[i] && t < until;
        const any = t >= opens[0] && t < endFocus;
        r[`k${i}b`].style.boxShadow = focus ? `0 0 0 5px var(--${k.color}), var(--shadow)` : 'var(--shadow)';
        r[`k${i}`].style.filter = any && !focus && t >= opens[i] + 0.5 ? 'saturate(0.6)' : 'none';
        r[`k${i}`].style.zIndex = focus ? 2 : 1;
        const sc = 1 + 0.035 * (focus ? P(t, opens[i] + 0.4, 0.4) : 0);
        r[`k${i}`].style.transform += ` scale(${sc.toFixed(4)})`;
      });
    };
  },
};

// ------------------------------------------------------------------ 5. 맞벌이: 둘 다 3개월 → 각자 1년 6개월, 합산 3년
const both = {
  id: 'both',
  build(root, c) {
    const D1 = c.at('d1'), D2 = c.at('d1', 1);
    const tMom = D1 + 0.9, tDad = D1 + 1.7;
    const unlock = D2 + 0.1;
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '엄마 <span class="hl-coral">3개월</span> + 아빠 <span class="hl-blue">3개월</span> 이상이면?', at: c.in + 0.1 },
        { html: '각자 <span class="hl-gold">1년 6개월</span>, 부부 <span class="hl-gold">최대 3년</span>', at: D2 },
      ],
    });
    const box = mount(root, '<div class="card" data-r="box" style="left:150px;top:380px;width:1620px;height:380px"></div>').box;
    const rows = parentRows(root, { y1: 470, y2: 620, prefix: 'q' });
    const x3 = ROW_X + 3 * (RS + RG) - RG;
    const k = mount(root, `
      <div class="abs chip coral" data-r="ck1" style="left:${ROW_X}px;top:414px;height:44px;font-size:24px;padding:0 16px">${icon('check', { size: 24, stroke: 3 })}3개월 이상</div>
      <div class="abs chip blue" data-r="ck2" style="left:${ROW_X}px;top:564px;height:44px;font-size:24px;padding:0 16px">${icon('check', { size: 24, stroke: 3 })}3개월 이상</div>
      <div class="abs" data-r="line3" style="left:${x3 + 5}px;top:450px;width:3px;height:250px;background:repeating-linear-gradient(180deg,#8A94A3 0 8px,transparent 8px 16px)"></div>
      <div class="abs chip gold" data-r="total" style="left:760px;top:800px;height:74px;font-size:36px;padding:0 32px;box-shadow:var(--shadow-sm)">
        ${icon('calendar-days', { size: 36 })}<span>18개월 + 18개월 = </span><span style="font-weight:880">최대 3년</span>
      </div>`);
    for (let i = 0; i < 3; i++) { c.sfx(tMom + i * 0.12, 'tick', 0.35); c.sfx(tDad + i * 0.12, 'tick', 0.35); }
    c.sfx(unlock + 0.1, 'sparkle', 0.6);
    c.sfx(D2 + 1.7, 'ding', 0.55);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(rows.av1, t, c.in + 0.15, { dx: -24, dy: 0 });
      enter(rows.av2, t, c.in + 0.25, { dx: -24, dy: 0 });
      const paint = (arr, tUse, color, soft) => arr.forEach((el, i) => {
        let cls = 'empty', html = '';
        if (i < 3) { if (t >= tUse + i * 0.12) { cls = color; html = CHECK; } }
        else if (i >= 12) { cls = t >= unlock + (i - 12) * 0.07 ? 'gold' : 'locked'; html = cls === 'gold' ? '' : LOCK; }
        setCls(el, cls);
        setHtml(el, html);
        el.style.background = i >= 3 && i < 12 && t >= unlock + 0.3 ? soft : '';
        const on = i < 3 ? t >= tUse + i * 0.12 : i >= 12 && t >= unlock + (i - 12) * 0.07;
        const t0 = i < 3 ? tUse + i * 0.12 : unlock + (i - 12) * 0.07;
        const bump = on ? 0.16 * (1 - P(t, t0, 0.35)) : 0;
        enter(el, t, c.in + 0.2 + i * 0.015, { dy: 16, s: 1 + bump });
      });
      paint(rows.a, tMom, 'coral', '#FFD9CF');
      paint(rows.b, tDad, 'blue', '#D3E2FF');
      setHtml(rows.lb1, t < unlock ? '<span style="color:var(--ink-3)">1년</span>' : '<span class="hl-gold">1년 6개월</span>');
      setHtml(rows.lb2, t < unlock ? '<span style="color:var(--ink-3)">1년</span>' : '<span class="hl-gold">1년 6개월</span>');
      enter(rows.lb1, t, c.in + 0.4, { dx: -16, dy: 0 });
      enter(rows.lb2, t, c.in + 0.5, { dx: -16, dy: 0 });
      pop(k.ck1, t, tMom + 0.3, {});
      pop(k.ck2, t, tDad + 0.3, {});
      enter(k.line3, t, tMom, { dy: 0, s0: 1, o: 0.8 });
      enter(k.total, t, D2 + 1.6, { dy: 30, s0: 0.8, e: ease.outBack });
    };
  },
};

// ------------------------------------------------------------------ 6. 헷갈리는 포인트 1: 배우자가 육아휴직을 못 쓴다면?
const qa1 = {
  id: 'qa1',
  build(root, c) {
    const Qa = c.at('a1q', 1), A = c.at('a1a'), A2 = c.at('a1a', 1);
    const head = qaHead(root, { n: 1, sys: 'ext', q: '배우자가 자영업자·전업주부라면?', tChip: c.in, tQ: Qa });
    const who = [['briefcase', '자영업자'], ['laptop', '프리랜서'], ['house', '전업주부']];
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--red)">첫 번째 조건으론 연장 불가</div>
      ${who.map(([ic, name], i) => `
        <div class="card col center" data-r="w${i}" style="left:${150 + i * 260}px;top:510px;width:230px;height:250px">
          <div class="icon-badge" style="width:110px;height:110px;border-radius:32px;background:#EEF0F3;color:var(--ink-2)">${icon(ic, { size: 60 })}</div>
          <div style="margin-top:22px;font-size:32px;font-weight:780">${name}</div>
          <div class="abs" data-r="x${i}" style="right:-14px;top:-14px;width:60px;height:60px">${NO_BADGE}</div>
        </div>`).join('')}
      <div class="card" data-r="note" style="left:980px;top:510px;width:790px;height:250px;padding:40px 44px">
        <div class="row" style="gap:14px;font-size:32px;font-weight:780"><span style="width:40px;height:40px;display:inline-block">${OK_BADGE}</span>이런 경우는 가능합니다</div>
        <div style="margin-top:20px;font-size:29px;font-weight:640;color:var(--ink-2);line-height:1.6">· 배우자가 공무원·교원이면 그 육아휴직도 인정<br>· 한부모·중증 장애아동 부모는 해당되면 1년 6개월</div>
      </div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.6);
    for (let i = 0; i < 3; i++) c.sfx(A2 + 0.2 + i * 0.14, 'pop', 0.35);
    return (t) => {
      head(t);
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      for (let i = 0; i < 3; i++) {
        drop(r[`w${i}`], t, A + 0.3 + i * 0.15, { h: 50 });
        pop(r[`x${i}`], t, A2 + 0.2 + i * 0.14, {});
      }
      enter(r.note, t, A2 + 1.0, { dx: 40, dy: 0 });
    };
  },
};

// ------------------------------------------------------------------ 7. 헷갈리는 포인트 2: 미리 신청할 수 있나? (함정)
const qa2 = {
  id: 'qa2',
  build(root, c) {
    const Qa = c.at('a2q', 1), A = c.at('a2a'), A2 = c.at('a2a', 1), A3 = c.at('a2a', 2);
    const head = qaHead(root, { n: 2, sys: 'ext', q: '배우자가 곧 3개월을 채울 예정이면, 미리 신청?', tChip: c.in, tQ: Qa, qSize: 46 });
    const blk = (x, cls, label = '') => `<div class="block ${cls}" style="left:${x}px;top:120px;width:118px;height:104px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:var(--blue-2)">${label}</div>`;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--red)">아닙니다, 함정 주의!</div>
      <div class="abs" data-r="exp" style="left:150px;top:470px;font-size:40px;font-weight:760;letter-spacing:-0.03em;white-space:nowrap">추가 6개월 신청 시점에 <span class="mark">배우자 3개월 사용이 이미 확인</span>되어야 합니다</div>
      <div class="card" data-r="p1" style="left:150px;top:570px;width:790px;height:290px">
        <div class="abs" style="left:44px;top:38px;font-size:32px;font-weight:780">아빠 2개월 사용 + 1개월 예정</div>
        <div data-r="p1b">${blk(44, 'blue')}${blk(176, 'blue')}${blk(308, 'ghost', '예정')}</div>
        <div class="abs" data-r="p1x" style="left:600px;top:112px;width:120px;height:120px">${NO_BADGE}</div>
      </div>
      <div class="card" data-r="p2" style="left:980px;top:570px;width:790px;height:290px">
        <div class="abs" style="left:44px;top:38px;font-size:32px;font-weight:780">아빠 3개월 사용 완료</div>
        <div data-r="p2b">${blk(44, 'blue')}${blk(176, 'blue')}${blk(308, 'blue')}</div>
        <div class="abs" data-r="p2x" style="left:600px;top:112px;width:120px;height:120px">${OK_BADGE}</div>
      </div>`);
    const blocks1 = [...r.p1b.children], blocks2 = [...r.p2b.children];
    const tP1 = A3, tP2 = A3 + 1.5;
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(tP1 + 1.1, 'pop', 0.55);
    c.sfx(tP2 + 1.1, 'ding', 0.5);
    return (t) => {
      head(t);
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      enter(r.exp, t, A2, { dy: 18 });
      enter(r.p1, t, tP1, { dy: 30 });
      blocks1.forEach((el, i) => drop(el, t, tP1 + 0.25 + i * 0.12, { h: 90 }));
      pop(r.p1x, t, tP1 + 1.1, {});
      enter(r.p2, t, tP2, { dy: 30 });
      blocks2.forEach((el, i) => drop(el, t, tP2 + 0.25 + i * 0.12, { h: 90 }));
      pop(r.p2x, t, tP2 + 1.1, {});
    };
  },
};

// ------------------------------------------------------------------ 8. 6+6 개념
const AX = { x0: 330, x1: 1590, months: 24 };
const mx = (m) => AX.x0 + ((AX.x1 - AX.x0) * m) / AX.months;

function ageAxis(root, { y, ref, until = 24, labelEvery = 3 }) {
  let ticks = '';
  for (let m = 0; m <= until; m += labelEvery) {
    ticks += `<div class="abs" style="left:${mx(m) - 1.5}px;top:${y - 8}px;width:3px;height:16px;border-radius:2px;background:#C9CFD8"></div>
      <div class="axis-label" style="left:${mx(m) - 50}px;top:${y + 16}px;width:100px">${m === 0 ? '출생' : `${m}개월`}</div>`;
  }
  return mount(root, `
    <div class="abs" data-r="${ref}" style="left:0;top:0;width:1920px;height:1080px">
      <div class="abs" style="left:${AX.x0}px;top:${y - 2}px;width:${mx(until) - AX.x0}px;height:5px;border-radius:3px;background:#D5DAE1"></div>
      ${ticks}
      <div class="abs" style="left:${AX.x0 - 190}px;top:${y - 20}px;font-size:26px;font-weight:750;color:var(--ink-2);white-space:nowrap">아이 나이</div>
    </div>`);
}

const concept66 = {
  id: 'concept66',
  build(root, c) {
    const K1b = c.at('k1', 1), K2 = c.at('k2'), K2b = c.at('k2', 1), K2c = c.at('k2', 2);
    const hd = header(root, {
      y: 140,
      lines: [
        { html: '<span class="hl-gold">생후 18개월</span> 전에 부모 모두 시작하면', at: K2 },
        { html: '각자 <span class="hl-gold">첫 6개월</span> = 통상임금 <span class="hl-gold">100%</span>', at: K2c },
      ],
    });
    const logo = mount(root, `
      <div class="abs col" style="left:0;top:250px;width:1920px;align-items:center">
        <div class="row" style="gap:40px">
          <div class="col center" data-r="lg1"><div class="center disp" style="width:250px;height:250px;border-radius:125px;background:linear-gradient(160deg,#FF9A86,var(--coral));color:#fff;font-size:190px;box-shadow:0 24px 50px rgba(255,125,102,0.35)">6</div><div style="margin-top:22px;font-size:34px;font-weight:780;color:var(--coral-2)">엄마 첫 6개월</div></div>
          <div data-r="lgp" class="disp" style="font-size:140px;color:var(--ink-3);margin-top:-60px">+</div>
          <div class="col center" data-r="lg2"><div class="center disp" style="width:250px;height:250px;border-radius:125px;background:linear-gradient(160deg,#74A8FA,var(--blue));color:#fff;font-size:190px;box-shadow:0 24px 50px rgba(76,141,246,0.35)">6</div><div style="margin-top:22px;font-size:34px;font-weight:780;color:var(--blue-2)">아빠 첫 6개월</div></div>
        </div>
        <div data-r="lgT" class="disp" style="margin-top:40px;font-size:70px">6+6 <span class="hl-gold">부모육아휴직제</span></div>
      </div>`);
    const Y = 610;
    const ax = ageAxis(root, { y: Y, ref: 'ax' });
    const bw = mx(6) - mx(0);
    const z = mount(root, `
      <div class="abs" data-r="zone" style="left:${mx(0)}px;top:${Y - 240}px;width:${mx(18) - mx(0)}px;height:250px;border-radius:24px 24px 0 0;background:linear-gradient(180deg,rgba(255,201,77,0.10),rgba(255,201,77,0.32))">
        <div class="abs chip gold" style="right:-2px;top:-64px;height:50px;font-size:26px;padding:0 20px">${icon('baby', { size: 26 })}생후 18개월 이내 시작</div>
      </div>
      <div class="abs" data-r="zoneLine" style="left:${mx(18) - 2}px;top:${Y - 250}px;width:4px;height:262px;border-radius:2px;background:var(--gold)"></div>
      <div class="abs" data-r="pinM" style="left:${mx(3) - 44}px;top:${Y - 200}px">${avatar('mom', 88)}<div class="abs" style="left:40px;top:92px;width:8px;height:100px;border-radius:4px;background:var(--coral)"></div></div>
      <div class="abs" data-r="pinD" style="left:${mx(12) - 44}px;top:${Y - 200}px">${avatar('dad', 88)}<div class="abs" style="left:40px;top:92px;width:8px;height:100px;border-radius:4px;background:var(--blue)"></div></div>
      <div class="abs center" data-r="barM" style="left:${mx(3)}px;top:${Y + 66}px;width:0;height:64px;border-radius:14px;background:linear-gradient(90deg,#FF9A86,var(--coral));color:#fff;font-size:26px;font-weight:800;white-space:nowrap;overflow:hidden">엄마 첫 6개월</div>
      <div class="abs center" data-r="barD" style="left:${mx(12)}px;top:${Y + 66}px;width:0;height:64px;border-radius:14px;background:linear-gradient(90deg,#74A8FA,var(--blue));color:#fff;font-size:26px;font-weight:800;white-space:nowrap;overflow:hidden">아빠 첫 6개월</div>
      <div class="abs chip ink" data-r="p100" style="left:${mx(20) - 70}px;top:${Y + 60}px;height:76px;font-size:36px;padding:0 30px">${icon('coins', { size: 38 })}통상임금 100%</div>
      <div class="abs col" style="left:${mx(20) - 90}px;top:${Y - 210}px;gap:14px;align-items:flex-start">
        <div class="chip white" data-r="md1">${icon('circle-check', { size: 30, color: '#1FAF96' })}동시 사용 OK</div>
        <div class="chip white" data-r="md2">${icon('circle-check', { size: 30, color: '#1FAF96' })}순차 사용 OK</div>
      </div>`);
    const t100 = K2c + 1.6;
    c.sfx(c.in + 0.2, 'pop', 0.6);
    c.sfx(c.in + 0.45, 'pop', 0.6);
    c.sfx(K2b + 0.2, 'pop', 0.5);
    c.sfx(K2b + 0.8, 'pop', 0.5);
    c.sfx(t100, 'coin', 0.7);
    c.sfx(t100 + 0.9, 'tick', 0.45);
    c.sfx(t100 + 1.3, 'tick', 0.45);
    return (t) => {
      hd(t);
      const out = K2 - 0.45;
      enter(logo.lg1, t, c.in + 0.15, { dy: 0, s0: 0.3, e: ease.outBack, out, ods: 0.8 });
      enter(logo.lgp, t, c.in + 0.3, { dy: 0, s0: 0.3, out });
      enter(logo.lg2, t, c.in + 0.4, { dy: 0, s0: 0.3, e: ease.outBack, out, ods: 0.8 });
      enter(logo.lgT, t, K1b - 0.1, { dy: 30, out });
      enter(ax.ax, t, K2 - 0.1, { dy: 20, s0: 1 });
      enter(z.zone, t, K2 + 0.3, { dy: 30, s0: 1 });
      enter(z.zoneLine, t, K2 + 0.5, { dy: 0, s0: 1 });
      drop(z.pinM, t, K2b + 0.2, { h: 120 });
      drop(z.pinD, t, K2b + 0.8, { h: 120 });
      growW(z.barM, t, K2c + 0.1, 0.8, bw);
      growW(z.barD, t, K2c + 0.5, 0.8, bw);
      pop(z.p100, t, t100, {});
      enter(z.md1, t, t100 + 0.9, { dx: 30, dy: 0 });
      enter(z.md2, t, t100 + 1.3, { dx: 30, dy: 0 });
      blink(z.pinM, t, 1);
      blink(z.pinD, t, 2);
    };
  },
};

// ------------------------------------------------------------------ 9. 월 상한액 계단 (블록 1개 = 50만 원)
const stairsScene = {
  id: 'stairs',
  build(root, c) {
    const M1 = c.at('m1'), M2 = c.at('m1', 1), M3 = c.at('m1', 2), M4 = c.at('m1', 3), N1 = c.at('m2'), N2 = c.at('m2', 1);
    const hd = header(root, { y: 140, lines: [{ html: '첫 6개월, 상한은 <span class="hl-gold">계단처럼</span>', at: c.in + 0.05 }] });
    const V = [250, 250, 300, 350, 400, 450];
    const base = 880, bw = 132, bh = 34, gap = 6, pitch = 178, x0 = 190;
    const cols = stairs(root, { x0, base, bw, bh, gap, pitch, counts: V.map((v) => v / 50), ref: 's' });
    const colAt = [M2 + 0.35, M2 + 0.95, M3 + 0.25, M3 + 0.85, M3 + 1.45, M4 + 0.3];
    let labels = '';
    V.forEach((v, i) => {
      const top = base - (v / 50) * (bh + gap);
      labels += `<div class="abs disp num" data-r="v${i}" style="left:${x0 + i * pitch - 30}px;top:${top - 76}px;width:${bw + 60}px;text-align:center;font-size:56px;color:var(--gold-2)"><span data-r="vn${i}">0</span><span style="font-size:28px;margin-left:2px">만</span></div>
        <div class="axis-label" style="left:${x0 + i * pitch}px;top:${base + 14}px;width:${bw}px">${i + 1}개월</div>`;
    });
    const r = mount(root, `${labels}
      <div class="abs" style="left:${x0 - 20}px;top:${base}px;width:${5 * pitch + bw + 40}px;height:4px;border-radius:2px;background:#D5DAE1"></div>
      <div class="abs row" data-r="legend" style="left:${x0}px;top:290px;gap:14px;font-size:28px;font-weight:720;color:var(--ink-2)"><div class="block gold" style="position:relative;width:64px;height:24px;border-radius:8px"></div>블록 1개 = 50만 원</div>
      <div class="card col" data-r="side" style="left:1360px;top:300px;width:420px;height:560px;align-items:center;padding-top:46px">
        <div style="font-size:30px;font-weight:720;color:var(--ink-2)">한 사람당 최대</div>
        <div class="row" style="align-items:baseline;gap:6px"><span class="disp num" data-r="tot1" style="font-size:104px;color:var(--gold-2)">0</span><span style="font-size:38px;font-weight:820;color:var(--gold-2)">만 원</span></div>
        <div data-r="s2" class="col center" style="margin-top:26px;padding-top:26px;border-top:3px solid var(--line);width:340px">
          <div class="row" style="gap:10px">${avatar('mom', 60)}${avatar('dad', 60)}</div>
          <div style="margin-top:12px;font-size:30px;font-weight:720;color:var(--ink-2)">부부 합산 최대</div>
          <div class="row" style="align-items:baseline;gap:6px"><span class="disp num" data-r="tot2" style="font-size:88px;color:var(--gold-2)">0</span><span style="font-size:34px;font-weight:820;color:var(--gold-2)">만 원</span></div>
        </div>
      </div>`);
    colAt.forEach((t0, i) => c.sfx(t0 + 0.35, i === 5 ? 'ding' : 'pop', i === 5 ? 0.55 : 0.4));
    c.sfx(N1 + 0.6, 'coin', 0.6);
    c.sfx(N2 + 0.6, 'coin', 0.6);
    return (t) => {
      hd(t);
      enter(r.legend, t, M1 + 0.4, { dx: -20, dy: 0 });
      cols.forEach((col, i) => {
        col.forEach((el, k) => drop(el, t, colAt[i] + k * 0.045, { h: 160 }));
        enter(r[`v${i}`], t, colAt[i] + 0.35, { dy: 14 });
        countTo(r[`vn${i}`], t, colAt[i] + 0.35, 0.3 + V[i] / 1000, 0, V[i]);
      });
      enter(r.side, t, N1 - 0.2, { dx: 40, dy: 0 });
      countTo(r.tot1, t, N1 + 0.1, 1.2, 0, 2000);
      enter(r.s2, t, N2 - 0.1, { dy: 20 });
      countTo(r.tot2, t, N2 + 0.1, 1.2, 0, 4000);
    };
  },
};

// ------------------------------------------------------------------ 10. 예시: 통상임금 월 500만 원이라면
const example = {
  id: 'example',
  build(root, c) {
    const E2 = c.at('e1', 1), E3 = c.at('e1', 2), E4 = c.at('e1', 3);
    const hd = header(root, { y: 140, lines: [{ html: '통상임금 <span class="hl-blue">월 500만 원</span>이라면?', at: c.in + 0.05 }] });
    const K = 0.56, X0 = 330, GAP = 6;
    const seg = (vals, y, cls, ref) => {
      let x = X0, html = '';
      vals.forEach((v, i) => {
        const w = v * K;
        html += `<div class="block ${cls}" data-r="${ref}${i}" style="left:${x}px;top:${y}px;width:${w}px;height:104px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:${cls === 'gold' ? '#7A4A00' : 'var(--ink-2)'}">${v}</div>`;
        x += w + GAP;
      });
      return { html, end: x - GAP };
    };
    const g = seg([250, 250, 250, 200, 200, 200], 400, 'gray', 'g');
    const s = seg([250, 250, 300, 350, 400, 450], 580, 'gold', 's');
    const r = mount(root, `
      <div class="abs" data-r="sub" style="left:0;top:252px;width:1920px;text-align:center;font-size:32px;font-weight:650;color:var(--ink-3)">6개월 사용 · 한 사람 기준 · 단위 만 원</div>
      <div class="abs" data-r="lg" style="left:150px;top:424px;font-size:46px;font-weight:800;color:var(--ink-2)">일반</div>
      <div class="abs disp" data-r="ls" style="left:150px;top:596px;font-size:64px;color:var(--gold-2)">6+6</div>
      ${g.html}${s.html}
      <div class="abs row" data-r="tg" style="left:${g.end + 30}px;top:414px;align-items:baseline;gap:4px"><span class="disp num" data-r="tgn" style="font-size:72px;color:var(--ink-2)">0</span><span style="font-size:30px;font-weight:800;color:var(--ink-2)">만 원</span></div>
      <div class="abs row" data-r="ts" style="left:${s.end + 30}px;top:594px;align-items:baseline;gap:4px"><span class="disp num" data-r="tsn" style="font-size:72px;color:var(--gold-2)">0</span><span style="font-size:30px;font-weight:800;color:var(--gold-2)">만 원</span></div>
      <div class="abs" data-r="dl" style="left:${g.end}px;top:708px;width:${s.end - g.end}px;height:10px;border-radius:5px;background:var(--green);transform-origin:0 50%"></div>
      <div class="abs chip" data-r="dp" style="left:${g.end - 10}px;top:738px;height:66px;font-size:34px;padding:0 28px;background:var(--green);color:#fff">1인 +650만 원</div>
      <div class="abs disp" data-r="cp" style="left:${g.end + 300}px;top:744px;font-size:50px;color:var(--ink)">부부라면 <span style="color:var(--green)">+1,300만 원</span></div>`);
    const ga = [...Array(6).keys()].map((i) => r[`g${i}`]), sa = [...Array(6).keys()].map((i) => r[`s${i}`]);
    c.sfx(E2 + 1.3, 'pop', 0.5);
    c.sfx(E3 + 1.3, 'coin', 0.6);
    c.sfx(E4 + 0.4, 'ding', 0.55);
    return (t) => {
      hd(t);
      enter(r.sub, t, c.in + 0.4, { dy: 12 });
      enter(r.lg, t, E2 - 0.1, { dx: -20, dy: 0 });
      ga.forEach((el, i) => drop(el, t, E2 + 0.15 + i * 0.12, { h: 90 }));
      enter(r.tg, t, E2 + 1.1, { dx: -16, dy: 0 });
      countTo(r.tgn, t, E2 + 1.1, 0.9, 0, 1350);
      enter(r.ls, t, E3 - 0.1, { dx: -20, dy: 0 });
      sa.forEach((el, i) => drop(el, t, E3 + 0.15 + i * 0.12, { h: 60 }));
      enter(r.ts, t, E3 + 1.1, { dx: -16, dy: 0 });
      countTo(r.tsn, t, E3 + 1.1, 0.9, 0, 2000);
      const dp = P(t, E4, 0.6, ease.inOutCubic);
      tf(r.dl, { sx: Math.max(0.001, dp), o: dp > 0 ? 1 : 0 });
      pop(r.dp, t, E4 + 0.4, {});
      enter(r.cp, t, E4 + 1.4, { dx: -20, dy: 0 });
    };
  },
};

// ------------------------------------------------------------------ 11. 월급별 비교표 (6개월 · 한 사람 기준)
const table = {
  id: 'table',
  build(root, c) {
    const W2 = c.at('w1', 1);
    const hd = header(root, { y: 140, lines: [{ html: '<span class="hl-gold">월급별</span>로 보면', at: c.in + 0.05 }] });
    const rows = [
      { wage: '월 200만 원', base: 1200, six: 1200, diff: 0 },
      { wage: '월 300만 원', base: 1350, six: 1700, diff: 350 },
      { wage: '월 400만 원', base: 1350, six: 1950, diff: 600 },
      { wage: '월 500만 원 이상', base: 1350, six: 2000, diff: 650 },
    ];
    const TX = 300, TW = 1320, TY = 300, HR = 92, RH = 110;
    const cx = [48, 560, 830, 1080];
    const fmt = (v) => v.toLocaleString('en-US');
    const cell = (x, w, html, align = 'center') => `<div class="abs row" style="left:${x}px;top:0;width:${w}px;height:${RH}px;justify-content:${align}">${html}</div>`;
    let body = '';
    rows.forEach((k, i) => {
      const diff = k.diff > 0
        ? `<div class="chip" style="height:56px;font-size:30px;padding:0 24px;background:var(--green);color:#fff">+${fmt(k.diff)}</div>`
        : `<div class="chip" data-r="same" style="height:56px;font-size:28px;padding:0 22px;background:#EEF0F3;color:var(--ink-2)">차이 없음</div>`;
      body += `<div class="abs" data-r="row${i}" style="left:0;top:${HR + i * RH}px;width:${TW}px;height:${RH}px;border-top:2px solid var(--line)">
        ${cell(cx[0], 460, `<span style="font-size:38px;font-weight:800">${k.wage}</span>`, 'flex-start')}
        ${cell(cx[1] - 60, 240, `<span class="num" style="font-size:42px;font-weight:760;color:var(--ink-2)">${fmt(k.base)}</span>`)}
        ${cell(cx[2] - 60, 240, `<span class="num" style="font-size:46px;font-weight:880;color:var(--gold-2)">${fmt(k.six)}</span>`)}
        ${cell(cx[3] - 40, 260, diff)}
      </div>`;
    });
    const th = (x, w, text, align = 'center') => `<div class="abs row" style="left:${x}px;top:0;width:${w}px;height:${HR}px;justify-content:${align};font-size:28px;font-weight:760;color:var(--ink-3)">${text}</div>`;
    const r = mount(root, `
      <div class="abs" data-r="sub" style="left:0;top:252px;width:1920px;text-align:center;font-size:30px;font-weight:650;color:var(--ink-3)">첫 6개월 · 한 사람 기준 · 단위 만 원</div>
      <div class="card" data-r="tbl" style="left:${TX}px;top:${TY}px;width:${TW}px;height:${HR + rows.length * RH + 16}px;overflow:hidden">
        <div class="abs" data-r="hl" style="left:0;top:${HR}px;width:${TW}px;height:${RH}px;background:var(--coral-soft)"></div>
        ${th(cx[0], 460, '통상임금', 'flex-start')}${th(cx[1] - 60, 240, '일반 급여')}${th(cx[2] - 60, 240, '<span style="color:var(--gold-2)">6+6</span>')}${th(cx[3] - 40, 260, '더 받는 금액')}
        ${body}
      </div>`);
    rows.forEach((_, i) => c.sfx(c.in + 0.55 + i * 0.22, 'tick', 0.4));
    c.sfx(W2 + 0.25, 'pop', 0.6);
    return (t) => {
      hd(t);
      enter(r.sub, t, c.in + 0.3, { dy: 12 });
      enter(r.tbl, t, c.in + 0.2, { dy: 40 });
      const focus = P(t, W2 + 0.15, 0.4);
      rows.forEach((_, i) => {
        enter(r[`row${i}`], t, c.in + 0.5 + i * 0.22, { dx: -30, dy: 0, o: i === 0 ? 1 : 1 - 0.45 * focus });
      });
      opacity(r.hl, focus);
      pop(r.same, t, W2 + 0.25, { s0: 0.6 });
    };
  },
};

// ------------------------------------------------------------------ 11. 헷갈리는 포인트 3: 누구나 450만 원?
const qa3 = {
  id: 'qa3',
  build(root, c) {
    const Qa = c.at('a3q', 1), A = c.at('a3a'), A2 = c.at('a3a', 1), A3 = c.at('a3a', 2);
    const head = qaHead(root, { n: 3, sys: 'six', q: '6+6이면 누구나 월 450만 원?', tChip: c.in, tQ: Qa });
    const V = [250, 250, 300, 350, 400, 450];
    const base = 890, bw = 112, bh = 26, gap = 5, pitch = 142, x0 = 190;
    const cols = stairs(root, { x0, base, bw, bh, gap, pitch, counts: V.map((v) => v / 50), ref: 'm' });
    const lineY = base - 6 * (bh + gap) - 2;
    const r = mount(root, `
      <div class="abs disp" data-r="ans" style="left:150px;top:352px;font-size:86px;color:var(--red)">아닙니다, 450만 원은 ‘상한’</div>
      <div class="abs" data-r="line" style="left:${x0 - 30}px;top:${lineY}px;width:${5 * pitch + bw + 60}px;height:0;border-top:5px dashed var(--blue);transform-origin:0 50%"></div>
      <div class="abs chip blue" data-r="tag" style="left:${x0 + 5 * pitch + bw + 50}px;top:${lineY - 30}px;height:60px;font-size:30px;padding:0 24px;background:var(--blue);color:#fff">${icon('user', { size: 30 })}내 통상임금 월 300만 원</div>
      <div class="abs" data-r="res" style="left:${x0 + 5 * pitch + bw + 50}px;top:${lineY + 56}px;font-size:40px;font-weight:800;letter-spacing:-0.03em;line-height:1.45;white-space:nowrap">셋째 달부터 계속 <span class="hl-blue">월 300만 원</span><br><span style="font-size:28px;font-weight:650;color:var(--ink-3)">(첫째·둘째 달은 250만 원)</span></div>`);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    c.sfx(A2 + 0.3, 'whoosh', 0.3);
    c.sfx(A3 + 0.3, 'tick', 0.5);
    return (t) => {
      head(t);
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      cols.forEach((col, i) => col.forEach((el, k) => {
        drop(el, t, A + 0.4 + i * 0.16 + k * 0.03, { h: 120 });
        if (k >= 6) el.style.opacity = (+el.style.opacity * (1 - 0.82 * P(t, A3 + 0.3, 0.6))).toFixed(3);
      }));
      const lp = P(t, A2 + 0.2, 0.7, ease.inOutCubic);
      tf(r.line, { sx: Math.max(0.001, lp), o: lp > 0 ? 1 : 0 });
      pop(r.tag, t, A2 + 0.7, {});
      enter(r.res, t, A3 + 0.6, { dy: 16 });
    };
  },
};

// ------------------------------------------------------------------ 12. 헷갈리는 포인트 4: 쓴 기간이 다르면? + 차액 소급
const qa4 = {
  id: 'qa4',
  build(root, c) {
    const Qa = c.at('a4q', 1), A = c.at('a4a'), A2 = c.at('a4a', 1), A3 = c.at('a4a', 2), A4 = c.at('a4a', 3);
    const head = qaHead(root, { n: 4, sys: 'six', q: '엄마 6개월, 아빠 3개월이라면?', tChip: c.in, tQ: Qa });
    const S = 112, PIT = 130, X = 330, YM = 530, YD = 680;
    let bl = '';
    for (let i = 0; i < 6; i++) bl += `<div class="block coral" data-r="m${i}" style="left:${X + i * PIT}px;top:${YM}px;width:${S}px;height:${S}px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#fff">${i + 1}</div>`;
    for (let i = 0; i < 3; i++) bl += `<div class="block blue" data-r="d${i}" style="left:${X + i * PIT}px;top:${YD}px;width:${S}px;height:${S}px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:#fff">${i + 1}</div>`;
    const r = mount(root, `${bl}
      <div class="abs disp" data-r="ans" style="left:150px;top:346px;font-size:78px;color:var(--mint-2)">나중에 쉰 사람 기간만큼만 특례</div>
      <div class="abs" data-r="lm" style="left:150px;top:${YM + 34}px;font-size:38px;font-weight:800">엄마</div>
      <div class="abs" data-r="ld" style="left:150px;top:${YD + 34}px;font-size:38px;font-weight:800">아빠</div>
      <div class="abs" data-r="ring" style="left:${X - 16}px;top:${YM - 16}px;width:${3 * PIT - (PIT - S) + 32}px;height:${YD - YM + S + 32}px;border:7px solid var(--gold);border-radius:34px"></div>
      <div class="abs chip gold" data-r="tagS" style="left:${X - 16}px;top:${YD + S + 34}px;height:54px;font-size:27px;padding:0 20px;background:var(--gold);color:#fff">${icon('sparkles', { size: 28 })}3개월 · 6+6 상한</div>
      <div class="abs chip" data-r="tagG" style="left:${X + 3 * PIT + 20}px;top:${YD + 30}px;height:54px;font-size:27px;padding:0 20px;background:#EEF0F3;color:var(--ink-2)">엄마 4~6개월은 일반 급여</div>
      <div class="card" data-r="doc" style="left:1250px;top:480px;width:520px;height:270px;padding:38px 42px">
        <div class="row" style="gap:12px;font-size:32px;font-weight:800">${icon('file-text', { size: 36 })}아빠 육아휴직급여 신청</div>
        <div class="row" style="gap:12px;margin-top:24px;font-size:28px;font-weight:700;color:var(--ink-2)"><span style="width:34px;height:34px;display:inline-block">${OK_BADGE}</span>아빠 첫 3개월 특례</div>
        <div class="row" data-r="docL2" style="gap:12px;margin-top:14px;font-size:28px;font-weight:700;color:var(--ink-2)"><span style="width:34px;height:34px;display:inline-block">${OK_BADGE}</span>엄마 3개월분 차액 소급</div>
      </div>
      <div class="abs" data-r="coinFly" style="left:0;top:0">${coins(2, 70)}</div>
      <div class="abs chip gold" data-r="retro" style="left:${X + 3 * PIT + 20}px;top:${YM - 66}px;height:54px;font-size:27px;padding:0 20px;box-shadow:var(--shadow-sm)">${icon('coins', { size: 28 })}엄마 차액 소급 지급</div>`);
    const mb = [...Array(6).keys()].map((i) => r[`m${i}`]), db = [...Array(3).keys()].map((i) => r[`d${i}`]);
    c.sfx(c.in + 0.1, 'pop', 0.45);
    c.sfx(A + 0.1, 'click', 0.7);
    for (let i = 0; i < 3; i++) c.sfx(A + 0.7 + i * 0.2, 'tick', 0.4);
    c.sfx(A2 + 0.3, 'pop', 0.5);
    c.sfx(A3 + 0.4, 'whoosh', 0.3);
    c.sfx(A4 + 0.3, 'coin', 0.7);
    return (t) => {
      head(t);
      enter(r.lm, t, Qa + 0.6, { dx: -16, dy: 0 });
      enter(r.ld, t, Qa + 0.8, { dx: -16, dy: 0 });
      mb.forEach((el, i) => {
        let cls = 'coral';
        if (i < 3 && t >= A2 + 0.3 + i * 0.12) cls = 'gold';
        if (i >= 3 && t >= A2 + 1.0) cls = 'gray';
        setCls(el, cls, 'block');
        drop(el, t, Qa + 0.7 + i * 0.07, { h: 80 });
      });
      db.forEach((el, i) => {
        setCls(el, t >= A + 0.7 + i * 0.2 ? 'gold' : 'blue', 'block');
        drop(el, t, Qa + 1.2 + i * 0.1, { h: 34 });
      });
      pop(r.ans, t, A, { s0: 0.8, d: 0.5 });
      pop(r.ring, t, A2 + 0.3, { s0: 0.9 });
      pop(r.tagS, t, A2 + 0.6, {});
      enter(r.tagG, t, A2 + 1.1, { dx: -20, dy: 0 });
      enter(r.doc, t, A3 + 0.1, { dx: 40, dy: 0 });
      enter(r.docL2, t, A3 + 1.2, { dx: 20, dy: 0 });
      const fp = P(t, A4 + 0.1, 0.9, ease.inOutCubic);
      tf(r.coinFly, { x: lerp(1300, X + PIT, fp), y: lerp(640, YM - 40, fp) - Math.sin(fp * Math.PI) * 140, o: fp > 0 && fp < 1 ? 1 : 0 });
      pop(r.retro, t, A4 + 0.9, {});
    };
  },
};

// ------------------------------------------------------------------ 17. 신청 방법 3단계
const steps = {
  id: 'steps',
  build(root, c) {
    const S1 = c.at('p1', 1), S2 = c.at('p1', 2), S3 = c.at('p2'), S4 = c.at('p2', 2);
    const hd = header(root, { y: 140, lines: [{ html: '신청은 <span class="hl-blue">3단계</span>', at: c.in + 0.05 }] });
    const items = [
      { ic: 'briefcase', who: '나 → 회사', title: '휴직 신청', chip: '휴직 시작 30일 전까지', desc: '육아휴직 신청서 제출', at: S1, color: 'blue' },
      { ic: 'file-text', who: '회사 → 고용센터', title: '확인서 제출', chip: '육아휴직 확인서', desc: '회사가 처리합니다', at: S2, color: 'lav' },
      { ic: 'laptop', who: '나 → 고용24', title: '급여 신청', chip: '휴직 1개월 뒤부터', desc: '휴직 종료 후 12개월 안에', at: S3, color: 'mint' },
    ];
    const W = 480, H = 420, X = [150, 720, 1290], Y = 300;
    const card = (k, i) => `
      <div class="abs" data-r="s${i}" style="left:${X[i]}px;top:${Y}px;width:${W}px;height:${H}px">
        <div class="card col center" data-r="f${i}" style="left:0;top:0;width:${W}px;height:${H}px;background:rgba(255,255,255,0.55);border:4px dashed rgba(31,42,55,0.16);box-shadow:none">
          <div class="disp" style="font-size:180px;line-height:1;color:rgba(31,42,55,0.12)">${i + 1}</div>
        </div>
        <div class="card" data-r="b${i}" style="left:0;top:0;width:${W}px;height:${H}px">
          <div class="abs center" style="left:30px;top:30px;width:56px;height:56px;border-radius:28px;background:var(--${k.color});color:#fff;font-size:30px;font-weight:880">${i + 1}</div>
          <div class="abs icon-badge" style="left:${(W - 120) / 2}px;top:52px;width:120px;height:120px;border-radius:36px;background:var(--${k.color}-soft);color:var(--${k.color}-2)">${icon(k.ic, { size: 64 })}</div>
          <div class="abs" style="left:0;top:196px;width:${W}px;text-align:center;font-size:26px;font-weight:700;color:var(--ink-3)">${k.who}</div>
          <div class="abs" style="left:0;top:232px;width:${W}px;text-align:center;font-size:48px;font-weight:840;letter-spacing:-0.035em">${k.title}</div>
          <div class="abs row" style="left:0;top:306px;width:${W}px;justify-content:center"><div class="chip ${k.color}" style="height:52px;font-size:27px;padding:0 22px">${k.chip}</div></div>
          <div class="abs" style="left:0;top:372px;width:${W}px;text-align:center;font-size:24px;font-weight:620;color:var(--ink-3)">${k.desc}</div>
        </div>
      </div>`;
    const arrow = (i) => `<div class="abs center" data-r="a${i}" style="left:${X[i] + W + 2}px;top:${Y + H / 2 - 44}px;width:86px;height:88px;color:#AAB3C0">${icon('arrow-right', { size: 58, stroke: 3 })}</div>`;
    const r = mount(root, `${items.map(card).join('')}${arrow(0)}${arrow(1)}
      <div class="abs row" style="left:0;top:772px;width:1920px;justify-content:center">
        <div class="chip" data-r="warn" style="height:72px;font-size:33px;padding:0 32px;background:var(--red);color:#fff;box-shadow:0 14px 30px rgba(240,82,90,0.28)">${icon('triangle-alert', { size: 36, stroke: 2.4 })}휴직 종료 후 12개월이 지나면 급여를 받을 수 없습니다</div>
      </div>`);
    c.sfx(c.in + 0.3, 'pop', 0.4);
    items.forEach((k) => { c.sfx(k.at, 'whoosh', 0.25); c.sfx(k.at + 0.25, 'pop', 0.5); });
    c.sfx(S4 + 0.3, 'click', 0.7);
    return (t) => {
      hd(t);
      items.forEach((k, i) => {
        enter(r[`s${i}`], t, c.in + 0.2 + i * 0.12, { dy: 50 });
        flip(r[`f${i}`], r[`b${i}`], t, k.at, 0.5);
        const until = i < 2 ? items[i + 1].at : S4;
        const focus = t >= k.at && t < until;
        r[`b${i}`].style.boxShadow = focus ? `0 0 0 5px var(--${k.color}), var(--shadow)` : 'var(--shadow)';
        r[`s${i}`].style.zIndex = focus ? 2 : 1;
        const sc = 1 + 0.035 * (focus ? P(t, k.at + 0.4, 0.4) : 0);
        r[`s${i}`].style.transform += ` scale(${sc.toFixed(4)})`;
      });
      enter(r.a0, t, S2 - 0.3, { dx: -16, dy: 0 });
      enter(r.a1, t, S3 - 0.3, { dx: -16, dy: 0 });
      pop(r.warn, t, S4 + 0.3, {});
    };
  },
};

// ------------------------------------------------------------------ 14. 3줄 요약
const summary = {
  id: 'summary',
  build(root, c) {
    const items = [
      { color: 'mint', ic: 'calendar-plus', title: '기간 <span class="hl-mint">최대 1년 6개월</span>', sub: '엄마·아빠 각각 3개월 이상 (한부모·중증 장애아동 부모 포함) · 부부 최대 3년', at: c.at('u1') },
      { color: 'gold', ic: 'coins', title: '6+6: 첫 6개월 <span class="hl-gold">최대 월 450만 원</span>', sub: '생후 18개월 전 부모 모두 휴직 시작 · 통상임금 100% · 1인 최대 2,000만 원', at: c.at('u2') },
      { color: 'blue', ic: 'laptop', title: '휴직은 <span class="hl-blue">30일 전</span> 회사에 · 급여는 <span class="hl-blue">고용24</span>', sub: '급여는 휴직이 끝난 뒤 12개월 안에 신청해야 합니다', at: c.at('u3') },
    ];
    const hd = header(root, { y: 130, lines: [{ html: '<span class="hl-blue">3줄</span> 요약', at: c.in }] });
    const Y = [290, 490, 690];
    const col2 = (k) => (k.color === 'gold' ? 'gold-2' : k.color === 'blue' ? 'blue-2' : 'mint-2');
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

// ------------------------------------------------------------------ 15. 아웃트로: 상담 안내 + 다음 영상 예고
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
        <div style="margin-top:26px;font-size:32px;font-weight:720;color:var(--ink-2)">급여 신청 · 모의계산</div>
        <div class="disp" style="margin-top:6px;font-size:100px;color:var(--mint-2)">고용24</div>
        <div style="font-size:26px;font-weight:650;color:var(--ink-3)">www.work24.go.kr</div>
      </div>
      <div class="abs chip gold" data-r="nx" style="left:150px;top:210px;height:62px;font-size:32px;padding:0 26px;background:var(--gold);color:#fff">${icon('bell', { size: 32 })}다음 영상</div>
      <div class="abs disp" data-r="nt" style="left:150px;top:300px;font-size:116px">1주·2주 <span class="hl-gold">단기 육아휴직</span></div>
      <div class="abs" data-r="ns" style="left:154px;top:450px;font-size:36px;font-weight:700;color:var(--ink-2)">2026년 8월 20일 시행 · 연 1회 · 나눠 쓰는 횟수에 포함되지 않습니다</div>
      <div class="block gold" data-r="w1" style="left:1440px;top:250px;width:150px;height:150px;border-radius:32px;display:flex;align-items:center;justify-content:center"><span class="disp" style="font-size:50px;color:#7A4A00">1주</span></div>
      <div class="block blue" data-r="w2" style="left:1610px;top:250px;width:150px;height:150px;border-radius:32px;display:flex;align-items:center;justify-content:center"><span class="disp" style="font-size:50px;color:#fff">2주</span></div>
      <div class="abs" data-r="fam" style="left:150px;top:560px">${family(420)}</div>
      <div class="abs row" data-r="btns" style="left:700px;top:660px;gap:28px">
        <div class="row" data-r="sub" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#F0525A;color:#fff;font-size:40px;font-weight:840;box-shadow:0 16px 36px rgba(240,82,90,0.3)">${icon('bell', { size: 42, stroke: 2.4 })}<span data-r="subTxt">구독</span></div>
        <div class="row" style="gap:14px;height:92px;padding:0 42px;border-radius:46px;background:#fff;color:var(--ink);font-size:40px;font-weight:840;box-shadow:var(--shadow)">${icon('thumbs-up', { size: 42, stroke: 2.4 })}좋아요</div>
      </div>
      <div class="abs col center" data-r="disc" style="left:0;top:862px;width:1920px;font-size:24px;font-weight:600;color:var(--ink-3);line-height:1.6">
        <div>본 영상은 2026년 9월 기준 정보입니다. 개인별 적용 여부는 고용노동부(☎1350)·고용24에서 확인하시기 바랍니다.</div>
        <div>참고: 남녀고용평등과 일·가정 양립 지원에 관한 법률 · 고용보험법 시행령 · 고용노동부 안내</div>
      </div>`);
    const out1 = O2 - 0.3;
    const tClick = O2b + 0.9;
    c.sfx(O1 + 0.2, 'pop', 0.5);
    c.sfx(O1 + 0.5, 'pop', 0.5);
    c.sfx(O2 + 0.2, 'ding', 0.5);
    c.sfx(O2 + 0.9, 'pop', 0.45);
    c.sfx(tClick, 'click', 0.8);
    c.sfx(tClick + 0.6, 'sparkle', 0.45);
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

const cover = coverScene({ n: 1, title: '육아휴직 6개월 연장 & 6+6' });

export const scenes = [cover, intro, basic, conditions, both, concept66, stairsScene, example, table, qa1, qa2, qa3, qa4, steps, summary, outro];
