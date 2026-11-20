// node bake.mjs car_dl/car1.glb out_dir name  -> out_dir/name_base.png, name_mr.png, name_layout.json
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-phantom-grid/e1c1d22b-2cf2-5343-80d7-d2f48dbb9811/scratchpad';
const VENDOR = S + '/vendor/node_modules/three';
const jobs = process.argv.slice(2);
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = p === '/bake.html' ? S + '/car_view/bake.html' : S + p;
  if (!file.startsWith(S) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (let i = 0; i < jobs.length; i += 3) {
  const [file, outDir, name] = jobs.slice(i, i + 3);
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', (route) => { const rel = route.request().url().split('three@0.170.0/')[1].split('?')[0]; route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(VENDOR, rel)) }); });
  await page.goto(`http://127.0.0.1:${port}/bake.html?f=/${file}`);
  await page.waitForFunction(() => window.DONE, null, { timeout: 280000 });
  const out = await page.evaluate(() => window.DONE);
  fs.mkdirSync(`${S}/${outDir}`, { recursive: true });
  fs.writeFileSync(`${S}/${outDir}/${name}_base.png`, Buffer.from(out.base.split(',')[1], 'base64'));
  if (out.mr) fs.writeFileSync(`${S}/${outDir}/${name}_mr.png`, Buffer.from(out.mr.split(',')[1], 'base64'));
  fs.writeFileSync(`${S}/${outDir}/${name}_depth.png`, Buffer.from(out.depth.split(',')[1], 'base64'));
  fs.writeFileSync(`${S}/${outDir}/${name}_layout.json`, JSON.stringify(out.layout));
  console.log('baked', name, out.layout.dims.map((v) => v.toFixed(3)).join(' x '));
  await page.close();
}
await browser.close(); server.close();
