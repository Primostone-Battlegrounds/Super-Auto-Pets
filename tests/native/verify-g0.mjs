import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sample } from '../../platform/g0-five-slot.mjs';

const revision = '59c576e41632a6bf6781bbca83a676d0da0374ec';
const fixtureName = 'editor-2026-10-13-handui.gil';
const fixtureHash = '262f2c7832ff27d4bb49ab47e3c93e46d5c0121e263c4b89ba1e4231e53097c0';
const [checkoutArg, scratchArg, lua] = process.argv.slice(2);
assert.ok(checkoutArg && scratchArg && lua,
  'Usage: node tests/native/verify-g0.mjs <MCP checkout> <scratch directory> <Lua 5.3 executable>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0', 'Set MILIASTRA_ALLOW_LIVE_WRITE=0');
const luaVersion = execFileSync(lua, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim();
assert.match(luaVersion, /^Lua 5\.3\./, 'The Miliastra client uses Lua 5.3');

const checkout = fs.realpathSync(checkoutArg);
const gitHead = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(gitHead, revision, 'Use the pinned Miliastra MCP revision');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = path.join(checkout, 'tests', 'fixtures', fixtureName);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash, 'The editor fixture changed');
const scriptFile = `${sample.script}.lua`;
const source = fs.readFileSync(new URL(`../../platform/${scriptFile}`, import.meta.url), 'utf8');

fs.mkdirSync(scratchArg, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratchArg), 'g0-five-slot-'));
const isolated = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, isolated, fs.constants.COPYFILE_EXCL);
const toolRequire = createRequire(path.join(checkout, 'package.json'));
const { Client } = toolRequire('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = toolRequire('@modelcontextprotocol/sdk/client/stdio.js');
const client = new Client({ name: 'auto-pets-g0-native', version: '0.0.1-alpha.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(checkout, 'src', 'server.mjs')],
  cwd: checkout,
  stderr: 'inherit',
  env: {
    LOCALAPPDATA: path.join(workspace, 'host-runtime'),
    MILIASTRA_ALLOW_LIVE_WRITE: '0',
    MILIASTRA_SAVE_ROOTS: '[]',
    MILIASTRA_WORKSPACE: workspace,
  },
});

async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  assert.ok(!response.isError, `${name}: ${JSON.stringify(result)}`);
  console.log(`${name} OK`);
  return result;
}

function insideWorkspace(file) {
  assert.ok(fs.realpathSync(file).startsWith(workspace + path.sep), 'Candidate escaped the workspace');
  assert.notEqual(file, isolated, 'MCP returned the input as its output');
  return file;
}

function verifyControls(written, read) {
  assert.equal(read.length, written.length);
  for (const [index, expected] of written.entries()) {
    const actual = read[index];
    for (const key of ['name', 'kind', 'size', 'image', 'colour', 'visible', 'active', 'devices']) {
      assert.deepEqual(actual[key], expected[key], `${expected.name}.${key}`);
    }
    assert.deepEqual(actual.position, expected.position ?? [0, 0], `${expected.name}.position`);
    verifyControls(expected.children ?? [], actual.children ?? []);
  }
}

let evidence;
try {
  await client.connect(transport);
  for (const uri of ['miliastra://workflow', 'miliastra://platform-rules']) {
    const resource = await client.readResource({ uri });
    assert.ok(resource.contents[0].text, `Missing MCP resource ${uri}`);
  }
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.deepEqual(capabilities.saveRoots, []);
  assert.equal(capabilities.liveWriteEnabled, false);

  const staged = await call('scene_set_client_script', {
    mapPath: isolated,
    name: sample.script,
    file: scriptFile,
    source,
    outputName: 'g0-script',
  });
  assert.deepEqual(staged.callbacks, ['OnStart', 'OnDestroy']);
  const built = await call('scene_add_client_ui', {
    mapPath: insideWorkspace(staged.mapPath), ...sample, outputName: 'g0-five-slot',
  });
  assert.equal(built.offPhoneCanvas, undefined);
  const mapPath = insideWorkspace(built.mapPath);
  const inspected = await call('inspect_map', { mapPath });
  assert.equal(inspected.sha256, sha256(fs.readFileSync(mapPath)));
  assert.notEqual(inspected.sha256, fixtureHash);

  const scripts = await call('scene_list_client_scripts', { mapPath, includeSource: true });
  const matchingScripts = scripts.scripts.filter(entry => entry.name === sample.script);
  assert.equal(matchingScripts.length, 1);
  const [script] = matchingScripts;
  assert.equal(script.scriptId, staged.scriptId);
  assert.equal(script.file, scriptFile);
  assert.equal(script.source, source);

  const { layouts, clientInterfaces } = await call('scene_list_interface', { mapPath });
  const [defaultLayout] = layouts;
  assert.ok(defaultLayout.controls.some(control =>
    control.id === built.containerId && control.kind === 'clientContainer' && control.name === sample.name));
  const hud = clientInterfaces.find(entry => entry.containerId === built.containerId);
  assert.equal(hud.root.controlId, built.rootId);
  assert.deepEqual(hud.root.scripts, [sample.script]);
  assert.deepEqual(script.on, [hud.root.name]);

  const read = await call('scene_get_client_ui', { mapPath, ui: sample.name });
  assert.equal(read.rootId, built.rootId);
  assert.equal(read.containerId, built.containerId);
  assert.equal(read.interface.showCursor, true);
  assert.equal(read.interface.blockCursor, true);
  assert.equal(read.interface.hidden, undefined);
  assert.deepEqual(read.interface.scripts, [sample.script]);
  verifyControls(sample.controls, read.interface.controls);
  assert.equal(new Set(Object.values(read.ids)).size, 18); // 5 × (slot, face, hit) + marker + container + root

  const checked = await call('scene_check_client', { mapPath, scripts: [sample.script] });
  assert.deepEqual(checked.checked, [sample.script]);
  assert.deepEqual(checked.problems, []);
  assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
  assert.equal(sha256(fs.readFileSync(isolated)), fixtureHash);

  const extracted = path.join(workspace, scriptFile);
  fs.writeFileSync(extracted, script.source);
  const simulation = execFileSync(lua, [
    '-E', fileURLToPath(new URL('./g0-input.lua', import.meta.url)), extracted,
  ], { encoding: 'utf8', timeout: 10_000 });
  fs.writeFileSync(path.join(workspace, 'simulated-input.log'), simulation);
  console.log(simulation.trimEnd());
  evidence = {
    toolRevision: gitHead,
    fixture: { file: fixtureName, sha256: fixtureHash, originalsUnchanged: true },
    gil: { mapPath, sha256: inspected.sha256, bytes: inspected.bytes, schema: inspected.schema },
    bindings: {
      defaultLayout: defaultLayout.layoutId,
      containerId: read.containerId,
      rootId: read.rootId,
      script: { id: script.scriptId, file: script.file, sha256: sha256(script.source) },
      controlIds: read.ids,
      layout: read.interface,
    },
    offline: { status: 'passed', clientCheckProblems: checked.problems },
    simulated: { status: 'passed', runtime: luaVersion, input: 'mocked cursor events', logs: simulation.trimEnd().split('\n') },
    officialClient: { pc: 'pending', mobile: 'pending' },
  };
} finally {
  await client.close();
}
fs.writeFileSync(path.join(workspace, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`Evidence: ${path.join(workspace, 'evidence.json')}`);
