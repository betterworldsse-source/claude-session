// HTML 모션그래픽 → 프레임 캡처 → MP4 렌더러
//
//   node engine/render.mjs preview <episode> 12.5 30 61.2   특정 시점 스틸컷(JPG) + 콘택트 시트
//   node engine/render.mjs sfx <episode>                    효과음 이벤트 목록(build/<ep>/sfx.json) 추출
//   node engine/render.mjs video <episode> [--workers 4] [--from 0 --to 20]
//   node engine/render.mjs still <episode> <t> <out.png>     특정 시점 단일 이미지
//   node engine/render.mjs thumb <episode> [out.png]         유튜브 썸네일(1280×720)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(ROOT, url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openStage(browser, port, ep, w = 1920, h = 1080) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: w / 1920 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/engine/web/index.html?ep=${ep}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};

async function main() {
  const [mode, ep, ...rest] = process.argv.slice(2);
  if (!mode || !ep) {
    console.log('usage: node engine/render.mjs <preview|sfx|video|still> <episode> ...');
    process.exit(1);
  }
  const out = path.join(ROOT, 'build', ep);
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch();

  try {
    if (mode === 'preview') {
      const page = await openStage(browser, port, ep);
      const dir = path.join(out, 'preview');
      fs.mkdirSync(dir, { recursive: true });
      const times = rest.filter((x) => !x.startsWith('--')).map(Number);
      const files = [];
      for (const t of times) {
        await page.evaluate((tt) => window.renderFrame(tt), t);
        const f = path.join(dir, `t_${t.toFixed(2).padStart(7, '0')}.jpg`);
        await page.screenshot({ path: f, type: 'jpeg', quality: 90 });
        files.push(f);
      }
      if (files.length > 1) {
        const cols = Math.min(3, files.length);
        const sheet = path.join(dir, 'sheet.jpg');
        const inputs = files.flatMap((f) => ['-i', f]);
        const rows = Math.ceil(files.length / cols);
        const n = rows * cols;
        const pads = [];
        for (let i = files.length; i < n; i++) pads.push('-f', 'lavfi', '-i', 'color=c=white:s=1920x1080:d=1');
        const labels = Array.from({ length: n }, (_, i) => `[${i}:v]scale=640:360[v${i}]`).join(';');
        const stack = Array.from({ length: n }, (_, i) => `[v${i}]`).join('');
        const layout = Array.from({ length: n }, (_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
        execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, ...pads, '-filter_complex', `${labels};${stack}xstack=inputs=${n}:layout=${layout}`, '-frames:v', '1', '-q:v', '3', sheet]);
        console.log('contact sheet:', sheet);
      }
      console.log(files.join('\n'));
    } else if (mode === 'still') {
      const [t, file] = rest;
      const w = +arg('w', 1920), h = +arg('h', 1080);
      const page = await openStage(browser, port, ep, w, h);
      await page.evaluate((tt) => window.renderFrame(tt), +t);
      await page.screenshot({ path: file, type: file.endsWith('.png') ? 'png' : 'jpeg' });
      console.log('saved', file);
    } else if (mode === 'thumb') {
      const file = rest[0] || path.join(ROOT, 'episodes', ep, 'thumbnail.png');
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 / 3 });
      page.on('pageerror', (e) => console.error('[page error]', e.message));
      await page.goto(`http://127.0.0.1:${port}/engine/web/thumb.html?ep=${ep}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      await page.screenshot({ path: file, type: 'png' });
      console.log('thumbnail →', file);
    } else if (mode === 'sfx') {
      const page = await openStage(browser, port, ep);
      const events = await page.evaluate(() => window.__sfx);
      fs.writeFileSync(path.join(out, 'sfx.json'), JSON.stringify(events, null, 1));
      console.log(`${events.length} sfx events → build/${ep}/sfx.json`);
    } else if (mode === 'video') {
      const fps = +arg('fps', 30);
      const workers = +arg('workers', 4);
      const probe = await openStage(browser, port, ep);
      const duration = await probe.evaluate(() => window.__duration);
      await probe.close();
      const from = +arg('from', 0);
      const to = Math.min(+arg('to', duration), duration);
      const f0 = Math.round(from * fps);
      const f1 = Math.round(to * fps);
      const total = f1 - f0;
      const per = Math.ceil(total / workers);
      const chunkDir = path.join(out, 'chunks');
      fs.rmSync(chunkDir, { recursive: true, force: true });
      fs.mkdirSync(chunkDir, { recursive: true });
      console.log(`rendering ${total} frames (${(total / fps).toFixed(1)}s) with ${workers} workers`);
      const started = Date.now();
      let done = 0;
      const tick = setInterval(() => {
        const el = (Date.now() - started) / 1000;
        const eta = done ? (el / done) * (total - done) : 0;
        console.log(`  ${done}/${total} frames · ${el.toFixed(0)}s elapsed · ETA ${eta.toFixed(0)}s`);
      }, 20000);

      const jobs = [];
      for (let w = 0; w < workers; w++) {
        const a = f0 + w * per;
        const b = Math.min(f1, a + per);
        if (a >= b) continue;
        const file = path.join(chunkDir, `chunk_${String(w).padStart(2, '0')}.mp4`);
        jobs.push((async () => {
          const br = await chromium.launch();
          const page = await openStage(br, port, ep);
          const ff = spawn('ffmpeg', [
            '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation',
            '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
            '-g', String(fps * 2), '-threads', '2', file,
          ], { stdio: ['pipe', 'inherit', 'inherit'] });
          const closed = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
          for (let f = a; f < b; f++) {
            await page.evaluate((tt) => window.renderFrame(tt), f / fps);
            const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
            if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
            done++;
          }
          ff.stdin.end();
          await closed;
          await br.close();
          return file;
        })());
      }
      const files = await Promise.all(jobs);
      clearInterval(tick);
      const list = path.join(chunkDir, 'list.txt');
      fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
      const video = path.join(out, 'video_noaudio.mp4');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
      console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s → ${video}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
