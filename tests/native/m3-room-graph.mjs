import assert from 'node:assert/strict';
import vm from 'node:vm';
import { shopFlow } from './versus-shop-parity.mjs';

const viewSignal = 'client:AP_RoomView';
const battleSignal = 'client:AP_RoomBattle';
const replaySignal = 'client:AP_RoomReplay';
const requestSignal = 'AP_RoomRequest';
const workSignal = 'AP_RoomFightWork';
const receiptSignal = 'AP_RoomFightDone';

function session(sources, ts, count, settings, delayedSignals = false) {
  const stage = Symbol('stage');
  const enrolled = Array.from({ length: count }, (_, index) => 'player-' + (index + 1));
  const field = Array.from(enrolled);
  const eventHandlers = [];
  const signalHandlers = new Map();
  let controller;
  let worker;
  let now = 0n;
  let ticket = 0n;
  let mode = 0n;
  let running = false;
  let calls = 0;
  let maxCalls = 0;
  const outputs = [];
  const internal = [];
  const messages = {};
  const logs = [];
  const completed = [];
  const positions = [];
  let dropped = false;
  let deferred;
  let deliveredLate = false;
  let repeatedBot;
  let staleBotDelivered = false;

  const methods = {
    ...shopFlow,
    emptyList: () => [],
    concatenateList: (target, input) => { target.push(...input); },
    equal: (a, b) => a === b,
    getListOfPlayerEntitiesOnTheField: () => Array.from(field),
    queryIfEntityIsOnTheField: entity => field.includes(entity),
    getSelfEntity: () => stage,
    getRandomInteger: () => 293_980_071n,
    queryGameTimeElapsed: () => now,
    getCustomVariable: (entity, name) => ({ asType: () => {
      assert.equal(entity, stage);
      if (name === 'AP_GameMode') return mode;
      assert.equal(name, 'AP_RoomTicket');
      return ticket;
    } }),
    setCustomVariable: (entity, name, value, sync) => {
      assert.equal(entity, stage);
      assert.equal(name, 'AP_RoomTicket');
      assert.equal(sync, false);
      ticket = value;
    },
    queryIfDictionaryContainsSpecificKey: (dict, key) => dict.has(key),
    queryDictionaryValueByKey: (dict, key) => {
      assert.ok(dict.has(key), 'native graph looked up an uninitialized logical seat');
      return dict.get(key);
    },
    setOrAddKeyValuePairsToDictionary: (dict, key, value) => { dict.set(key, value); },
    removeKeyValuePairsFromDictionaryByKey: (dict, key) => { dict.delete(key); },
    startTimer: (target, name, repeat, intervals) => {
      assert.equal(target, stage);
      assert.equal(name, 'AP_RoomClock');
      assert.equal(repeat, true);
      assert.deepEqual(Array.from(intervals), [settings.CADENCE]);
      assert.ok(!running);
      running = true;
    },
    stopTimer: (target, name) => {
      assert.equal(target, stage);
      assert.equal(name, 'AP_RoomClock');
      assert.ok(running);
      running = false;
    },
    printString: value => { logs.push(value); },
    dataTypeConversion: value => String(value),
    takeSmallerValue: (a, b) => a < b ? a : b,
    takeLargerValue: (a, b) => a > b ? a : b,
    sendSignal: (signal, ...values) => {
      const name = signal.name;
      assert.equal(values.length, signal.params.length);
      messages[name] = (messages[name] ?? 0) + 1;
      if (name.startsWith('client:')) {
        const target = values.shift();
        assert.ok(field.includes(target), 'client signals require a present target');
        outputs.push({ name, target, values: structuredClone(values) });
      } else {
        const params = Object.fromEntries(signal.params.map(([key], index) => [key, structuredClone(values[index])]));
        internal.push({ name, params, actor: stage });
      }
    },
  };

  function flowFor(variables) {
    const scoped = {
      ...methods,
      get: name => variables[name],
      set: (name, value) => { variables[name] = value; },
    };
    return new Proxy(scoped, {
      get: (target, key) => (...args) => {
        calls += 1;
        return target[key](...args);
      },
    });
  }
  for (const source of sources) {
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const runtime = {
      defineSignal: (name, params) => ({ name, params }),
      g: { server: ({ name, variables }) => {
        if (name === '_GSTS_AP_EightRoom') controller = variables;
        if (name === '_GSTS_AP_EightFight') worker = variables;
        const flow = flowFor(variables);
        const graph = {
          on(signal, handler) { eventHandlers.push({ signal, handler, flow }); return graph; },
          onSignal(signal, handler) {
            assert.ok(!signalHandlers.has(signal.name));
            signalHandlers.set(signal.name, { handler, flow });
            return graph;
          },
        };
        return graph;
      } },
    };
    vm.runInNewContext(transpiled, {
      exports: {}, require: () => runtime, list: (_, items) => Array.from(items), dict: () => new Map(),
    });
  }
  assert.ok(controller && worker);
  function formation(seat) {
    const market = controller.stocks.get(seat);
    return [market[5], ...market.slice(11, 11 + Number(market[5]) * 6)];
  }
  function dispatch({ name, params, actor }) {
    const entry = signalHandlers.get(name);
    assert.ok(entry, 'no native graph listens to ' + name);
    const before = controller.acceptedFrame;
    const botMove = name === requestSignal && actor === stage && params.action === 14n;
    const seat = botMove ? params.sequence - 1n : undefined;
    const beforeMove = botMove ? formation(seat) : undefined;
    entry.handler({ signalSourceEntity: actor, params }, entry.flow);
    if (name === receiptSignal && controller.acceptedFrame > before && params.outcome > 0n && params.flags === 0n) {
      const pair = Number(params.pair);
      completed.push([params.round, controller.fightSeeds[pair], params.outcome, formation(controller.pairs[pair * 2]),
        formation(controller.pairs[pair * 2 + 1]), params.board]);
    }
    if (botMove) {
      const afterMove = formation(seat);
      assert.equal(afterMove[0], beforeMove[0]);
      assert.equal(afterMove[2], beforeMove[Number((params.from - 1n) * 6n + 2n)]);
      positions.push([seat, params.from, params.to, beforeMove]);
    }
  }
  function flush() {
    let pending = 0;
    while (internal.length) {
      assert.ok(++pending < 10, 'internal queue reentered or looped');
      const queued = internal.shift();
      if (delayedSignals && queued.name === workSignal && !dropped) {
        dropped = true;
      } else if (delayedSignals && queued.name === receiptSignal && !deferred && !deliveredLate) {
        deferred = queued;
      } else {
        dispatch(queued);
        if (delayedSignals && queued.name === requestSignal && queued.actor === stage) {
          if (!repeatedBot && queued.params.action === 10n) {
            repeatedBot = queued;
            const stock = structuredClone(controller.stocks.get(queued.params.sequence - 1n));
            dispatch(queued);
            assert.deepEqual(controller.stocks.get(queued.params.sequence - 1n), stock);
          } else if (repeatedBot && !staleBotDelivered && queued.params.sequence === repeatedBot.params.sequence
              && queued.params.token !== repeatedBot.params.token) {
            const stock = structuredClone(controller.stocks.get(queued.params.sequence - 1n));
            dispatch(repeatedBot);
            assert.deepEqual(controller.stocks.get(queued.params.sequence - 1n), stock);
            staleBotDelivered = true;
          }
        }
      }
    }
  }
  function fire(signal, data = {}) {
    for (const event of eventHandlers) {
      if (event.signal === signal) event.handler({ eventSourceEntity: stage, ...data }, event.flow);
    }
    flush();
  }
  function take() { return outputs.splice(0); }
  fire('whenEntityIsCreated');
  assert.ok(running && ticket > 0n);
  if (settings.gated) {
    fire('whenTimerIsTriggered', { timerName: 'AP_RoomClock' });
    dispatch({ name: requestSignal, actor: enrolled[0], params: { action: 0n } });
    assert.equal(controller.lastTick, -1n);
    assert.equal(controller.phase, 0n);
    assert.deepEqual(outputs, []);
    mode = 8n;
  }

  return {
    enrolled, field, controller, worker, stage, logs, messages, completed, positions,
    recoveredSignals: () => dropped && deliveredLate && staleBotDelivered,
    peak: () => maxCalls,
    clock: () => now,
    running: () => running,
    tick(at) {
      now = BigInt(at);
      calls = 0;
      const previous = deferred && now > deferred.params.frame ? deferred : undefined;
      fire('whenTimerIsTriggered', { timerName: 'AP_RoomClock' });
      if (previous) {
        deferred = undefined;
        deliveredLate = true;
        dispatch(previous);
        flush();
      }
      maxCalls = Math.max(maxCalls, calls);
      return take();
    },
    signal(name, actor, params) {
      calls = 0;
      dispatch({ name, params, actor });
      flush();
      maxCalls = Math.max(maxCalls, calls);
      return take();
    },
    request(actor, action, round = 0n, sequence = 0n, from = 0n, to = 0n, flag = 0n, token = 0n) {
      return this.signal(requestSignal, actor, { action, round, sequence, from, to, flag, token });
    },
    settings,
  };
}

