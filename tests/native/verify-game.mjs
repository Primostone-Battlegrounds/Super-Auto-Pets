import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gameInterface, gameScript, nativeGame, playerVariables, practiceSeed, signals,
  stageVariables } from '../../platform/game-native.mjs';
import { assertAssemblySourceLimits, gilListAudit } from './gil-list-limits.mjs';
import { readDesign } from '../../scripts/design-contract.mjs';
import { initialAcceptance } from '../../scripts/acceptance-gate.mjs';

const [checkoutArg, scratch, lua53, output] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua53 && output,
  'Usage: node tests/native/verify-game.mjs <MCP checkout> <scratch> <Lua 5.3> <new game package>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
assert.ok(!fs.existsSync(output), 'Use a new game package directory');

const project = fileURLToPath(new URL('../../', import.meta.url));
const git = (directory, args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
const sourceRevision = git(project, ['rev-parse', 'HEAD']);
assert.equal(git(project, ['status', '--porcelain', '--untracked-files=all']), '', 'Build from a clean checkout');
const design = readDesign(project, { selected: process.env.SAP_DESIGN_VERSION, forBuild: true });
const checkout = fs.realpathSync(checkoutArg);
const toolRevision = git(checkout, ['rev-parse', 'HEAD']);
assert.equal(toolRevision, '59c576e41632a6bf6781bbca83a676d0da0374ec');
execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./gil-list-limits.test.mjs', import.meta.url))], {
  env: { ...process.env, MILIASTRA_MCP_CHECKOUT: checkout }, stdio: 'inherit',
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
const fixture = path.join(checkout, 'tests/fixtures/editor-2026-10-26-shapes.gil');
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);

const lua54 = process.env.LUA54 || 'lua5.4';
const versions = [lua53, lua54].map(lua => execFileSync(lua, ['-E', '-v'], { encoding: 'utf8' }).trim());
assert.match(versions[0], /^Lua 5\.3\./);
assert.match(versions[1], /^Lua 5\.4\./);
const loadTool = module => import(pathToFileURL(path.join(checkout, 'src', module)).href);
const [{ Service }, scene, { toolRegistry }] = await Promise.all([
  loadTool('core.mjs'), loadTool('scene-save.mjs'), loadTool('tool-registry.mjs'),
]);
const requireTool = createRequire(path.join(checkout, 'package.json'));
const ts = requireTool('typescript');
const readListCapacity = await gilListAudit(requireTool);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'auto-pets-game-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const service = new Service({ workspace, saveRoots: [], allowLive: false });
const tools = toolRegistry(service);
assert.equal(service.capabilities().liveWriteEnabled, false);
assert.deepEqual(service.capabilities().saveRoots, []);
let mapPath = input;
async function call(name, args = {}) {
  const tool = tools.find(entry => entry.name === name);
  return tool.method(tool.schema.parse({ mapPath, ...args }));
}
async function stage(name, args) {
  const result = await call(name, args);
  assert.equal(result.failed, undefined, JSON.stringify(result));
  mapPath = fs.realpathSync(result.mapPath);
  assert.notEqual(mapPath, input);
  assert.ok(mapPath.startsWith(workspace + path.sep));
  return result;
}
const integers = names => names.map(name => ({ name, type: 'integer', value: 0 }));

