import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { lowerCombatMath } from '../../platform/m3_collision_lower.mjs';

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
const { damageCode, buffCode, summonCode, strikeLimit } = lowerCombatMath(battleSource, requireTool('luaparse').parse);
const template = fs.readFileSync(new URL('../../platform/m3_collision.ts', import.meta.url), 'utf8');
const lua54 = process.env.LUA54 || 'lua5.4';
const versions = [lua, lua54].map(binary => execFileSync(binary, ['-E', '-v'], { encoding: 'utf8', timeout: 10_000 }).trim());
assert.match(versions[0], /^Lua 5\.3\./);
assert.match(versions[1], /^Lua 5\.4\./);
const readOracle = (binary, mode) => execFileSync(binary, ['-E', 'tests/native/m3-collision-oracle.lua', mode], {
  cwd: project, timeout: 30_000, encoding: 'utf8',
});

const slots = 5;
const unitFields = 6;
const eventSizes = { damage: 4, faint: 2, buff: 2, summon: 4 };

function readBoard(fields) {
  let cursor = 0;
  const board = Array.from({ length: 2 }, () => {
    const size = fields[cursor++];
    assert.ok(Number.isInteger(size) && size >= 0 && size <= slots);
    return Array.from({ length: size }, () => {
      const unit = fields.slice(cursor, cursor + unitFields);
      cursor += unitFields;
      assert.equal(unit.length, unitFields);
      assert.ok(unit.every(value => Number.isInteger(value) && value >= 0 && value <= 2147483647));
      return unit;
    });
  });
  assert.equal(cursor, fields.length);
  return board;
}

function parityFixture(mode) {
  const trace = readOracle(lua, mode);
  assert.equal(trace, readOracle(lua54, mode), 'Lua oracle exports differ');
  const pairs = [];
  const catalog = [];
  for (const row of trace.trimEnd().split('\n')) {
    const [kind, key, ...fields] = row.split('\t');
    const pair = Number(key);
    assert.ok(Number.isSafeInteger(pair));
    if (kind === 'definition') {
      assert.equal(pair, catalog.length + 1);
      const [id, ...record] = fields;
      assert.match(id, /^[a-z0-9_]+$/);
      assert.ok(record.length === 5 && record.map(Number).every(Number.isSafeInteger));
      catalog.push({ id, record: record.map(Number) });
      continue;
    }
    if (kind === 'pair') {
      const [outcome, strikes, first, ...opening] = fields.map(Number);
      assert.ok(opening.every(Number.isSafeInteger));
      assert.equal(pair, pairs.length + 1);
      assert.ok(outcome >= 1 && outcome <= 4 && strikes > 0 && strikes <= strikeLimit);
      assert.ok(first === 0 || first === 1);
      pairs.push({ opening: readBoard(opening), first, outcome, strikes, steps: [] });
      continue;
    }
    const [strike, ...payload] = fields;
    const list = pairs[pair - 1].steps;
    const step = list[Number(strike) - 1] ?? { events: [] };
    assert.equal(Number(strike), list.length + (list.at(-1) === step ? 0 : 1));
    if (kind === 'event') {
      const [action, ...values] = payload;
      assert.equal(values.length, eventSizes[action]);
      assert.ok(values.map(Number).every(Number.isSafeInteger));
      step.events.push([action, ...values.map(Number)]);
    } else {
      assert.equal(kind, 'board');
      assert.ok(!step.board);
      step.board = readBoard(payload.map(Number));
    }
    list[Number(strike) - 1] = step;
  }
  assert.equal(pairs.length, 4);
  for (const pair of pairs) assert.equal(pair.steps.length, pair.strikes);
  return { catalog, pairs, oracleSha256: sha256(trace) };
}

function graphSource(graphId, { catalog, pairs }) {
  let code = template.replace('id: 1073741825,', `id: ${graphId},`)
    .replace('0n; // AP_STRIKE_LIMIT', `${strikeLimit}n;`)
    .replace('// AP_LOWERED_DAMAGE', damageCode)
    .replace('// AP_LOWERED_BUFF', buffCode)
    .replace('// AP_LOWERED_SUMMON', summonCode);
  const seeds = {
    counts: pairs.flatMap(pair => pair.opening.map(side => side.length)),
    firsts: pairs.map(pair => pair.first),
    catalog: catalog.flatMap(definition => definition.record),
  };
  for (const [index, pair] of pairs.entries()) {
    seeds['board' + index] = pair.opening.flatMap(side => {
      const cells = side.flat();
      return cells.concat(new Array(slots * unitFields - cells.length).fill(0));
    });
  }
  for (const [field, data] of Object.entries(seeds)) {
    const values = data.map(value => value + 'n');
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
    assemblyList: values => Array.from(values),
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
  const seen = Array.from({ length: pairs.length }, () => ({ steps: [] }));
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
    if (logEnd !== logStart) {
      const logsOnTick = logs.slice(logStart);
      assert.equal(logsOnTick.shift(), 'AUTO_PETS_COLLISION_PROBE strike');
      const pair = Number(logsOnTick.shift()) - 1;
      const strike = Number(logsOnTick.shift());
      assert.ok(pair >= 0 && pair < pairs.length);
      const result = seen[pair];
      assert.equal(strike, result.steps.length + 1);
      const board = Array.from({ length: 2 }, (_, side) => {
        const index = pair * 2 + side;
        const head = Number(variables.heads[index]);
        const size = Number(variables.counts[index]);
        return Array.from({ length: size }, (_, slot) => {
          const base = (side * slots + (head + slot) % slots) * unitFields;
          return variables['board' + pair].slice(base, base + unitFields).map(Number);
        });
      });
      const step = { events: [], board };
      result.steps.push(step);
      while (logsOnTick.length) {
        const kind = logsOnTick.shift();
        if (kind === 'AUTO_PETS_COLLISION_PROBE outcome') {
          assert.equal(Number(logsOnTick.shift()), pair + 1);
          assert.ok(!result.outcome);
          result.outcome = Number(logsOnTick.shift());
        } else if (kind === 'AUTO_PETS_COLLISION_PROBE done') {
          assert.equal(stops, 1);
        } else {
          const size = eventSizes[kind];
          assert.ok(size && size <= logsOnTick.length, `Unrecognized event: ${kind}`);
          step.events.push([kind, ...logsOnTick.splice(0, size).map(Number)]);
        }
      }
    }
    tick();
    assert.equal(logs.length, logEnd, 'Duplicate timer event did not repeat a hit');
  }
  assert.equal(stops, 1);
  assert.equal(logs[0], 'AUTO_PETS_COLLISION_PROBE start');
  assert.equal(logs.at(-1), 'AUTO_PETS_COLLISION_PROBE done');
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
assert.deepEqual(new Set(baseline.pairs.flatMap(pair => pair.steps.flatMap(step => step.events.map(([kind]) => kind)))),
  new Set(Object.keys(eventSizes)));
assert.equal(baseline.pairs[0].opening[0].length, slots);
assert.equal(baseline.pairs[0].opening[1].length, slots);
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
