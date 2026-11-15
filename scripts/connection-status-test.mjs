import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function setConnection(value)'), end = source.indexOf('function notify(', start);
function setup() {
  const hidden = new Set();
  const state = { settings: { customizations: {} } };
  const els = { connectionStatus: { textContent: '' }, serverPill: { classList: { add: value => hidden.add(`server:${value}`) } }, buildBadge: { classList: { add: value => hidden.add(`build:${value}`) } } };
  const context = vm.createContext({ state, els }); vm.runInContext(source.slice(start, end), context);
  return { state, els, hidden, set: context.setConnection, render: context.renderConnectionStatus };
}
test('one renderer owns live, disconnected and signed-out states', () => {
  const { set, els, hidden } = setup();
  set('Live'); assert.equal(els.connectionStatus.textContent, 'Live');
  set('Not live'); assert.equal(els.connectionStatus.textContent, 'Not live');
  set('Signed out'); assert.equal(els.connectionStatus.textContent, 'Signed out');
  for (const value of ['disconnected', 'offline', 'not connected', 'Loading workspace']) { set(value); assert.equal(els.connectionStatus.textContent, 'Not live'); }
  assert.deepEqual([...hidden].sort(), ['build:hidden','server:hidden']);
});
test('custom labels survive rerenders without a mutation observer overwriting them', () => {
  const { state, els, set, render } = setup();
  state.settings.customizations = { connectedLabel: 'Connected to school', disconnectedLabel: 'Connection paused' };
  set('Live'); assert.equal(els.connectionStatus.textContent, 'Connected to school');
  render(); assert.equal(els.connectionStatus.textContent, 'Connected to school');
  set('Not live'); assert.equal(els.connectionStatus.textContent, 'Connection paused');
  state.settings.customizations = {}; render(); assert.equal(els.connectionStatus.textContent, 'Not live');
});
