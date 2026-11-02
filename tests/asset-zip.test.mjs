import zlib from 'node:zlib';
import { carregaASTZIP, zipar, arquivoDe, ok, resumo, textos } from './zip-kit.mjs';

/* extrai o leitor de ZIP direto do index.html (o app é de arquivo único) */
const ASTZIP = carregaASTZIP(process.argv[2] || 'index.html');
console.log('leitor de ZIP carregado do index.html\n');

/* 1 — stored + deflate + pastas + acentos */
{
  console.log('ZIP padrão (stored + deflate, pastas, acentos)');
  const png = Buffer.from('\x89PNG\r\n\x1a\n' + 'A'.repeat(5000));
  const jpg = Buffer.from('\xff\xd8\xff' + 'B'.repeat(3000));
  const zip = zipar([
    { nome: 'texturas/', dados: '' },
    { nome: 'texturas/papel/fundo.png', dados: png, metodo: 8 },
    { nome: 'texturas/papel/grão.jpg', dados: jpg, metodo: 0 },
    { nome: 'icones/seta.svg', dados: '<svg xmlns="http://www.w3.org/2000/svg"/>' }
  ]);
  const { arq, out } = await textos(ASTZIP, zip);
  ok(arq.via === 'central', 'lido pelo diretório central');
  ok(out['texturas/papel/fundo.png'] === png.toString(), 'deflate: conteúdo idêntico');
  ok(out['texturas/papel/grão.jpg'] === jpg.toString(), 'stored: conteúdo idêntico (nome com acento)');
  ok(out['icones/seta.svg'] === '<svg xmlns="http://www.w3.org/2000/svg"/>', 'svg idêntico');
  ok(arq.entradas.filter(e => e.dir).length === 1, 'entrada de diretório marcada como dir');
}

/* 2 — data descriptor (ZIP de app Android) */
{
  console.log('\nZIP com data descriptor');
  const dados = Buffer.from('C'.repeat(9000));
  const zip = zipar([{ nome: 'stream/foto.png', dados, metodo: 8, descritor: true }]);
  const { out } = await textos(ASTZIP, zip);
  ok(out['stream/foto.png'] === dados.toString(), 'extrai com descritor');
}

/* 3 — ZIP64 */
{
  console.log('\nZIP64');
  const dados = Buffer.from('D'.repeat(4000));
  const zip = zipar([{ nome: 'zip64/arquivo.png', dados, metodo: 8 }], { zip64: true });
  const { arq, out } = await textos(ASTZIP, zip);
  ok(out['zip64/arquivo.png'] === dados.toString(), 'extrai de ZIP64');
  ok(arq.zip64 === true, 'sinaliza zip64');
}

/* 4 — nome em CP437 (sem flag UTF-8) */
{
  console.log('\nNome em CP437');
  const zip = zipar([{ nome: 'se\x87\x84o/foto.png', dados: 'X', utf8: false }]);
  const arq = await ASTZIP.abre(arquivoDe(zip));
  ok(arq.entradas[0].nome === 'seçäo/foto.png', 'decodifica CP437 (0x87=ç, 0x84=ä)', arq.entradas[0].nome);
}

/* 5 — diretório central removido: cai na varredura de cabeçalhos */
{
  console.log('\nZIP corrompido (sem EOCD)');
  const dados = Buffer.from('E'.repeat(2000));
  const zip = zipar([{ nome: 'a/b.png', dados, metodo: 8 }]);
  const trunc = zip.subarray(0, zip.length - 22);        /* tira o EOCD */
  const arq = await ASTZIP.abre(arquivoDe(trunc));
  ok(arq.entradas.length === 1, 'achou 1 entrada pela varredura', arq.entradas.length);
  const lido = Buffer.from(await ASTZIP.leEntrada(arquivoDe(trunc), arq.entradas[0]));
  ok(lido.toString() === dados.toString(), 'conteúdo correto mesmo sem EOCD');
}

/* 6 — inflate em JS puro == zlib */
{
  console.log('\nInflate puro (plano B)');
  let igual = true;
  for (const tamanho of [10, 1000, 70000, 300000]) {
    const cru = Buffer.from(Array.from({ length: tamanho }, (_, i) => (i * 31 + (i >> 3)) & 0xFF));
    const comp = zlib.deflateRawSync(cru);
    const saida = Buffer.from(ASTZIP.inflarRaw(new Uint8Array(comp)));
    if (saida.length !== cru.length || !saida.equals(cru)) { igual = false; console.log('   falhou com', tamanho, 'bytes'); }
  }
  ok(igual, 'inflarRaw reproduz zlib em 10/1k/70k/300k bytes');
  const texto = Buffer.from(('Everything Editor '.repeat(4000)));
  ok(Buffer.from(ASTZIP.inflarRaw(new Uint8Array(zlib.deflateRawSync(texto)))).equals(texto), 'texto repetitivo (bloco dinâmico)');
  const armazenado = zlib.deflateRawSync(Buffer.from('x'), { level: 0 });
  ok(Buffer.from(ASTZIP.inflarRaw(new Uint8Array(armazenado))).toString() === 'x', 'bloco stored dentro do deflate');
}

/* 7 — arquivo grande: muitos itens, leitura por pedaços */
{
  console.log('\nZIP com 1.500 imagens (leitura por pedaços)');
  const itens = [];
  for (let i = 0; i < 1500; i++) itens.push({ nome: `pack/${i % 30}/img${i}.png`, dados: Buffer.alloc(2000, i & 0xFF), metodo: 8 });
  const zip = zipar(itens);
  const t0 = Date.now();
  const arq = await ASTZIP.abre(arquivoDe(zip));
  ok(arq.entradas.length === 1500, 'lista 1.500 entradas', arq.entradas.length);
  const ultimo = arq.entradas[1499];
  const lido = Buffer.from(await ASTZIP.leEntrada(arquivoDe(zip), ultimo));
  ok(lido.length === 2000 && lido[0] === (1499 & 0xFF), 'lê a última entrada corretamente');
  ok(Date.now() - t0 < 4000, 'tempo aceitável (' + (Date.now() - t0) + 'ms)');
}

/* 8 — detectar ZIP pelo conteúdo, não pelo nome */
{
  console.log('\nDetecção por assinatura');
  const zip = zipar([{ nome: 'x.png', dados: 'z' }]);
  ok(await ASTZIP.pareceZip(arquivoDe(zip, 'sem-extensao')), 'reconhece ZIP sem extensão');
  ok(!(await ASTZIP.pareceZip(arquivoDe(Buffer.from('nao sou zip'), 'falsa.zip'))), 'recusa não-ZIP com nome .zip');
}

/* 9 — CP437 completa */
ok(ASTZIP.CP437.length === 128, 'tabela CP437 tem 128 símbolos', ASTZIP.CP437.length);

process.exit(resumo() ? 0 : 1);
