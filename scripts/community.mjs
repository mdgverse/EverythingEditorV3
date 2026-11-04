#!/usr/bin/env node
/* Coletor da comunidade — o "backend" do carrossel da Home.
 *
 * O site é estático (GitHub Pages) e o APK leva só o index.html, então não existe
 * servidor: quem faz o papel de backend é este script, rodando no GitHub Actions a
 * cada 6 horas. Ele consulta as APIs, baixa as miniaturas para community/ (o CDN do
 * Instagram expira; o arquivo local não) e grava community.json + o seed embutido no
 * index.html. O front lê esse JSON (ou o seed, no APK offline).
 *
 *   IG_TOKEN      token de acesso (Instagram Graph API, conta business/creator)
 *   IG_USER_ID    id da conta do Instagram ligada à página
 *   TUMBLR_KEY    consumer key da aplicação do Tumblr
 *   TUMBLR_BLOG   blog lido direto (padrão: mdgverse) — só os posts desse blog
 *                 marcados com a hashtag entram; post sem tag fica de fora
 *
 *   node scripts/community.mjs            → coleta de verdade
 *   node scripts/community.mjs --dry      → sem baixar imagens nem escrever
 *   node scripts/community.mjs --fixtures → usa tests/fixtures/ (offline, sem token)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TAGS = ['everythingeditor', 'EverythingEditor'];
export const LIMITE = 24;          // cartões no carrossel
export const SEED_MAX = 12;        // quantos vão embutidos no index.html
export const BLOG_PADRAO = 'mdgverse';   // posts do próprio blog, mesmo sem tag
export const FOTO_MAX = 1280;      // largura máxima baixada do CDN
export const MINI_MAX = 320;       // largura da miniatura que fica no repositório
const MINI_PESO = 120 * 1024;      // acima disso vale reencodar
const API_IG = 'https://graph.facebook.com/v21.0';
const API_TB = 'https://api.tumblr.com/v2/tagged';
const API_BLOG = 'https://api.tumblr.com/v2/blog/';

/* ---------------------------------------------------------------- utilidades */

function idDe(platform, postId) {
  return platform + ':' + crypto.createHash('sha1').update(String(postId)).digest('hex').slice(0, 12);
}

