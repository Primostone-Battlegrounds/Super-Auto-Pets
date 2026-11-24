import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyGraph } from './m3-probe-graph.mjs';

const [checkoutArg, scratch, lua, outputArg, waitArg = '5'] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m3-probe.mjs <MCP checkout> <scratch> <Lua 5.3> [new candidate directory] [wait seconds]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const wait = Number(waitArg);
assert.ok(Number.isInteger(wait) && wait >= 0 && wait <= 60, 'Wait must be 0–60 seconds');
const luaVersion = execFileSync(lua, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim();
assert.match(luaVersion, /^Lua 5\.3\./);
const checkout = fs.realpathSync(checkoutArg);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, '59c576e41632a6bf6781bbca83a676d0da0374ec', 'Use the pinned Miliastra MCP revision');
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceRevision = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = path.join(checkout, 'tests', 'fixtures', 'editor-2026-10-26-shapes.gil');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'm3-eight-seat-probe-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const candidate = outputArg ? path.resolve(outputArg) : path.join(workspace, 'candidate');
assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');

const requireTool = createRequire(path.join(checkout, 'package.json'));
const { Client } = requireTool('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = requireTool('@modelcontextprotocol/sdk/client/stdio.js');
const loadTool = module => import(pathToFileURL(requireTool.resolve(module)).href);
const client = new Client({ name: 'auto-pets-m3-probe', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(checkout, 'src', 'server.mjs')],
  cwd: checkout,
  stderr: 'inherit',
  env: { LOCALAPPDATA: workspace, MILIASTRA_ALLOW_LIVE_WRITE: '0', MILIASTRA_SAVE_ROOTS: '[]', MILIASTRA_WORKSPACE: workspace },
});

let mapPath = input;
async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  assert.ok(!response.isError, `${name}: ${JSON.stringify(result)}`);
  console.log(`${name} OK`);
  return result;
}

async function stage(name, args) {
  const result = await call(name, { mapPath, ...args });
  assert.notEqual(result.mapPath, input);
  mapPath = fs.realpathSync(result.mapPath);
  assert.ok(mapPath.startsWith(workspace + path.sep), 'MCP output escaped the isolated workspace');
  return result;
}

