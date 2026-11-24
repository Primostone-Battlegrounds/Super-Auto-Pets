import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { nativeBattle } from '../../platform/m3-battle-opening.mjs';
import { nativeShop } from '../../platform/versus-shop.mjs';

const [checkoutArg, scratch, lua53, lua54, outputArg, profile = 'compatibility'] = process.argv.slice(2);
assert.ok(checkoutArg && scratch && lua53 && lua54,
  'Usage: node tests/native/verify-m3-opening.mjs <MCP checkout> <scratch> <Lua 5.3> <Lua 5.4> [new candidate directory] [profile]');
assert.equal(process.env.MILIASTRA_ALLOW_LIVE_WRITE, '0');
const candidate = outputArg && path.resolve(outputArg);
if (candidate) assert.ok(!fs.existsSync(candidate), 'Use a new candidate directory');
const checkout = fs.realpathSync(checkoutArg);
const toolRevision = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(toolRevision, '59c576e41632a6bf6781bbca83a676d0da0374ec');
const project = fileURLToPath(new URL('../../', import.meta.url));
const sourceRevision = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const load = createRequire(path.join(checkout, 'package.json'));
const readTool = name => import(pathToFileURL(path.join(checkout, 'src', name)).href);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = load('luaparse').parse;
const battle = nativeBattle(lua53, lua54, parse, profile);
const shop = nativeShop(lua53, lua54);
const kernel = [shop.source, battle.source].join('\n');

const oracle = lua => execFileSync(lua, ['-E', 'tests/native/m3-opening-oracle.lua', profile], {
  cwd: project, encoding: 'utf8', timeout: 10_000,
});
const expected = oracle(lua53);
assert.equal(expected, oracle(lua54));
const faintCatalog = [];
const fixtures = [];
let current;
for (const row of expected.trimEnd().split('\n')) {
  const [kind, ...fields] = row.split('\t');
  if (kind === 'def') faintCatalog.push(...fields.map(BigInt));
  else if (kind === 'case') {
    current = { seed: BigInt(fields[0]), events: [], strikes: [], strikeEvents: [] };
    fixtures.push(current);
  } else if (kind === 'event') {
    current.events.push([fields[0], ...fields.slice(1).map(BigInt)]);
  } else if (kind === 'input' || kind === 'board') current[kind] = fields.map(BigInt);
  else if (kind === 'strike_event') current.strikeEvents.push([fields[0], ...fields.slice(1).map(BigInt)]);
  else if (kind === 'strike') {
    current.strikes.push({ board: fields.map(BigInt), events: current.strikeEvents });
    current.strikeEvents = [];
  }
  else if (kind === 'outcome') current.outcome = BigInt(fields[0]);
  else assert.fail(kind);
}
assert.deepEqual(faintCatalog, battle.faintMetadata);
assert.equal(faintCatalog.length / 5, battle.openingMetadata.length / 3);
assert.equal(fixtures.length, profile === 'release' ? 339 : 329);

