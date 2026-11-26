// Opening runs on a dense zero-head board, before the same list enters the
// collision ring. A separate list preserves original identity through compaction.
const openingRandomAt = 0n;
const openingCursorAt = 1n;
const openingIdsAt = 2n;
const openingHurtAt = openingIdsAt + 2n * battleSlots;

function gstsServerOpeningState(f: BattleFlow, board: bigint[], seed: bigint): bigint[] {
  let normalized = seed % shopRandomModulus;
  if (normalized < 0n) normalized += shopRandomModulus;
  if (normalized === 0n) normalized = 1n;
  const opening = f.assemblyList([normalized, 0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n /* AP_OPENING_HURT */], 'int');
  f.modifyValueInList(board, battleFirstAt, gstsServerPackedRandom(f, opening, openingRandomAt, 2n));
  return opening;
}

function gstsServerOpeningMove(f: BattleFlow, board: bigint[], opening: bigint[], from: bigint, to: bigint): void {
  for (let field = 0n; field < battleUnitSize; field += 1n) {
    f.modifyValueInList(board, to * battleUnitSize + field,
      f.getCorrespondingValueFromList(board, from * battleUnitSize + field));
  }
  f.modifyValueInList(opening, openingIdsAt + to, f.getCorrespondingValueFromList(opening, openingIdsAt + from));
  // AP_REACTIVE_BEGIN
  f.modifyValueInList(opening, openingHurtAt + to, f.getCorrespondingValueFromList(opening, openingHurtAt + from));
  // AP_REACTIVE_END
}

// AP_REACTIVE_BEGIN
function gstsServerBattleHurt(f: BattleFlow, board: bigint[], opening: bigint[], openingPower: bigint[],
  side: bigint, slot: bigint, trace: boolean): void {
  const offset = side * battleSlots;
  const target = (offset + slot) * battleUnitSize;
  if (f.getCorrespondingValueFromList(board, target + 2n) > 0n
    && f.getCorrespondingValueFromList(opening, openingHurtAt + offset + slot) === 0n) {
    f.modifyValueInList(opening, openingHurtAt + offset + slot, 1n);
    const code = f.getCorrespondingValueFromList(board, target);
    gstsServerOpeningLog(f, trace, 'skill', side, slot, code, 5n);
    const power = f.getCorrespondingValueFromList(openingPower, code - 1n);
    const level = f.getCorrespondingValueFromList(board, target + 5n);
    const size = f.getCorrespondingValueFromList(board, battleCountAt + side);
    let applied = false;
    for (let next = slot + 1n; next < size; next += 1n) {
      const recipient = (offset + next) * battleUnitSize;
      if (!applied && f.getCorrespondingValueFromList(board, recipient + 2n) > 0n) {
        const amount = power * level;
        f.modifyValueInList(board, recipient + 4n, f.getCorrespondingValueFromList(board, recipient + 4n) + amount);
        gstsServerOpeningLog(f, trace, 'shield', side, next, f.getCorrespondingValueFromList(board, recipient), amount);
        applied = true;
      }
    }
  }
}

function gstsServerBattleRally(f: BattleFlow, board: bigint[], openingEffect: bigint[], openingPower: bigint[], side: bigint,
  slot: bigint, gapEnd: bigint, size: bigint, trace: boolean): void {
  const offset = side * battleSlots;
  const target = (offset + slot) * battleUnitSize;
  for (let index = 0n; index < size; index += 1n) {
    if (index <= slot || index >= gapEnd) {
      const actor = (offset + index) * battleUnitSize;
      const code = f.getCorrespondingValueFromList(board, actor);
      if (f.getCorrespondingValueFromList(openingEffect, code - 1n) === 6n) {
        let actorSlot = index;
        if (index >= gapEnd) actorSlot -= gapEnd - slot - 1n;
        gstsServerOpeningLog(f, trace, 'skill', side, actorSlot, code, 6n);
        const effectPower = f.getCorrespondingValueFromList(openingPower, code - 1n);
        const level = f.getCorrespondingValueFromList(board, actor + 5n);
        let targetAttack = f.getCorrespondingValueFromList(board, target + 1n);
        let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
        let targetMaxHealth = f.getCorrespondingValueFromList(board, target + 3n);
        // AP_OPENING_RALLY
        f.modifyValueInList(board, target + 1n, targetAttack);
        f.modifyValueInList(board, target + 2n, targetHealth);
        f.modifyValueInList(board, target + 3n, targetMaxHealth);
        gstsServerOpeningLog(f, trace, 'buff', side, slot, f.getCorrespondingValueFromList(board, target), health);
      }
    }
  }
}
// AP_REACTIVE_END

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