function textoLimpo(v, max) {
  const s = String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** a maior mídia que ainda cabe em FOTO_MAX (o cartão tem 132 px) */
function escolheMidia(lista) {
  const validas = (lista || []).filter(m => m && m.url);
  if (!validas.length) return null;
  const cabe = validas.filter(m => m.width && m.width <= FOTO_MAX).sort((a, b) => b.width - a.width)[0];
  const escolhida = cabe || validas.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  return { url: escolhida.url, w: escolhida.width || 0, h: escolhida.height || 0 };
}

/** foto de um post do Tumblr no formato antigo (photos[].original_size / alt_sizes) */
export function melhorFoto(foto) {
  if (!foto) return null;
  const original = foto.original_size && foto.original_size.url ? [foto.original_size] : [];
  return escolheMidia(original.concat((foto.alt_sizes || []).filter(a => a && a.url)));
}

/** foto de um post no formato novo do Tumblr (NPF: content[] com blocos de imagem) */
export function fotoDeBlocos(blocos) {
  if (!Array.isArray(blocos)) return null;
  const midias = [];
  for (const b of blocos) {
    if (!b || b.type !== 'image') continue;
    midias.push(...(b.media || []));
  }
  return escolheMidia(midias);
}

/** blog/view/... é o link feio da API: volta para o endereço do post.
 *  Atenção: o id do Tumblr passa de 2^53, o JSON.parse arredonda — o id_string é o certo. */
export function urlDoPost(b) {
  const url = b.post_url || '';
  if (url && !/\/blog\/view\//.test(url)) return url;
  const id = b.id_string || b.id;
  if (b.blog_name && id) return 'https://' + b.blog_name + '.tumblr.com/post/' + id;
  return url || null;
}

function legendaDoPost(b) {
  if (b.summary) return b.summary;
  if (b.caption) return b.caption;
  return (Array.isArray(b.content) ? b.content : [])
    .filter(x => x && x.type === 'text' && x.text).map(x => x.text).join(' ');
}

function arroba(nome) {
  const s = textoLimpo(nome, 40).replace(/^@+/, '');
  return s ? '@' + s : '@unknown';
}

/** normaliza uma lista bruta (IG ou Tumblr) em cartões previsíveis */
export function normaliza(plataforma, brutos) {
  const saida = [];
  for (const b of brutos || []) {
    if (!b || typeof b !== 'object') continue;
    let img = null, url = null, autor = null, w = 0, h = 0, legenda = '';
    if (plataforma === 'instagram') {
      if (b.media_type === 'VIDEO' || b.media_type === 'CAROUSEL_ALBUM') {
        img = b.thumbnail_url || b.media_url || null;
      } else {
        img = b.media_url || b.thumbnail_url || null;
      }
      url = b.permalink || null;
      autor = b.username || null;
      legenda = b.caption || '';
    } else {
      const foto = melhorFoto((b.photos || [])[0]) || fotoDeBlocos(b.content);
      img = foto && foto.url;
      w = (foto && foto.w) || 0;
      h = (foto && foto.h) || 0;
      url = urlDoPost(b);
      autor = b.blog_name || null;
      legenda = legendaDoPost(b);
    }
    if (!img || !url) continue;
    if (!/^https?:\/\//i.test(img) || !/^https?:\/\//i.test(url)) continue;
    const item = {
      id: idDe(plataforma, b.id_string || b.id || url),
      platform: plataforma,
      url,
      author: arroba(autor),
      img,
      w, h,
      alt: textoLimpo(legenda || ('Artwork by ' + arroba(autor)), 140),
      tag: 'everythingeditor',
      ts: textoLimpo(b.timestamp || b.date || '', 32),
    };
    saida.push(item);
  }
  return saida;
}

/** junta, tira repetido (mesmo id ou mesma imagem) e corta no limite */
export function escolhe(itens, limite = LIMITE) {
  const vistos = new Set(), vistosImg = new Set(), saida = [];
  for (const it of itens || []) {
    if (!it || !it.id || !it.img || !it.url) continue;
    if (vistos.has(it.id) || vistosImg.has(it.img)) continue;
    vistos.add(it.id);
    vistosImg.add(it.img);
    saida.push(it);
    if (saida.length >= limite) break;
  }
  return saida;
}

/* ---------------------------------------------------------------- provedores */

async function json(url, o = {}) {
  const r = await fetch(url, { ...o, headers: { accept: 'application/json', ...(o.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url.split('?')[0]}`);
  return r.json();
}

export async function buscaInstagram(tag, token, userId) {
  const busca = await json(`${API_IG}/ig_hashtag_search?user_id=${encodeURIComponent(userId)}` +
    `&q=${encodeURIComponent(tag)}&access_token=${encodeURIComponent(token)}`);
  const id = busca && busca.data && busca.data[0] && busca.data[0].id;
  if (!id) return [];
  const midia = await json(`${API_IG}/${id}/top_media?user_id=${encodeURIComponent(userId)}` +
    `&fields=id,caption,media_type,media_url,thumbnail_url,permalink,username,timestamp&limit=25` +
    `&access_token=${encodeURIComponent(token)}`);
  return normaliza('instagram', (midia && midia.data) || []);
}

export async function buscaTumblr(tag, chave) {
  const r = await json(`${API_TB}?tag=${encodeURIComponent(tag)}&limit=20&api_key=${encodeURIComponent(chave)}`);
  const lista = (r && r.response) || [];
  return normaliza('tumblr', lista.filter(p => p && (p.type === 'photo' || (p.photos && p.photos.length))));
}

export function postsDaResposta(r) {
  return (r && r.response && r.response.posts) || [];
}

/** posts do próprio blog **marcados com a hashtag** (os sem tag ficam de fora) */
export async function buscaBlog(blog, chave, tag, limite = 20) {
  const nome = String(blog || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const url = `${API_BLOG}${encodeURIComponent(nome)}.tumblr.com/posts` +
    `?limit=${limite}&filter=text&npf=true${tag ? '&tag=' + encodeURIComponent(tag) : ''}` +
    `&api_key=${encodeURIComponent(chave)}`;
  return normaliza('tumblr', postsDaResposta(await json(url)));
}

/* ------------------------------------------------------------------ cache */

async function baixaImagem(url, destino) {
  const r = await fetch(url, { headers: { accept: 'image/*' } });
  if (!r.ok) throw new Error(`${r.status} ao baixar ${url.slice(0, 60)}`);
  const tipo = r.headers.get('content-type') || '';
  if (!/^image\//i.test(tipo)) throw new Error('não é imagem: ' + tipo);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2048 || buf.length > 3 * 1024 * 1024) throw new Error('tamanho fora da faixa: ' + buf.length);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, buf);
  return buf.length;
}

/** encolhe a miniatura para MINI_MAX com sharp (o cartão tem 132 px).
 *  Sem o sharp instalado, o arquivo original fica como está. */
export async function encolhe(arquivo) {
  let sharp;
  try { ({ default: sharp } = await import('sharp')); } catch { return false; }
  const { size } = await fs.stat(arquivo);
  if (size <= MINI_PESO) return false;
  const tmp = arquivo + '.tmp.jpg';
  await sharp(arquivo).rotate().resize(MINI_MAX, 400, { fit: 'cover' })
    .jpeg({ quality: 82, mozjpeg: true }).toFile(tmp);
  await fs.rename(tmp, arquivo);
  return true;
}

/** troca a URL remota pelo arquivo local (community/<id>.jpg) */
export async function cacheia(itens, raiz = RAIZ, seco = false) {
  const saida = [];
  for (const it of itens) {
    const nome = 'community/' + it.id.replace(':', '-') + '.jpg';
    const destino = path.join(raiz, nome);
    try {
      if (!seco) {
        try { await fs.access(destino); }
        catch { await baixaImagem(it.img, destino); }
        try { await encolhe(destino); }
        catch (e) { console.warn('  ! não deu para encolher:', it.id, e.message); }
      }
      saida.push({ ...it, img: nome });
    } catch (e) {
      console.warn('  ! imagem ignorada:', it.id, e.message);
    }
  }
  return saida;
}

/** apaga as miniaturas que saíram do carrossel (o repositório não guarda lixo) */
export async function limpaCache(itens, raiz = RAIZ) {
  const pasta = path.join(raiz, 'community');
  let nomes = [];
  try { nomes = await fs.readdir(pasta); }
  catch { return 0; }
  const usados = new Set((itens || []).map(i => path.basename(String(i.img || ''))));
  let apagados = 0;
  for (const n of nomes) {
    if (n === '.gitkeep' || usados.has(n)) continue;
    try { await fs.unlink(path.join(pasta, n)); apagados++; } catch (_) {}
  }
  return apagados;
}

/* --------------------------------------------------------------- publicação */

export const MARCA_INI = '/* CMTY_SEED_START';
export const MARCA_FIM = '/* CMTY_SEED_END */';

export function trocaSeed(html, itens) {
  const ini = html.indexOf(MARCA_INI), fim = html.indexOf(MARCA_FIM);
  if (ini < 0 || fim < ini) throw new Error('marcas do seed não encontradas no index.html');
  const bloco = MARCA_INI + ' (gerado por scripts/community.mjs — não editar à mão) */\n' +
    'const CMTY_SEED = ' + JSON.stringify(itens.map(({ id, platform, url, author, img, alt, tag, ts }) =>
      ({ id, platform, url, author, img, alt, tag, ts })), null, 0) + ';\n';
  return html.slice(0, ini) + bloco + html.slice(fim);
}

async function leFixture(nome) {
  return JSON.parse(await fs.readFile(path.join(RAIZ, 'tests', 'fixtures', nome), 'utf8'));
}

export async function coleta({ fixtures = false, seco = false, raiz = RAIZ } = {}) {
  const token = process.env.IG_TOKEN || '';
  const userId = process.env.IG_USER_ID || '';
  const tumblrKey = process.env.TUMBLR_KEY || '';
  const tumblrBlog = process.env.TUMBLR_BLOG || BLOG_PADRAO;
  const brutos = [];
  const avisos = [];
  const fontes = [];

  if (fixtures) {
    const fIg = normaliza('instagram', await leFixture('community-instagram.json'));
    const fTb = normaliza('tumblr', await leFixture('community-tumblr.json'));
    const fBlog = normaliza('tumblr', postsDaResposta(await leFixture('community-tumblr-blog.json')));
    brutos.push(...fIg, ...fTb, ...fBlog);
    fontes.push('fixtures: instagram ' + fIg.length + ', tag ' + fTb.length + ', blog ' + fBlog.length);
  } else {
    if (token && userId) {
      for (const tag of TAGS) {
        try { brutos.push(...await buscaInstagram(tag, token, userId)); }
        catch (e) { avisos.push('instagram ' + tag + ': ' + e.message); }
      }
    } else avisos.push('instagram: sem IG_TOKEN/IG_USER_ID');
    if (tumblrKey) {
      for (const tag of TAGS) {
        try {
          const doBlog = await buscaBlog(tumblrBlog, tumblrKey, tag);
          brutos.push(...doBlog);
          fontes.push('blog ' + tumblrBlog + ' #' + tag + ': ' + doBlog.length + ' com imagem');
        } catch (e) { avisos.push('tumblr blog ' + tumblrBlog + ' #' + tag + ': ' + e.message); }
      }
      for (const tag of TAGS) {
        try {
          const daTag = await buscaTumblr(tag, tumblrKey);
          brutos.push(...daTag);
          fontes.push('tag ' + tag + ': ' + daTag.length + ' com imagem');
        } catch (e) { avisos.push('tumblr ' + tag + ': ' + e.message); }
      }
    } else avisos.push('tumblr: sem TUMBLR_KEY');
  }

  const escolhidos = escolhe(brutos);
  const comCache = await cacheia(escolhidos, raiz, seco || fixtures);
  return { itens: comCache, avisos, fontes, encontrados: brutos.length };
}

export async function publica({ itens, avisos, fontes = [] }, raiz = RAIZ, seco = false) {
  const dados = {
    version: 1,
    updated: new Date().toISOString(),
    tags: TAGS,
    total: itens.length,
    notices: avisos,
    items: itens,
  };
  if (seco) return dados;
  await fs.writeFile(path.join(raiz, 'community.json'), JSON.stringify(dados, null, 2) + '\n');
  const arq = path.join(raiz, 'index.html');
  const html = await fs.readFile(arq, 'utf8');
  const seed = itens.slice(0, SEED_MAX);
  await fs.writeFile(arq, trocaSeed(html, seed));
  await limpaCache(itens, raiz);
  return dados;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const fixtures = args.has('--fixtures');
  const seco = args.has('--dry') || fixtures;
  console.log('comunidade · tags ' + TAGS.join(', ') + (fixtures ? ' · fixtures' : ''));
  const r = await coleta({ fixtures, seco });
  const dados = await publica(r, RAIZ, seco);
  console.log(`  ${r.encontrados} posts lidos · ${dados.items.length} no carrossel · ${SEED_MAX} no seed`);
  for (const f of r.fontes || []) console.log('  · ' + f);
  for (const a of r.avisos) console.log('  · ' + a);
  if (!dados.items.length) console.log('  (nada publicado: o carrossel fica escondido)');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error('falhou:', e.message); process.exit(1); });
}
