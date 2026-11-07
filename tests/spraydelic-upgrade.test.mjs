import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=html.slice(html.indexOf('function vandalMaskAtlas()'), html.indexOf('/* Spraydelic (2.9.60) — presets:'));
const ctx=vm.createContext({Uint8Array,Math}); vm.runInContext(section+'\nthis.api={vandalMaskAtlas,vandalParsePalette};',ctx);
const {vandalMaskAtlas,vandalParsePalette}=ctx.api;
const data=vandalMaskAtlas(); assert.equal(data.length,256*64*4);
let white=0,black=0;
for(let i=0;i<data.length;i+=4) { assert(data[i]===0 || data[i]===255); assert.equal(data[i],data[i+1]); assert.equal(data[i],data[i+2]); assert.equal(data[i+3],255); data[i] ? white++ : black++; }
assert(white>100 && black>100); assert.deepEqual([...vandalMaskAtlas()],[...data]);
const plain=x=>Array.from(x);
assert.deepEqual(plain(vandalParsePalette('GIMP Palette\nName: Test\n255 0 128 pink\n0 12 255 blue\n')), ['#FF0080','#000CFF']);
assert.deepEqual(plain(vandalParsePalette('["#112233", "#abcdef"]')), ['#112233','#ABCDEF']);
assert.deepEqual(plain(vandalParsePalette('https://coolors.co/ff0000-00ff00-0000ff')), ['#FF0000','#00FF00','#0000FF']);
assert.equal(vandalParsePalette('nonsense').length,0);
const def=html.slice(html.indexOf('  vandal: {'),html.indexOf('  ascii: {'));
for (const p of ['density','radius','jitter','variance','pressure','drip','bleed','cast','c1','c6','grain','seed']) assert(def.includes("'"+p+"'"),p);
assert(def.includes("NUM('density', 'Splatter density', 0, 100, 0)"), 'projetos antigos sem scatter mantêm aparência');
assert(html.includes('n.runtime.vandalLocalTex || vandalAtlasTexture()'));
assert(html.includes("circle.addEventListener('pointerdown'") && html.includes("panel.addEventListener('drop'"));
assert(html.includes("nd.type === 'spraydelic'") && html.includes("vandalMode: 'classic'"));
assert(html.includes("vandalBox.addEventListener('pointermove'") && html.includes("svg.addEventListener('pointermove'"));
assert(html.includes('alpha=a+src.a*(1.0-a)'));
console.log('Vandal: máscaras, gestos, alpha e migração presentes');

// O modo novo produz base e decal em passes separados; modos antigos não mudam.
const runStart=html.indexOf('  vandal: (n, [a]) => {');
const runEnd=html.indexOf('  distressor: (n, [a]) => {',runStart);
const calls=[], targets=[];
const runtime=vm.createContext({Number,Math,acquire:(w,h)=>{const t={w,h,tex:{},busy:true};targets.push(t);return t;},
  draw:(name,target,textures,uniforms)=>calls.push({name,target,textures,uniforms}),
  mkRes:e=>({tex:e.tex,w:e.w,h:e.h,pooled:e}),ptRes:a=>({...a,pooled:null}),hexRGB:()=>[1,0,0],vandalAtlasTexture:()=> 'atlas'});
vm.runInContext('this.run=({'+html.slice(runStart,runEnd)+'}).vandal',runtime);
const params={vandalMode:'combined',vandalStop1:17,vandalStop2:33,vandalStop3:50,vandalStop4:67,vandalStop5:83,vandalSoft:0,
  vandalMasks:[], vandalSoft1:0,vandalSoft2:0,vandalSoft3:0,vandalSoft4:0,vandalSoft5:0, zones:3,decalX:50,decalY:50,decalScale:40,decalAsset:'1',decalOpacity:100,paletteCast:0,
  c1:'#000000',c2:'#ff0000',c3:'#00ff00',c4:'#ffffff',c5:'#ffffff',c6:'#ffffff'};
const node={params,runtime:{}}, source={w:64,h:64,tex:{}};
let result=runtime.run(node,[source]);
assert.deepEqual(calls.map(x=>x.name),['vandalBase','vandalDecal']);
assert.equal(calls[0].textures.uSrc,source.tex);assert.equal(calls[1].textures.uSrc,calls[0].target.tex);
assert.equal(calls[0].uniforms.uStop1,.17);assert.equal(calls[1].uniforms.uOpacity,1);
assert.equal(calls[0].target.busy,false);assert.equal(result.pooled.busy,true);
for(const [mode,expected] of [['classic','vandalLegacy'],['decal','vandalDecal']]){
  calls.length=0;params.vandalMode=mode;runtime.run(node,[source]);assert.deepEqual(calls.map(x=>x.name),[expected]);
}

