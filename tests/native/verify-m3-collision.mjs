import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { lowerDamage } from '../../platform/m3_collision_lower.mjs';

const [checkoutArg, scratch, lua, outputArg] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua,
  'Usage: node tests/native/verify-m3-collision.mjs <MCP checkout> <scratch> <Lua 5.3> [new candidate directory]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const checkout = fs.realpathSync(checkoutArg);
const revision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(revision, '59c576e41632a6bf6781bbca83a676d0da0374ec', 'Use the pinned Miliastra MCP revision');
const readTool = module => import(pathToFileURL(path.join(checkout, 'src', module)).href);
const requireTool = createRequire(path.join(checkout, 'package.json'));
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceRevision = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = path.join(checkout, 'tests', 'fixtures', 'editor-2026-10-26-shapes.gil');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'm3-collision-probe-'));
const input = path.join(workspace, 'input.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const candidate = outputArg ? path.resolve(outputArg) : path.join(workspace, 'candidate');
assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');

const battleSource = fs.readFileSync(new URL('../../src/autopets/battle.lua', import.meta.url), 'utf8');
const { statements, strikeLimit } = lowerDamage(battleSource, requireTool('luaparse').parse);
const template = fs.readFileSync(new URL('../../platform/m3_collision.ts', import.meta.url), 'utf8');
const lua54 = process.env.LUA54 || 'lua5.4';
const versions = [lua, lua54].map(binary => execFileSync(binary, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim());
assert.match(versions[0], /^Lua 5\.3\./);
assert.match(versions[1], /^Lua 5\.4\./);
const readOracle = (binary, mode) => execFileSync(binary, ['-E', 'tests/native/m3-collision-oracle.lua', mode], {
  cwd: project, timeout: 30_000, encoding: 'utf8',
});

function parityFixture(mode) {
  const trace = readOracle(lua, mode);
  assert.equal(trace, readOracle(lua54, mode), 'Lua oracle exports differ');
  const pairs = [];
  for (const row of trace.trimEnd().split('\n')) {
    const [kind, ...fields] = row.split('\t');
    const [pair, ...values] = fields.map(Number);
    assert.ok(fields.length && [pair, ...values].every(Number.isSafeInteger));
    if (kind === 'pair') {
      const [attackA, healthA, shieldA, attackB, healthB, shieldB, outcome, strikes] = values;
      assert.equal(pair, pairs.length + 1);
      assert.ok([attackA, healthA, shieldA, attackB, healthB, shieldB].every(value => value > 0));
      assert.ok(outcome >= 1 && outcome <= 4 && strikes > 0 && strikes <= strikeLimit);
      pairs.push({ attacks: [attackA, attackB], health: [healthA, healthB], shields: [shieldA, shieldB],
        outcome, strikes, steps: [] });
    } else {
      assert.equal(kind, 'step');
      const [strike, ...step] = values;
      const list = pairs[pair - 1].steps;
      assert.equal(strike, list.length + 1);
      assert.equal(step.length, 6);
      list.push(step);
    }
  }
  assert.equal(pairs.length, 4);
  for (const pair of pairs) assert.equal(pair.steps.length, pair.strikes);
  return { pairs, oracleSha256: sha256(trace) };
}

function graphSource(graphId, { pairs }) {
  let code = template.replace('id: 1073741825,', `id: ${graphId},`)
    .replace('0n; // AP_STRIKE_LIMIT', `${strikeLimit}n;`)
    .replace('// AP_LOWERED_DAMAGE', statements);
  for (const field of ['attacks', 'shields', 'health']) {
    const values = pairs.flatMap(pair => pair[field]).map(value => value + 'n');
    code = code.replace(`[0n]), // AP_PROBE_${field.toUpperCase()}`, `[${values.join(', ')}]),`);
  }
  assert.ok(!code.includes('// AP_'));
  return code;
}

function simulate(source, { pairs }) {
  const ts = requireTool('typescript');
  const executable = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const events = new Map();
  let variables;
  const graph = {
    on(name, handler) { events.set(name, handler); return graph; },
  };
  const runtime = { g: { server(options) { variables = options.variables; return graph; } } };
  vm.runInNewContext(executable, {
    exports: {}, require: () => runtime, list: (_, values) => Array.from(values),
  });

  let now = 0n;
  let starts = 0;
  let stops = 0;
  let calls = 0;
  let maxCalls = 0;
  const logs = [];
  const stage = Symbol('stage');
  const clock = 'AP_CollisionProbe';
  const flow = new Proxy({
    startTimer: (target, name, repeat, intervals) => {
      assert.equal(target, stage);
      assert.equal(name, clock);
      assert.equal(repeat, true);
      assert.deepEqual(Array.from(intervals), [1]);
      starts += 1;
    },
    stopTimer: (target, name) => { assert.equal(target, stage); assert.equal(name, clock); stops += 1; },
    printString: value => { logs.push(value); },
    queryGameTimeElapsed: () => now,
    get: name => variables[name],
    set: (name, value) => { variables[name] = value; },
    getCorrespondingValueFromList: (list, index) => {
      assert.ok(index >= 0n && index < list.length);
      return list[Number(index)];
    },
    modifyValueInList: (list, index, value) => {
      assert.ok(index >= 0n && index < list.length);
      list[Number(index)] = value;
    },
    copyList: values => Array.from(values),
    dataTypeConversion: value => String(value),
    takeSmallerValue: (a, b) => a < b ? a : b,
    takeLargerValue: (a, b) => a > b ? a : b,
  }, {
    get: (target, property) => (...args) => { calls += 1; return target[property](...args); },
  });
  events.get('whenEntityIsCreated')({ eventSourceEntity: stage }, flow);
  assert.equal(starts, 1);
  const timer = events.get('whenTimerIsTriggered');
  function tick(name = clock) {
    calls = 0;
    timer({ eventSourceEntity: stage, timerName: name }, flow);
    maxCalls = Math.max(calls, maxCalls);
  }
  for (let elapsed = 1; elapsed <= strikeLimit * pairs.length && stops === 0; elapsed += 1) {
    now = BigInt(elapsed);
    const logStart = logs.length;
    tick('other clock');
    assert.equal(logs.length, logStart);
    tick();
    const logEnd = logs.length;
    tick();
    assert.equal(logs.length, logEnd, 'Duplicate timer event did not repeat a hit');
  }
  assert.equal(stops, 1);
  const messages = logs.slice(1);
  assert.equal(logs[0], 'AUTO_PETS_COLLISION_PROBE start');
  assert.equal(messages.pop(), 'AUTO_PETS_COLLISION_PROBE done');
  const seen = Array.from({ length: pairs.length }, () => ({ steps: [] }));
  while (messages.length) {
    const kind = messages.shift();
    const pair = Number(messages.shift());
    assert.ok(pair >= 1 && pair <= pairs.length);
    const result = seen[pair - 1];
    if (kind === 'AUTO_PETS_COLLISION_PROBE pair_strike') {
      const strike = Number(messages.shift());
      assert.equal(strike, result.steps.length + 1);
      result.steps.push(messages.splice(0, 6).map(Number));
    } else {
      assert.equal(kind, 'AUTO_PETS_COLLISION_PROBE pair_outcome');
      assert.ok(!result.outcome);
      result.outcome = Number(messages.shift());
    }
  }
  assert.deepEqual(seen, pairs.map(({ steps, outcome }) => ({ steps, outcome })));
  return { timerSeconds: Number(now), steps: seen.reduce((sum, pair) => sum + pair.steps.length, 0), maxCalls };
}

const [{ Service }, { addGraph, setPlayerCount, listRespawnPoints, listComponents }, { toolRegistry }] = await Promise.all([
  readTool('core.mjs'), readTool('scene-save.mjs'), readTool('tool-registry.mjs'),
]);
const service = new Service({ workspace, saveRoots: [], allowLive: false });
const config = setPlayerCount({ mapPath: input, min: 1, max: 1 }, workspace);
const graph = addGraph({ mapPath: config.mapPath, name: 'AP_CollisionProbe', attachTo: 'stage' }, workspace);
const baseline = parityFixture('normal');
const limit = parityFixture('limit');
assert.deepEqual(new Set(baseline.pairs.map(pair => pair.outcome)), new Set([1, 2, 3]));
assert.equal(limit.pairs[3].outcome, 4);
assert.equal(limit.pairs[3].strikes, strikeLimit);
const source = graphSource(graph.graphId, baseline);
const graphSimulation = simulate(source, baseline);
const limitSimulation = simulate(graphSource(graph.graphId, limit), limit);
const graphs = [{ graphId: graph.graphId, code: source }];
const writeGraphs = toolRegistry(service).find(tool => tool.name === 'write_graphs');
const written = await writeGraphs.method(writeGraphs.schema.parse({ mapPath: graph.mapPath, graphs }));
assert.equal(written.failed, undefined, JSON.stringify(written));
const mapPath = fs.realpathSync(written.mapPath);
assert.ok(mapPath.startsWith(workspace + path.sep));
const { players } = listRespawnPoints({ mapPath });
assert.deepEqual(players, { min: 1, max: 1 });
const attachments = listComponents({ mapPath, entity: 'stage' }).found.find(component => component.where === 'placed');
assert.ok(attachments?.graphs.includes(graph.graphId));
const inspected = service.inspectMap({ mapPath });
const native = inspected.graphs.find(({ id }) => id === graph.graphId);
assert.ok(native.nodeCount > 0 && native.editorCount < 3000);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
assert.equal(sha256(fs.readFileSync(input)), fixtureHash);

const gil = 'm3-collision-probe.gil';
fs.mkdirSync(candidate);
fs.copyFileSync(mapPath, path.join(candidate, gil), fs.constants.COPYFILE_EXCL);
fs.copyFileSync(new URL('../../platform/M3-collision.md', import.meta.url), path.join(candidate, 'README.md'));
fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, 'MCP-FIXTURE-LICENSE.txt'));
fs.writeFileSync(path.join(candidate, 'evidence.json'), JSON.stringify({
  sourceRevision, revision, fixtureHash, players, luaVersions: versions, sha256: inspected.sha256, graph: native,
  battleSourceSha256: sha256(battleSource), graphSourceSha256: sha256(source), strikeLimit,
  parity: { baseline, graphSimulation, limitOracleSha256: limit.oracleSha256, limitSimulation },
  officialClient: 'pending',
}, null, 2) + '\n');
const packageFiles = [gil, 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
const checksums = packageFiles.map(name => `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`);
fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), checksums.join('\n') + '\n');
console.log(`Candidate: ${path.join(candidate, gil)} (${native.nodeCount} nodes, ${native.editorCount} weighted)`);
