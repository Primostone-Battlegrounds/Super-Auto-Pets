import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { nativeGame } from '../platform/game-native.mjs';
import { checkFormalBuild, checkFormalClient, formalDeliveryFilename, readProductRelease, validateRelease, verifyReleaseCatalog } from '../scripts/product-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { scope, releaseScopeSha256 } = readProductRelease(root);
const catalog = { pets: scope.pets, foods: scope.foods, tokens: scope.tokens };

test('an implicit game build cannot produce the internal game', () => {
  assert.throws(() => nativeGame(), /requires the approved release scope/);
  assert.throws(() => nativeGame(undefined, undefined, undefined, undefined, { profile: 'unknown' }), /Unknown game build profile/);
});

test('formal GIL readback rejects hidden controls, stale prompts and closed mode bindings', () => {
  const build = { gameVersion: scope.gameVersion, sourceRevision: 'fedcba9876543210fedcba9876543210fedcba98' };
  assert.equal(formalDeliveryFilename(build), 'super-auto-pets-v0.6.0-fedcba987654.gil');
  const ui = { controls: [{ name: 'Lobby', children: [
    { name: 'Choices', children: [{ name: 'Room' }] },
    { name: 'BuildVersion', text: { content: 'v0.6.0 · fedcba987654' } },
  ] }] };
  checkFormalClient(ui, '', build);
  assert.throws(() => checkFormalClient({ controls: [...ui.controls, { name: 'Practice', visible: false }] }, '', build), /Closed mode control/);
  assert.throws(() => checkFormalClient({ controls: [...ui.controls, { name: 'Help', text: { content: '好友 1v1 请先邀请好友。' } }] }, '', build), /Closed mode text/);
  assert.throws(() => checkFormalClient(ui, 'feedback("可以稍后重试，或先开始 AI 练习。")', build), /Closed mode text/);
  assert.throws(() => checkFormalClient(ui, 'bind(lobby, "Choices/Duel/Hit", callback)', build), /Closed mode reference/);
  assert.throws(() => checkFormalClient(ui, '', { ...build, sourceRevision: '0'.repeat(40) }), /identify the delivered build/);
});

test('the approved roster matches both Lua runtimes', () => {
  assert.equal(scope.pets.length, 18);
  assert.equal(scope.foods.length, 12);
  assert.deepEqual(verifyReleaseCatalog(root, scope), catalog);
});

test('unapproved IDs and changes to the formal configuration fail', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bundle = path.join(directory, 'catalog.lua');
  for (const [kind, extra] of [['pets', 'extra_pet'], ['foods', 'extra_food']]) {
    const contents = {
      pets: scope.pets.map(id => `{id="${id}"}`),
      foods: scope.foods.map(id => `{id="${id}"}`),
    };
    contents[kind].push(`{id="${extra}"}`);
    fs.writeFileSync(bundle, `
local catalog = {pets={${contents.pets}}, foods={${contents.foods}},
  pet_by_id={}, food_by_id={}, token_by_id={}}
for _, item in ipairs(catalog.pets) do catalog.pet_by_id[item.id] = item end
for _, item in ipairs(catalog.foods) do catalog.food_by_id[item.id] = item end
for _, id in ipairs({${scope.tokens.map(id => JSON.stringify(id))}}) do catalog.token_by_id[id] = {id=id} end
return catalog
`);
    assert.throws(() => verifyReleaseCatalog(root, scope, 'lua5.3', 'lua5.4', bundle), new RegExp(`Formal ${kind}`));
  }
  fs.writeFileSync(bundle, 'return nil\n');
  assert.throws(() => verifyReleaseCatalog(root, scope, 'lua5.3', 'lua5.4', bundle), /Expected a release catalog table/);
  assert.throws(() => validateRelease({ ...scope, catalogProfile: 'expanded' }), /catalog profile/);
  assert.throws(() => validateRelease({ ...scope, modes: ['eight-player', 'duel'] }), /formal mode/);
  assert.throws(() => validateRelease({ ...scope, pets: [...scope.pets, 'extra_pet'] }), /requires 18 formal pets/);
  assert.throws(() => validateRelease({ ...scope, foods: [...scope.foods, 'extra_food'] }), /requires 12 formal foods/);
});

test('the delivery gate rejects internal graphs, content and active modes', () => {
  const graphs = ['_GSTS_AP_GameLobby', '_GSTS_AP_EightRoom', '_GSTS_AP_EightFight'].map(name => ({ name }));
  const build = { buildProfile: 'formal', releaseScopeSha256, gameVersion: scope.gameVersion,
    modes: scope.modes, catalog, graphs };
  checkFormalBuild(root, build);
  assert.throws(() => checkFormalBuild(root, { ...build, buildProfile: 'internal' }), /build profile/);
  assert.throws(() => checkFormalBuild(root, { ...build, modes: ['duel'] }));
  assert.throws(() => checkFormalBuild(root, { ...build, graphs: [...graphs, { name: 'AP_Duel' }] }));
  assert.throws(() => checkFormalBuild(root, { ...build, releaseScopeSha256: 'old' }), /different formal scope/);
});
