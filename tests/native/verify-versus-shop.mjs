import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { nativeShop, shopExport } from '../../platform/versus-shop.mjs';
import { shopFlow, verifyShop } from './versus-shop-parity.mjs';

const [checkoutArg, scratch, lua, outputArg, profile = 'compatibility'] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua && outputArg,
  'Usage: node tests/native/verify-versus-shop.mjs <MCP checkout> <scratch> <Lua 5.3> <new candidate directory> [release]');
assert.ok(profile === 'compatibility' || profile === 'release');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const candidate = path.resolve(outputArg);
assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');
const checkout = fs.realpathSync(checkoutArg);
const lua54 = process.env.LUA54 || 'lua5.4';
assert.match(execFileSync(lua, ['-E', '-v'], { encoding: 'utf8' }), /^Lua 5\.3\./);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, '59c576e41632a6bf6781bbca83a676d0da0374ec', 'Use the pinned Miliastra MCP revision');
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceRevision = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const projectRequire = createRequire(path.join(checkout, 'package.json'));
const ts = projectRequire('typescript');
const { Client } = projectRequire('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = projectRequire('@modelcontextprotocol/sdk/client/stdio.js');
const shop = nativeShop(lua, lua54, profile);
assert.equal(shop.rules.MAX_TIER, profile === 'release' ? 6 : 3);
const graphParity = verifyShop(ts, shop.source, lua, lua54, profile);
const trace = shopExport(lua, 'trace', profile);
const fixture = trace.split('\ninit\t', 1)[0].split('\n');
const packed = fixture[0].split('\t').slice(1).map(BigInt);
if (profile === 'release') assert.equal(packed[1], 6n);
const script = fixture.slice(1).map(line => {
  const [kind, ...values] = line.split('\t');
  const fields = values.map(BigInt);
  const [action, from, to, flag, accepted, ...state] = kind === 'open'
    ? [0n, 0n, 0n, 0n, 1n, ...fields] : fields;
  const modulus = 524287n;
  const digest = state.reduce((current, value) => (current * 31n + (value % modulus + modulus) % modulus) % modulus, 1n);
  return { command: [action, from, to, flag, accepted, digest], state };
});
assert.ok(script.length > 4);
const bigintList = values => `[${values.map(value => `${value}n`).join(', ')}]`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const base = path.join(checkout, 'tests', 'fixtures', 'editor-2026-10-26-shapes.gil');
const fixtureSha256 = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(base)), fixtureSha256);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'versus-shop-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(base, input, fs.constants.COPYFILE_EXCL);
const client = new Client({ name: 'auto-pets-versus-shop-proof', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(checkout, 'src/server.mjs')], cwd: checkout, stderr: 'inherit',
  env: { LOCALAPPDATA: workspace, MILIASTRA_SAVE_ROOTS: '[]', MILIASTRA_WORKSPACE: workspace, MILIASTRA_ALLOW_LIVE_WRITE: '0' },
});
let mapPath = input;
async function call(name, args = {}) {
  const parameters = name === 'get_capabilities' ? args : { mapPath, ...args };
  const response = await client.callTool({ name, arguments: parameters }, undefined, { timeout: 120_000 });
  const result = response.structuredContent ?? JSON.parse(response.content[0].text);
  assert.ok(!response.isError && !result.failed, `${name}: ${JSON.stringify(result)}`);
  if (result.mapPath) {
    mapPath = fs.realpathSync(result.mapPath);
    assert.ok(mapPath.startsWith(workspace + path.sep), 'MCP output escaped the isolated workspace');
  }
  return result;
}

