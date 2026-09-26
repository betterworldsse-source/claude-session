// 직접 그린 벡터 일러스트 (엄마 · 아빠 · 아기 · 가족)
// 모든 캐릭터는 <g class="eyes"> 를 가지고 있어 blink()로 눈을 깜빡일 수 있습니다.

const SKIN = { mom: '#FFDCC7', dad: '#F9D4BA', baby: '#FFE3D1' };
const HAIR = { mom: '#3E2C29', dad: '#2F2A2A', baby: '#6B4A3F' };

const eyes = (lx, rx, y, rX = 4.6, rY = 5.8, color = '#2A2323') => `
  <g class="eyes" style="transform-box:fill-box;transform-origin:50% 50%">
    <ellipse cx="${lx}" cy="${y}" rx="${rX}" ry="${rY}" fill="${color}"/>
    <ellipse cx="${rx}" cy="${y}" rx="${rX}" ry="${rY}" fill="${color}"/>
    <circle cx="${lx + 1.6}" cy="${y - 2}" r="1.5" fill="#fff" opacity=".85"/>
    <circle cx="${rx + 1.6}" cy="${y - 2}" r="1.5" fill="#fff" opacity=".85"/>
  </g>`;

const blush = (lx, rx, y, color = '#FF9C8A') => `
  <ellipse cx="${lx}" cy="${y}" rx="10" ry="6" fill="${color}" opacity=".42"/>
  <ellipse cx="${rx}" cy="${y}" rx="10" ry="6" fill="${color}" opacity=".42"/>`;

/** 엄마: 단발 웨이브, 코랄 상의 */
export function mom({ shirt = '#FF7D66', w = 200 } = {}) {
  return `
  <svg class="char mom" viewBox="0 0 200 240" width="${w}" height="${w * 1.2}">
    <path d="M46 116 C38 62 68 30 100 30 C134 30 164 60 154 116 C151 138 156 156 164 170 C150 180 128 178 118 170 L82 170 C72 178 50 180 36 170 C44 156 49 138 46 116 Z" fill="${HAIR.mom}"/>
    <path d="M26 240 C28 198 58 172 100 172 C142 172 172 198 174 240 Z" fill="${shirt}"/>
    <path d="M84 176 Q100 196 116 176" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
    <path d="M87 140 h26 v32 c0 9 -26 9 -26 0 Z" fill="#F2BFA2"/>
    <ellipse cx="100" cy="106" rx="45" ry="47" fill="${SKIN.mom}"/>
    <path d="M55 104 C52 66 76 46 104 46 C130 47 149 64 147 96 C137 88 124 76 116 64 C106 82 84 96 55 104 Z" fill="${HAIR.mom}"/>
    <circle cx="57" cy="122" r="4" fill="#F5B83D"/>
    ${eyes(83, 117, 112)}
    ${blush(72, 128, 128)}
    <path d="M90 131 Q100 140 110 131" fill="none" stroke="#8A4238" stroke-width="3.6" stroke-linecap="round"/>
  </svg>`;
}

/** 아빠: 짧은 머리, 둥근 안경, 블루 셔츠 */
export function dad({ shirt = '#4C8DF6', w = 200 } = {}) {
  return `
  <svg class="char dad" viewBox="0 0 200 240" width="${w}" height="${w * 1.2}">
    <path d="M26 240 C28 198 58 172 100 172 C142 172 172 198 174 240 Z" fill="${shirt}"/>
    <path d="M82 173 L100 194 L118 173 Z" fill="#fff" opacity=".9"/>
    <path d="M87 140 h26 v32 c0 9 -26 9 -26 0 Z" fill="#EDB996"/>
    <circle cx="55" cy="110" r="10" fill="#F4C6A8"/>
    <circle cx="145" cy="110" r="10" fill="#F4C6A8"/>
    <ellipse cx="100" cy="106" rx="45" ry="47" fill="${SKIN.dad}"/>
    <path d="M55 102 C50 62 76 44 104 44 C134 44 152 64 146 98 C142 84 132 74 118 70 C104 80 78 82 55 102 Z" fill="${HAIR.dad}"/>
    ${eyes(83, 117, 112, 4.4, 5.4)}
    <g fill="none" stroke="#2F3A4A" stroke-width="3.2" stroke-linejoin="round">
      <rect x="68" y="100" width="30" height="24" rx="10"/>
      <rect x="102" y="100" width="30" height="24" rx="10"/>
      <path d="M98 110 h4"/>
    </g>
    ${blush(70, 130, 131)}
    <path d="M90 133 Q100 142 110 133" fill="none" stroke="#7A3E36" stroke-width="3.6" stroke-linecap="round"/>
  </svg>`;
}

