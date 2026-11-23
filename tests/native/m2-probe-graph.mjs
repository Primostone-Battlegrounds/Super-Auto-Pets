import assert from 'node:assert/strict';
import vm from 'node:vm';

export function verifyGraph(graphSource, buttonSource, buttons, ts) {
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
  function load(source, graphRuntime) {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(transpiled, { exports: {}, require: () => graphRuntime });
  }
  load(graphSource, runtime);
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

  players.splice(1);
  playerState.A = {};
  playerState.B = {};
  logs.length = 0;
  load(graphSource, runtime);
  const nativeLogs = [];
  const playerIds = { A: 1n, B: 2n };
  let onPress;
  load(buttonSource, {
    defineSignal: name => name,
    g: { server() { return { on(event, handler) {
      assert.equal(event, 'whenUiControlGroupIsTriggered');
      onPress = handler;
    } }; } },
  });
  function press(source, index) {
    let messages = [];
    onPress({ eventSourceGuid: source, uiControlGroupIndex: index }, {
      getPlayerIdByPlayerGuid: guid => playerIds[guid],
      dataTypeConversion: value => String(value),
      printString: message => nativeLogs.push(message),
      sendSignal: (signal, action, round) => {
        assert.equal(signal, 'AP_DuelRequest');
        messages = request(source, action, round);
      },
    });
    return messages;
  }
  const [refresh, readyFirstRound, continueFirstRound, readySecondRound] = buttons.map(({ id }) => BigInt(id));
  assert.deepEqual(press('A', 0n), []);
  assert.deepEqual(nativeLogs, []);
  assert.deepEqual(press('A', refresh), [view('A', 1n, 1n, 1n, 0n, false, false, 0n, 1n)]);
  players.push('B');
  press('A', readySecondRound);
  assert.equal(playerState.A.AP_readyRound, undefined);
  press('A', readyFirstRound);
  press('A', readyFirstRound);
  assert.deepEqual(press('B', readyFirstRound), [
    view('A', 2n, 1n, 1n, 1n, true, false, 1n, 5n),
    view('B', 2n, 2n, 1n, 1n, true, false, 1n, 5n),
  ]);
  press('B', continueFirstRound);
  press('B', continueFirstRound);
  press('A', continueFirstRound);
  press('A', readyFirstRound);
  assert.equal(playerState.A.AP_readyRound, 1n);
  press('B', readySecondRound);
  press('A', readySecondRound);
  press('A', readySecondRound);
  assert.equal(variables.round, 2n);
  assert.equal(variables.phase, 2n);
  assert.equal(variables.settlements, 2n);
  assert.deepEqual(logs, ['AUTO_PETS_M2 settled', '1', 'AUTO_PETS_M2 settled', '2']);
  assert.ok(nativeLogs.some((line, i) => line === 'AUTO_PETS_M2 native_input' && nativeLogs[i + 1] === '2'));
  return 'Lua 信号与原生按钮分别模拟双人准备、重复和过期请求、两轮各结算一次';
}
