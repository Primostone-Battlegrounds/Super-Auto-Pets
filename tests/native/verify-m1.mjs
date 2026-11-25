import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { bundleRun } from '../../platform/m1-bundle.mjs';
import { nativeRun, portraitLayers } from '../../platform/m1-ui.mjs';

const revision = '59c576e41632a6bf6781bbca83a676d0da0374ec';
const fixtureName = 'editor-2026-10-26-shapes.gil';
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const release = args.at(-1) === '--release';
if (release) args.pop();
const [checkoutArg, scratch, lua, packageDir] = args;
const profile = release ? 'release' : 'compatibility';
const candidateName = release ? 'm4-single-practice' : 'm1-auto-pets';
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m1.mjs <MCP checkout> <scratch directory> <Lua 5.3 executable> [new package directory] [--release]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0', 'Set MILIASTRA_ALLOW_LIVE_WRITE=0');
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }).trim();
const sourceRevision = git(['rev-parse', 'HEAD']);
const checkedPaths = ['src', 'platform', 'tests/native', 'scripts/render-native-previews.py'];
const sourceChanges = git(['status', '--porcelain', '--untracked-files=all', '--', ...checkedPaths]);
if (packageDir) {
  assert.equal(sourceChanges, '', 'Commit the runtime sources and evidence inputs before exporting a candidate');
  assert.ok(!fs.existsSync(packageDir), 'Use a new package directory');
}
const lua54 = process.env.LUA54 || 'lua5.4';
const versions = {
  lua53: execFileSync(lua, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim(),
  lua54: execFileSync(lua54, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim(),
  node: process.version,
};
assert.match(versions.lua53, /^Lua 5\.3\./);
assert.match(versions.lua54, /^Lua 5\.4\./);
const replayScript = fileURLToPath(new URL('./m1-replay.lua', import.meta.url));
const replayOptions = { cwd: projectRoot, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 };
const startedAt = performance.now();
const source54 = execFileSync(lua54, ['-E', replayScript, 'source', profile], replayOptions);
const source53 = execFileSync(lua, ['-E', replayScript, 'source', profile], replayOptions);
const replayHash = sha256(source54);
assert.equal(sha256(source53), replayHash, 'Source replay differs between Lua 5.3 and Lua 5.4');
const replayPrelude = source54.subarray(0, 200).toString('utf8');
const rulesHash = replayPrelude.match(/^rules_hash ((?:sha256:)?[a-f0-9]{64})\n/)?.[1];
const assets = replayPrelude.match(/\nassets (\d+) (\d+) (\d+)\n/);
assert.ok(rulesHash && assets, 'Replay must identify its runtime catalog and enumerate presentation assets');
assert.ok(Number(assets[3]) <= portraitLayers, 'The GIL portrait pool cannot display the whole runtime catalog');
const catalogFiles = release ? ['data.lua', 'release_data.lua'] : ['data.lua'];
const catalog = catalogFiles.map(file => fs.readFileSync(path.join(projectRoot, 'src/autopets', file)));
const normalizedCatalog = catalog.map(bytes =>
  bytes.toString('utf8').replace(/\r\n/g, '\n').replace(/^data\.rules_hash = "[^"]*"\n/m, '')).join('');
assert.equal(rulesHash, `sha256:${sha256(normalizedCatalog)}`, 'The runtime catalog hash is stale');
const sources = {
  revision: sourceRevision, dirty: sourceChanges !== '', profile, rulesHash,
  catalogSha256: sha256(Buffer.concat(catalog)),
  artSha256: sha256(fs.readFileSync(path.join(projectRoot, 'src/autopets/art.lua'))),
};
const sourceReplayMs = performance.now() - startedAt;

const checkout = fs.realpathSync(checkoutArg);
const toolHead = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(toolHead, revision, 'Use the pinned MCP revision');
const toolRequire = createRequire(path.join(checkout, 'package.json'));
const { parse } = toolRequire('luaparse');
const { Client } = toolRequire('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = toolRequire('@modelcontextprotocol/sdk/client/stdio.js');
const source = bundleRun(parse, release);
assert.ok(source.length <= 400_000, 'Lua source exceeds the MCP inline limit');
const fixture = path.join(checkout, 'tests', 'fixtures', fixtureName);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), `${candidateName}-`));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const client = new Client({ name: 'auto-pets-m1-native', version: '0.1.0-alpha.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(checkout, 'src', 'server.mjs')],
  cwd: checkout,
  stderr: 'inherit',
  env: {
    LOCALAPPDATA: path.join(workspace, 'host-runtime'),
    MILIASTRA_ALLOW_LIVE_WRITE: '0', MILIASTRA_SAVE_ROOTS: '[]', MILIASTRA_WORKSPACE: workspace,
  },
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
    if (control.kind === 'image') assert.equal(observed.colour ?? '#ffffff', control.colour ?? '#ffffff', key);
    assert.equal(observed.visible, control.visible === false ? false : undefined);
    if (control.text) {
      assert.equal(observed.text.content ?? '', control.text.content);
      assert.equal(observed.text.fontSize, control.text.fontSize);
    }
    assert.equal(observed.devices, undefined, `${key} must use shared coordinates`);
    assertBounds(key, observed.position, observed.size, parentSize ? { [prefix]: parentSize } : screens);
    if (observed.kind === 'cursorArea') {
      assert.ok(observed.size.every(value => value >= 48), `${key} has an undersized input target`);
    }
    const { kind, position, size, image, colour, opacity, text } = observed;
    records.push({ path: key, parent: prefix || null, kind, position, size, image, colour, opacity, text,
      active: observed.active !== false, visible: observed.visible !== false });
    verifyControls(control.children ?? [], observed.children ?? [], records, key, observed.size);
  }
}

function verifyFrameHitAreas(name, items) {
  const shown = new Map();
  const centres = new Map();
  const areas = [];
  for (const item of items) {
    const parent = centres.get(item.parent) ?? [0, 0];
    const centre = item.position.map((offset, axis) => offset + parent[axis]);
    centres.set(item.path, centre);
    const visible = item.active && item.visible && (item.parent === null || shown.get(item.parent));
    shown.set(item.path, visible);
    if (visible && item.kind === 'cursorArea') {
      areas.push({ path: item.path, centre, size: item.size });
      assertBounds(`${name}/${item.path}`, centre, item.size, screens);
    }
  }
  const overlay = shown.get('Restart') ? 'Restart/' : shown.get('Menu') ? 'Menu/' : '';
  const interactive = areas.filter(entry => entry.path.startsWith(overlay));
  assert.ok(interactive.length, `${name} has no input target`);
  for (const [index, first] of interactive.entries()) {
    for (const second of interactive.slice(index + 1)) {
      assert.ok(first.centre.some((value, axis) =>
        Math.abs(value - second.centre[axis]) > (first.size[axis] + second.size[axis]) / 2),
      `${name}: ${first.path} meets ${second.path}`);
    }
  }
}

function readFrames(file, records) {
  const frames = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const [name, key, active, visible, x, y, width, height, image, colour, textColour, content, parent] = line.split('\t');
    if (!frames.has(name)) frames.set(name, new Map());
    const frame = frames.get(name);
    assert.ok(!frame.has(key), `Duplicate frame control: ${name} ${key}`);
    frame.set(key, { active, visible, x, y, width, height, image, colour, textColour, content, parent });
  }
  const expectedFrames = release ? [
    'battle_full', 'menu', 'release_summon', 'tier_five', 'tier_four', 'tier_six', 'victory',
  ] : [
    'battle_attack', 'battle_damage', 'battle_full', 'battle_summon', 'defeat', 'menu', 'menu_discard',
    'merge_preview', 'populated', 'preparation', 'restart_confirm', 'shop_tooltip', 'victory',
  ];
  assert.deepEqual([...frames.keys()].sort(), expectedFrames);
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
          parent: patch.parent === 'root' ? null : base.parent,
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
      const lifted = items.find(item => dynamic.get(item.path).parent === 'root');
      const isLifted = item => lifted && (item.path === lifted.path || item.path.startsWith(`${lifted.path}/`));
      const paintOrder = lifted ? [...items.filter(item => !isLifted(item)), ...items.filter(isLifted)] : items;
      verifyFrameHitAreas(name, paintOrder);
      return [name, paintOrder];
    })),
  };
}