function read(rows, target) {
  const result = rows.find(entry => entry.target === target && entry.name === viewSignal);
  assert.ok(result, 'expected targeted acknowledgement');
  const [revision, phase, round, seat, sequence, humans, winner, ready, lives, places, opponents, results, market, ack, remaining] = result.values;
  assert.ok(typeof remaining === 'bigint' && remaining >= 0n);
  assert.ok(revision > 0n);
  for (const list of [lives, places, opponents, results]) assert.equal(list.length, 8);
  if (market.length) {
    assert.ok(market.length >= 41);
    assert.equal(market[3], 0n, 'targeted frame leaked RNG');
    assert.equal(market[4], 0n, 'targeted frame leaked private allocator state');
  }
  return { revision, phase, round, seat, sequence, humans, winner, ready, lives, places, opponents, results, market, ack };
}

function checkRounds(run, settings, receiptChecks = [], positionChecks = []) {
  const { controller: state, worker, stage, enrolled } = run;
  let round = 0n;
  let firstBuy = 0n;
  let replayFrames = 0;
  let replays = 0;
  let highestTier = 0;
  let botEliminations = 0;
  let humanDepartures = 0;
  let timeouts = 0;
  let byes = 0;
  let lastPairRound = 0n;
  const transcript = [];
  let ticks = 0;
  for (let second = settings.CADENCE; second <= settings.MAX_TIME + settings.WAIT + 12 * settings.CADENCE
      && run.running(); second += settings.CADENCE) {
    ticks += 1;
    const oldPhase = state.phase;
    const deliveries = run.tick(second);
    const duplicate = run.tick(second);
    assert.deepEqual(duplicate, [], 'a repeated server timer must not repeat work or deliveries');
    if (state.phase !== oldPhase) transcript.push([second, Number(state.phase), Number(state.round), Number(state.alive)]);
    for (const event of deliveries.filter(item => item.name === battleSignal)) {
      const [frame, battleRound, left, right, outcome, board] = event.values;
      assert.ok(frame >= BigInt(second - settings.CADENCE) && frame <= BigInt(second));
      assert.equal(battleRound, state.round);
      assert.ok(outcome >= 0n && outcome <= 4n && board.length === 66);
      assert.ok(event.target === enrolled[Number(left) - 1] || event.target === enrolled[Number(right) - 1]);
      for (const peer of deliveries.filter(item => item.name === battleSignal)) assert.deepEqual(event.values, peer.values);
      replayFrames += 1;
    }
    const receipts = deliveries.filter(item => item.name === replaySignal);
    if (receipts.length) {
      const [battleRound, left, right, outcome, seed, first, secondTeam] = receipts[0].values;
      assert.equal(battleRound, state.round);
      assert.ok(outcome > 0n && seed > 0n);
      for (const team of [first, secondTeam]) assert.equal(team.length, Number(1n + team[0] * 6n));
      for (const receipt of receipts) {
        assert.deepEqual(receipt.values, receipts[0].values);
        assert.ok(receipt.target === enrolled[Number(left) - 1] || receipt.target === enrolled[Number(right) - 1]);
      }
      const frame = deliveries.find(item => item.name === battleSignal && item.values[4] === outcome);
      assert.ok(frame);
      assert.deepEqual(run.completed.at(-1), [battleRound, seed, outcome, first, secondTeam, frame.values[5]]);
      replays += 1;
    }
    if (state.phase === 3n && state.round !== lastPairRound) {
      lastPairRound = state.round;
      const pairs = state.pairs;
      assert.equal(pairs.length, Number(state.alive - state.alive % 2n));
      assert.equal(new Set(pairs).size, pairs.length);
      byes += Number(state.alive % 2n);
    }
    if (state.phase === 2n && state.round !== round) {
      round = state.round;
      for (const market of state.stocks.values()) highestTier = Math.max(highestTier, Number(market[1]));
      for (const [index, actor] of enrolled.entries()) {
        let view = read(run.request(actor, 0n), actor);
        if (view.lives[index] === 0n) continue;
        if (round === 2n && index === enrolled.length - 1 && enrolled.length > 1) {
          const left = read(run.request(actor, 3n, round, view.sequence), actor);
          assert.equal(left.lives[index], 0n);
          assert.ok(left.places[index] > 0n);
          humanDepartures += 1;
          continue;
        }
        if (round === 1n && index === 0 && enrolled.length === 1) {
          timeouts += 1;
          continue;
        }
        assert.equal(view.seat, BigInt(index + 1));
        assert.equal(view.humans, BigInt(enrolled.length));
        const releaseOffer = view.market.slice(6, 9).findIndex(code => code > 9n || code < -9n);
        if (releaseOffer >= 0 && view.market[5] === 5n) {
          view = read(run.request(actor, 13n, round, view.sequence, 0n, 5n), actor);
          assert.equal(view.market[5], 4n);
        }
        if (view.market[5] < 5n) {
          const baseline = view.market;
          let rejected = read(run.request(actor, 11n, round, view.sequence + 1n, 1n), actor);
          assert.deepEqual(rejected.market, baseline);
          rejected = read(run.request(actor, 11n, round - 1n, view.sequence, 1n), actor);
          assert.deepEqual(rejected.market, baseline);
          assert.deepEqual(run.request(null, 11n, round, view.sequence, 1n), []);
          assert.deepEqual(run.request(stage, 11n, round, 8n, 1n, 0n, 0n), [], 'invalid stage ticket');
          const sequence = view.sequence;
          const buy = releaseOffer < 0 ? 1n : BigInt(releaseOffer + 1);
          view = read(run.request(actor, 11n, round, sequence, buy, 0n, 0n, 192n), actor);
          assert.equal(view.ack, 192n);
          assert.equal(view.market[2], baseline[2] - 3n);
          assert.equal(view.market[5], baseline[5] + 1n);
          assert.equal(view.sequence, sequence + 1n);
          firstBuy += 1n;
          const duplicate = read(run.request(actor, 11n, round, sequence, 2n), actor);
          assert.deepEqual(duplicate.market, view.market);
        }
        const ready = read(run.request(actor, 1n, round, view.sequence), actor);
        assert.ok(ready.ready);
        const locked = read(run.request(actor, 10n, round, ready.sequence), actor);
        assert.deepEqual(locked.market, ready.market);
      }
    }
    if (oldPhase === 2n && state.phase === 3n && enrolled.length < 8 && state.round === 1n) {
      for (let seat = enrolled.length; seat < 8; seat += 1) {
        const market = state.stocks.get(BigInt(seat));
        assert.ok(market[5] > 0n, 'every bot must build a team from empty through the store');
        assert.ok(market[2] >= 0n && market[2] < 10n);
      }
    }
  }
  assert.ok(!run.running() && state.phase === 5n, 'all eight seats reached terminal ranking');
  assert.ok(state.winner >= 1n && state.winner <= 8n);
  assert.deepEqual(new Set(state.table.slice(8, 16)), new Set([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]));
  assert.equal(state.table[8 + Number(state.winner) - 1], 1n);
  for (let seat = enrolled.length; seat < 8; seat += 1) if (state.table[seat] === 0n) botEliminations += 1;
  assert.ok(worker.fights.size > 0 && firstBuy > 0n && replayFrames > 0 && replays > 0);
  assert.ok(run.messages[workSignal] > 0 && run.messages[receiptSignal] > 0);
  receiptChecks.push(...run.completed);
  positionChecks.push(...run.positions);
  const releaseBattles = run.completed.filter(([, , , first, second]) =>
    [first, second].some(team => team.some((code, at) => at % 6 === 1 && code > 9n))).length;
  return {
    humans: enrolled.length, botEliminations, humanDepartures, timeouts, byes, frames: replayFrames, replays,
    completedBattles: run.completed.length, releaseBattles, highestTier, positioningMoves: run.positions.length,
    round: Number(state.round), winner: Number(state.winner), places: state.table.slice(8, 16).map(Number),
    clock: Number(run.clock()), ticks, peakExplicitCalls: run.peak(), messages: run.messages, transcript,
  };
}

