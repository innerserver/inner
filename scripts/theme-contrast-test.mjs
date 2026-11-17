import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function themeLuminance('), end = source.indexOf('function safeColor(', start);
const context = vm.createContext({});vm.runInContext(source.slice(start, end), context);
test('foreground selection maintains readable contrast through the gray boundary and custom accents', () => {
  const colors = ['#245c4f','#8dd5b6','#d7ba73','#7ee0c2','#176b5a','#f2d397'];
  for (let value=0;value<256;value++) colors.push('#'+value.toString(16).padStart(2,'0').repeat(3));
  for (const color of colors) assert.ok(context.themeContrastRatio(context.themeForeground(color),color)>=4.5,color);
});
test('colour helpers match black/white contrast and handle unsupported values safely', () => {
  assert.equal(context.themeContrastRatio('#000000','#ffffff'),21);
  assert.equal(context.themeContrastRatio('#ffffff','#000000'),21);
  assert.equal(context.themeLuminance('rgba(1,2,3,.5)'),null);
  assert.equal(context.themeContrastRatio('invalid','#ffffff'),1);
});
