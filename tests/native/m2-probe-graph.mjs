import assert from 'node:assert/strict';
import vm from 'node:vm';

export function verifyGraph(graphSource, buttonSource, registeredButtons, ts, marketFixture) {
  const { gold, price, teamSize, offerSlots, shelves } = marketFixture;
  assert.equal(shelves.length, 4);
  assert.ok(shelves.every(shelf => shelf.length === offerSlots && shelf.every(id => id > 0)));
  assert.equal(offerSlots, 3);
  assert.equal(teamSize, 5);
  assert.ok(gold >= price * offerSlots);
  const players = [];
  const playerState = new Map();
  const playerIds = { A: 1n, B: 2n, C: 3n };
  const logs = [];
  let variables, handler;
  let lastVersion;
  let updates = [];
  const flow = {
    getListOfPlayerEntitiesOnTheField: () => players,
    equal: (left, right) => left === right,
    get: name => variables[name],
    set: (name, value) => { variables[name] = value; },
    setCustomVariable: (player, name, value) => { playerState.get(player)[name] = value; },
    getCustomVariable: (player, name) => ({ asType: () => playerState.get(player)[name] ?? 0n }),
    assemblyList: list => Array.from(list),
    copyList: list => Array.from(list),
    modifyValueInList: (list, index, value) => {
      assert.ok(index >= 0n && index < list.length, 'list edit out of bounds');
      list[Number(index)] = value;
    },
    getCorrespondingValueFromList: (list, index) => list[Number(index)],
    getListLength: list => BigInt(list.length),
    dataTypeConversion: value => String(value),
    printString: line => logs.push(line),
    sendSignal: (signal, target, ...values) => {
      updates.push([signal, target, ...values.map(value => Array.isArray(value) ? Array.from(value) : value)]);
    },
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
  function reset() {
    players.splice(0, players.length, 'A');
    playerState.clear();
    for (const player of Object.keys(playerIds)) playerState.set(player, {});
    logs.length = 0;
    lastVersion = 0n;
    load(graphSource, runtime);
  }
  const request = (source, action, round) => {
    updates = [];
    handler({ signalSourceEntity: source, params: { action, round } }, flow);
    return updates;
  };

  function readFrame(messages) {
    const views = new Map();
    const markets = new Map();
    for (const [signal, target, ...fields] of messages) {
      assert.ok(players.includes(target), 'private replies must target a player on the field');
      if (signal === 'client:AP_DuelSnapshot') {
        assert.equal(fields.length, 8);
        assert.ok(!views.has(target), 'duplicate room frame');
        const [count, seat, round, phase, ready, continued, settlements, version] = fields;
        views.set(target, { count, seat, round, phase, ready, continued, settlements, version });
      } else {
        assert.equal(signal, 'client:AP_DuelMarket');
        assert.equal(fields.length, 5);
        assert.ok(!markets.has(target), 'duplicate shop frame');
        const [round, version, gold, offers, team] = fields;
        assert.equal(offers.length, offerSlots);
        assert.equal(team.length, teamSize);
        markets.set(target, { round, version, gold, offers, team });
      }
    }
    assert.equal(markets.size, views.size);
    let version;
    for (const [target, view] of views) {
      const market = markets.get(target);
      assert.ok(market, 'room and shop messages must address the same player');
      assert.equal(market.round, view.round);
      assert.equal(market.version, view.version);
      version ??= view.version;
      assert.equal(view.version, version);
      if (view.seat === 0n) {
        assert.equal(market.gold, 0n);
        assert.ok([...market.offers, ...market.team].every(id => id === 0n), 'unassigned seats cannot see private data');
      }
    }
    if (version !== undefined) {
      assert.ok(version > lastVersion);
      lastVersion = version;
    }
    return { views, markets };
  }

  function exercise(send, checkMissingSource) {
    reset();
    const team = { A: [], B: [] };
    const expected = {};
    function open(round) {
      expected.A = { gold: BigInt(gold), offers: shelves[(round - 1) * 2].map(BigInt) };
      expected.B = { gold: BigInt(gold), offers: shelves[(round - 1) * 2 + 1].map(BigInt) };
    }
    function expectRoom(messages, round, phase, ready = [false, false], continued = [false, false]) {
      const { views, markets } = readFrame(messages);
      assert.equal(views.size, 2);
      assert.equal(markets.size, 2);
      const version = views.get('A').version;
      assert.ok(version > 0n);
      for (const [index, player] of ['A', 'B'].entries()) {
        assert.deepEqual(views.get(player), {
          count: 2n, seat: BigInt(index + 1), round: BigInt(round), phase: BigInt(phase),
          ready: ready[index], continued: continued[index],
          settlements: BigInt(round - 1 + (phase === 0 ? 0 : 1)), version,
        });
        const padded = [...team[player], ...new Array(teamSize - team[player].length).fill(0n)];
        assert.deepEqual(markets.get(player), { round: BigInt(round), version, ...expected[player], team: padded });
      }
    }
    function buy(player, round, slot) {
      const offer = expected[player].offers[slot];
      assert.ok(offer > 0n);
      expected[player].offers[slot] = 0n;
      expected[player].gold -= BigInt(price);
      team[player].push(offer);
      const messages = send(player, BigInt(3 + slot), BigInt(round));
      expectRoom(messages, round, 0);
    }

    const waiting = readFrame(send('A', 0n, 0n));
    assert.equal(waiting.views.get('A').seat, 0n);
    assert.equal(waiting.views.get('A').count, 1n);
    const onePlayerBuy = readFrame(send('A', 3n, 1n));
    assert.equal(onePlayerBuy.views.get('A').seat, 0n);

    players.push('B');
    if (checkMissingSource) assert.deepEqual(send(null, 3n, 1n), []);
    open(1);
    expectRoom(send('A', 3n, 1n), 1, 0); // First input initializes the shop before any purchase.
    expectRoom(send('A', 1n, 1n), 1, 0); // Empty roster cannot ready.
    assert.equal(readFrame(send('C', 3n, 1n)).markets.has('C'), false);
    buy('A', 1, 0);
    expectRoom(send('A', 3n, 1n), 1, 0); // A sold-out offer cannot debit twice.
    expectRoom(send('B', 3n, 2n), 1, 0); // A future round cannot touch stock.

    players.pop();
    const absent = readFrame(send('A', 4n, 1n));
    assert.equal(absent.views.get('A').count, 1n);
    assert.ok(!absent.markets.has('B'));
    players.push('C');
    const replacement = readFrame(send('C', 3n, 1n));
    assert.equal(replacement.views.get('A').count, 1n);
    assert.equal(replacement.views.get('C').seat, 0n);
    readFrame(send('A', 1n, 1n));
    players.splice(0, players.length, 'B', 'A');
    expectRoom(send('B', 0n, 0n), 1, 0); // Both owners and their state survive reorder and replacement.

    buy('A', 1, 1);
    buy('A', 1, 2);
    buy('B', 1, 1);
    expectRoom(send('A', 1n, 1n), 1, 0, [true, false]);
    expectRoom(send('A', 1n, 1n), 1, 0, [true, false]);
    expectRoom(send('B', 1n, 1n), 1, 1, [true, true]);
    expectRoom(send('B', 5n, 1n), 1, 1, [true, true]);
    expectRoom(send('B', 2n, 1n), 1, 1, [true, true], [false, true]);
    expectRoom(send('B', 2n, 1n), 1, 1, [true, true], [false, true]);

    open(2);
    expectRoom(send('A', 2n, 1n), 2, 0);
    expectRoom(send('A', 4n, 1n), 2, 0); // A delayed first-round buy cannot touch fresh stock.
    expectRoom(send('A', 1n, 1n), 2, 0);
    buy('A', 2, 0);
    buy('A', 2, 1);
    expectRoom(send('A', 5n, 2n), 2, 0); // Sixth purchase: offer exists and gold remains.
    buy('B', 2, 2);
    expectRoom(send('B', 1n, 2n), 2, 0, [false, true]);
    expectRoom(send('B', 3n, 2n), 2, 0, [false, true]); // Ready locks remaining offers.
    expectRoom(send('A', 1n, 2n), 2, 2, [true, true]);
    expectRoom(send('A', 1n, 2n), 2, 2, [true, true]);
    const settlements = logs.flatMap((line, index) => line === 'AUTO_PETS_M2 settled' ? [logs[index + 1]] : []);
    assert.deepEqual(settlements, ['1', '2']);
  }

  exercise(request, true);

  const nativeLogs = [];
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
  const ids = new Map(registeredButtons.map(({ id, key }) => [Number(key), BigInt(id)]));
  assert.equal(ids.size, 10);
  assert.deepEqual(press('A', 0n), []);
  assert.deepEqual(nativeLogs, []);
  function nativeRequest(source, action, round) {
    let key;
    if (action === 0n) key = 1;
    else if (action === 1n) key = round === 1n ? 2 : 4;
    else if (action === 2n) key = 3;
    else key = Number(action) + (round === 1n ? 2 : 5);
    assert.ok(ids.has(key), 'expected a native button for the action');
    return press(source, ids.get(key));
  }
  exercise(nativeRequest, false);
  assert.ok(nativeLogs.some((line, i) => line === 'AUTO_PETS_M2 native_input' && nativeLogs[i + 1] === '2'));
  return 'Lua 信号与原生按钮分别模拟独立双人商店、购买、失效请求、席位锁定、进轮与两次结算';
}
