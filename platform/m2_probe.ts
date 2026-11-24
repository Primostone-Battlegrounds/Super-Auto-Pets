/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [
  ['action', 'int'], ['round', 'int'], ['sequence', 'int'], ['token', 'int'],
  ['from', 'int'], ['to', 'int'], ['flag', 'int'],
] as const);
const snapshot = defineSignal('client:AP_DuelSnapshot', [
  ['player', 'entity'], ['players', 'int'], ['seat', 'int'], ['round', 'int'],
  ['phase', 'int'], ['ready', 'bool'], ['continued', 'bool'], ['settlements', 'int'], ['version', 'int'],
  ['sequence', 'int'], ['winner', 'int'], ['reason', 'int'], ['remaining', 'int'], ['ack', 'int'],
  ['lives', 'int'], ['opponentLives', 'int'], ['outcome', 'int'],
] as const);
const market = defineSignal('client:AP_DuelMarket', [
  ['player', 'entity'], ['round', 'int'], ['version', 'int'], ['state', 'int_list'],
] as const);
const fightStart = defineSignal('AP_DuelFightStart', [
  ['round', 'int'], ['attempt', 'int'], ['seed', 'int'], ['first', 'int_list'], ['second', 'int_list'],
] as const);
const fightCancel = defineSignal('AP_DuelFightCancel', [['attempt', 'int']] as const);
const replay = defineSignal('client:AP_DuelReplay', [
  ['player', 'entity'], ['round', 'int'], ['seed', 'int'], ['outcome', 'int'],
  ['first', 'int_list'], ['second', 'int_list'],
] as const);

const preparationTime = 60n;
const settlementTime = 10n;
const roomTime = 2700n;
const recoveryTime = 15n;
const fightRetryTime = 5n;
const fightStrikeLimit = 0n; // AP_DUEL_STRIKE_LIMIT
const startingLives = 0n; // AP_DUEL_LIVES
const clock = 'AP_DuelClock';

// Transfer the locked lineup, independent of the private shop and its RNG.
function gstsServerDuelFormation(f: ShopFlow, shop: bigint[]): bigint[] {
  const result = f.emptyList('int');
  const count = f.getCorrespondingValueFromList(shop, shopCountAt);
  for (let slot = 0n; slot < count; slot += 1n) {
    const at = shopTeamAt + slot * shopUnitSize;
    const index = slot * 5n;
    f.insertValueIntoList(result, index, f.getCorrespondingValueFromList(shop, at));
    f.insertValueIntoList(result, index + 1n, f.getCorrespondingValueFromList(shop, at + 1n));
    f.insertValueIntoList(result, index + 2n, f.getCorrespondingValueFromList(shop, at + 2n));
    f.insertValueIntoList(result, index + 3n, f.getCorrespondingValueFromList(shop, at + 3n));
    f.insertValueIntoList(result, index + 4n, f.getCorrespondingValueFromList(shop, at + 4n));
  }
  return result;
}

