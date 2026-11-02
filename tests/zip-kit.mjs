/* Testes do leitor de ZIP do editor (roda no Node e no CI).
   Gera os ZIPs na hora — nenhum binário fica no repositório. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

/* ---------- carrega o ASTZIP direto do index.html ---------- */
export function carregaASTZIP(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const ini = html.indexOf('/* ==== ASSET ZIP READER (BEGIN) ====');
  const fim = html.indexOf('/* ==== ASSET ZIP READER (END) ====');
  if (ini < 0 || fim < 0) throw new Error('bloco ASSET ZIP READER não encontrado no index.html');
  const src = html.slice(ini, fim);
  const fabrica = new Function(src + '\nreturn ASTZIP;');
  return fabrica();
}

/* ---------- escritor de ZIP para os testes ---------- */
const CRC_TABELA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABELA[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
const u16 = n => [n & 0xFF, (n >> 8) & 0xFF];
const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
const u64 = n => { const b = []; let v = BigInt(n); for (let i = 0; i < 8; i++) { b.push(Number(v & 0xFFn)); v >>= 8n; } return b; };

export function zipar(entradas, opcoes = {}) {
  const pedacos = [], central = [];
  let offset = 0;
  for (const e of entradas) {
    const dados = Buffer.from(e.dados);
    const metodo = e.metodo ?? 8;
    const comp = metodo === 8 ? zlib.deflateRawSync(dados) : dados;
    const crc = crc32(dados);
    const nome = Buffer.from(e.nomeBytes || Buffer.from(e.nome, e.utf8 === false ? 'latin1' : 'utf8'));
    const flags = (e.utf8 === false ? 0 : 0x800) | (e.descritor ? 0x8 : 0);
    const local = [
      ...u32(0x04034b50), ...u16(e.descritor ? 20 : 10), ...u16(flags), ...u16(metodo),
      ...u16(0), ...u16(0), ...u32(e.descritor ? 0 : crc),
      ...u32(e.descritor ? 0 : comp.length), ...u32(e.descritor ? 0 : dados.length),
      ...u16(nome.length), ...u16(0)
    ];
    const cab = Buffer.from(local);
    pedacos.push(cab, nome, comp);
    let extra = 0;
    if (e.descritor) {
      const desc = Buffer.from([...u32(0x08074b50), ...u32(crc), ...u32(comp.length), ...u32(dados.length)]);
      pedacos.push(desc); extra = desc.length;
    }
    central.push({
      nome, flags, metodo, crc, tamC: comp.length, tamU: dados.length,
      off: offset, descritor: !!e.descritor
    });
    offset += cab.length + nome.length + comp.length + extra;
  }
  const cdIni = offset;
  const cds = central.map(c => Buffer.from([
    ...u32(0x02014b50), ...u16(0x031e), ...u16(0x031e), ...u16(c.flags), ...u16(c.metodo),
    ...u16(0), ...u16(0), ...u32(c.crc), ...u32(c.tamC), ...u32(c.tamU),
    ...u16(c.nome.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.off)
  ]));
  const cd = Buffer.concat(cds.map((b, i) => Buffer.concat([b, central[i].nome])));
  const cdSize = cd.length;

  let extra = Buffer.alloc(0), eocd;
  if (opcoes.zip64) {
    /* força o formato ZIP64: EOCD com campos saturados + EOCD64 + localizador */
    const eocd64Off = cdIni + cdSize;
    const eocd64 = Buffer.from([
      ...u32(0x06064b50), ...u64(44), ...u16(0x031e), ...u16(0x031e),
      ...u32(0), ...u32(0), ...u64(central.length), ...u64(central.length),
      ...u64(cdSize), ...u64(cdIni)
    ]);
    const loc = Buffer.from([...u32(0x07064b50), ...u32(0), ...u64(eocd64Off), ...u32(1)]);
    extra = Buffer.concat([eocd64, loc]);
    eocd = Buffer.from([
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(0xFFFF), ...u16(0xFFFF), ...u32(0xFFFFFFFF), ...u32(0xFFFFFFFF), ...u16(0)
    ]);
  } else {
    eocd = Buffer.from([
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdIni), ...u16(0)
    ]);
  }
  return Buffer.concat([...pedacos, cd, extra, eocd]);
}

/* ---------- arquivo falso com slice (como o File do navegador) ---------- */
export function arquivoDe(buf, nome = 'teste.zip', tipo = 'application/zip') {
  if (typeof File === 'function') return new File([buf], nome, { type: tipo });
  return new Blob([buf], { type: tipo });
}

/* ---------- execução ---------- */
let falhas = 0, passes = 0;
export function ok(cond, msg, extra) {
  if (cond) { passes++; console.log('  ✓', msg); }
  else { falhas++; console.log('  ✗', msg, extra === undefined ? '' : JSON.stringify(extra)); }
}
export function resumo() {
  console.log(`\n${passes} passaram, ${falhas} falharam`);
  return falhas === 0;
}

export async function textos(ASTZIP, buf) {
  const arq = await ASTZIP.abre(arquivoDe(buf));
  const out = {};
  for (const e of arq.entradas) {
    if (e.dir) continue;
    out[e.nome] = Buffer.from(await ASTZIP.leEntrada(arquivoDe(buf), e)).toString('utf8');
  }
  return { arq, out };
}
