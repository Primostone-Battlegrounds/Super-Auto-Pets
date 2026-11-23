import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyGraph } from './m2-probe-graph.mjs';

const [checkoutArg, scratch, lua, outputArg] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m2-probe.mjs <MCP checkout> <scratch directory> <Lua 5.3 executable> [new candidate directory]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0', 'Set MILIASTRA_ALLOW_LIVE_WRITE=0');
const luaVersion = execFileSync(lua, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim();
assert.match(luaVersion, /^Lua 5\.3\./, 'Use the Miliastra client Lua version');

const checkout = fs.realpathSync(checkoutArg);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, '59c576e41632a6bf6781bbca83a676d0da0374ec', 'Use the pinned Miliastra MCP revision');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = path.join(checkout, 'tests', 'fixtures', 'editor-2026-10-26-shapes.gil');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'm2-duel-probe-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const candidate = outputArg ? path.resolve(outputArg) : path.join(workspace, 'candidate');
assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');

const toolRequire = createRequire(path.join(checkout, 'package.json'));
const { Client } = toolRequire('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = toolRequire('@modelcontextprotocol/sdk/client/stdio.js');
const client = new Client({ name: 'auto-pets-m2-probe', version: '0.1.0' });
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

const script = 'm2_probe';
const source = fs.readFileSync(new URL('../../platform/m2_probe.lua', import.meta.url), 'utf8');
const signals = {
  AP_DuelRequest: [['action', 'integer'], ['round', 'integer']],
  AP_DuelSnapshot: [
    ['players', 'integer'], ['seat', 'integer'], ['round', 'integer'], ['phase', 'integer'],
    ['ready', 'boolean'], ['continued', 'boolean'], ['settlements', 'integer'], ['version', 'integer'],
  ],
};
const variables = ['AP_readyRound', 'AP_continueRound'];
const buttons = [
  { name: 'AP_NativeRefresh', placeholder: '1073741901', position: [-285, -185], key: 1 },
  { name: 'AP_NativeReady1', placeholder: '1073741902', position: [-95, -185], key: 2 },
  { name: 'AP_NativeNext1', placeholder: '1073741903', position: [95, -185], key: 3 },
  { name: 'AP_NativeReady2', placeholder: '1073741904', position: [285, -185], key: 4 },
];
const ui = {
  name: 'AP_DuelProbe',
  script,
  showCursor: true,
  blockCursor: false,
  controls: [
    { name: 'Background', kind: 'image', position: [0, 0], size: [640, 250], image: 100001, colour: '#193931' },
    {
      name: 'Status', kind: 'text', position: [0, 42], size: [600, 110],
      text: { content: '等待服务端响应', fontSize: 29, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    },
    ...[['Refresh', '刷新状态'], ['Ready', '准备'], ['Advance', '下一轮']].flatMap(([name, content], index) => {
      const position = [(index - 1) * 192, -65];
      const size = [176, 65];
      return [
        { name: `${name}Face`, kind: 'image', position, size, image: 100001, colour: '#286452' },
        {
          name: `${name}Label`, kind: 'text', position, size,
          text: { content, fontSize: 29, colour: '#fff3d7', align: 'centre', valign: 'middle' },
        },
        { name, kind: 'cursorArea', position, size },
      ];
    }),
    ...['1 刷新', '2 第一轮准备', '3 确认下一轮', '4 第二轮准备'].map((content, index) => ({
      name: `NativeLegend${index + 1}`, kind: 'text', position: [buttons[index].position[0], -238], size: [180, 34],
      text: { content, fontSize: 22, colour: '#fff3d7', align: 'centre', valign: 'middle' },
    })),
  ],
};

try {
  await client.connect(transport);
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.deepEqual(capabilities.saveRoots, []);
  assert.equal(capabilities.liveWriteEnabled, false);
  await stage('scene_set_player_count', { min: 2, max: 2 });
  await stage('scene_add_components', {
    prefab: 'player',
    variables: variables.map(name => ({ name, type: 'integer', value: 0 })),
  });
  for (const [name, parameters] of Object.entries(signals)) {
    await stage('scene_add_signal', { name, parameters: parameters.map(([name, type]) => ({ name, type })) });
  }
  const registeredButtons = [];
  for (const { name, position, key } of buttons) {
    const button = await stage('scene_add_button', { name, position, key, size: [72, 72] });
    assert.equal(button.controlId, button.controlGroupIndex);
    registeredButtons.push({ name, key, id: button.controlGroupIndex });
  }
  assert.equal(new Set(registeredButtons.map(({ id }) => id)).size, buttons.length);
  const graph = await stage('scene_add_graph', { name: 'AP_DuelProbe', attachTo: 'stage' });
  const buttonGraph = await stage('scene_add_graph', { name: 'AP_DuelButtons', attachToPrefab: 'player' });
  const graphSource = fs.readFileSync(new URL('../../platform/m2_probe.ts', import.meta.url), 'utf8')
    .replace('id: 1073741825,', `id: ${graph.graphId},`);
  let buttonSource = fs.readFileSync(new URL('../../platform/m2_probe_buttons.ts', import.meta.url), 'utf8')
    .replace('id: 1073741826,', `id: ${buttonGraph.graphId},`);
  for (const [index, { placeholder }] of buttons.entries()) {
    buttonSource = buttonSource.replace(`${placeholder}n`, `${registeredButtons[index].id}n`);
  }
  const compiled = await stage('write_graphs', { graphs: [
    { graphId: graph.graphId, code: graphSource },
    { graphId: buttonGraph.graphId, code: buttonSource },
  ] });
  assert.equal(compiled.failed, undefined, JSON.stringify(compiled));
  await stage('scene_set_client_script', { name: script, file: `${script}.lua`, source });
  await stage('scene_add_client_ui', { ...ui, outputName: 'm2-duel-probe' });

  const { players } = await call('scene_list_respawn_points', { mapPath });
  assert.deepEqual(players, { min: 2, max: 2 });
  const registered = await call('scene_list_signals', { mapPath });
  for (const [name, parameters] of Object.entries(signals)) {
    assert.deepEqual(registered.parameters[name], parameters.map(([name, type]) => ({ name, type })));
  }
  const inspected = await call('inspect_map', { mapPath });
  const readGraph = inspected.graphs.find(entry => entry.id === graph.graphId || entry.graphId === graph.graphId);
  const readButtonGraph = inspected.graphs.find(entry => entry.id === buttonGraph.graphId || entry.graphId === buttonGraph.graphId);
  assert.ok(readGraph?.nodeCount > 0);
  assert.ok(readButtonGraph?.nodeCount > 0);
  assert.ok(readGraph.signalReferences.some(ref => ref.name === 'AP_DuelRequest' && ref.role === 'monitor'));
  assert.ok(readButtonGraph.signalReferences.some(ref => ref.name === 'AP_DuelRequest' && ref.role === 'send'));
  const [playerComponents, stageComponents, interfaceLayout] = await Promise.all([
    call('scene_list_components', { mapPath, prefab: 'player' }),
    call('scene_list_components', { mapPath, entity: 'stage' }),
    call('scene_list_interface', { mapPath }),
  ]);
  const playerTemplate = playerComponents.found.find(component => component.where === 'prefab');
  assert.ok(playerTemplate?.graphs.includes(buttonGraph.graphId));
  assert.ok(!playerTemplate.graphs.includes(graph.graphId));
  const stageEntity = stageComponents.found.find(component => component.where === 'placed');
  assert.ok(stageEntity?.graphs.includes(graph.graphId));
  assert.ok(!stageEntity.graphs.includes(buttonGraph.graphId));
  const layoutControls = interfaceLayout.layouts.flatMap(layout => layout.controls);
  for (const { name, id } of registeredButtons) {
    assert.deepEqual(layoutControls.filter(control => control.name === name), [{ id, name, kind: 'button' }]);
  }
  const scripts = await call('scene_list_client_scripts', { mapPath, includeSource: true });
  const readSource = scripts.scripts.find(entry => entry.name === script)?.source;
  assert.equal(readSource, source);
  const readUi = await call('scene_get_client_ui', { mapPath, ui: ui.name });
  assert.deepEqual(readUi.interface.scripts, [script]);
  assert.deepEqual(
    readUi.interface.controls.map(({ name, kind, position, size }) => ({ name, kind, position, size })),
    ui.controls.map(({ name, kind, position, size }) => ({ name, kind, position, size })),
  );
  assert.ok(readUi.interface.controls.every(control => control.active !== false && control.visible !== false));
  const checked = await call('scene_check_client', { mapPath, scripts: [script] });
  assert.deepEqual(checked.problems, []);
  const graphSimulation = verifyGraph(graphSource, buttonSource, registeredButtons, toolRequire('typescript'));
  const extracted = path.join(workspace, `${script}.lua`);
  fs.writeFileSync(extracted, readSource);
  const clientSimulation = execFileSync(lua, [
    '-E', fileURLToPath(new URL('./m2-probe-input.lua', import.meta.url)), extracted,
  ], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
  assert.equal(sha256(fs.readFileSync(input)), fixtureHash);

  const hash = sha256(fs.readFileSync(mapPath));
  assert.equal(inspected.sha256, hash);
  fs.mkdirSync(candidate);
  const gil = path.join(candidate, path.basename(mapPath));
  fs.copyFileSync(mapPath, gil, fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(new URL('../../platform/M2.md', import.meta.url), path.join(candidate, 'README.md'));
  fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, 'MCP-FIXTURE-LICENSE.txt'));
  fs.writeFileSync(path.join(candidate, 'evidence.json'), JSON.stringify({
    revision, fixtureHash, players, graph: readGraph, buttonGraph: readButtonGraph,
    buttons: registeredButtons, signals: registered.parameters,
    attachments: { stageGraph: graph.graphId, playerPrefab: playerTemplate.prefabId, playerGraph: buttonGraph.graphId },
    clientScriptSha256: sha256(readSource), graphSourceSha256: sha256(graphSource), buttonSourceSha256: sha256(buttonSource),
    clientDiagnostics: checked.problems, graphSimulation, clientSimulation: clientSimulation.trimEnd().split('\n'),
    luaVersion, sha256: hash, officialTwoDeviceTest: 'pending',
  }, null, 2) + '\n');
  const packageFiles = [path.basename(gil), 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
  const checksums = packageFiles.map(name => `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`);
  fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), checksums.join('\n') + '\n');
  console.log(`Candidate: ${gil}`);
} finally {
  await client.close();
}
