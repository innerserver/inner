import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{fromPixels,fromImage}=require('../public/photo-palette');
const luminance=hex=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('image palettes are deterministic and maintain text and accent contrast',()=>{
 for(const color of [[10,70,150],[230,170,30],[150,20,30],[245,245,245],[0,0,0],[128,128,128],[10,200,80]]){
  const pixels=Uint8Array.from(Array.from({length:100},()=>[...color,255]).flat()),palette=fromPixels(pixels);
  assert.deepEqual(palette,fromPixels(pixels));
  for(const bg of ['bg','surface']){assert.ok(ratio(palette.ink,palette[bg])>=4.5,JSON.stringify(palette));assert.ok(ratio(palette.accent,palette[bg])>=4.5,JSON.stringify(palette));}
 }
 assert.notDeepEqual(fromPixels([0,40,200,255]),fromPixels([200,40,0,255]));
});
test('transparent pixels cannot dominate the extracted palette and empty images fail',()=>{
 assert.deepEqual(fromPixels([255,0,0,0,20,80,150,255]),fromPixels([20,80,150,255]));
 assert.throws(()=>fromPixels([255,0,0,0]),/no visible colours/);
});
test('colour extraction refuses remote URLs rather than fetching a photo externally',async()=>{
 await assert.rejects(fromImage('https://example.test/photo.png'),/Upload a photo/);
});
