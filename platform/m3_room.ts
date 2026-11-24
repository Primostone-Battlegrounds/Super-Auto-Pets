/// <reference types="genshin-ts" />
import { g } from 'genshin-ts/runtime/core';

const roomClock = 'AP_RoomClock';
const roomCadence = 1; // AP_ROOM_CADENCE
const roomReplyWait = 2n; // AP_ROOM_REPLY_WAIT
const roomCapacity = 8n;
const roomWait = 5n; // AP_ROOM_WAIT
const roomPrepareTime = 60n; // AP_ROOM_PREPARE
const roomSettleTime = 10n; // AP_ROOM_SETTLE
const roomMaxTime = 2700n; // AP_ROOM_MAX_TIME
const roomMaxRounds = 40n; // AP_ROOM_MAX_ROUNDS
const roomStartingLives = 5n; // AP_ROOM_STARTING_LIVES
const roomRecoveryTime = 15n; // AP_ROOM_RECOVERY
const roomCompatibilityTier = 0n; // AP_ROOM_COMPATIBILITY_TIER
const roomCompatibilityPets = 0n; // AP_ROOM_COMPATIBILITY_PETS

const lobby = 0n;
const opening = 1n;
const preparation = 2n;
const combat = 3n;
const settlement = 4n;
const ended = 5n;

const roomLivesAt = 0n;
const roomPlacesAt = 8n;
const roomReadyAt = 16n;
const roomSequenceAt = 24n;
const roomOpponentAt = 32n;
const roomWinsAt = 40n;
const roomByesAt = 48n;
const roomBotActionsAt = 56n;
const roomRecoveryAt = 64n;

function gstsServerRoomPublic(f: ShopFlow, table: bigint[], start: bigint): bigint[] {
  return f.assemblyList([
    f.getCorrespondingValueFromList(table, start), f.getCorrespondingValueFromList(table, start + 1n),
    f.getCorrespondingValueFromList(table, start + 2n), f.getCorrespondingValueFromList(table, start + 3n),
    f.getCorrespondingValueFromList(table, start + 4n), f.getCorrespondingValueFromList(table, start + 5n),
    f.getCorrespondingValueFromList(table, start + 6n), f.getCorrespondingValueFromList(table, start + 7n),
  ], 'int');
}

function gstsServerRoomPrivate(f: ShopFlow, stock: bigint[]): bigint[] {
  const packed = f.copyList(stock);
  f.modifyValueInList(packed, shopRandomAt, 0n);
  f.modifyValueInList(packed, shopUidAt, 0n);
  return packed;
}

function gstsServerRoomFormation(f: ShopFlow, stock: bigint[]): bigint[] {
  const count = f.getCorrespondingValueFromList(stock, shopCountAt);
  const result = f.assemblyList([count], 'int');
  for (let slot = 0n; slot < count; slot += 1n) {
    const at = shopTeamAt + slot * shopUnitSize;
    f.concatenateList(result, f.assemblyList([
      f.getCorrespondingValueFromList(stock, at), f.getCorrespondingValueFromList(stock, at + 1n),
      f.getCorrespondingValueFromList(stock, at + 2n), f.getCorrespondingValueFromList(stock, at + 3n),
      f.getCorrespondingValueFromList(stock, at + 4n), f.getCorrespondingValueFromList(stock, at + 5n),
    ], 'int'));
  }
  return result;
}

