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
ok(versao === '3.17.2', 'versão publicada é 3.17.2', versao);

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
ok(/everything-editor-\$VER\.apk/.test(yml), 'publica com o nome versionado', 'nome');
ok(/cp "\$APK" dist\/EverythingEditor\.apk/.test(yml), 'mantém o link fixo EverythingEditor.apk');
ok(/everything-editor-\$VER\.aab/.test(yml), 'o .aab também sai versionado');
ok(/gh release edit apk-latest --title "Everything Editor — APK v\$VER"/.test(yml), 'o título da release mostra a versão');
ok(/releases\/download\/apk-latest\/everything-editor-\$\{\{ steps\.ver\.outputs\.name \}\}\.apk/.test(yml), 'o resumo aponta o arquivo da versão');
ok(/      - 'VERSION'/.test(yml), 'mudar só o VERSION já dispara o build do APK', 'paths');
ok(/gh release delete-asset apk-latest "\$nome" -y/.test(yml), 'a release apaga os assets de versões antigas', 'limpeza');
ok(/"everything-editor-\$VER\.apk"\|"everything-editor-\$VER\.aab"\|EverythingEditor\.apk\|EverythingEditor\.aab/.test(yml),
  'a limpeza preserva a versão atual e os links fixos', 'preserva');
ok(/new File\("\$\{rootProject\.projectDir\}\/\.\.\/VERSION"\)/.test(gradle), 'build local também lê o VERSION', 'gradle');

/* ---------- a versão acompanha o editor ---------- */
ok(!/APP_VERSION = '0\.0\.0'|VERSION\s*$/.test(html.slice(0, 50)), 'sem sobras de versão vazia');
/* as notas internas do código seguem a numeração do projeto de referência
   (chegam a 3.1.x), então o que vale é a linha 3.0 do editor */
ok(Number(versao.split('.')[0]) >= 3, 'versão na linha 3.x (Editor 3.0)', versao);

process.exit(resumo() ? 0 : 1);
