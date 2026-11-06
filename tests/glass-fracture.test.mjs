import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const FRACTURE_LOCK_KEYS'), end=html.indexOf('// Fracture: radial fractures',start);
assert(start>=0 && end>start);
let calls=[], deleted=0, texture=0, legacy=0;
const ctx=vm.createContext({Math,Uint8Array,JSON,Number,Infinity,
 fx6Hash:(x,y)=>{let h=Math.imul(Math.floor(x),374761393)+Math.imul(Math.floor(y),668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;},
 FX37_DEFAULTS:{fractureEffect:{}},FX_FAST:false,clamp01:v=>Math.max(0,Math.min(1,v)),hexRGB:()=>[1,1,1],
 gl:{TEXTURE_2D:1,TEXTURE_MIN_FILTER:2,TEXTURE_MAG_FILTER:3,NEAREST:4,bindTexture(){},texParameteri(){},deleteTexture(){deleted++}},
 fx4UploadTex:()=>({id:++texture}),acquire:(w,h)=>({w,h,tex:{},busy:true}),mkRes:e=>({w:e.w,h:e.h,tex:e.tex,pooled:e}),
 draw:(name,target,tex,uni)=>calls.push({name,uni}), fx7Canvas:()=>{legacy++;return {w:64,h:64,tex:{}}},fx37Fracture:()=>{},fxFastDims:a=>({W:a.w}),
});
vm.runInContext(html.slice(start,end)+'\nthis.api={fractureSetFreeze,fractureEffectiveParams,fractureBuildMap,fractureTexture,runFracture};',ctx);
const f=ctx.api; const p={fractureEngine:'map',seed:12,displace:28,crackCount:24,angle:0,impactX:50,impactY:50,contourWidth:2,freeze:'no',mix:100};
const bytes=f.fractureBuildMap(p,128,96,32);assert.equal(bytes.length,32*32*4);assert.deepEqual([...bytes],[...f.fractureBuildMap(p,128,96,32)]);assert.notDeepEqual([...bytes],[...f.fractureBuildMap({...p,seed:13},128,96,32)]);
let n={params:{...p},runtime:{}};f.fractureSetFreeze(n,true);n.params.freeze='yes';n.params.seed=55;n.params.displace=90;n.params.fractureEngine='classic';let frozen=f.fractureEffectiveParams(n.params);assert.equal(frozen.seed,12);assert.equal(frozen.displace,28);assert.equal(frozen.fractureEngine,'map');
const input={w:128,h:96,tex:{}};f.runFracture(n,input);assert.equal(calls[0].name,'fractureMap');assert.equal(calls[0].uni.uDisplace,28);assert.equal(calls.at(-1).name,'fractureBlend');assert.equal(n.runtime.fractureMaps.length,1);
calls=[];n.params.frostedBlur=5;f.runFracture(n,input);assert.deepEqual(calls.map(x=>x.name),['fractureMap','blur','blur','fractureBlend']);assert.equal(texture,1);
f.fractureSetFreeze(n,false);n.params.freeze='no';n.params.fractureEngine='map';n.params.displace=0;calls=[];f.runFracture(n,input);assert.equal(calls[0].uni.uDisplace,0);assert.equal(texture,2);
for(let seed=0;seed<5;seed++)f.fractureTexture(n,{...p,seed},128,96);assert.equal(n.runtime.fractureMaps.length,4);assert(deleted>0);
n.params.fractureEngine='classic';n.params.frostedBlur=0;f.runFracture(n,input);assert.equal(legacy,1);
assert(html.includes("NUM('displace', 'Displacement strength', 0, 100, 28, 1)"));
assert(html.includes("n.params.fractureEngine = 'classic'"));assert(html.includes('uDisplace + vec2(uPan.x, -uPan.y)'));
console.log('Glass fracture: mapa, deslocamento, freeze, blur, cache e modo clássico OK');
