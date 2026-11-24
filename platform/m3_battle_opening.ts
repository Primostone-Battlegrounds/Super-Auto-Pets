// Opening runs on a dense zero-head board, before the same list enters the
// collision ring. A separate list preserves original identity through compaction.
const openingRandomAt = 0n;
const openingCursorAt = 1n;
const openingIdsAt = 2n;

function gstsServerOpeningState(f: BattleFlow, board: bigint[], seed: bigint): bigint[] {
  let normalized = seed % shopRandomModulus;
  if (normalized < 0n) normalized += shopRandomModulus;
  if (normalized === 0n) normalized = 1n;
  const opening = f.assemblyList([normalized, 0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n], 'int');
  f.modifyValueInList(board, battleFirstAt, gstsServerPackedRandom(f, opening, openingRandomAt, 2n));
  return opening;
}

function gstsServerOpeningMove(f: BattleFlow, board: bigint[], opening: bigint[], from: bigint, to: bigint): void {
  for (let field = 0n; field < battleUnitSize; field += 1n) {
    f.modifyValueInList(board, to * battleUnitSize + field,
      f.getCorrespondingValueFromList(board, from * battleUnitSize + field));
  }
  f.modifyValueInList(opening, openingIdsAt + to, f.getCorrespondingValueFromList(opening, openingIdsAt + from));
}

function gstsServerOpeningLog(f: BattleFlow, trace: boolean, event: string, side: bigint, slot: bigint,
  code: bigint, amount: bigint): void {
  if (trace) {
    f.printString(event);
    f.printString(f.dataTypeConversion(side, 'str'));
    f.printString(f.dataTypeConversion(slot, 'str'));
    f.printString(f.dataTypeConversion(code, 'str'));
    f.printString(f.dataTypeConversion(amount, 'str'));
  }
}

function gstsServerOpeningRetire(f: BattleFlow, board: bigint[], opening: bigint[], catalog: bigint[],
  side: bigint, trace: boolean): void {
  const offset = side * battleSlots;
  const countAt = battleCountAt + side;
  const previous = f.getCorrespondingValueFromList(board, countAt);
  const fallenCode = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
  const fallenLevel = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
  const survivorsBefore = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
  let queued = 0n;
  let size = 0n;
  for (let slot = 0n; slot < previous; slot += 1n) {
    const position = offset + slot;
    const target = position * battleUnitSize;
    const code = f.getCorrespondingValueFromList(board, target);
    if (f.getCorrespondingValueFromList(board, target + 2n) === 0n) {
      gstsServerOpeningLog(f, trace, 'faint', side, slot, code, 0n);
      if (f.getCorrespondingValueFromList(catalog, (code - 1n) * 5n) !== 0n) {
        f.modifyValueInList(fallenCode, queued, code);
        f.modifyValueInList(fallenLevel, queued, f.getCorrespondingValueFromList(board, target + 5n));
        f.modifyValueInList(survivorsBefore, queued, size);
        queued += 1n;
      }
    } else {
      if (size !== slot) gstsServerOpeningMove(f, board, opening, position, offset + size);
      size += 1n;
    }
  }

  let inserted = 0n;
  for (let index = 0n; index < queued; index += 1n) {
    const code = f.getCorrespondingValueFromList(fallenCode, index);
    const level = f.getCorrespondingValueFromList(fallenLevel, index);
    const metadata = (code - 1n) * 5n;
    const effect = f.getCorrespondingValueFromList(catalog, metadata);
    const power = f.getCorrespondingValueFromList(catalog, metadata + 1n);
    const position = f.getCorrespondingValueFromList(survivorsBefore, index) + inserted;
    if (effect === 1n && size > 0n) {
      const target = offset * battleUnitSize;
      let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
      let targetMaxHealth = f.getCorrespondingValueFromList(board, target + 3n);
      // AP_OPENING_BUFF
      f.modifyValueInList(board, target + 2n, targetHealth);
      f.modifyValueInList(board, target + 3n, targetMaxHealth);
      gstsServerOpeningLog(f, trace, 'buff', side, 0n, f.getCorrespondingValueFromList(board, target), amount);
    } else if (effect === 2n) {
      const tokenCode = f.getCorrespondingValueFromList(catalog, metadata + 2n);
      const tokenAttack = f.getCorrespondingValueFromList(catalog, metadata + 3n);
      const tokenHealth = f.getCorrespondingValueFromList(catalog, metadata + 4n);
      const slots = battleSlots;
      // AP_OPENING_SUMMON
      if (count > 0n) {
        for (let moved = 0n; moved < size - position; moved += 1n) {
          const slot = size - moved;
          gstsServerOpeningMove(f, board, opening, offset + slot - 1n, offset + slot + count - 1n);
        }
        for (let index = 0n; index < count; index += 1n) {
          const slot = position + index;
          const target = (offset + slot) * battleUnitSize;
          f.modifyValueInList(board, target, tokenCode);
          f.modifyValueInList(board, target + 1n, summonAttack);
          f.modifyValueInList(board, target + 2n, tokenHealth);
          f.modifyValueInList(board, target + 3n, tokenHealth);
          f.modifyValueInList(board, target + 4n, 0n);
          f.modifyValueInList(board, target + 5n, 1n);
          f.modifyValueInList(opening, openingIdsAt + offset + slot, 0n);
          gstsServerOpeningLog(f, trace, 'summon', side, slot, tokenCode, summonAttack);
        }
        size += count;
        inserted += count;
      }
    } else if (effect === 3n) {
      const amount = power * level;
      const count = gstsServerBattleShieldFront(f, board, side, 0n, size,
        f.getCorrespondingValueFromList(catalog, metadata + 2n), amount);
      for (let slot = 0n; slot < count; slot += 1n) {
        const target = (offset + slot) * battleUnitSize;
        gstsServerOpeningLog(f, trace, 'shield', side, slot, f.getCorrespondingValueFromList(board, target), amount);
      }
    }
  }
  f.modifyValueInList(board, countAt, size);
}

