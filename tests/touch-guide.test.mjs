import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../docs/style.css',import.meta.url),'utf8');

test('no automatic browser fullscreen and no interactive bottom button pad',()=>{
  assert(!app.includes('requestFullscreen('));
  assert(!app.includes('requestImmersiveFullscreen'));
  for(const id of ['left','right','rotate','down','drop'])assert(!html.includes('id="'+id+'"'));
  assert(!html.includes('maximum-scale=1'));
  assert(!html.includes('apple-mobile-web-app-capable'));
  assert(!css.includes(':fullscreen'));
  assert(!css.includes('min-height:100dvh'));
});
test('accessible keyboard and touch instructions, with explicit soft and hard drops',()=>{
  assert.match(html,/aria-label="游戏操作说明"/);
  assert.match(html,/电脑操作/);assert.match(html,/手机操作/);
  for(const t of ['双击棋盘','左右滑动','长按或缓慢下拖','快速下划','直接落底','空格'])assert(html.includes(t));
  assert.match(css,/\.control-guide\{/);
});