try {
  await client.connect(transport);
  const capabilities = await call('get_capabilities');
  assert.equal(capabilities.workspace, workspace);
  assert.deepEqual(capabilities.saveRoots, []);
  assert.equal(capabilities.liveWriteEnabled, false);
  await call('scene_set_player_count', { min: 1, max: 1 });
  const { graphId } = await call('scene_add_graph', { name: 'AP_VersusShopProof', attachTo: 'stage' });
  const probe = fs.readFileSync(new URL('../../platform/versus_shop_probe.ts', import.meta.url), 'utf8')
    .replace('id: 1073741825,', `id: ${graphId},`)
    .replace('0n; // AP_SHOP_PROBE_COUNT', `${script.length}n;`)
    .replace('state: [0n]', `state: ${bigintList(packed)}`)
    .replace(' // AP_SHOP_PROBE_START', '')
    .replace("[0n], 'int'); // AP_SHOP_PROBE_PROGRAM", `${bigintList(script.flatMap(step => step.command))}, 'int');`);
  assert.doesNotMatch(probe, /AP_SHOP_PROBE_/);
  const source = `import { g } from 'genshin-ts/runtime/core';\n${shop.source}\n${probe}`;
  const compiled = await call('write_graphs', { graphs: [{ graphId, code: source }] });
  const inspect = await call('inspect_map');
  const graph = inspect.graphs.find(entry => entry.id === graphId);
  assert.ok(graph?.nodeCount > 0 && graph.editorCount < 3000);
  assert.deepEqual(compiled.written[0].warnings, []);
  const stage = await call('scene_list_components', { entity: 'stage' });
  assert.ok(stage.found.some(component => component.where === 'placed' && component.graphs.includes(graphId)));
  const { players } = await call('scene_list_respawn_points');
  assert.deepEqual(players, { min: 1, max: 1 });

  // Execute the same generated node sources in a bounded stub before packaging.
  const events = new Map();
  let state;
  let active = false;
  const logs = [];
  const runtime = { g: { server({ variables }) {
    state = { ...variables };
    return { on(name, handler) { events.set(name, handler); return this; } };
  } } };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: {}, require: () => runtime });
  const flow = {
    ...shopFlow,
    printString: message => logs.push(message),
    dataTypeConversion: value => String(value),
    getSelfEntity: () => 'stage',
    startTimer(target, name, repeat, delays) {
      assert.equal(target, 'stage');
      assert.equal(name, 'AP_ShopProofClock');
      assert.ok(repeat);
      assert.deepEqual(Array.from(delays), [1]);
      active = true;
    },
    stopTimer(target, name) {
      assert.equal(target, 'stage');
      assert.equal(name, 'AP_ShopProofClock');
      active = false;
    },
    get: name => state[name],
    set: (name, value) => { state[name] = value; },
  };
  events.get('whenEntityIsCreated')({ eventSourceEntity: 'stage' }, flow);
  let ticks = 0;
  while (active && ticks < 100) {
    ticks += 1;
    events.get('whenTimerIsTriggered')({ timerName: 'AP_ShopProofClock' }, flow);
  }
  assert.ok(!active && ticks < 100);
  assert.deepEqual(logs.slice(-3), ['AUTO_PETS_SHOP confirmed_step', String(script.length), 'AUTO_PETS_SHOP verified']);
  assert.ok(!logs.some(line => line.includes('mismatch')));
  assert.equal(sha256(fs.readFileSync(input)), fixtureSha256);
  assert.equal(sha256(fs.readFileSync(mapPath)), inspect.sha256);

  fs.mkdirSync(candidate);
  const name = profile === 'release' ? 'versus-shop-release-proof.gil' : 'versus-shop-proof.gil';
  const gil = path.join(candidate, name);
  fs.copyFileSync(mapPath, gil);
  fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, 'MCP-FIXTURE-LICENSE.txt'));
  fs.copyFileSync(new URL('../../platform/VERSUS-SHOP.md', import.meta.url), path.join(candidate, 'README.md'));
  fs.writeFileSync(path.join(candidate, 'evidence.json'), `${JSON.stringify({
    sourceRevision, revision, graph, players, profile, fixtureSha256, sha256: inspect.sha256, graphParity,
    catalogSha256: sha256(shop.definition), sourceSha256: sha256(source), traceSha256: sha256(trace),
    probe: { steps: script.length, ticks, logs }, officialClient: 'pending',
  }, null, 2)}\n`);
  const files = [name, 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
  fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), `${files.map(name =>
    `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`).join('\n')}\n`);
  console.log(`Versus shop parity ${JSON.stringify(graphParity)}. Candidate ${gil}`);
} finally {
  await client.close();
}