function verifyReplayRecovery(sources, ts, settings) {
  const recovering = session(sources, ts, 2, settings);
  const tick = () => recovering.tick(Number(recovering.clock()) + settings.CADENCE);
  const phase = () => recovering.controller.phase;
  while (phase() !== 2n && recovering.clock() < settings.WAIT + 10 * settings.CADENCE) tick();
  assert.equal(phase(), 2n);
  for (const actor of recovering.enrolled) {
    let view = read(recovering.request(actor, 0n), actor);
    for (let offer = 1n; offer <= 3n; offer += 1n) {
      view = read(recovering.request(actor, 11n, view.round, view.sequence, offer), actor);
    }
    assert.ok(read(recovering.request(actor, 1n, view.round, view.sequence), actor).ready);
  }
  let original;
  while (phase() !== 4n && recovering.clock() < settings.MAX_TIME + settings.WAIT) {
    const deliveries = tick();
    original ??= deliveries.find(entry => entry.name === replaySignal);
  }
  assert.equal(phase(), 4n);
  assert.ok(original, 'a human fight must have delivered a replay');
  const actor = original.target;
  const index = recovering.field.indexOf(actor);
  recovering.field.splice(index, 1);
  tick();
  recovering.field.splice(index, 0, actor);
  // The reloaded client has no cache; require its original replay after the first seat sync.
  const restored = recovering.request(actor, 0n);
  assert.deepEqual(restored.map(entry => [entry.target, entry.name]), [[actor, viewSignal], [actor, replaySignal]]);
  assert.deepEqual(restored[1].values, original.values);
  const state = read(restored, actor);
  const retry = recovering.request(actor, 11n, state.round, state.sequence, 1n);
  assert.equal(retry.length, 1, 'normal or rejected input must not request a replay');
  assert.deepEqual(read(retry, actor).market, state.market);
  recovering.field.push('replacement');
  const unknown = recovering.request('replacement', 0n);
  assert.equal(unknown.length, 1);
  assert.equal(read(unknown, 'replacement').seat, 0n);
  while (phase() === 4n) tick();
  const movedOn = recovering.request(actor, 0n);
  assert.equal(movedOn.length, 1, 'the old replay must not be reported in a new round');
  assert.equal(read(movedOn, actor).round, state.round + 1n);
}