function gstsServerBattleDamage(f: BattleFlow, board: bigint[], openingEffect: bigint[], side: bigint,
  slot: bigint, amount: bigint, trace: boolean): boolean {
  const target = (side * battleSlots + slot) * battleUnitSize;
  let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
  let targetShield = f.getCorrespondingValueFromList(board, target + 4n);
  // AP_OPENING_DAMAGE
  f.modifyValueInList(board, target + 2n, targetHealth);
  f.modifyValueInList(board, target + 4n, targetShield);
  const code = f.getCorrespondingValueFromList(board, target);
  gstsServerOpeningLog(f, trace, 'damage', side, slot, code, remaining);
  return false /* AP_OPENING_HURT_CHECK */;
}

function gstsServerBattleCollectFaints(f: BattleFlow, board: bigint[], opening: bigint[], faintEffect: bigint[],
  side: bigint, trace: boolean): bigint[] {
  const offset = side * battleSlots;
  const countAt = battleCountAt + side;
  const previous = f.getCorrespondingValueFromList(board, countAt);
  const fallen = f.assemblyList([0n], 'int');
  let size = 0n;
  for (let slot = 0n; slot < previous; slot += 1n) {
    const position = offset + slot;
    const target = position * battleUnitSize;
    const code = f.getCorrespondingValueFromList(board, target);
    if (f.getCorrespondingValueFromList(board, target + 2n) === 0n) {
      gstsServerOpeningLog(f, trace, 'faint', side, slot, code, 0n);
      if (f.getCorrespondingValueFromList(faintEffect, code - 1n) !== 0n) {
        const at = f.getListLength(fallen);
        f.insertValueIntoList(fallen, at, code);
        f.insertValueIntoList(fallen, at + 1n, f.getCorrespondingValueFromList(board, target + 5n));
        f.insertValueIntoList(fallen, at + 2n, size);
        f.insertValueIntoList(fallen, at + 3n, slot);
      }
    } else {
      if (size !== slot) gstsServerOpeningMove(f, board, opening, position, offset + size);
      size += 1n;
    }
  }
  f.modifyValueInList(board, countAt, size);
  return fallen;
}

