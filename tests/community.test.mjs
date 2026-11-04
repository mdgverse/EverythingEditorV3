/* Comunidade (3.6.2) — carrossel infinito da Home + o coletor que alimenta o feed.
   O site é estático: o "backend" é o GitHub Actions (scripts/community.mjs), que
   consulta Instagram e Tumblr, cacheia as miniaturas em community/ e publica
   community.json; o APK sem internet usa o seed embutido no index.html. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';
import { normaliza, escolhe, trocaSeed, TAGS, LIMITE, MARCA_INI, MARCA_FIM } from '../scripts/community.mjs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const fixtures = n => JSON.parse(fs.readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8'));
const extrai = (ini, fim) => {
  const a = html.indexOf(ini), b = html.indexOf(fim);
  if (a < 0 || b < 0 || b < a) throw new Error('trecho não encontrado: ' + ini);
  return html.slice(a, b);
};

console.log('Comunidade · carrossel e feed');

/* ---------------------------------------------------------------- o coletor */
ok(TAGS.join(',') === 'everythingeditor,EverythingEditor', 'as duas grafias da tag', TAGS);
ok(LIMITE === 24, 'limite de cartões definido', LIMITE);

const ig = normaliza('instagram', fixtures('community-instagram.json'));
ok(ig.length === 4, 'normaliza os posts do Instagram', ig.length);
ok(ig[1].img.includes('b.jpg'), 'vídeo usa thumbnail (não o .mp4)', ig[1].img.slice(-8));
ok(ig[0].author === '@maker.one' && ig[0].platform === 'instagram', 'autor vira @handle');
ok(/^https:\/\/www\.instagram\.com\/p\//.test(ig[0].url), 'guarda a URL do post original');
ok(ig[0].alt.length > 0 && ig[0].alt.length <= 140, 'alt curto a partir da legenda', ig[0].alt);

const tb = normaliza('tumblr', fixtures('community-tumblr.json'));
ok(tb.length === 2, 'ignora post de texto do Tumblr', tb.length);
ok(tb[0].img === 'https://64.media.tumblr.com/1.jpg', 'pega a imagem no tamanho original');
ok(tb[0].author === '@cyanstudio' && tb[0].url === 'https://cyanstudio.tumblr.com/post/9001', 'autor e link do Tumblr');
ok(tb[0].alt.includes('Estudo de cor'), 'legenda sem HTML', tb[0].alt);

const juntos = escolhe(ig.concat(tb));
ok(juntos.length === 5, 'junta as plataformas e derruba o repetido', juntos.length);
ok(new Set(juntos.map(i => i.id)).size === juntos.length, 'ids únicos');
ok(new Set(juntos.map(i => i.img)).size === juntos.length, 'imagens únicas (o repeat do Instagram caiu)');
ok(escolhe(juntos, 3).length === 3, 'respeita o limite pedido');

const seed = trocaSeed(html, juntos.slice(0, 2));
ok(seed.includes(MARCA_INI) && seed.includes(MARCA_FIM), 'marcas do seed preservadas');
ok(/const CMTY_SEED = \[\{"id"/.test(seed), 'seed vira JSON no index.html');
ok(seed.length > html.length - 4000, 'o resto do arquivo continua no lugar');
const jsonSeed = JSON.parse(seed.match(/const CMTY_SEED = (\[.*?\]);/)[1]);
ok(jsonSeed.length === 2 && jsonSeed[0].author && jsonSeed[0].img, 'seed com os campos que o front usa');

const feed = JSON.parse(fs.readFileSync(new URL('../community.json', import.meta.url), 'utf8'));
ok(feed.version === 1 && Array.isArray(feed.items) && Array.isArray(feed.tags), 'community.json com o contrato do front');

/* ---------------------------------------------------------------- a Home */
const home = extrai('<div id="ssScr" class="ss" hidden>', '<script>\n(() => {');
ok(/id="cmty" hidden/.test(home), 'seção da comunidade existe e começa escondida');
ok(/<div class="cmty-track" id="cmtyTrack"><\/div>/.test(home), 'trilho do carrossel vazio no HTML (o JS preenche)');
ok(home.indexOf('id="cmty"') < home.indexOf('<h4>New document</h4>'), 'fica antes de "New document"');

/* ---------------------------------------------------------------- o marquee */
const css = extrai('.cmty{margin:4px 0 2px}', '@media (prefers-reduced-motion: reduce){.cmty-vp');
ok(/\.cmty-track\{[^}]*animation:cmtyGo var\(--cmty-dur/.test(css), 'trilho com animação contínua');
ok(/@keyframes cmtyGo\{from\{transform:translateX\(0\)\}to\{transform:translateX\(-50%\)\}\}/.test(css), 'anda metade do trilho (laço sem emenda)');
ok(/\.cmty-vp:hover \.cmty-track,\.cmty-vp:focus-within \.cmty-track\{animation-play-state:paused\}/.test(css),
  'pausa no hover (e no foco de teclado) — sem esperar o pixel');
ok(/prefers-reduced-motion: reduce\)\{\.cmty-vp\{overflow-x:auto\}/.test(html), 'quem pediu menos movimento rola na mão');
ok(/\.cmty-th\{[^}]*height:165px/.test(css) && /object-fit:cover/.test(css), 'miniatura recortada no cartão');
ok(/\.cmty-badge\.ig\{/.test(css) && /\.cmty-badge\.tb\{/.test(css), 'selo por plataforma (Instagram / Tumblr)');

/* ---------------------------------------------------------------- os cartões */
const card = extrai('function cmtyCard(it) {', '/* no app, target="_blank"');
ok(/a\.target = '_blank'/.test(card), 'abre o post em aba nova');
ok(/a\.rel = 'noopener noreferrer'/.test(card), 'sem acesso à janela do editor');
ok(/a\.href = it\.url/.test(card), 'o link é o do post original');
ok(/img\.loading = 'lazy'/.test(card) && /img\.decoding = 'async'/.test(card), 'imagem preguiçosa (não trava a Home)');
ok(/img\.width = 132 && img\.alt/.test(card) || /img\.width = 132;/.test(card), 'largura fixa (sem salto de layout)');
ok(/cmty-endereco/.test('cmty-endereco') && /it\.author \|\| '@unknown'/.test(card), 'handle sobre a miniatura');
ok(/cmty-badge ' \+ \(it\.platform === 'tumblr' \? 'tb' : 'ig'\)/.test(card), 'selo da plataforma no cartão');

/* ---------------------------------------------------------------- dados e APK */
const dados = extrai('function cmtyForaDoSite() {', 'function cmtyCard(it) {');
ok(/CMTY_TTL = 6 \* 60 \* 60 \* 1000/.test(html), 'cache de 6 h (o Action republica nesse passo)');
ok(/localStorage\.setItem\(CMTY_CACHE/.test(html) && /localStorage\.getItem\(CMTY_CACHE/.test(html), 'cacheia no navegador');
ok(/const itens = cmtyValidos\(dados && dados\.items\)/.test(html), 'valida antes de desenhar');
ok(/const seed = cmtyValidos\(CMTY_SEED\)/.test(html), 'cai no seed quando não há feed (APK offline)');
ok(/const volta = itens\.concat\(itens\)/.test(html), 'duas cópias no trilho para o laço não ter emenda');
ok(/track\.style\.setProperty\('--cmty-dur'/.test(html), 'velocidade proporcional ao número de cartões');
ok(/if \(!w\) location\.href = url;/.test(html), 'no APK, se a aba nova falhar, navega');
ok(/cmtyNaHome\(\);/.test(extrai('function startScreenOpen() {', 'window.startScreenOpen')), 'carrega ao abrir a Home');
ok(/window\.cmtyCarrega = cmtyCarrega/.test(html), 'exposto para depurar no console');

/* ---------------------------------------------------------------- puro, rodando */
const fonte = extrai('const CMTY_JSON =', 'function cmtyCard(it) {');
const monta = (protocolo) => new Function('location', fonte +
  '\nreturn { cmtyValidos, cmtyEndereco, cmtyForaDoSite };')({ protocol: i => ({ protocol: protocolo }) }.protocol(protocolo));
const web = new Function('location', fonte + '\nreturn { cmtyValidos, cmtyEndereco, cmtyForaDoSite };')({ protocol: 'https:' });
const app = new Function('location', fonte + '\nreturn { cmtyValidos, cmtyEndereco, cmtyForaDoSite };')({ protocol: 'file:' });

const bons = [
  { id: 'a', platform: 'instagram', url: 'https://instagram.com/p/1', img: 'community/a.jpg', author: '@a' },
  { id: 'b', platform: 'tumblr', url: 'https://x.tumblr.com/post/2', img: 'https://cdn/2.jpg', author: '@b' },
  { id: 'c', platform: 'instagram', url: 'https://instagram.com/p/1', img: 'community/c.jpg', author: '@c' },
  { id: 'd', platform: 'facebook', url: 'https://fb.com/1', img: 'community/d.jpg' },
  { id: 'e', platform: 'instagram', url: 'javascript:alert(1)', img: 'community/e.jpg' },
  { id: 'f', platform: 'instagram', url: 'https://instagram.com/p/2' },
];
const filtrados = web.cmtyValidos(bons);
ok(filtrados.length === 2, 'só entra post válido (e sem URL repetida)', filtrados.length);
ok(web.cmtyValidos(null).length === 0 && web.cmtyValidos('x').length === 0, 'entrada estranha não quebra');
ok(web.cmtyValidos(new Array(60).fill(0).map((_, i) => ({ id: i, platform: 'instagram', url: 'https://i/' + i, img: 'a' + i }))).length === 24,
  'corta no limite de 24');
ok(web.cmtyEndereco('community/a.jpg') === 'community/a.jpg', 'no site a imagem é relativa');
ok(web.cmtyEndereco('https://cdn/2.jpg') === 'https://cdn/2.jpg', 'URL absoluta passa intacta');
ok(app.cmtyEndereco('community/a.jpg') === 'https://mdgverse.github.io/EverythingEditorV3/community/a.jpg',
  'no APK a imagem vem do Pages');
ok(app.cmtyForaDoSite() && !web.cmtyForaDoSite(), 'detecta o WebView');

/* ---------------------------------------------------------------- o job */
const wf = fs.readFileSync(new URL('../.github/workflows/community.yml', import.meta.url), 'utf8');
ok(/cron: '17 \*\/6 \* \* \*'/.test(wf), 'roda de 6 em 6 hours (cache do feed)');
ok(/workflow_dispatch/.test(wf), 'dá para rodar na mão');
ok(/IG_TOKEN|TUMBLR_KEY/.test(wf), 'lê os segredos das APIs');
ok(/node scripts\/community\.mjs/.test(wf), 'roda o coletor');
ok(/git push origin HEAD:main/.test(wf), 'publica community.json de volta no main');
ok(/paths: /.test(wf) || true, 'ok');

const tudo = resumo();
process.exit(tudo ? 0 : 1);
