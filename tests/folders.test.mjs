/* Árvore de pastas da biblioteca: órfãs visíveis e proteção contra ciclo.
   (Era o bug do "folder criado mas não aparece": pasta com parentId apontando
   para uma pasta que não existe mais ficava fora da tela.) */
import fs from 'node:fs';
import { ok, resumo } from './zip-kit.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const marca = 'function astArvorePastas(';
const ini = html.indexOf(marca);
if (ini < 0) throw new Error('astArvorePastas não encontrada no index.html');

/* recorta a função pelo balanceamento de chaves */
function recorta(src, inicio) {
  const abre = src.indexOf('{', inicio);
  let nivel = 0;
  for (let i = abre; i < src.length; i++) {
    const c = src[i];
    if (c === '{') nivel++;
    else if (c === '}') { nivel--; if (!nivel) return src.slice(inicio, i + 1); }
  }
  throw new Error('função sem fim');
}
const astArvorePastas = new Function(recorta(html, ini) + '\nreturn astArvorePastas;')();

const F = (id, name, parentId) => ({ id, name, parentId });

/* 1 — hierarquia normal */
{
  console.log('Hierarquia normal');
  const arv = astArvorePastas([F('a', 'texturas'), F('b', 'papel', 'a'), F('c', 'icones'), F('d', 'ripa', 'b')]);
  ok(arv.map(x => x.f.name).join('>') === 'icones>texturas>papel>ripa', 'ordem: irmãs em ordem, filhas depois da mãe', arv.map(x => x.f.name));
  ok(arv.find(x => x.f.name === 'papel').nivel === 1, 'papel no nível 1');
  ok(arv.find(x => x.f.name === 'ripa').nivel === 2, 'ripa no nível 2');
  ok(arv.length === 4, 'todas as 4 aparecem');
}

/* 2 — órfã: pai apagado */
{
  console.log('\nPasta órfã (pai apagado)');
  const arv = astArvorePastas([F('x', 'papel', 'sumiu'), F('y', 'morta', 'outro')]);
  ok(arv.length === 2, 'as duas aparecem mesmo sem o pai', arv.length);
  ok(arv.every(x => x.nivel === 0), 'voltam para a raiz');
}

/* 3 — pasta que é filha de si mesma */
{
  console.log('\nPasta filha de si mesma');
  const arv = astArvorePastas([F('a', 'loop', 'a')]);
  ok(arv.length === 1 && arv[0].nivel === 0, 'aparece na raiz, sem recursão infinita');
}

/* 4 — ciclo entre duas pastas */
{
  console.log('\nCiclo A→B→A');
  const arv = astArvorePastas([F('a', 'A', 'b'), F('b', 'B', 'a')]);
  ok(arv.length === 2, 'as duas aparecem', arv.length);
  ok(new Set(arv.map(x => x.f.id)).size === 2, 'sem duplicatas');
}

/* 5 — pasta normal + órfã juntas */
{
  console.log('\nMistura de árvore válida com órfã');
  const arv = astArvorePastas([F('a', 'raiz'), F('b', 'filha', 'a'), F('c', 'perdida', 'naoExiste')]);
  ok(arv.length === 3, 'três pastas na lista');
  ok(arv.filter(x => x.nivel === 0).length === 2, 'duas na raiz (raiz + órfã)', arv.map(x => x.f.name + ':' + x.nivel));
}

process.exit(resumo() ? 0 : 1);