export function verifyRoom(sources, ts, settings, receiptChecks, positionChecks) {
  verifyReplayRecovery(sources, ts, settings);
  const combinations = [];
  for (let humans = 1; humans <= 8; humans += 1) {
    combinations.push(checkRounds(session(sources, ts, humans, settings), settings, receiptChecks, positionChecks));
  }
  assert.deepEqual(checkRounds(session(sources, ts, 1, settings), settings), combinations[0], 'fixed-seed replay differs');
  const delayed = session(sources, ts, 1, settings, true);
  const recoveredMatch = checkRounds(delayed, settings, receiptChecks, positionChecks);
  assert.ok(delayed.recoveredSignals());
  assert.deepEqual(recoveredMatch.places, combinations[0].places, 'one lost request and delayed receipt altered final placement');
  const recovering = session(sources, ts, 2, settings);
  const advance = seconds => {
    const then = Number(recovering.clock()) + seconds;
    while (Number(recovering.clock()) + settings.CADENCE <= then) recovering.tick(Number(recovering.clock()) + settings.CADENCE);
  };
  advance(settings.WAIT + 10 * settings.CADENCE);
  const actor = recovering.enrolled[1];
  const prior = read(recovering.request(actor, 0n), actor);
  recovering.field.pop();
  recovering.field.push('new-entity');
  const replacement = read(recovering.request('new-entity', 11n, prior.round, prior.sequence, 1n), 'new-entity');
  assert.equal(replacement.seat, 0n);
  assert.deepEqual(replacement.market, []);
  advance(6);
  recovering.field.push(actor);
  const recovered = read(recovering.request(actor, 0n), actor);
  assert.equal(recovered.seat, prior.seat);
  assert.deepEqual(recovered.market, prior.market);
  advance(2 * settings.CADENCE);
  recovering.field.pop();
  advance(settings.RECOVERY + 5 * settings.CADENCE);
  assert.equal(recovering.controller.table[1], 0n);
  assert.equal(recovering.controller.table[9], 8n);
  return { combinations, delayedSignalRecovery: { droppedWork: 1, delayedReceipt: 1, repeatedBotActions: 2,
    places: recoveredMatch.places },
    recovery: ['same entity recovered', 'replacement rejected', 'absence timed out', 'current battle replay restored'] };
}
