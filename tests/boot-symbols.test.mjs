/* Boot · símbolos: toda função chamada no app tem que existir.
   Nasceu da 3.5.4: ao remover o Shape Halftone o recorte levou junto a função
   compileShader(), e o app morria no boot com "compileShader is not defined"
   (a tela caía no home). Este teste lê os scripts do index.html, tira
   comentários/strings/regex e confere se cada nome chamado foi definido em
   algum lugar do arquivo. Roda sem dependência nenhuma. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');

/* remove comentários, strings/regex e template literals: sobra só código */
function limpa(s) {
  let out = '', i = 0;
  const fimDeExpressao = () => /[=(,:;[!&|?{}+\-*%<>~^]$/.test(out.replace(/\s+$/, '')) || /\breturn$/.test(out.replace(/\s+$/, ''));
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const f = s.indexOf('*/', i + 2); i = f < 0 ? s.length : f + 2; continue; }
    if (c === '/' && fimDeExpressao()) {
      i++;
      while (i < s.length && s[i] !== '/') {
        if (s[i] === '\\') i++;
        else if (s[i] === '[') { while (i < s.length && s[i] !== ']') i++; }
        i++;
      }
      i++;
      while (i < s.length && /[a-z]/.test(s[i])) i++;
      out += '/r/';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
      i++;
      out += ' "" ';
      continue;
    }
    out += c; i++;
  }
  return out;
}

const limpo = limpa(js);

/* ---------- definições ---------- */
const definidos = new Set();
for (const re of [/\bfunction\s+([A-Za-z_$][\w$]*)/g, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, /\bclass\s+([A-Za-z_$][\w$]*)/g]) {
  for (const m of limpo.matchAll(re)) definidos.add(m[1]);
}
for (const m of limpo.matchAll(/\bfunction\b[^(]*\(([^)]*)\)/g)) {
  for (const p of m[1].split(',')) { const n = p.trim().replace(/[=:].*/, '').trim(); if (n) definidos.add(n); }
}
for (const m of limpo.matchAll(/\(([^()]*)\)\s*=>/g)) {
  for (const p of m[1].split(',')) { const n = p.trim().replace(/[=:].*/, '').trim(); if (n) definidos.add(n); }
}
for (const m of limpo.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) definidos.add(m[1]);
for (const m of limpo.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) definidos.add(m[1]);
for (const m of limpo.matchAll(/\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)/g)) definidos.add(m[1]);
for (const m of limpo.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*(?:function|\()/g)) definidos.add(m[1]);

/* ---------- chamadas ---------- */
const chamados = new Map();
for (const m of limpo.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
  chamados.set(m[2], (chamados.get(m[2]) || 0) + 1);
}

const palavras = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'do', 'else',
  'await', 'async', 'case', 'delete', 'void', 'in', 'of', 'instanceof', 'yield', 'super', 'this', 'try', 'var', 'with']);
const globais = new Set(('parseInt parseFloat isNaN isFinite setTimeout setInterval clearTimeout clearInterval ' +
  'requestAnimationFrame cancelAnimationFrame fetch atob btoa encodeURIComponent decodeURIComponent alert confirm prompt ' +
  'structuredClone queueMicrotask matchMedia getComputedStyle Blob File FileReader Image Audio Path2D Option Event ' +
  'CustomEvent MouseEvent PointerEvent KeyboardEvent WheelEvent ClipboardEvent DOMException DataTransfer Response ' +
  'URL URLSearchParams TextEncoder TextDecoder AudioContext OfflineAudioContext AudioData VideoFrame ImageData ImageBitmap ' +
  'createImageBitmap Number String Boolean Array Object Promise Map Set WeakMap WeakSet Date RegExp Error TypeError ' +
  'RangeError SyntaxError Symbol BigInt Uint8Array Uint8ClampedArray Uint16Array Uint32Array Int8Array Int16Array Int32Array ' +
  'Float32Array Float64Array DataView ArrayBuffer AbortController ResizeObserver MutationObserver IntersectionObserver ' +
  'ImageDecoder VideoEncoder AudioEncoder DecompressionStream CompressionStream MediaRecorder SpeechSynthesisUtterance ' +
  'FontFace Worker WebAssembly Intl JSON').split(/\s+/));

/* nomes que o analisador não resolve e que são legítimos (destructuring/métodos
   emprestados). Se aparecer um nome novo aqui depois de uma remoção, é função
   que sumiu do arquivo — é exatamente o que o teste tem que denunciar. */
const CONHECIDOS = new Set(['cyl', 'i18nElAttrs', 'dump', 'restore', 'delAssetFolder', 'setAssetFolder', 'renameFolder',
  'delFolder', 'setFolder', 'rename', 'linksEl', 'poolSize', 'texCacheSize', 'tl', 'vetEstado', 'nosDesativados']);

console.log('Boot · símbolos');
console.log('  definidos ' + definidos.size + ' · chamados ' + chamados.size);

const fora = [...chamados.keys()].filter(n => !definidos.has(n) && !palavras.has(n) && !globais.has(n)).sort();
const novas = fora.filter(n => !CONHECIDOS.has(n));

ok(!novas.length, 'toda função chamada no app existe' + (novas.length ? ': ' + novas.map(n => n + '()').join(', ') : ''), novas.join(', '));
ok(!fora.includes('compileShader') || definidos.has('compileShader'), 'compileShader() existe (o boot compila os shaders)');
for (const nome of ['compileShader', 'draw', 'pointOp', 'restoreGraph', 'bypassShapeHalftone', 'createNode', 'serialize']) {
  ok(definidos.has(nome), 'função do boot presente: ' + nome + '()', nome);
}
ok(definidos.has('SHADERS') && definidos.has('NODE_TYPES') && definidos.has('RUN'), 'dicionários do app declarados');
ok(fora.length <= CONHECIDOS.size, 'nenhum símbolo novo sem definição', fora.length);

process.exit(resumo() ? 0 : 1);
