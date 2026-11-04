/* Decisão de restaurar a sessão anterior: protege o "Out of Memory" do site.
   A sessão guarda o projeto com as imagens em base64; acima do teto o app
   pergunta antes de abrir em vez de decodificar tudo e travar. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

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

/* ---- limpeza completa (começar do zero) ---- */
{
  console.log('\nLimpeza completa');
  const marca = 'async function astLimpezaCompleta()';
  const pos = html.indexOf(marca);
  ok(pos > 0, 'astLimpezaCompleta existe');
  function recorta(src, inicio) {
    const abre = src.indexOf('{', inicio);
    let nivel = 0;
    for (let i = abre; i < src.length; i++) {
      if (src[i] === '{') nivel++;
      else if (src[i] === '}') { nivel--; if (!nivel) return src.slice(inicio, i + 1); }
    }
    throw new Error('função sem fim');
  }
  const chamadas = { dbs: [], cachesApagados: [], ls: 0, ss: 0, sw: 0 };
  const ambiente = {
    indexedDB: {
      databases: async () => [{ name: 'everything-editor-projects' }, { name: 'everything-editor-mobile' }],
      deleteDatabase: nome => chamadas.dbs.push(nome)
    },
    window: { caches: { keys: async () => ['v1', 'v2'], delete: async k => chamadas.cachesApagados.push(k) } },
    caches: { keys: async () => ['v1', 'v2'], delete: async k => chamadas.cachesApagados.push(k) },
    navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { chamadas.sw++; } }] } },
    localStorage: { clear: () => { chamadas.ls++; } },
    sessionStorage: { clear: () => { chamadas.ss++; } }
  };
  const limpa = new Function(...Object.keys(ambiente), recorta(html, pos) + '\nreturn astLimpezaCompleta;')(...Object.values(ambiente));
  await limpa();
  ok(chamadas.dbs.includes('everything-editor-projects'), 'apaga o banco de projetos/assets', chamadas.dbs);
  ok(chamadas.dbs.includes('everything-editor-mobile'), 'apaga o banco da sessão', chamadas.dbs);
  ok(chamadas.cachesApagados.length === 2, 'apaga o Cache Storage', chamadas.cachesApagados);
  ok(chamadas.ls === 1 && chamadas.ss === 1, 'limpa localStorage e sessionStorage');
  ok(chamadas.sw === 1, 'desregistra service workers');

  ok(/EE_LIMPEZA_MARCA/.test(html) && /EE_LIMPEZA_PENDENTE/.test(html), 'marcadores da limpeza existem');
  ok(/flags\.get\('reset'\) === '1'/.test(html), '?reset=1 reabre a limpeza');
  ok(/Apagar tudo e começar/.test(html) && /Manter meus dados/.test(html), 'diálogo tem as duas opções');
  ok(/Começar do zero\?/.test(html), 'título do diálogo presente');
}

/* ---------- 3.5.4: o nó Shape Halftone saiu do app ---------- */
console.log('Shape Halftone removido');
ok(!/shapeHalftone: \{/.test(html), 'nó não está mais em NODE_TYPES');
ok(!/shapeHalftone: `/.test(html), 'shader não está mais no dicionário');
ok(!/runShapeHalftone|shPanel|shGlyphAtlas|shCurveTexus/.test(html), 'motor do nó apagado');
ok(!/SH_SHAPES|SH_GLYPHS|SH_INK_MODES|SH_SECOES/.test(html), 'tabelas do nó apagadas');
ok(!/\.sh-sec|\.sh-curve|\.sh-range|\.sh-sw/.test(html), 'CSS próprio apagado');
{
  const ini2 = html.indexOf('function bypassShapeHalftone(');
  ok(ini2 > 0, 'existe a migração dos projetos antigos', ini2);
  const bypass = new Function(recorta(html, ini2) + '\nreturn bypassShapeHalftone;')();
  const sem = [{ from: 1, to: 2, input: 0, output: 0 }];
  ok(bypass({ nodes: [] }, sem) === sem, 'grafo sem o nó passa intacto');

  const um = bypass({ nodes: [{ id: 2, type: 'shapeHalftone' }] },
    [{ from: 1, to: 2, input: 0, output: 0 }, { from: 2, to: 3, input: 0, output: 0 }]);
  ok(um.length === 1 && um[0].from === 1 && um[0].to === 3, 'a imagem de entrada é religada no que vinha depois', JSON.stringify(um));

  const dois = bypass({ nodes: [{ id: 2, type: 'shapeHalftone' }, { id: 3, type: 'shapeHalftone' }] },
    [{ from: 1, to: 2, input: 0, output: 0 }, { from: 2, to: 3, input: 0, output: 0 }, { from: 3, to: 4, input: 0, output: 0 }]);
  ok(dois.length === 1 && dois[0].from === 1 && dois[0].to === 4, 'dois nós em série viram um salto só', JSON.stringify(dois));

  const orfao = bypass({ nodes: [{ id: 5, type: 'shapeHalftone' }] },
    [{ from: 5, to: 6, input: 0, output: 0 }, { from: 7, to: 8, input: 0, output: 0 }]);
  ok(orfao.length === 1 && orfao[0].from === 7, 'nó sem entrada some junto com as ligações dele', JSON.stringify(orfao));
}

process.exit(resumo() ? 0 : 1);
