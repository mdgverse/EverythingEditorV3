/* Testa a importação de Assets (ZIP → pastas) sem navegador:
   extrai o bloco do index.html e injeta stubs de DOM/IndexedDB. */
import fs from 'node:fs';
import { zipar, ok, resumo } from './zip-kit.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const ini = html.indexOf('/* ==== ASSET IMPORT (BEGIN) ====');
const fim = html.indexOf('async function astAddSvgTexto');
if (ini < 0 || fim < 0) throw new Error('bloco de importação não encontrado');
const bloco = html.slice(ini, fim);

/* ---------------- stubs ---------------- */
const pastas = new Map(), assets = new Map();
const SS_DB = {
  listAssetFolders: async () => [...pastas.values()],
  putAssetFolder: async f => { pastas.set(f.id, { ...f }); },
  listAssets: async () => [...assets.values()],
  putAsset: async a => { assets.set(a.id, { ...a }); }
};
const status = [];
const stubs = {
  SS_DB,
  setStatus: (m, err) => status.push((err ? '[erro] ' : '') + m),
  astRefresh: async () => {},
  astFolderSel: 'all',
  astId: (() => { let n = 0; return () => 'id' + (++n); })(),
  astFmtTam: n => (n / 1048576).toFixed(1) + ' MB',
  astAssetDeArquivo: async (file, folderId) => ({ id: 'a' + Math.random().toString(36).slice(2, 8), name: file.name, kind: /svg/.test(file.name) ? 'svg' : 'image', folderId: folderId || undefined, size: file.size }),
  astLimpaBusca: () => {},
  document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { toggle() {}, contains: () => false }, append() {}, addEventListener() {}, querySelector: () => ({ style: {}, textContent: '' }), setAttribute() {} }), body: { append() {} }, head: { append() {} } },
  navigator: { storage: { estimate: async () => ({ quota: 4e9, usage: 1e6 }) } },
};

const fabrica = new Function(...Object.keys(stubs), bloco + '\nreturn { astAddFiles, astImportaZip, ASTZIP };');
const app = fabrica(...Object.values(stubs));

/* ---------------- casos ---------------- */
const png = Buffer.from('\x89PNG\r\n\x1a\n' + 'A'.repeat(3000));

function arquivo(buf, nome) { return new File([buf], nome, { type: 'application/zip' }); }

/* 1 — ZIP com subpastas cria a hierarquia certa */
{
  console.log('ZIP com subpastas → hierarquia de pastas');
  const zip = zipar([
    { nome: 'texturas/', dados: '' },
    { nome: 'texturas/papel/fundo.png', dados: png },
    { nome: 'texturas/papel/grão.png', dados: png },
    { nome: 'texturas/madeira/ripas.png', dados: png },
    { nome: 'icones/seta.svg', dados: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    { nome: '__MACOSX/._fundo.png', dados: 'lixo' },
    { nome: '.DS_Store', dados: 'lixo' }
  ]);
  const ok0 = await app.astAddFiles([arquivo(zip, 'Textures.zip')]);
  ok(ok0 === 4, 'importou 4 assets (3 PNG + 1 SVG)', ok0);
  const nomes = [...pastas.values()].map(f => f.name);
  ok(nomes.includes('texturas'), 'criou a pasta "texturas"');
  ok(nomes.includes('papel'), 'criou a subpasta "papel"');
  ok(nomes.includes('madeira'), 'criou a subpasta "madeira"');
  ok(!nomes.some(n => n.includes('/') || n.includes(' / ')), 'não criou pasta com barra no nome', nomes);
  const papel = [...pastas.values()].find(f => f.name === 'papel');
  const texturas = [...pastas.values()].find(f => f.name === 'texturas');
  ok(!!papel && papel.parentId === texturas.id, 'papel é filha de texturas', papel && papel.parentId);
  const fundo = [...assets.values()].find(a => a.name === 'fundo.png');
  ok(!!fundo && fundo.folderId === papel.id, 'fundo.png ficou dentro de papel');
  ok([...assets.values()].length === 4, 'nenhum lixo do macOS virou asset', [...assets.values()].length);
}

/* 2 — formatos não suportados são contados com motivo */
{
  console.log('\nZIP com formatos não suportados');
  status.length = 0;
  const zip = zipar([
    { nome: 'pack/foto.psd', dados: Buffer.alloc(500) },
    { nome: 'pack/foto.heic', dados: Buffer.alloc(500) },
    { nome: 'pack/ok.png', dados: png }
  ]);
  const antes = assets.size;
  const n = await app.astAddFiles([arquivo(zip, 'pack.zip')]);
  ok(n === 1, 'importou só o PNG', n);
  ok(assets.size === antes + 1, 'biblioteca cresceu 1');
  const msg = status.join(' | ');
  ok(/psd/.test(msg) && /heic/.test(msg), 'mensagem cita os formatos ignorados', msg);
}

/* 3 — ZIP ilegível não explode, só avisa */
{
  console.log('\nArquivo que finge ser ZIP');
  status.length = 0;
  const n = await app.astAddFiles([arquivo(Buffer.from('isto nao e um zip de verdade'), 'quebrado.zip')]);
  ok(n === 0, 'nada importado');
  ok(status.some(s => /ZIP/i.test(s)), 'avisou o problema', status.join(' | '));
}

/* 4 — arquivo solto continua funcionando */
{
  console.log('\nArquivo solto (sem ZIP)');
  const n = await app.astAddFiles([new File([png], 'solto.png', { type: 'image/png' })]);
  ok(n === 1, 'importou o PNG solto');
}

process.exit(resumo() ? 0 : 1);