function gstsServerBattleApplyFaints(f: BattleFlow, board: bigint[], opening: bigint[],
  faintEffect: bigint[], faintPower: bigint[],
  faintTarget: bigint[], faintAttack: bigint[], faintHealth: bigint[], openingEffect: bigint[], openingPower: bigint[],
  side: bigint, fallen: bigint[], trace: boolean): void {
  const offset = side * battleSlots;
  const countAt = battleCountAt + side;
  const queued = (f.getListLength(fallen) - 1n) / 4n;
  let size = f.getCorrespondingValueFromList(board, countAt);
  let inserted = 0n;
  for (let index = 0n; index < queued; index += 1n) {
    const entry = 1n + index * 4n;
    const code = f.getCorrespondingValueFromList(fallen, entry);
    const level = f.getCorrespondingValueFromList(fallen, entry + 1n);
    const metadata = code - 1n;
    const effect = f.getCorrespondingValueFromList(faintEffect, metadata);
    const power = f.getCorrespondingValueFromList(faintPower, metadata);
    const position = f.getCorrespondingValueFromList(fallen, entry + 2n) + inserted;
    // AP_REACTIVE_BEGIN
    gstsServerOpeningLog(f, trace, 'skill', side, f.getCorrespondingValueFromList(fallen, entry + 3n), code, 7n + effect);
    // AP_REACTIVE_END
    if (effect === 1n && size > 0n) {
      const target = offset * battleUnitSize;
      let targetHealth = f.getCorrespondingValueFromList(board, target + 2n);
      let targetMaxHealth = f.getCorrespondingValueFromList(board, target + 3n);
      // AP_OPENING_BUFF
      f.modifyValueInList(board, target + 2n, targetHealth);
      f.modifyValueInList(board, target + 3n, targetMaxHealth);
      gstsServerOpeningLog(f, trace, 'buff', side, 0n, f.getCorrespondingValueFromList(board, target), amount);
    } else if (effect === 2n) {
      const tokenCode = f.getCorrespondingValueFromList(faintTarget, metadata);
      const tokenAttack = f.getCorrespondingValueFromList(faintAttack, metadata);
      const tokenHealth = f.getCorrespondingValueFromList(faintHealth, metadata);
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
          // AP_REACTIVE_BEGIN
          f.modifyValueInList(opening, openingHurtAt + offset + slot, 0n);
          gstsServerBattleRally(f, board, openingEffect, openingPower, side, slot, position + count, size + count, trace);
          // AP_REACTIVE_END
        }
        size += count;
        inserted += count;
      }
    } else if (effect === 3n) {
      const amount = power * level;
      const count = gstsServerBattleShieldFront(f, board, side, 0n, size,
        f.getCorrespondingValueFromList(faintTarget, metadata), amount);
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
function gstsServerOpeningStep(f: BattleFlow, board: bigint[],
  faintEffect: bigint[], faintPower: bigint[],
  faintTarget: bigint[], faintAttack: bigint[], faintHealth: bigint[], openingEffect: bigint[], openingPower: bigint[],
  openingTargets: bigint[], opening: bigint[], trace: boolean): boolean {
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
      const effect = f.getCorrespondingValueFromList(openingEffect, code - 1n);
      const amount = f.getCorrespondingValueFromList(openingPower, code - 1n) * level;
      const targets = f.getCorrespondingValueFromList(openingTargets, code - 1n);
      gstsServerOpeningLog(f, trace && effect > 0n && effect <= 4n, 'skill', side, sourceSlot, code, effect);
      if (effect === 1n) {
        const count = gstsServerBattleShieldFront(f, board, side, 0n, currentSize, targets, amount);
        for (let slot = 0n; slot < count; slot += 1n) {
          const target = (offset + slot) * battleUnitSize;
          gstsServerOpeningLog(f, trace, 'shield', side, slot, f.getCorrespondingValueFromList(board, target), amount);
        }
      } else if (effect >= 2n && effect <= 4n) {
        const enemy = 1n - side;
        const size = f.getCorrespondingValueFromList(board, battleCountAt + enemy);
        let count = 1n;
        if (effect === 2n) count = f.takeSmallerValue(targets, size);
        const candidates = f.assemblyList([0n, 1n, 2n, 3n, 4n], 'int');
        // AP_REACTIVE_BEGIN
        const hit = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
        let hitCount = 0n;
        // AP_REACTIVE_END
        for (let pick = 0n; pick < count; pick += 1n) {
          let slot = 0n;
          if (effect === 2n) {
            const selected = gstsServerPackedRandom(f, opening, openingRandomAt, size - pick);
            slot = f.getCorrespondingValueFromList(candidates, selected);
            f.removeValueFromList(candidates, selected);
          } else if (effect === 4n) {
            slot = size - 1n;
          }
          const hurt = gstsServerBattleDamage(f, board, openingEffect, enemy, slot, amount, trace);
          // AP_REACTIVE_BEGIN
          if (hurt) {
            f.modifyValueInList(hit, hitCount, slot);
            hitCount += 1n;
          }
          // AP_REACTIVE_END
        }
        // AP_REACTIVE_BEGIN
        for (let index = 0n; index < hitCount; index += 1n) {
          gstsServerBattleHurt(f, board, opening, openingPower, enemy, f.getCorrespondingValueFromList(hit, index), trace);
        }
        // AP_REACTIVE_END
        const fallen = gstsServerBattleCollectFaints(f, board, opening, faintEffect, enemy, trace);
        gstsServerBattleApplyFaints(f, board, opening, faintEffect, faintPower, faintTarget, faintAttack, faintHealth,
          openingEffect, openingPower, enemy, fallen, trace);
      }
    }
    done = cursor + 1n >= 2n * battleSlots || gstsServerBattleOutcome(f, board) !== 0n;
  }
  return done;
}
