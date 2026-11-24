/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [
  ['action', 'int'], ['round', 'int'], ['sequence', 'int'], ['token', 'int'],
] as const);
const snapshot = defineSignal('client:AP_DuelSnapshot', [
  ['player', 'entity'], ['players', 'int'], ['seat', 'int'], ['round', 'int'],
  ['phase', 'int'], ['ready', 'bool'], ['continued', 'bool'], ['settlements', 'int'], ['version', 'int'],
  ['sequence', 'int'], ['winner', 'int'], ['reason', 'int'], ['remaining', 'int'], ['ack', 'int'],
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
const preparationTime = 60n;
const settlementTime = 10n;
const roomTime = 2700n;
const recoveryTime = 15n;
const clock = 'AP_DuelClock';

g.server({
  id: 1073741825,
  name: '_GSTS_AP_DuelProbe',
  variables: {
    round: 1n, phase: 0n, settlements: 0n, version: 0n, enrolled: false,
    present: 0n, due: 0n, roomDue: 0n, absentDue: 0n, winner: 0n, reason: 0n,
    offersOne: [0n, 0n, 0n], offersTwo: [0n, 0n, 0n],
    teamOne: [0n, 0n, 0n, 0n, 0n], teamTwo: [0n, 0n, 0n, 0n, 0n],
  },
}).on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, clock, true, [1]);
}).on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName === clock) f.sendSignal(request, -1n, 0n, 0n, 0n);
}).onSignal(request, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  const actor = event.signalSourceEntity;
  const action = event.params.action;
  const fromClock = action === -1n && f.equal(f.getSelfEntity(), actor);
  if (!fromClock) {
    let fromPlayer = false;
    for (const player of players) {
      if (f.equal(player, actor)) fromPlayer = true;
    }
    if (!fromPlayer || action < 0n) {
      f.printString('AUTO_PETS_M2 missing_player_source');
      return;
    }
  }
  const now = f.queryGameTimeElapsed();
  let changed = false;
  if (!f.get('enrolled') && players.length === 2) {
    let seat = 0n;
    for (const player of players) {
      seat += 1n;
      f.setCustomVariable(player, 'AP_shopSeat', seat, false);
    }
    f.set('enrolled', true);
    f.set('due', now + preparationTime);
    f.set('roomDue', now + roomTime);
    changed = true;
  }
  let present = 0n;
  let remainingSeat = 0n;
  for (const player of players) {
    const seat = f.getCustomVariable(player, 'AP_shopSeat').asType('int');
    if (seat > 0n) {
      present += 1n;
      remainingSeat = seat;
    }
  }
  let playerCount = f.getListLength(players);
  if (f.get('enrolled')) playerCount = present;
  if (playerCount !== f.get('present')) {
    f.set('present', playerCount);
    changed = true;
  }

  const previousRound = f.get('round');
  const previousPhase = f.get('phase');
  const roomReady = present === 2n;
  let mayProgress = f.get('enrolled') && previousPhase !== 2n;
  let absentDue = f.get('absentDue');
  if (mayProgress && !roomReady && absentDue === 0n) {
    absentDue = now + recoveryTime;
    f.set('absentDue', absentDue);
    changed = true;
  }
  if (mayProgress) {
    if (now >= f.get('roomDue')) {
      f.set('phase', 2n);
      f.set('reason', 4n);
      changed = true;
      mayProgress = false;
    } else if (absentDue > 0n && now >= absentDue) {
      f.set('phase', 2n);
      if (!roomReady) f.set('winner', remainingSeat);
      f.set('reason', 3n);
      changed = true;
      mayProgress = false;
    } else if (roomReady && absentDue > 0n) {
      f.set('absentDue', 0n);
      changed = true;
    }
  }

  const phaseDue = f.get('due');
  if (mayProgress && !fromClock && action > 0n && event.params.round === previousRound) {
    const seat = f.getCustomVariable(actor, 'AP_shopSeat').asType('int');
    const sequence = f.getCustomVariable(actor, 'AP_sequence').asType('int');
    const currentShop = f.getCustomVariable(actor, 'AP_shopRound').asType('int') === previousRound;
    if (seat > 0n && event.params.sequence === sequence + 1n && currentShop && action === 6n) {
      f.set('phase', 2n);
      f.set('winner', 3n - seat);
      f.set('reason', 2n);
      f.setCustomVariable(actor, 'AP_sequence', sequence + 1n, false);
      changed = true;
      mayProgress = false;
    } else if (roomReady && now < phaseDue && currentShop && event.params.sequence === sequence + 1n) {
      let accepted = false;
      const actorReady = f.getCustomVariable(actor, 'AP_readyRound').asType('int') === previousRound;
      const teamCount = f.getCustomVariable(actor, 'AP_teamCount').asType('int');
      if (previousPhase === 0n && !actorReady) {
        if (action === 1n && teamCount > 0n) {
          f.setCustomVariable(actor, 'AP_readyRound', previousRound, false);
          accepted = true;
        }
        const slot = action - 3n;
        if (slot >= 0n && slot < offerSlots && teamCount < teamSize) {
          const gold = f.getCustomVariable(actor, 'AP_gold').asType('int');
          let currentOffers = f.get('offersOne');
          if (seat === 2n) currentOffers = f.get('offersTwo');
          const pet = f.getCorrespondingValueFromList(currentOffers, slot);
          if (gold >= petCost && pet > 0n) {
            const offers = f.copyList(currentOffers);
            let currentTeam = f.get('teamOne');
            if (seat === 2n) currentTeam = f.get('teamTwo');
            const team = f.copyList(currentTeam);
            f.modifyValueInList(offers, slot, 0n);
            f.modifyValueInList(team, teamCount, pet);
            if (seat === 1n) {
              f.set('offersOne', offers);
              f.set('teamOne', team);
            } else {
              f.set('offersTwo', offers);
              f.set('teamTwo', team);
            }
            f.setCustomVariable(actor, 'AP_gold', gold - petCost, false);
            f.setCustomVariable(actor, 'AP_teamCount', teamCount + 1n, false);
            accepted = true;
          }
        }
      }
      if (action === 2n && previousPhase === 1n) {
        if (f.getCustomVariable(actor, 'AP_continueRound').asType('int') !== previousRound) {
          f.setCustomVariable(actor, 'AP_continueRound', previousRound, false);
          accepted = true;
        }
      }
      if (accepted) {
        f.setCustomVariable(actor, 'AP_sequence', sequence + 1n, false);
        changed = true;
      }
    }
  }

  if (mayProgress && roomReady) {
    let readyCount = 0n;
    let continueCount = 0n;
    for (const player of players) {
      if (f.getCustomVariable(player, 'AP_readyRound').asType('int') === previousRound) readyCount += 1n;
      if (f.getCustomVariable(player, 'AP_continueRound').asType('int') === previousRound) continueCount += 1n;
    }
    if (previousPhase === 0n && (readyCount === 2n || now >= phaseDue)) {
      f.set('settlements', f.get('settlements') + 1n);
      if (previousRound === 1n) {
        f.set('phase', 1n);
        f.set('due', now + settlementTime);
      } else {
        f.set('phase', 2n);
        f.set('reason', 1n);
      }
      changed = true;
      f.printString('AUTO_PETS_M2 settled');
      f.printString(f.dataTypeConversion(previousRound, 'str'));
    }
    if (previousPhase === 1n && (continueCount === 2n || now >= phaseDue)) {
      f.set('round', previousRound + 1n);
      f.set('phase', 0n);
      f.set('due', now + preparationTime);
      changed = true;
    }
  }

  if (fromClock && !changed) return;
  const round = f.get('round');
  const phase = f.get('phase');
  const settlements = f.get('settlements');
  const version = f.get('version') + 1n;
  f.set('version', version);
  let remaining = f.get('due') - now;
  if (!roomReady) remaining = f.get('absentDue') - now;
  if (phase === 2n || remaining < 0n) remaining = 0n;
  const stocked = f.assemblyList([0n], 'int'); // AP_DUEL_OPENING_OFFERS
  for (const player of players) {
    if (changed || f.equal(actor, player)) {
      const seat = f.getCustomVariable(player, 'AP_shopSeat').asType('int');
      let offers = f.assemblyList([0n, 0n, 0n], 'int');
      let team = f.assemblyList([0n, 0n, 0n, 0n, 0n], 'int');
      let gold = 0n;
      let sequence = 0n;
      if (seat > 0n) {
        const shopRound = f.getCustomVariable(player, 'AP_shopRound').asType('int');
        if (shopRound !== round) {
          const start = ((round - 1n) * 2n + seat - 1n) * offerSlots;
          for (let index = 0n; index < offerSlots; index += 1n) {
            f.modifyValueInList(offers, index, f.getCorrespondingValueFromList(stocked, start + index));
          }
          if (seat === 1n) f.set('offersOne', offers);
          else f.set('offersTwo', offers);
          f.setCustomVariable(player, 'AP_gold', roundGold, false);
          f.setCustomVariable(player, 'AP_shopRound', round, false);
          f.setCustomVariable(player, 'AP_sequence', 0n, false);
        } else if (seat === 1n) {
          offers = f.get('offersOne');
        } else {
          offers = f.get('offersTwo');
        }
        if (seat === 1n) team = f.get('teamOne');
        else team = f.get('teamTwo');
        gold = f.getCustomVariable(player, 'AP_gold').asType('int');
        sequence = f.getCustomVariable(player, 'AP_sequence').asType('int') + 1n;
      }
      const ready = f.getCustomVariable(player, 'AP_readyRound').asType('int') === round;
      const continued = f.getCustomVariable(player, 'AP_continueRound').asType('int') === round;
      let ack = 0n;
      if (!fromClock && f.equal(actor, player)) ack = event.params.token;
      f.sendSignal(snapshot, player, playerCount, seat, round, phase, ready, continued, settlements,
        version, sequence, f.get('winner'), f.get('reason'), remaining, ack);
      f.sendSignal(market, player, round, version, gold, offers, team);
    }
  }
});