const script = 'm3_probe';
const source = fs.readFileSync(new URL('../../platform/m3_probe.lua', import.meta.url), 'utf8');
const signals = {
  AP_EightProbeRequest: [['path', 'integer']],
  AP_EightProbeView: [
    ['revision', 'integer'], ['fieldCount', 'integer'], ['seat', 'integer'], ['seconds', 'integer'],
    ['batch', 'integer'], ['seats', 'integerList'], ['work', 'integerList'],
  ],
  AP_EightProbeReply: [['seat', 'integer'], ['path', 'integer'], ['nativeCount', 'integer'], ['luaCount', 'integer']],
};
const variables = ['AP_ProbeSeat', 'AP_ProbeNative', 'AP_ProbeLua'];
const nativeButton = { name: 'AP_EightProbeNative', position: [282, -229], key: 1, size: [72, 72] };
const ui = {
  name: 'AP_EightProbe',
  script,
  showCursor: true,
  blockCursor: false,
  controls: [
    { name: 'Background', kind: 'image', position: [0, 0], size: [750, 650], image: 100001, colour: '#193931' },
    {
      name: 'Status', kind: 'text', position: [0, 252], size: [680, 100],
      text: { content: '等待关卡图', fontSize: 30, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    },
    {
      name: 'Roster', kind: 'text', position: [0, 46], size: [580, 280],
      text: { content: '', fontSize: 27, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    },
    {
      name: 'Private', kind: 'text', position: [0, -137], size: [680, 50],
      text: { content: '', fontSize: 28, colour: '#ffd887', align: 'centre', valign: 'middle' },
    },
    {
      name: 'LuaFace', kind: 'image', position: [-136, -229], size: [210, 72],
      image: 100001, colour: '#286452',
    },
    {
      name: 'LuaLabel', kind: 'text', position: [-136, -229], size: [210, 72],
      text: { content: '界面回执', fontSize: 26, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    },
    { name: 'LuaRequest', kind: 'cursorArea', position: [-136, -229], size: [210, 72] },
    {
      name: 'NativeLegend', kind: 'text', position: [182, -229], size: [120, 72],
      text: { content: '原生回执', fontSize: 24, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    },
  ],
};
for (const control of [...ui.controls, nativeButton]) {
  assert.ok(control.position.every((coordinate, axis) =>
    Math.abs(coordinate) + control.size[axis] / 2 <= [640, 360][axis]), `${control.name} outside shared canvas`);
}

async function targetedNodes(bytes, graphId) {
  const [{ parseMessage }, { buildNodeGraphFieldIndex }, { loadGiaProto }, { clientScriptSignalHeads }] = await Promise.all([
    loadTool('genshin-ts/injector/binary'),
    loadTool('genshin-ts/injector/node_graph'),
    loadTool('genshin-ts/injector/proto'),
    import(pathToFileURL(path.join(checkout, 'src', 'scene', 'signal-definitions.mjs')).href),
  ]);
  const payload = bytes.subarray(20, -4);
  const fields = [];
  parseMessage(payload, 0, payload.length, 0, 0, 0, 0, 0, 0, 0, fields);
  const entries = buildNodeGraphFieldIndex(payload, fields).get(graphId);
  assert.equal(entries.length, 1);
  const [{ field }] = entries;
  const { nodeGraphMessage } = loadGiaProto();
  const graph = nodeGraphMessage.toObject(
    nodeGraphMessage.decode(payload.subarray(field.dataStart, field.dataEnd)), { enums: String },
  );
  const heads = clientScriptSignalHeads(bytes);
  const result = [];
  for (const name of ['AP_EightProbeView', 'AP_EightProbeReply']) {
    const id = heads.get(name).nodeId;
    const nodes = graph.nodes.filter(node => node.genericId?.nodeId === id);
    assert.equal(nodes.length, 2);
    for (const node of nodes) {
      const inputs = node.pins.filter(pin => pin.i1?.kind === 'InParam');
      assert.equal(inputs.length, signals[name].length + 1);
      const target = inputs.find(pin => pin.i1.index === 0);
      assert.equal(target.connects.length, 1, 'Client send must wire the target player');
      result.push({ signal: name, nodeIndex: node.nodeIndex, targetNode: target.connects[0].id });
    }
  }
  return result;
}

try {
  await client.connect(transport);
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.deepEqual(capabilities.saveRoots, []);
  assert.equal(capabilities.liveWriteEnabled, false);
  await stage('scene_set_player_count', { min: 1, max: 8 });
  await stage('scene_add_components', {
    prefab: 'player', variables: variables.map(name => ({ name, type: 'integer', value: 0 })),
  });
  for (const [name, parameters] of Object.entries(signals)) {
    await stage('scene_add_signal', { name, parameters: parameters.map(([name, type]) => ({ name, type })) });
  }
  const button = await stage('scene_add_button', nativeButton);
  assert.equal(button.controlId, button.controlGroupIndex);
  const graph = await stage('scene_add_graph', { name: 'AP_EightProbe', attachTo: 'stage' });
  const buttonGraph = await stage('scene_add_graph', { name: 'AP_EightProbeButton', attachToPrefab: 'player' });
  const graphSource = fs.readFileSync(new URL('../../platform/m3_probe.ts', import.meta.url), 'utf8')
    .replace('id: 1073741825,', `id: ${graph.graphId},`)
    .replace('5n; // AP_EIGHT_WAIT_SECONDS', `${wait}n;`);
  const buttonSource = fs.readFileSync(new URL('../../platform/m3_probe_button.ts', import.meta.url), 'utf8')
    .replace('id: 1073741826,', `id: ${buttonGraph.graphId},`)
    .replace('1073741901n; // AP_EIGHT_BUTTON', `${button.controlId}n;`);
  assert.ok(!graphSource.includes('AP_EIGHT_WAIT_SECONDS') && !buttonSource.includes('AP_EIGHT_BUTTON'));
  const compiled = await stage('write_graphs', { graphs: [
    { graphId: graph.graphId, code: graphSource },
    { graphId: buttonGraph.graphId, code: buttonSource },
  ] });
  assert.equal(compiled.failed, undefined, JSON.stringify(compiled));
  await stage('scene_set_client_script', { name: script, file: `${script}.lua`, source });
  await stage('scene_add_client_ui', { ...ui, outputName: 'm3-eight-seat-probe' });

  const { players } = await call('scene_list_respawn_points', { mapPath });
  assert.deepEqual(players, { min: 1, max: 8 });
  const registered = await call('scene_list_signals', { mapPath });
  for (const [name, parameters] of Object.entries(signals)) {
    assert.deepEqual(registered.parameters[name], parameters.map(([name, type]) => ({ name, type })));
  }
  const inspected = await call('inspect_map', { mapPath });
  const readGraph = inspected.graphs.find(({ id }) => id === graph.graphId);
  const readButtonGraph = inspected.graphs.find(({ id }) => id === buttonGraph.graphId);
  for (const read of [readGraph, readButtonGraph]) {
    assert.ok(read.nodeCount > 0 && read.nodeCount < 3_000);
    assert.ok(read.editorCount >= read.nodeCount && read.editorCount < 3_000);
  }
  assert.ok(readGraph.signalReferences.some(ref => ref.name === 'AP_EightProbeRequest' && ref.role === 'monitor'));
  assert.ok(readButtonGraph.signalReferences.some(ref => ref.name === 'AP_EightProbeRequest' && ref.role === 'send'));
  const [playerComponents, stageComponents, interfaceLayout, scripts, readUi, checked] = await Promise.all([
    call('scene_list_components', { mapPath, prefab: 'player' }),
    call('scene_list_components', { mapPath, entity: 'stage' }),
    call('scene_list_interface', { mapPath }),
    call('scene_list_client_scripts', { mapPath, includeSource: true }),
    call('scene_get_client_ui', { mapPath, ui: ui.name }),
    call('scene_check_client', { mapPath, scripts: [script] }),
  ]);
  const playerTemplate = playerComponents.found.find(component => component.where === 'prefab');
  assert.ok(playerTemplate?.graphs.includes(buttonGraph.graphId));
  assert.ok(!playerTemplate.graphs.includes(graph.graphId));
  const stageEntity = stageComponents.found.find(component => component.where === 'placed');
  assert.ok(stageEntity?.graphs.includes(graph.graphId));
  assert.ok(!stageEntity.graphs.includes(buttonGraph.graphId));
  const layoutControls = interfaceLayout.layouts.flatMap(layout => layout.controls);
  assert.deepEqual(layoutControls.filter(control => control.name === nativeButton.name),
    [{ id: button.controlId, name: nativeButton.name, kind: 'button' }]);
  const readSource = scripts.scripts.find(entry => entry.name === script)?.source;
  assert.equal(readSource, source);
  assert.deepEqual(readUi.interface.scripts, [script]);
  assert.deepEqual(readUi.interface.controls.map(({ name, kind, position, size }) => ({ name, kind, position, size })),
    ui.controls.map(({ name, kind, position, size }) => ({ name, kind, position, size })));
  assert.ok(readUi.interface.controls.every(control => control.active !== false && control.visible !== false));
  assert.deepEqual(checked.problems, []);

  const graphSimulation = verifyGraph(graphSource, buttonSource, button.controlId, requireTool('typescript'), wait);
  const extracted = path.join(workspace, `${script}.lua`);
  fs.writeFileSync(extracted, readSource);
  const clientSimulation = execFileSync(lua, ['-E', fileURLToPath(new URL('./m3-probe-input.lua', import.meta.url)), extracted],
    { encoding: 'utf8', timeout: 10_000 });
  assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
  assert.equal(sha256(fs.readFileSync(input)), fixtureHash);

  const bytes = fs.readFileSync(mapPath);
  const clientTargets = await targetedNodes(bytes, graph.graphId);
  const hash = sha256(bytes);
  assert.equal(inspected.sha256, hash);
  fs.mkdirSync(candidate);
  const gil = path.join(candidate, 'm3-eight-seat-probe.gil');
  fs.copyFileSync(mapPath, gil, fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(new URL('../../platform/M3.md', import.meta.url), path.join(candidate, 'README.md'));
  fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, 'MCP-FIXTURE-LICENSE.txt'));
  fs.writeFileSync(path.join(candidate, 'evidence.json'), JSON.stringify({
    sourceRevision, revision, fixtureHash, players, waitSeconds: wait, graph: readGraph, buttonGraph: readButtonGraph,
    nativeButtonId: button.controlId, signals: registered.parameters, clientTargets,
    attachments: { stageGraph: graph.graphId, playerPrefab: playerTemplate.prefabId, playerGraph: buttonGraph.graphId },
    clientScriptSha256: sha256(readSource), graphSourceSha256: sha256(graphSource), buttonSourceSha256: sha256(buttonSource),
    clientDiagnostics: checked.problems, graphSimulation, clientSimulation: clientSimulation.trimEnd().split('\n'),
    luaVersion, sha256: hash, officialClient: 'pending',
  }, null, 2) + '\n');
  const packageFiles = [path.basename(gil), 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
  const checksums = packageFiles.map(name => `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`);
  fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), checksums.join('\n') + '\n');
  console.log(`Candidate: ${gil}`);
} finally {
  await client.close();
}
