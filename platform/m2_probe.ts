/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [['action', 'int'], ['round', 'int']] as const);
const snapshot = defineSignal('client:AP_DuelSnapshot', [
  ['player', 'entity'], ['players', 'int'], ['seat', 'int'], ['round', 'int'],
  ['phase', 'int'], ['ready', 'bool'], ['continued', 'bool'], ['settlements', 'int'], ['version', 'int'],
] as const);

g.server({
  id: 1073741825,
  name: '_GSTS_AP_DuelProbe',
  variables: { round: 1n, phase: 0n, settlements: 0n, version: 0n },
}).onSignal(request, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  let fromPlayer = false;
  for (const player of players) {
    // Use event metadata, never a player identifier supplied by the client.
    if (f.equal(player, event.signalSourceEntity)) {
      fromPlayer = true;
      const round = f.get('round');
      if (players.length === 2 && event.params.round === round) {
        if (event.params.action === 1n && f.get('phase') === 0n) {
          f.setCustomVariable(player, 'AP_readyRound', round, false);
        }
        if (event.params.action === 2n && f.get('phase') === 1n) {
          f.setCustomVariable(player, 'AP_continueRound', round, false);
        }
      }
    }
  }
  if (!fromPlayer) {
    f.printString('AUTO_PETS_M2 missing_player_source');
    return;
  }

  const previousRound = f.get('round');
  const previousPhase = f.get('phase');
  if (players.length === 2) {
    let readyCount = 0n;
    let continueCount = 0n;
    for (const player of players) {
      if (f.getCustomVariable(player, 'AP_readyRound').asType('int') === previousRound) {
        readyCount += 1n;
      }
      if (f.getCustomVariable(player, 'AP_continueRound').asType('int') === previousRound) {
        continueCount += 1n;
      }
    }
    if (previousPhase === 0n && readyCount === 2n) {
      f.set('settlements', f.get('settlements') + 1n);
      if (previousRound === 1n) {
        f.set('phase', 1n);
      } else {
        f.set('phase', 2n);
      }
      f.printString('AUTO_PETS_M2 settled');
      f.printString(f.dataTypeConversion(previousRound, 'str'));
    }
    if (previousPhase === 1n && continueCount === 2n) {
      f.set('round', previousRound + 1n);
      f.set('phase', 0n);
    }
  }

  const round = f.get('round');
  const phase = f.get('phase');
  const settlements = f.get('settlements');
  const version = f.get('version') + 1n;
  f.set('version', version);
  let seat = 0n;
  for (const player of players) {
    seat += 1n;
    const ready = f.getCustomVariable(player, 'AP_readyRound').asType('int') === round;
    const continued = f.getCustomVariable(player, 'AP_continueRound').asType('int') === round;
    f.sendSignal(snapshot, player, f.getListLength(players), seat, round, phase, ready, continued, settlements, version);
  }
});
