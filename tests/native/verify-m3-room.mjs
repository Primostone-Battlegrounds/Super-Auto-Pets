import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nativeRoom, roomSignals } from '../../platform/m3-room-native.mjs';
import { verifyRoom } from './m3-room-graph.mjs';

const [checkoutArg, scratch, lua, outputArg, seedArg = '1', cadenceArg = '1', waitArg] =
  process.argv.slice(2).filter(argument => argument !== '--headless');
const headless = process.argv.includes('--headless');
assert.ok(checkoutArg && scratch && lua && outputArg,
  'Usage: node tests/native/verify-m3-room.mjs <MCP checkout> <scratch> <Lua 5.3> <new candidate> [seed] [cadence] [wait] [--headless]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
assert.match(seedArg, /^-?\d+$/);
const seed = BigInt(seedArg);
const cadence = Number(cadenceArg);
const checkout = fs.realpathSync(checkoutArg);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, '59c576e41632a6bf6781bbca83a676d0da0374ec');
const readTool = module => import(pathToFileURL(path.join(checkout, 'src', module)).href);
const requireTool = createRequire(path.join(checkout, 'package.json'));
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceRevision = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = path.join(checkout, 'tests', 'fixtures', 'editor-2026-10-26-shapes.gil');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'm3-native-room-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const candidate = path.resolve(outputArg);
assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');
const lua54 = process.env.LUA54 || 'lua5.4';
const luaVersions = [lua, lua54].map(binary => execFileSync(binary, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim());
assert.match(luaVersions[0], /^Lua 5\.3\./);
assert.match(luaVersions[1], /^Lua 5\.4\./);

const [{ Service }, scene, { toolRegistry }] = await Promise.all([
  readTool('core.mjs'), readTool('scene-save.mjs'), readTool('tool-registry.mjs'),
]);
const service = new Service({ workspace, saveRoots: [], allowLive: false });
const tools = toolRegistry(service);
const capabilities = service.capabilities();
assert.equal(capabilities.workspace, workspace);
assert.equal(capabilities.liveWriteEnabled, false);
assert.deepEqual(capabilities.saveRoots, []);
let mapPath = input;
async function call(name, params = {}) {
  const tool = tools.find(entry => entry.name === name);
  return tool.method(tool.schema.parse({ mapPath, ...params }));
}
async function stage(name, params) {
  const result = await call(name, params);
  assert.equal(result.failed, undefined, JSON.stringify(result));
  assert.notEqual(result.mapPath, input);
  mapPath = fs.realpathSync(result.mapPath);
  assert.ok(mapPath.startsWith(workspace + path.sep), 'MCP output escaped the fixture workspace');
  return result;
}

await stage('scene_set_player_count', { min: 1, max: 8 });
await stage('scene_add_components', { entity: 'stage', variables: [{ name: 'AP_RoomTicket', type: 'integer', value: 0 }] });
for (const [name, parameters] of Object.entries(roomSignals)) await stage('scene_add_signal', { name, parameters });
const controller = await stage('scene_add_graph', { name: 'AP_EightRoom', attachTo: 'stage' });
const worker = await stage('scene_add_graph', { name: 'AP_EightFight', attachTo: 'stage' });
const native = nativeRoom(lua, lua54, requireTool('luaparse').parse, controller.graphId, worker.graphId, seed, cadence,
  waitArg === undefined ? undefined : Number(waitArg));
const graphs = [
  { graphId: controller.graphId, code: native.roomSource },
  { graphId: worker.graphId, code: native.fightSource },
];
const startCpu = process.cpuUsage();
const startTime = performance.now();
const checks = [];
const simulation = verifyRoom(graphs.map(graph => graph.code), requireTool('typescript'), native.settings, checks);
const checkPath = path.join(workspace, 'canonical-replay-inputs.tsv');
fs.writeFileSync(checkPath, checks.map(receipt => receipt.join('\t')).join('\n') + '\n');
const replayTest = fileURLToPath(new URL('./m3-room-replay.lua', import.meta.url));
const runReplay = executable => execFileSync(executable, ['-E', replayTest, checkPath], {
  cwd: project, encoding: 'utf8', timeout: 30_000,
}).trim();
const replayEvidence = runReplay(lua);
assert.equal(replayEvidence, runReplay(lua54));
const offlineMeasurements = {
  wallMilliseconds: Math.round(performance.now() - startTime),
  cpuMicroseconds: process.cpuUsage(startCpu),
  residentBytes: process.memoryUsage().rss,
  liveStageGraphs: 2,
  addedRuntimeEntities: 0,
};
await stage('write_graphs', { graphs });

let client;
if (!headless) {
  const { m3RoomLayout, m3RoomUiSource } = await import('../../platform/m3-room-ui.mjs');
  const script = m3RoomLayout.script;
  const source = m3RoomUiSource(native.shopCatalog, requireTool('luaparse').parse);
  await stage('scene_set_client_script', { name: script, file: `${script}.lua`, source });
  const added = await stage('scene_add_client_ui', { ...m3RoomLayout, outputName: 'm3-compatibility-room' });
  assert.equal(added.offPhoneCanvas, undefined);
  const scripts = await call('scene_list_client_scripts', { includeSource: true });
  const readback = scripts.scripts.find(entry => entry.name === script)?.source;
  assert.equal(readback, source);
  const ui = await call('scene_get_client_ui', { ui: m3RoomLayout.name });
  assert.deepEqual(ui.interface.scripts, [script]);
  const checked = await call('scene_check_client', { scripts: [script] });
  assert.deepEqual(checked.problems, []);
  const controls = [];
  const hits = [];
  function verifyControls(expected, actual, parentSize, parentPath = '', origin = [0, 0]) {
    assert.equal(actual.length, expected.length);
    for (const [index, control] of actual.entries()) {
      const definition = expected[index];
      const controlPath = parentPath ? `${parentPath}/${control.name}` : control.name;
      assert.equal(control.name, definition.name);
      assert.equal(control.kind, definition.kind);
      assert.deepEqual(control.position, (definition.position ?? [0, 0]).map(value => value + 0), controlPath);
      assert.deepEqual(control.size, definition.size, controlPath);
      assert.equal(control.active === false, definition.active === false, controlPath);
      for (const [axis, extent] of parentSize.entries()) {
        assert.ok(Math.abs(control.position[axis]) + control.size[axis] / 2 <= extent / 2 + 0.0001, controlPath);
      }
      const centre = control.position.map((value, axis) => origin[axis] + value);
      if (control.kind === 'cursorArea') {
        assert.ok(control.size.every(dimension => dimension >= 48), controlPath);
        hits.push({ controlPath, centre, size: control.size });
      }
      controls.push(`${controlPath}\t${control.active === false ? '0' : '1'}`);
      verifyControls(definition.children ?? [], control.children ?? [], control.size, controlPath, centre);
    }
  }
  // Checking the smaller shared coordinate extent also covers the PC extent.
  verifyControls(m3RoomLayout.controls, ui.interface.controls, [1280, 720]);
  for (const hidden of ['Match/Shop/', 'Match/Replay/']) {
    const visible = hits.filter(hit => !hit.controlPath.startsWith(hidden));
    for (const [index, first] of visible.entries()) {
      for (const second of visible.slice(index + 1)) {
        assert.ok(first.centre.some((offset, axis) => Math.abs(offset - second.centre[axis])
          >= (first.size[axis] + second.size[axis]) / 2), `${first.controlPath} overlaps ${second.controlPath}`);
      }
    }
  }
  const clientPath = path.join(workspace, `${script}.lua`);
  const bindings = path.join(workspace, 'controls.txt');
  fs.writeFileSync(clientPath, readback);
  fs.writeFileSync(bindings, controls.join('\n') + '\n');
  const inputTest = fileURLToPath(new URL('./m3-room-input.lua', import.meta.url));
  const runInput = executable => execFileSync(executable, ['-E', inputTest, clientPath, bindings], {
    cwd: project, encoding: 'utf8', timeout: 10_000,
  }).trim();
  const inputEvidence = runInput(lua);
  assert.equal(inputEvidence, runInput(lua54));
  client = { script, sha256: sha256(source), controls: controls.length, canvases: [[1600, 900], [1280, 720]], inputEvidence };
}

const { players } = scene.listRespawnPoints({ mapPath });
assert.deepEqual(players, { min: 1, max: 8 });
const stageComponent = scene.listComponents({ mapPath, entity: 'stage' }).found.find(component => component.where === 'placed');
assert.ok(stageComponent?.graphs.includes(controller.graphId) && stageComponent.graphs.includes(worker.graphId));
const inspected = service.inspectMap({ mapPath });
const readGraphs = [controller.graphId, worker.graphId].map(id => inspected.graphs.find(graph => graph.id === id));
assert.ok(readGraphs.every(graph => graph.nodeCount > 0 && graph.nodeCount < 3000 && graph.editorCount < 3000));
for (const [index, name, role] of [
  [0, 'AP_RoomRequest', 'monitor'], [0, 'AP_RoomFightWork', 'send'], [0, 'AP_RoomFightDone', 'monitor'],
  [1, 'AP_RoomFightWork', 'monitor'], [1, 'AP_RoomFightDone', 'send'],
]) assert.ok(readGraphs[index].signalReferences.some(entry => entry.name === name && entry.role === role));
const registered = await call('scene_list_signals');
for (const [name, fields] of Object.entries(roomSignals)) assert.deepEqual(registered.parameters[name], fields);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
assert.equal(sha256(fs.readFileSync(input)), fixtureHash);

fs.mkdirSync(candidate);
const gil = headless ? 'm3-compatibility-room-headless.gil' : 'm3-compatibility-room.gil';
fs.copyFileSync(mapPath, path.join(candidate, gil), fs.constants.COPYFILE_EXCL);
fs.copyFileSync(new URL('../../platform/M3-native-room.md', import.meta.url), path.join(candidate, 'README.md'));
fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, 'MCP-FIXTURE-LICENSE.txt'));
fs.writeFileSync(path.join(candidate, 'evidence.json'), JSON.stringify({
  sourceRevision, revision, fixtureHash, seed: String(seed), players, luaVersions, headless, client,
  settings: native.settings, workflow: readGraphs, signals: roomSignals,
  sources: graphs.map(graph => ({ id: graph.graphId, sha256: sha256(graph.code) })),
  sha256: inspected.sha256, offlineMeasurements, simulation, replayEvidence, officialClient: 'pending',
}, null, 2) + '\n');
const packageFiles = [gil, 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
const checksums = packageFiles.map(name => `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`);
fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), checksums.join('\n') + '\n');
console.log(`Candidate: ${path.join(candidate, gil)}`);
for (const graph of readGraphs) console.log(`${graph.name} ${graph.nodeCount} nodes, ${graph.editorCount} weighted`);
