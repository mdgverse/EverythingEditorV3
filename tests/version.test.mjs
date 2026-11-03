/* Versão do app: um número só (arquivo VERSION), usado na telinha e no APK. */
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
ok(versao === '3.1.2', 'versão publicada é 3.1.2', versao);

/* ---------- a telinha mostra o mesmo número ---------- */
ok(new RegExp("const APP_VERSION = '" + versao.replace(/\./g, '\\.') + "'").test(html), 'index.html tem APP_VERSION igual ao VERSION');
ok(/<p class="ee-splash-ver" id="eeSplashVer"><\/p>/.test(html), 'o card da telinha tem o lugar da versão');
ok(/\.ee-splash-ver\{[^}]*\}/.test(html), 'a versão tem estilo próprio (discreta)');
ok(/ver\.textContent = 'v' \+ APP_VERSION/.test(html), 'a telinha escreve “v” + versão', 'splash');
ok(/ver\.title = 'Everything Editor ' \+ APP_VERSION/.test(html), 'o tooltip da versão usa a mesma constante');

/* ---------- o APK usa o mesmo número ---------- */
ok(/VER=\$\(tr -d '\[:space:\]' < VERSION\)/.test(yml), 'workflow lê o VERSION', 'yml');
ok(/APK_VERSION_NAME: \$\{\{ steps\.ver\.outputs\.name \}\}/.test(yml), 'versionName do APK vem do VERSION');
ok(!/APK_VERSION_NAME: '1\.0\./.test(yml), 'não usa mais 1.0.<run number>');
ok(/APK_VERSION_CODE: \$\{\{ github\.run_number \}\}/.test(yml), 'versionCode continua crescendo (run number)');
ok(/APP_VERSION = '\$VER'/.test(yml), 'o build falha se VERSION e telinha saírem de sincronia', 'guarda');
ok(/everything-editor-\$VER\.apk/.test(yml), 'publica com o nome versionado', 'nome');
ok(/cp "\$APK" dist\/EverythingEditor\.apk/.test(yml), 'mantém o link fixo EverythingEditor.apk');
ok(/everything-editor-\$VER\.aab/.test(yml), 'o .aab também sai versionado');
ok(/gh release edit apk-latest --title "Everything Editor — APK v\$VER"/.test(yml), 'o título da release mostra a versão');
ok(/releases\/download\/apk-latest\/everything-editor-\$\{\{ steps\.ver\.outputs\.name \}\}\.apk/.test(yml), 'o resumo aponta o arquivo da versão');
ok(/      - 'VERSION'/.test(yml), 'mudar só o VERSION já dispara o build do APK', 'paths');
ok(/new File\("\$\{rootProject\.projectDir\}\/\.\.\/VERSION"\)/.test(gradle), 'build local também lê o VERSION', 'gradle');

/* ---------- a versão acompanha o editor ---------- */
ok(!/APP_VERSION = '0\.0\.0'|VERSION\s*$/.test(html.slice(0, 50)), 'sem sobras de versão vazia');
/* as notas internas do código seguem a numeração do projeto de referência
   (chegam a 3.1.x), então o que vale é a linha 3.0 do editor */
ok(Number(versao.split('.')[0]) >= 3, 'versão na linha 3.x (Editor 3.0)', versao);

process.exit(resumo() ? 0 : 1);
