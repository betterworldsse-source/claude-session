// 1화: 육아휴직 1년 6개월 & 6+6 부모육아휴직제 — 장면 정의
// 각 장면은 build(root, ctx)에서 DOM을 만들고, 시간 t를 받는 update 함수를 돌려줍니다.
// ctx.at('문장id', k) = 해당 문장의 k번째 자막 청크가 시작되는 시각(초)
import { ease, P, clamp, lerp, wave, mount, tf, opacity, enter, pop, rise, countTo, prepDraw, draw, icon } from '../../engine/web/engine.js';
import { mom, dad, avatar, family, blink, coins } from '../../engine/web/art.js';

export const chapters = {
  1: { label: 'PART 1', title: '기간', sub: '육아휴직 1년 6개월', short: '기간', color: 'mint', icon: 'calendar-plus', card: ['#2DBFA4', '#138C78'] },
  2: { label: 'PART 2', title: '급여', sub: '6+6 부모육아휴직제', short: '급여', color: 'gold', icon: 'coins', card: ['#F9A12B', '#E0700A'] },
  3: { label: 'PART 3', title: '함께 쓰면?', sub: '두 제도 한 번에 적용하기', short: '예시', color: 'lav', icon: 'users', card: ['#9384F7', '#6150DE'] },
  4: { label: '요약', title: '3줄 요약', sub: '오늘 내용 한눈에', short: '요약', color: 'blue', icon: 'list-checks', card: null },
};

// ------------------------------------------------------------------ 공용 조각

/** 가운데 정렬 헤더(작은 라벨 + 큰 제목). lines: [{html, at}] 순서대로 교체 */
function header(root, { y = 128, eyebrow = null, eyeAt = null, lines }) {
  const r = mount(root, `
    <div class="abs col" style="left:0;top:${y}px;width:1920px;align-items:center">
      ${eyebrow ? `<div class="eyebrow" data-r="hdEye">${eyebrow}</div>` : ''}
      <div style="position:relative;height:92px;width:1920px;margin-top:${eyebrow ? 20 : 0}px">
        ${lines.map((l, i) => `<div class="abs" style="left:0;top:0;width:1920px;height:92px;overflow:hidden;text-align:center"><div class="h1" data-r="hdL${i}">${l.html}</div></div>`).join('')}
      </div>
    </div>`);
  return (t) => {
    if (r.hdEye) enter(r.hdEye, t, eyeAt ?? lines[0].at - 0.15, { dy: 16, s0: 0.9 });
    lines.forEach((l, i) => {
      const next = lines[i + 1];
      rise(r[`hdL${i}`], t, l.at, { out: next ? next.at - 0.05 : null, od: 0.35 });
    });
  };
}

/** 월 타일 줄. 타일 요소 배열을 돌려줌 */
function tileRow(parent, { x, y, n, cls = 'mint', size = 58, gap = 12, ref, content = () => '' }) {
  let html = `<div class="abs" data-r="${ref}" style="left:${x}px;top:${y}px;width:${n * size + (n - 1) * gap}px;height:${size}px">`;
  for (let i = 0; i < n; i++) {
    const c = typeof cls === 'function' ? cls(i) : cls;
    html += `<div class="tile ${c}" data-r="${ref}_${i}" style="left:${i * (size + gap)}px;top:0;width:${size}px;height:${size}px">${content(i)}</div>`;
  }
  html += '</div>';
  const r = mount(parent, html);
  return Array.from({ length: n }, (_, i) => r[`${ref}_${i}`]);
}

const setCls = (el, cls) => { const c = `tile ${cls}`; if (el.className !== c) el.className = c; };
const setHtml = (el, h) => { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } };
const LOCK = icon('lock', { size: 24, stroke: 2.4 });
const OPEN = icon('lock-open', { size: 24, stroke: 2.4 });
const CHECK = icon('check', { size: 30, stroke: 3.4 });

/** 폭을 늘려가며 나타나는 막대 */
function growW(el, t, t0, d, w, e = ease.inOutCubic) {
  const p = P(t, t0, d, e);
  el.style.width = `${(w * p).toFixed(1)}px`;
  opacity(el, p > 0 ? 1 : 0);
  return p;
}

/** 카드 뒤집기(가로 스쿼시)로 앞/뒷면 교체 */
function flip(front, back, t, t0, d = 0.5) {
  const p = clamp((t - t0) / d);
  const k = Math.abs(Math.cos(Math.PI * p));
  const showBack = p >= 0.5;
  tf(front, { sx: showBack ? 1 : Math.max(0.001, k), o: showBack ? 0 : 1 });
  tf(back, { sx: showBack ? Math.max(0.001, k) : 1, o: showBack ? 1 : 0 });
}

// ------------------------------------------------------------------ 1. 훅
const hook = {
  id: 'hook',
  build(root, c) {
    const T2 = c.at('h2'), T2b = c.at('h2', 1), T3 = c.at('h3'), T3b = c.at('h3', 1), T4 = c.at('h4'), T4b = c.at('h4', 1);
    const hd = header(root, {
      y: 150,
      lines: [
        { html: '육아휴직은 <span class="hl-mint">1년</span>이 끝일까요?', at: 0.12 },
        { html: '조건만 맞으면 <span class="hl-gold">최대 1년 6개월</span>', at: T2 },
        { html: '맞벌이 부부 합산 <span class="hl-gold">최대 3년</span>', at: T2b },
        { html: '함께 쓰면 <span class="hl-gold">첫 6개월 급여</span>도 UP', at: T3 },
        { html: '가장 헷갈리는 두 제도, <span class="hl-mint">5분 정리</span>', at: T4 },
      ],
    });

    const S = 64, G = 12;
    const rowW = 18 * S + 17 * G;
    const X0 = Math.round((1920 - (96 + rowW + 30 + 170)) / 2) + 96;
    const g = mount(root, `
      <div class="abs" data-r="tiles" style="left:0;top:0;width:1920px;height:1080px">
        <div class="abs" data-r="av1" style="left:${X0 - 100}px;top:-12px">${avatar('mom', 88)}</div>
        <div class="abs" data-r="av2" style="left:${X0 - 100}px;top:-12px">${avatar('dad', 88)}</div>
        <div class="abs center" data-r="lbl1" style="left:0;top:580px;width:1920px;height:60px;font-size:36px;font-weight:750;color:var(--ink-2)">기본 <span class="hl-mint" style="margin:0 8px">1년</span> = 12개월</div>
        <div class="abs center" data-r="lbl2" style="left:0;top:580px;width:1920px;height:60px;font-size:36px;font-weight:750;color:var(--ink-2)">조건 충족 시 <span class="hl-gold" style="margin:0 8px">+6개월</span> = 최대 18개월</div>
        <div class="abs row" data-r="bracket" style="left:${X0 + rowW + 22}px;top:0;height:188px;gap:16px">
          <svg width="30" height="188" viewBox="0 0 30 188"><path d="M4 4 Q26 4 26 32 L26 78 Q26 94 12 94 Q26 94 26 110 L26 156 Q26 184 4 184" fill="none" stroke="#F5A524" stroke-width="5" stroke-linecap="round"/></svg>
          <div class="chip gold" style="height:66px;font-size:34px">최대 3년</div>
        </div>
      </div>`);
    const row1 = tileRow(g.tiles, { x: X0, y: 0, n: 18, size: S, gap: G, cls: (i) => (i < 12 ? 'mint' : 'gold'), ref: 'r1' });
    const row2 = tileRow(g.tiles, { x: X0, y: 0, n: 18, size: S, gap: G, cls: (i) => (i < 12 ? 'mint' : 'gold'), ref: 'r2' });
    const box1 = row1[0].parentElement, box2 = row2[0].parentElement;
    for (let i = 0; i < 12; i++) c.sfx(0.9 + i * 0.1, 'tick', 0.3);
    c.sfx(T2 + 0.3, 'sparkle', 0.6);
    c.sfx(T2b + 0.1, 'whoosh', 0.3);
    c.sfx(T2b + 0.95, 'ding', 0.5);

    const m = mount(root, `
      <div class="abs" data-r="momBig" style="left:170px;top:360px">${mom({ w: 300 })}</div>
      <div class="abs" data-r="dadBig" style="left:1450px;top:360px">${dad({ w: 300 })}</div>
      <div class="card col" data-r="moneyCard" style="left:540px;top:318px;width:840px;height:420px;align-items:center;justify-content:center">
        <div class="chip gold">${icon('users', { size: 30 })}엄마·아빠가 함께 쓰면</div>
        <div class="h3" style="margin-top:26px;color:var(--ink-2)">첫 6개월 육아휴직 급여</div>
        <div class="row" style="margin-top:6px;gap:14px;align-items:baseline">
          <span style="font-size:44px;font-weight:750;color:var(--ink-2)">최대</span>
          <span class="num" data-r="money" style="font-size:150px;font-weight:880;letter-spacing:-0.04em;color:var(--gold-2);line-height:1.05">0</span>
          <span style="font-size:60px;font-weight:820;color:var(--gold-2)">만 원</span>
        </div>
        <div class="small" style="margin-top:4px">1인 기준 · 통상임금 100%, 월 상한 적용</div>
      </div>
      <div class="abs" data-r="coinL" style="left:560px;top:700px">${coins(4, 110)}</div>
      <div class="abs" data-r="coinR" style="left:1250px;top:680px">${coins(5, 110)}</div>`);
    c.sfx(T3 + 0.2, 'pop', 0.55);
    c.sfx(T3b + 1.6, 'coin', 0.75);

    const q = mount(root, `
      <div class="card col" data-r="qa" style="left:430px;top:330px;width:500px;height:330px;align-items:center;justify-content:center">
        <div class="icon-badge" style="width:120px;height:120px;background:var(--mint-soft);color:var(--mint)">${icon('calendar-plus', { size: 64 })}</div>
        <div class="h2" style="margin-top:26px">육아휴직 <span class="hl-mint">1년 6개월</span></div>
      </div>
      <div class="card col" data-r="qb" style="left:990px;top:330px;width:500px;height:330px;align-items:center;justify-content:center">
        <div class="icon-badge" style="width:120px;height:120px;background:var(--gold-soft);color:var(--gold-2)">${icon('coins', { size: 64 })}</div>
        <div class="h2" style="margin-top:26px"><span class="hl-gold">6+6</span> 부모육아휴직제</div>
      </div>
      <div class="abs center" data-r="qmark" style="left:900px;top:250px;width:120px;height:120px;border-radius:60px;background:var(--coral);color:#fff;font-size:76px;font-weight:900;box-shadow:var(--shadow)">?</div>
      <div class="abs row" data-r="timer" style="left:748px;top:720px;gap:16px;height:86px;padding:0 36px;border-radius:43px;background:var(--ink);color:#fff;font-size:40px;font-weight:800">
        ${icon('timer', { size: 44, stroke: 2.4 })}<span>5분 정리 시작!</span>
      </div>`);
    c.sfx(T4 + 0.1, 'pop', 0.55);
    c.sfx(T4 + 0.35, 'pop', 0.45);
    c.sfx(T4b + 0.1, 'click', 0.8);

    return (t) => {
      hd(t);
      const twoRows = P(t, T2b, 0.8, ease.inOutCubic);
      const yRow1 = lerp(480, 420, twoRows);
      tf(box1, { y: yRow1 });
      tf(box2, { y: 516 });
      const extra = P(t, T2, 0.7, ease.inOutCubic);
      const shift12 = 960 - (X0 + (12 * S + 11 * G) / 2); // 12칸만 있을 때 화면 중앙
      const shift18 = 960 - (X0 + rowW / 2);               // 18칸만 있을 때 화면 중앙
      const shiftX = lerp(lerp(shift12, shift18, extra), 0, twoRows);
      const tilesOut = T3 - 0.4;
      row1.forEach((el, i) => {
        const t0 = i < 12 ? 0.9 + i * 0.1 : T2 + 0.2 + (i - 12) * 0.08;
        enter(el, t, t0, { x: shiftX, dy: 26, s0: 0.5, d: 0.5, e: ease.outBack, out: tilesOut, od: 0.35 });
      });
      row2.forEach((el, i) => enter(el, t, T2b + 0.15 + i * 0.035, { dy: 30, s0: 0.5, d: 0.5, e: ease.outBack, out: tilesOut, od: 0.35 }));
      enter(g.av1, t, T2b + 0.05, { y: yRow1, dx: -30, dy: 0, out: tilesOut });
      enter(g.av2, t, T2b + 0.2, { y: 516, dx: -30, dy: 0, out: tilesOut });
      enter(g.lbl1, t, 2.1, { dy: 14, out: T2 + 0.1, od: 0.3 });
      enter(g.lbl2, t, T2 + 0.45, { dy: 14, out: T2b - 0.1, od: 0.3 });
      enter(g.bracket, t, T2b + 0.8, { y: 408, dx: -20, dy: 0, out: tilesOut });

      const moneyOut = T4 - 0.35;
      enter(m.moneyCard, t, T3 + 0.1, { dy: 50, out: moneyOut });
      enter(m.momBig, t, T3 + 0.25, { dx: -60, dy: 0, out: moneyOut, r: wave(t, 3.2, 2) });
      enter(m.dadBig, t, T3 + 0.35, { dx: 60, dy: 0, out: moneyOut, r: wave(t, 3.6, -2) });
      enter(m.coinL, t, T3b + 0.2, { dy: 40, out: moneyOut });
      enter(m.coinR, t, T3b + 0.35, { dy: 40, out: moneyOut });
      countTo(m.money, t, T3b - 0.1, 1.8, 0, 2000);
      blink(m.momBig, t, 1);
      blink(m.dadBig, t, 2);

      enter(q.qa, t, T4 + 0.05, { dx: -40, dy: 20, r0: -4 });
      enter(q.qb, t, T4 + 0.3, { dx: 40, dy: 20, r0: 4 });
      pop(q.qmark, t, T4 + 0.55, { r: wave(t, 1.6, 6) });
      pop(q.timer, t, T4b, {});
    };
  },
};

