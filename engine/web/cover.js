// 채널 표지 장면 "더나은 정보" — 모든 에피소드 첫 화면에 공통으로 씁니다.
// 왼쪽: 채널의 '블록' 로고(가운데 칸이 로고 마크), 오른쪽: 채널 이름·소개, 오른쪽 아래: 가족, 왼쪽 아래: 이번 화.
// 사용: import { coverScene } from '../../engine/web/cover.js';
//       const cover = coverScene({ n: 1, title: '육아휴직 6개월 연장 & 6+6' });  // script.json 맨 앞에 {"id": "cover", "duration": 3.6}
import { ease, P, wave, mount, enter, pop, drop, rise, icon } from './engine.js';
import { family, blink } from './art.js';

export const CHANNEL = {
  name: '더나은 정보',
  chip: '출산·육아 정책 & 꿀팁',
  tagline: '출산·육아 정책과 꿀팁을 쉽고 정확하게',
};

const MINT = 'background:linear-gradient(160deg,#3CC7AE,#14997F)';
const LAV = 'background:linear-gradient(160deg,#9C8CFF,#6F5EE8)';
const LOGO = 'background:linear-gradient(150deg,#2DBFA4,#2F6FE0);box-shadow:0 20px 44px rgba(47,111,224,0.3)';
// 3×3 블록: [클래스, 인라인 배경, 아이콘]  가운데(4번)가 로고 마크
const TILES = [
  ['gold', '', null], ['coral', '', 'baby'], ['', MINT, null],
  ['blue', '', 'coins'], ['', LOGO, 'heart-handshake'], ['gold', '', 'lightbulb'],
  ['', LAV, null], ['', MINT, 'calendar-check'], ['coral', '', 'heart'],
];

/** 채널 표지 장면. n: 화수, title: 이번 화 짧은 제목 */
export function coverScene({ n, title, id = 'cover' }) {
  return {
    id,
    build(root, c) {
      const S = 150, G = 22, X0 = 200, Y0 = 250;
      const tiles = TILES.map(([cls, bg, ic], i) => `
        <div class="block ${cls}" data-r="t${i}" style="left:${X0 + (i % 3) * (S + G)}px;top:${Y0 + Math.floor(i / 3) * (S + G)}px;width:${S}px;height:${S}px;border-radius:${i === 4 ? 44 : 38}px;${bg};display:flex;align-items:center;justify-content:center;color:#fff">
          ${ic ? icon(ic, { size: i === 4 ? 92 : 74, stroke: i === 4 ? 2.2 : 2.4 }) : ''}
        </div>`).join('');
      const r = mount(root, `
        <div class="abs" style="left:-300px;top:-260px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,rgba(207,241,230,0.9),rgba(207,241,230,0))"></div>
        <div class="abs" style="right:-280px;bottom:-320px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,213,196,0.9),rgba(255,213,196,0))"></div>
        ${tiles}
        <div class="abs chip lav" data-r="chip" style="left:820px;top:262px;height:62px;font-size:31px;padding:0 26px">${icon('sparkles', { size: 32 })}${CHANNEL.chip}</div>
        <div class="abs" style="left:810px;top:348px;height:230px;overflow:hidden"><div class="disp" data-r="name" style="font-size:190px;line-height:1.15;color:#1F2A37">더<span style="color:#14997F">나은</span> 정보</div></div>
        <div class="abs" data-r="tag" style="left:824px;top:590px;font-size:44px;font-weight:720;letter-spacing:-0.02em;color:#4A5563;white-space:nowrap">${CHANNEL.tagline}</div>
        <div class="abs" data-r="fam" style="left:1330px;top:650px">${family(500)}</div>
        <div class="abs row" data-r="ep" style="left:200px;top:820px;gap:16px;height:78px;padding:0 32px;border-radius:39px;background:#1F2A37;color:#fff;font-size:34px;font-weight:820;box-shadow:0 14px 32px rgba(31,42,55,0.22);white-space:nowrap"><span style="color:#FFC94D">${n}화</span>${title}</div>`);
      const T = c.start;
      TILES.forEach((_, i) => { if (i !== 4) c.sfx(T + 0.25 + i * 0.07 + 0.35, 'tick', 0.22); });
      c.sfx(T + 1.0, 'pop', 0.6);
      c.sfx(T + 1.25, 'sparkle', 0.55);
      c.sfx(T + 2.05, 'whoosh', 0.25);
      return (t) => {
        TILES.forEach((_, i) => {
          if (i === 4) pop(r.t4, t, T + 0.95, { s0: 0.2, d: 0.6, r: wave(t, 3, 2) * P(t, T + 1.5, 0.5) });
          else drop(r[`t${i}`], t, T + 0.25 + i * 0.07, { h: 160 });
        });
        pop(r.chip, t, T + 1.2, {});
        rise(r.name, t, T + 1.3, { d: 0.8 });
        enter(r.tag, t, T + 1.65, { dy: 20 });
        enter(r.fam, t, T + 1.85, { dy: 40, s0: 0.9, y: wave(t, 3, 4) });
        blink(r.fam, t, 2);
        enter(r.ep, t, T + 2.05, { dx: -40, dy: 0, e: ease.outCubic });
      };
    },
  };
}