await stage('scene_remove_entities', { names: ['积木样本'] });
await stage('scene_set_player_count', { min: 1, max: 8 });
await stage('scene_add_components', { entity: 'stage', variables: integers(stageVariables) });
await stage('scene_add_components', { prefab: 'player', variables: integers(playerVariables) });
for (const [name, parameters] of Object.entries(signals)) {
  await stage('scene_add_signal', { name, parameters });
}
const ids = {};
for (const [key, name] of Object.entries({
  lobby: 'AP_GameLobby', duel: 'AP_Duel', duelFight: 'AP_DuelBattle', room: 'AP_EightRoom', roomFight: 'AP_EightFight',
})) {
  ids[key] = (await stage('scene_add_graph', { name, attachTo: 'stage' })).graphId;
}
const game = nativeGame(lua53, lua54, requireTool('luaparse').parse, ids);
for (const { graphId, code } of game.graphs) assertAssemblySourceLimits(graphId, code, ts);
await stage('write_graphs', { graphs: game.graphs });
await stage('scene_set_client_script', {
  name: gameScript, source: game.source,
  variables: [{ name: 'seed', type: 'integer', value: practiceSeed, public: true }],
});
const built = await stage('scene_add_client_ui', {
  ...game.layout, script: { name: gameScript, values: { seed: practiceSeed } }, outputName: 'super-auto-pets',
});
assert.equal(built.offPhoneCanvas, undefined);

const { players } = scene.listRespawnPoints({ mapPath });
assert.deepEqual(players, { min: 1, max: 8 });
const registered = await call('scene_list_signals');
for (const [name, fields] of Object.entries(signals)) assert.deepEqual(registered.parameters[name], fields);
const inspected = service.inspectMap({ mapPath });
const listCapacity = readListCapacity(fs.readFileSync(mapPath));
assert.deepEqual(listCapacity.map(graph => graph.id).sort(), Object.values(ids).sort());
const attached = scene.listComponents({ mapPath, entity: 'stage' }).found.find(component => component.where === 'placed');
assert.deepEqual([...attached.graphs].sort(), Object.values(ids).sort());
const graphs = Object.values(ids).map(id => inspected.graphs.find(graph => graph.id === id));
assert.equal(inspected.graphs.length, graphs.length);
assert.ok(graphs.every(graph => graph.nodeCount > 0 && graph.nodeCount < 3000 && graph.editorCount < 3000));
const signalLinks = [
  ['lobby', 'AP_GameChooseMode', 'monitor'],
  ['room', 'AP_RoomRequest', 'monitor'], ['room', 'AP_RoomFightWork', 'send'],
  ['roomFight', 'AP_RoomFightWork', 'monitor'], ['room', 'AP_RoomFightDone', 'monitor'],
  ['roomFight', 'AP_RoomFightDone', 'send'], ['duel', 'AP_DuelRequest', 'monitor'],
  ['duel', 'AP_DuelFightStart', 'send'], ['duelFight', 'AP_DuelFightStart', 'monitor'],
];
for (const [key, name, role] of signalLinks) {
  const graph = graphs.find(entry => entry.id === ids[key]);
  assert.ok(graph.signalReferences.some(reference => reference.name === name && reference.role === role), name);
}
const { scripts } = await call('scene_list_client_scripts', { includeSource: true });
assert.deepEqual(scripts.map(({ name }) => name), [gameScript]);
assert.equal(scripts[0].source, game.source);
const { interface: ui } = await call('scene_get_client_ui', { ui: gameInterface });
assert.deepEqual(ui.scripts, [{ name: gameScript, values: { seed: practiceSeed } }]);
for (const flag of ['showCursor', 'blockCursor', 'blockKeys']) assert.equal(ui[flag], game.layout[flag], flag);
const diagnostics = await call('scene_check_client', { scripts: [gameScript] });
assert.deepEqual(diagnostics.problems, []);

