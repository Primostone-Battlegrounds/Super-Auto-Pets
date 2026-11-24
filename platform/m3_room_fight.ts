/// <reference types="genshin-ts" />
import { g } from 'genshin-ts/runtime/core';

function gstsServerRoomBoard(f: BattleFlow, first: bigint[], second: bigint[]): bigint[] {
  const board = f.assemblyList([0n], 'int'); // AP_ROOM_BOARD
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
  id: 1073741826,
  name: '_GSTS_AP_EightFight',
  variables: {
    petEffects: list('int', [0n]), // AP_ROOM_EFFECTS
    startEffects: list('int', [0n]), // AP_ROOM_START_EFFECTS
    fights: dict('int', 'int_list', 0),
    openers: dict('int', 'int_list', 0),
    round: 0n, frame: -1n,
  },
})
.onSignal(roomFightWork, (event, f) => {
  const self = f.getSelfEntity();
  const ticket = f.getCustomVariable(self, 'AP_RoomTicket').asType('int');
  const round = event.params.round;
  const frame = event.params.frame;
  const pair = event.params.pair;
  if (ticket <= 0n || ticket !== event.params.ticket || !f.equal(self, event.signalSourceEntity)
      || round < f.get('round') || frame <= f.get('frame') || pair < 0n || pair >= 4n) return;
  let fights = f.get('fights');
  let openers = f.get('openers');
  if (round > f.get('round')) {
    fights = dict('int', 'int_list', 0);
    openers = dict('int', 'int_list', 0);
    f.set('round', round);
  }
  f.set('frame', frame);

  let board = f.emptyList('int');
  if (f.queryIfDictionaryContainsSpecificKey(fights, pair)) {
    board = f.copyList(f.queryDictionaryValueByKey(fights, pair));
  } else if (event.params.seed > 0n) {
    board = gstsServerRoomBoard(f, event.params.first, event.params.second);
    f.setOrAddKeyValuePairsToDictionary(openers, pair, gstsServerOpeningState(f, board, event.params.seed));
  } else {
    return;
  }
  let outcome = 0n;
  const flags = event.params.flags;
  if (flags === 3n) outcome = 3n;
  else if (flags === 1n) outcome = 2n;
  else if (flags === 2n) outcome = 1n;
  else if (f.queryIfDictionaryContainsSpecificKey(openers, pair)) {
    const openingState = f.copyList(f.queryDictionaryValueByKey(openers, pair));
    if (gstsServerOpeningStep(f, board, f.get('petEffects'), f.get('startEffects'), openingState, false)) {
      f.removeKeyValuePairsFromDictionaryByKey(openers, pair);
    } else {
      f.setOrAddKeyValuePairsToDictionary(openers, pair, openingState);
    }
  } else {
    outcome = gstsServerBattleOutcome(f, board);
    if (outcome === 0n) outcome = gstsServerCollisionStep(f, board, f.get('petEffects'), false);
  }
  f.setOrAddKeyValuePairsToDictionary(fights, pair, board);
  f.set('fights', fights);
  f.set('openers', openers);
  f.sendSignal(roomFightDone, ticket, round, frame, pair, flags, outcome, board);
});
