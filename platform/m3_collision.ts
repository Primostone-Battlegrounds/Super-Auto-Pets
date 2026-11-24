/// <reference types="genshin-ts" />
import { g } from 'genshin-ts/runtime/core';

const clock = 'AP_CollisionProbe';
const pairs = 4n;

g.server({
  id: 1073741825,
  name: '_GSTS_AP_CollisionProbe',
  variables: {
    board0: list('int', [0n]), // AP_PROBE_BOARD0
    board1: list('int', [0n]), // AP_PROBE_BOARD1
    board2: list('int', [0n]), // AP_PROBE_BOARD2
    board3: list('int', [0n]), // AP_PROBE_BOARD3
    catalog: list('int', [0n]), // AP_PROBE_CATALOG
    status: list('int', [0n, 0n, 0n, 0n]),
    active: 4n, cursor: 0n, lastTick: -1n,
  },
})
.on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, clock, true, [1]);
  f.printString('AUTO_PETS_COLLISION_PROBE start');
})
.on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== clock) return;
  const now = f.queryGameTimeElapsed();
  if (now <= f.get('lastTick') || f.get('active') === 0n) return;
  f.set('lastTick', now);

  const pair = f.get('cursor');
  f.set('cursor', (pair + 1n) % pairs);
  const status = f.copyList(f.get('status'));
  if (f.getCorrespondingValueFromList(status, pair) !== 0n) return;
  let previousBoard = f.get('board0');
  if (pair === 1n) previousBoard = f.get('board1');
  else if (pair === 2n) previousBoard = f.get('board2');
  else if (pair === 3n) previousBoard = f.get('board3');
  const board = f.copyList(previousBoard);
  f.printString('AUTO_PETS_COLLISION_PROBE strike');
  f.printString(f.dataTypeConversion(pair + 1n, 'str'));
  f.printString(f.dataTypeConversion(f.getCorrespondingValueFromList(board, battleStrikeAt) + 1n, 'str'));
  const outcome = gstsServerCollisionStep(f, board, f.get('catalog'), true);
  if (pair === 0n) f.set('board0', board);
  else if (pair === 1n) f.set('board1', board);
  else if (pair === 2n) f.set('board2', board);
  else f.set('board3', board);
  if (outcome === 0n) return;
  f.modifyValueInList(status, pair, outcome);
  f.set('status', status);
  const stillActive = f.get('active') - 1n;
  f.set('active', stillActive);
  f.printString('AUTO_PETS_COLLISION_PROBE outcome');
  f.printString(f.dataTypeConversion(pair + 1n, 'str'));
  f.printString(f.dataTypeConversion(outcome, 'str'));
  if (stillActive === 0n) {
    f.stopTimer(event.eventSourceEntity, clock);
    f.printString('AUTO_PETS_COLLISION_PROBE done');
  }
});
