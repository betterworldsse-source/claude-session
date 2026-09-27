// 1화: 육아휴직 1년 6개월 & 6+6 부모육아휴직제 (3분 버전) — 장면 정의
// 각 장면은 build(root, ctx)에서 DOM을 만들고, 시간 t를 받는 update 함수를 돌려줍니다.
// ctx.at('문장id', k) = 해당 문장의 k번째 자막 청크가 시작되는 시각(초)
// 모든 타이밍이 문장/자막 기준이라, 내 목소리로 녹음을 바꿔도 그래픽이 자동으로 따라갑니다.
import { ease, P, clamp, lerp, wave, mount, tf, opacity, enter, pop, rise, countTo, prepDraw, draw, icon } from '../../engine/web/engine.js';
import { mom, dad, avatar, family, blink, coins } from '../../engine/web/art.js';

export const chapters = {
  1: { label: '① 기간', title: '기간', sub: '육아휴직 1년 6개월', short: '기간', color: 'mint', icon: 'calendar-plus', card: ['#2DBFA4', '#138C78'] },
  2: { label: '② 급여', title: '급여', sub: '6+6 부모육아휴직제', short: '급여', color: 'gold', icon: 'coins', card: ['#F9A12B', '#E0700A'] },
  3: { label: '정리', title: '정리', sub: '한눈에 보기', short: '정리', color: 'blue', icon: 'list-checks', card: null },
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

const setCls = (el, cls) => { const c = `tile ${cls}`; if (el.className !== c) el.className = c; };
const setHtml = (el, h) => { if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; } };
const LOCK = icon('lock', { size: 24, stroke: 2.4 });
const CHECK = icon('check', { size: 30, stroke: 3.4 });

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

