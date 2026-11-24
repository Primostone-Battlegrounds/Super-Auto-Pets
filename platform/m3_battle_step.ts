/// <reference types="genshin-ts" />
import type { ServerExecutionFlowFunctionsByMode } from 'genshin-ts/definitions/nodes';

type BattleFlow = ServerExecutionFlowFunctionsByMode<'beyond'>;
const battleSlots = 5n;
const battleUnitSize = 6n;
const battleCountAt = 2n * battleSlots * battleUnitSize;
const battleHeadAt = battleCountAt + 2n;
const battleFirstAt = battleHeadAt + 2n;
const battleStrikeAt = battleFirstAt + 1n;
const battleStrikeLimit = 0n; // AP_STRIKE_LIMIT

// Packed board: ten 6-value unit rows (code, attack, health, max health,
// shield, level), followed by both sizes, both heads, first side and strike.
function gstsServerBattleOutcome(f: BattleFlow, board: bigint[]): bigint {
  const left = f.getCorrespondingValueFromList(board, battleCountAt);
  const right = f.getCorrespondingValueFromList(board, battleCountAt + 1n);
  let outcome = 0n;
  if (left === 0n && right === 0n) outcome = 3n;
  else if (right === 0n) outcome = 1n;
  else if (left === 0n) outcome = 2n;
  else if (f.getCorrespondingValueFromList(board, battleStrikeAt) >= battleStrikeLimit) outcome = 4n;
  return outcome;
}

function gstsServerBattleShieldFront(f: BattleFlow, board: bigint[], side: bigint, head: bigint,
  size: bigint, targets: bigint, amount: bigint): bigint {
  const count = f.takeSmallerValue(targets, size);
  for (let slot = 0n; slot < count; slot += 1n) {
    const at = (side * battleSlots + (head + slot) % battleSlots) * battleUnitSize + 4n;
    f.modifyValueInList(board, at, f.getCorrespondingValueFromList(board, at) + amount);
  }
  return count;
}

function gstsServerCollisionStep(f: BattleFlow, board: bigint[], catalog: bigint[], trace: boolean): bigint {
  const strike = f.getCorrespondingValueFromList(board, battleStrikeAt) + 1n;
  f.modifyValueInList(board, battleStrikeAt, strike);
  const firstSide = f.getCorrespondingValueFromList(board, battleFirstAt);
  const fronts = f.assemblyList([
    f.getCorrespondingValueFromList(board, battleHeadAt) * battleUnitSize,
    (battleSlots + f.getCorrespondingValueFromList(board, battleHeadAt + 1n)) * battleUnitSize,
  ], 'int');
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
    if (trace) {
      f.printString('damage');
      f.printString(f.dataTypeConversion(side, 'str'));
      f.printString(f.dataTypeConversion(remaining, 'str'));
      f.printString(f.dataTypeConversion(targetHealth, 'str'));
      f.printString(f.dataTypeConversion(targetShield, 'str'));
    }
  }

  // The five slots form a ring. Advance each head before applying either queued faint effect.
  const defeated = f.assemblyList([0n, 0n], 'int');
  const levels = f.assemblyList([0n, 0n], 'int');
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const side = (firstSide + offset) % 2n;
    const target = f.getCorrespondingValueFromList(fronts, side);
    if (f.getCorrespondingValueFromList(board, target + 2n) === 0n) {
      const countAt = battleCountAt + side;
      const headAt = battleHeadAt + side;
      const code = f.getCorrespondingValueFromList(board, target);
      f.modifyValueInList(defeated, side, code);
      f.modifyValueInList(levels, side, f.getCorrespondingValueFromList(board, target + 5n));
      f.modifyValueInList(board, headAt, (f.getCorrespondingValueFromList(board, headAt) + 1n) % battleSlots);
      f.modifyValueInList(board, countAt, f.getCorrespondingValueFromList(board, countAt) - 1n);
      if (trace) {
        f.printString('faint');
        f.printString(f.dataTypeConversion(side, 'str'));
        f.printString(f.dataTypeConversion(code, 'str'));
      }
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
    const countAt = battleCountAt + side;
    const headAt = battleHeadAt + side;
    const size = f.getCorrespondingValueFromList(board, countAt);
    const head = f.getCorrespondingValueFromList(board, headAt);
    if (effect === 1n && size > 0n) {
      const target = (side * battleSlots + head) * battleUnitSize;
      let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
      let targetMaxHealth = f.getCorrespondingValueFromList(board, target + 3n);
      // AP_LOWERED_BUFF
      f.modifyValueInList(board, target + 2n, targetHealth);
      f.modifyValueInList(board, target + 3n, targetMaxHealth);
      if (trace) {
        f.printString('buff');
        f.printString(f.dataTypeConversion(side, 'str'));
        f.printString(f.dataTypeConversion(amount, 'str'));
      }
    } else if (effect === 2n) {
      const tokenCode = f.getCorrespondingValueFromList(catalog, meta + 2n);
      const tokenAttack = f.getCorrespondingValueFromList(catalog, meta + 3n);
      const tokenHealth = f.getCorrespondingValueFromList(catalog, meta + 4n);
      // AP_LOWERED_SUMMON
      const newHead = (head + battleSlots - count) % battleSlots;
      f.modifyValueInList(board, headAt, newHead);
      f.modifyValueInList(board, countAt, size + count);
      for (let generated = 0n; generated < count; generated += 1n) {
        const target = (side * battleSlots + (newHead + generated) % battleSlots) * battleUnitSize;
        f.modifyValueInList(board, target, tokenCode);
        f.modifyValueInList(board, target + 1n, summonAttack);
        f.modifyValueInList(board, target + 2n, tokenHealth);
        f.modifyValueInList(board, target + 3n, tokenHealth);
        f.modifyValueInList(board, target + 4n, 0n);
        f.modifyValueInList(board, target + 5n, 1n);
        if (trace) {
          f.printString('summon');
          f.printString(f.dataTypeConversion(side, 'str'));
          f.printString(f.dataTypeConversion(tokenCode, 'str'));
          f.printString(f.dataTypeConversion(summonAttack, 'str'));
          f.printString(f.dataTypeConversion(tokenHealth, 'str'));
        }
      }
    } else if (effect === 3n) {
      const targets = f.getCorrespondingValueFromList(catalog, meta + 2n);
      const amount = power * level;
      const count = gstsServerBattleShieldFront(f, board, side, head, size, targets, amount);
      if (trace) {
        for (let slot = 0n; slot < count; slot += 1n) {
          f.printString('shield');
          f.printString(f.dataTypeConversion(side, 'str'));
          f.printString(f.dataTypeConversion(slot, 'str'));
          f.printString(f.dataTypeConversion(amount, 'str'));
        }
      }
    }
  }
  return gstsServerBattleOutcome(f, board);
}
