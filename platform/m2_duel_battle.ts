/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const fightStart = defineSignal('AP_DuelFightStart', [
  ['round', 'int'], ['attempt', 'int'], ['seed', 'int'], ['first', 'int_list'], ['second', 'int_list'],
] as const);
const fightCancel = defineSignal('AP_DuelFightCancel', [['attempt', 'int']] as const);
const request = defineSignal('AP_DuelRequest', [
  ['action', 'int'], ['round', 'int'], ['sequence', 'int'], ['token', 'int'],
  ['from', 'int'], ['to', 'int'], ['flag', 'int'],
] as const);
const fightClock = 'AP_DuelFightClock';

function gstsServerDuelBoard(f: BattleFlow, first: bigint[], second: bigint[]): bigint[] {
  const board = f.assemblyList([0n], 'int'); // AP_DUEL_BOARD
  for (let side = 0n; side < 2n; side += 1n) {
    let stock = first;
    if (side === 1n) stock = second;
    const count = f.getCorrespondingValueFromList(stock, shopCountAt);
    f.modifyValueInList(board, battleCountAt + side, count);
    for (let slot = 0n; slot < count; slot += 1n) {
      const unit = shopTeamAt + slot * shopUnitSize;
      const cell = (side * battleSlots + slot) * battleUnitSize;
      const health = f.getCorrespondingValueFromList(stock, unit + 3n);
      f.modifyValueInList(board, cell, f.getCorrespondingValueFromList(stock, unit));
      f.modifyValueInList(board, cell + 1n, f.getCorrespondingValueFromList(stock, unit + 2n));
      f.modifyValueInList(board, cell + 2n, health);
      f.modifyValueInList(board, cell + 3n, health);
      f.modifyValueInList(board, cell + 5n, f.getCorrespondingValueFromList(stock, unit + 4n));
    }
  }
  return board;
}

g.server({
  id: 1073741827,
  name: '_GSTS_AP_DuelBattle',
  variables: {
    attempt: 0n, active: false, round: 0n, outcome: 0n, openingDone: false, board: [0n], openingState: [0n],
    fainting: [0n], // AP_DUEL_FAINT
    metadata: [0n], // AP_DUEL_OPENING
  },
}).onSignal(fightStart, (event, f) => {
  const priorAttempt = f.get('attempt');
  if (!f.equal(f.getSelfEntity(), event.signalSourceEntity) || event.params.attempt < priorAttempt) return;
  if (event.params.attempt === priorAttempt) {
    const outcome = f.get('outcome');
    if (event.params.round === f.get('round') && outcome > 0n) {
      f.sendSignal(request, -2n, event.params.round, priorAttempt, 0n, outcome, 0n, 0n);
    }
    return;
  }
  // A new attempt can only be sent by the stage's match controller.
  const board = gstsServerDuelBoard(f, event.params.first, event.params.second);
  const opening = gstsServerOpeningState(f, board, event.params.seed);
  f.set('round', event.params.round);
  f.set('attempt', event.params.attempt);
  f.set('board', board);
  f.set('openingState', opening);
  f.set('openingDone', false);
  f.set('outcome', 0n);
  if (f.get('active')) f.stopTimer(f.getSelfEntity(), fightClock);
  f.set('active', true);
  f.startTimer(f.getSelfEntity(), fightClock, true, [1]);
}).onSignal(fightCancel, (event, f) => {
  if (!f.equal(f.getSelfEntity(), event.signalSourceEntity) || event.params.attempt < f.get('attempt')) return;
  f.set('attempt', event.params.attempt);
  f.set('outcome', 0n);
  if (f.get('active')) f.stopTimer(f.getSelfEntity(), fightClock);
  f.set('active', false);
}).on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== fightClock || !f.get('active')) return;
  const board = f.get('board');
  const fainting = f.get('fainting');
  const metadata = f.get('metadata');
  let outcome = gstsServerBattleOutcome(f, board);
  if (outcome === 0n) {
    if (f.get('openingDone')) {
      outcome = gstsServerCollisionStep(f, board, fainting, false); // AP_DUEL_COLLISION
    } else {
      const opening = f.get('openingState');
      const complete = gstsServerOpeningStep(f, board, fainting, metadata, opening, false);
      f.set('openingState', opening);
      f.set('openingDone', complete);
      outcome = gstsServerBattleOutcome(f, board);
    }
  }
  f.set('board', board);
  if (outcome !== 0n) {
    f.stopTimer(f.getSelfEntity(), fightClock);
    f.set('active', false);
    f.set('outcome', outcome);
    f.sendSignal(request, -2n, f.get('round'), f.get('attempt'), 0n, outcome, 0n, 0n);
  }
});
