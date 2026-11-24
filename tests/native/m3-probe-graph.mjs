import assert from 'node:assert/strict';
import vm from 'node:vm';

export function verifyGraph(graphSource, buttonSource, buttonId, ts, wait) {
  function load(source, graph) {
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const graphRuntime = { defineSignal: name => name, g: { server: graph } };
    vm.runInNewContext(code, { exports: {}, require: () => graphRuntime, list: (_, values) => Array.from(values) });
  }

  function session() {
    const handlers = new Map();
    let variables;
    const definition = {
      on(event, handle) {
        assert.ok(!handlers.has(event));
        handlers.set(event, handle);
        return this;
      },
      onSignal: (signal, handle) => definition.on(signal, handle),
    };
    load(graphSource, options => {
      variables = options.variables;
      return definition;
    });
    load(buttonSource, () => definition);

    const values = new Map();
    const field = [];
    const messages = [];
    const logs = [];
    let calls = 0;
    let now = 0n;
    let source;
    const stage = Symbol('stage');
    const flow = {
      startTimer: (target, name, repeat, times) => {
        assert.equal(target, stage);
        assert.equal(name, 'AP_EightProbeClock');
        assert.equal(repeat, true);
        assert.deepEqual(Array.from(times), [1]);
      },
      printString: line => logs.push(line),
      queryGameTimeElapsed: () => now,
      getListOfPlayerEntitiesOnTheField: () => field,
      getListLength: list => BigInt(list.length),
      get: name => variables[name],
      set: (name, value) => { variables[name] = value; },
      copyList: list => Array.from(list),
      setCustomVariable: (player, name, value, synched) => {
        assert.equal(synched, false);
        values.get(player)[name] = value;
      },
      getCustomVariable: (player, name) => ({ asType: () => values.get(player)[name] ?? 0n }),
      queryGuidByEntity: entity => 'guid-' + entity,
      queryIfEntityIsOnTheField: entity => field.includes(entity),
      dataTypeConversion: value => String(value),
      equal: (left, right) => left === right,
      getCorrespondingValueFromList: (list, index) => {
        assert.ok(index >= 0n && index < list.length);
        return list[Number(index)];
      },
      modifyValueInList: (list, index, value) => {
        assert.ok(index >= 0n && index < list.length);
        list[Number(index)] = value;
      },
      sendSignal: (signal, ...payload) => {
        if (signal === 'AP_EightProbeRequest') {
          assert.equal(payload.length, 1);
          deliverRequest(source, payload[0]);
          return;
        }
        assert.ok(field.includes(payload[0]), 'Replies must be targeted to a player on the field');
        messages.push([signal, ...payload.map(value => Array.isArray(value) ? Array.from(value) : value)]);
        calls += 1;
      },
    };
    function deliverRequest(actor, path) {
      handlers.get('AP_EightProbeRequest')({ signalSourceEntity: actor, params: { path } }, flow);
    }
    function request(actor, path) {
      deliverRequest(actor, path);
      return messages.splice(0);
    }
    function tick(seconds, timerName = 'AP_EightProbeClock') {
      now = BigInt(seconds);
      handlers.get('whenTimerIsTriggered')({ timerName, eventSourceEntity: stage }, flow);
      return messages.splice(0);
    }
    handlers.get('whenEntityIsCreated')({ eventSourceEntity: stage }, flow);
    return {
      join(player, initial = {}) { field.push(player); values.set(player, initial); },
      remove(player) { field.splice(field.indexOf(player), 1); },
      restore(player) { field.unshift(player); },
      removeEvent(guid) {
        handlers.get('whenEntityIsRemovedDestroyed')({ eventSourceGuid: guid }, flow);
      },
      native(actor, id = buttonId) {
        source = actor;
        handlers.get('whenUiControlGroupIsTriggered')({
          uiControlGroupIndex: BigInt(id), eventSourceGuid: 'guid-' + actor, eventSourceEntity: actor,
        }, flow);
        return messages.splice(0);
      },
      tick, request, logs,
      messageCount: () => calls,
    };
  }

  const viewSignal = 'client:AP_EightProbeView';
  const replySignal = 'client:AP_EightProbeReply';
  function read(rows) {
    return rows.map(([signal, target, revision, field, seat, seconds, batch, seats, work]) => {
      assert.equal(signal, viewSignal);
      assert.equal(seats.length, 8);
      assert.equal(work.length, 8);
      return { target, revision, field, seat, seconds, batch, seats, work };
    });
  }
  const comparisons = [];
  for (let humans = 1; humans <= 8; humans += 1) {
    const probe = session();
    assert.deepEqual(probe.tick(0), []);
    for (let seat = 1; seat <= humans; seat += 1) probe.join(seat);
    const first = 2;
    const openedAt = first + (humans === 8 ? 0 : wait);
    const lead = probe.tick(first);
    let opened = lead;
    if (openedAt !== first) {
      assert.equal(lead.length, humans);
      for (const row of read(lead)) {
        assert.equal(row.seat, 0n);
        assert.equal(row.seconds, BigInt(wait));
        assert.equal(row.batch, 0n);
      }
      opened = probe.tick(openedAt);
    }
    assert.equal(opened.length, humans);
    assert.deepEqual(probe.tick(openedAt), [], 'Duplicate timer event may not execute another batch');
    assert.deepEqual(probe.tick(openedAt + 1, 'Unrelated'), []);
    let lastRevision = read(opened)[0].revision;
    for (let batch = 1; batch <= 4; batch += 1) {
      const rows = batch === 1 ? opened : probe.tick(openedAt + batch - 1);
      assert.equal(rows.length, humans);
      for (const row of read(rows)) {
        assert.equal(row.field, BigInt(humans));
        assert.equal(row.seat, BigInt(row.target));
        assert.equal(row.seconds, 0n);
        assert.equal(row.batch, BigInt(batch));
        assert.deepEqual(row.seats, Array.from({ length: 8 }, (_, index) => index < humans ? 1n : 2n));
        assert.deepEqual(row.work, Array.from({ length: 8 }, (_, index) => index < humans ? 0n : BigInt(batch)));
        assert.ok(row.revision >= lastRevision);
        lastRevision = row.revision;
      }
    }
    assert.deepEqual(probe.tick(openedAt + 4), []);
    for (let elapsed = 5; elapsed <= 300; elapsed += 1) assert.deepEqual(probe.tick(openedAt + elapsed), []);
    comparisons.push({ humans, bots: 8 - humans, batches: 4, activeMessages: probe.messageCount(), idleSeconds: 297 });
  }

  const probe = session();
  probe.join('a');
  probe.join('b');
  assert.deepEqual(probe.native('a'), []);
  probe.tick(1);
  if (wait) probe.tick(1 + wait);
  const status = probe.request('a', 0n);
  assert.equal(status.length, 2);
  assert.deepEqual(read(status.slice(0, 1)).map(row => row.seat), [1n]);
  assert.deepEqual(status[1], [replySignal, 'a', 1n, 0n, 0n, 0n]);
  assert.deepEqual(probe.request('a', 1n), [[replySignal, 'a', 1n, 1n, 0n, 0n]], 'A claimed path is not a native event');
  assert.deepEqual(probe.native('a'), [[replySignal, 'a', 1n, 1n, 1n, 0n]]);
  assert.deepEqual(probe.native('b', buttonId + 1), []);
  assert.deepEqual(probe.request('b', 2n), [[replySignal, 'b', 2n, 2n, 0n, 1n]]);
  assert.deepEqual(probe.request('a', 2n), [[replySignal, 'a', 1n, 2n, 1n, 1n]]);
  assert.deepEqual(probe.request(null, 2n), []);
  assert.deepEqual(probe.request('a', 100n), []);
  probe.remove('b');
  probe.removeEvent('guid-b');
  assert.deepEqual(probe.request('b', 2n), []);
  assert.deepEqual(read(probe.tick(wait + 2))[0].seats.slice(0, 2), [1n, 3n]);
  probe.join('c', { AP_ProbeSeat: 2n });
  const spoofed = read(probe.request('c', 2n));
  assert.equal(spoofed[0].seat, 0n);
  assert.equal(spoofed[0].seats[1], 3n);
  probe.restore('b'); // Reordering or re-observing the same entity does not reseat it.
  const resumed = read(probe.tick(wait + 3));
  assert.deepEqual(resumed.map(row => row.seat), [2n, 1n, 0n]);
  assert.equal(resumed[0].seats[1], 1n);
  assert.deepEqual(probe.request('b', 0n)[1], [replySignal, 'b', 2n, 0n, 0n, 1n]);
  assert.ok(probe.logs.includes('AUTO_PETS_M3_PROBE removed_guid'));
  assert.ok(probe.logs.includes('AUTO_PETS_M3_PROBE missing_player_source'));
  return {
    comparisons,
    checks: ['duplicate timer', 'quiet after fourth batch', 'native sender', 'untrusted path marker', 'targeted Lua reply', 'untrusted source',
      'unknown input', 'removed GUID telemetry', 'absent owner', 'late replacement', 'same entity returns'],
  };
}