/** 아기: 동그란 얼굴, 머리 한 가닥, 노란 우주복 */
export function baby({ suit = '#FFC94D', w = 160 } = {}) {
  return `
  <svg class="char baby" viewBox="0 0 160 170" width="${w}" height="${w * 1.0625}">
    <path d="M30 170 C32 134 54 116 80 116 C106 116 128 134 130 170 Z" fill="${suit}"/>
    <circle cx="80" cy="146" r="6" fill="#fff" opacity=".7"/>
    <circle cx="33" cy="76" r="9" fill="#FFD6BF"/>
    <circle cx="127" cy="76" r="9" fill="#FFD6BF"/>
    <circle cx="80" cy="74" r="48" fill="${SKIN.baby}"/>
    <path d="M72 30 C66 18 84 12 88 22 C91 30 80 34 78 27" fill="none" stroke="${HAIR.baby}" stroke-width="4.5" stroke-linecap="round"/>
    ${eyes(62, 98, 80, 5.2, 6.2)}
    ${blush(52, 108, 96, '#FF9C8A')}
    <path d="M73 99 Q80 106 87 99" fill="none" stroke="#8A4238" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

/** 원형 아바타 (얼굴 중심으로 크롭) */
export function avatar(kind, size = 84, bg = null) {
  const fill = bg ?? { mom: '#FFE3DC', dad: '#DEE9FF', baby: '#FFF0D0' }[kind];
  const art = kind === 'mom' ? mom({ w: size * 1.35 }) : kind === 'dad' ? dad({ w: size * 1.35 }) : baby({ w: size * 1.3 });
  const off = kind === 'baby' ? { x: -size * 0.15, y: -size * 0.08 } : { x: -size * 0.175, y: -size * 0.3 };
  return `<div class="avatar" style="position:relative;flex:none;width:${size}px;height:${size}px;background:${fill}">
    <div style="position:absolute;left:${off.x}px;top:${off.y}px">${art}</div></div>`;
}

/** 가족 일러스트: 엄마 · 아기 · 아빠 */
export function family(w = 620) {
  const s = w / 620;
  return `
  <div style="position:relative;width:${w}px;height:${Math.round(360 * s)}px">
    <div data-part="mom" style="position:absolute;left:${10 * s}px;top:${48 * s}px">${mom({ w: 250 * s })}</div>
    <div data-part="dad" style="position:absolute;left:${360 * s}px;top:${40 * s}px">${dad({ w: 250 * s })}</div>
    <div data-part="baby" style="position:absolute;left:${232 * s}px;top:${178 * s}px">${baby({ w: 160 * s })}</div>
    <div data-part="heart" style="position:absolute;left:${282 * s}px;top:${24 * s}px;width:${58 * s}px;height:${58 * s}px">
      <svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="#FF7D66"/></svg>
    </div>
  </div>`;
}

/** 눈 깜빡임: 약 3~5초마다 0.14초 */
export function blink(root, t, seed = 0) {
  const period = 3.4 + (seed % 3) * 0.7;
  const ph = ((t + seed * 1.37) % period) / period;
  const k = ph > 0.965 ? Math.sin(((ph - 0.965) / 0.035) * Math.PI) : 0;
  root.querySelectorAll('.eyes').forEach((e) => { e.style.transform = `scaleY(${(1 - 0.9 * k).toFixed(3)})`; });
}

/** 동전 더미 (돈 표현) */
export function coins(n = 5, w = 120) {
  let out = `<svg viewBox="0 0 120 ${40 + n * 16}" width="${w}" height="${(w / 120) * (40 + n * 16)}">`;
  for (let i = n - 1; i >= 0; i--) {
    const y = 24 + i * 16;
    out += `<ellipse cx="60" cy="${y + 8}" rx="52" ry="16" fill="#E08A00"/>
            <rect x="8" y="${y}" width="104" height="8" fill="#E08A00"/>
            <ellipse cx="60" cy="${y}" rx="52" ry="16" fill="#FFC94D"/>
            <ellipse cx="60" cy="${y}" rx="36" ry="10" fill="none" stroke="#F5A524" stroke-width="3"/>`;
  }
  return out + '</svg>';
}