// ------------------------------------------------------------------ 1. 결론부터 (훅)
const hook = {
  id: 'hook',
  build(root, c) {
    const H2 = c.at('h2'), H2b = c.at('h2', 1), H3 = c.at('h3'), H3b = c.at('h3', 1), H4 = c.at('h4');
    const hd = header(root, {
      y: 120,
      eyebrow: `${icon('baby', { size: 28 })}예비·초보 부모 필수 · 2026년 9월 기준`,
      eyeAt: 0.1,
      lines: [
        { html: '엄마·아빠 <span class="hl-coral">둘 다</span> 육아휴직을 쓰면', at: H2 },
        { html: '달라지는 건 딱 <span class="hl-coral">2가지</span>', at: H2b },
        { html: '핵심은 <span class="hl-mint">조건</span>! 콕 집어 정리할게요', at: H4 },
      ],
    });
    const r = mount(root, `
      <div class="abs col center" data-r="big" style="left:0;top:330px;width:1920px">
        <div style="font-size:190px;font-weight:920;letter-spacing:-0.05em;color:var(--coral-2);line-height:1">결론부터!</div>
        <div style="margin-top:34px;font-size:48px;font-weight:720;color:var(--ink-2)">육아휴직 <span class="hl-mint">1년 6개월</span> &amp; <span class="hl-gold">6+6</span>, 핵심만</div>
      </div>
      <div class="abs" data-r="mom" style="left:470px;top:330px">${mom({ w: 380 })}</div>
      <div class="abs" data-r="dad" style="left:1070px;top:330px">${dad({ w: 380 })}</div>
      <div class="abs center" data-r="plus" style="left:900px;top:520px;width:120px;height:120px;border-radius:60px;background:#fff;box-shadow:var(--shadow);font-size:80px;font-weight:880;color:var(--coral)">+</div>

      <div class="card" data-r="cA" style="left:170px;top:320px;width:770px;height:450px">
        <div class="abs row" style="left:48px;top:44px;gap:16px">
          <div class="icon-badge" style="width:78px;height:78px;border-radius:24px;background:var(--mint-soft);color:var(--mint-2)">${icon('calendar-plus', { size: 44 })}</div>
          <div class="chip mint" style="height:62px;font-size:34px;padding:0 26px">① 휴직 기간</div>
        </div>
        <div class="abs row" style="left:0;top:178px;width:770px;justify-content:center;gap:26px;align-items:center">
          <span style="font-size:74px;font-weight:800;color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:6px">1년</span>
          ${icon('arrow-right', { size: 64, stroke: 3, color: '#1FAF96' })}
          <span style="font-size:104px;font-weight:900;color:var(--mint-2);letter-spacing:-0.04em">1년 6개월</span>
        </div>
        <div class="abs" style="left:0;top:330px;width:770px;text-align:center;font-size:32px;font-weight:650;color:var(--ink-2)">부모 각자 · 최대 6개월 추가</div>
        <div class="abs chip ink" data-r="qA" style="right:36px;top:48px;height:56px;font-size:28px;padding:0 22px">${icon('key-round', { size: 28 })}조건은?</div>
      </div>
      <div class="card" data-r="cB" style="left:980px;top:320px;width:770px;height:450px">
        <div class="abs row" style="left:48px;top:44px;gap:16px">
          <div class="icon-badge" style="width:78px;height:78px;border-radius:24px;background:var(--gold-soft);color:var(--gold-2)">${icon('coins', { size: 44 })}</div>
          <div class="chip gold" style="height:62px;font-size:34px;padding:0 26px">② 휴직 급여</div>
        </div>
        <div class="abs col" style="left:0;top:160px;width:770px;align-items:center">
          <div style="font-size:36px;font-weight:720;color:var(--ink-2)">첫 6개월 · 통상임금의</div>
          <div style="font-size:124px;font-weight:900;color:var(--gold-2);letter-spacing:-0.04em;line-height:1.1">100%</div>
        </div>
        <div class="abs" style="left:0;top:350px;width:770px;text-align:center;font-size:32px;font-weight:650;color:var(--ink-2)">6+6 부모육아휴직제 · 월 상한 적용</div>
        <div class="abs chip ink" data-r="qB" style="right:36px;top:48px;height:56px;font-size:28px;padding:0 22px">${icon('key-round', { size: 28 })}조건은?</div>
      </div>`);
    c.sfx(0.2, 'pop', 0.6);
    c.sfx(H2 + 0.1, 'whoosh', 0.3);
    c.sfx(H3 + 0.1, 'pop', 0.6);
    c.sfx(H3 + 0.9, 'sparkle', 0.45);
    c.sfx(H3b + 0.1, 'pop', 0.6);
    c.sfx(H3b + 1.4, 'coin', 0.6);
    c.sfx(H4 + 0.3, 'click', 0.7);
    c.sfx(H4 + 0.5, 'click', 0.6);
    return (t) => {
      hd(t);
      const pout = H3 - 0.35;
      enter(r.big, t, 0.15, { dy: 0, s0: 0.7, e: ease.outBack, out: H2 - 0.3, ods: 1.15, ody: 0 });
      enter(r.mom, t, H2 + 0.05, { dx: -140, dy: 0, out: pout, r: wave(t, 3.2, 2) });
      enter(r.dad, t, H2 + 0.2, { dx: 140, dy: 0, out: pout, r: wave(t, 3.6, -2) });
      pop(r.plus, t, H2 + 0.6, { out: pout });
      blink(r.mom, t, 1);
      blink(r.dad, t, 2);
      enter(r.cA, t, H3, { dx: -60, dy: 30 });
      enter(r.cB, t, H3b, { dx: 60, dy: 30 });
      pop(r.qA, t, H4 + 0.3, { r: wave(t, 2.2, 3) });
      pop(r.qB, t, H4 + 0.5, { r: wave(t, 2.4, -3) });
    };
  },
};

// ------------------------------------------------------------------ 2. 타이틀
const title = {
  id: 'title',
  build(root, c) {
    const T = c.start;
    const r = mount(root, `
      <div class="abs col" style="left:150px;top:260px;width:1060px">
        <div data-r="eye" class="eyebrow" style="align-self:flex-start">${icon('timer', { size: 28 })}3분 정리 · 2026년 9월 기준</div>
        <div style="overflow:hidden;height:124px;margin-top:34px"><div data-r="l1" style="font-size:104px;font-weight:880;letter-spacing:-0.045em;line-height:1.15;white-space:nowrap">육아휴직 <span class="hl-mint">1년 6개월</span></div></div>
        <div style="overflow:hidden;height:124px;margin-top:4px"><div data-r="l2" style="font-size:104px;font-weight:880;letter-spacing:-0.045em;line-height:1.15;white-space:nowrap"><span style="color:var(--ink-3);font-weight:700">&amp;</span> <span class="hl-gold">6+6</span> 부모육아휴직제</div></div>
      </div>
      <div class="abs" data-r="fam" style="left:1160px;top:300px">${family(680)}</div>`);
    c.sfx(T - 0.6, 'swell', 0.5);
    c.sfx(T + 0.15, 'ding', 0.5);
    return (t) => {
      enter(r.eye, t, T + 0.05, { dy: 20 });
      rise(r.l1, t, T + 0.12);
      rise(r.l2, t, T + 0.3);
      enter(r.fam, t, T + 0.2, { dy: 60, s0: 0.85, y: wave(t, 3, 6) });
      blink(r.fam, t, 3);
    };
  },
};

