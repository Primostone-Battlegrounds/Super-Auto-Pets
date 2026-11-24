/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_EightProbeRequest', [['path', 'int']] as const);
const view = defineSignal('client:AP_EightProbeView', [
  ['player', 'entity'], ['revision', 'int'], ['fieldCount', 'int'], ['seat', 'int'],
  ['seconds', 'int'], ['batch', 'int'], ['seats', 'int_list'], ['work', 'int_list'],
] as const);
const reply = defineSignal('client:AP_EightProbeReply', [
  ['player', 'entity'], ['seat', 'int'], ['path', 'int'], ['nativeCount', 'int'], ['luaCount', 'int'],
] as const);

const capacity = 8n;
const waitSeconds = 5n; // AP_EIGHT_WAIT_SECONDS
const batches = 4n;

g.server({
  id: 1073741825,
  name: '_GSTS_AP_EightProbe',
  variables: {
    owners: list('entity', []),
    statuses: list('int', [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]),
    work: list('int', [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]),
    closeAt: -1n, lastTick: -1n, batch: 0n, revision: 0n,
  },
})
.on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, 'AP_EightProbeClock', true, [1]);
  f.printString('AUTO_PETS_M3_PROBE stage_timer_started');
})
.on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== 'AP_EightProbeClock') return;
  const now = f.queryGameTimeElapsed();
  if (now <= f.get('lastTick')) return;
  f.set('lastTick', now);
  const players = f.getListOfPlayerEntitiesOnTheField();
  const fieldCount = f.getListLength(players);
  if (fieldCount > capacity) return;

  let owners = f.get('owners');
  let ownerCount = f.getListLength(owners);
  let closeAt = f.get('closeAt');
  let seconds = 0n;
  let changed = false;
  if (ownerCount === 0n) {
    if (fieldCount === 0n) {
      f.set('closeAt', -1n);
      return;
    }
    if (closeAt < 0n) {
      closeAt = now + waitSeconds;
      f.set('closeAt', closeAt);
    }
    if (now >= closeAt || fieldCount === capacity) {
      owners = f.copyList(players);
      ownerCount = fieldCount;
      f.set('owners', owners);
      let seat = 0n;
      for (const owner of owners) {
        seat += 1n;
        f.setCustomVariable(owner, 'AP_ProbeSeat', seat, false);
        f.printString('AUTO_PETS_M3_PROBE enrolled_guid');
        f.printString(f.dataTypeConversion(f.queryGuidByEntity(owner), 'str'));
      }
      f.printString('AUTO_PETS_M3_PROBE roster_humans');
      f.printString(f.dataTypeConversion(ownerCount, 'str'));
    } else {
      seconds = closeAt - now;
    }
    changed = true;
  }

  let batch = f.get('batch');
  const runBotWork = ownerCount > 0n && batch < batches;
  const statuses = f.copyList(f.get('statuses'));
  const work = f.copyList(f.get('work'));
  if (ownerCount > 0n) {
    if (runBotWork) {
      batch += 1n;
      f.set('batch', batch);
      changed = true;
    }
    for (let index = 0n; index < capacity; index += 1n) {
      let current = 2n;
      if (index < ownerCount) {
        const owner = f.getCorrespondingValueFromList(owners, index);
        current = 3n;
        if (f.queryIfEntityIsOnTheField(owner)) current = 1n;
      } else if (runBotWork) {
        // A per-seat server computation exercises persistent logical bot state.
        const count = f.getCorrespondingValueFromList(work, index);
        f.modifyValueInList(work, index, count + 1n);
      }
      if (current !== f.getCorrespondingValueFromList(statuses, index)) {
        f.modifyValueInList(statuses, index, current);
        changed = true;
        if (current === 3n || batch > 1n) {
          f.printString('AUTO_PETS_M3_PROBE presence_seat_status');
          f.printString(f.dataTypeConversion(index + 1n, 'str'));
          f.printString(f.dataTypeConversion(current, 'str'));
        }
      }
    }
  }
  if (!changed) return;
  f.set('statuses', statuses);
  if (runBotWork) {
    f.set('work', work);
    f.printString('AUTO_PETS_M3_PROBE work_batch');
    f.printString(f.dataTypeConversion(batch, 'str'));
  }
  const revision = f.get('revision') + 1n;
  f.set('revision', revision);
  for (const player of players) {
    let seat = f.getCustomVariable(player, 'AP_ProbeSeat').asType('int');
    if (seat > 0n && seat <= ownerCount) {
      if (!f.equal(f.getCorrespondingValueFromList(owners, seat - 1n), player)) seat = 0n;
    } else {
      seat = 0n;
    }
    f.sendSignal(view, player, revision, fieldCount, seat, seconds, batch, statuses, work);
  }
})
.on('whenEntityIsRemovedDestroyed', (event, f) => {
  f.printString('AUTO_PETS_M3_PROBE removed_guid');
  f.printString(f.dataTypeConversion(event.eventSourceGuid, 'str'));
})
.onSignal(request, (event, f) => {
  const actor = event.signalSourceEntity;
  const players = f.getListOfPlayerEntitiesOnTheField();
  let fromPlayer = false;
  for (const player of players) {
    if (f.equal(actor, player)) fromPlayer = true;
  }
  const path = event.params.path;
  if (!fromPlayer) {
    f.printString('AUTO_PETS_M3_PROBE missing_player_source');
    return;
  }
  if (path !== 1n && path !== 2n && path !== 0n) return;
  const owners = f.get('owners');
  const ownerCount = f.getListLength(owners);
  let seat = f.getCustomVariable(actor, 'AP_ProbeSeat').asType('int');
  if (seat > 0n && seat <= ownerCount) {
    if (!f.equal(f.getCorrespondingValueFromList(owners, seat - 1n), actor)) seat = 0n;
  } else {
    seat = 0n;
  }
  if (path !== 0n && seat > 0n) {
    const nativeCount = f.getCustomVariable(actor, 'AP_ProbeNative').asType('int');
    let luaCount = f.getCustomVariable(actor, 'AP_ProbeLua').asType('int');
    if (path === 2n) {
      luaCount += 1n;
      f.setCustomVariable(actor, 'AP_ProbeLua', luaCount, false);
    }
    f.printString('AUTO_PETS_M3_PROBE request_guid_path');
    f.printString(f.dataTypeConversion(f.queryGuidByEntity(actor), 'str'));
    f.printString(f.dataTypeConversion(path, 'str'));
    f.sendSignal(reply, actor, seat, path, nativeCount, luaCount);
    return;
  }
  let seconds = 0n;
  if (ownerCount === 0n) {
    const remaining = f.get('closeAt') - f.queryGameTimeElapsed();
    if (remaining > 0n) seconds = remaining;
  }
  const revision = f.get('revision') + 1n;
  f.set('revision', revision);
  f.sendSignal(view, actor, revision, f.getListLength(players), seat, seconds, f.get('batch'), f.get('statuses'), f.get('work'));
  if (seat > 0n) {
    const nativeCount = f.getCustomVariable(actor, 'AP_ProbeNative').asType('int');
    const luaCount = f.getCustomVariable(actor, 'AP_ProbeLua').asType('int');
    f.sendSignal(reply, actor, seat, path, nativeCount, luaCount);
  }
});