// ------------------------------------------------------------------ 2. 타이틀
const title = {
  id: 'title',
  build(root, c) {
    const T = c.start;
    const r = mount(root, `
      <div class="abs col" style="left:150px;top:250px;width:1060px">
        <div data-r="eye" class="eyebrow" style="align-self:flex-start">${icon('calendar-check', { size: 28 })}2026년 9월 기준 · 예비·초보 부모 필수</div>
        <div style="overflow:hidden;height:124px;margin-top:34px"><div data-r="l1" style="font-size:104px;font-weight:880;letter-spacing:-0.045em;line-height:1.15;white-space:nowrap">육아휴직 <span class="hl-mint">1년 6개월</span></div></div>
        <div style="overflow:hidden;height:124px;margin-top:4px"><div data-r="l2" style="font-size:104px;font-weight:880;letter-spacing:-0.045em;line-height:1.15;white-space:nowrap"><span style="color:var(--ink-3);font-weight:700">&amp;</span> <span class="hl-gold">6+6</span> 부모육아휴직제</div></div>
        <div data-r="tag" style="margin-top:34px;font-size:42px;font-weight:650;color:var(--ink-2)">헷갈리는 <span class="mark">조건</span>과 <span class="mark">급여</span>, 한 번에 정리</div>
      </div>
      <div class="abs" data-r="fam" style="left:1160px;top:300px">${family(680)}</div>`);
    c.sfx(T - 0.7, 'swell', 0.55);
    c.sfx(T + 0.15, 'ding', 0.55);
    return (t) => {
      enter(r.eye, t, T + 0.05, { dy: 20 });
      rise(r.l1, t, T + 0.15);
      rise(r.l2, t, T + 0.35);
      enter(r.tag, t, T + 0.75, { dy: 20 });
      enter(r.fam, t, T + 0.3, { dy: 60, s0: 0.85, y: wave(t, 3, 6) });
      blink(r.fam, t, 3);
    };
  },
};

// ------------------------------------------------------------------ 3. 로드맵
const roadmap = {
  id: 'roadmap',
  build(root, c) {
    const T1 = c.at('r1'), T2 = c.at('r2'), T2b = c.at('r2', 1);
    const hd = header(root, {
      y: 140,
      lines: [
        { html: '둘 다 <span class="hl-coral">‘6’</span>이 들어가서 헷갈리죠?', at: Math.max(c.in, T1 - 0.2) },
        { html: '하나는 <span class="hl-mint">기간</span>, 하나는 <span class="hl-gold">급여</span>!', at: T2 },
      ],
    });
    const six = (id) => `<span style="position:relative;display:inline-block">6<svg class="abs" style="left:-26px;top:-12px;overflow:visible" width="80" height="84" viewBox="0 0 80 84"><path data-r="${id}" d="M40 6 C18 4 4 22 6 44 C8 68 28 80 46 78 C66 76 78 58 76 38 C74 18 58 6 36 8" fill="none" stroke="#F0525A" stroke-width="5" stroke-linecap="round"/></svg></span>`;
    const card = (ref, x, color, iconName, titleHtml, tag, desc, sub) => `
      <div class="card" data-r="${ref}" style="left:${x}px;top:290px;width:760px;height:470px">
        <div class="abs" style="left:0;top:58px;width:760px;text-align:center;font-size:54px;font-weight:840;letter-spacing:-0.035em">${titleHtml}</div>
        <div class="abs" style="left:60px;right:60px;top:160px;height:3px;background:var(--line);border-radius:2px"></div>
        <div class="abs row" data-r="${ref}In" style="left:64px;top:210px;gap:34px">
          <div class="icon-badge" style="width:150px;height:150px;border-radius:40px;background:var(--${color}-soft);color:var(--${color === 'gold' ? 'gold-2' : color})">${icon(iconName, { size: 84, stroke: 2 })}</div>
          <div class="col" style="gap:14px">
            <div class="chip ${color}" style="align-self:flex-start;height:62px;font-size:34px;padding:0 26px">${tag}</div>
            <div style="font-size:38px;font-weight:780;letter-spacing:-0.03em">${desc}</div>
            <div style="font-size:28px;font-weight:600;color:var(--ink-3)">${sub}</div>
          </div>
        </div>
      </div>`;
    const r = mount(root, `
      ${card('ca', 170, 'mint', 'calendar-plus', `육아휴직 1년 ${six('c1')}개월`, '기간 ↑', '휴직 <span class="hl-mint">기간</span>이 늘어나요', '기본 1년 → 최대 1년 6개월')}
      ${card('cb', 990, 'gold', 'coins', `${six('c2')}+${six('c3')} 부모육아휴직제`, '급여 ↑', '휴직 <span class="hl-gold">급여</span>가 늘어나요', '첫 6개월 통상임금 100%')}
      <div class="abs center" data-r="vs" style="left:902px;top:480px;width:116px;height:116px;border-radius:58px;background:var(--ink);color:#fff;font-size:44px;font-weight:880;box-shadow:var(--shadow)">VS</div>`);
    ['c1', 'c2', 'c3'].forEach((k) => prepDraw(r[k]));
    c.sfx(T1 + 0.9, 'click', 0.7);
    c.sfx(T2 + 0.2, 'pop', 0.55);
    c.sfx(T2b + 0.2, 'pop', 0.55);
    return (t) => {
      hd(t);
      enter(r.ca, t, c.in, { dx: -50, dy: 30 });
      enter(r.cb, t, c.in + 0.15, { dx: 50, dy: 30 });
      draw(r.c1, t, T1 + 0.9, 0.55);
      draw(r.c2, t, T1 + 1.15, 0.55);
      draw(r.c3, t, T1 + 1.35, 0.55);
      enter(r.caIn, t, T2, { dy: 24 });
      enter(r.cbIn, t, T2b, { dy: 24 });
      pop(r.vs, t, T2 - 0.1, { r: wave(t, 2.4, 4) });
    };
  },
};

// ------------------------------------------------------------------ PART 1 공용: 엄마/아빠 타일 줄
const RS = 58, RG = 12;
const ROW_X = 300;
function parentRows(root, { n = 18, y1, y2, prefix, labels = true }) {
  const r = mount(root, `
    <div class="abs" data-r="${prefix}Av1" style="left:${ROW_X - 118}px;top:${y1 - 16}px">${avatar('mom', 90)}</div>
    <div class="abs" data-r="${prefix}Av2" style="left:${ROW_X - 118}px;top:${y2 - 16}px">${avatar('dad', 90)}</div>
    ${labels ? `<div class="abs" data-r="${prefix}Lb1" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y1 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>
    <div class="abs" data-r="${prefix}Lb2" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y2 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>` : ''}`);
  const a = tileRow(root, { x: ROW_X, y: y1, n, size: RS, gap: RG, cls: 'empty', ref: `${prefix}A` });
  const b = tileRow(root, { x: ROW_X, y: y2, n, size: RS, gap: RG, cls: 'empty', ref: `${prefix}B` });
  return { ...r, a, b, av1: r[`${prefix}Av1`], av2: r[`${prefix}Av2`], lb1: r[`${prefix}Lb1`], lb2: r[`${prefix}Lb2`] };
}

