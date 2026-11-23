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
const [checkoutArg, scratch, lua, packageDir] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m1.mjs <MCP checkout> <scratch directory> <Lua 5.3 executable> [new package directory]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0', 'Set MILIASTRA_ALLOW_LIVE_WRITE=0');
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
let sourceRevision;
if (packageDir) {
  sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src', 'platform', 'tests/native'], { cwd: projectRoot });
  assert.ok(!fs.existsSync(packageDir), 'Use a new package directory');
}
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

const canvases = { mobile: { width: 1280, height: 720 }, pc: { width: 1600, height: 900 } };
const screens = Object.fromEntries(Object.entries(canvases).map(([device, { width, height }]) => [device, [width, height]]));

function assertBounds(key, position, size, bounds) {
  for (const [name, parentSize] of Object.entries(bounds)) {
    for (const [axis, extent] of parentSize.entries()) {
      assert.ok(Math.abs(position[axis]) + size[axis] / 2 <= extent / 2 + 0.0001, `${key} outside ${name}`);
    }
  }
}

function verifyControls(expected, decoded, records, prefix = '', parentSize) {
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
    assertBounds(key, observed.position, observed.size, parentSize ? { [prefix]: parentSize } : screens);
    const { kind, position, size, image, colour, opacity, text } = observed;
    records.push({ path: key, parent: prefix || null, kind, position, size, image, colour, opacity, text,
      active: observed.active !== false, visible: observed.visible !== false });
    verifyControls(control.children ?? [], observed.children ?? [], records, key, observed.size);
  }
}

function readFrames(file, records) {
  const frames = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const [name, key, active, visible, x, y, width, height, image, colour, textColour, content] = line.split('\t');
    if (!frames.has(name)) frames.set(name, new Map());
    const frame = frames.get(name);
    assert.ok(!frame.has(key), `Duplicate frame control: ${name} ${key}`);
    frame.set(key, { active, visible, x, y, width, height, image, colour, textColour, content });
  }
  assert.deepEqual([...frames.keys()].sort(), [
    'battle_damage', 'battle_full', 'battle_summon', 'defeat', 'populated', 'preparation', 'victory',
  ]);
  return {
    canvas: canvases.mobile,
    canvases,
    frames: Object.fromEntries([...frames].map(([name, dynamic]) => {
      assert.equal(dynamic.size, records.length);
      const sizes = new Map();
      const items = records.map(base => {
        const patch = dynamic.get(base.path);
        const item = {
          ...base,
          active: patch.active === '' ? base.active : patch.active === '1',
          visible: patch.visible === '' ? base.visible : patch.visible === '1',
          position: patch.x === '' ? base.position : [Number(patch.x), Number(patch.y)],
          size: patch.width === '' ? base.size : [Number(patch.width), Number(patch.height)],
          image: patch.image === '' ? base.image : Number(patch.image),
          colour: patch.colour || base.colour,
          text: base.text ? {
            ...base.text,
            colour: patch.textColour || base.text.colour,
            content: patch.content === '~' ? base.text.content : decodeURIComponent(patch.content),
          } : undefined,
        };
        assertBounds(`${name}/${item.path}`, item.position, item.size,
          item.parent ? { [item.parent]: sizes.get(item.parent) } : screens);
        sizes.set(item.path, item.size);
        return item;
      });
      return [name, items];
    })),
  };
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
  assert.deepEqual(scripted.callbacks, ['OnStart', 'OnUpdate', 'OnDestroy']);
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
  const records = [];
  verifyControls(nativeRun.controls, decoded.interface.controls, records);
  assert.equal(new Set(Object.values(decoded.ids)).size, records.length + 2);
  const byPath = new Map(records.map(item => [item.path, item]));
  const battlePanel = byPath.get('Battle');
  for (const card of records.filter(item => /^Team[1-5]$/.test(item.path))) {
    assert.ok(battlePanel.position[1] + battlePanel.size[1] / 2 < card.position[1] - card.size[1] / 2,
      'Battle panel overlaps the roster');
  }
  for (const underline of records.filter(item => item.path.endsWith('/Selected'))) {
    const tag = byPath.get(`${underline.parent}/Tag`);
    assert.ok(underline.position[1] + underline.size[1] / 2 < tag.position[1] - tag.size[1] / 2,
      `${tag.path} overlaps its selected underline`);
  }
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
  fs.writeFileSync(bindings, records.map(record =>
    [record.path, record.kind, ...record.position, ...record.size].join('\t')).join('\n') + '\n');
  const framesRaw = path.join(workspace, 'frames-runtime.tsv');
  const log = execFileSync(lua, ['-E', fileURLToPath(new URL('./m1-input.lua', import.meta.url)),
    extracted, bindings, String(decodedSeed), framesRaw],
    { encoding: 'utf8', timeout: 10_000 });
  const framesPath = path.join(workspace, 'frames.json');
  fs.writeFileSync(framesPath, JSON.stringify(readFrames(framesRaw, records)) + '\n');
  fs.writeFileSync(path.join(workspace, 'simulated-run.log'), log);
  console.log(log.trimEnd());
  report = {
    toolRevision: toolHead, fixture: { file: fixtureName, sha256: fixtureHash, originalsUnchanged: true },
    gil: { mapPath, sha256: inspected.sha256, bytes: inspected.bytes, schema: inspected.schema },
    binding: { layoutId: layouts.layouts[0].layoutId, containerId: decoded.containerId, rootId: decoded.rootId,
      scriptId: embedded.scriptId, sourceSha256: sha256(source), sourceBytes: Buffer.byteLength(source), controls: records.length },
    offline: { status: 'passed', checkProblems: checked.problems },
    simulation: { status: 'passed', runtime: luaVersion, input: 'mocked cursor events and update ticks', seed: decodedSeed,
      framesPath, logs: log.trimEnd().split('\n') },
    officialClient: { pc: 'pending', mobile: 'pending' },
  };
} finally {
  await client.close();
}
const evidence = path.join(workspace, 'evidence.json');
fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(`Evidence: ${evidence}`);

