// 유튜브 썸네일 (1920×1080 좌표로 그린 뒤 1280×720으로 저장) — 1화와 같은 구성
import { icon } from '../../engine/web/engine.js';
import { mom, baby } from '../../engine/web/art.js';

export function buildThumbnail(root) {
  root.innerHTML = `
  <div class="abs" style="inset:0;background:linear-gradient(135deg,#FFF7EC 0%,#FFEBDD 55%,#FFE0CF 100%)"></div>
  <div class="abs" style="right:-220px;top:-160px;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,#FFD0BE,rgba(255,208,190,0))"></div>
  <div class="abs" style="left:-260px;bottom:-420px;width:900px;height:900px;border-radius:50%;background:radial-gradient(closest-side,#D6E4FF,rgba(214,228,255,0))"></div>

  <div class="abs row" style="left:96px;top:78px;gap:18px">
    <div class="row" style="height:84px;padding:0 34px;border-radius:42px;background:#F0525A;color:#fff;font-size:44px;font-weight:880;box-shadow:0 12px 28px rgba(240,82,90,0.3)">2026 신설</div>
    <div class="row" style="gap:12px;height:84px;padding:0 34px;border-radius:42px;background:#1F2A37;color:#fff;font-size:44px;font-weight:840">${icon('list-checks', { size: 46, stroke: 2.6 })}핵심 정리</div>
  </div>

  <div class="abs" style="left:92px;top:210px;font-size:196px;font-weight:920;letter-spacing:-0.055em;line-height:1.02;color:#1F2A37;white-space:nowrap">육아휴직</div>
  <div class="abs" style="left:92px;top:410px;font-size:196px;font-weight:920;letter-spacing:-0.055em;line-height:1.02;white-space:nowrap">
    <span style="color:#E0700A;background:linear-gradient(transparent 62%,rgba(255,196,61,0.75) 62%,rgba(255,196,61,0.75) 94%,transparent 94%)">1주</span><span style="color:#9AA3B0">·</span><span style="color:#2F6FE0;background:linear-gradient(transparent 62%,rgba(255,196,61,0.75) 62%,rgba(255,196,61,0.75) 94%,transparent 94%)">2주</span>만?
  </div>
  <div class="abs" style="left:98px;top:640px;font-size:136px;font-weight:920;letter-spacing:-0.05em;line-height:1.05;color:#1F2A37;white-space:nowrap">
    <span style="color:#14997F">단기</span> 육아휴직
  </div>
  <div class="abs row" style="left:100px;top:846px;gap:14px;height:92px;padding:0 36px;border-radius:26px;background:#fff;box-shadow:0 16px 40px rgba(31,42,55,0.12);font-size:46px;font-weight:820;color:#1F2A37">
    ${icon('sun', { size: 50, stroke: 2.4, color: '#E0700A' })}방학 · ${icon('thermometer', { size: 50, stroke: 2.4, color: '#F0525A' })}아플 때 쓰는 휴직
  </div>

  <div class="abs" style="left:1130px;top:462px">${mom({ w: 520 })}</div>
  <div class="abs" style="left:1520px;top:700px">${baby({ w: 330 })}</div>

  <div class="abs col center" style="left:1216px;top:110px;width:460px;height:200px;border-radius:44px;background:#1F2A37;color:#fff;box-shadow:0 20px 40px rgba(31,42,55,0.25)">
    <div style="font-size:40px;font-weight:760;opacity:.85">2026. 8. 20.</div>
    <div style="font-size:92px;font-weight:920;letter-spacing:-0.04em;color:#FFC94D;line-height:1.05">시행</div>
    <div class="abs" style="left:210px;bottom:-26px;width:0;height:0;border-left:26px solid transparent;border-right:26px solid transparent;border-top:30px solid #1F2A37"></div>
  </div>
  <div class="abs col center" style="left:1150px;top:352px;width:620px;height:164px;border-radius:40px;background:linear-gradient(135deg,#FFC94D,#F5A524);color:#1F2A37;box-shadow:0 16px 36px rgba(245,165,36,0.35);transform:rotate(-4deg)">
    <div style="font-size:34px;font-weight:800">1주·2주도 급여 지급</div>
    <div style="font-size:66px;font-weight:920;letter-spacing:-0.045em;line-height:1.1">자녀별 연 1회</div>
  </div>`;
}
