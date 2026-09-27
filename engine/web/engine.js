// 결정적(deterministic) 모션그래픽 엔진
// 모든 화면 상태는 시간 t의 순수 함수로 계산됩니다. 렌더러가 renderFrame(t)을 호출하고 스크린샷을 찍습니다.
import { ICONS } from './icons.js';

export const W = 1920;
export const H = 1080;

// ---------------------------------------------------------------- easing / math
export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  outBackSoft: (x) => 1 + 2.1 * Math.pow(x - 1, 3) + 1.1 * Math.pow(x - 1, 2),
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
/** t0부터 d초 동안의 진행도(0→1)에 easing 적용 */
export const P = (t, t0, d, e = ease.outCubic) => e(clamp((t - t0) / d));
export const wave = (t, period = 4, amp = 1, phase = 0) => Math.sin(((t / period) * 2 + phase) * Math.PI) * amp;

// ---------------------------------------------------------------- DOM helpers
export function icon(name, { size = 32, stroke = 2.2, color = 'currentColor' } = {}) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/** 마크업을 parent에 붙이고 data-r 속성을 가진 요소들을 이름으로 돌려줌 */
export function mount(parent, markup) {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  parent.append(tpl.content);
  const refs = {};
  parent.querySelectorAll('[data-r]').forEach((n) => { refs[n.dataset.r] = n; });
  return refs;
}

export function tf(el, o = {}) {
  if (!el) return;
  const x = o.x ?? 0, y = o.y ?? 0, s = o.s ?? 1, r = o.r ?? 0;
  const sx = (o.sx ?? 1) * s, sy = (o.sy ?? 1) * s;
  el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${sx.toFixed(4)},${sy.toFixed(4)}) rotate(${r.toFixed(2)}deg)`;
  if (o.o !== undefined) opacity(el, o.o);
}

export function opacity(el, v) {
  const op = clamp(v);
  el.style.opacity = op.toFixed(3);
  el.style.visibility = op < 0.003 ? 'hidden' : 'visible';
}

/** 표준 등장/퇴장 애니메이션. 진행도(오버슈트 포함)를 반환 */
export function enter(el, t, t0, o = {}) {
  const d = o.d ?? 0.62;
  const e = o.e ?? ease.outBackSoft;
  const p = P(t, t0, d, e);
  let op = P(t, t0, Math.min(d, 0.32), ease.linear);
  let x = (o.x ?? 0) + (o.dx ?? 0) * (1 - p);
  let y = (o.y ?? 0) + (o.dy ?? 34) * (1 - p);
  let s = (o.s ?? 1) * lerp(o.s0 ?? 0.94, 1, p);
  let r = (o.r0 ?? 0) * (1 - p) + (o.r ?? 0);
  if (o.out != null) {
    const q = P(t, o.out, o.od ?? 0.38, ease.inCubic);
    op *= 1 - q;
    y += (o.ody ?? -22) * q;
    x += (o.odx ?? 0) * q;
    s *= lerp(1, o.ods ?? 0.97, q);
  }
  tf(el, { x, y, s, r, o: op * (o.o ?? 1) });
  return p;
}

/** 위에서 톡 떨어져 살짝 눌렸다가 튀어 오르는 블록 낙하 */
export function drop(el, t, t0, o = {}) {
  const h = o.h ?? 150, d = o.d ?? 0.6, fall = 0.6;
  const p = clamp((t - t0) / d);
  let y, sx = 1, sy = 1;
  if (p < fall) {
    const q = p / fall;
    y = -h * (1 - q * q);
  } else {
    const q = (p - fall) / (1 - fall);
    y = -h * 0.06 * Math.sin(Math.PI * q);
    const sq = Math.max(0, 1 - q * 2.2);
    sx = 1 + 0.1 * sq;
    sy = 1 - 0.12 * sq;
  }
  let op = clamp((t - t0) / 0.1);
  if (o.out != null) op *= 1 - P(t, o.out, o.od ?? 0.35, ease.inCubic);
  el.style.transformOrigin = '50% 100%';
  tf(el, { x: o.x ?? 0, y: (o.y ?? 0) + y, sx: sx * (o.s ?? 1), sy: sy * (o.s ?? 1), o: op * (o.o ?? 1) });
  return p;
}

export const pop = (el, t, t0, o = {}) => enter(el, t, t0, { dy: 0, s0: 0.3, d: 0.55, e: ease.outBack, ...o });

/** overflow:hidden 마스크 안의 텍스트를 아래에서 위로 드러냄 */
export function rise(el, t, t0, o = {}) {
  const p = P(t, t0, o.d ?? 0.75, o.e ?? ease.outQuart);
  let y = (1 - p) * 112;
  if (o.out != null) y -= P(t, o.out, o.od ?? 0.4, ease.inCubic) * 112;
  el.style.transform = `translateY(${y.toFixed(2)}%)`;
  return p;
}

export function countTo(el, t, t0, d, from, to, fmt = (v) => Math.round(v).toLocaleString('ko-KR')) {
  const v = lerp(from, to, P(t, t0, d, ease.outCubic));
  const txt = fmt(v);
  if (el.textContent !== txt) el.textContent = txt;
  return v;
}

export function prepDraw(path) {
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len} ${len}`;
  path.dataset.len = len;
}
export function draw(path, t, t0, d, e = ease.inOutCubic) {
  const len = +path.dataset.len;
  path.style.strokeDashoffset = (len * (1 - P(t, t0, d, e))).toFixed(2);
}

