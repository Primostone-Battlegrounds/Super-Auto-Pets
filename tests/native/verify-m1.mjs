import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleRun } from '../../platform/m1-bundle.mjs';
import { nativeRun } from '../../platform/m1-ui.mjs';

const revision = '59c576e41632a6bf6781bbca83a676d0da0374ec';
const fixtureName = 'editor-2026-10-26-shapes.gil';
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const [checkoutArg, scratch, lua] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m1.mjs <MCP checkout> <scratch directory> <Lua 5.3 executable>');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0', 'Set MILIASTRA_ALLOW_LIVE_WRITE=0');
const luaVersion = execFileSync(lua, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim();
assert.match(luaVersion, /^Lua 5\.3\./);

const checkout = fs.realpathSync(checkoutArg);
const toolHead = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(toolHead, revision, 'Use the pinned MCP revision');
const toolRequire = createRequire(path.join(checkout, 'package.json'));
const { parse } = toolRequire('luaparse');
const { Client } = toolRequire('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = toolRequire('@modelcontextprotocol/sdk/client/stdio.js');
const source = bundleRun(parse);
assert.ok(source.length <= 400_000, 'Lua source exceeds the MCP inline limit');
const fixture = path.join(checkout, 'tests', 'fixtures', fixtureName);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'm1-run-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const client = new Client({ name: 'auto-pets-m1-native', version: '0.1.0-alpha.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(checkout, 'src', 'server.mjs')],
  cwd: checkout,
  stderr: 'inherit',
  env: { MILIASTRA_ALLOW_LIVE_WRITE: '0', MILIASTRA_SAVE_ROOTS: '[]', MILIASTRA_WORKSPACE: workspace },
});

async function call(name, args = {}) {
  const response = await client.callTool({ name, arguments: args });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  assert.ok(!response.isError, `${name}: ${JSON.stringify(result)}`);
  console.log(`${name} OK`);
  return result;
}

function verifyControls(expected, decoded, controlPaths, prefix = '', parentSize = [1280, 720]) {
  assert.equal(decoded.length, expected.length, `${prefix} children`);
  for (const [index, control] of expected.entries()) {
    const observed = decoded[index];
    const key = prefix ? `${prefix}/${control.name}` : control.name;
    assert.equal(observed.name, control.name);
    assert.equal(observed.kind, control.kind);
    assert.deepEqual(observed.position, control.position ?? [0, 0], `${key} position`);
    assert.deepEqual(observed.size, control.size, `${key} size`);
    assert.equal(observed.image, control.image);
    assert.equal(observed.colour, control.colour);
    assert.equal(observed.visible, control.visible === false ? false : undefined);
    if (control.text) {
      assert.equal(observed.text.content ?? '', control.text.content);
      assert.equal(observed.text.fontSize, control.text.fontSize);
    }
    assert.equal(observed.devices, undefined, `${key} must use shared coordinates`);
    for (const [axis, extent] of parentSize.entries()) {
      assert.ok(Math.abs(observed.position[axis]) + observed.size[axis] / 2 <= extent / 2,
        `${key} outside ${prefix || 'mobile canvas'}`);
    }
    controlPaths.push([key, observed.kind]);
    verifyControls(control.children ?? [], observed.children ?? [], controlPaths, key, observed.size);
  }
}

