/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [['action', 'int'], ['round', 'int']] as const);
const snapshot = defineSignal('client:AP_DuelSnapshot', [
  ['player', 'entity'], ['players', 'int'], ['seat', 'int'], ['round', 'int'],
  ['phase', 'int'], ['ready', 'bool'], ['continued', 'bool'], ['settlements', 'int'], ['version', 'int'],
] as const);
const market = defineSignal('client:AP_DuelMarket', [
  ['player', 'entity'], ['round', 'int'], ['version', 'int'], ['gold', 'int'],
  ['offers', 'int_list'], ['team', 'int_list'],
] as const);

// Filled from the existing Lua shop and duel definitions when the GIL is built.
const roundGold = 0n; // AP_DUEL_ROUND_GOLD
const petCost = 0n; // AP_DUEL_PET_COST
const offerSlots = 0n; // AP_DUEL_OFFER_SLOTS
const teamSize = 0n; // AP_DUEL_TEAM_SIZE

g.server({
  id: 1073741825,
  name: '_GSTS_AP_DuelProbe',
  variables: { round: 1n, phase: 0n, settlements: 0n, version: 0n, enrolled: false },
}).onSignal(request, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  const actor = event.signalSourceEntity;
  let fromPlayer = false;
  for (const player of players) {
    if (f.equal(player, actor)) fromPlayer = true;
  }
  if (!fromPlayer) {
    f.printString('AUTO_PETS_M2 missing_player_source');
    return;
  }

  if (!f.get('enrolled') && players.length === 2) {
    let seat = 0n;
    for (const player of players) {
      seat += 1n;
      f.setCustomVariable(player, 'AP_shopSeat', seat, false);
    }
    f.set('enrolled', true);
  }
  let present = 0n;
  for (const player of players) {
    if (f.getCustomVariable(player, 'AP_shopSeat').asType('int') > 0n) present += 1n;
  }

  const previousRound = f.get('round');
  const previousPhase = f.get('phase');
  const roomReady = players.length === 2 && present === 2n;
  if (roomReady && event.params.round === previousRound) {
    const action = event.params.action;
    const actorReady = f.getCustomVariable(actor, 'AP_readyRound').asType('int') === previousRound;
    const teamCount = f.getCustomVariable(actor, 'AP_teamCount').asType('int');
    if (previousPhase === 0n && !actorReady) {
      if (action === 1n && teamCount > 0n) {
        f.setCustomVariable(actor, 'AP_readyRound', previousRound, false);
      }
      const slot = action - 3n;
      const shopRound = f.getCustomVariable(actor, 'AP_shopRound').asType('int');
      if (shopRound === previousRound && slot >= 0n && slot < offerSlots && teamCount < teamSize) {
        const gold = f.getCustomVariable(actor, 'AP_gold').asType('int');
        const currentOffers = f.getCustomVariable(actor, 'AP_offers').asType('int_list');
        const pet = f.getCorrespondingValueFromList(currentOffers, slot);
        if (gold >= petCost && pet > 0n) {
          const offers = f.copyList(currentOffers);
          const team = f.copyList(f.getCustomVariable(actor, 'AP_team').asType('int_list'));
          f.modifyValueInList(offers, slot, 0n);
          f.modifyValueInList(team, teamCount, pet);
          f.setCustomVariable(actor, 'AP_offers', offers, false);
          f.setCustomVariable(actor, 'AP_team', team, false);
          f.setCustomVariable(actor, 'AP_gold', gold - petCost, false);
          f.setCustomVariable(actor, 'AP_teamCount', teamCount + 1n, false);
        }
      }
    }
    if (action === 2n && previousPhase === 1n) {
      f.setCustomVariable(actor, 'AP_continueRound', previousRound, false);
    }
  }

  if (roomReady) {
    let readyCount = 0n;
    let continueCount = 0n;
    for (const player of players) {
      if (f.getCustomVariable(player, 'AP_readyRound').asType('int') === previousRound) readyCount += 1n;
      if (f.getCustomVariable(player, 'AP_continueRound').asType('int') === previousRound) continueCount += 1n;
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
  const stocked = f.assemblyList([0n], 'int'); // AP_DUEL_OPENING_OFFERS
  let playerCount = f.getListLength(players);
  if (f.get('enrolled')) playerCount = present;
  for (const player of players) {
    const seat = f.getCustomVariable(player, 'AP_shopSeat').asType('int');
    let offers = f.assemblyList([0n, 0n, 0n], 'int');
    let team = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
    let gold = 0n;
    if (seat > 0n) {
      const shopRound = f.getCustomVariable(player, 'AP_shopRound').asType('int');
      if (shopRound !== round) {
        const start = ((round - 1n) * 2n + seat - 1n) * offerSlots;
        for (let index = 0n; index < offerSlots; index += 1n) {
          f.modifyValueInList(offers, index, f.getCorrespondingValueFromList(stocked, start + index));
        }
        f.setCustomVariable(player, 'AP_offers', offers, false);
        f.setCustomVariable(player, 'AP_gold', roundGold, false);
        if (shopRound === 0n) f.setCustomVariable(player, 'AP_team', team, false);
        f.setCustomVariable(player, 'AP_shopRound', round, false);
      }
      offers = f.getCustomVariable(player, 'AP_offers').asType('int_list');
      team = f.getCustomVariable(player, 'AP_team').asType('int_list');
      gold = f.getCustomVariable(player, 'AP_gold').asType('int');
    }
    const ready = f.getCustomVariable(player, 'AP_readyRound').asType('int') === round;
    const continued = f.getCustomVariable(player, 'AP_continueRound').asType('int') === round;
    f.sendSignal(snapshot, player, playerCount, seat, round, phase, ready, continued, settlements, version);
    f.sendSignal(market, player, round, version, gold, offers, team);
  }
});