function visibleResources(frames) {
  return Object.fromEntries(Object.entries(frames.frames).map(([name, items]) => {
    const effective = new Map();
    let controls = 0;
    let portraitLayers = 0;
    for (const item of items) {
      const visible = item.active && item.visible && (item.parent === null || effective.get(item.parent));
      effective.set(item.path, visible);
      if (visible) {
        controls += 1;
        if (/\/Portrait\/Layer[1-9][0-9]*$/.test(item.path)) portraitLayers += 1;
      }
    }
    return [name, { controls, portraitLayers }];
  }));
}

const seed = release ? 8 : 1;
const buildStartedAt = performance.now();
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

  const cleaned = await call('scene_remove_entities', { mapPath: input, names: ['积木样本'], outputName: 'm1-clean-scene' });
  const singlePlayer = await call('scene_set_player_count', {
    mapPath: cleaned.mapPath, min: 1, max: 1, outputName: 'm1-single-player',
  });
  const scripted = await call('scene_set_client_script', {
    mapPath: singlePlayer.mapPath, name: nativeRun.script, source,
    variables: [{ name: 'seed', type: 'integer', value: seed, public: true }],
    outputName: 'm1-run-script',
  });
  assert.deepEqual(scripted.callbacks, ['OnStart', 'OnEnable', 'OnDisable', 'OnUpdate', 'OnDestroy']);
  assert.ok(fs.realpathSync(scripted.mapPath).startsWith(workspace + path.sep));
  const mounted = { name: nativeRun.script, values: { seed } };
  const built = await call('scene_add_client_ui', {
    mapPath: scripted.mapPath, ...nativeRun, script: mounted, outputName: candidateName,
  });
  const { mapPath } = built;
  assert.ok(fs.realpathSync(mapPath).startsWith(workspace + path.sep));
  assert.equal(built.offPhoneCanvas, undefined);
  const inspected = await call('inspect_map', { mapPath });
  assert.equal(inspected.sha256, sha256(fs.readFileSync(mapPath)));
  assert.deepEqual(inspected.graphs, []);
  const { players } = await call('scene_list_respawn_points', { mapPath });
  assert.deepEqual(players, { min: 1, max: 1 });
  const { entities } = await call('scene_list_entities', { mapPath });
  assert.ok(entities.every(({ name }) => ['关卡实体', '默认模版', '默认模版(角色编辑)'].includes(name)));

  const decoded = await call('scene_get_client_ui', { mapPath, ui: nativeRun.name });
  assert.deepEqual(decoded.interface.scripts, [mounted]);
  const decodedSeed = decoded.interface.scripts[0].values.seed;
  assert.equal(decoded.interface.hidden, undefined);
  assert.equal(decoded.interface.showCursor, true);
  assert.equal(decoded.interface.blockCursor, true);
  assert.equal(decoded.interface.blockKeys, true);
  assert.equal(decoded.containerId, built.containerId);
  assert.equal(decoded.rootId, built.rootId);
  const records = [];
  verifyControls(nativeRun.controls, decoded.interface.controls, records);
  assert.equal(new Set(Object.values(decoded.ids)).size, records.length + 2);
  const byPath = new Map(records.map(item => [item.path, item]));
  const field = byPath.get('Field');
  const heading = byPath.get('Heading');
  for (const name of ['OpenMenu', 'Reset']) {
    const button = byPath.get(name);
    assert.ok(button.position[1] - button.size[1] / 2 > field.position[1] + field.size[1] / 2,
      `${name} overlaps the field`);
    assert.ok(button.position[1] + button.size[1] / 2 < heading.position[1] - heading.size[1] / 2,
      `${name} overlaps the heading`);
  }
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
  const buildAndReadbackMs = performance.now() - buildStartedAt;
  const replayStartedAt = performance.now();
  const extractedReplay = execFileSync(lua, ['-E', replayScript, 'bundle', extracted, profile], replayOptions);
  assert.equal(sha256(extractedReplay), replayHash, 'GIL readback replay differs from tested source');
  const replayMs = performance.now() - replayStartedAt;
  const replayPath = path.join(workspace, 'domain-replay.txt');
  fs.writeFileSync(replayPath, extractedReplay);
  const framesRaw = path.join(workspace, 'frames-runtime.tsv');
  const mobileFramesRaw = path.join(workspace, 'frames-runtime-mobile.tsv');
  const inputScript = fileURLToPath(new URL('./m1-input.lua', import.meta.url));
  const inputSimulationMs = {};
  const inputLogs = {};
  for (const [device, frameFile] of [['pc', framesRaw], ['mobile', mobileFramesRaw]]) {
    const inputStartedAt = performance.now();
    inputLogs[device] = execFileSync(lua, ['-E', inputScript, extracted, bindings, String(decodedSeed), frameFile, device, profile],
      { cwd: projectRoot, encoding: 'utf8', timeout: 30_000 });
    inputSimulationMs[device] = performance.now() - inputStartedAt;
  }
  const log = inputLogs.pc;
  assert.equal(inputLogs.mobile, log, 'PC and mobile simulated input produced different results');
  assert.deepEqual(fs.readFileSync(mobileFramesRaw), fs.readFileSync(framesRaw),
    'PC and mobile simulated input produced different layout states');
  const framesPath = path.join(workspace, 'frames.json');
  const frames = readFrames(framesRaw, records);
  fs.writeFileSync(framesPath, JSON.stringify(frames) + '\n');
  fs.writeFileSync(path.join(workspace, 'simulated-run.log'), log);
  console.log(log.trimEnd());
  const sample = log.match(/^NATIVE_RESOURCES (.+)$/m)?.[1];
  assert.ok(sample, 'Missing lifecycle metrics');
  const lifecycle = Object.fromEntries(sample.split(' ').map(item => {
    const [name, value] = item.split('=');
    return [name, Number(value)];
  }));
  const audioIds = log.match(/^NATIVE_AUDIO ([0-9,]+)$/m)?.[1].split(',').map(Number);
  const soundCatalog = JSON.parse(fs.readFileSync(path.join(checkout, 'src/scene/media/sounds.json'), 'utf8'));
  const validSounds = new Set(soundCatalog.rows.map(([id]) => id));
  assert.ok(audioIds?.length && audioIds.every(id => validSounds.has(id)), 'Runtime used an unlisted sound');
  const resources = {
    lifecycle,
    static: {
      controls: records.length,
      containers: records.filter(record => record.kind === 'container').length,
      cursorAreas: records.filter(record => record.kind === 'cursorArea').length,
      textControls: records.filter(record => record.kind === 'text').length,
      imageControls: records.filter(record => record.kind === 'image').length,
      portraitLayersPerSlot: portraitLayers,
      portraitLayerPool: records.filter(record => /\/Portrait\/Layer[1-9][0-9]*$/.test(record.path)).length,
      portraitRoots: records.filter(record => record.path.endsWith('/Portrait')).length,
      catalogAssets: Number(assets[1]),
      catalogDefinitionLayers: Number(assets[2]),
      largestCatalogPortrait: Number(assets[3]),
      simulatedSoundIds: audioIds,
      gilBytes: inspected.bytes,
      bundleBytes: Buffer.byteLength(source),
    },
    visiblePerCapturedFrame: visibleResources(frames),
    durationsMs: { sourceReplayMs, buildAndReadbackMs, replayMs, inputSimulationMs },
    measurement: 'MCP host and simulated UI. Frame counts follow parent visibility before overlay occlusion. Device frame and capacity metrics pending.',
  };
  fs.writeFileSync(path.join(workspace, 'resource-report.json'), JSON.stringify(resources, null, 2) + '\n');
  report = {
    sources, versions, toolRevision: toolHead,
    fixture: { file: fixtureName, sha256: fixtureHash, originalsUnchanged: true },
    gil: { mapPath, sha256: inspected.sha256, bytes: inspected.bytes, schema: inspected.schema },
    players,
    binding: { layoutId: layouts.layouts[0].layoutId, containerId: decoded.containerId, rootId: decoded.rootId,
      scriptId: embedded.scriptId, sourceSha256: sha256(embedded.source), sourceBytes: Buffer.byteLength(source),
      controls: records.length },
    offline: { status: 'passed', checkProblems: checked.problems },
    replay: { status: 'passed', sourceRuntimes: [versions.lua53, versions.lua54], readbackRuntime: versions.lua53,
      sha256: replayHash, bytes: extractedReplay.length },
    simulation: { status: 'passed', runtime: versions.lua53, input: 'coordinate-driven mocked cursor events and update ticks',
      devices: screens,
      seed: decodedSeed, framesPath, logs: log.trimEnd().split('\n') },
    resources,
    officialClient: { pc: 'pending', mobile: 'pending' },
  };
} finally {
  await client.close();
}
const evidence = path.join(workspace, 'evidence.json');
fs.writeFileSync(evidence, JSON.stringify(report, null, 2) + '\n');
console.log(`Evidence: ${evidence}`);

