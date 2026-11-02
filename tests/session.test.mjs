/* Decisão de restaurar a sessão anterior: protege o "Out of Memory" do site.
   A sessão guarda o projeto com as imagens em base64; acima do teto o app
   pergunta antes de abrir em vez de decodificar tudo e travar. */
import fs from 'node:fs';
import { ok, resumo } from './zip-kit.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const marca = 'function astSessaoPesada(';
const ini = html.indexOf(marca);
if (ini < 0) throw new Error('astSessaoPesada não encontrada no index.html');

function recorta(src, inicio) {
  const abre = src.indexOf('{', inicio);
  let nivel = 0;
  for (let i = abre; i < src.length; i++) {
    if (src[i] === '{') nivel++;
    else if (src[i] === '}') { nivel--; if (!nivel) return src.slice(inicio, i + 1); }
  }
  throw new Error('função sem fim');
}
const SESSION_MAX_MB = Number((html.match(/const SESSION_MAX_MB = (\d+)/) || [])[1] || 0);
const astSessaoPesada = new Function('SESSION_MAX_MB', recorta(html, ini) + '\nreturn astSessaoPesada;')(SESSION_MAX_MB);

const MB = 1048576;
console.log('Teto da sessão: ' + SESSION_MAX_MB + ' MB');
ok(SESSION_MAX_MB >= 32 && SESSION_MAX_MB <= 256, 'teto configurado entre 32 e 256 MB', SESSION_MAX_MB);
ok(astSessaoPesada(10 * MB) === false, 'sessão de 10 MB abre direto');
ok(astSessaoPesada(SESSION_MAX_MB * MB) === false, 'exatamente no teto abre direto');
ok(astSessaoPesada(SESSION_MAX_MB * MB + 1) === true, '1 byte acima do teto já pergunta');
ok(astSessaoPesada(300 * MB) === true, 'sessão de 300 MB pergunta antes');
ok(astSessaoPesada(0) === false && astSessaoPesada(undefined) === false, 'sessão vazia não pergunta');
ok(astSessaoPesada(5 * MB, 2) === true, 'limite alternativo é respeitado');

/* os atalhos de URL precisam existir no código */
ok(/flags\.get\('safe'\) === '1'/.test(html), '?safe=1 existe');
ok(/flags\.get\('limpar'\) === '1'/.test(html), '?limpar=1 existe');
ok(/restaurar'\) === 'antiga'/.test(html), '?restaurar=antiga existe');
ok(/ssSemSessao = true/.test(html), 'modo seguro não grava por cima da sessão');

process.exit(resumo() ? 0 : 1);