// ------------------------------------------------------------------ 4. 기본 1년 → 최대 1년 6개월
const basic = {
  id: 'basic',
  build(root, c) {
    const T1b = c.at('b1', 1), T1c = c.at('b1', 2), T2 = c.at('b2'), T2b = c.at('b2', 1);
    const hd = header(root, {
      y: 140,
      eyebrow: `${icon('baby', { size: 28 })}자녀 1명당 · 부모 각자`,
      eyeAt: c.in + 0.1,
      lines: [
        { html: '육아휴직, 기본은 <span class="hl-mint">1년</span>', at: c.in + 0.2 },
        { html: '조건 충족 시 <span class="hl-gold">최대 1년 6개월</span>', at: T2b },
      ],
    });
    const box = mount(root, '<div class="card" data-r="box" style="left:150px;top:380px;width:1620px;height:380px"></div>').box;
    const rows = parentRows(root, { y1: 470, y2: 620, prefix: 'p' });
    const stamp = mount(root, `
      <div class="abs col center" data-r="stamp" style="left:1420px;top:282px;width:250px;height:120px;border-radius:22px;border:5px solid var(--coral);color:var(--coral-2);background:rgba(255,255,255,0.9);font-weight:880">
        <div style="font-size:26px;letter-spacing:0.02em">2025. 2. 23.</div><div style="font-size:40px;letter-spacing:0.1em">시행</div>
      </div>`).stamp;
    for (let i = 0; i < 12; i++) { c.sfx(T1b + 0.1 + i * 0.07, 'tick', 0.22); c.sfx(T1c + 0.1 + i * 0.07, 'tick', 0.22); }
    c.sfx(T2 + 0.3, 'pop', 0.7);
    c.sfx(T2b + 0.3, 'sparkle', 0.55);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(rows.av1, t, c.in + 0.2, { dx: -24, dy: 0 });
      enter(rows.av2, t, c.in + 0.3, { dx: -24, dy: 0 });
      const fill = (arr, t0, color) => arr.forEach((el, i) => {
        if (i < 12) {
          const on = t >= t0 + i * 0.07;
          setCls(el, on ? color : 'empty');
          enter(el, t, c.in + 0.25 + i * 0.015, { dy: 16, s: on ? 1 + 0.12 * (1 - P(t, t0 + i * 0.07, 0.3)) : 1 });
        } else {
          setCls(el, 'locked');
          setHtml(el, LOCK);
          enter(el, t, T2b + 0.2 + (i - 12) * 0.06, { dy: 20, s0: 0.4, e: ease.outBack });
        }
      });
      fill(rows.a, T1b + 0.1, 'coral');
      fill(rows.b, T1c + 0.1, 'blue');
      const l1 = t < T2b + 0.2 ? '<span class="hl-coral">엄마 1년</span>' : '<span class="hl-gold">1년 6개월</span>';
      const l2 = t < T2b + 0.2 ? '<span class="hl-blue">아빠 1년</span>' : '<span class="hl-gold">1년 6개월</span>';
      setHtml(rows.lb1, l1);
      setHtml(rows.lb2, l2);
      // 라벨: 12칸 뒤 → 18칸 뒤로 이동
      const lx = lerp(-6 * (RS + RG), 0, P(t, T2b + 0.1, 0.6, ease.inOutCubic));
      enter(rows.lb1, t, T1b + 1.0, { x: lx, dx: -16, dy: 0 });
      enter(rows.lb2, t, T1c + 1.0, { x: lx, dx: -16, dy: 0 });
      pop(stamp, t, T2 + 0.3, { r: -8, s0: 1.8, e: ease.outCubic, d: 0.35 });
    };
  },
};