if (packageDir) {
  const mapFile = `${candidateName}.gil`;
  const manifest = {
    sourceRevision, profile,
    rulesHash: report.sources.rulesHash,
    catalogSha256: report.sources.catalogSha256,
    artSha256: report.sources.artSha256,
    toolRevision: report.toolRevision,
    versions: report.versions,
    binding: report.binding,
    fixture: { file: report.fixture.file, sha256: report.fixture.sha256 },
    gil: { file: mapFile, sha256: report.gil.sha256, bytes: report.gil.bytes, schema: report.gil.schema },
    players: report.players,
    offline: report.offline.status,
    replay: report.replay,
    simulation: { status: report.simulation.status, seed: report.simulation.seed, devices: report.simulation.devices },
    officialClient: report.officialClient,
  };
  fs.mkdirSync(packageDir);
  try {
    const mapPath = path.join(packageDir, mapFile);
    fs.copyFileSync(report.gil.mapPath, mapPath, fs.constants.COPYFILE_EXCL);
    assert.equal(sha256(fs.readFileSync(mapPath)), manifest.gil.sha256);
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    const generated = ['simulated-run.log', 'frames.json', 'resource-report.json', 'domain-replay.txt'];
    for (const name of generated) fs.copyFileSync(path.join(workspace, name), path.join(packageDir, name));
    const evidenceForPackage = {
      ...report,
      gil: { ...report.gil, mapPath: mapFile },
      simulation: { ...report.simulation, framesPath: 'frames.json' },
    };
    fs.writeFileSync(path.join(packageDir, 'evidence.json'), JSON.stringify(evidenceForPackage, null, 2) + '\n');
    fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(packageDir, 'MCP-FIXTURE-LICENSE.txt'));
    const acceptanceDoc = release ? 'platform/M4.md' : 'platform/M1.md';
    fs.copyFileSync(path.join(projectRoot, acceptanceDoc), path.join(packageDir, 'device-acceptance.md'));
    const acceptanceDir = path.join(packageDir, 'acceptance-input');
    fs.mkdirSync(acceptanceDir);
    const inputs = {
      'm1-replay.lua': replayScript,
      'm1-input.lua': fileURLToPath(new URL('./m1-input.lua', import.meta.url)),
      'control-paths.tsv': path.join(workspace, 'control-paths.tsv'),
      'readback.lua': path.join(workspace, `${nativeRun.script}.lua`),
    };
    for (const [name, inputPath] of Object.entries(inputs)) {
      fs.copyFileSync(inputPath, path.join(acceptanceDir, name));
    }
    const title = release ? 'M4 六阶单人练习' : 'M1 单人练习';
    const guide = `# 小动物自走棋 ${title}千星候选\n\n游戏提交 \`${sourceRevision}\`。\n\n` +
      `运行 \`sha256sum -c SHA256SUMS\` 校验文件。设备验收步骤见 [device-acceptance.md](device-acceptance.md)。\n\n` +
      `用 Lua 5.3 复验回读快照和事件。\n\n` +
      `\`\`\`sh\nlua5.3 -E acceptance-input/m1-replay.lua bundle acceptance-input/readback.lua ${profile} > replay-check.txt\n` +
      `cmp domain-replay.txt replay-check.txt\n` +
      `for device in pc mobile; do\n` +
      `  lua5.3 -E acceptance-input/m1-input.lua acceptance-input/readback.lua acceptance-input/control-paths.tsv ${seed} "input-frames-$device.tsv" "$device" ${profile}\n` +
      `done\n` +
      `cmp input-frames-pc.tsv input-frames-mobile.tsv\n\`\`\`\n`;
    fs.writeFileSync(path.join(packageDir, 'README.md'), guide);
    const files = [mapFile, 'manifest.json', 'README.md', 'device-acceptance.md', 'evidence.json',
      'MCP-FIXTURE-LICENSE.txt', ...generated, ...Object.keys(inputs).map(name => `acceptance-input/${name}`)];
    fs.writeFileSync(path.join(packageDir, 'SHA256SUMS'), files.map(name =>
      `${sha256(fs.readFileSync(path.join(packageDir, name)))}  ${name}\n`).join(''));
  } catch (error) {
    fs.rmSync(packageDir, { recursive: true, force: true });
    throw error;
  }
  console.log(`Device candidate: ${packageDir}`);
}