g.server({
  id: 1073741825,
  name: '_GSTS_AP_DuelProbe',
  variables: {
    round: 1n, phase: 0n, settlements: 0n, version: 0n, enrolled: false,
    present: 0n, due: 0n, roomDue: 0n, absentDue: 0n, winner: 0n, reason: 0n,
    absentWinner: 0n,
    livesOne: startingLives, livesTwo: startingLives,
    battleAttempt: 0n, battleSeed: 0n, battleOutcome: 0n, fightRetryDue: 0n,
    replayOne: [0n], replayTwo: [0n],
    shopOne: [0n], // AP_DUEL_START_ONE
    shopTwo: [0n], // AP_DUEL_START_TWO
  },
}).on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, clock, true, [1]);
}).on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName === clock) f.sendSignal(request, -1n, 0n, 0n, 0n, 0n, 0n, 0n);
}).onSignal(request, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  const actor = event.signalSourceEntity;
  const action = event.params.action;
  const fromStage = (action === -1n || action === -2n) && f.equal(f.getSelfEntity(), actor);
  if (!fromStage) {
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
  if (mayProgress && !roomReady && remainingSeat > 0n) f.set('absentWinner', remainingSeat);
  if (mayProgress) {
    if (now >= f.get('roomDue')) {
      f.set('phase', 2n);
      f.set('reason', 4n);
      if (f.get('livesOne') > f.get('livesTwo')) f.set('winner', 1n);
      if (f.get('livesOne') < f.get('livesTwo')) f.set('winner', 2n);
      changed = true;
      mayProgress = false;
    } else if (absentDue > 0n && now >= absentDue) {
      f.set('phase', 2n);
      let winner = remainingSeat;
      if (roomReady) winner = f.get('absentWinner');
      f.set('winner', winner);
      f.set('reason', 3n);
      changed = true;
      mayProgress = false;
    } else if (roomReady && absentDue > 0n) {
      f.set('absentDue', 0n);
      f.set('absentWinner', 0n);
      changed = true;
    }
  }

  const phaseDue = f.get('due');
  if (mayProgress && !fromStage && action > 0n && event.params.round === previousRound) {
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
    } else if (seat > 0n && roomReady && now < phaseDue && currentShop && event.params.sequence === sequence + 1n) {
      let accepted = false;
      const actorReady = f.getCustomVariable(actor, 'AP_readyRound').asType('int') === previousRound;
      if (previousPhase === 0n && !actorReady) {
        let saved = f.get('shopOne');
        if (seat === 2n) saved = f.get('shopTwo');
        const teamCount = f.getCorrespondingValueFromList(saved, shopCountAt);
        if (action === 1n && teamCount > 0n) {
          f.setCustomVariable(actor, 'AP_readyRound', previousRound, false);
          accepted = true;
        }
        if (action >= 10n && action <= 17n) {
          const candidate = f.copyList(saved);
          accepted = gstsServerShopApply(f, candidate, action, event.params.from, event.params.to, event.params.flag);
          if (accepted) {
            if (seat === 1n) f.set('shopOne', candidate);
            else f.set('shopTwo', candidate);
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
      const seed = f.getRandomInteger(1n, 2147483646n);
      const attempt = f.get('battleAttempt') + 1n;
      f.set('phase', 3n);
      f.set('battleSeed', seed);
      f.set('battleAttempt', attempt);
      f.set('fightRetryDue', now + fightRetryTime);
      // Each opening slot and strike can use one timer tick. Leave time for
      // retransmission and delivery of the completion receipt.
      f.set('due', now + 2n * shopTeamSize + fightStrikeLimit + 3n * fightRetryTime);
      f.sendSignal(fightStart, previousRound, attempt, seed, f.get('shopOne'), f.get('shopTwo'));
      changed = true;
    }
    if (previousPhase === 1n && (continueCount === 2n || now >= phaseDue)) {
      f.set('round', previousRound + 1n);
      f.set('phase', 0n);
      f.set('due', now + preparationTime);
      f.set('battleOutcome', 0n);
      changed = true;
    }
  }

  // The separate combat graph advances one bounded step per timer. The room
  // may already have ended while that graph was computing its previous attempt.
  const fightExpired = mayProgress && previousPhase === 3n && now >= phaseDue;
  let restorePreparation = fightExpired && roomReady;
  if (mayProgress && !fightExpired && action === -2n && previousPhase === 3n && event.params.round === previousRound
    && event.params.sequence === f.get('battleAttempt')) {
    const outcome = event.params.from;
    if (outcome >= 1n && outcome <= 3n) {
      f.set('battleOutcome', outcome);
      f.set('replayOne', gstsServerDuelFormation(f, f.get('shopOne')));
      f.set('replayTwo', gstsServerDuelFormation(f, f.get('shopTwo')));
      f.set('settlements', f.get('settlements') + 1n);
      let remainingOne = f.get('livesOne');
      let remainingTwo = f.get('livesTwo');
      if (outcome === 1n) remainingTwo -= 1n;
      if (outcome === 2n) remainingOne -= 1n;
      f.set('livesOne', remainingOne);
      f.set('livesTwo', remainingTwo);
      if (remainingOne === 0n || remainingTwo === 0n) {
        f.set('phase', 2n);
        if (remainingOne === 0n) f.set('winner', 2n);
        else f.set('winner', 1n);
        f.set('reason', 5n);
      } else {
        f.set('phase', 1n);
        f.set('due', now + settlementTime);
      }
      changed = true;
      f.printString('AUTO_PETS_M2 settled');
      f.printString(f.dataTypeConversion(previousRound, 'str'));
    } else if (outcome === 4n && roomReady) restorePreparation = true;
  }
  if (restorePreparation) {
    f.set('phase', 0n);
    f.set('due', now + preparationTime);
    for (const player of players) f.setCustomVariable(player, 'AP_readyRound', 0n, false);
    f.sendSignal(fightCancel, f.get('battleAttempt'));
    changed = true;
    if (fightExpired) f.printString('AUTO_PETS_M2 fight_timeout');
    else f.printString('AUTO_PETS_M2 strike_limit');
  }

  if (fromStage && !changed) {
    if (action === -1n && mayProgress && roomReady && previousPhase === 3n && now >= f.get('fightRetryDue')) {
      f.set('fightRetryDue', now + fightRetryTime);
      f.sendSignal(fightStart, previousRound, f.get('battleAttempt'), f.get('battleSeed'), f.get('shopOne'), f.get('shopTwo'));
    }
    return;
  }
  const round = f.get('round');
  const phase = f.get('phase');
  const settlements = f.get('settlements');
  const version = f.get('version') + 1n;
  f.set('version', version);
  let remaining = f.get('due') - now;
  if (!roomReady) remaining = f.get('absentDue') - now;
  if (phase === 2n || phase === 3n || remaining < 0n) remaining = 0n;
  if (phase === 2n && previousPhase === 3n) f.sendSignal(fightCancel, f.get('battleAttempt'));
  const outcome = f.get('battleOutcome');
  for (const player of players) {
    if (changed || f.equal(actor, player)) {
      const seat = f.getCustomVariable(player, 'AP_shopSeat').asType('int');
      let privateShop = f.assemblyList([0n], 'int');
      let sequence = 0n;
      if (seat > 0n) {
        const shopRound = f.getCustomVariable(player, 'AP_shopRound').asType('int');
        let saved = f.get('shopOne');
        if (seat === 2n) saved = f.get('shopTwo');
        privateShop = f.copyList(saved);
        if (shopRound !== round) {
          if (shopRound > 0n) {
            gstsServerShopOpen(f, privateShop);
            const copy = f.copyList(privateShop);
            if (seat === 1n) f.set('shopOne', copy);
            else f.set('shopTwo', copy);
          }
          f.setCustomVariable(player, 'AP_shopRound', round, false);
          f.setCustomVariable(player, 'AP_sequence', 0n, false);
        }
        f.modifyValueInList(privateShop, shopRandomAt, 0n);
        f.modifyValueInList(privateShop, shopUidAt, 0n);
        sequence = f.getCustomVariable(player, 'AP_sequence').asType('int') + 1n;
      }
      const ready = f.getCustomVariable(player, 'AP_readyRound').asType('int') === round;
      const continued = f.getCustomVariable(player, 'AP_continueRound').asType('int') === round;
      let ack = 0n;
      if (!fromStage && f.equal(actor, player)) ack = event.params.token;
      let lives = 0n;
      let opponentLives = 0n;
      if (seat === 1n) {
        lives = f.get('livesOne');
        opponentLives = f.get('livesTwo');
      } else if (seat === 2n) {
        lives = f.get('livesTwo');
        opponentLives = f.get('livesOne');
      }
      f.sendSignal(snapshot, player, playerCount, seat, round, phase, ready, continued, settlements,
        version, sequence, f.get('winner'), f.get('reason'), remaining, ack, lives, opponentLives, outcome);
      f.sendSignal(market, player, round, version, privateShop);
      if (outcome > 0n && seat > 0n) {
        f.sendSignal(replay, player, round, f.get('battleSeed'), outcome, f.get('replayOne'), f.get('replayTwo'));
      }
    }
  }
});