// ------------------------------------------------------------------ 5. 추가 6개월 조건 3가지
const conditions = {
  id: 'conditions',
  build(root, c) {
    const T1 = c.at('c1'), T2 = c.at('c2'), T2b = c.at('c2', 1), T3 = c.at('c3'), T4 = c.at('c4');
    const hd = header(root, {
      y: 128,
      eyebrow: `${icon('key-round', { size: 28 })}+6개월 여는 열쇠`,
      eyeAt: T1 - 0.2,
      lines: [{ html: '추가 조건은 <span class="hl-gold">셋 중 하나</span>만!', at: T1 - 0.1 }],
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
          <div style="margin-top:26px;font-size:40px;font-weight:820;color:var(--ink-3)">조건 ${k.n}</div>
        </div>
        <div class="card col" data-r="k${i}b" style="left:0;top:0;width:${W}px;height:500px;align-items:center;padding-top:40px">
          <div class="abs center" style="left:28px;top:28px;width:60px;height:60px;border-radius:30px;background:var(--${k.color});color:#fff;font-size:32px;font-weight:880">${k.n}</div>
          <div style="height:130px;display:flex;align-items:center">${k.art}</div>
          <div style="margin-top:26px;font-size:44px;font-weight:840;letter-spacing:-0.035em;white-space:nowrap">${k.title}</div>
          <div style="margin-top:18px;font-size:30px;font-weight:600;line-height:1.45;color:var(--ink-2);text-align:center">${k.desc}</div>
        </div>
      </div>`).join(''));
    const opens = [T2 + 0.1, T3, T4];
    opens.forEach((o) => { c.sfx(o, 'whoosh', 0.25); c.sfx(o + 0.25, 'pop', 0.5); });
    return (t) => {
      hd(t);
      cards.forEach((k, i) => {
        enter(r[`k${i}`], t, T1 + 0.2 + i * 0.15, { dy: 50 });
        flip(r[`k${i}f`], r[`k${i}b`], t, opens[i], 0.5);
        // 현재 설명 중인 카드 강조
        const focus = i === 0 ? (t >= T2 && t < T3 ? 1 : 0) : i === 1 ? (t >= T3 && t < T4 ? 1 : 0) : (t >= T4 && t < c.end - 1.2 ? 1 : 0);
        const any = t >= T2 && t < c.end - 1.2;
        const k2 = r[`k${i}b`];
        k2.style.boxShadow = focus ? `0 0 0 5px var(--${k.color}), var(--shadow)` : 'var(--shadow)';
        const dimmed = any && !focus && t >= opens[i] + 0.5;
        r[`k${i}`].style.filter = dimmed ? 'saturate(0.6)' : 'none';
        r[`k${i}`].style.zIndex = focus ? 2 : 1;
        const sc = 1 + 0.035 * (focus ? P(t, opens[i] + 0.4, 0.4) : 0);
        r[`k${i}`].style.transform += ` scale(${sc.toFixed(4)})`;
      });
    };
  },
};

// ------------------------------------------------------------------ 6. 부모 각각 3개월 → 둘 다 1년 6개월 → 부부 3년
const both = {
  id: 'both',
  build(root, c) {
    const T2 = c.at('d2'), T2b = c.at('d2', 1), T3b = c.at('d3', 1);
    const tDadDone = T2 + (T2b - T2) * 0.5;
    const hd = header(root, {
      y: 140,
      eyebrow: `<span class="chip mint" style="height:38px;font-size:22px;padding:0 14px">조건 1</span>가장 많이 해당돼요`,
      eyeAt: c.in + 0.1,
      lines: [
        { html: '엄마 <span class="hl-coral">3개월</span> + 아빠 <span class="hl-blue">3개월</span> 이상이면?', at: c.in + 0.15 },
        { html: '두 사람 모두 <span class="hl-gold">1년 6개월</span>로!', at: T2b },
        { html: '맞벌이 부부 합산 <span class="hl-gold">최대 3년</span>', at: T3b },
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
    for (let i = 0; i < 3; i++) { c.sfx(T2 + 0.1 + i * 0.12, 'tick', 0.35); c.sfx(tDadDone - 0.3 + i * 0.12, 'tick', 0.35); }
    c.sfx(T2b + 0.15, 'sparkle', 0.65);
    c.sfx(T3b + 0.1, 'ding', 0.6);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(rows.av1, t, c.in + 0.2, { dx: -24, dy: 0 });
      enter(rows.av2, t, c.in + 0.3, { dx: -24, dy: 0 });
      const unlock = T2b + 0.1;
      const paint = (arr, tUse, color, soft) => arr.forEach((el, i) => {
        let cls = 'empty', html = '';
        if (i < 3) { if (t >= tUse + i * 0.12) { cls = color; html = CHECK; } }
        else if (i < 12) { if (t >= unlock + 0.3) cls = soft; }
        else { cls = t >= unlock + (i - 12) * 0.07 ? 'gold' : 'locked'; html = cls === 'gold' ? '' : LOCK; }
        setCls(el, cls);
        setHtml(el, html);
        const bump = i < 3 ? 0.14 * (1 - P(t, tUse + i * 0.12, 0.35)) * (t >= tUse + i * 0.12 ? 1 : 0) : 0;
        const bump2 = i >= 12 ? 0.18 * (1 - P(t, unlock + (i - 12) * 0.07, 0.35)) * (t >= unlock + (i - 12) * 0.07 ? 1 : 0) : 0;
        enter(el, t, c.in + 0.25 + i * 0.015, { dy: 16, s: 1 + bump + bump2 });
      });
      paint(rows.a, T2 + 0.1, 'coral', 'coral-soft');
      paint(rows.b, tDadDone - 0.3, 'blue', 'blue-soft');
      rows.a.forEach((el, i) => { if (i >= 3 && i < 12 && t >= unlock + 0.3) el.style.background = '#FFD9CF'; else if (i >= 3 && i < 12) el.style.background = ''; });
      rows.b.forEach((el, i) => { if (i >= 3 && i < 12 && t >= unlock + 0.3) el.style.background = '#D3E2FF'; else if (i >= 3 && i < 12) el.style.background = ''; });
      setHtml(rows.lb1, t < unlock ? '<span style="color:var(--ink-3)">1년</span>' : '<span class="hl-gold">1년 6개월</span>');
      setHtml(rows.lb2, t < unlock ? '<span style="color:var(--ink-3)">1년</span>' : '<span class="hl-gold">1년 6개월</span>');
      enter(rows.lb1, t, c.in + 0.5, { dx: -16, dy: 0 });
      enter(rows.lb2, t, c.in + 0.6, { dx: -16, dy: 0 });
      pop(k.ck1, t, T2 + 0.35, { e: ease.outBack });
      pop(k.ck2, t, tDadDone, { e: ease.outBack });
      enter(k.line3, t, T2 + 0.2, { dy: 0, s0: 1, o: 0.8 });
      enter(k.total, t, T3b + 0.05, { dy: 30, s0: 0.8, e: ease.outBack });
    };
  },
};

// ------------------------------------------------------------------ 7. 자주 묻는 질문
const faq = {
  id: 'faq',
  build(root, c) {
    const T1 = c.at('f1');
    const qs = [
      {
        q: '배우자가 <b>자영업자·전업주부</b>라면?',
        hint: '배우자가 근로자가 아니라 육아휴직을 쓸 수 없는 경우',
        a: '<span style="color:var(--red)">조건 1 불가</span> → 기본 1년',
        sub: '한부모·중증 장애아동 부모는 1년 6개월 가능',
        ic: 'briefcase', color: 'coral', tq: c.at('f2'), ta: c.at('f2', 1),
      },
      {
        q: '이미 <b>1년을 다 썼다면?</b>',
        hint: '2025년 2월 23일 이전에 1년을 모두 사용한 경우 포함',
        a: '조건 충족 시 <span class="hl-mint">6개월 추가</span> 가능',
        sub: '단, 자녀가 만 8세 이하 · 초등 2학년 이하일 때',
        ic: 'rotate-ccw', color: 'mint', tq: c.at('f3'), ta: c.at('f3', 1),
      },
      {
        q: '추가 6개월, <b>언제 신청</b>하나요?',
        hint: '배우자의 육아휴직 사용 내역을 증빙으로 제출',
        a: '배우자 <span class="hl-blue">3개월 사용 확인 후</span> 신청',
        sub: '휴직 순서를 미리 계획해 두세요',
        ic: 'calendar-check', color: 'blue', tq: c.at('f4'), ta: c.at('f4', 1),
      },
    ];
    const hd = header(root, {
      y: 120,
      eyebrow: `${icon('message-circle-question', { size: 28 })}헷갈리는 포인트`,
      eyeAt: T1 - 0.2,
      lines: [{ html: '자주 묻는 질문 <span class="hl-mint">3</span>', at: T1 - 0.1 }],
    });
    const Y = [290, 488, 686];
    const r = mount(root, qs.map((k, i) => `
      <div class="card" data-r="q${i}" style="left:150px;top:${Y[i]}px;width:1620px;height:176px">
        <div class="abs center" style="left:34px;top:48px;width:80px;height:80px;border-radius:24px;background:var(--${k.color}-soft);color:var(--${k.color === 'coral' ? 'coral-2' : k.color === 'blue' ? 'blue-2' : 'mint-2'})">${icon(k.ic, { size: 42 })}</div>
        <div class="abs" style="left:140px;top:38px;font-size:24px;font-weight:800;color:var(--ink-3);letter-spacing:0.04em">Q${i + 1}</div>
        <div class="abs" style="left:140px;top:68px;font-size:38px;font-weight:700;letter-spacing:-0.03em;white-space:nowrap">${k.q.replace(/<b>/g, '<b style="font-weight:850">')}</div>
        <div class="abs" style="left:140px;top:124px;font-size:23px;font-weight:600;color:var(--ink-3);white-space:nowrap">${k.hint}</div>
        <div class="abs" data-r="a${i}" style="left:850px;top:22px;width:748px;height:132px;border-radius:26px;background:#F7F4EF">
          <div class="abs center" style="left:24px;top:32px;width:68px;height:68px;border-radius:34px;background:var(--ink);color:#fff;font-size:30px;font-weight:880">A</div>
          <div class="abs" style="left:116px;top:22px;font-size:36px;font-weight:840;letter-spacing:-0.03em;white-space:nowrap">${k.a}</div>
          <div class="abs" style="left:116px;top:78px;font-size:24px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
        </div>
      </div>`).join(''));
    qs.forEach((k) => { c.sfx(k.tq, 'pop', 0.45); c.sfx(k.ta, 'click', 0.6); });
    return (t) => {
      hd(t);
      qs.forEach((k, i) => {
        enter(r[`q${i}`], t, k.tq - 0.25, { dx: 60, dy: 0, e: ease.outCubic, d: 0.55 });
        enter(r[`a${i}`], t, k.ta, { dx: -30, dy: 0, s0: 0.96 });
      });
    };
  },
};

// ------------------------------------------------------------------ 8. 급여·분할 사용
const facts = {
  id: 'facts',
  build(root, c) {
    const T1 = c.at('g1'), T1b = c.at('g1', 1), T2 = c.at('g2');
    const hd = header(root, {
      y: 140,
      lines: [{ html: '알아두면 좋은 <span class="hl-mint">두 가지</span>', at: T1 - 0.2 }],
    });
    const segW = 150, gap = 22;
    const r = mount(root, `
      <div class="card" data-r="ca" style="left:170px;top:290px;width:760px;height:540px">
        <div class="abs row" style="left:48px;top:44px;gap:18px">
          <div class="icon-badge" style="width:72px;height:72px;border-radius:22px;background:var(--gold-soft);color:var(--gold-2)">${icon('wallet', { size: 40 })}</div>
          <div style="font-size:40px;font-weight:830">늘어난 6개월에도 급여 지급</div>
        </div>
        <div class="abs col" style="left:0;top:170px;width:760px;align-items:center">
          <div style="font-size:32px;font-weight:700;color:var(--ink-2)">통상임금의</div>
          <div class="row" style="align-items:baseline;gap:6px"><span class="num" data-r="pct" style="font-size:170px;font-weight:880;color:var(--gold-2);letter-spacing:-0.04em;line-height:1.05">0</span><span style="font-size:80px;font-weight:850;color:var(--gold-2)">%</span></div>
          <div class="chip gold" data-r="cap160" style="height:68px;font-size:34px;padding:0 30px;margin-top:6px">월 최대 160만 원</div>
        </div>
        <div class="abs" style="left:0;bottom:30px;width:760px;text-align:center;font-size:23px;font-weight:600;color:var(--ink-3)">※ 휴직 7개월째부터 적용되는 일반 기준과 같아요</div>
      </div>
      <div class="card" data-r="cb" style="left:990px;top:290px;width:760px;height:540px">
        <div class="abs row" style="left:48px;top:44px;gap:18px">
          <div class="icon-badge" style="width:72px;height:72px;border-radius:22px;background:var(--mint-soft);color:var(--mint-2)">${icon('split', { size: 40 })}</div>
          <div style="font-size:40px;font-weight:830">최대 <span class="hl-mint">4번</span> 나눠 쓰기</div>
        </div>
        <div class="abs" style="left:${(760 - (4 * segW + 3 * gap)) / 2}px;top:210px;width:${4 * segW + 3 * gap}px;height:90px">
          ${[0, 1, 2, 3].map((i) => `<div class="abs center" data-r="s${i}" style="left:${i * (segW + gap)}px;top:0;width:${segW}px;height:90px;border-radius:22px;background:linear-gradient(160deg,#3CC7AE,var(--mint));color:#fff;font-size:40px;font-weight:880">${i + 1}</div>`).join('')}
        </div>
        <div class="abs" data-r="short" style="left:60px;top:352px;width:640px;border-radius:24px;background:#F7F4EF;padding:22px 28px">
          <div class="row" style="gap:12px;font-size:28px;font-weight:800">${icon('sparkles', { size: 30 })}2026.8.20부터 · 단기 육아휴직</div>
          <div style="margin-top:8px;font-size:24px;font-weight:600;color:var(--ink-2);line-height:1.45">1주·2주 단위로 연 1회 사용 가능<br>(나눠 쓰는 횟수에 포함되지 않아요)</div>
        </div>
      </div>`);
    c.sfx(T1b + 0.1, 'coin', 0.55);
    for (let i = 0; i < 4; i++) c.sfx(T2 + 0.4 + i * 0.16, 'pop', 0.35);
    return (t) => {
      hd(t);
      enter(r.ca, t, T1 - 0.1, { dy: 40 });
      enter(r.cb, t, T2 - 0.25, { dy: 40 });
      countTo(r.pct, t, T1b, 1.1, 0, 80);
      pop(r.cap160, t, T1b + 1.0, {});
      const sp = P(t, T2 + 0.3, 0.8, ease.outBack);
      [0, 1, 2, 3].forEach((i) => {
        const x = lerp((1.5 - i) * gap, 0, sp);
        enter(r[`s${i}`], t, T2 - 0.1, { x, dy: 0, s0: 1 });
      });
      enter(r.short, t, T2 + 1.3, { dy: 20 });
    };
  },
};

// ------------------------------------------------------------------ 9. 6+6 개념
const AX = { x0: 330, x1: 1590, months: 24 }; // 아이 나이 축
const mx = (m) => AX.x0 + ((AX.x1 - AX.x0) * m) / AX.months;

function ageAxis(root, { y, ref, until = 24, labelEvery = 3 }) {
  let ticks = '';
  for (let m = 0; m <= until; m += labelEvery) {
    ticks += `<div class="abs" style="left:${mx(m) - 1.5}px;top:${y - 8}px;width:3px;height:16px;border-radius:2px;background:#C9CFD8"></div>
      <div class="axis-label" style="left:${mx(m) - 50}px;top:${y + 16}px;width:100px">${m === 0 ? '출생' : `${m}개월`}</div>`;
  }
  return mount(root, `
    <div class="abs" data-r="${ref}" style="left:0;top:0;width:1920px;height:1080px">
      <div class="abs" data-r="${ref}Line" style="left:${AX.x0}px;top:${y - 2}px;width:${mx(until) - AX.x0}px;height:5px;border-radius:3px;background:#D5DAE1"></div>
      ${ticks}
      <div class="abs" style="left:${AX.x0 - 190}px;top:${y - 20}px;font-size:26px;font-weight:750;color:var(--ink-2);white-space:nowrap">아이 나이</div>
    </div>`);
}

const concept66 = {
  id: 'concept66',
  build(root, c) {
    const T1b = c.at('k1', 1), T2 = c.at('k2'), T2b = c.at('k2', 1), T2c = c.at('k2', 2), T2d = c.at('k2', 3), T3 = c.at('k3');
    const hd = header(root, {
      y: 130,
      lines: [
        { html: '<span class="hl-gold">생후 18개월</span> 전에 부모 모두 휴직 시작', at: T2 },
        { html: '각자 <span class="hl-gold">첫 6개월</span> 급여 = 통상임금 <span class="hl-gold">100%</span>', at: T2c },
        { html: '<span class="hl-mint">동시</span>에 써도, <span class="hl-mint">차례로</span> 써도 OK', at: T3 },
      ],
    });
    const logo = mount(root, `
      <div class="abs col" data-r="logo" style="left:0;top:250px;width:1920px;align-items:center">
        <div class="row" style="gap:40px">
          <div class="col center" data-r="lg1"><div class="center" style="width:250px;height:250px;border-radius:125px;background:linear-gradient(160deg,#FF9A86,var(--coral));color:#fff;font-size:180px;font-weight:900;box-shadow:0 24px 50px rgba(255,125,102,0.35)">6</div><div style="margin-top:22px;font-size:34px;font-weight:780;color:var(--coral-2)">엄마 첫 6개월</div></div>
          <div data-r="lgp" style="font-size:130px;font-weight:880;color:var(--ink-3);margin-top:-60px">+</div>
          <div class="col center" data-r="lg2"><div class="center" style="width:250px;height:250px;border-radius:125px;background:linear-gradient(160deg,#74A8FA,var(--blue));color:#fff;font-size:180px;font-weight:900;box-shadow:0 24px 50px rgba(76,141,246,0.35)">6</div><div style="margin-top:22px;font-size:34px;font-weight:780;color:var(--blue-2)">아빠 첫 6개월</div></div>
        </div>
        <div data-r="lgT" style="margin-top:40px;font-size:64px;font-weight:860;letter-spacing:-0.035em">6+6 <span class="hl-gold">부모육아휴직제</span></div>
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
      <div class="abs row" data-r="modes" style="left:${mx(20) - 90}px;top:${Y - 210}px;gap:14px;flex-direction:column;align-items:flex-start">
        <div class="chip white" data-r="md1">${icon('circle-check', { size: 30, color: '#1FAF96' })}동시 사용</div>
        <div class="chip white" data-r="md2">${icon('circle-check', { size: 30, color: '#1FAF96' })}순차 사용</div>
      </div>`);
    c.sfx(c.in + 0.2, 'pop', 0.6);
    c.sfx(c.in + 0.45, 'pop', 0.6);
    c.sfx(T2b + 0.2, 'pop', 0.5);
    c.sfx(T2b + 0.8, 'pop', 0.5);
    c.sfx(T2d + 0.1, 'coin', 0.7);
    c.sfx(T3 + 0.1, 'tick', 0.5);
    c.sfx(T3 + 1.2, 'tick', 0.5);
    return (t) => {
      hd(t);
      const out = T2 - 0.45;
      enter(logo.lg1, t, c.in + 0.15, { dy: 0, s0: 0.3, e: ease.outBack, out, ods: 0.8 });
      enter(logo.lgp, t, c.in + 0.3, { dy: 0, s0: 0.3, out });
      enter(logo.lg2, t, c.in + 0.4, { dy: 0, s0: 0.3, e: ease.outBack, out, ods: 0.8 });
      enter(logo.lgT, t, T1b - 0.1, { dy: 30, out });
      enter(ax.ax, t, T2 - 0.1, { dy: 20, s0: 1 });
      enter(z.zone, t, T2 + 0.4, { dy: 30, s0: 1 });
      enter(z.zoneLine, t, T2 + 0.6, { dy: 0, s0: 1 });
      enter(z.pinM, t, T2b + 0.2, { dy: -60, s0: 0.8, e: ease.outBack });
      enter(z.pinD, t, T2b + 0.8, { dy: -60, s0: 0.8, e: ease.outBack });
      growW(z.barM, t, T2c + 0.1, 0.8, bw);
      growW(z.barD, t, T2c + 0.5, 0.8, bw);
      pop(z.p100, t, T2d + 0.1, {});
      enter(z.md1, t, T3 + 0.1, { dx: 30, dy: 0 });
      enter(z.md2, t, T3 + 1.2, { dx: 30, dy: 0 });
      blink(z.pinM, t, 1);
      blink(z.pinD, t, 2);
    };
  },
};

// ------------------------------------------------------------------ 10. 상한액 + 일반 급여 비교 (한 장면으로 이어짐)
const chart = {
  ids: ['caps', 'compare'],
  build(root, c) {
    const M1 = c.at('m1'), M2 = [c.at('m2'), c.at('m2', 1), c.at('m2', 2), c.at('m2', 3)], M3 = c.at('m3'), M3b = c.at('m3', 1);
    const N1 = c.at('n1'), N2 = c.at('n2'), N2b = c.at('n2', 1), N2c = c.at('n2', 2), N3 = c.at('n3'), N3b = c.at('n3', 1), N4 = c.at('n4'), N4b = c.at('n4', 1);
    const hd = header(root, {
      y: 118,
      lines: [
        { html: '6+6 <span class="hl-gold">월 상한액</span>', at: M1 - 0.2 },
        { html: '<span style="color:var(--ink-3)">일반 급여</span> vs <span class="hl-gold">6+6</span>', at: N1 - 0.1 },
        { html: '상한액보다 <span class="hl-blue">통상임금이 적다면?</span>', at: N4 },
      ],
    });
    const gold = [250, 250, 300, 350, 400, 450];
    const gray = [250, 250, 250, 200, 200, 200];
    // 차트 좌표 (카드 내부 기준)
    const CX = 150, CY = 270, CW = 1080, CH = 620;
    const px0 = 110, base = 530, scale = 0.76; // 1만 원당 px
    const gw = 150, bw = 62;
    const gx = (i) => px0 + 58 + i * gw; // 금색 막대의 기본 x (그룹 중앙 정렬)
    let grid = '';
    for (let v = 100; v <= 500; v += 100) {
      grid += `<div class="abs" style="left:${px0}px;top:${base - v * scale}px;width:${CW - px0 - 50}px;height:2px;background:#EFEAE3"></div>
        <div class="axis-label" style="left:${px0 - 90}px;top:${base - v * scale - 16}px;width:76px;text-align:right">${v}</div>`;
    }
    let bars = '';
    for (let i = 0; i < 6; i++) {
      bars += `
        <div class="bar gray" data-r="gy${i}" style="left:${gx(i)}px;top:${base}px;width:${bw}px;height:0"></div>
        <div class="bar gold" data-r="gd${i}" style="left:${gx(i)}px;top:${base}px;width:${bw}px;height:0"></div>
        <div class="abs" data-r="df${i}" style="left:${gx(i)}px;top:${base}px;width:${bw}px;height:0;border-radius:14px 14px 0 0;background:repeating-linear-gradient(135deg,rgba(34,181,115,0.85) 0 10px,rgba(34,181,115,0.55) 10px 20px)"></div>
        <div class="bar-label num" data-r="vl${i}" style="left:${gx(i) - 40}px;top:${base - gold[i] * scale - 50}px;width:${bw + 80}px;color:var(--gold-2)">${gold[i]}</div>
        <div class="bar-label num" data-r="gl${i}" style="left:${gx(i) - 40}px;top:${base - gray[i] * scale - 44}px;width:${bw + 80}px;font-size:26px;color:var(--ink-3)">${gray[i]}</div>
        <div class="bar-label num" data-r="dl${i}" style="left:${gx(i) - 30}px;top:${base - gold[i] * scale - 96}px;width:${bw + 100}px;font-size:28px;color:var(--green)">+${gold[i] - gray[i]}</div>
        <div class="axis-label" style="left:${gx(i) + bw / 2 - 60}px;top:${base + 16}px;width:120px">${i + 1}개월</div>`;
    }
    const r = mount(root, `
      <div class="card" data-r="card" style="left:${CX}px;top:${CY}px;width:${CW}px;height:${CH}px">
        <div class="abs row" data-r="legend" style="left:${px0}px;top:26px;gap:16px">
          <div class="chip gold" style="height:44px;font-size:23px;padding:0 16px"><i style="width:18px;height:18px;border-radius:5px;background:var(--gold)"></i>6+6 특례</div>
          <div class="chip" style="height:44px;font-size:23px;padding:0 16px;background:#EEF0F3;color:var(--ink-2)"><i style="width:18px;height:18px;border-radius:5px;background:#BCC3CD"></i>일반 육아휴직 급여</div>
        </div>
        <div class="abs" style="right:40px;top:34px;font-size:22px;font-weight:650;color:var(--ink-3)">단위: 만 원</div>
        ${grid}
        <div class="abs" style="left:${px0}px;top:${base}px;width:${CW - px0 - 50}px;height:3px;background:#D5DAE1"></div>
        ${bars}
        <div class="abs" data-r="capLine" style="left:${px0}px;top:${base - 300 * scale - 2}px;width:${CW - px0 - 50}px;height:0;border-top:4px dashed var(--blue)"></div>
        <div class="abs" data-r="capShade" style="left:${px0}px;top:60px;width:${CW - px0 - 50}px;height:${base - 300 * scale - 62}px;background:rgba(255,255,255,0.72)"></div>
        <div class="abs chip blue" data-r="capTag" style="right:60px;top:${base - 300 * scale - 64}px;height:48px;font-size:24px;padding:0 18px">${icon('user', { size: 26 })}내 통상임금 월 300만 원이라면</div>
      </div>
      <div class="card col" data-r="side" style="left:1270px;top:${CY}px;width:500px;height:${CH}px;align-items:center;padding-top:44px">
        <div class="row" style="gap:16px">
          <div class="icon-badge" style="width:76px;height:76px;border-radius:24px;background:var(--gold-soft);color:var(--gold-2)">${icon('coins', { size: 42 })}</div>
          <div class="col"><div style="font-size:30px;font-weight:820">통상임금 100%</div><div style="font-size:24px;font-weight:650;color:var(--ink-3)">월 상한 250 → 450만 원</div></div>
        </div>
        <div data-r="s1" class="col center" style="margin-top:30px;padding-top:26px;border-top:3px solid var(--line);width:400px">
          <div class="small" style="font-size:28px;color:var(--ink-2)">한 사람당 최대</div>
          <div class="row" style="align-items:baseline;gap:6px;margin-top:2px"><span class="num" data-r="tot1" style="font-size:92px;font-weight:880;color:var(--gold-2);letter-spacing:-0.04em">0</span><span style="font-size:38px;font-weight:820;color:var(--gold-2)">만 원</span></div>
        </div>
        <div data-r="s2" class="col center" style="margin-top:14px;padding-top:22px;border-top:3px solid var(--line);width:400px">
          <div class="row" style="gap:10px;align-items:center">${avatar('mom', 56)}${avatar('dad', 56)}<span class="small" style="font-size:28px;color:var(--ink-2);margin-left:8px">부부 합산 최대</span></div>
          <div class="row" style="align-items:baseline;gap:6px;margin-top:2px"><span class="num" data-r="tot2" style="font-size:80px;font-weight:880;color:var(--gold-2);letter-spacing:-0.04em">0</span><span style="font-size:36px;font-weight:820;color:var(--gold-2)">만 원</span></div>
        </div>
      </div>
      <div class="card col" data-r="side2" style="left:1270px;top:${CY}px;width:500px;height:${CH}px;padding:46px 44px 0">
        <div class="small" style="font-size:26px;color:var(--ink-3)">첫 6개월 최대 (1인)</div>
        <div data-r="cmpA" class="row" style="justify-content:space-between;margin-top:18px;height:70px">
          <span style="font-size:32px;font-weight:750;color:var(--ink-2)">일반 급여</span>
          <span><span class="num" style="font-size:52px;font-weight:860;color:var(--ink-2)">1,350</span><span style="font-size:28px;font-weight:780;color:var(--ink-2)"> 만 원</span></span>
        </div>
        <div data-r="cmpB" class="row" style="justify-content:space-between;margin-top:6px;height:70px">
          <span style="font-size:32px;font-weight:750;color:var(--gold-2)">6+6 특례</span>
          <span><span class="num" style="font-size:52px;font-weight:860;color:var(--gold-2)">2,000</span><span style="font-size:28px;font-weight:780;color:var(--gold-2)"> 만 원</span></span>
        </div>
        <div data-r="cmpC" class="col center" style="margin-top:34px;height:190px;border-radius:30px;background:rgba(34,181,115,0.10)">
          <div style="font-size:28px;font-weight:750;color:var(--green)">한 사람당 최대</div>
          <div class="row" style="align-items:baseline"><span class="num" data-r="diff" style="font-size:96px;font-weight:890;color:var(--green);letter-spacing:-0.04em">+0</span><span style="font-size:40px;font-weight:820;color:var(--green)">만 원</span></div>
        </div>
        <div data-r="cmpD" style="margin-top:28px;font-size:25px;font-weight:620;color:var(--ink-2);line-height:1.5">예) 통상임금 월 300만 원<br><b style="color:var(--ink)">250 · 250 · 300 · 300 · 300 · 300</b></div>
      </div>`);
    const monthAt = (i) => (i < 2 ? M2[0] + 0.3 + i * 0.35 : i === 2 ? M2[1] + 0.2 : i < 5 ? M2[2] + 0.3 + (i - 3) * 0.7 : M2[3] + 0.3);
    for (let i = 0; i < 6; i++) c.sfx(monthAt(i), i === 5 ? 'ding' : 'pop', i === 5 ? 0.55 : 0.4);
    c.sfx(M3 + 1.0, 'coin', 0.6);
    c.sfx(M3b + 1.0, 'coin', 0.6);
    c.sfx(N2 + 0.3, 'whoosh', 0.3);
    c.sfx(N3b + 0.9, 'ding', 0.55);
    c.sfx(N4 + 0.3, 'whoosh', 0.35);
    return (t) => {
      hd(t);
      enter(r.card, t, c.in, { dy: 40 });
      // 금색 막대: 비교 단계에서 오른쪽으로 비켜섬
      const shift = P(t, N2 - 0.2, 0.6, ease.inOutCubic) * (bw / 2 + 6);
      for (let i = 0; i < 6; i++) {
        const tg = monthAt(i);
        const h = gold[i] * scale * P(t, tg, 0.7, ease.outBackSoft);
        Object.assign(r[`gd${i}`].style, { height: `${h}px`, top: `${base - h}px` });
        tf(r[`gd${i}`], { x: shift });
        enter(r[`vl${i}`], t, tg + 0.35, { x: shift, dy: 16 });
        const tgy = i < 3 ? N2 + 0.2 + i * 0.25 : N2b + 0.2 + (i - 3) * 0.25;
        const hg = gray[i] * scale * P(t, tgy, 0.6, ease.outCubic);
        Object.assign(r[`gy${i}`].style, { height: `${hg}px`, top: `${base - hg}px` });
        tf(r[`gy${i}`], { x: -shift, o: t >= tgy ? 1 : 0 });
        enter(r[`gl${i}`], t, tgy + 0.3, { x: -shift, dy: 12, out: N4 - 0.2 });
        // 차액(초록 빗금): 셋째 달부터
        const diff = gold[i] - gray[i];
        const td = N3 + 0.2 + Math.max(0, i - 2) * 0.3;
        const hd2 = diff * scale * P(t, td, 0.5, ease.outCubic);
        Object.assign(r[`df${i}`].style, { height: `${hd2}px`, top: `${base - gray[i] * scale - hd2}px` });
        tf(r[`df${i}`], { x: shift, o: diff > 0 && t >= td ? 1 - 0.85 * P(t, N4 - 0.2, 0.4) : 0 });
        if (diff > 0) enter(r[`dl${i}`], t, td + 0.3, { x: shift, dy: 12, out: N4 - 0.2 });
        else opacity(r[`dl${i}`], 0);
      }
      enter(r.legend, t, N1, { dy: 12 });
      // 통상임금 300만 원 가정선
      const lp = P(t, N4 + 0.2, 0.7, ease.inOutCubic);
      r.capLine.style.width = `${((CW - px0 - 50) * lp).toFixed(1)}px`;
      opacity(r.capLine, lp > 0 ? 1 : 0);
      opacity(r.capShade, P(t, N4 + 0.6, 0.5));
      enter(r.capTag, t, N4 + 0.5, { dy: 12 });

      // 오른쪽 패널: 합계 → 비교
      enter(r.side, t, c.in + 0.3, { dx: 40, dy: 0, out: N1 - 0.3 });
      enter(r.s1, t, M3 - 0.1, { dy: 20 });
      countTo(r.tot1, t, M3 + 0.1, 1.2, 0, 2000);
      enter(r.s2, t, M3b - 0.1, { dy: 20 });
      countTo(r.tot2, t, M3b + 0.1, 1.2, 0, 4000);
      enter(r.side2, t, N1 + 0.1, { dx: 40, dy: 0 });
      enter(r.cmpA, t, N2c, { dx: 20, dy: 0 });
      enter(r.cmpB, t, N2c + 0.4, { dx: 20, dy: 0 });
      enter(r.cmpC, t, N3b - 0.1, { dy: 20 });
      countTo(r.diff, t, N3b + 0.1, 0.9, 0, 650, (v) => `+${Math.round(v)}`);
      enter(r.cmpD, t, N4b, { dy: 16 });
    };
  },
};

// ------------------------------------------------------------------ 11. 꼭 알아둘 포인트
const rule = {
  id: 'rule',
  build(root, c) {
    const Q1 = c.at('q1'), Q2 = c.at('q2'), Q2b = c.at('q2', 1), Q3 = c.at('q3'), Q3b = c.at('q3', 1), Q4 = c.at('q4'), Q4b = c.at('q4', 1), Q4c = c.at('q4', 2), Q5 = c.at('q5'), Q5b = c.at('q5', 1);
    const hd = header(root, {
      y: 124,
      eyebrow: `${icon('lightbulb', { size: 28 })}꼭 알아둘 포인트`,
      eyeAt: Q1 - 0.2,
      lines: [
        { html: '특례는 <span class="hl-gold">나중에 쓴 사람 기간만큼</span>', at: Q1 },
        { html: '먼저 쓴 사람은 <span class="hl-gold">차액을 소급</span>', at: Q4 },
        { html: '18개월 기준은 휴직 <span class="hl-mint">시작일</span>', at: Q5 },
      ],
    });
    const BW = 90, BG = 10, BX = 530;
    const bx = (i) => BX + i * (BW + BG);
    const blocks = (who, n, y) => Array.from({ length: n }, (_, i) => `<div class="tile gray" data-r="${who}${i}" style="left:${bx(i)}px;top:${y}px;width:${BW}px;height:70px;border-radius:18px;font-size:26px">${i + 1}</div>`).join('');
    const r = mount(root, `
      <div class="card" data-r="box" style="left:150px;top:300px;width:1020px;height:460px">
        <div class="abs" style="left:40px;top:34px;font-size:26px;font-weight:700;color:var(--ink-3)">예시 · 엄마 6개월 먼저, 아빠 3개월 나중</div>
      </div>
      <div class="abs" data-r="avM" style="left:200px;top:410px">${avatar('mom', 92)}</div>
      <div class="abs" data-r="avD" style="left:200px;top:570px">${avatar('dad', 92)}</div>
      <div class="abs col" data-r="nmM" style="left:312px;top:418px"><div style="font-size:34px;font-weight:820">엄마</div><div style="font-size:24px;font-weight:650;color:var(--ink-3)">먼저 휴직 · 6개월</div></div>
      <div class="abs col" data-r="nmD" style="left:312px;top:578px"><div style="font-size:34px;font-weight:820">아빠</div><div style="font-size:24px;font-weight:650;color:var(--ink-3)">나중 휴직 · 3개월</div></div>
      ${blocks('m', 6, 420)}
      ${blocks('d', 3, 580)}
      <div class="abs" data-r="guide" style="left:${bx(3) - BG / 2 - 2}px;top:396px;width:4px;height:274px;background:repeating-linear-gradient(180deg,var(--gold-2) 0 10px,transparent 10px 18px)"></div>
      <div class="abs chip gold" data-r="tagS" style="left:${bx(0)}px;top:512px;height:46px;font-size:23px;padding:0 16px">${icon('sparkles', { size: 24 })}특례 3개월</div>
      <div class="abs chip" data-r="tagG" style="left:${bx(3) + 8}px;top:512px;height:46px;font-size:23px;padding:0 16px;background:#EEF0F3;color:var(--ink-2)">일반 급여</div>
      <div class="abs" data-r="steps" style="left:1210px;top:300px;width:560px;height:460px">
        <div class="card" data-r="st1" style="left:0;top:0;width:560px;height:200px;padding:34px 36px">
          <div class="row" style="gap:14px"><div class="center" style="width:48px;height:48px;border-radius:24px;background:var(--ink);color:#fff;font-size:24px;font-weight:880">1</div><div style="font-size:32px;font-weight:820">엄마 휴직 중</div></div>
          <div style="margin-top:18px;font-size:28px;font-weight:640;color:var(--ink-2);line-height:1.45">일단 <b style="color:var(--ink)">일반 급여</b>로 매달 받아요</div>
        </div>
        <div class="card" data-r="st2" style="left:0;top:240px;width:560px;height:220px;padding:34px 36px">
          <div class="row" style="gap:14px"><div class="center" style="width:48px;height:48px;border-radius:24px;background:var(--gold);color:#fff;font-size:24px;font-weight:880">2</div><div style="font-size:32px;font-weight:820">아빠가 급여 신청하면</div></div>
          <div style="margin-top:18px;font-size:28px;font-weight:640;color:var(--ink-2);line-height:1.45">엄마에게 <b class="hl-gold">차액을 소급</b>해서<br>한꺼번에 지급돼요</div>
        </div>
      </div>
      <div class="abs" data-r="coinFly" style="left:0;top:0">${coins(2, 64)}</div>`);
    // 18개월 시작일 도식
    const Y = 600;
    const box5 = mount(root, '<div class="card" data-r="box5" style="left:120px;top:330px;width:1680px;height:470px"></div>').box5;
    const ax = ageAxis(root, { y: Y, ref: 'ax5' });
    const z = mount(root, `
      <div class="abs" data-r="z18" style="left:${mx(18) - 2}px;top:${Y - 250}px;width:4px;height:262px;border-radius:2px;background:var(--gold)"></div>
      <div class="abs chip gold" data-r="z18t" style="left:${mx(18) - 110}px;top:${Y - 300}px;height:48px;font-size:25px;padding:0 18px">생후 18개월</div>
      <div class="abs" data-r="pinD5" style="left:${mx(17) - 44}px;top:${Y - 200}px">${avatar('dad', 88)}<div class="abs" style="left:40px;top:92px;width:8px;height:100px;border-radius:4px;background:var(--blue)"></div></div>
      <div class="abs center" data-r="bar5" style="left:${mx(17)}px;top:${Y + 66}px;width:0;height:64px;border-radius:14px;background:linear-gradient(90deg,#FFCB5C,var(--gold));color:#fff;font-size:26px;font-weight:820;white-space:nowrap;overflow:hidden">첫 6개월 특례</div>
      <div class="abs chip white" data-r="ok5" style="left:${mx(8)}px;top:${Y - 190}px;height:64px;font-size:30px;padding:0 24px">${icon('circle-check', { size: 34, color: '#22B573' })}시작일이 18개월 이내면 OK</div>
      <div class="abs" data-r="note5" style="left:${mx(8)}px;top:${Y - 110}px;font-size:24px;font-weight:620;color:var(--ink-3)">※ 나눠 쓰는 경우, 각 휴직의 시작일 기준</div>`);
    for (let i = 0; i < 3; i++) { c.sfx(Q3 + 0.3 + i * 0.25, 'tick', 0.35); c.sfx(Q3b + 0.3 + i * 0.25, 'tick', 0.35); }
    c.sfx(Q4c + 0.1, 'coin', 0.7);
    c.sfx(Q5 + 0.3, 'whoosh', 0.3);
    c.sfx(Q5b + 0.2, 'ding', 0.5);
    return (t) => {
      hd(t);
      const out1 = Q5 - 0.1;
      enter(r.box, t, Q2 - 0.3, { dy: 40, out: out1 });
      enter(r.avM, t, Q2 - 0.1, { dx: -20, dy: 0, out: out1 });
      enter(r.avD, t, Q2 + 0.05, { dx: -20, dy: 0, out: out1 });
      enter(r.nmM, t, Q2, { dx: -20, dy: 0, out: out1 });
      enter(r.nmD, t, Q2 + 0.15, { dx: -20, dy: 0, out: out1 });
      for (let i = 0; i < 6; i++) {
        const on = t >= Q3b + 0.3 + i * 0.25 && i < 3;
        setCls(r[`m${i}`], on ? 'gold' : 'coral');
        enter(r[`m${i}`], t, Q2 + 0.2 + i * 0.06, { dy: 20, s0: 0.6, out: out1 });
        if (i >= 3 && t >= Q3b + 1.0) r[`m${i}`].className = 'tile gray';
      }
      for (let i = 0; i < 3; i++) {
        setCls(r[`d${i}`], t >= Q3 + 0.3 + i * 0.25 ? 'gold' : 'blue');
        enter(r[`d${i}`], t, Q2 + 0.4 + i * 0.06, { dy: 20, s0: 0.6, out: out1 });
      }
      enter(r.guide, t, Q3b, { dy: 0, s0: 1, out: out1 });
      enter(r.tagS, t, Q3b + 1.0, { dy: 10, out: out1 });
      enter(r.tagG, t, Q3b + 1.2, { dy: 10, out: out1 });
      enter(r.st1, t, Q4, { dx: 40, dy: 0, out: out1 });
      enter(r.st2, t, Q4b, { dx: 40, dy: 0, out: out1 });
      // 동전: 2단계 카드 → 엄마 첫 3칸
      const fp = P(t, Q4c, 0.9, ease.inOutCubic);
      const x0 = 1300, y0 = 620, x1 = bx(1), y1 = 400;
      tf(r.coinFly, { x: lerp(x0, x1, fp), y: lerp(y0, y1, fp) - Math.sin(fp * Math.PI) * 120, s: 1, o: fp > 0 && fp < 1 ? 1 : 0 });

      enter(box5, t, Q5 + 0.05, { dy: 40 });
      enter(ax.ax5, t, Q5 + 0.2, { dy: 20, s0: 1 });
      enter(z.z18, t, Q5 + 0.4, { dy: 0, s0: 1 });
      enter(z.z18t, t, Q5 + 0.5, { dy: 10 });
      enter(z.pinD5, t, Q5 + 0.8, { dy: -60, s0: 0.8, e: ease.outBack });
      growW(z.bar5, t, Q5b - 0.2, 1.0, mx(23) - mx(17));
      enter(z.ok5, t, Q5b + 0.3, { dy: 16 });
      enter(z.note5, t, Q5b + 0.8, { dy: 10 });
      blink(z.pinD5, t, 2);
    };
  },
};

// ------------------------------------------------------------------ 12. 두 제도 함께 쓰는 예시
const scenario = {
  id: 'scenario',
  build(root, c) {
    const S1 = c.at('s1'), S2 = c.at('s2'), S2b = c.at('s2', 1), S2c = c.at('s2', 2), S3 = c.at('s3'), S3b = c.at('s3', 1), S3c = c.at('s3', 2), S4 = c.at('s4'), S4b = c.at('s4', 1), S4c = c.at('s4', 2);
    const hd = header(root, {
      y: 124,
      eyebrow: `${icon('house', { size: 28 })}예시 · 맞벌이 부부`,
      eyeAt: c.in + 0.1,
      lines: [
        { html: '두 제도를 <span class="hl-lav">함께 쓰면?</span>', at: c.in + 0.15 },
        { html: '아빠가 18개월 전 시작 → <span class="hl-gold">6+6 적용</span>', at: S3 },
        { html: '둘 다 3개월 이상 → <span class="hl-mint">1년 6개월</span>', at: S4 },
      ],
    });
    const Y = 800; // 축
    const yM = 450, yD = 620;
    const box = mount(root, '<div class="card" data-r="box" style="left:120px;top:300px;width:1680px;height:600px"></div>').box;
    const ax = ageAxis(root, { y: Y, ref: 'axS' });
    const r = mount(root, `
      <div class="abs" data-r="avM" style="left:160px;top:${yM - 12}px">${avatar('mom', 88)}</div>
      <div class="abs" data-r="avD" style="left:160px;top:${yD - 12}px">${avatar('dad', 88)}</div>
      <div class="abs center" data-r="mat" style="left:${mx(0)}px;top:${yM}px;width:0;height:64px;border-radius:14px 0 0 14px;background:repeating-linear-gradient(135deg,#FFD2C8 0 12px,#FFE3DC 12px 24px);color:var(--coral-2);font-size:23px;font-weight:800;white-space:nowrap;overflow:hidden">출산휴가</div>
      <div class="abs center" data-r="barM" style="left:${mx(3)}px;top:${yM}px;width:0;height:64px;border-radius:0 14px 14px 0;background:linear-gradient(90deg,#FF9A86,var(--coral));color:#fff;font-size:27px;font-weight:820;white-space:nowrap;overflow:hidden">엄마 육아휴직 1년</div>
      <div class="abs center" data-r="barD" style="left:${mx(15)}px;top:${yD}px;width:0;height:64px;border-radius:14px;background:linear-gradient(90deg,#74A8FA,var(--blue));color:#fff;font-size:27px;font-weight:820;white-space:nowrap;overflow:hidden">아빠 6개월</div>
      <div class="abs" data-r="gM" style="left:${mx(3)}px;top:${yM - 8}px;width:0;height:80px;border-radius:16px;border:5px solid var(--gold);box-shadow:0 0 0 6px rgba(245,165,36,0.18)"></div>
      <div class="abs" data-r="gD" style="left:${mx(15)}px;top:${yD - 8}px;width:0;height:80px;border-radius:16px;border:5px solid var(--gold);box-shadow:0 0 0 6px rgba(245,165,36,0.18)"></div>
      <div class="abs chip gold" data-r="tM" style="left:${mx(3)}px;top:${yM - 62}px;height:46px;font-size:23px;padding:0 16px">${icon('coins', { size: 24 })}첫 6개월 차액 소급</div>
      <div class="abs chip gold" data-r="tD" style="left:${mx(15)}px;top:${yD - 62}px;height:46px;font-size:23px;padding:0 16px">${icon('sparkles', { size: 24 })}첫 6개월 특례</div>
      <div class="abs" data-r="p15" style="left:${mx(15) - 2}px;top:${yD + 70}px;width:4px;height:${Y - yD - 70}px;background:var(--blue);border-radius:2px"></div>
      <div class="abs" data-r="l18" style="left:${mx(18) - 2}px;top:${yM - 90}px;width:4px;height:${Y - yM + 100}px;background:repeating-linear-gradient(180deg,var(--gold-2) 0 10px,transparent 10px 18px)"></div>
      <div class="abs chip gold" data-r="l18t" style="left:${mx(18) + 14}px;top:${yM - 96}px;height:44px;font-size:22px;padding:0 14px">생후 18개월</div>
      <div class="abs" data-r="xM" style="left:${mx(16.2)}px;top:${yM}px;width:${mx(22.2) - mx(16.2)}px;height:64px;border-radius:14px;border:4px dashed var(--gold);background:rgba(255,240,208,0.7);display:flex;align-items:center;justify-content:center;gap:8px;color:var(--gold-2);font-size:25px;font-weight:840;white-space:nowrap">${icon('lock-open', { size: 26 })}+6개월 사용 가능</div>
      <div class="abs" data-r="xD" style="left:${mx(21.2)}px;top:${yD}px;width:${mx(24) - mx(21.2) + 150}px;height:64px;border-radius:14px;border:4px dashed var(--gold);background:rgba(255,240,208,0.7);display:flex;align-items:center;justify-content:center;gap:8px;color:var(--gold-2);font-size:25px;font-weight:840;white-space:nowrap">${icon('lock-open', { size: 26 })}+12개월 남음</div>
`);
    c.sfx(S2 + 0.2, 'whoosh', 0.25);
    c.sfx(S2c + 0.3, 'whoosh', 0.25);
    c.sfx(S3 + 0.6, 'ding', 0.55);
    c.sfx(S3b + 0.1, 'sparkle', 0.5);
    c.sfx(S3c + 0.1, 'coin', 0.65);
    c.sfx(S4 + 0.3, 'tick', 0.5);
    c.sfx(S4b + 0.1, 'pop', 0.5);
    c.sfx(S4c + 0.1, 'pop', 0.5);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(ax.axS, t, S1 + 0.2, { dy: 16, s0: 1 });
      enter(r.avM, t, S1 + 0.5, { dx: -20, dy: 0 });
      enter(r.avD, t, S1 + 0.65, { dx: -20, dy: 0 });
      growW(r.mat, t, S2 + 0.2, 0.6, mx(3) - mx(0));
      growW(r.barM, t, S2 + 0.8, 1.4, mx(15) - mx(3));
      enter(r.p15, t, S2b + 0.1, { dy: 20, s0: 1 });
      growW(r.barD, t, S2c + 0.2, 1.0, mx(21) - mx(15));
      enter(r.l18, t, S3 + 0.3, { dy: 0, s0: 1, out: S4 + 0.2, ody: 0 });
      enter(r.l18t, t, S3 + 0.4, { dy: 10, out: S4 + 0.2 });
      growW(r.gD, t, S3b + 0.1, 0.6, mx(21) - mx(15));
      enter(r.tD, t, S3b + 0.4, { dy: 10 });
      growW(r.gM, t, S3c + 0.1, 0.6, mx(9) - mx(3));
      enter(r.tM, t, S3c + 0.4, { dy: 10 });
      enter(r.xM, t, S4b + 0.1, { dx: -30, dy: 0, s0: 0.9 });
      enter(r.xD, t, S4c + 0.1, { dx: -30, dy: 0, s0: 0.9 });
      blink(r.avM, t, 1);
      blink(r.avD, t, 2);
    };
  },
};

// ------------------------------------------------------------------ 13. 3줄 요약
const summary = {
  id: 'summary',
  build(root, c) {
    const U1 = c.at('u1');
    const items = [
      { n: 1, color: 'mint', ic: 'calendar-plus', title: '휴직 기간 <span class="hl-mint">최대 1년 6개월</span>', sub: '부모 각각 3개월 이상 (또는 한부모·중증 장애아동 부모) · 부부 합산 최대 3년', at: c.at('u2') },
      { n: 2, color: 'gold', ic: 'coins', title: '6+6: 첫 6개월 <span class="hl-gold">통상임금 100%</span>', sub: '생후 18개월 전 부모 모두 휴직 시작 · 월 250~450만 원 상한 · 1인 최대 2,000만 원', at: c.at('u3') },
      { n: 3, color: 'blue', ic: 'laptop', title: '급여 신청은 <span class="hl-blue">고용24</span>에서', sub: '휴직 끝난 뒤 12개월이 지나면 받을 수 없어요 · 기한 꼭 지키기', at: c.at('u4') },
    ];
    const hd = header(root, {
      y: 120,
      eyebrow: `${icon('notebook-pen', { size: 28 })}오늘의 핵심`,
      eyeAt: U1 - 0.3,
      lines: [{ html: '<span class="hl-blue">3줄</span> 요약', at: U1 - 0.2 }],
    });
    const Y = [290, 490, 690];
    const r = mount(root, items.map((k, i) => `
      <div class="card" data-r="it${i}" style="left:200px;top:${Y[i]}px;width:1520px;height:172px">
        <div class="abs center" style="left:34px;top:40px;width:92px;height:92px;border-radius:28px;background:var(--${k.color}-soft);color:var(--${k.color === 'gold' ? 'gold-2' : k.color === 'blue' ? 'blue-2' : 'mint-2'})">${icon(k.ic, { size: 50 })}</div>
        <div class="abs" style="left:156px;top:34px;font-size:44px;font-weight:840;letter-spacing:-0.035em;white-space:nowrap">${k.title}</div>
        <div class="abs" style="left:156px;top:104px;font-size:26px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
        <svg class="abs" style="left:1400px;top:46px" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="var(--${k.color}-soft)"/>
          <path data-r="ck${i}" d="M22 42 L35 55 L60 27" fill="none" stroke="var(--${k.color === 'gold' ? 'gold-2' : k.color === 'blue' ? 'blue-2' : 'mint-2'})" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`).join(''));
    items.forEach((k, i) => { prepDraw(r[`ck${i}`]); c.sfx(k.at + 0.1, 'pop', 0.45); c.sfx(k.at + 1.7, 'tick', 0.55); });
    return (t) => {
      hd(t);
      items.forEach((k, i) => {
        enter(r[`it${i}`], t, k.at - 0.1, { dx: 60, dy: 0, e: ease.outCubic, d: 0.6 });
        draw(r[`ck${i}`], t, k.at + 1.5, 0.45);
      });
    };
  },
};

// ------------------------------------------------------------------ 14. 아웃트로
const outro = {
  id: 'outro',
  noExit: true,
  build(root, c) {
    const O1 = c.at('o1'), O1b = c.at('o1', 1), O1c = c.at('o1', 2), O2 = c.at('o2');
    const END = c.end;
    const hd = header(root, {
      y: 140,
      lines: [
        { html: '내 상황은 <span class="hl-blue">여기서 확인!</span>', at: O1 - 0.2 },
        { html: '도움이 되셨다면 <span class="hl-coral">구독 · 좋아요</span>', at: O2 },
      ],
    });
    const r = mount(root, `
      <div class="card col center" data-r="cA" style="left:330px;top:330px;width:600px;height:400px">
        <div class="icon-badge" style="width:120px;height:120px;border-radius:36px;background:var(--blue-soft);color:var(--blue-2)">${icon('phone', { size: 64 })}</div>
        <div style="margin-top:26px;font-size:32px;font-weight:720;color:var(--ink-2)">고용노동부 고객상담센터</div>
        <div class="num" style="margin-top:6px;font-size:100px;font-weight:890;letter-spacing:-0.02em;color:var(--blue-2)">1350</div>
      </div>
      <div class="card col center" data-r="cB" style="left:990px;top:330px;width:600px;height:400px">
        <div class="icon-badge" style="width:120px;height:120px;border-radius:36px;background:var(--mint-soft);color:var(--mint-2)">${icon('laptop', { size: 64 })}</div>
        <div style="margin-top:26px;font-size:32px;font-weight:720;color:var(--ink-2)">급여 신청 · 모의계산</div>
        <div style="margin-top:6px;font-size:92px;font-weight:890;letter-spacing:-0.03em;color:var(--mint-2)">고용24</div>
        <div style="font-size:26px;font-weight:650;color:var(--ink-3)">www.work24.go.kr</div>
      </div>
      <div class="abs" data-r="fam" style="left:620px;top:290px">${family(680)}</div>
      <div class="abs row" data-r="btns" style="left:0;top:700px;width:1920px;justify-content:center;gap:28px">
        <div class="row" data-r="sub" style="gap:14px;height:88px;padding:0 40px;border-radius:44px;background:#F0525A;color:#fff;font-size:38px;font-weight:840;box-shadow:0 16px 36px rgba(240,82,90,0.3)">${icon('bell', { size: 40, stroke: 2.4 })}<span data-r="subTxt">구독</span></div>
        <div class="row" data-r="like" style="gap:14px;height:88px;padding:0 40px;border-radius:44px;background:#fff;color:var(--ink);font-size:38px;font-weight:840;box-shadow:var(--shadow)">${icon('thumbs-up', { size: 40, stroke: 2.4 })}좋아요</div>
      </div>
      <div class="abs col center" data-r="disc" style="left:0;top:862px;width:1920px;font-size:24px;font-weight:600;color:var(--ink-3);line-height:1.6">
        <div>본 영상은 2026년 9월 기준 정보입니다. 개인별 적용 여부는 고용노동부(☎1350)·고용24에서 확인하세요.</div>
        <div>참고: 남녀고용평등과 일·가정 양립 지원에 관한 법률 · 고용보험법 시행령 · 고용노동부 안내</div>
      </div>`);
    c.sfx(O1b + 0.1, 'pop', 0.5);
    c.sfx(O1c + 0.1, 'pop', 0.5);
    c.sfx(O2 + 0.9, 'click', 0.8);
    c.sfx(O2 + 1.6, 'sparkle', 0.45);
    return (t) => {
      hd(t);
      const out = O2 - 0.3;
      enter(r.cA, t, O1b - 0.1, { dy: 40, out });
      enter(r.cB, t, O1c - 0.1, { dy: 40, out });
      enter(r.fam, t, O2 + 0.1, { dy: 50, s0: 0.85, y: wave(t, 3, 6) });
      blink(r.fam, t, 4);
      enter(r.btns, t, O2 + 0.4, { dy: 30 });
      const pressed = t >= O2 + 0.9;
      setHtml(r.subTxt, pressed ? '구독중' : '구독');
      r.sub.style.background = pressed ? '#8A94A3' : '#F0525A';
      const press = pressed ? 1 - 0.08 * Math.sin(Math.PI * clamp((t - O2 - 0.9) / 0.25)) : 1;
      tf(r.sub, { s: press });
      enter(r.disc, t, c.lend('o2') + 0.55, { dy: 10 });
      // 마지막 페이드아웃
      opacity(root, 1 - P(t, END - 0.7, 0.7, ease.inOutSine));
    };
  },
};

export const scenes = [hook, title, roadmap, basic, conditions, both, faq, facts, concept66, chart, rule, scenario, summary, outro];