// Uma seleção local vazia não desenha o splash; máscaras têm passes e transformações próprios.
calls.length=0;params.vandalMode='combined';params.decalAsset='local';params.vandalMasks=[];runtime.run(node,[source]);
assert.deepEqual(calls.map(x=>x.name),['vandalBase']);
params.vandalMasks=[{id:'a',x:20,y:30,scale:40,color:'#ff0000',opacity:100},{id:'b',x:80,y:70,scale:20,color:'#00ff00',opacity:50}];
node.runtime.vandalMaskTextures={a:{tex:'texture-a'},b:{tex:'texture-b'}};params.vandalSoft1=75;params.vandalSoft2=0;
calls.length=0;result=runtime.run(node,[source]);
assert.deepEqual(calls.map(x=>x.name),['vandalBase','vandalDecal','vandalDecal']);
assert.equal(calls[0].uniforms.uWheelSoft1,.75);assert.equal(calls[0].uniforms.uWheelSoft2,0);
assert.equal(calls[1].textures.uAtlas,'texture-a');assert.equal(calls[2].textures.uAtlas,'texture-b');
assert.deepEqual(Array.from(calls[1].uniforms.uPosition),[.2,.3]);assert.deepEqual(Array.from(calls[2].uniforms.uPosition),[.8,.7]);
assert.equal(calls[1].target.busy,false);assert.equal(result.pooled.busy,true);

const startShader=html.indexOf('SHADERS.vandalLegacy = `'),stopShader=html.indexOf('  /* Noise Texture',startShader);
const shaders=vm.createContext({SHADERS:{}});vm.runInContext(html.slice(startShader,stopShader),shaders);
assert(shaders.SHADERS.vandalBase.includes('level >= uStop1'));
for(let i=1;i<=5;i++) assert(shaders.SHADERS.vandalBase.includes('uWheelSoft'+i));
assert(!shaders.SHADERS.vandalBase.includes('float z = pow(t, uCurve) * uZones;'));
assert(shaders.SHADERS.vandalLegacy.includes('float z = pow(t, uCurve) * uZones;'));
const normStart=html.indexOf('function vandalNormalizeStops('),normEnd=html.indexOf('function vandalPaletteUI(',normStart);
const norm=vm.createContext({Number,Math});vm.runInContext(html.slice(normStart,normEnd)+'\nthis.normalize=vandalNormalizeStops;',norm);
const p={zones:6,vandalStop1:95,vandalStop2:33,vandalStop3:50,vandalStop4:67,vandalStop5:83};norm.normalize(p);
assert.deepEqual([p.vandalStop1,p.vandalStop2,p.vandalStop3,p.vandalStop4,p.vandalStop5],[83,87,91,95,99]);
assert(html.includes("slice.addEventListener('dblclick'"));
console.log('Vandal: passes independentes, modos legados e limites ordenados OK');

assert(html.includes("if(/^c[1-6]$/.test(key)){el.remove();continue;}"));
assert(!html.includes('function vandalLogo('));
assert(html.includes("className='vandal-wheel-picker'"));
assert(html.includes("n.params['vandalSoft'+(boundary+1)]=Number(softenInput.value)"));
assert(html.includes("if (!('vandalSoft'+i in opts.params))"));
assert(html.includes("swatch.addEventListener('click'"));
assert(html.includes("p.decalAsset!=='local'"));
assert(html.includes('vandalEnsureMaskTextures(n)'));
console.log('Vandal: interface, suavização individual e máscaras locais OK');

// Rotação e visibilidade são individuais; os dados antigos sem rotação continuam em 0°.
params.vandalMode='combined';params.decalAsset='local';params.vandalMasks[0].rotation=90;params.vandalMasks[1].visible=false;
calls.length=0;runtime.run(node,[source]);
assert.deepEqual(calls.map(x=>x.name),['vandalBase','vandalDecal']);
assert(Math.abs(calls[1].uniforms.uRotation[0])<1e-9);assert.equal(calls[1].uniforms.uRotation[1],1);
const shader=html.slice(html.indexOf('SHADERS.vandalDecal = `'),html.indexOf('/* Topog:',html.indexOf('SHADERS.vandalDecal = `')));
assert(shader.includes('texture(uSrc,vUv)'));assert(shader.includes('vec2((uAsset+m.x)*0.25,m.y)'));
assert(html.includes("group('Local Mask',true)"));assert(html.includes("className='vandal-group'"));
assert(html.includes("'Rotation (°)'"));assert(html.includes('vandal-mask-visibility'));assert(html.includes('vandal-mask-delete'));
console.log('Vandal: rotação, visibilidade e orientação da máscara OK');