const seed = 7;
let report;
try {
  await client.connect(transport);
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.deepEqual(capabilities.saveRoots, []);
  assert.equal(capabilities.liveWriteEnabled, false);
  const baseline = await call('scene_list_interface', { mapPath: input });
  assert.equal(baseline.layouts.length, 1);
  assert.ok(baseline.layouts[0].controls.every(control => control.kind === 'builtIn'));
  assert.deepEqual(baseline.clientInterfaces, []);
  assert.deepEqual(baseline.clientTemplates, []);
  assert.deepEqual((await call('scene_list_client_scripts', { mapPath: input })).scripts, []);

  const scripted = await call('scene_set_client_script', {
    mapPath: input, name: nativeRun.script, source, variables: [{ name: 'seed', type: 'integer', value: seed, public: true }],
    outputName: 'm1-run-script',
  });
  assert.deepEqual(scripted.callbacks, ['OnStart', 'OnDestroy']);
  assert.ok(fs.realpathSync(scripted.mapPath).startsWith(workspace + path.sep));
  const mounted = { name: nativeRun.script, values: { seed } };
  const built = await call('scene_add_client_ui', {
    mapPath: scripted.mapPath, ...nativeRun, script: mounted, outputName: 'm1-auto-pets',
  });
  const { mapPath } = built;
  assert.ok(fs.realpathSync(mapPath).startsWith(workspace + path.sep));
  assert.equal(built.offPhoneCanvas, undefined);
  const inspected = await call('inspect_map', { mapPath });
  assert.equal(inspected.sha256, sha256(fs.readFileSync(mapPath)));
  assert.deepEqual(inspected.graphs, []);

  const decoded = await call('scene_get_client_ui', { mapPath, ui: nativeRun.name });
  assert.deepEqual(decoded.interface.scripts, [mounted]);
  const decodedSeed = decoded.interface.scripts[0].values.seed;
  assert.equal(decoded.interface.hidden, undefined);
  assert.equal(decoded.interface.showCursor, true);
  assert.equal(decoded.interface.blockCursor, true);
  assert.equal(decoded.containerId, built.containerId);
  assert.equal(decoded.rootId, built.rootId);
  const controlPaths = [];
  verifyControls(nativeRun.controls, decoded.interface.controls, controlPaths);
  assert.equal(new Set(Object.values(decoded.ids)).size, controlPaths.length + 2);
  const layouts = await call('scene_list_interface', { mapPath });
  assert.deepEqual(layouts.layouts[0].controls.filter(entry => entry.kind !== 'builtIn'), [
    { id: decoded.containerId, name: nativeRun.name, kind: 'clientContainer' },
  ]);
  assert.equal(layouts.clientInterfaces.length, 1);
  assert.deepEqual(layouts.clientInterfaces[0].root.scripts, [nativeRun.script]);
  const listed = await call('scene_list_client_scripts', { mapPath, includeSource: true });
  assert.equal(listed.scripts.length, 1);
  const [embedded] = listed.scripts;
  assert.equal(embedded.source, source);
  assert.equal(embedded.scriptId, scripted.scriptId);
  assert.equal(embedded.file, `${nativeRun.script}.lua`);
  assert.deepEqual(embedded.variables, [{ name: 'seed', type: 'integer', public: true }]);
  const checked = await call('scene_check_client', { mapPath });
  assert.deepEqual(checked.checked, [nativeRun.script]);
  assert.deepEqual(checked.problems, []);
  assert.equal(sha256(fs.readFileSync(input)), fixtureHash);
  assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);

  const extracted = path.join(workspace, embedded.file);
  fs.writeFileSync(extracted, embedded.source);
  const bindings = path.join(workspace, 'control-paths.tsv');
  fs.writeFileSync(bindings, controlPaths.map(control => control.join('\t')).join('\n') + '\n');
  const log = execFileSync(lua, ['-E', fileURLToPath(new URL('./m1-input.lua', import.meta.url)), extracted, bindings, String(decodedSeed)],
    { encoding: 'utf8', timeout: 10_000 });
  fs.writeFileSync(path.join(workspace, 'simulated-run.log'), log);
  console.log(log.trimEnd());
  report = {
    toolRevision: toolHead, fixture: { file: fixtureName, sha256: fixtureHash, originalsUnchanged: true },
    gil: { mapPath, sha256: inspected.sha256, bytes: inspected.bytes, schema: inspected.schema },
    binding: { layoutId: layouts.layouts[0].layoutId, containerId: decoded.containerId, rootId: decoded.rootId,
      scriptId: embedded.scriptId, sourceSha256: sha256(source), sourceBytes: Buffer.byteLength(source), controls: controlPaths.length },
    offline: { status: 'passed', checkProblems: checked.problems },
    simulation: { status: 'passed', runtime: luaVersion, input: 'mocked cursor events', seed: decodedSeed, logs: log.trimEnd().split('\n') },
    officialClient: { pc: 'pending', mobile: 'pending' },
  };
} finally {
  await client.close();
}
const evidence = path.join(workspace, 'evidence.json');
fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(`Evidence: ${evidence}`);
