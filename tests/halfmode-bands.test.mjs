import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const engine=html.slice(html.indexOf('const HM = (function () {'),html.indexOf('const HM_PATTERN_OPTS'));
const cfg=html.slice(html.indexOf('function hmNum('),html.indexOf('function fx5HalfModeRender('));
const ctx=vm.createContext({Uint8ClampedArray,Uint8Array,Float32Array,Math,Number,isNaN,isFinite});
vm.runInContext(engine+cfg+'\nthis.HM=HM;this.config=hmCfgFromParams;this.spec=halfModeBandSpec;',ctx);
const {HM,config,spec}=ctx;
for(const [count,expected] of [[1,[]],[2,[50]],[3,[33,67]],[4,[25,50,75]]]) assert.deepEqual(Array.from(spec({},count).stops),expected);
assert.deepEqual(Array.from(spec({hmBands:{4:{stops:[99,-100,0],soft:[-5,200,null]}}},4).stops),[91,95,99]);
assert.deepEqual(Array.from(spec({hmBands:{4:{stops:[99,-100,0],soft:[-5,200,null]}}},4).soft),[0,100,0]);
const p={pattern:'none-smooth',scale:2,contrast:100,background:'#ffffff',inkMultiply:100,softness:0,useInk1:'yes',useInk2:'no',useInk3:'yes',useInk4:'yes',ink1:'#ff0000',ink2:'#ffffff',ink3:'#00ff00',ink4:'#0000ff',opacity1:100,opacity3:100,opacity4:100};
const w=256,src=new Uint8ClampedArray(w*4);for(let x=0;x<w;x++){src[x*4]=src[x*4+1]=src[x*4+2]=x;src[x*4+3]=255;}
const render=params=>HM.renderHalfMode(src,w,1,config(params));
const legacy=render(p);assert.equal(config(p).inkBands,null);
const custom={...p,hmBands:{3:{stops:[30,70],soft:[0,0]}}};const out=render(custom);
const rgb=x=>Array.from(out.slice(x*4,x*4+3));
for(const [x,channel] of [[20,0],[128,1],[220,2]]){const pixel=rgb(x);assert(pixel[channel]>pixel[(channel+1)%3] && pixel[channel]>pixel[(channel+2)%3],`${x}: ${pixel}`);}
assert.notDeepEqual(Array.from(out),Array.from(legacy));
const moved=render({...custom,hmBands:{3:{stops:[60,70],soft:[0,0]}}});assert.notDeepEqual(Array.from(moved),Array.from(out));
const smooth=render({...custom,hmBands:{3:{stops:[30,70],soft:[100,0]}}});assert.notDeepEqual(Array.from(smooth),Array.from(out));
const sorted=render({...custom,autoSort:'yes'});assert.deepEqual(Array.from(sorted),Array.from(out),'auto sort must not change which ink occupies each tonal band');
assert.deepEqual(Array.from(render({...custom,useOriginal:'yes'})),Array.from(render({...p,useOriginal:'yes'})),'original-color mode bypasses bands');
assert.notEqual(createHash('sha256').update(legacy).digest('hex'),createHash('sha256').update(out).digest('hex'));
console.log('HalfMode: tonal bands, limits, softness, inactive inks, auto-sort and classic mode OK');