// ------------------------------------------------------------------ PART 1 공용: 엄마/아빠 타일 줄
const RS = 58, RG = 12;
const ROW_X = 300;
function parentRows(root, { n = 18, y1, y2, prefix }) {
  const r = mount(root, `
    <div class="abs" data-r="${prefix}Av1" style="left:${ROW_X - 118}px;top:${y1 - 16}px">${avatar('mom', 90)}</div>
    <div class="abs" data-r="${prefix}Av2" style="left:${ROW_X - 118}px;top:${y2 - 16}px">${avatar('dad', 90)}</div>
    <div class="abs" data-r="${prefix}Lb1" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y1 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>
    <div class="abs" data-r="${prefix}Lb2" style="left:${ROW_X + n * (RS + RG) + 14}px;top:${y2 + 6}px;font-size:34px;font-weight:820;white-space:nowrap"></div>`);
  const a = tileRow(root, { x: ROW_X, y: y1, n, size: RS, gap: RG, cls: 'empty', ref: `${prefix}A` });
  const b = tileRow(root, { x: ROW_X, y: y2, n, size: RS, gap: RG, cls: 'empty', ref: `${prefix}B` });
  return { a, b, av1: r[`${prefix}Av1`], av2: r[`${prefix}Av2`], lb1: r[`${prefix}Lb1`], lb2: r[`${prefix}Lb2`] };
}

// ------------------------------------------------------------------ 3. 기본 1년 → 최대 1년 6개월
const basic = {
  id: 'basic',
  build(root, c) {
    const B2 = c.at('b1', 1), B3 = c.at('b1', 2);
    const tMom = B2 + 0.3, tDad = B2 + 1.3;
    const hd = header(root, {
      y: 140,
      eyebrow: `${icon('baby', { size: 28 })}자녀 1명당 · 부모 각자`,
      eyeAt: c.in + 0.1,
      lines: [
        { html: '육아휴직, 기본은 <span class="hl-mint">1년</span>', at: c.in + 0.2 },
        { html: '2025년 2월부터 <span class="hl-gold">최대 1년 6개월</span>', at: B3 },
      ],
    });
    const box = mount(root, '<div class="card" data-r="box" style="left:150px;top:380px;width:1620px;height:380px"></div>').box;
    const rows = parentRows(root, { y1: 470, y2: 620, prefix: 'p' });
    const stamp = mount(root, `
      <div class="abs col center" data-r="stamp" style="left:1420px;top:282px;width:250px;height:120px;border-radius:22px;border:5px solid var(--coral);color:var(--coral-2);background:rgba(255,255,255,0.9);font-weight:880">
        <div style="font-size:26px;letter-spacing:0.02em">2025. 2. 23.</div><div style="font-size:40px;letter-spacing:0.1em">시행</div>
      </div>`).stamp;
    for (let i = 0; i < 12; i++) { c.sfx(tMom + i * 0.06, 'tick', 0.2); c.sfx(tDad + i * 0.06, 'tick', 0.2); }
    c.sfx(B3 + 0.2, 'pop', 0.7);
    c.sfx(B3 + 0.5, 'sparkle', 0.5);
    return (t) => {
      hd(t);
      enter(box, t, c.in, { dy: 40 });
      enter(rows.av1, t, c.in + 0.2, { dx: -24, dy: 0 });
      enter(rows.av2, t, c.in + 0.3, { dx: -24, dy: 0 });
      const fill = (arr, t0, color) => arr.forEach((el, i) => {
        if (i < 12) {
          const on = t >= t0 + i * 0.06;
          setCls(el, on ? color : 'empty');
          enter(el, t, c.in + 0.25 + i * 0.015, { dy: 16, s: on ? 1 + 0.12 * (1 - P(t, t0 + i * 0.06, 0.3)) : 1 });
        } else {
          setCls(el, 'locked');
          setHtml(el, LOCK);
          enter(el, t, B3 + 0.4 + (i - 12) * 0.06, { dy: 20, s0: 0.4, e: ease.outBack });
        }
      });
      fill(rows.a, tMom, 'coral');
      fill(rows.b, tDad, 'blue');
      const unlocked = t >= B3 + 0.6;
      setHtml(rows.lb1, unlocked ? '<span class="hl-gold">1년 6개월</span>' : '<span class="hl-coral">엄마 1년</span>');
      setHtml(rows.lb2, unlocked ? '<span class="hl-gold">1년 6개월</span>' : '<span class="hl-blue">아빠 1년</span>');
      const lx = lerp(-6 * (RS + RG), 0, P(t, B3 + 0.5, 0.6, ease.inOutCubic));
      enter(rows.lb1, t, tMom + 0.8, { x: lx, dx: -16, dy: 0 });
      enter(rows.lb2, t, tDad + 0.8, { x: lx, dx: -16, dy: 0 });
      pop(stamp, t, B3 + 0.2, { r: -8, s0: 1.8, e: ease.outCubic, d: 0.35 });
    };
  },
};