// Each call inspects at most one original slot. Tokens inserted by a previous
// faint never join the start queue, and a retired original actor is skipped.
// openingCatalog rows are [effect, power, targets], indexed by the shop's code.
function gstsServerOpeningStep(f: BattleFlow, board: bigint[], catalog: bigint[],
  openingCatalog: bigint[], opening: bigint[], trace: boolean): boolean {
  const cursor = f.getCorrespondingValueFromList(opening, openingCursorAt);
  let done = cursor >= 2n * battleSlots || gstsServerBattleOutcome(f, board) !== 0n;
  if (!done) {
    f.modifyValueInList(opening, openingCursorAt, cursor + 1n);
    const side = (f.getCorrespondingValueFromList(board, battleFirstAt) + cursor % 2n) % 2n;
    const offset = side * battleSlots;
    const currentSize = f.getCorrespondingValueFromList(board, battleCountAt + side);
    const original = offset + cursor / 2n + 1n;
    let sourceSlot = -1n;
    for (let slot = 0n; slot < currentSize; slot += 1n) {
      if (f.getCorrespondingValueFromList(opening, openingIdsAt + offset + slot) === original) sourceSlot = slot;
    }
    if (sourceSlot >= 0n) {
      const source = (offset + sourceSlot) * battleUnitSize;
      const code = f.getCorrespondingValueFromList(board, source);
      const level = f.getCorrespondingValueFromList(board, source + 5n);
      const meta = (code - 1n) * 3n;
      const effect = f.getCorrespondingValueFromList(openingCatalog, meta);
      const amount = f.getCorrespondingValueFromList(openingCatalog, meta + 1n) * level;
      const targets = f.getCorrespondingValueFromList(openingCatalog, meta + 2n);
      gstsServerOpeningLog(f, trace && effect !== 0n, 'skill', side, sourceSlot, code, effect);
      if (effect === 1n) {
        const count = gstsServerBattleShieldFront(f, board, side, 0n, currentSize, targets, amount);
        for (let slot = 0n; slot < count; slot += 1n) {
          const target = (offset + slot) * battleUnitSize;
          gstsServerOpeningLog(f, trace, 'shield', side, slot, f.getCorrespondingValueFromList(board, target), amount);
        }
      } else if (effect >= 2n) {
        const enemy = 1n - side;
        const size = f.getCorrespondingValueFromList(board, battleCountAt + enemy);
        let count = 1n;
        if (effect === 2n) count = f.takeSmallerValue(targets, size);
        const candidates = f.assemblyList([0n, 1n, 2n, 3n, 4n], 'int');
        for (let pick = 0n; pick < count; pick += 1n) {
          let slot = 0n;
          if (effect === 2n) {
            const selected = gstsServerPackedRandom(f, opening, openingRandomAt, size - pick);
            slot = f.getCorrespondingValueFromList(candidates, selected);
            f.removeValueFromList(candidates, selected);
          } else if (effect === 4n) {
            slot = size - 1n;
          }
          const target = (enemy * battleSlots + slot) * battleUnitSize;
          let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
          let targetShield = f.getCorrespondingValueFromList(board, target + 4n);
          // AP_OPENING_DAMAGE
          f.modifyValueInList(board, target + 2n, targetHealth);
          f.modifyValueInList(board, target + 4n, targetShield);
          gstsServerOpeningLog(f, trace, 'damage', enemy, slot, f.getCorrespondingValueFromList(board, target), remaining);
        }
        gstsServerOpeningRetire(f, board, opening, catalog, enemy, trace);
      }
    }
    done = cursor + 1n >= 2n * battleSlots || gstsServerBattleOutcome(f, board) !== 0n;
  }
  return done;
}
