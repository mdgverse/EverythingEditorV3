/* Versão do app: um número só (arquivo VERSION), usado no index.html e no APK. */
import fs from 'node:fs';
import { ok, resumo } from './kit.mjs';

const tudo = url => fs.readFileSync(new URL(url, import.meta.url), 'utf8');
const html = tudo('../index.html');
const yml = tudo('../.github/workflows/build-apk.yml');
const gradle = tudo('../android/app/build.gradle');

let versao = '';
try { versao = fs.readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim(); } catch (e) {}
console.log('versão do app: ' + (versao || '(sem VERSION)'));

/* ---------- o arquivo VERSION ---------- */
ok(/^\d+\.\d+\.\d+$/.test(versao), 'VERSION existe e é x.y.z', versao);
ok(versao === '1.1.1', 'versão publicada é 1.1.1', versao);

/* ---------- o index.html carrega o mesmo número ---------- */
ok(new RegExp("const APP_VERSION = '" + versao.replace(/\./g, '\\.') + "'").test(html), 'index.html tem APP_VERSION igual ao VERSION');
ok(!/ee-splash|eeSplash/.test(html), 'a telinha de entrada saiu (o app monta direto)', 'splash');
ok(/<body>\s*<div class="app">/.test(html), 'o body começa no app, sem overlay na frente', 'boot');

/* ---------- o APK usa o mesmo número ---------- */
ok(/VER=\$\(tr -d '\[:space:\]' < VERSION\)/.test(yml), 'workflow lê o VERSION', 'yml');
ok(/APK_VERSION_NAME: \$\{\{ steps\.ver\.outputs\.name \}\}/.test(yml), 'versionName do APK vem do VERSION');
ok(!/APK_VERSION_NAME: '1\.0\./.test(yml), 'não usa mais 1.0.<run number>');
ok(/APK_VERSION_CODE: \$\{\{ github\.run_number \}\}/.test(yml), 'versionCode continua crescendo (run number)');
ok(/APP_VERSION = '\$VER'/.test(yml), 'o build falha se VERSION e index.html saírem de sincronia', 'guarda');
ok(/OuroborosEditor-\$VER\.apk/.test(yml), 'publica com o nome versionado', 'nome');
ok(/cp "\$APK" dist\/OuroborosEditor\.apk/.test(yml), 'mantém o link fixo OuroborosEditor.apk');
ok(/OuroborosEditor-\$VER\.aab/.test(yml), 'o .aab também sai versionado');
ok(/gh release edit apk-latest --title "Ouroboros Editor — APK v\$VER"/.test(yml), 'o título da release mostra a versão');
ok(/releases\/download\/apk-latest\/OuroborosEditor-\$\{\{ steps\.ver\.outputs\.name \}\}\.apk/.test(yml), 'o resumo aponta o arquivo da versão');
ok(/      - 'VERSION'/.test(yml), 'mudar só o VERSION já dispara o build do APK', 'paths');
ok(/gh release delete-asset apk-latest "\$nome" -y/.test(yml), 'a release apaga os assets de versões antigas', 'limpeza');
ok(/"OuroborosEditor-\$VER\.apk"\|"OuroborosEditor-\$VER\.aab"\|OuroborosEditor\.apk\|OuroborosEditor\.aab/.test(yml),
  'a limpeza preserva a versão atual e os links fixos', 'preserva');
ok(/new File\("\$\{rootProject\.projectDir\}\/\.\.\/VERSION"\)/.test(gradle), 'build local também lê o VERSION', 'gradle');

/* ---------- a versão acompanha o editor ---------- */
ok(!/APP_VERSION = '0\.0\.0'|VERSION\s*$/.test(html.slice(0, 50)), 'sem sobras de versão vazia');
/* a marca Ouroboros Editor recomeça a numeração em 1.0.0; quem garante a
   atualização por cima da instalação atual é o versionCode (run number) */
ok(!/editor/i.test(versao), 'versionName é só o número: a marca não entra na versão', versao);

process.exit(resumo() ? 0 : 1);
