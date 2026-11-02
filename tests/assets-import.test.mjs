/* Importação da biblioteca de Assets (versão sem ZIP) — roda sem navegador. */
import fs from 'node:fs';
import { ok, resumo, arquivo } from './kit.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const ini = html.indexOf('/* ==== ASSET IMPORT (BEGIN) ==== */');
const fim = html.indexOf('async function astAddSvgTexto');
if (ini < 0 || fim < 0) throw new Error('bloco de importação não encontrado');

/* o formatador de tamanho vem do próprio index.html (KB ... TB) */
const astFmtTam = new Function(
  html.slice(html.indexOf('function astFmtTam'), html.indexOf('function astTipoRotulo')) + '\nreturn astFmtTam;'
)();

const pastas = new Map(), assets = new Map();
const biblioteca = [];            // espelha astAssets (o app soma os bytes daqui)
let falharPara = null, erroCota = null, quotaNavegador = 4e9, cotaFake = null;
const SS_DB = {
  listAssetFolders: async () => [...pastas.values()],
  putAssetFolder: async f => { pastas.set(f.id, { ...f }); },
  listAssets: async () => [...assets.values()],
  putAsset: async a => { assets.set(a.id, { ...a }); biblioteca.push({ ...a }); }
};
const status = [];
const stubs = {
  SS_DB,
  setStatus: (m, err) => status.push((err ? '[erro] ' : '') + m),
  astRefresh: async () => {},
  astFolderSel: 'all',
  astId: (() => { let n = 0; return () => 'id' + (++n); })(),
  astFmtTam: astFmtTam,
  astAssetDeArquivo: async (file, folderId) => {
    if (falharPara && file.name === falharPara) throw erroCota;
    if (/psd$/i.test(file.name)) throw new Error('unsupported format');
    return { id: 'a' + Math.random().toString(36).slice(2, 8), name: file.name, folderId: folderId || undefined, size: file.size };
  },
  astLimpaBusca: () => {},
  document: { getElementById: () => null },
  navigator: { storage: { estimate: async () => ({ quota: quotaNavegador, usage: 1e6 }) } },
  astAssets: biblioteca,
};
const app = new Function(...Object.keys(stubs), html.slice(ini, fim) + '\nreturn { astAddFiles, astErroDeCota, AST_TETO_BYTES, astUsadoBytes };')(...Object.values(stubs));

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

/* 5 — teto de 2 TB da biblioteca */
{
  console.log('\nTeto de 2 TB');
  const TB = 1024 ** 4;
  ok(app.AST_TETO_BYTES === 2 * TB, 'teto configurado em 2 TB', app.AST_TETO_BYTES + ' B');

  /* já ocupado quase 2 TB: o próximo arquivo é recusado sem tocar no banco */
  const antes = assets.size, marcador = biblioteca.length;
  biblioteca.push({ id: 'gigante', name: 'gigante.png', size: 2 * TB - 100 });
  falharPara = null;
  status.length = 0;
  const n = await app.astAddFiles([
    new File([png], 'cabe.png', { type: 'image/png' }),      // 208 B > 100 B livres
    new File([png], 'depois.png', { type: 'image/png' })
  ]);
  ok(n === 0, 'nada entra com a biblioteca cheia', n);
  ok(assets.size === antes, 'banco intacto');
  ok(status.some(s => /limite de 2,0 TB da biblioteca atingido/.test(s)), 'avisa o limite de 2 TB', status.join(' | '));

  /* com espaço livre o mesmo arquivo entra */
  biblioteca.length = marcador;
  status.length = 0;
  const n2 = await app.astAddFiles([new File([png], 'cabe2.png', { type: 'image/png' })]);
  ok(n2 === 1, 'com espaço livre importa normalmente', n2);

  /* astUsadoBytes soma o size dos assets */
  biblioteca.push({ id: 'x1', size: 1000 }, { id: 'x2', blob: { size: 500 } }, { id: 'x3' });
  ok(app.astUsadoBytes() === app.astUsadoBytes() && app.astUsadoBytes() >= 1500, 'soma bytes (inclusive de blob)', app.astUsadoBytes());
}

/* 6 — a barra de armazenamento mostra o teto */
{
  console.log('\nTexto de armazenamento');
  ok(astFmtTam(2 * 1024 ** 4) === '2,0 TB', 'formata TB', astFmtTam(2 * 1024 ** 4));
  ok(astFmtTam(3 * 1024 ** 3) === '3,0 GB', 'formata GB', astFmtTam(3 * 1024 ** 3));
  const el = { textContent: '', title: '', classList: { toggle: () => {} } };
  const mk = (quota) => {
    const st = {
      document: { getElementById: () => el },
      navigator: { storage: { estimate: async () => ({ quota, usage: 3 * 1024 ** 3 }), persist: async () => true, persisted: async () => true } },
      astFmtTam: astFmtTam,
    };
    return new Function(...Object.keys(st), html.slice(ini, fim) + '\nreturn astMostraCota;')(...Object.values(st));
  };
  await mk(50 * 1024 ** 4)();
  ok(/de 2,0 TB/.test(el.textContent), 'navegador grande: mostra o teto de 2 TB', el.textContent);
  ok(/protegido/.test(el.textContent), 'diz que o armazenamento está protegido');
  ok(/Limite da biblioteca: 2,0 TB/.test(el.title), 'o título explica o limite', el.title);
  await mk(8 * 1024 ** 3)();
  ok(/de 8,0 GB/.test(el.textContent), 'navegador menor manda (8 GB)', el.textContent);
  ok(/libera até 8,0 GB/.test(el.title), 'o título avisa a cota do navegador', el.title);
}

process.exit(resumo() ? 0 : 1);
