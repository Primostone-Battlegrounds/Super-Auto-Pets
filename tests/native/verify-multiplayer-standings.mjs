import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { standingsLayout, standingsRequest, standingsScript } from '../../platform/multiplayer-standings.mjs';

const [checkoutArg, scratch, lua, mode, baseline, output] = process.argv.slice(2);
const stages = {
  duel: { file: 'm2-duel-probe.gil', ui: 'AP_DuelProbe', players: { min: 2, max: 2 } },
  room: { file: 'm3-eight-seat-probe.gil', ui: 'AP_EightProbe', players: { min: 1, max: 8 } },
};
const config = stages[mode];
assert.ok(checkoutArg && scratch && lua && config && baseline && output,
  'Usage: node tests/native/verify-multiplayer-standings.mjs <MCP> <scratch> <Lua 5.3> <duel|room> <probe package> <new output>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
assert.ok(!fs.existsSync(output), 'Use a new output directory');
const luaVersion = execFileSync(lua, ['-E', '-v'], { encoding: 'utf8' }).trim();
assert.match(luaVersion, /^Lua 5\.3\./);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const git = (directory, args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
const sourceRevision = git(projectRoot, ['rev-parse', 'HEAD']);
const checkout = fs.realpathSync(checkoutArg);
const toolRevision = git(checkout, ['rev-parse', 'HEAD']);
assert.equal(toolRevision, '59c576e41632a6bf6781bbca83a676d0da0374ec', 'Use the pinned MCP revision');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineEvidence = JSON.parse(fs.readFileSync(path.join(baseline, 'evidence.json'), 'utf8'));
const baselineFile = mode === 'duel' && baselineEvidence.profile === 'release' ? 'm2-duel-release.gil' : config.file;
const bytes = fs.readFileSync(path.join(baseline, baselineFile));
const baselineHash = sha256(bytes);
assert.equal(baselineEvidence.sha256, baselineHash, 'Incorrect source probe package');

fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'multiplayer-standings-'));
const input = path.join(workspace, 'input.gil');
fs.writeFileSync(input, bytes, { flag: 'wx' });

const requireTool = createRequire(path.join(checkout, 'package.json'));
const loadTool = name => import(pathToFileURL(requireTool.resolve(name)).href);
const [{ parseMessage }, { buildNodeGraphFieldIndex }] = await Promise.all([
  loadTool('genshin-ts/injector/binary'), loadTool('genshin-ts/injector/node_graph'),
]);
const { Client } = requireTool('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = requireTool('@modelcontextprotocol/sdk/client/stdio.js');
const client = new Client({ name: 'auto-pets-multiplayer-standings', version: '0.1.0' });
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
  return result;
}

async function stage(name, args) {
  const result = await call(name, { mapPath, ...args });
  mapPath = fs.realpathSync(result.mapPath);
  assert.ok(mapPath !== input && mapPath.startsWith(workspace + path.sep));
  return result;
}

const script = 'multiplayer_standings';
const uiName = 'AP_Standings';
const strip = mode === 'duel';
const probe = mode === 'room' || !baselineEvidence.fightGraph;
const layout = standingsLayout(mode, { position: strip ? [0, 328] : [507, 0], probe, strip });
const canvases = { pc: [1600, 900], mobile: [1280, 720] };

function graphHashes(gil) {
  const payload = gil.subarray(20, -4);
  const fields = [];
  parseMessage(payload, 0, payload.length, 0, 0, 0, 0, 0, 0, 0, fields);
  return Object.fromEntries([...buildNodeGraphFieldIndex(payload, fields)].map(([id, entries]) =>
    [id, entries.map(({ field }) => sha256(payload.subarray(field.dataStart, field.dataEnd)))]));
}

function verifyLayout(expected, observed, parentSize) {
  assert.equal(observed.name, expected.name);
  assert.equal(observed.kind, expected.kind);
  assert.deepEqual(observed.position, expected.position);
  assert.deepEqual(observed.size, expected.size);
  for (const [axis, extent] of parentSize.entries()) {
    assert.ok(Math.abs(observed.position[axis]) + observed.size[axis] / 2 <= extent / 2, observed.name);
  }
  assert.equal(observed.text?.content ?? '', expected.text?.content ?? '');
  assert.equal(observed.text?.fontSize, expected.text?.fontSize);
  assert.equal(observed.image, expected.image);
  assert.equal(observed.colour, expected.colour);
  assert.equal(observed.children?.length ?? 0, expected.children?.length ?? 0);
  for (const [index, child] of (observed.children ?? []).entries()) {
    verifyLayout(expected.children[index], child, observed.size);
  }
}

