// The release board stays dense. A splash can retire slot two independently
// of the front, so both sides compact before either queued faint effect runs.
function gstsServerReleaseCollisionStep(f: BattleFlow, board: bigint[],
  faintEffect: bigint[], faintPower: bigint[],
  faintTarget: bigint[], faintAttack: bigint[], faintHealth: bigint[], openingEffect: bigint[], openingPower: bigint[],
  opening: bigint[], trace: boolean): bigint {
  f.modifyValueInList(board, battleStrikeAt, f.getCorrespondingValueFromList(board, battleStrikeAt) + 1n);
  const first = f.getCorrespondingValueFromList(board, battleFirstAt);
  const hurt = f.assemblyList([0n, 0n, 0n, 0n], 'int');
  let queued = 0n;
  if (trace) {
    for (let offset = 0n; offset < 2n; offset += 1n) {
      const actor = (first + offset) % 2n;
      const at = actor * battleSlots * battleUnitSize;
      gstsServerOpeningLog(f, true, 'attack', actor, 0n, f.getCorrespondingValueFromList(board, at),
        f.getCorrespondingValueFromList(board, at + 1n));
    }
  }
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const actor = (first + offset) % 2n;
    const target = 1n - actor;
    const attack = f.getCorrespondingValueFromList(board, actor * battleSlots * battleUnitSize + 1n);
    if (gstsServerBattleDamage(f, board, openingEffect, target, 0n, attack, trace)) {
      f.modifyValueInList(hurt, queued, target * battleSlots);
      queued += 1n;
    }
  }
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const actor = (first + offset) % 2n;
    const target = 1n - actor;
    const at = actor * battleSlots * battleUnitSize;
    const code = f.getCorrespondingValueFromList(board, at);
    if (f.getCorrespondingValueFromList(openingEffect, code - 1n) === 7n
      && f.getCorrespondingValueFromList(board, battleCountAt + target) >= 2n) {
      gstsServerOpeningLog(f, trace, 'skill', actor, 0n, code, 7n);
      const level = f.getCorrespondingValueFromList(board, at + 5n);
      const power = f.getCorrespondingValueFromList(openingPower, code - 1n) * level;
      if (gstsServerBattleDamage(f, board, openingEffect, target, 1n, power, trace)) {
        f.modifyValueInList(hurt, queued, target * battleSlots + 1n);
        queued += 1n;
      }
    }
  }
  for (let index = 0n; index < queued; index += 1n) {
    const target = f.getCorrespondingValueFromList(hurt, index);
    gstsServerBattleHurt(f, board, opening, openingPower, target / battleSlots, target % battleSlots, trace);
  }
  const firstFaints = gstsServerBattleCollectFaints(f, board, opening, faintEffect, first, trace);
  const secondFaints = gstsServerBattleCollectFaints(f, board, opening, faintEffect, 1n - first, trace);
  gstsServerBattleApplyFaints(f, board, opening, faintEffect, faintPower, faintTarget, faintAttack, faintHealth,
    openingEffect, openingPower, first, firstFaints, trace);
  gstsServerBattleApplyFaints(f, board, opening, faintEffect, faintPower, faintTarget, faintAttack, faintHealth,
    openingEffect, openingPower, 1n - first, secondFaints, trace);
  return gstsServerBattleOutcome(f, board);
}
