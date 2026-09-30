// Testa um script de console do SEI contra o HTML real de uma instância do CKEditor,
// num Chromium headless com um CKEDITOR simulado. Roda o script duas vezes (idempotência).
//
// Uso: node testar_no_chromium.mjs corpo.html script.js [saida.html] [--screenshot saida.png]
//   corpo.html  HTML da instância editável (getData()), extraído do arquivo de inspeção
//   script.js   IIFE que devolve uma string de status
//   saida.html  resultado após a 1ª execução (padrão: saida.html)
//
// Playwright: no ambiente remoto do Claude Code fica em /opt/node22/lib/node_modules/playwright
// (Chromium em /opt/pw-browsers — não rode `playwright install`). Em outro ambiente:
// `npm i playwright` e `npx playwright install chromium`.
import fs from 'fs';

let pw;
try { pw = await import('playwright'); }
catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium } = pw;

const [corpoPath, scriptPath, saidaArg, ...resto] = process.argv.slice(2);
if (!corpoPath || !scriptPath) {
  console.error('Uso: node testar_no_chromium.mjs corpo.html script.js [saida.html] [--screenshot saida.png]');
  process.exit(1);
}
const saidaPath = saidaArg && !saidaArg.startsWith('--') ? saidaArg : 'saida.html';
const iShot = process.argv.indexOf('--screenshot');
const shotPath = iShot >= 0 ? process.argv[iShot + 1] : null;

const corpo = fs.readFileSync(corpoPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.setContent('<html><body></body></html>');
await page.evaluate((corpo) => {
  const mk = (data, ro) => ({
    _d: data, readOnly: ro, _dirty: false,
    getData() { return this._d; },
    setData(h) { this._d = h; this._dirty = true; },
    checkDirty() { return this._dirty; },
  });
  // Seções típicas: uma somente leitura, uma editável curta (data) e o corpo.
  window.CKEDITOR = { version: '4 (simulado)', instances: {
    txaEditor_ro: mk('<p>MINISTÉRIO DOS POVOS INDÍGENAS</p>', true),
    txaEditor_data: mk('<p class="Texto_Alinhado_Direita"><em>Na data da assinatura eletrônica.</em></p>', false),
    txaEditor_corpo: mk(corpo, false),
  } };
}, corpo);

const r1 = await page.evaluate(script);
const depois1 = await page.evaluate(() => CKEDITOR.instances.txaEditor_corpo.getData());
const r2 = await page.evaluate(script);
const depois2 = await page.evaluate(() => CKEDITOR.instances.txaEditor_corpo.getData());

console.log('--- 1ª execução\n' + r1);
console.log('--- 2ª execução\n' + r2);
console.log('--- idempotente (HTML igual após 1ª e 2ª):', depois1 === depois2);
// Compara as imagens pelo src (a serialização do innerHTML muda a marcação da tag, não a imagem).
const srcs = (h) => [...h.matchAll(/<img\b[^>]*?\bsrc="([^"]*)"/g)].map((m) => m[1]);
console.log('--- <img> antes/depois:', srcs(corpo).length, '/', srcs(depois1).length,
  '| mesmas imagens, mesma ordem:', JSON.stringify(srcs(corpo)) === JSON.stringify(srcs(depois1)));

fs.writeFileSync(saidaPath, depois1);
if (shotPath) {
  await page.setContent('<html><head><meta charset="utf-8"><style>body{font-family:Times;font-size:12pt;width:820px;margin:20px}</style></head><body>' + depois1 + '</body></html>');
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log('--- screenshot:', shotPath);
}
await browser.close();