const controls = [];
function readControls(expected, actual, parent, bounds) {
  assert.equal(actual.length, expected.length, parent);
  for (const [index, control] of actual.entries()) {
    const definition = expected[index];
    const key = parent ? `${parent}/${control.name}` : control.name;
    assert.equal(control.name, definition.name);
    assert.equal(control.kind, definition.kind);
    assert.deepEqual(control.position, (definition.position ?? [0, 0]).map(value => value + 0), key);
    assert.deepEqual(control.size, definition.size, key);
    assert.equal(control.active === false, definition.active === false, key);
    assert.equal(control.visible === false, definition.visible === false, key);
    assert.deepEqual(control.anchor, definition.anchor, key);
    if (definition.kind === 'image') {
      assert.equal(control.image, definition.image, key);
      assert.equal(control.colour ?? '#ffffff', definition.colour ?? '#ffffff', key);
    }
    if (definition.text) {
      for (const textKey of ['content', 'fontSize', 'align', 'valign', 'autoSize', 'minFontSize']) {
        const fallback = { content: '', autoSize: false, minFontSize: 20 }[textKey];
        if (definition.text[textKey] !== undefined) {
          assert.equal(control.text[textKey] ?? fallback, definition.text[textKey], `${key} ${textKey}`);
        }
      }
      if (definition.text.colour) assert.equal((control.text.colour ?? '#ffffff').toLowerCase(), definition.text.colour.toLowerCase(), key);
    }
    for (const [axis, extent] of bounds.entries()) {
      assert.ok(Math.abs(control.position[axis]) + control.size[axis] / 2 <= extent / 2 + 0.0001, key);
    }
    const { kind, position, size, image, colour, opacity, text } = control;
    controls.push({ path: key, parent, kind, position, size, image, colour, opacity, text,
      active: control.active !== false, visible: control.visible !== false });
    readControls(definition.children ?? [], control.children ?? [], key, control.size);
  }
}
readControls(game.layout.controls, ui.controls, null, [1280, 720]);
assert.ok(controls.length <= 1000);
const extracted = path.join(workspace, `${gameScript}.lua`);
fs.writeFileSync(extracted, scripts[0].source);
const bindings = path.join(workspace, 'controls.tsv');
fs.writeFileSync(bindings, controls.map(control => [control.path, Number(control.active), Number(control.visible),
  ...(control.position), ...control.size].join('\t')).join('\n') + '\n');

const tests = await import('./game-verification.mjs');
const simulation = tests.verifyGame(game, ids, ts, { lua53, lua54, workspace, project, extracted, bindings });
const frames = tests.readGameFrames(simulation.frames, controls);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
assert.equal(sha256(fs.readFileSync(input)), fixtureHash);
const gil = 'super-auto-pets.gil';
const hash = sha256(fs.readFileSync(mapPath));
assert.equal(inspected.sha256, hash);
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(mapPath, path.join(output, gil), fs.constants.COPYFILE_EXCL);
fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(output, 'MCP-FIXTURE-LICENSE.txt'));
fs.copyFileSync(new URL('../../platform/GAME.md', import.meta.url), path.join(output, 'README.md'));
const build = {
  ...design, version: `develop-${sourceRevision.slice(0, 12)}`, sourceRevision, toolRevision, fixtureHash, lua: versions,
  node: process.version, sha256: hash, players, controls: controls.length, graphs, listCapacity, ...simulation.evidence,
  officialClient: 'pending',
};
const buildJson = JSON.stringify(build, null, 2) + '\n';
fs.writeFileSync(path.join(output, 'BUILD.json'), buildJson);
fs.writeFileSync(path.join(output, 'ACCEPTANCE.json'), JSON.stringify(initialAcceptance(build, buildJson), null, 2) + '\n');
fs.writeFileSync(path.join(workspace, 'frames.json'), JSON.stringify(frames));
const files = [gil, 'README.md', 'BUILD.json', 'ACCEPTANCE.json', 'MCP-FIXTURE-LICENSE.txt'];
fs.writeFileSync(path.join(output, 'SHA256SUMS'),
  files.map(file => `${sha256(fs.readFileSync(path.join(output, file)))}  ${file}`).join('\n') + '\n');
console.log(`Game: ${path.join(output, gil)} (${hash})`);
console.log(`Offline frames: ${path.join(workspace, 'frames.json')}`);
for (const graph of graphs) console.log(`${graph.name}: ${graph.nodeCount} nodes, ${graph.editorCount} weighted`);
