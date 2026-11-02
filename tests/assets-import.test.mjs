/* Importação da biblioteca de Assets (versão sem ZIP) — roda sem navegador. */
import fs from 'node:fs';
import { ok, resumo, arquivo } from './kit.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const ini = html.indexOf('/* ==== ASSET IMPORT (BEGIN) ==== */');
const fim = html.indexOf('async function astAddSvgTexto');
if (ini < 0 || fim < 0) throw new Error('bloco de importação não encontrado');

const pastas = new Map(), assets = new Map();
let falharPara = null, erroCota = null;
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
  astAssetDeArquivo: async (file, folderId) => {
    if (falharPara && file.name === falharPara) throw erroCota;
    if (/psd$/i.test(file.name)) throw new Error('unsupported format');
    return { id: 'a' + Math.random().toString(36).slice(2, 8), name: file.name, folderId: folderId || undefined, size: file.size };
  },
  astLimpaBusca: () => {},
  document: { getElementById: () => null },
  navigator: { storage: { estimate: async () => ({ quota: 4e9, usage: 1e6 }) } },
};
const app = new Function(...Object.keys(stubs), html.slice(ini, fim) + '\nreturn { astAddFiles, astErroDeCota };')(...Object.values(stubs));

const png = Buffer.from('\x89PNG\r\n\x1a\n' + 'A'.repeat(200));

/* 1 — importa imagens e SVG */
{
  console.log('Importar imagens e SVG');
  status.length = 0;
  const n = await app.astAddFiles([
    arquivo('fundo.png', png, 'image/png'),
    new File([png], 'foto.jpg', { type: 'image/jpeg' }),
    new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'seta.svg', { type: 'image/svg+xml' })
  ]);
  ok(n === 3, 'importou os 3 arquivos', n);
  ok(assets.size === 3, 'biblioteca com 3 assets');
  ok(/3 assets/.test(status.join(' ')), 'status resume a importação', status.join(' | '));
}

/* 2 — ZIP não é mais aceito */
{
  console.log('\nZIP é recusado');
  status.length = 0;
  const antes = assets.size;
  const n = await app.astAddFiles([new File([Buffer.from('PK\x03\x04lixo')], 'texturas.zip', { type: 'application/zip' })]);
  ok(n === 0, 'nada importado do ZIP', n);
  ok(assets.size === antes, 'biblioteca não muda');
  ok(status.some(s => /ZIP não é aceito/i.test(s)), 'avisa que ZIP não é aceito', status.join(' | '));
}

/* 3 — formato não suportado é contado */
{
  console.log('\nFormato não suportado');
  status.length = 0;
  const antes = assets.size;
  const n = await app.astAddFiles([new File([Buffer.from('x')], 'camadas.psd', { type: '' })]);
  ok(n === 0, 'não importa PSD');
  ok(assets.size === antes, 'biblioteca não muda');
  ok(status.some(s => /ignorado/i.test(s)), 'mensagem cita arquivo ignorado', status.join(' | '));
}

/* 4 — cota estourada para a importação na hora */
{
  console.log('\nCota estourada no meio');
  status.length = 0;
  const erro = new Error('The quota has been exceeded.');
  erro.name = 'QuotaExceededError';
  ok(app.astErroDeCota(erro) === true, 'astErroDeCota reconhece QuotaExceededError');
  const antes = assets.size;
  falharPara = 'b.png'; erroCota = erro;
  const n = await app.astAddFiles([
    new File([png], 'a.png', { type: 'image/png' }),
    new File([png], 'b.png', { type: 'image/png' })
  ]);
  ok(n === 1, 'para depois do primeiro arquivo', n);
  ok(assets.size === antes + 1, 'só o primeiro entrou');
  ok(status.some(s => /Sem espaço/i.test(s)), 'avisa falta de espaço', status.join(' | '));
  ok(app.astErroDeCota(new Error('qualquer outra coisa')) === false, 'erro comum não é confundido com cota');
}

process.exit(resumo() ? 0 : 1);
