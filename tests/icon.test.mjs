/* Ícone oficial Ouroboros (1.1.1): a arte enviada pelo usuário virou o
   favicon do site e o ícone do app Android, sem tocar em applicationId,
   assinatura nem dados. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const le = c => fs.readFileSync(new URL('../' + c, import.meta.url));
const html = le('index.html').toString('utf8');

function pngDims(buf) {
  if (buf.length < 24 || buf.toString('latin1', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

console.log('Ícone oficial · Ouroboros');

/* fonte e tamanhos web */
const fonte = pngDims(le('assets/branding/ouroboros-icon-1024.png'));
ok(fonte && fonte.w === 1024 && fonte.h === 1024, 'fonte oficial guardada em 1024×1024', fonte);
for (const [arq, tam] of [['icon-512.png', 512], ['icon-192.png', 192], ['icon-180.png', 180], ['icon-32.png', 32]]) {
  const d = pngDims(le('assets/branding/' + arq));
  ok(d && d.w === tam && d.h === tam, arq + ' é ' + tam + '×' + tam, d);
}

/* o <head> aponta para os arquivos novos (nada do SVG antigo do infinito) */
ok(html.includes('<link rel="icon" type="image/png" sizes="512x512" href="assets/branding/icon-512.png" />'), 'favicon usa o Ouroboros');
ok(html.includes('href="assets/branding/icon-192.png"'), 'shortcut icon usa o Ouroboros');
ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="assets/branding/icon-180.png" />'), 'apple-touch-icon usa o Ouroboros');
ok(!html.includes("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'"), 'SVG antigo do infinito saiu do <head>');

/* Android: adaptive icon com o foreground novo em todas as densidades */
const adapt = le('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml').toString('utf8');
ok(adapt.includes('@mipmap/ic_launcher_foreground'), 'adaptive icon usa o foreground Ouroboros');
ok(adapt.includes('@color/ic_launcher_background'), 'fundo do adaptive icon continua o preto da arte');
ok(!fs.existsSync(new URL('../android/app/src/main/res/drawable/ic_launcher_foreground.xml', import.meta.url)), 'vetor antigo do infinito foi removido');
for (const [pasta, fg, leg] of [['mdpi', 108, 48], ['hdpi', 162, 72], ['xhdpi', 216, 96], ['xxhdpi', 324, 144], ['xxxhdpi', 432, 192]]) {
  const base = 'android/app/src/main/res/mipmap-' + pasta + '/';
  const dF = pngDims(le(base + 'ic_launcher_foreground.png'));
  const dL = pngDims(le(base + 'ic_launcher.png'));
  const dR = pngDims(le(base + 'ic_launcher_round.png'));
  ok(dF && dF.w === fg && dF.h === fg, pasta + ': foreground ' + fg + 'px', dF);
  ok(dL && dL.w === leg && dR && dR.w === leg, pasta + ': legado e redondo ' + leg + 'px');
}

/* o que não podia mudar, não mudou */
const manifest = le('android/app/src/main/AndroidManifest.xml').toString('utf8');
ok(manifest.includes('android:icon="@mipmap/ic_launcher"'), 'manifesto continua em @mipmap/ic_launcher');
const gradle = le('android/app/build.gradle').toString('utf8');
ok(gradle.includes("applicationId 'br.com.mdgverse.everythingeditor'"), 'applicationId preservado (atualiza por cima)');

process.exit(resumo() ? 0 : 1);
