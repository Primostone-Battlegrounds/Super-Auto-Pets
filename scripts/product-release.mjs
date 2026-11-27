import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const releasePath = 'platform/product-release.json';
const contentKinds = ['pets', 'foods', 'tokens'];
export const closedModeText = /(?:\bAI\s*练习|好友\s*1\s*v\s*1|单人\s*AI)/iu;

export function formalBuildLabel({ gameVersion, sourceRevision }) {
  assert.match(gameVersion, /^\d+\.\d+\.\d+$/u);
  assert.match(sourceRevision, /^[a-f0-9]{40}$/u);
  return `v${gameVersion} · ${sourceRevision.slice(0, 12)}`;
}

export function formalDeliveryFilename(build) {
  return `super-auto-pets-${formalBuildLabel(build).replace(' · ', '-')}.gil`;
}

export function checkFormalClient(ui, source, build) {
  const lobby = ui.controls.find(control => control.name === 'Lobby');
  const choices = lobby?.children.find(control => control.name === 'Choices');
  assert.deepEqual(choices?.children.map(control => control.name), ['Room'], 'Formal lobby must contain only the eight-seat choice');
  assert.equal(lobby.children.find(control => control.name === 'BuildVersion')?.text?.content,
    formalBuildLabel(build), 'Formal lobby must identify the delivered build');
  function checkControls(controls) {
    for (const control of controls) {
      assert.doesNotMatch(control.name, /duel|practice/iu, 'Closed mode control in formal GIL');
      assert.doesNotMatch(control.text?.content ?? '', closedModeText, 'Closed mode text in formal GIL');
      checkControls(control.children ?? []);
    }
  }
  checkControls(ui.controls);
  assert.doesNotMatch(source, closedModeText, 'Closed mode text in formal Lua');
  assert.doesNotMatch(source, /AP_Duel|Choices\/(?:Duel|Practice)|(?:practice|duel)_view|duel_board|factories\['autopets\.(?:run|bot)'\]/u,
    'Closed mode reference in formal Lua');
}

export function validateRelease(scope) {
  assert.deepEqual(Object.keys(scope).sort(), ['catalogProfile', 'foods', 'gameVersion', 'modes', 'pets', 'tokens']);
  assert.match(scope.gameVersion, /^\d+\.\d+\.\d+$/u);
  assert.equal(scope.catalogProfile, 'release', 'Unsupported formal catalog profile');
  assert.deepEqual(scope.modes, ['eight-player'], 'Unsupported formal mode');
  if (scope.gameVersion === '0.6.0') {
    assert.equal(scope.pets?.length, 18, 'v0.6.0 requires 18 formal pets');
    assert.equal(scope.foods?.length, 12, 'v0.6.0 requires 12 formal foods');
  }
  for (const kind of contentKinds) {
    assert.ok(Array.isArray(scope[kind]) && scope[kind].length, `Empty ${kind} scope`);
    assert.ok(scope[kind].every(id => /^[a-z][a-z_0-9]+$/u.test(id)), `Invalid ${kind} ID`);
    assert.equal(new Set(scope[kind]).size, scope[kind].length, `Duplicate ${kind} ID`);
  }
}

export function readProductRelease(root) {
  const file = fs.readFileSync(path.join(root, releasePath));
  const scope = JSON.parse(file);
  validateRelease(scope);
  return { scope, releaseScopeSha256: createHash('sha256').update(file).digest('hex') };
}

export function checkReleaseCatalog(scope, catalog) {
  for (const kind of contentKinds) assert.deepEqual(catalog[kind], scope[kind], `Formal ${kind} differ from approved IDs`);
}

export function verifyReleaseCatalog(root, scope, lua53 = 'lua5.3', lua54 = 'lua5.4', bundle) {
  const args = ['-E', 'platform/release-catalog.lua'];
  if (bundle) args.push(bundle);
  const run = lua => execFileSync(lua, args, { cwd: root, encoding: 'utf8' });
  const exported = run(lua53);
  assert.equal(exported, run(lua54));
  const catalog = Object.fromEntries(contentKinds.map(kind => [kind, []]));
  for (const row of exported.trimEnd().split('\n')) {
    const [kind, id] = row.split('\t');
    catalog[kind].push(id);
  }
  checkReleaseCatalog(scope, catalog);
  return catalog;
}

export function checkFormalBuild(root, build) {
  const { scope, releaseScopeSha256 } = readProductRelease(root);
  assert.equal(build.buildProfile, 'formal', 'Required formal build profile');
  assert.equal(build.releaseScopeSha256, releaseScopeSha256, 'Build used a different formal scope');
  assert.equal(build.gameVersion, scope.gameVersion);
  assert.deepEqual(build.modes, scope.modes);
  checkReleaseCatalog(scope, build.catalog);
  assert.deepEqual(build.graphs.map(graph => graph.name).sort(), ['_GSTS_AP_EightFight', '_GSTS_AP_EightRoom', '_GSTS_AP_GameLobby']);
}
