/// <reference types="genshin-ts" />
import { g } from 'genshin-ts/runtime/core';

const clock = 'AP_CollisionProbe';
const pairs = 4n;
const slots = 5n;
const fieldsPerUnit = 6n;
const strikeLimit = 0n; // AP_STRIKE_LIMIT

g.server({
  id: 1073741825,
  name: '_GSTS_AP_CollisionProbe',
  variables: {
    board0: list('int', [0n]), // AP_PROBE_BOARD0
    board1: list('int', [0n]), // AP_PROBE_BOARD1
    board2: list('int', [0n]), // AP_PROBE_BOARD2
    board3: list('int', [0n]), // AP_PROBE_BOARD3
    counts: list('int', [0n]), // AP_PROBE_COUNTS
    firsts: list('int', [0n]), // AP_PROBE_FIRSTS
    catalog: list('int', [0n]), // AP_PROBE_CATALOG
    heads: list('int', [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]),
    strikes: list('int', [0n, 0n, 0n, 0n]),
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
  const strikes = f.copyList(f.get('strikes'));
  const strike = f.getCorrespondingValueFromList(strikes, pair) + 1n;
  f.modifyValueInList(strikes, pair, strike);
  f.set('strikes', strikes);

  let previousBoard = f.get('board0');
  if (pair === 1n) previousBoard = f.get('board1');
  else if (pair === 2n) previousBoard = f.get('board2');
  else if (pair === 3n) previousBoard = f.get('board3');
  const board = f.copyList(previousBoard);
  const heads = f.copyList(f.get('heads'));
  const counts = f.copyList(f.get('counts'));
  const firstSide = f.getCorrespondingValueFromList(f.get('firsts'), pair);
  const catalog = f.get('catalog');
  const left = pair * 2n;
  const right = left + 1n;
  const fronts = f.assemblyList([
    f.getCorrespondingValueFromList(heads, left) * fieldsPerUnit,
    (slots + f.getCorrespondingValueFromList(heads, right)) * fieldsPerUnit,
  ], 'int');

  f.printString('AUTO_PETS_COLLISION_PROBE strike');
  f.printString(f.dataTypeConversion(pair + 1n, 'str'));
  f.printString(f.dataTypeConversion(strike, 'str'));

  // Both fronts have committed before any actor is retired. Neither attack field changes during damage.
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const side = (firstSide + 1n + offset) % 2n;
    const target = f.getCorrespondingValueFromList(fronts, side);
    const source = f.getCorrespondingValueFromList(fronts, 1n - side);
    const amount = f.getCorrespondingValueFromList(board, source + 1n);
    let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
    let targetShield = f.getCorrespondingValueFromList(board, target + 4n);
    // AP_LOWERED_DAMAGE
    f.modifyValueInList(board, target + 2n, targetHealth);
    f.modifyValueInList(board, target + 4n, targetShield);
    f.printString('damage');
    f.printString(f.dataTypeConversion(side, 'str'));
    f.printString(f.dataTypeConversion(remaining, 'str'));
    f.printString(f.dataTypeConversion(targetHealth, 'str'));
    f.printString(f.dataTypeConversion(targetShield, 'str'));
  }

  // The five slots form a ring. Advance a head for each faint before applying either queued effect.
  const defeated = f.assemblyList([0n, 0n], 'int');
  const levels = f.assemblyList([0n, 0n], 'int');
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const side = (firstSide + offset) % 2n;
    const target = f.getCorrespondingValueFromList(fronts, side);
    if (f.getCorrespondingValueFromList(board, target + 2n) === 0n) {
      const index = left + side;
      const code = f.getCorrespondingValueFromList(board, target);
      f.modifyValueInList(defeated, side, code);
      f.modifyValueInList(levels, side, f.getCorrespondingValueFromList(board, target + 5n));
      f.modifyValueInList(heads, index, (f.getCorrespondingValueFromList(heads, index) + 1n) % slots);
      f.modifyValueInList(counts, index, f.getCorrespondingValueFromList(counts, index) - 1n);
      f.printString('faint');
      f.printString(f.dataTypeConversion(side, 'str'));
      f.printString(f.dataTypeConversion(code, 'str'));
    }
  }
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const side = (firstSide + offset) % 2n;
    const code = f.getCorrespondingValueFromList(defeated, side);
    if (code === 0n) continue;
    const meta = (code - 1n) * 5n;
    const effect = f.getCorrespondingValueFromList(catalog, meta);
    if (effect === 0n) continue;
    const power = f.getCorrespondingValueFromList(catalog, meta + 1n);
    const level = f.getCorrespondingValueFromList(levels, side);
    const index = left + side;
    const size = f.getCorrespondingValueFromList(counts, index);
    const head = f.getCorrespondingValueFromList(heads, index);
    if (effect === 1n && size > 0n) {
      const target = (side * slots + head) * fieldsPerUnit;
      let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
      let targetMaxHealth = f.getCorrespondingValueFromList(board, target + 3n);
      // AP_LOWERED_BUFF
      f.modifyValueInList(board, target + 2n, targetHealth);
      f.modifyValueInList(board, target + 3n, targetMaxHealth);
      f.printString('buff');
      f.printString(f.dataTypeConversion(side, 'str'));
      f.printString(f.dataTypeConversion(amount, 'str'));
    } else if (effect === 2n) {
      const tokenCode = f.getCorrespondingValueFromList(catalog, meta + 2n);
      const tokenAttack = f.getCorrespondingValueFromList(catalog, meta + 3n);
      const tokenHealth = f.getCorrespondingValueFromList(catalog, meta + 4n);
      // AP_LOWERED_SUMMON
      const newHead = (head + slots - count) % slots;
      f.modifyValueInList(heads, index, newHead);
      f.modifyValueInList(counts, index, size + count);
      for (let generated = 0n; generated < count; generated += 1n) {
        const target = (side * slots + (newHead + generated) % slots) * fieldsPerUnit;
        f.modifyValueInList(board, target, tokenCode);
        f.modifyValueInList(board, target + 1n, summonAttack);
        f.modifyValueInList(board, target + 2n, tokenHealth);
        f.modifyValueInList(board, target + 3n, tokenHealth);
        f.modifyValueInList(board, target + 4n, 0n);
        f.modifyValueInList(board, target + 5n, 1n);
        f.printString('summon');
        f.printString(f.dataTypeConversion(side, 'str'));
        f.printString(f.dataTypeConversion(tokenCode, 'str'));
        f.printString(f.dataTypeConversion(summonAttack, 'str'));
        f.printString(f.dataTypeConversion(tokenHealth, 'str'));
      }
    }
  }
  if (pair === 0n) f.set('board0', board);
  else if (pair === 1n) f.set('board1', board);
  else if (pair === 2n) f.set('board2', board);
  else f.set('board3', board);
  f.set('heads', heads);
  f.set('counts', counts);

  const firstCount = f.getCorrespondingValueFromList(counts, left);
  const secondCount = f.getCorrespondingValueFromList(counts, right);
  let outcome = 0n;
  if (firstCount === 0n && secondCount === 0n) outcome = 3n;
  else if (secondCount === 0n) outcome = 1n;
  else if (firstCount === 0n) outcome = 2n;
  else if (strike >= strikeLimit) outcome = 4n;
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