// A biblioteca licenciada é autocontida, numerada e empacotada nas duas plataformas.
const assetFiles=fs.readdirSync(new URL('../assets/vandal/',import.meta.url)).filter(n=>n.endsWith('.png')).sort();
assert.deepEqual(assetFiles,Array.from({length:200},(_,i)=>String(i+1).padStart(3,'0')+'.png'));
for(const name of assetFiles){
  const png=fs.readFileSync(new URL('../assets/vandal/'+name,import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name);
  assert.equal(png.readUInt32BE(16),256,name);assert.equal(png.readUInt32BE(20),256,name);
}
assert(html.includes("id.slice(8)+'.png'"));
assert(html.includes('n.runtime.vandalDefault=entry'));
assert(fs.readFileSync(new URL('../android/app/build.gradle',import.meta.url),'utf8').includes('from("${rootProject.projectDir}/../assets")'));
assert(fs.readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8').includes('cp -R assets _site/assets'));
console.log('Vandal: 200 máscaras locais e empacotamento Web/Android OK');

// Loads can finish after a rapid selection change: stale loads must not block retry.
const loaderStart=html.indexOf('function vandalDefaultTexture('),loaderEnd=html.indexOf('function vandalMaskThumbnail(',loaderStart);
const images=[],dirty=[];let deleted=0;
class FakeImage { constructor(){images.push(this);} }
const target={id:8,params:{decalAsset:'texture-001'},runtime:{},ui:{}};
const loader=vm.createContext({Image:FakeImage,nodes:new Map([[8,target]]),gl:{deleteTexture:()=>deleted++},
  vandalMakeMaskTexture:()=>({}),markDirty:id=>dirty.push(id),requestRender:()=>{},setStatus:()=>{}});
vm.runInContext(html.slice(loaderStart,loaderEnd)+'\nthis.load=vandalDefaultTexture;',loader);
assert.equal(loader.load(target,'texture-001'),null);assert.equal(images[0].src,'assets/vandal/001.png');
target.params.decalAsset='texture-002';images[0].onload();assert.equal(target.runtime.vandalDefault,null);
target.params.decalAsset='texture-001';loader.load(target,'texture-001');images[1].onload();assert(target.runtime.vandalDefault.tex);assert.deepEqual(dirty,[8]);
target.params.decalAsset='texture-002';loader.load(target,'texture-002');assert.equal(deleted,1);images[2].onerror();assert.equal(target.runtime.vandalDefault,null);
assert(html.includes('function vandalLibrary('));assert(html.includes("p.key === 'decalAsset' && n.params.vandalMode === 'classic'"));
console.log('Vandal: biblioteca visível e carregamento recuperável OK');

// The bundled library belongs in Paint Effects / Local Mask, next to imports.
const panelStart=html.indexOf('function vandalPanel('),panelEnd=html.indexOf('function addPanelResize(',panelStart);
const panelSource=html.slice(panelStart,panelEnd);
assert(panelSource.includes("const localGroup=group('Local Mask',true)"));
assert(panelSource.includes('vandalLibrary(n,localGroup)'));
assert(panelSource.includes('vandalLocalMaskUI(n,localGroup)'));
assert(html.includes('white-space:normal;overflow-wrap:anywhere'));
console.log('Vandal: biblioteca em Local Mask e abas adaptáveis OK');

// Bundled textures and imported images are independent layers, with legacy
// defaults preserving the old square appearance when stretch is absent.
params.vandalMasks=[{id:'a',asset:'texture-001',x:20,y:30,scale:40,stretchX:175,stretchY:65,color:'#ff0000',opacity:100},
  {id:'b',data:'data:image/png;base64,test',x:80,y:70,scale:20,color:'#00ff00',opacity:50}];
node.runtime.vandalMaskTextures={a:{tex:'texture-a'},b:{tex:'texture-b'}};
calls.length=0;runtime.run(node,[source]);
assert.deepEqual(Array.from(calls[1].uniforms.uStretch),[1.75,.65]);
assert.deepEqual(Array.from(calls[2].uniforms.uStretch),[1,1]);
assert(html.includes("mask.asset.slice(8)+'.png'"));
assert(html.includes("body.insertBefore(layers,panel)"));
assert(html.includes("n.params.vandalMasks.push(m);n.runtime.vandalSelectedMask=m.id"));
assert(html.includes("'Stretch width'"));assert(html.includes("'Stretch height'"));assert(html.includes("'Rotate asset'"));
console.log('Vandal: camadas de assets e esticamento independente compatíveis com projetos antigos OK');