// ------------------------------------------------------------------ 4. 추가 6개월 조건 3가지
const conditions = {
  id: 'conditions',
  build(root, c) {
    const opens = [c.at('c1', 1), c.at('c1', 2), c.at('c1', 3)];
    const hd = header(root, {
      y: 128,
      eyebrow: `${icon('key-round', { size: 28 })}+6개월 여는 열쇠`,
      eyeAt: c.in,
      lines: [{ html: '추가 조건은 <span class="hl-gold">셋 중 하나</span>만!', at: c.in + 0.1 }],
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
      y: 140,
      eyebrow: `<span class="chip mint" style="height:38px;font-size:22px;padding:0 14px">조건 1</span>맞벌이 부부라면`,
      eyeAt: c.in + 0.05,
      lines: [
        { html: '엄마 <span class="hl-coral">3개월</span> + 아빠 <span class="hl-blue">3개월</span> 이상이면?', at: c.in + 0.1 },
        { html: '각자 <span class="hl-gold">1년 6개월</span>, 합산 <span class="hl-gold">최대 3년</span>', at: D2 },
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

// ------------------------------------------------------------------ 6. 주의할 점 2가지
const faq = {
  id: 'faq',
  build(root, c) {
    const qs = [
      {
        q: '배우자가 <b>자영업자·전업주부</b>라면?',
        hint: '배우자가 근로자가 아니라 육아휴직을 쓸 수 없는 경우',
        a: '<span style="color:var(--red)">조건 1 불가</span> → 기본 1년',
        sub: '한부모·중증 장애아동 부모는 1년 6개월 가능',
        ic: 'briefcase', color: 'coral', tq: c.at('f1'), ta: c.at('f1', 1),
      },
      {
        q: '추가 6개월, <b>언제 신청</b>하나요?',
        hint: '배우자의 육아휴직 사용 내역을 증빙으로 제출',
        a: '배우자 <span class="hl-blue">3개월 사용 확인 후</span>',
        sub: '휴직 순서를 미리 계획해 두세요',
        ic: 'calendar-check', color: 'blue', tq: c.at('f2'), ta: c.at('f2', 1),
      },
    ];
    const hd = header(root, {
      y: 128,
      eyebrow: `${icon('triangle-alert', { size: 28 })}헷갈리는 포인트`,
      eyeAt: c.in,
      lines: [{ html: '주의할 점 <span class="hl-coral">2가지</span>', at: c.in + 0.1 }],
    });
    const Y = [340, 580];
    const r = mount(root, qs.map((k, i) => `
      <div class="card" data-r="q${i}" style="left:150px;top:${Y[i]}px;width:1620px;height:196px">
        <div class="abs center" style="left:36px;top:54px;width:88px;height:88px;border-radius:26px;background:var(--${k.color}-soft);color:var(--${k.color}-2)">${icon(k.ic, { size: 46 })}</div>
        <div class="abs" style="left:150px;top:42px;font-size:24px;font-weight:800;color:var(--ink-3);letter-spacing:0.04em">주의 ${i + 1}</div>
        <div class="abs" style="left:150px;top:74px;font-size:40px;font-weight:700;letter-spacing:-0.03em;white-space:nowrap">${k.q.replace(/<b>/g, '<b style="font-weight:850">')}</div>
        <div class="abs" style="left:150px;top:134px;font-size:24px;font-weight:600;color:var(--ink-3);white-space:nowrap">${k.hint}</div>
        <div class="abs" data-r="a${i}" style="left:860px;top:26px;width:736px;height:144px;border-radius:26px;background:#F7F4EF">
          <div class="abs center" style="left:24px;top:38px;width:68px;height:68px;border-radius:34px;background:var(--ink);color:#fff;font-size:30px;font-weight:880">A</div>
          <div class="abs" style="left:116px;top:26px;font-size:38px;font-weight:840;letter-spacing:-0.03em;white-space:nowrap">${k.a}</div>
          <div class="abs" style="left:116px;top:86px;font-size:25px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
        </div>
      </div>`).join(''));
    qs.forEach((k) => { c.sfx(k.tq, 'pop', 0.45); c.sfx(k.ta, 'click', 0.6); });
    return (t) => {
      hd(t);
      qs.forEach((k, i) => {
        enter(r[`q${i}`], t, k.tq - 0.3, { dx: 60, dy: 0, e: ease.outCubic, d: 0.55 });
        enter(r[`a${i}`], t, k.ta, { dx: -30, dy: 0, s0: 0.96 });
      });
    };
  },
};

// ------------------------------------------------------------------ 7. 6+6 개념
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
    const K1b = c.at('k1', 1), K2 = c.at('k2'), K2b = c.at('k2', 1), K2c = c.at('k2', 2), K3 = c.at('k3');
    const hd = header(root, {
      y: 130,
      lines: [
        { html: '<span class="hl-gold">생후 18개월</span> 전에 부모 모두 휴직 시작', at: K2 },
        { html: '각자 <span class="hl-gold">첫 6개월</span> 급여 = 통상임금 <span class="hl-gold">100%</span>', at: K2c },
        { html: '<span class="hl-mint">동시</span>에 써도, <span class="hl-mint">차례로</span> 써도 OK', at: K3 },
      ],
    });
    const logo = mount(root, `
      <div class="abs col" style="left:0;top:250px;width:1920px;align-items:center">
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
      <div class="abs col" style="left:${mx(20) - 90}px;top:${Y - 210}px;gap:14px;align-items:flex-start">
        <div class="chip white" data-r="md1">${icon('circle-check', { size: 30, color: '#1FAF96' })}동시 사용</div>
        <div class="chip white" data-r="md2">${icon('circle-check', { size: 30, color: '#1FAF96' })}순차 사용</div>
      </div>`);
    const t100 = K2c + 1.6;
    c.sfx(c.in + 0.2, 'pop', 0.6);
    c.sfx(c.in + 0.45, 'pop', 0.6);
    c.sfx(K2b + 0.2, 'pop', 0.5);
    c.sfx(K2b + 0.8, 'pop', 0.5);
    c.sfx(t100, 'coin', 0.7);
    c.sfx(K3 + 0.1, 'tick', 0.5);
    c.sfx(K3 + 1.0, 'tick', 0.5);
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
      enter(z.pinM, t, K2b + 0.2, { dy: -60, s0: 0.8, e: ease.outBack });
      enter(z.pinD, t, K2b + 0.8, { dy: -60, s0: 0.8, e: ease.outBack });
      growW(z.barM, t, K2c + 0.1, 0.8, bw);
      growW(z.barD, t, K2c + 0.5, 0.8, bw);
      pop(z.p100, t, t100, {});
      enter(z.md1, t, K3 + 0.1, { dx: 30, dy: 0 });
      enter(z.md2, t, K3 + 1.0, { dx: 30, dy: 0 });
      blink(z.pinM, t, 1);
      blink(z.pinD, t, 2);
    };
  },
};

// ------------------------------------------------------------------ 8. 월 상한액 + 일반 급여 비교
const chart = {
  id: 'caps',
  build(root, c) {
    const M1 = c.at('m1'), M2 = c.at('m1', 1), M3 = c.at('m1', 2), N1 = c.at('n1'), N2 = c.at('n1', 1);
    const hd = header(root, {
      y: 118,
      lines: [
        { html: '6+6 <span class="hl-gold">월 상한액</span>', at: c.in + 0.05 },
        { html: '<span style="color:var(--ink-3)">일반 급여</span> vs <span class="hl-gold">6+6</span>', at: N1 - 0.1 },
      ],
    });
    const gold = [250, 250, 300, 350, 400, 450];
    const gray = [250, 250, 250, 200, 200, 200];
    const CX = 150, CY = 270, CW = 1080, CH = 620;
    const px0 = 110, base = 530, scale = 0.76;
    const gw = 150, bw = 62;
    const gx = (i) => px0 + 58 + i * gw;
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
        <div data-r="cmpD" style="margin-top:26px;font-size:24px;font-weight:620;color:var(--ink-3);line-height:1.5">※ 상한액 기준이에요. 통상임금이 더 적으면<br>통상임금만큼 받아요.</div>
      </div>`);
    const monthAt = (i) => (i < 2 ? M1 + 0.9 + i * 0.3 : M2 + 0.25 + (i - 2) * 0.5);
    for (let i = 0; i < 6; i++) c.sfx(monthAt(i), i === 5 ? 'ding' : 'pop', i === 5 ? 0.55 : 0.4);
    c.sfx(M3 + 0.9, 'coin', 0.6);
    c.sfx(N1 + 0.2, 'whoosh', 0.3);
    c.sfx(N2 + 0.9, 'ding', 0.55);
    return (t) => {
      hd(t);
      enter(r.card, t, c.in, { dy: 40 });
      const shift = P(t, N1 - 0.1, 0.6, ease.inOutCubic) * (bw / 2 + 6);
      for (let i = 0; i < 6; i++) {
        const tg = monthAt(i);
        const h = gold[i] * scale * P(t, tg, 0.7, ease.outBackSoft);
        Object.assign(r[`gd${i}`].style, { height: `${h}px`, top: `${base - h}px` });
        tf(r[`gd${i}`], { x: shift });
        enter(r[`vl${i}`], t, tg + 0.35, { x: shift, dy: 16 });
        const tgy = N1 + 0.3 + i * 0.18;
        const hg = gray[i] * scale * P(t, tgy, 0.6, ease.outCubic);
        Object.assign(r[`gy${i}`].style, { height: `${hg}px`, top: `${base - hg}px` });
        tf(r[`gy${i}`], { x: -shift, o: t >= tgy ? 1 : 0 });
        enter(r[`gl${i}`], t, tgy + 0.3, { x: -shift, dy: 12 });
        const diff = gold[i] - gray[i];
        const td = N2 + 0.1 + Math.max(0, i - 2) * 0.25;
        const hd2 = diff * scale * P(t, td, 0.5, ease.outCubic);
        Object.assign(r[`df${i}`].style, { height: `${hd2}px`, top: `${base - gray[i] * scale - hd2}px` });
        tf(r[`df${i}`], { x: shift, o: diff > 0 && t >= td ? 1 : 0 });
        if (diff > 0) enter(r[`dl${i}`], t, td + 0.3, { x: shift, dy: 12 });
        else opacity(r[`dl${i}`], 0);
      }
      enter(r.legend, t, N1, { dy: 12 });
      enter(r.side, t, c.in + 0.3, { dx: 40, dy: 0, out: N1 - 0.3 });
      enter(r.s1, t, M3 - 0.1, { dy: 20 });
      countTo(r.tot1, t, M3 + 0.1, 1.2, 0, 2000);
      enter(r.s2, t, M3 + 1.3, { dy: 20 });
      countTo(r.tot2, t, M3 + 1.5, 1.2, 0, 4000);
      enter(r.side2, t, N1 + 0.1, { dx: 40, dy: 0 });
      enter(r.cmpA, t, N1 + 0.4, { dx: 20, dy: 0 });
      enter(r.cmpB, t, N1 + 0.8, { dx: 20, dy: 0 });
      enter(r.cmpC, t, N2 - 0.1, { dy: 20 });
      countTo(r.diff, t, N2 + 0.1, 0.9, 0, 650, (v) => `+${Math.round(v)}`);
      enter(r.cmpD, t, N2 + 1.2, { dy: 16 });
    };
  },
};

// ------------------------------------------------------------------ 9. 적용 기간 · 차액 소급
const rule = {
  id: 'rule',
  build(root, c) {
    const Q1c = c.at('q1', 2), Q1d = c.at('q1', 3), Q2 = c.at('q2');
    const hd = header(root, {
      y: 124,
      eyebrow: `${icon('lightbulb', { size: 28 })}꼭 알아둘 포인트`,
      eyeAt: c.in,
      lines: [
        { html: '특례는 <span class="hl-gold">나중에 쉰 사람 기간만큼</span>', at: c.in + 0.1 },
        { html: '먼저 쉰 사람은 <span class="hl-gold">차액을 소급</span>', at: Q2 },
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
      <div class="card" data-r="st1" style="left:1210px;top:300px;width:560px;height:200px;padding:34px 36px">
        <div class="row" style="gap:14px"><div class="center" style="width:48px;height:48px;border-radius:24px;background:var(--ink);color:#fff;font-size:24px;font-weight:880">1</div><div style="font-size:32px;font-weight:820">엄마 휴직 중</div></div>
        <div style="margin-top:18px;font-size:28px;font-weight:640;color:var(--ink-2);line-height:1.45">일단 <b style="color:var(--ink)">일반 급여</b>로 매달 받아요</div>
      </div>
      <div class="card" data-r="st2" style="left:1210px;top:540px;width:560px;height:220px;padding:34px 36px">
        <div class="row" style="gap:14px"><div class="center" style="width:48px;height:48px;border-radius:24px;background:var(--gold);color:#fff;font-size:24px;font-weight:880">2</div><div style="font-size:32px;font-weight:820">아빠가 급여 신청하면</div></div>
        <div style="margin-top:18px;font-size:28px;font-weight:640;color:var(--ink-2);line-height:1.45">엄마에게 <b class="hl-gold">차액을 소급</b>해서<br>한꺼번에 지급돼요</div>
      </div>
      <div class="abs" data-r="coinFly" style="left:0;top:0">${coins(2, 64)}</div>`);
    const tDad = Q1c + 0.3, tMom = Q1d + 0.3;
    for (let i = 0; i < 3; i++) { c.sfx(tDad + i * 0.22, 'tick', 0.35); c.sfx(tMom + i * 0.22, 'tick', 0.35); }
    c.sfx(Q2 + 1.9, 'coin', 0.7);
    return (t) => {
      hd(t);
      enter(r.box, t, c.in, { dy: 40 });
      enter(r.avM, t, c.in + 0.15, { dx: -20, dy: 0 });
      enter(r.avD, t, c.in + 0.3, { dx: -20, dy: 0 });
      enter(r.nmM, t, c.in + 0.2, { dx: -20, dy: 0 });
      enter(r.nmD, t, c.in + 0.35, { dx: -20, dy: 0 });
      for (let i = 0; i < 6; i++) {
        let cls = 'coral';
        if (i < 3 && t >= tMom + i * 0.22) cls = 'gold';
        if (i >= 3 && t >= tMom + 0.8) cls = 'gray';
        setCls(r[`m${i}`], cls);
        enter(r[`m${i}`], t, c.in + 0.3 + i * 0.06, { dy: 20, s0: 0.6 });
      }
      for (let i = 0; i < 3; i++) {
        setCls(r[`d${i}`], t >= tDad + i * 0.22 ? 'gold' : 'blue');
        enter(r[`d${i}`], t, c.in + 0.5 + i * 0.06, { dy: 20, s0: 0.6 });
      }
      enter(r.guide, t, tDad + 0.5, { dy: 0, s0: 1 });
      enter(r.tagS, t, tMom + 0.8, { dy: 10 });
      enter(r.tagG, t, tMom + 1.0, { dy: 10 });
      enter(r.st1, t, Q2, { dx: 40, dy: 0 });
      enter(r.st2, t, Q2 + 0.9, { dx: 40, dy: 0 });
      const fp = P(t, Q2 + 1.9, 0.9, ease.inOutCubic);
      tf(r.coinFly, { x: lerp(1300, bx(1), fp), y: lerp(620, 400, fp) - Math.sin(fp * Math.PI) * 120, o: fp > 0 && fp < 1 ? 1 : 0 });
    };
  },
};

// ------------------------------------------------------------------ 10. 한눈에 정리
const summary = {
  id: 'summary',
  build(root, c) {
    const U1 = c.at('u1');
    const items = [
      { color: 'mint', ic: 'calendar-plus', title: '기간 <span class="hl-mint">최대 1년 6개월</span>', sub: '엄마·아빠 각각 3개월 이상 사용 (한부모·중증 장애아동 부모 포함) · 부부 최대 3년', at: c.at('u2') },
      { color: 'gold', ic: 'coins', title: '6+6: 첫 6개월 <span class="hl-gold">통상임금 100%</span>', sub: '생후 18개월 전 부모 모두 휴직 시작 · 월 250~450만 원 상한 · 1인 최대 2,000만 원', at: c.at('u3') },
      { color: 'blue', ic: 'laptop', title: '급여 신청은 <span class="hl-blue">고용24</span>', sub: '휴직이 끝난 뒤 12개월 안에 신청해야 받을 수 있어요', at: c.at('u4') },
    ];
    const hd = header(root, {
      y: 120,
      eyebrow: `${icon('notebook-pen', { size: 28 })}오늘의 핵심`,
      eyeAt: U1 - 0.3,
      lines: [{ html: '<span class="hl-blue">한눈에</span> 정리', at: U1 - 0.2 }],
    });
    const Y = [290, 490, 690];
    const col2 = (k) => (k.color === 'gold' ? 'gold-2' : k.color === 'blue' ? 'blue-2' : 'mint-2');
    const r = mount(root, items.map((k, i) => `
      <div class="card" data-r="it${i}" style="left:200px;top:${Y[i]}px;width:1520px;height:172px">
        <div class="abs center" style="left:34px;top:40px;width:92px;height:92px;border-radius:28px;background:var(--${k.color}-soft);color:var(--${col2(k)})">${icon(k.ic, { size: 50 })}</div>
        <div class="abs" style="left:156px;top:34px;font-size:44px;font-weight:840;letter-spacing:-0.035em;white-space:nowrap">${k.title}</div>
        <div class="abs" style="left:156px;top:104px;font-size:26px;font-weight:620;color:var(--ink-2);white-space:nowrap">${k.sub}</div>
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

// ------------------------------------------------------------------ 11. 아웃트로
const outro = {
  id: 'outro',
  noExit: true,
  build(root, c) {
    const O1 = c.at('o1'), O2 = c.at('o1', 1);
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
        <div class="row" style="gap:14px;height:88px;padding:0 40px;border-radius:44px;background:#fff;color:var(--ink);font-size:38px;font-weight:840;box-shadow:var(--shadow)">${icon('thumbs-up', { size: 40, stroke: 2.4 })}좋아요</div>
      </div>
      <div class="abs col center" data-r="disc" style="left:0;top:862px;width:1920px;font-size:24px;font-weight:600;color:var(--ink-3);line-height:1.6">
        <div>본 영상은 2026년 9월 기준 정보입니다. 개인별 적용 여부는 고용노동부(☎1350)·고용24에서 확인하세요.</div>
        <div>참고: 남녀고용평등과 일·가정 양립 지원에 관한 법률 · 고용보험법 시행령 · 고용노동부 안내</div>
      </div>`);
    const tClick = O2 + 0.9;
    c.sfx(O1 + 0.2, 'pop', 0.5);
    c.sfx(O1 + 0.5, 'pop', 0.5);
    c.sfx(tClick, 'click', 0.8);
    c.sfx(tClick + 0.6, 'sparkle', 0.45);
    return (t) => {
      hd(t);
      const out = O2 - 0.3;
      enter(r.cA, t, O1 + 0.1, { dy: 40, out });
      enter(r.cB, t, O1 + 0.4, { dy: 40, out });
      enter(r.fam, t, O2 + 0.1, { dy: 50, s0: 0.85, y: wave(t, 3, 6) });
      blink(r.fam, t, 4);
      enter(r.btns, t, O2 + 0.4, { dy: 30 });
      const pressed = t >= tClick;
      setHtml(r.subTxt, pressed ? '구독중' : '구독');
      r.sub.style.background = pressed ? '#8A94A3' : '#F0525A';
      tf(r.sub, { s: pressed ? 1 - 0.08 * Math.sin(Math.PI * clamp((t - tClick) / 0.25)) : 1 });
      enter(r.disc, t, c.lend('o1') + 0.55, { dy: 10 });
      opacity(root, 1 - P(t, END - 0.7, 0.7, ease.inOutSine));
    };
  },
};

export const scenes = [hook, title, basic, conditions, both, faq, concept66, chart, rule, summary, outro];
