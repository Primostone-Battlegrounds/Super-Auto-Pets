import assert from 'node:assert/strict';
import vm from 'node:vm';

export function verifyGraph(graphSource, buttonSource, registeredButtons, ts, marketFixture) {
  const { gold, price, teamSize, offerSlots, shelves } = marketFixture;
  const ids = new Map(registeredButtons.map(({ id, key }) => [Number(key), BigInt(id)]));
  assert.equal(ids.size, 6);
  assert.ok(gold >= price * offerSlots);
  const state = new Map();
  const views = new Map();
  const markets = new Map();
  const players = [];
  const playerIds = { A: 1n, B: 2n, C: 3n };
  const logs = [];
  let variables, handler, onPress;
  let events, updates, now, lastVersion;
  const getVariable = (player, name) => ({ asType: () => state.get(player)?.[name] ?? 0n });
  const flow = {
    getSelfEntity: () => 'stage',
    getListOfPlayerEntitiesOnTheField: () => players,
    equal: (left, right) => left === right,
    queryGameTimeElapsed: () => now,
    startTimer: (target, name, repeat, delays) => {
      assert.equal(target, 'stage');
      assert.equal(name, 'AP_DuelClock');
      assert.equal(repeat, true);
      assert.deepEqual(Array.from(delays), [1]);
    },
    get: name => variables[name],
    set: (name, value) => { variables[name] = value; },
    setCustomVariable: (player, name, value) => { state.get(player)[name] = value; },
    getCustomVariable: getVariable,
    assemblyList: list => Array.from(list),
    copyList: list => Array.from(list),
    modifyValueInList: (list, index, value) => {
      assert.ok(index >= 0n && index < list.length, 'list edit out of bounds');
      list[Number(index)] = value;
    },
    getCorrespondingValueFromList: (list, index) => {
      assert.ok(index >= 0n && index < list.length, 'list read out of bounds');
      return list[Number(index)];
    },
    getListLength: list => BigInt(list.length),
    dataTypeConversion: value => String(value),
    printString: line => logs.push(line),
    sendSignal(signal, target, ...values) {
      if (signal === 'AP_DuelRequest') {
        const [round, sequence, token] = values;
        handler({ signalSourceEntity: 'stage', params: { action: target, round, sequence, token } }, flow);
      } else {
        updates.push([signal, target, ...values.map(value => Array.isArray(value) ? Array.from(value) : value)]);
      }
    },
  };
  function load(source, g) {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(transpiled, { exports: {}, require: () => ({ defineSignal: name => name, g }) });
  }
  function reset() {
    players.splice(0, players.length, 'A');
    state.clear();
    views.clear();
    markets.clear();
    for (const player of Object.keys(playerIds)) state.set(player, {});
    logs.length = 0;
    events = new Map();
    now = 0n;
    lastVersion = 0n;
    load(graphSource, { server(options) {
      variables = { ...options.variables };
      return {
        on(name, callback) { events.set(name, callback); return this; },
        onSignal(signal, callback) { assert.equal(signal, 'AP_DuelRequest'); handler = callback; return this; },
      };
    } });
    events.get('whenEntityIsCreated')({ eventSourceEntity: 'stage' }, flow);
    load(buttonSource, { server() { return { on(event, callback) {
      assert.equal(event, 'whenUiControlGroupIsTriggered');
      onPress = callback;
    } }; } });
  }
  function readFrame() {
    const pendingViews = new Map();
    const pendingMarkets = new Map();
    for (const [signal, target, ...fields] of updates) {
      assert.ok(players.includes(target), 'private replies must target a player on the field');
      if (signal === 'client:AP_DuelSnapshot') {
        assert.equal(fields.length, 13);
        assert.ok(!pendingViews.has(target), 'duplicate room frame');
        const [count, seat, round, phase, ready, continued, settlements, version, sequence, winner, reason, remaining, ack] = fields;
        pendingViews.set(target, { count, seat, round, phase, ready, continued, settlements, version,
          sequence, winner, reason, remaining, ack });
      } else {
        assert.equal(signal, 'client:AP_DuelMarket');
        assert.equal(fields.length, 5);
        assert.ok(!pendingMarkets.has(target), 'duplicate shop frame');
        const [round, version, gold, offers, team] = fields;
        assert.equal(offers.length, offerSlots);
        assert.equal(team.length, teamSize);
        pendingMarkets.set(target, { round, version, gold, offers, team });
      }
    }
    assert.equal(pendingMarkets.size, pendingViews.size);
    let version;
    for (const [target, view] of pendingViews) {
      const market = pendingMarkets.get(target);
      assert.ok(market, 'room and shop messages must address the same player');
      assert.equal(market.round, view.round);
      assert.equal(market.version, view.version);
      version ??= view.version;
      assert.equal(view.version, version);
      if (view.seat === 0n) {
        assert.equal(market.gold, 0n);
        assert.equal(view.sequence, 0n);
        assert.ok([...market.offers, ...market.team].every(id => id === 0n), 'unassigned seats cannot see private data');
      }
      views.set(target, view);
      markets.set(target, market);
    }
    if (version !== undefined) {
      assert.ok(version > lastVersion);
      lastVersion = version;
    }
    return Array.from(pendingViews.keys());
  }
  function request(source, action, round = views.get(source)?.round ?? 0n,
    sequence = views.get(source)?.sequence ?? 0n, token = 0n) {
    updates = [];
    handler({ signalSourceEntity: source, params: { action, round, sequence, token } }, flow);
    return readFrame();
  }
  function tick(time, name = 'AP_DuelClock') {
    assert.ok(BigInt(time) >= now);
    now = BigInt(time);
    updates = [];
    events.get('whenTimerIsTriggered')({ timerName: name }, flow);
    return readFrame();
  }
  function press(source, key) {
    let recipients = [];
    onPress({ eventSourceGuid: source, uiControlGroupIndex: ids.get(key) ?? 0n }, {
      getSelfEntity: () => source,
      getCustomVariable: getVariable,
      getPlayerIdByPlayerGuid: guid => playerIds[guid],
      dataTypeConversion: value => String(value),
      printString: message => logs.push(message),
      sendSignal: (signal, action, round, sequence, token) => {
        assert.equal(signal, 'AP_DuelRequest');
        assert.equal(token, 0n);
        recipients = request(source, action, round, sequence, token);
      },
    });
    return recipients;
  }
  function stocked(player, index) {
    assert.deepEqual(markets.get(player).offers, shelves[index].map(BigInt));
    assert.equal(markets.get(player).gold, BigInt(gold));
  }

  reset();
  assert.deepEqual(request('A', 0n), ['A']);
  assert.equal(views.get('A').seat, 0n);
  assert.equal(views.get('A').count, 1n);
  assert.deepEqual(tick(1), []);
  players.push('B');
  assert.deepEqual(request(null, 3n, 1n, 1n), []);
  assert.deepEqual(request('A', -1n, 1n, 1n), []);
  assert.deepEqual(tick(2, 'otherTimer'), []);
  assert.deepEqual(tick(2), ['A', 'B']);
  assert.equal(views.get('A').remaining, 60n);
  stocked('A', 0);
  stocked('B', 1);
  assert.deepEqual(request('A', 1n), ['A']); // Empty team cannot ready.
  assert.equal(views.get('A').sequence, 1n);
  assert.deepEqual(request('A', 3n, 1n, 2n), ['A']); // Gap is rejected.
  assert.deepEqual(request('A', 3n, 1n, 1n, 31n), ['A', 'B']);
  assert.equal(views.get('A').ack, 31n);
  assert.equal(views.get('B').ack, 0n);
  assert.equal(markets.get('A').offers[0], 0n);
  assert.equal(markets.get('A').gold, BigInt(gold - price));
  assert.equal(markets.get('A').team[0], BigInt(shelves[0][0]));
  stocked('B', 1);
  assert.deepEqual(request('A', 4n, 1n, 1n), ['A']); // Reusing an accepted sequence with a changed payload cannot debit.
  assert.equal(markets.get('A').offers[1], BigInt(shelves[0][1]));
  assert.deepEqual(request('A', 3n), ['A']); // Current sequence with an already sold offer is rejected too.
  assert.equal(views.get('A').sequence, 2n);
  assert.deepEqual(request('B', 3n, 2n, 1n), ['B']);
  stocked('B', 1);
  assert.deepEqual(press('B', 0), []);
  assert.deepEqual(press('B', 5), ['A', 'B']);
  assert.equal(markets.get('B').team[0], BigInt(shelves[1][1]));
  assert.deepEqual(press('B', 2), ['A', 'B']);
  assert.ok(views.get('B').ready);
  assert.deepEqual(press('B', 6), ['B']);
  assert.equal(markets.get('B').offers[2], BigInt(shelves[1][2]));

  players.pop();
  assert.deepEqual(tick(3), ['A']);
  assert.equal(views.get('A').count, 1n);
  assert.equal(views.get('A').remaining, 15n);
  players.push('C');
  assert.deepEqual(request('C', 3n, 1n, 1n), ['C']);
  assert.equal(views.get('C').seat, 0n);
  players.splice(0, players.length, 'B', 'A');
  assert.deepEqual(tick(4), ['B', 'A']);
  assert.equal(views.get('B').seat, 2n);
  assert.equal(markets.get('B').gold, BigInt(gold - price));
  assert.deepEqual(tick(61), []);
  assert.deepEqual(request('A', 4n, 1n, 2n), ['B', 'A']);
  assert.equal(markets.get('A').gold, BigInt(gold - 2 * price));
  assert.deepEqual(tick(62), ['B', 'A']);
  assert.equal(views.get('A').phase, 1n);
  assert.equal(views.get('A').settlements, 1n);
  assert.deepEqual(press('B', 3), ['B', 'A']);
  assert.deepEqual(tick(72), ['B', 'A']); // One-sided confirmation times out and advances.
  assert.equal(views.get('A').round, 2n);
  assert.equal(views.get('A').sequence, 1n);
  stocked('A', 2);
  stocked('B', 3);
  assert.deepEqual(request('A', 3n, 1n, 1n), ['A']);
  stocked('A', 2);
  assert.deepEqual(press('A', 4), ['B', 'A']);
  assert.equal(markets.get('A').team[2], BigInt(shelves[2][0]));
  assert.deepEqual(press('A', 2), ['B', 'A']);
  assert.deepEqual(press('B', 2), ['B', 'A']);
  assert.equal(views.get('A').phase, 2n);
  assert.equal(views.get('A').reason, 1n);
  assert.equal(views.get('A').settlements, 2n);
  assert.deepEqual(tick(132), []);
  assert.ok(logs.some((line, i) => line === 'AUTO_PETS_M2 native_input' && logs[i + 1] === '2'));
  const settlements = logs.flatMap((line, index) => line === 'AUTO_PETS_M2 settled' ? [logs[index + 1]] : []);
  assert.deepEqual(settlements, ['1', '2']);

  reset();
  players.push('B');
  tick(1);
  assert.deepEqual(request('A', 6n), ['A', 'B']);
  assert.equal(views.get('B').winner, 2n);
  assert.equal(views.get('B').reason, 2n);
  assert.deepEqual(request('A', 6n), ['A']);
  assert.equal(views.get('A').sequence, 2n);

  reset();
  players.push('B');
  tick(1);
  players.pop();
  tick(2);
  players.push('C');
  assert.deepEqual(tick(16), []);
  assert.deepEqual(tick(17), ['A', 'C']);
  assert.equal(views.get('A').reason, 3n);
  assert.equal(views.get('A').winner, 1n);
  assert.equal(views.get('C').seat, 0n);
  players.splice(0, players.length, 'A', 'B');
  tick(18);
  assert.equal(views.get('B').phase, 2n);
  assert.equal(views.get('B').winner, 1n);

  reset();
  players.push('B');
  tick(1);
  assert.deepEqual(tick(2701), ['A', 'B']);
  assert.equal(views.get('A').phase, 2n);
  assert.equal(views.get('A').reason, 4n);
  return '双路径购物与次序校验、原生计时器、准备和确认超时、替补隔离、原实体回归、认输与席位缺失终止';
}