export const fmtMan = (v) => `${Math.round(v).toLocaleString('ko-KR')}`;

// ---------------------------------------------------------------- 배경
const PALETTES = {
  0: ['#FFD9C9', '#CFF1E6', '#DCE8FF'],
  1: ['#CDEFE4', '#DAE7FF', '#FFE1D3'],
  2: ['#FFE6B3', '#FFD9C9', '#D7F1E8'],
  3: ['#E6E1FF', '#DAE7FF', '#FFE1D3'],
  4: ['#D2F0E6', '#FFE9BF', '#DCE8FF'],
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], p))).join(',')})`; };

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function buildBackground(layer) {
  const blobs = [0, 1, 2].map(() => {
    const b = document.createElement('div');
    b.className = 'blob';
    layer.append(b);
    return b;
  });
  const bokeh = [];
  const rnd = seeded(7);
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('div');
    b.className = 'bokeh';
    const size = 18 + rnd() * 46;
    Object.assign(b.style, { width: `${size}px`, height: `${size}px` });
    layer.append(b);
    bokeh.push({ el: b, x: rnd() * 1920, y: rnd() * 1080, sp: 0.2 + rnd() * 0.5, ph: rnd() * 10, ring: rnd() > 0.5 });
  }
  // 정적인 필름 그레인 (시드 고정)
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const r2 = seeded(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r2() > 0.5 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(r2() * 16);
  }
  g.putImageData(img, 0, 0);
  const grain = document.createElement('div');
  grain.className = 'grain';
  grain.style.backgroundImage = `url(${c.toDataURL()})`;
  grain.style.opacity = '0.55';
  layer.append(grain);
  return { blobs, bokeh };
}

function updateBackground(bg, t, pal) {
  const pos = [
    [-380 + wave(t, 23, 90), -420 + wave(t, 19, 70, 0.3)],
    [1060 + wave(t, 29, 110, 0.6), 260 + wave(t, 21, 90, 1.1)],
    [260 + wave(t, 31, 120, 1.4), 520 + wave(t, 27, 80, 0.2)],
  ];
  bg.blobs.forEach((b, i) => {
    b.style.transform = `translate(${pos[i][0].toFixed(1)}px,${pos[i][1].toFixed(1)}px)`;
    b.style.background = `radial-gradient(closest-side, ${pal[i]} 0%, ${pal[i].replace('rgb', 'rgba').replace(')', ',0.55)')} 45%, ${pal[i].replace('rgb', 'rgba').replace(')', ',0)')} 100%)`;
    b.style.opacity = i === 2 ? '0.6' : '0.8';
  });
  bg.bokeh.forEach((k) => {
    const x = (k.x + t * 12 * k.sp) % 2000 - 40;
    const y = k.y + wave(t, 9 + k.ph, 30, k.ph);
    k.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    k.el.style.background = k.ring ? 'transparent' : 'rgba(255,255,255,0.55)';
    k.el.style.border = k.ring ? '3px solid rgba(255,255,255,0.7)' : 'none';
  });
}

// ---------------------------------------------------------------- 자막
const HL = /(6\+6|고용24|\d[\d,]*(?:천만 원|만 원|개월|년|월|일|%|세|학년|번|분|주)?)/g;
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const highlight = (s) => escapeHtml(s).replace(HL, '<b>$1</b>');

function buildCaptions(timeline) {
  const chunks = timeline.lines.flatMap((l) => l.chunks.map((c) => ({ ...c })));
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].show = next ? Math.min(next.start, chunks[i].end + 0.45) : chunks[i].end + 0.45;
  }
  return chunks;
}

// ---------------------------------------------------------------- 메인
export async function start({ timeline, scenes, chapters, asOf = '' }) {
  const stage = document.getElementById('stage');
  const bgLayer = mount(stage, '<div class="layer" data-r="bg"></div>').bg;
  const bg = buildBackground(bgLayer);
  const scenesLayer = mount(stage, '<div class="layer" data-r="scenes"></div>').scenes;
  const overlay = mount(stage, `
    <div class="layer" data-r="overlay">
      <div id="chip-part" data-r="chip"><span class="tag" data-r="chipTag"></span><span data-r="chipText"></span></div>
      <div id="progress" data-r="progress"></div>
      <div id="stamp" data-r="stamp"></div>
      <div id="caption"><div class="pill" data-r="cap"></div></div>
      <div id="chapter-card" data-r="card"></div>
    </div>`);

  overlay.stamp.textContent = asOf;
  const lineMap = Object.fromEntries(timeline.lines.map((l) => [l.id, l]));
  const sceneMap = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
  const sfx = [];
  const addSfx = (time, name, gain = 1) => sfx.push({ t: Math.max(0, +time.toFixed(3)), name, gain });

  // 챕터 구간 계산
  const chapterRanges = {};
  timeline.scenes.forEach((s) => {
    if (s.chapter == null) return;
    const r = chapterRanges[s.chapter] || (chapterRanges[s.chapter] = { start: s.start, end: s.end });
    r.start = Math.min(r.start, s.start);
    r.end = Math.max(r.end, s.end);
  });
  const chapterAt = (t) => {
    for (const [k, r] of Object.entries(chapterRanges)) if (t >= r.start && t < r.end) return +k;
    return 0;
  };

  // 진행 막대
  const segs = Object.keys(chapters).map((k) => {
    const c = chapters[k];
    const r = mount(overlay.progress, `<div class="seg" data-r="seg${k}"><i data-r="fill${k}" style="background:var(--${c.color})"></i><span class="lbl">${c.short}</span></div>`);
    return { k: +k, seg: r[`seg${k}`], fill: r[`fill${k}`] };
  });

  // 챕터 전환 카드
  const cards = {};
  for (const [k, c] of Object.entries(chapters)) {
    if (!c.card) continue;
    const r = mount(overlay.card, `
      <div class="sheet" data-r="sheet${k}" style="background:linear-gradient(135deg, ${c.card[0]}, ${c.card[1]})">
        <div class="abs" style="left:-160px;top:-220px;width:760px;height:760px;border-radius:50%;background:rgba(255,255,255,0.10)"></div>
        <div class="abs" style="right:-120px;bottom:-260px;width:680px;height:680px;border-radius:50%;background:rgba(255,255,255,0.08)"></div>
        <div class="abs col" data-r="content${k}" style="left:0;right:0;top:0;bottom:0;align-items:center;justify-content:center;color:#fff">
          <div class="row" style="gap:14px;height:62px;padding:0 28px;border-radius:31px;background:rgba(255,255,255,0.22);font-size:30px;font-weight:800;letter-spacing:0.04em">${icon(c.icon, { size: 34, stroke: 2.4 })}${c.label}</div>
          <div style="font-size:168px;font-weight:880;letter-spacing:-0.04em;margin-top:26px;line-height:1">${c.title}</div>
          <div style="font-size:50px;font-weight:700;margin-top:30px;opacity:0.94">${c.sub}</div>
        </div>
      </div>`);
    const T = chapterRanges[k].start;
    cards[k] = { sheet: r[`sheet${k}`], content: r[`content${k}`], T };
    addSfx(T - 0.55, 'whoosh', 0.9);
  }

  // 장면 빌드
  const runtime = [];
  for (const def of scenes) {
    const ids = def.ids || [def.id];
    const first = sceneMap[ids[0]];
    const last = sceneMap[ids[ids.length - 1]];
    if (!first || !last) throw new Error(`timeline에 장면이 없습니다: ${ids}`);
    const root = document.createElement('div');
    root.className = 'scene';
    scenesLayer.append(root);
    const hasCard = chapters[first.chapter]?.card && chapterRanges[first.chapter]?.start === first.start;
    const ctx = {
      start: first.start,
      end: last.end,
      in: first.start + (hasCard ? 0.95 : 0.22),
      L: (id) => lineMap[id],
      at: (id, k = 0) => lineMap[id].chunks[Math.min(k, lineMap[id].chunks.length - 1)].start,
      lend: (id) => lineMap[id].end,
      sfx: addSfx,
    };
    const update = def.build(root, ctx);
    runtime.push({ def, root, ctx, update });
  }

  const captions = buildCaptions(timeline);
  let lastCap = null;

  window.renderFrame = (t) => {
    // 배경 색상: 챕터 전환 시 부드럽게 보간
    const ch = chapterAt(t);
    const chPrev = chapterAt(Math.max(0, t - 1.8));
    const since = ch === chPrev ? 1 : clamp((t - (chapterRanges[ch]?.start ?? 0)) / 1.8);
    const pa = PALETTES[chPrev] || PALETTES[0];
    const pb = PALETTES[ch] || PALETTES[0];
    const k = ease.inOutSine(ch === chPrev ? 1 : since);
    updateBackground(bg, t, pb.map((c, i) => mix(pa[i], c, k)));

    // 장면
    for (const rt of runtime) {
      const { ctx, root, def } = rt;
      const visible = t >= ctx.start - 0.25 && t <= ctx.end + 0.5;
      root.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      rt.update(t);
      const life = clamp((t - ctx.start) / Math.max(1, ctx.end - ctx.start));
      const zoom = 1 + 0.018 * ease.inOutSine(life);
      if (def.noExit) {
        tf(root, { s: zoom });
      } else {
        const q = P(t, ctx.end - 0.3, 0.46, ease.inOutCubic);
        tf(root, { y: -26 * q, s: zoom * lerp(1, 0.985, q), o: 1 - q });
      }
    }

    // 챕터 카드
    for (const c of Object.values(cards)) {
      const pin = P(t, c.T - 0.55, 0.55, ease.outQuart);
      const pout = P(t, c.T + 0.5, 0.5, ease.inQuart);
      const active = t > c.T - 0.6 && t < c.T + 1.05;
      c.sheet.style.display = active ? 'block' : 'none';
      if (!active) continue;
      const y = (1 - pin) * H - pout * H;
      c.sheet.style.transform = `translateY(${y.toFixed(1)}px)`;
      c.sheet.style.borderRadius = `${Math.round((1 - pin) * 90 + pout * 90)}px`;
      const cy = (1 - pin) * 220 - pout * 160;
      c.content.style.transform = `translateY(${cy.toFixed(1)}px)`;
    }

    // 파트 칩 + 진행 막대
    const info = chapters[ch];
    const chipOn = info ? P(t, chapterRanges[ch].start + (info.card ? 0.95 : 0.1), 0.5) * (1 - P(t, chapterRanges[ch].end - 0.35, 0.35)) : 0;
    if (info) {
      overlay.chipTag.textContent = info.label;
      overlay.chipTag.style.background = `var(--${info.color})`;
      overlay.chipText.textContent = info.sub;
    }
    tf(overlay.chip, { x: -30 * (1 - chipOn), o: chipOn });
    tf(overlay.progress, { y: -12 * (1 - chipOn), o: chipOn });
    tf(overlay.stamp, { y: -12 * (1 - chipOn), o: chipOn });
    for (const s of segs) {
      const r = chapterRanges[s.k];
      const f = r ? clamp((t - r.start) / (r.end - r.start)) : 0;
      s.fill.style.width = `${(f * 100).toFixed(2)}%`;
    }

    // 자막
    const cap = captions.find((c) => t >= c.start && t < c.show);
    if (cap) {
      if (cap !== lastCap) { overlay.cap.innerHTML = highlight(cap.text); lastCap = cap; }
      const pin = P(t, cap.start, 0.16, ease.outCubic);
      const pout = 1 - P(t, cap.show - 0.14, 0.14, ease.linear);
      const isFirst = captions.indexOf(cap) === 0 || captions[captions.indexOf(cap) - 1].show < cap.start - 0.01;
      tf(overlay.cap, { y: (1 - pin) * 10, o: (isFirst ? pin : lerp(0.55, 1, pin)) * pout });
    } else {
      opacity(overlay.cap, 0);
      lastCap = null;
    }
  };

  window.__duration = timeline.duration;
  window.__sfx = sfx.sort((a, b) => a.t - b.t);
  await document.fonts.ready;
  window.__ready = true;
}
