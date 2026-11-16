import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const imports = source.slice(source.indexOf('async function importStickersFromInput('), source.indexOf('async function collectStickerImportFiles('));
const preference = source.slice(source.indexOf('function stickerImportPublic('), source.indexOf('let stickerLibraryRequest'));
test('private imports use private backing files and preserve the selected audience throughout the upload', async () => {
  for (const visibility of ['private', 'public']) {
    const uploads = [], requests = [], input = { files: [{ name: 'sticker.png' }], value: 'selected' };
    const state = { user: { username: 'alice' }, csrfToken: 'session-a', stickers: [] }, els = { messageStickerPublic: { value: visibility } };
    const context = vm.createContext({ state, els, stickerLibraryRequest: 0, notify() {}, updateControls() {}, renderStickerPickers() {},
      collectStickerImportFiles: async files => files,
      uploadOneFile: async (_file, _category, options) => { uploads.push(options); els.messageStickerPublic.value = visibility === 'public' ? 'private' : 'public'; return { id: 'image' }; },
      api: async (_url, options) => { requests.push(options); return { stickers: [], imported: 1 }; },
    });
    vm.runInContext(preference + imports, context); await context.importStickersFromInput(input, 'message');
    assert.equal(uploads[0].private, true);assert.equal(uploads[0].releaseRoom, '');assert.equal(uploads[0].releaseAt, '');
    assert.equal(requests[0].json.visibility, visibility);assert.equal(input.value, '');
  }
});

test('an account change stops importing before creating the sticker library entry', async () => {
  let registered = false;
  const state = { user: { username: 'alice' }, csrfToken: 'session-a', stickers: [] }, els = { messageStickerPublic: { value: 'private' } };
  const context = vm.createContext({ state, els, notify() {}, updateControls() {}, renderStickerPickers() {},
    collectStickerImportFiles: async files => files,
    uploadOneFile: async () => { state.user = { username: 'bob' }; state.csrfToken = 'session-b'; return { id: 'image' }; },
    api: async () => { registered = true; },
  });
  vm.runInContext(preference + imports, context);await context.importStickersFromInput({ files: [{}] }, 'message');
  assert.equal(registered, false);
});
