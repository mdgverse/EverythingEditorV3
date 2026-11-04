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
const API_IG = 'https://graph.facebook.com/v21.0';
const API_TB = 'https://api.tumblr.com/v2/tagged';

/* ---------------------------------------------------------------- utilidades */

function idDe(platform, postId) {
  return platform + ':' + crypto.createHash('sha1').update(String(postId)).digest('hex').slice(0, 12);
}

function textoLimpo(v, max) {
  const s = String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
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
      const fotos = b.photos || (b.type === 'photo' && b.photos) || [];
      const foto = fotos[0] || null;
      const alt = foto && (foto.alt_sizes || []).find(s => s && s.width >= 400) || foto && foto.alt_sizes && foto.alt_sizes[0];
      img = (foto && foto.original_size && foto.original_size.url) || (alt && alt.url) || null;
      w = (foto && foto.original_size && foto.original_size.width) || (alt && alt.width) || 0;
      h = (foto && foto.original_size && foto.original_size.height) || (alt && alt.height) || 0;
      url = b.post_url || (b.blog_name ? 'https://' + b.blog_name + '.tumblr.com/post/' + b.id : null);
      autor = b.blog_name || null;
      legenda = (b.summary || b.caption || '').replace(/<[^>]*>/g, ' ');
    }
    if (!img || !url) continue;
    if (!/^https?:\/\//i.test(img) || !/^https?:\/\//i.test(url)) continue;
    const item = {
      id: idDe(plataforma, b.id || url),
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
      }
      saida.push({ ...it, img: nome });
    } catch (e) {
      console.warn('  ! imagem ignorada:', it.id, e.message);
    }
  }
  return saida;
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
  const brutos = [];
  const avisos = [];

  if (fixtures) {
    brutos.push(...normaliza('instagram', await leFixture('community-instagram.json')));
    brutos.push(...normaliza('tumblr', await leFixture('community-tumblr.json')));
  } else {
    if (token && userId) {
      for (const tag of TAGS) {
        try { brutos.push(...await buscaInstagram(tag, token, userId)); }
        catch (e) { avisos.push('instagram ' + tag + ': ' + e.message); }
      }
    } else avisos.push('instagram: sem IG_TOKEN/IG_USER_ID');
    if (tumblrKey) {
      for (const tag of TAGS) {
        try { brutos.push(...await buscaTumblr(tag, tumblrKey)); }
        catch (e) { avisos.push('tumblr ' + tag + ': ' + e.message); }
      }
    } else avisos.push('tumblr: sem TUMBLR_KEY');
  }

  const escolhidos = escolhe(brutos);
  const comCache = await cacheia(escolhidos, raiz, seco || fixtures);
  return { itens: comCache, avisos, encontrados: brutos.length };
}

export async function publica({ itens, avisos }, raiz = RAIZ, seco = false) {
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
  for (const a of r.avisos) console.log('  · ' + a);
  if (!dados.items.length) console.log('  (nada publicado: o carrossel fica escondido)');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error('falhou:', e.message); process.exit(1); });
}
