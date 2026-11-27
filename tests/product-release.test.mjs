import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { checkFormalBuild, readProductRelease, validateRelease, verifyReleaseCatalog } from '../scripts/product-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { scope, releaseScopeSha256 } = readProductRelease(root);
const catalog = { pets: scope.pets, foods: scope.foods, tokens: scope.tokens };

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
