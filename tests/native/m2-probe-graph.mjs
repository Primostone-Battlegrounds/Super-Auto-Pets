import assert from 'node:assert/strict';
import vm from 'node:vm';

export function verifyGraph(graphSource, ts) {
  const players = ['A'];
  const playerState = { A: {}, B: {} };
  const logs = [];
  let variables, handler;
  let updates = [];
  const flow = {
    getListOfPlayerEntitiesOnTheField: () => players,
    equal: (left, right) => left === right,
    get: name => variables[name],
    set: (name, value) => { variables[name] = value; },
    setCustomVariable: (player, name, value) => { playerState[player][name] = value; },
    getCustomVariable: (player, name) => ({ asType: () => playerState[player][name] ?? 0n }),
    getListLength: list => BigInt(list.length),
    dataTypeConversion: value => String(value),
    printString: line => logs.push(line),
    sendSignal: (signal, target, ...values) => { updates.push([signal, target, ...values]); },
  };
  const runtime = {
    defineSignal: name => name,
    g: {
      server(options) {
        variables = { ...options.variables };
        return { onSignal(signal, onRequest) {
          assert.equal(signal, 'AP_DuelRequest');
          handler = onRequest;
        } };
      },
    },
  };
  const transpiled = ts.transpileModule(graphSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(transpiled, { exports: {}, require: () => runtime });
  const request = (source, action, round) => {
    updates = [];
    handler({ signalSourceEntity: source, params: { action, round } }, flow);
    return updates;
  };
  const view = (target, count, seat, round, phase, ready, continued, settlements, version) =>
    ['client:AP_DuelSnapshot', target, count, seat, round, phase, ready, continued, settlements, version];

  assert.deepEqual(request('A', 0n, 0n), [view('A', 1n, 1n, 1n, 0n, false, false, 0n, 1n)]);
  assert.deepEqual(request('A', 1n, 1n), [view('A', 1n, 1n, 1n, 0n, false, false, 0n, 2n)]);
  players.push('B');
  assert.deepEqual(request(null, 1n, 1n), []);
  assert.deepEqual(request('A', 1n, 1n), [
    view('A', 2n, 1n, 1n, 0n, true, false, 0n, 3n),
    view('B', 2n, 2n, 1n, 0n, false, false, 0n, 3n),
  ]);
  request('A', 1n, 1n);
  assert.equal(variables.settlements, 0n);
  assert.deepEqual(request('B', 1n, 1n), [
    view('A', 2n, 1n, 1n, 1n, true, false, 1n, 5n),
    view('B', 2n, 2n, 1n, 1n, true, false, 1n, 5n),
  ]);
  request('B', 1n, 1n);
  request('B', 2n, 1n);
  request('B', 2n, 1n);
  assert.equal(variables.round, 1n);
  assert.deepEqual(request('A', 2n, 1n), [
    view('A', 2n, 1n, 2n, 0n, false, false, 1n, 9n),
    view('B', 2n, 2n, 2n, 0n, false, false, 1n, 9n),
  ]);
  request('A', 1n, 1n);
  assert.equal(playerState.A.AP_readyRound, 1n);
  request('B', 1n, 2n);
  request('A', 1n, 2n);
  request('B', 1n, 2n);
  assert.equal(variables.phase, 2n);
  assert.equal(variables.settlements, 2n);
  assert.deepEqual(logs, [
    'AUTO_PETS_M2 missing_player_source',
    'AUTO_PETS_M2 settled', '1',
    'AUTO_PETS_M2 settled', '2',
  ]);
  return '两名玩家分别准备、重复请求、过期轮次、两轮各结算一次';
}
