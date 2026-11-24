import assert from 'node:assert/strict';
import vm from 'node:vm';
import { shopFlow } from './versus-shop-parity.mjs';

export function verifyGraph(graphSource, buttonSource, combatSource, registeredButtons, ts, marketFixture, checkReplay) {
  const { gold, price, teamSize, offerSlots, foodSlots, shelves, startingLives } = marketFixture;
  const ids = new Map(registeredButtons.map(({ id, key }) => [Number(key), BigInt(id)]));
  assert.equal(ids.size, 7);
  assert.ok(gold >= price * offerSlots);
  const state = new Map();
  const views = new Map();
  const markets = new Map();
  const replays = new Map();
  const players = [];
  const playerIds = { A: 1n, B: 2n, C: 3n };
  const logs = [];
  let variables, handler, onPress;
  let events, updates, now, lastVersion, combatVariables, combatEvents, combatSignals, randomCount;
  let totalResolved = 0;
  let apiCalls = 0;
  let maximumApiCalls = 0;
  let maximumMessages = 0;
  const getVariable = (player, name) => ({ asType: () => state.get(player)?.[name] ?? 0n });
  const api = {
    ...shopFlow,
    emptyList: () => [],
    takeSmallerValue: (left, right) => left < right ? left : right,
    takeLargerValue: (left, right) => left > right ? left : right,
    getSelfEntity: () => 'stage',
    getListOfPlayerEntitiesOnTheField: () => players,
    equal: (left, right) => left === right,
    queryGameTimeElapsed: () => now,
    getRandomInteger(low, high) {
      assert.equal(low, 1n);
      assert.equal(high, 2147483646n);
      randomCount += 1n;
      return randomCount * 127n + 93n;
    },
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
    dataTypeConversion: value => String(value),
    printString: line => logs.push(line),
    sendSignal(signal, target, ...values) {
      if (signal === 'AP_DuelRequest') {
        const [round, sequence, token, from, to, flag] = values;
        handler({ signalSourceEntity: 'stage', params: { action: target, round, sequence, token, from, to, flag } }, flow);
      } else if (signal === 'AP_DuelFightStart') {
        const [attempt, seed, first, second] = values;
        combatSignals.get(signal)({ signalSourceEntity: 'stage', params: { round: target, attempt, seed, first, second } }, combatFlow);
      } else if (signal === 'AP_DuelFightCancel') {
        combatSignals.get(signal)({ signalSourceEntity: 'stage', params: { attempt: target } }, combatFlow);
      } else {
        updates.push([signal, target, ...values.map(value => Array.isArray(value) ? Array.from(value) : value)]);
      }
    },
  };
  const tracked = calls => Object.fromEntries(Object.entries(calls).map(([name, call]) => [name, (...args) => {
    apiCalls += 1;
    return call(...args);
  }]));
  const flow = tracked(api);
  const combatFlow = tracked({
    ...api,
    get: name => combatVariables[name],
    set: (name, value) => { combatVariables[name] = value; },
    startTimer(target, name, repeat, delays) {
      assert.equal(target, 'stage');
      assert.equal(name, 'AP_DuelFightClock');
      assert.equal(repeat, true);
      assert.deepEqual(Array.from(delays), [1]);
    },
    stopTimer: (target, name) => assert.deepEqual([target, name], ['stage', 'AP_DuelFightClock']),
  });
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
    replays.clear();
    for (const player of Object.keys(playerIds)) state.set(player, {});
    logs.length = 0;
    events = new Map();
    combatSignals = new Map();
    combatEvents = new Map();
    randomCount = 0n;
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
    load(combatSource, { server(options) {
      combatVariables = { ...options.variables };
      return {
        on(name, callback) { combatEvents.set(name, callback); return this; },
        onSignal(signal, callback) { combatSignals.set(signal, callback); return this; },
      };
    } });
    load(buttonSource, { server() { return { on(event, callback) {
      assert.equal(event, 'whenUiControlGroupIsTriggered');
      onPress = callback;
    } }; } });
  }
  function readFrame() {
    maximumApiCalls = Math.max(maximumApiCalls, apiCalls);
    maximumMessages = Math.max(maximumMessages, updates.length);
    const pendingViews = new Map();
    const pendingMarkets = new Map();
    const pendingReplays = new Map();
    for (const [signal, target, ...fields] of updates) {
      assert.ok(players.includes(target), 'private replies must target a player on the field');
      if (signal === 'client:AP_DuelSnapshot') {
        assert.equal(fields.length, 16);
        assert.ok(!pendingViews.has(target), 'duplicate room frame');
        const [count, seat, round, phase, ready, continued, settlements, version,
          sequence, winner, reason, remaining, ack, lives, opponentLives, outcome] = fields;
        pendingViews.set(target, { count, seat, round, phase, ready, continued, settlements, version,
          sequence, winner, reason, remaining, ack, lives, opponentLives, outcome });
      } else if (signal === 'client:AP_DuelReplay') {
        assert.equal(fields.length, 5);
        assert.ok(!pendingReplays.has(target), 'duplicate battle frame');
        const [round, seed, outcome, left, right] = fields;
        assert.equal(left.length % 5, 0);
        assert.equal(right.length % 5, 0);
        pendingReplays.set(target, { round, seed, outcome, left, right });
      } else {
        assert.equal(signal, 'client:AP_DuelMarket');
        assert.equal(fields.length, 3);
        assert.ok(!pendingMarkets.has(target), 'duplicate shop frame');
        const [round, version, raw] = fields;
        const teamAt = 6 + offerSlots + foodSlots;
        const size = teamAt + teamSize * 6;
        if (raw.length === 1) {
          assert.deepEqual(raw, [0n]);
          pendingMarkets.set(target, { round, version, gold: 0n, offers: [], team: [], raw });
        } else {
          assert.ok(raw.length >= size);
          assert.equal(raw[0], round);
          assert.deepEqual(raw.slice(3, 5), [0n, 0n], 'private random stream and future UIDs leaked');
          const offers = raw.slice(6, 6 + offerSlots);
          const foods = raw.slice(6 + offerSlots, teamAt);
          const team = Array.from({ length: teamSize }, (_, i) => raw[teamAt + i * 6]);
          pendingMarkets.set(target, { round, version, gold: raw[2], offers, foods, team, raw });
        }
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
        assert.deepEqual(market.raw, [0n], 'unassigned seats cannot see private data');
      }
      const replay = pendingReplays.get(target);
      assert.equal(Boolean(replay), view.seat > 0n && view.outcome > 0n);
      if (replay) {
        assert.equal(replay.round, view.round);
        assert.equal(replay.outcome, view.outcome);
        if (replays.get(target)?.round !== replay.round) {
          if (!Array.from(replays.values()).some(previous => previous.round === replay.round)) {
            checkReplay(replay, Array.from(combatVariables.board));
            totalResolved += 1;
          }
          replays.set(target, replay);
        }
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
    sequence = views.get(source)?.sequence ?? 0n, token = 0n, from = 0n, to = 0n, flag = 0n) {
    updates = [];
    apiCalls = 0;
    handler({ signalSourceEntity: source, params: { action, round, sequence, token, from, to, flag } }, flow);
    return readFrame();
  }
  const buy = (source, from, round, sequence, token) => request(source, 11n, round, sequence, token, from);
  const shop = (source, action, from, to, flag) => request(source, action, undefined, undefined, 0n, from, to, flag);
  function tick(time, name = 'AP_DuelClock') {
    assert.ok(BigInt(time) >= now);
    now = BigInt(time);
    updates = [];
    apiCalls = 0;
    events.get('whenTimerIsTriggered')({ timerName: name }, flow);
    return readFrame();
  }
  function resolveFight() {
    assert.equal(combatVariables.active, true);
    for (let strike = 0; combatVariables.active && strike < 270; strike += 1) {
      now += 1n;
      updates = [];
      apiCalls = 0;
      combatEvents.get('whenTimerIsTriggered')({ timerName: 'AP_DuelFightClock' }, combatFlow);
      readFrame();
    }
    assert.equal(combatVariables.active, false);
    if (views.get('A')?.outcome > 0n) assert.deepEqual(replays.get('A'), replays.get('B'));
  }
  function press(source, key) {
    let recipients = [];
    onPress({ eventSourceGuid: source, uiControlGroupIndex: ids.get(key) ?? 0n }, {
      getSelfEntity: () => source,
      getCustomVariable: getVariable,
      getPlayerIdByPlayerGuid: guid => playerIds[guid],
      dataTypeConversion: value => String(value),
      printString: message => logs.push(message),
      sendSignal: (signal, action, round, sequence, token, from, to, flag) => {
        assert.equal(signal, 'AP_DuelRequest');
        assert.equal(token, 0n);
        recipients = request(source, action, round, sequence, token, from, to, flag);
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
  assert.deepEqual(buy(null, 1n, 1n, 1n), []);
  assert.deepEqual(request('A', -1n, 1n, 1n), []);
  assert.deepEqual(tick(2, 'otherTimer'), []);
  assert.deepEqual(tick(2), ['A', 'B']);
  assert.equal(views.get('A').remaining, 60n);
  stocked('A', 0);
  stocked('B', 1);
  assert.deepEqual(request('A', 1n), ['A']); // Empty team cannot ready.
  assert.equal(views.get('A').sequence, 1n);
  assert.deepEqual(buy('A', 1n, 1n, 2n), ['A']); // Gap is rejected.
  assert.deepEqual(buy('A', 1n, 1n, 1n, 31n), ['A', 'B']);
  assert.equal(views.get('A').ack, 31n);
  assert.equal(views.get('B').ack, 0n);
  assert.equal(markets.get('A').offers[0], 0n);
  assert.equal(markets.get('A').gold, BigInt(gold - price));
  assert.equal(markets.get('A').team[0], BigInt(shelves[0][0]));
  stocked('B', 1);
  assert.deepEqual(buy('A', 2n, 1n, 1n), ['A']); // Reusing an accepted sequence with a changed payload cannot debit.
  assert.equal(markets.get('A').offers[1], BigInt(shelves[0][1]));
  assert.deepEqual(buy('A', 1n), ['A']); // Current sequence with an already sold offer is rejected too.
  assert.equal(views.get('A').sequence, 2n);
  assert.deepEqual(buy('B', 1n, 2n, 1n), ['B']);
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
  assert.deepEqual(buy('C', 1n, 1n, 1n), ['C']);
  assert.equal(views.get('C').seat, 0n);
  players.splice(0, players.length, 'B', 'A');
  assert.deepEqual(tick(4), ['B', 'A']);
  assert.equal(views.get('B').seat, 2n);
  assert.equal(markets.get('B').gold, BigInt(gold - price));
  assert.deepEqual(tick(61), []);
  assert.deepEqual(buy('A', 2n, 1n, 2n), ['B', 'A']);
  assert.equal(markets.get('A').gold, BigInt(gold - 2 * price));
  assert.deepEqual(tick(62), ['B', 'A']);
  assert.equal(views.get('A').phase, 3n);
  assert.deepEqual(request('A', -2n, 1n, 1n, 0n, 2n), []); // Cannot forge an authoritative result.
  resolveFight();
  assert.equal(views.get('A').phase, 1n);
  assert.equal(views.get('A').settlements, 1n);
  assert.deepEqual(press('B', 3), ['B', 'A']);
  assert.deepEqual(tick(now + 10n), ['B', 'A']); // One-sided confirmation times out and advances.
  assert.equal(views.get('A').round, 2n);
  assert.equal(views.get('A').sequence, 1n);
  stocked('A', 2);
  stocked('B', 3);
  assert.deepEqual(buy('A', 1n, 1n, 1n), ['A']);
  stocked('A', 2);
  assert.deepEqual(press('A', 4), ['B', 'A']);
  assert.equal(markets.get('A').team[2], BigInt(shelves[2][0]));
  assert.deepEqual(press('A', 2), ['B', 'A']);
  assert.deepEqual(press('B', 2), ['B', 'A']);
  assert.equal(views.get('A').phase, 3n);
  resolveFight();
  assert.equal(views.get('A').phase, 1n);
  assert.equal(views.get('A').settlements, 2n);
  assert.deepEqual(tick(now + 1n), []);
  assert.ok(logs.some((line, i) => line === 'AUTO_PETS_M2 native_input' && logs[i + 1] === '2'));
  const settlements = logs.flatMap((line, index) => line === 'AUTO_PETS_M2 settled' ? [logs[index + 1]] : []);
  assert.deepEqual(settlements, ['1', '2']);

  reset();
  players.push('B');
  tick(1);
  tick(61);
  resolveFight();
  assert.equal(views.get('B').outcome, 3n);
  assert.equal(views.get('B').lives, BigInt(startingLives));
  tick(now + 10n);
  assert.deepEqual(buy('A', 1n), ['A', 'B']);
  for (let loss = 1n; loss <= startingLives; loss += 1n) {
    assert.deepEqual(press('A', 2), ['A', 'B']);
    tick(now + 60n);
    resolveFight();
    assert.equal(views.get('A').outcome, 1n);
    assert.equal(views.get('B').lives, BigInt(startingLives) - loss);
    if (loss < startingLives) tick(now + 10n);
  }
  assert.equal(views.get('A').phase, 2n);
  assert.equal(views.get('A').winner, 1n);
  assert.equal(views.get('B').reason, 5n);
  assert.equal(views.get('A').settlements, BigInt(startingLives) + 1n);
  assert.deepEqual(request('stage', -2n, views.get('A').round, variables.battleAttempt, 0n, 1n), []);
  assert.equal(views.get('B').lives, 0n);

  reset();
  players.push('B');
  tick(1);
  for (const player of players) {
    for (const slot of [1n, 2n, 3n]) buy(player, slot);
    press(player, 2);
  }
  resolveFight();
  for (const player of players) press(player, 3);
  for (const player of players) {
    for (const slot of [1n, 2n]) buy(player, slot);
    shop(player, 16n, 1n, 1n);
    assert.equal(markets.get(player).raw[5], 5n);
    press(player, 2);
  }
  resolveFight();
  assert.equal(replays.get('A').left.length, 25);
  assert.equal(replays.get('A').right.length, 25);

  reset();
  players.push('B');
  tick(1);
  buy('A', 2n);
  buy('B', 3n);
  variables.shopOne[14] = 1000n;
  variables.shopTwo[14] = 1000n;
  press('A', 2);
  press('B', 2);
  resolveFight();
  assert.equal(views.get('A').phase, 0n);
  assert.equal(views.get('A').settlements, 0n);
  assert.equal(views.get('B').lives, BigInt(startingLives));
  assert.equal(views.get('A').ready, false);
  assert.equal(views.get('B').ready, false);
  assert.ok(logs.includes('AUTO_PETS_M2 strike_limit'));
  assert.equal(replays.size, 0);

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

  reset();
  players.push('B');
  tick(1);
  const startingB = markets.get('B').raw;
  const food = markets.get('A').foods[0];
  assert.deepEqual(shop('A', 17n, 1n, 1n, 0n), ['A', 'B']);
  assert.equal(markets.get('A').foods[0], -food);
  assert.deepEqual(press('A', 7), ['A', 'B']);
  assert.equal(markets.get('A').foods[0], -food);
  assert.equal(markets.get('A').gold, BigInt(gold - 1));
  assert.deepEqual(buy('A', 1n), ['A', 'B']);
  assert.deepEqual(shop('A', 16n, 1n, 1n), ['A', 'B']);
  assert.equal(markets.get('A').foods[0], 0n);
  assert.deepEqual(shop('A', 13n, 0n, 1n), ['A', 'B']);
  assert.equal(markets.get('A').raw[5], 0n);
  assert.deepEqual(markets.get('B').raw, startingB);

  reset();
  players.push('B');
  tick(1);
  assert.deepEqual(buy('A', 1n), ['A', 'B']);
  assert.deepEqual(buy('A', 3n), ['A', 'B']);
  assert.deepEqual(shop('A', 14n, 1n, 2n), ['A', 'B']);
  assert.deepEqual(shop('A', 15n, 1n, 2n), ['A', 'B']);
  assert.equal(markets.get('A').raw[5], 1n);
  assert.equal(markets.get('A').raw[16], 1n);
  assert.deepEqual(shop('A', 12n, 2n, 1n), ['A']); // Different species cannot combine.

  reset();
  players.push('B');
  tick(1);
  assert.deepEqual(buy('A', 1n), ['A', 'B']);
  assert.deepEqual(shop('A', 12n, 3n, 1n), ['A', 'B']);
  assert.equal(markets.get('A').raw[16], 1n);

  reset();
  players.push('B');
  tick(1);
  players.pop();
  tick(2);
  players.push('B');
  tick(17);
  assert.equal(views.get('A').winner, 1n);
  assert.equal(views.get('B').reason, 3n);
  return {
    summary: '完整双人经营、定向隔离、权威战斗与同一回放、平局、扣命终局、阶段超时、恢复和认输',
    maximumApiCalls, maximumMessages, totalResolved,
  };
}