if (packageDir) {
  const mapFile = 'm1-auto-pets.gil';
  const manifest = {
    sourceRevision,
    toolRevision: report.toolRevision,
    fixture: { file: report.fixture.file, sha256: report.fixture.sha256 },
    gil: { file: mapFile, sha256: report.gil.sha256, bytes: report.gil.bytes, schema: report.gil.schema },
    offline: report.offline.status,
    simulation: { status: report.simulation.status, seed: report.simulation.seed },
    officialClient: report.officialClient,
  };
  fs.mkdirSync(packageDir);
  try {
    const mapPath = path.join(packageDir, mapFile);
    fs.copyFileSync(report.gil.mapPath, mapPath, fs.constants.COPYFILE_EXCL);
    assert.equal(sha256(fs.readFileSync(mapPath)), manifest.gil.sha256);
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(packageDir, 'SHA256SUMS'), `${manifest.gil.sha256}  ${mapFile}\n`);
    fs.writeFileSync(path.join(packageDir, 'simulated-run.log'), report.simulation.logs.join('\n') + '\n');
    const guide = `# 小动物自走棋 M1 真机验收候选\n\n游戏提交 \`${sourceRevision}\`。\n\n` +
      `先在本目录运行 \`sha256sum -c SHA256SUMS\`。使用获授权的官方隔离关卡导入 \`${mapFile}\`。\n` +
      `在 PC 与手机分别核对画面、操作和完整单局，留存客户端版本与 AUTO_PETS_M1 日志。\n\n` +
      `[同一提交的 M1 验收步骤](https://github.com/Primostone-Battlegrounds/Super-Auto-Pets/blob/${sourceRevision}/platform/M1.md#官方客户端待验)\n`;
    fs.writeFileSync(path.join(packageDir, 'README.md'), guide);
  } catch (error) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw error;
  }
  console.log(`Device candidate: ${packageDir}`);
}