function gstsServerRoomBotPlan(f: ShopFlow, stock: bigint[], seat: bigint, attempt: bigint): bigint[] {
  const teamCount = f.getCorrespondingValueFromList(stock, shopCountAt);
  const gold = f.getCorrespondingValueFromList(stock, shopGoldAt);
  const preferRelease = f.getCorrespondingValueFromList(stock, shopTierAt) > roomCompatibilityTier;
  let action = 1n;
  let from = 0n;
  let to = 0n;
  if (attempt < roomBotLimit && gold >= shopPetCost) {
    for (let probe = 0n; probe < shopPetSlots; probe += 1n) {
      const slot = (seat + attempt + probe) % shopPetSlots;
      const offer = f.getCorrespondingValueFromList(stock, shopPetsAt + slot);
      if (offer !== 0n) {
        const upgraded = preferRelease && (offer > roomCompatibilityPets || offer < 0n - roomCompatibilityPets);
        if (teamCount < shopTeamSize) {
          if (action === 1n || upgraded) {
            action = 11n;
            from = slot + 1n;
          }
        } else {
          if (upgraded && attempt === 0n) {
            // Make room through the same sell command a player uses, preserving upgraded pets.
            for (let index = 0n; index < teamCount; index += 1n) {
              const target = teamCount - 1n - index;
              const position = shopTeamAt + target * shopUnitSize;
              if (f.getCorrespondingValueFromList(stock, position) <= roomCompatibilityPets
                  && f.getCorrespondingValueFromList(stock, position + 4n) === 1n) {
                action = 13n;
                to = target + 1n;
                break;
              }
            }
          }
          if (action === 13n) break;
          for (let target = 0n; target < teamCount; target += 1n) {
            const position = shopTeamAt + target * shopUnitSize;
            const pet = f.getCorrespondingValueFromList(stock, position);
            if ((pet === offer || pet === 0n - offer)
                && f.getCorrespondingValueFromList(stock, position + 4n) < shopMaxLevel) {
              action = 12n;
              from = slot + 1n;
              to = target + 1n;
              break;
            }
          }
        }
        if (action !== 1n && (teamCount === shopTeamSize || !preferRelease || upgraded)) break;
      }
    }
  }
  if (action === 1n && attempt < roomBotLimit && teamCount > 0n && gold >= shopFoodCost) {
    for (let slot = 0n; slot < shopFoodSlots; slot += 1n) {
      if (f.getCorrespondingValueFromList(stock, shopFoodsAt + slot) !== 0n) {
        action = 16n;
        from = slot + 1n;
        to = (seat + attempt) % teamCount + 1n;
        break;
      }
    }
  }
  if (action === 1n && attempt < 4n && gold >= shopRerollCost) action = 10n;
  if (action === 1n && teamCount > 1n && attempt <= roomBotLimit) {
    const weights = f.assemblyList([0n], 'int'); // AP_ROOM_BOT_WEIGHTS
    const style = seat % (f.getListLength(weights) / 2n) * 2n;
    const attackWeight = f.getCorrespondingValueFromList(weights, style);
    const healthWeight = f.getCorrespondingValueFromList(weights, style + 1n);
    let front = 0n;
    let best = -1n;
    for (let slot = 0n; slot < teamCount; slot += 1n) {
      const at = shopTeamAt + slot * shopUnitSize;
      const score = f.getCorrespondingValueFromList(stock, at + 2n) * attackWeight
        + f.getCorrespondingValueFromList(stock, at + 3n) * healthWeight;
      if (score > best) {
        best = score;
        front = slot;
      }
    }
    if (front > 0n) {
      action = 14n;
      from = front + 1n;
      to = 1n;
    }
  }
  return f.assemblyList([action, from, to], 'int');
}

function gstsServerRoomPair(f: ShopFlow, table: bigint[], random: bigint[]): bigint[] {
  const active = f.emptyList('int');
  for (let seat = 0n; seat < roomCapacity; seat += 1n) {
    f.modifyValueInList(table, roomOpponentAt + seat, 0n);
    if (f.getCorrespondingValueFromList(table, roomLivesAt + seat) > 0n) {
      f.insertValueIntoList(active, f.getListLength(active), seat);
    }
  }
  let count = f.getListLength(active);
  for (let index = 0n; index < count - 1n; index += 1n) {
    const span = count - index;
    const other = gstsServerPackedRandom(f, random, 0n, span);
    const last = span - 1n;
    const prior = f.getCorrespondingValueFromList(active, other);
    f.modifyValueInList(active, other, f.getCorrespondingValueFromList(active, last));
    f.modifyValueInList(active, last, prior);
  }
  if (count % 2n === 1n) {
    let best = 0n;
    let byes = f.getCorrespondingValueFromList(table, roomByesAt + f.getCorrespondingValueFromList(active, 0n));
    for (let index = 1n; index < count; index += 1n) {
      const seat = f.getCorrespondingValueFromList(active, index);
      const prior = f.getCorrespondingValueFromList(table, roomByesAt + seat);
      if (prior < byes) {
        best = index;
        byes = prior;
      }
    }
    const bye = f.getCorrespondingValueFromList(active, best);
    f.modifyValueInList(table, roomByesAt + bye, byes + 1n);
    f.removeValueFromList(active, best);
    count -= 1n;
  }
  for (let index = 0n; index < count / 2n; index += 1n) {
    const left = f.getCorrespondingValueFromList(active, index * 2n);
    const right = f.getCorrespondingValueFromList(active, index * 2n + 1n);
    f.modifyValueInList(table, roomOpponentAt + left, right + 1n);
    f.modifyValueInList(table, roomOpponentAt + right, left + 1n);
  }
  return active;
}