try {
  await client.connect(transport);
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.equal(capabilities.liveWriteEnabled, false);
  assert.deepEqual(capabilities.saveRoots, []);
  const original = await call('inspect_map', { mapPath });
  const originalUi = await call('scene_get_client_ui', { mapPath, ui: config.ui });
  for (const control of originalUi.interface.controls) {
    assert.ok(control.position.some((coordinate, axis) =>
      Math.abs(coordinate - layout.position[axis]) > (control.size[axis] + layout.size[axis]) / 2),
    `Overlapping original control ${control.name}`);
  }
  const signals = await call('scene_list_signals', { mapPath });
  const refresh = signals.parameters[standingsRequest(mode)];
  assert.ok(refresh?.length && refresh.every(({ type }) => type === 'integer'));
  assert.equal(refresh[0].name, strip ? 'action' : 'path');
  const source = standingsScript(mode, refresh.length);
  await stage('scene_set_client_script', { name: script, file: `${script}.lua`, source });
  const built = await stage('scene_add_client_ui', {
    name: uiName, script, blockCursor: false, blockKeys: false, controls: [layout],
    outputName: `${mode}-standings-probe`,
  });
  assert.equal(built.offPhoneCanvas, undefined);
  const inspected = await call('inspect_map', { mapPath });
  assert.deepEqual(inspected.graphs, original.graphs);
  const roundtripUi = await call('scene_get_client_ui', { mapPath, ui: config.ui });
  assert.deepEqual(roundtripUi.interface, originalUi.interface);
  assert.deepEqual(roundtripUi.ids, originalUi.ids);
  const { players } = await call('scene_list_respawn_points', { mapPath });
  assert.deepEqual(players, config.players);
  const ui = await call('scene_get_client_ui', { mapPath, ui: uiName });
  assert.deepEqual(ui.interface.scripts, [script]);
  assert.ok(!ui.interface.blockCursor && !ui.interface.blockKeys && !ui.interface.showCursor);
  assert.equal(ui.interface.controls.length, 1);
  for (const size of Object.values(canvases)) verifyLayout(layout, ui.interface.controls[0], size);

  const listed = await call('scene_list_client_scripts', { mapPath, includeSource: true });
  const readback = listed.scripts.find(({ name }) => name === script)?.source;
  assert.equal(readback, source);
  const checked = await call('scene_check_client', { mapPath, scripts: [script] });
  assert.deepEqual(checked.problems, []);
  const extracted = path.join(workspace, `${script}.lua`);
  const bindings = path.join(workspace, 'controls.txt');
  fs.writeFileSync(extracted, readback);
  fs.writeFileSync(bindings, ui.interface.controls[0].children.map(({ name }) => name).join('\n') + '\n');
  const simulation = execFileSync(lua, ['-E', fileURLToPath(new URL('./multiplayer-standings.lua', import.meta.url)),
    mode, extracted, bindings, String(refresh.length)], { cwd: projectRoot, encoding: 'utf8', timeout: 10_000 }).trim();
  const gil = fs.readFileSync(mapPath);
  assert.equal(sha256(gil), inspected.sha256);
  const originalGraphHashes = graphHashes(bytes);
  assert.equal(Object.keys(originalGraphHashes).length, original.graphs.length);
  assert.deepEqual(graphHashes(gil), originalGraphHashes);
  assert.equal(sha256(fs.readFileSync(input)), baselineHash);
  assert.equal(sha256(fs.readFileSync(path.join(baseline, baselineFile))), baselineHash);

  const file = `${mode}-standings-probe.gil`;
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, file), gil);
  fs.copyFileSync(new URL('../../platform/Multiplayer-standings.md', import.meta.url), path.join(output, 'README.md'));
  fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(output, 'MCP-FIXTURE-LICENSE.txt'));
  fs.writeFileSync(path.join(output, 'evidence.json'), JSON.stringify({
    sourceRevision, toolRevision, baselineRevision: baselineEvidence.sourceRevision ?? null, baselineHash,
    players, canvases, originalGraphHashes, baseUiUnchanged: true, sourceSha256: sha256(readback),
    controls: 1 + layout.children.length, refresh, simulation, luaVersion, diagnostics: checked.problems,
    gil: { file, bytes: gil.length, sha256: inspected.sha256 }, officialClient: 'pending',
  }, null, 2) + '\n');
  const files = [file, 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), files.map(name =>
    `${sha256(fs.readFileSync(path.join(output, name)))}  ${name}\n`).join(''));
  console.log(simulation);
  console.log(`Candidate: ${output}`);
} finally {
  await client.close();
}
