/* tests/glsl-parse.test.mjs — sintaxe de TODOS os fragment shaders do index.html.
   Precisa do parser: `npm i --no-save --prefix /tmp/glsl @shaderfrog/glsl-parser`
   e GLSL_PARSER=/tmp/glsl/node_modules/@shaderfrog/glsl-parser/index.js
   (sem o parser, o teste sai 0 avisando que foi ignorado — a suíte continua verde
   em máquina sem rede; no CI o passo instala e valida de verdade). */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');

async function carregaParser() {
  const tentativas = [process.env.GLSL_PARSER, '@shaderfrog/glsl-parser',
    '/tmp/glsl/node_modules/@shaderfrog/glsl-parser/index.js'].filter(Boolean);
  for (const t of tentativas) {
    try {
      const m = t.startsWith('/') ? await import(pathToFileURL(t).href) : await import(t);
      if (m && m.parser) return m.parser;
    } catch (_) { /* tenta o próximo */ }
  }
  return null;
}
const parser = await carregaParser();
if (!parser) {
  console.log('ignorado: @shaderfrog/glsl-parser não está instalado (rode no CI)');
  process.exit(0);
}

/* lê uma template string JS de verdade (com ${...} aninhado, escapes e tudo) */
function leTemplate(src, abre) {
  let i = abre + 1, out = '', prof = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { out += src[i] + src[i + 1]; i += 2; continue; }
    if (prof === 0 && c === '`') return out;
    if (c === '$' && src[i + 1] === '{') {
      // expressão: consome balanceando chaves e guarda o nome quando é só um identificador
      let j = i + 2, d = 1, expr = '';
      while (j < src.length && d > 0) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') { d--; if (!d) break; }
        expr += src[j]; j++;
      }
      out += '${' + expr.trim() + '}';
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
function constTemplate(nome) {
  const m = new RegExp('const ' + nome + ' = `', 'm').exec(html);
  return m ? leTemplate(html, m.index + m[0].length - 1) : null;
}
const CONSTS = new Map();
for (const n of ['FS_HEADER', 'FX4_COMMON', 'BLEND_GLSL']) { const v = constTemplate(n); if (v != null) CONSTS.set(n, v); }

/* todos os shaders: dentro do objeto SHADERS e nas atribuições SHADERS.x = `...` */
const shaders = [];
const abreObj = html.indexOf('const SHADERS = {');
const corpo = leTemplate(html, html.indexOf('`', abreObj) >= 0 ? -1 + 1 : 0); // no-op
{
  // varre o objeto SHADERS procurando "nome: `"
  let i = html.indexOf('{', abreObj) + 1;
  const fimObj = html.indexOf('\n};', abreObj);
  while (i > 0 && i < fimObj) {
    const m = /(\w+)\s*:\s*`/.exec(html.slice(i, fimObj));
    if (!m) break;
    const abre = i + m.index + m[0].length - 1;
    shaders.push([m[1], leTemplate(html, abre)]);
    i = abre + 1;
  }
}
for (const m of html.matchAll(/SHADERS\.(\w+)\s*=\s*`/g)) {
  shaders.push([m[1], leTemplate(html, m.index + m[0].length - 1)]);
}
const header = CONSTS.get('FS_HEADER') || '';
/* o parser é JS: não expande o #define multi-linha do nodeMachine (o navegador
   compila esse shader desde a 2.9.x). Ele fica fora da varredura de sintaxe. */
const IGNORADOS = new Set(['nodeMachine']);
const falhas = [];
let ok = 0, ignorados = 0;
for (const [nome, corpoShader] of shaders) {
  if (IGNORADOS.has(nome)) { ignorados++; continue; }
  const resolvido = String(corpoShader).replace(/\$\{([^}]*)\}/g, (_, e) => CONSTS.get(e.trim()) ?? '');
  try { parser.parse(header + resolvido); ok++; }
  catch (e) { falhas.push([nome, String(e.message).split('\n')[0]]); }
}
const nomes = shaders.map(s => s[0]);
console.log(`${shaders.length} shaders · ${ok} compilam · ${falhas.length} com erro · ${ignorados} fora (macro multi-linha)`);
for (const [n, e] of falhas) console.log('  ✗ ' + n + ': ' + e);

let f = 0;
const ok1 = (c, msg, extra) => { if (!c) { f++; console.log('  ✗ ' + msg + (extra ? ' → ' + extra : '')); } };
ok1(nomes.includes('bsdf'), 'o shader bsdf está no arquivo');
ok1(nomes.includes('shaderMix'), 'o shader shaderMix está no arquivo');
ok1(falhas.length === 0, 'nenhum fragment shader com erro de sintaxe', falhas.map(x => x[0]).join(', '));
ok1(shaders.length >= 95, 'todos os shaders foram encontrados', shaders.length);
console.log(f ? `\n${f} falharam` : '\nGLSL ok');
process.exit(f ? 1 : 0);
