import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('function sprayDetectMaskMode('), b=html.indexOf('// Textura de trabalho menor',a);
assert(a>=0 && b>a);
const c=vm.createContext({Math}); vm.runInContext(html.slice(a,b)+'\nthis.api={sprayDetectMaskMode,sprayBinaryChunk}',c);
const {sprayDetectMaskMode:detect,sprayBinaryChunk:convert}=c.api;
function rgba(values) {return new Uint8ClampedArray(values.flat());}
function convertAll(p,mode,t=128,invert=false){convert(p,0,p.length,t,mode,invert);return [...p];}
let p=rgba([[0,0,0,0],[25,80,200,127],[20,20,20,128],[1,2,3,255]]);
assert.equal(detect(p,2,2),'alpha');
assert.deepEqual(convertAll(p,'alpha'),[0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255]);
p=rgba([[255,255,255,255],[255,255,255,255],[0,0,0,255],[255,255,255,255]]);assert.equal(detect(p,2,2),'dark');
assert.deepEqual(convertAll(p,'dark').slice(8,12),[255,255,255,255]);
p=rgba([[0,0,0,255],[0,0,0,255],[250,250,250,255],[0,0,0,255]]);assert.equal(detect(p,2,2),'light');
assert.deepEqual(convertAll(p,'light',128,true).slice(8,12),[0,0,0,0]);
p=rgba([[255,255,255,255],[0,0,0,255]]); convert(p,4,8,128,'dark',false); assert.deepEqual([...p.slice(0,4)],[255,255,255,255]); assert.deepEqual([...p.slice(4)],[255,255,255,255]);
assert(html.includes('uSprayAtlas: n.runtime.sprayLocalTex || sprayAtlasTexture()'));
assert(html.includes('gl.deleteTexture(n.runtime.sprayLocalTex)'));
assert(html.includes('canvas.toBlob(blob=>'));
console.log('Conversão local: transparência, polaridade, limiar, inversão, blocos e descarte OK');