const ts = load('typescript');
const loader = ts.transpileModule(`${kernel}\nexports.open = gstsServerOpeningState; exports.step = gstsServerOpeningStep;\n`
  + `exports.collide = ${battle.collisionFunction}; exports.outcome = gstsServerBattleOutcome;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(loader, { exports });
function key(list, index) {
  assert.ok(index >= 0n && index < list.length, `list index ${index} of ${list.length}`);
  return Number(index);
}
const flow = {
  assemblyList: values => Array.from(values),
  getListLength: list => BigInt(list.length),
  getCorrespondingValueFromList: (list, index) => list[key(list, index)],
  modifyValueInList: (list, index, value) => { list[key(list, index)] = value; },
  removeValueFromList: (list, index) => { list.splice(key(list, index), 1); },
  insertValueIntoList: (list, index, value) => {
    assert.ok(index >= 0n && index <= list.length);
    list.splice(Number(index), 0, value);
  },
  takeSmallerValue: (a, b) => a < b ? a : b,
  takeLargerValue: (a, b) => a > b ? a : b,
  dataTypeConversion: String,
};
function active(board) {
  assert.equal(board.length, 66);
  const rows = [];
  for (let side = 0; side < 2; side += 1) {
    const size = Number(board[60 + side]);
    const head = Number(board[62 + side]);
    assert.ok(size >= 0 && size <= 5 && head >= 0 && head < 5);
    for (let slot = 0; slot < size; slot += 1) {
      const at = (side * 5 + (head + slot) % 5) * 6;
      rows.push(...board.slice(at, at + 6));
    }
  }
  return [...rows, ...board.slice(60, 62), ...board.slice(64)];
}
const eventKinds = new Set();
let examined = 0;
let peakCalls = 0;
let peakCollisionCalls = 0;
let checkedStrikes = 0;
let checkedStrikeEvents = 0;
const reactionKinds = new Set();
function eventsFromLog(log) {
  assert.equal(log.length % 5, 0);
  const actions = [];
  for (let index = 0; index < log.length; index += 5) {
    const [kind, ...fields] = log.slice(index, index + 5);
    actions.push([kind, ...fields.map(BigInt)]);
  }
  return actions;
}
for (const fixture of fixtures) {
  const board = fixture.input.slice();
  board[64] = -1n;
  const printed = [];
  let calls = 0;
  const tracked = new Proxy({ ...flow, printString: value => printed.push(value) }, {
    get: (state, key) => (...args) => { calls += 1; return state[key](...args); },
  });
  const state = exports.open(tracked, board, fixture.seed);
  let done = false;
  for (let step = 0; !done && step < 10; step += 1) {
    calls = 0;
    done = exports.step(tracked, board, faintCatalog, battle.openingMetadata, state, true);
    peakCalls = Math.max(peakCalls, calls);
  }
  assert.ok(done);
  assert.equal(board[62] + board[63] + board[65], 0n);
  assert.deepEqual(active(board), active(fixture.board));
  const actions = eventsFromLog(printed);
  for (const [kind] of actions) {
    eventKinds.add(kind);
    examined += 1;
  }
  assert.deepEqual(actions, fixture.events);
  if (fixture.outcome) {
    let outcome = exports.outcome(flow, board);
    for (const strike of fixture.strikes) {
      assert.equal(outcome, 0n);
      printed.length = 0;
      calls = 0;
      outcome = exports.collide(tracked, board, faintCatalog, battle.openingMetadata, state, true);
      peakCollisionCalls = Math.max(peakCollisionCalls, calls);
      assert.deepEqual(active(board), active(strike.board), `strike board, seed ${fixture.seed}`);
      const events = eventsFromLog(printed);
      assert.deepEqual(events, strike.events, `strike events, seed ${fixture.seed}`);
      for (const [kind, , , , effect] of events) {
        if (kind === 'skill' && effect >= 5n && effect <= 7n) reactionKinds.add(effect);
      }
      checkedStrikeEvents += events.length;
      checkedStrikes += 1;
    }
    assert.equal(outcome, fixture.outcome);
  }
}
assert.deepEqual(eventKinds, new Set(['skill', 'damage', 'shield', 'faint', 'buff', 'summon']));
if (profile === 'release') assert.deepEqual(reactionKinds, new Set([5n, 6n, 7n]));

const fixture = path.join(checkout, 'tests/fixtures/editor-2026-10-26-shapes.gil');
const fixtureHash = 'b8aa63c8e6c5c24964784842329a37adeb60d50c2f56272f6cc512907baf3706';
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
fs.mkdirSync(scratch, { recursive: true });
const workspace = fs.mkdtempSync(path.join(fs.realpathSync(scratch), 'native-opening-'));
const input = path.join(workspace, 'fixture.gil');
fs.copyFileSync(fixture, input, fs.constants.COPYFILE_EXCL);
const [{ Service }, { addGraph, setPlayerCount, listComponents, listRespawnPoints }, { toolRegistry }] = await Promise.all([
  readTool('core.mjs'), readTool('scene-save.mjs'), readTool('tool-registry.mjs'),
]);
const service = new Service({ workspace, saveRoots: [], allowLive: false });
const config = setPlayerCount({ mapPath: input, min: 1, max: 1 }, workspace);
const graph = addGraph({ mapPath: config.mapPath, name: 'AP_OpeningProbe', attachTo: 'stage' }, workspace);
const literal = values => '[' + values.map(value => value + 'n').join(', ') + ']';
const release = profile === 'release';
const probe = release ? fixtures.find(({ seed }) => seed === 31n) : fixtures[0];
const probeBoard = probe.input.slice();
probeBoard[64] = -1n;
const probeEvents = [...probe.events, ...probe.strikes.flatMap(strike => strike.events)];
if (release) {
  const effects = probeEvents.filter(([kind]) => kind === 'skill').map(([, , , , effect]) => effect);
  assert.ok([5n, 6n, 7n].every(effect => effects.includes(effect)));
}
const settle = release ? `
  if (f.get('colliding')) {
    const board = f.get('board');
    const opening = f.get('opening');
    const catalog = f.get('faint');
    const metadata = f.get('metadata');
    const outcome = ${battle.collisionFunction}(f, board, catalog, metadata, opening, true);
    f.set('board', board);
    f.set('opening', opening);
    if (outcome !== 0n) {
      f.printString('outcome');
      f.printString(f.dataTypeConversion(outcome, 'str'));
      f.set('finished', true);
      f.stopTimer(event.eventSourceEntity, 'AP_OpeningProbe');
    }
    return;
  }` : '';
const finishOpening = release ? "if (done) f.set('colliding', true);"
  : `if (done) {
    f.set('finished', true);
    f.stopTimer(event.eventSourceEntity, 'AP_OpeningProbe');
  }`;
const source = `import { g } from 'genshin-ts/runtime/core';
${kernel}
g.server({
  id: ${graph.graphId},
  name: '_GSTS_AP_OpeningProbe',
  variables: {
    board: ${literal(probeBoard)}, opening: [0n], finished: false,${release ? ' colliding: false,' : ''}
    faint: ${literal(faintCatalog)}, metadata: ${literal(battle.openingMetadata)},
  },
})
.on('whenEntityIsCreated', (event, f) => {
  const board = f.get('board');
  const opening = gstsServerOpeningState(f, board, ${probe.seed}n);
  f.set('opening', opening);
  f.set('board', board);
  f.startTimer(event.eventSourceEntity, 'AP_OpeningProbe', true, [1]);
})
.on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== 'AP_OpeningProbe' || f.get('finished')) return;${settle}
  const board = f.get('board');
  const opening = f.get('opening');
  const catalog = f.get('faint');
  const metadata = f.get('metadata');
  const done = gstsServerOpeningStep(f, board, catalog, metadata, opening, true);
  f.set('board', board);
  f.set('opening', opening);
  ${finishOpening}
});
`;
const handlers = new Map();
let variables;
const stage = {
  on(name, handler) {
    handlers.set(name, handler);
    return this;
  },
};
const probeLog = [];
let timerRunning = false;
const timerEvent = { eventSourceEntity: 1, timerName: 'AP_OpeningProbe' };
const probeFlow = {
  ...flow,
  get(key) {
    assert.ok(Object.hasOwn(variables, key), `unknown graph field ${key}`);
    return Array.isArray(variables[key]) ? [...variables[key]] : variables[key];
  },
  set(key, value) { variables[key] = value; },
  printString(value) { probeLog.push(value); },
  startTimer(entity, timerName, repeat, delays) {
    assert.equal(entity, timerEvent.eventSourceEntity);
    assert.equal(timerName, timerEvent.timerName);
    assert.equal(repeat, true);
    assert.deepEqual(Array.from(delays), [1]);
    assert.equal(timerRunning, false);
    timerRunning = true;
  },
  stopTimer(entity, timerName) {
    assert.equal(entity, timerEvent.eventSourceEntity);
    assert.equal(timerName, timerEvent.timerName);
    assert.equal(timerRunning, true);
    timerRunning = false;
  },
};
const probeModule = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(probeModule, {
  exports: {},
  require: name => {
    assert.equal(name, 'genshin-ts/runtime/core');
    return { g: { server: config => { variables = config.variables; return stage; } } };
  },
});
handlers.get('whenEntityIsCreated')(timerEvent, probeFlow);
const tick = handlers.get('whenTimerIsTriggered');
tick({ ...timerEvent, timerName: 'foreign' }, probeFlow);
assert.equal(probeLog.length, 0);
let probeTicks = 0;
while (timerRunning && probeTicks < battle.strikeLimit + 10) {
  tick(timerEvent, probeFlow);
  probeTicks += 1;
}
assert.equal(timerRunning, false);
tick(timerEvent, probeFlow);
const expectedLog = probeEvents.flatMap(event => event.map(String));
if (probe.outcome) expectedLog.push('outcome', String(probe.outcome));
assert.deepEqual(probeLog, expectedLog);
const finalBoard = probe.strikes.at(-1)?.board ?? probe.board;
assert.deepEqual(active(variables.board), active(finalBoard));

const tool = toolRegistry(service).find(entry => entry.name === 'write_graphs');
const result = await tool.method(tool.schema.parse({ mapPath: graph.mapPath, graphs: [{ graphId: graph.graphId, code: source }] }));
assert.equal(result.failed, undefined, JSON.stringify(result));
const mapPath = fs.realpathSync(result.mapPath);
assert.ok(mapPath.startsWith(workspace + path.sep));
const { players } = listRespawnPoints({ mapPath });
assert.deepEqual(players, { min: 1, max: 1 });
assert.ok(listComponents({ mapPath, entity: 'stage' }).found.some(entry => entry.graphs.includes(graph.graphId)));
const inspected = service.inspectMap({ mapPath });
const compiled = inspected.graphs.find(entry => entry.id === graph.graphId);
assert.ok(compiled.nodeCount > 0 && compiled.editorCount < 3000);
assert.equal(sha256(fs.readFileSync(fixture)), fixtureHash);
assert.equal(sha256(fs.readFileSync(input)), fixtureHash);
const evidence = {
  sourceRevision, toolRevision, fixtureHash, players, profile,
  fixtures: fixtures.length, examinedEvents: examined, checkedStrikes, checkedStrikeEvents,
  peakSimulatedCalls: peakCalls, peakCollisionCalls,
  probeSeed: String(probe.seed), probeTicks, probeEvents: probeEvents.map(event => event.map(String)),
  ...(probe.outcome ? { probeOutcome: String(probe.outcome) } : {}),
  oracleSha256: sha256(expected), sourceSha256: sha256(source), gilSha256: inspected.sha256,
  nativeNodes: compiled.nodeCount, editorNodes: compiled.editorCount, officialClient: 'pending',
};
if (candidate) {
  fs.mkdirSync(candidate);
  const files = ['m3-opening-probe.gil', 'README.md', 'MCP-FIXTURE-LICENSE.txt', 'evidence.json'];
  fs.copyFileSync(mapPath, path.join(candidate, files[0]), fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(new URL('../../platform/M3-opening.md', import.meta.url), path.join(candidate, files[1]));
  fs.copyFileSync(path.join(checkout, 'LICENSE'), path.join(candidate, files[2]));
  fs.writeFileSync(path.join(candidate, files[3]), JSON.stringify(evidence, null, 2) + '\n');
  const manifest = files.map(name => `${sha256(fs.readFileSync(path.join(candidate, name)))}  ${name}`).join('\n');
  fs.writeFileSync(path.join(candidate, 'SHA256SUMS'), manifest + '\n');
}
console.log(JSON.stringify({ ...evidence, mapPath: candidate ? path.join(candidate, 'm3-opening-probe.gil') : mapPath }, null, 2));