// Return one seat at a time so ranking the eight-seat cap is bounded per tick.
function gstsServerRoomRank(f: ShopFlow, table: bigint[], priority: bigint[], force: boolean): bigint {
  let best = -1n;
  let bestLives = -1n;
  let bestWins = -1n;
  let chosen = roomCapacity;
  for (let seat = 0n; seat < roomCapacity; seat += 1n) {
    const lives = f.getCorrespondingValueFromList(table, roomLivesAt + seat);
    if ((lives === 0n || force) && f.getCorrespondingValueFromList(table, roomPlacesAt + seat) === 0n) {
      const wins = f.getCorrespondingValueFromList(table, roomWinsAt + seat);
      const tie = f.getCorrespondingValueFromList(priority, seat);
      if (lives > bestLives || (lives === bestLives && (wins > bestWins || (wins === bestWins && tie < chosen)))) {
        best = seat;
        bestLives = lives;
        bestWins = wins;
        chosen = tie;
      }
    }
  }
  return best;
}

const ranking = 6n;
const roomBotLimit = 5n;

g.server({
  id: 1073741825,
  name: '_GSTS_AP_EightRoom',
  variables: {
    owners: list('entity', []),
    table: list('int', [0n]), // AP_ROOM_TABLE
    priority: list('int', [0n]), // AP_ROOM_PRIORITY
    seeds: list('int', [0n]), // AP_ROOM_SEEDS
    random: list('int', [0n]), // AP_ROOM_RANDOM
    pairs: list('int', []),
    results: list('int', [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]),
    stocks: dict('int', 'int_list', 0),
    fightStarted: list('int', [0n, 0n, 0n, 0n]),
    fightSeeds: list('int', [0n, 0n, 0n, 0n]),
    scheduledFrame: -1n, scheduledPair: -1n, acceptedFrame: -1n,
    phase: lobby, round: 0n, revision: 0n, cursor: 0n, presenceCursor: 0n, deadline: -1n, untilEnd: -1n, lastTick: -1n,
    alive: 0n, winner: 0n, readyCount: 0n, fightCount: 0n, place: 0n, forceRank: false, broadcast: false,
  },
})
.on('whenEntityIsCreated', (event, f) => {
  f.setCustomVariable(event.eventSourceEntity, 'AP_RoomTicket', f.getRandomInteger(1n, 2147483646n), false);
  f.startTimer(event.eventSourceEntity, roomClock, true, [roomCadence]);
  f.printString('AUTO_PETS_M3 room_started');
})
.on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== roomClock) return;
  const now = f.queryGameTimeElapsed();
  if (now <= f.get('lastTick')) return;
  f.set('lastTick', now);
  let phase = f.get('phase');
  if (phase === ended) return;
  let owners = f.get('owners');
  let round = f.get('round');
  let cursor = f.get('cursor');
  let deadline = f.get('deadline');
  let readyCount = f.get('readyCount');
  let alive = f.get('alive');
  let winner = f.get('winner');
  let changed = f.get('broadcast');
  f.set('broadcast', false);
  let botSeat = -1n;
  let botPlan = f.emptyList('int');
  const stocks = f.get('stocks');
  const table = f.copyList(f.get('table'));
  const humanCount = f.getListLength(owners);
  // Sample one real connection per tick. Keep its seat during a verified entity's recovery window.
  if (phase > lobby && phase < ended && humanCount > 0n && alive > 1n) {
    const seat = f.get('presenceCursor');
    f.set('presenceCursor', (seat + 1n) % humanCount);
    if (f.getCorrespondingValueFromList(table, roomLivesAt + seat) > 0n) {
      const owner = f.getCorrespondingValueFromList(owners, seat);
      const until = f.getCorrespondingValueFromList(table, roomRecoveryAt + seat);
      if (f.queryIfEntityIsOnTheField(owner)) {
        if (until > 0n) f.modifyValueInList(table, roomRecoveryAt + seat, 0n);
      } else if (until === 0n) {
        f.modifyValueInList(table, roomRecoveryAt + seat, now + roomRecoveryTime);
      } else if (now >= until) {
        if (phase === preparation && f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 1n) readyCount -= 1n;
        f.modifyValueInList(table, roomLivesAt + seat, 0n);
        f.modifyValueInList(table, roomPlacesAt + seat, alive);
        alive -= 1n;
        changed = true;
      }
    }
  }
  if (phase > lobby && phase !== ranking && (alive === 1n || now >= f.get('untilEnd'))) {
    f.set('forceRank', true);
    f.set('place', 1n);
    phase = ranking;
    changed = true;
  } else if (phase === lobby) {
    const players = f.getListOfPlayerEntitiesOnTheField();
    const present = f.getListLength(players);
    if (present === 0n || present > roomCapacity) {
      f.set('deadline', -1n);
      return;
    }
    if (deadline < 0n) deadline = now + roomWait;
    if (present === roomCapacity || now >= deadline) {
      owners = f.copyList(players);
      f.set('owners', owners);
      for (let seat = 0n; seat < roomCapacity; seat += 1n) {
        f.modifyValueInList(table, roomLivesAt + seat, roomStartingLives);
      }
      f.set('untilEnd', now + roomMaxTime);
      alive = roomCapacity;
      round = 1n;
      phase = opening;
      changed = true;
    }
  } else if (phase === opening) {
    const seat = cursor;
    if (f.getCorrespondingValueFromList(table, roomLivesAt + seat) > 0n) {
      let stock = f.assemblyList([0n], 'int'); // AP_ROOM_EMPTY_STOCK
      if (f.queryIfDictionaryContainsSpecificKey(stocks, seat)) {
        stock = f.copyList(f.queryDictionaryValueByKey(stocks, seat));
      } else {
        f.modifyValueInList(stock, shopRandomAt, f.getCorrespondingValueFromList(f.get('seeds'), seat));
        f.modifyValueInList(stock, shopUidAt, 1n);
      }
      gstsServerShopOpen(f, stock);
      f.setOrAddKeyValuePairsToDictionary(stocks, seat, stock);
      f.set('stocks', stocks);
      f.modifyValueInList(table, roomSequenceAt + seat, 0n);
      f.modifyValueInList(table, roomReadyAt + seat, 0n);
      f.modifyValueInList(table, roomBotActionsAt + seat, 0n);
    }
    cursor += 1n;
    if (cursor === roomCapacity) {
      phase = preparation;
      cursor = 0n;
      readyCount = 0n;
      deadline = now + roomPrepareTime;
      changed = true;
    }
  } else if (phase === preparation) {
    if (now >= deadline || readyCount >= alive) {
      const random = f.copyList(f.get('random'));
      const pairings = gstsServerRoomPair(f, table, random);
      f.set('random', random);
      f.set('pairs', pairings);
      f.set('results', f.assemblyList([0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n], 'int'));
      f.set('fightStarted', f.assemblyList([0n, 0n, 0n, 0n], 'int'));
      f.set('fightSeeds', f.assemblyList([0n, 0n, 0n, 0n], 'int'));
      f.set('fightCount', f.getListLength(pairings) / 2n);
      phase = combat;
      cursor = 0n;
      changed = true;
    } else {
      const seat = cursor;
      cursor = (cursor + 1n) % roomCapacity;
      if (seat >= f.getListLength(owners) && f.getCorrespondingValueFromList(table, roomLivesAt + seat) > 0n
          && f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 0n) {
        const action = f.getCorrespondingValueFromList(table, roomBotActionsAt + seat);
        botPlan = gstsServerRoomBotPlan(f, f.queryDictionaryValueByKey(stocks, seat), seat, action);
        botSeat = seat;
      }
    }
  } else if (phase === combat) {
    let remaining = f.get('fightCount');
    const pairings = f.get('pairs');
    const results = f.copyList(f.get('results'));
    if (remaining === 0n) {
      for (let seat = 0n; seat < roomCapacity; seat += 1n) {
        const outcome = f.getCorrespondingValueFromList(results, seat);
        const lives = f.getCorrespondingValueFromList(table, roomLivesAt + seat);
        if (lives > 0n) {
          if (outcome === 1n) {
            const wins = f.getCorrespondingValueFromList(table, roomWinsAt + seat);
            f.modifyValueInList(table, roomWinsAt + seat, wins + 1n);
          } else if (outcome === 2n) {
            f.modifyValueInList(table, roomLivesAt + seat, lives - 1n);
            if (lives === 1n) alive -= 1n;
          }
        }
      }
      let force = false;
      if (alive === 1n || round >= roomMaxRounds) force = true;
      let place = alive + 1n;
      if (force) place = 1n;
      f.set('place', place);
      f.set('forceRank', force);
      phase = ranking;
      changed = true;
    } else if (f.get('acceptedFrame') >= f.get('scheduledFrame') || now - f.get('scheduledFrame') >= roomReplyWait) {
      const pair = cursor;
      cursor = (cursor + 1n) % (f.getListLength(pairings) / 2n);
      const left = f.getCorrespondingValueFromList(pairings, pair * 2n);
      const right = f.getCorrespondingValueFromList(pairings, pair * 2n + 1n);
      if (f.getCorrespondingValueFromList(results, left) === 0n) {
        const started = f.get('fightStarted');
        let seed = 0n;
        let flags = 0n;
        let first = f.emptyList('int');
        let second = f.emptyList('int');
        if (f.getCorrespondingValueFromList(table, roomLivesAt + left) === 0n) flags += 1n;
        if (f.getCorrespondingValueFromList(table, roomLivesAt + right) === 0n) flags += 2n;
        if (f.getCorrespondingValueFromList(started, pair) === 0n) {
          const seeds = f.copyList(f.get('fightSeeds'));
          seed = f.getCorrespondingValueFromList(seeds, pair);
          if (seed === 0n) {
            const random = f.copyList(f.get('random'));
            seed = gstsServerPackedRandom(f, random, 1n, shopRandomModulus - 1n) + 1n;
            f.modifyValueInList(seeds, pair, seed);
            f.set('fightSeeds', seeds);
            f.set('random', random);
          }
          first = f.queryDictionaryValueByKey(stocks, left);
          second = f.queryDictionaryValueByKey(stocks, right);
        }
        const ticket = f.getCustomVariable(event.eventSourceEntity, 'AP_RoomTicket').asType('int');
        f.set('scheduledFrame', now);
        f.set('scheduledPair', pair);
        f.sendSignal(roomFightWork, ticket, round, now, pair, flags, seed, first, second);
      }
    }
  } else if (phase === ranking) {
    const force = f.get('forceRank');
    const seat = gstsServerRoomRank(f, table, f.get('priority'), force);
    if (seat >= 0n) {
      const place = f.get('place');
      f.modifyValueInList(table, roomPlacesAt + seat, place);
      if (place === 1n) winner = seat + 1n;
      f.set('place', place + 1n);
    } else if (force) {
      phase = ended;
      alive = 1n;
      changed = true;
      f.printString('AUTO_PETS_M3 champion');
      f.printString(f.dataTypeConversion(winner, 'str'));
      f.stopTimer(event.eventSourceEntity, roomClock);
    } else {
      phase = settlement;
      deadline = now + roomSettleTime;
      changed = true;
    }
  } else if (phase === settlement && now >= deadline) {
    phase = opening;
    round += 1n;
    cursor = 0n;
    changed = true;
  }
  f.set('phase', phase);
  f.set('alive', alive);
  f.set('cursor', cursor);
  f.set('round', round);
  f.set('winner', winner);
  f.set('readyCount', readyCount);
  f.set('deadline', deadline);
  f.set('table', table);
  if (botSeat >= 0n) {
    // The stage submits a bot command through the same server handler as a human.
    const ticket = f.getCustomVariable(event.eventSourceEntity, 'AP_RoomTicket').asType('int');
    const attempt = f.getCorrespondingValueFromList(table, roomBotActionsAt + botSeat) + 1n;
    f.sendSignal(roomRequest, f.getCorrespondingValueFromList(botPlan, 0n), round, botSeat + 1n,
      f.getCorrespondingValueFromList(botPlan, 1n), f.getCorrespondingValueFromList(botPlan, 2n), ticket, attempt);
  }
  if (changed) {
    const revision = f.get('revision') + 1n;
    f.set('revision', revision);
    const lives = gstsServerRoomPublic(f, table, roomLivesAt);
    const places = gstsServerRoomPublic(f, table, roomPlacesAt);
    const opponents = gstsServerRoomPublic(f, table, roomOpponentAt);
    let seat = 0n;
    for (const player of owners) {
      if (f.queryIfEntityIsOnTheField(player)) {
        let market = f.emptyList('int');
        if (f.queryIfDictionaryContainsSpecificKey(stocks, seat)) {
          market = gstsServerRoomPrivate(f, f.queryDictionaryValueByKey(stocks, seat));
        }
        const next = f.getCorrespondingValueFromList(table, roomSequenceAt + seat) + 1n;
        const ready = f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 1n;
        f.sendSignal(roomView, player, revision, phase, round, seat + 1n, next, f.getListLength(owners), winner, ready,
          lives, places, opponents, f.get('results'), market, 0n, f.takeLargerValue(deadline - now, 0n));
      }
      seat += 1n;
    }
  }
})
.onSignal(roomRequest, (event, f) => {
  const player = event.signalSourceEntity;
  const owners = f.get('owners');
  const bot = f.equal(player, f.getSelfEntity());
  let seat = -1n;
  if (bot) {
    const ticket = f.getCustomVariable(f.getSelfEntity(), 'AP_RoomTicket').asType('int');
    seat = event.params.sequence - 1n;
    if (ticket <= 0n || ticket !== event.params.flag || seat < f.getListLength(owners) || seat >= roomCapacity) return;
  } else {
    const players = f.getListOfPlayerEntitiesOnTheField();
    let present = false;
    for (const candidate of players) {
      if (f.equal(player, candidate)) present = true;
    }
    if (!present) return;
    let index = 0n;
    for (const owner of owners) {
      if (f.equal(player, owner)) seat = index;
      index += 1n;
    }
  }
  const phase = f.get('phase');
  const round = f.get('round');
  const now = f.queryGameTimeElapsed();
  const table = f.copyList(f.get('table'));
  const stocks = f.get('stocks');
  const action = event.params.action;
  let next = 0n;
  let market = f.emptyList('int');
  let ready = false;
  if (seat >= 0n) {
    next = f.getCorrespondingValueFromList(table, roomSequenceAt + seat) + 1n;
    const lives = f.getCorrespondingValueFromList(table, roomLivesAt + seat);
    if (bot && event.params.token !== f.getCorrespondingValueFromList(table, roomBotActionsAt + seat) + 1n) return;
    let accepted = false;
    if (lives > 0n && event.params.round === round && (bot || event.params.sequence === next)) {
      if (!bot && action === 3n && phase > lobby && phase < ended) {
        const alive = f.get('alive');
        if (alive > 1n) {
          if (f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 1n) {
            f.set('readyCount', f.get('readyCount') - 1n);
          }
          f.modifyValueInList(table, roomLivesAt + seat, 0n);
          f.modifyValueInList(table, roomPlacesAt + seat, alive);
          f.set('alive', alive - 1n);
          f.set('broadcast', true);
          accepted = true;
        }
      } else if (phase === preparation && now < f.get('deadline')
          && f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 0n) {
        const stock = f.copyList(f.queryDictionaryValueByKey(stocks, seat));
        if (action === 1n && f.getCorrespondingValueFromList(stock, shopCountAt) > 0n) {
          f.modifyValueInList(table, roomReadyAt + seat, 1n);
          f.set('readyCount', f.get('readyCount') + 1n);
          accepted = true;
        } else if (action >= 10n && action <= 17n) {
          let flag = event.params.flag;
          if (bot) flag = 0n;
          accepted = gstsServerShopApply(f, stock, action, event.params.from, event.params.to, flag);
          if (accepted) {
            f.setOrAddKeyValuePairsToDictionary(stocks, seat, stock);
            f.set('stocks', stocks);
          }
          if (bot) {
            let attempt = f.getCorrespondingValueFromList(table, roomBotActionsAt + seat) + 1n;
            if (!accepted) {
              attempt = roomBotLimit;
              if (action === 14n) attempt += 1n;
            }
            f.modifyValueInList(table, roomBotActionsAt + seat, attempt);
            f.set('table', table);
          }
        }
      }
    }
    if (accepted) {
      if (!bot) f.modifyValueInList(table, roomSequenceAt + seat, next);
      f.set('table', table);
      next += 1n;
    }
    if (f.queryIfDictionaryContainsSpecificKey(stocks, seat)) {
      market = gstsServerRoomPrivate(f, f.queryDictionaryValueByKey(stocks, seat));
    }
    ready = f.getCorrespondingValueFromList(table, roomReadyAt + seat) === 1n;
  }
  if (bot) return;
  const revision = f.get('revision') + 1n;
  f.set('revision', revision);
  f.sendSignal(roomView, player, revision, phase, round, seat + 1n, next, f.getListLength(owners), f.get('winner'), ready,
    gstsServerRoomPublic(f, table, roomLivesAt), gstsServerRoomPublic(f, table, roomPlacesAt),
    gstsServerRoomPublic(f, table, roomOpponentAt), f.get('results'), market, event.params.token,
    f.takeLargerValue(f.get('deadline') - now, 0n));
})
.onSignal(roomFightDone, (event, f) => {
  const self = f.getSelfEntity();
  const ticket = f.getCustomVariable(self, 'AP_RoomTicket').asType('int');
  const frame = event.params.frame;
  const pair = event.params.pair;
  const round = event.params.round;
  const outcome = event.params.outcome;
  if (ticket <= 0n || ticket !== event.params.ticket || !f.equal(self, event.signalSourceEntity)
      || f.get('phase') !== combat || round !== f.get('round') || frame !== f.get('scheduledFrame')
      || frame <= f.get('acceptedFrame') || pair !== f.get('scheduledPair')) return;
  const pairings = f.get('pairs');
  const left = f.getCorrespondingValueFromList(pairings, pair * 2n);
  const right = f.getCorrespondingValueFromList(pairings, pair * 2n + 1n);
  const table = f.get('table');
  let flags = 0n;
  if (f.getCorrespondingValueFromList(table, roomLivesAt + left) === 0n) flags += 1n;
  if (f.getCorrespondingValueFromList(table, roomLivesAt + right) === 0n) flags += 2n;
  if (flags !== event.params.flags) return;
  const results = f.copyList(f.get('results'));
  if (f.getCorrespondingValueFromList(results, left) !== 0n) return;
  f.set('acceptedFrame', frame);
  const started = f.copyList(f.get('fightStarted'));
  if (f.getCorrespondingValueFromList(started, pair) === 0n) {
    f.modifyValueInList(started, pair, 1n);
    f.set('fightStarted', started);
  }
  const owners = f.get('owners');
  const humanCount = f.getListLength(owners);
  let seed = 0n;
  let first = f.emptyList('int');
  let second = f.emptyList('int');
  if (outcome > 0n && flags === 0n && (left < humanCount || right < humanCount)) {
    seed = f.getCorrespondingValueFromList(f.get('fightSeeds'), pair);
    const stocks = f.get('stocks');
    first = gstsServerRoomFormation(f, f.queryDictionaryValueByKey(stocks, left));
    second = gstsServerRoomFormation(f, f.queryDictionaryValueByKey(stocks, right));
  }
  for (let side = 0n; side < 2n; side += 1n) {
    const seat = f.getCorrespondingValueFromList(pairings, pair * 2n + side);
    if (seat < humanCount && f.getCorrespondingValueFromList(table, roomLivesAt + seat) > 0n) {
      const owner = f.getCorrespondingValueFromList(owners, seat);
      if (f.queryIfEntityIsOnTheField(owner)) {
        f.sendSignal(roomBoard, owner, frame, round, left + 1n, right + 1n, outcome, event.params.board);
        if (seed > 0n) f.sendSignal(roomReplay, owner, round, left + 1n, right + 1n, outcome, seed, first, second);
      }
    }
  }
  if (outcome > 0n) {
    let opposing = outcome;
    if (outcome < 3n) opposing = 3n - outcome;
    f.modifyValueInList(results, left, outcome);
    f.modifyValueInList(results, right, opposing);
    f.set('results', results);
    f.set('fightCount', f.get('fightCount') - 1n);
  }
});
