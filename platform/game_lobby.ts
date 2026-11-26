/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';
import { GameplayMode } from 'genshin-ts/definitions/enum';

const chooseMode = defineSignal('AP_GameChooseMode', [
  ['mode', 'int'], ['fill', 'bool'], ['requestId', 'int'],
] as const);
const lobbyView = defineSignal('client:AP_GameLobby', [
  ['player', 'entity'], ['mode', 'int'], ['present', 'int'], ['waiting', 'int'],
  ['requested', 'int'], ['reason', 'int'], ['requestId', 'int'], ['entry', 'int'],
  ['duelReason', 'int'], ['roomReason', 'int'], ['lastChoice', 'int'],
] as const);

g.server({
  id: 1073741825,
  name: '_GSTS_AP_GameLobby',
  variables: { starter: list('entity', []), logged: false },
}).onSignal(chooseMode, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  const actor = event.signalSourceEntity;
  const requestId = event.params.requestId;
  if (requestId <= 0n) return;
  let authenticated = false;
  for (const player of players) {
    if (f.equal(player, actor)) authenticated = true;
  }
  if (!authenticated) return;

  const stage = f.getSelfEntity();
  const mode = f.getCustomVariable(stage, 'AP_GameMode').asType('int');
  const requested = event.params.mode;
  let lastChoice = f.getCustomVariable(actor, 'AP_LobbyRequest').asType('int');
  const present = f.getListLength(players);
  const platform = f.queryGameModeAndPlayerNumber();
  let expected = platform.playerCount;
  if (expected < present) expected = present;
  const waiting = expected - present;
  let entry = 0n;
  if (f.enumerationsEqual(platform.playMode, GameplayMode.Play)) entry = 1n;
  if (f.enumerationsEqual(platform.playMode, GameplayMode.RoomPlay)) entry = 2n;
  if (f.enumerationsEqual(platform.playMode, GameplayMode.MatchPlay)) entry = 3n;

  // The platform room owner may be off the field. Elect a separate, visible
  // in-level starter by authenticated status query and retain them while present.
  const starter = f.get('starter');
  let hasStarter = false;
  let mayStart = false;
  if (f.getListLength(starter) > 0n) {
    const player = f.getCorrespondingValueFromList(starter, 0n);
    hasStarter = f.queryIfEntityIsOnTheField(player);
    mayStart = hasStarter && f.equal(player, actor);
  }
  if (mode === 0n && requested === 0n && !hasStarter) {
    f.set('starter', f.assemblyList([actor], 'entity'));
    mayStart = true;
  }

  let duelReason = 0n;
  let roomReason = 0n;
  if (mode !== 0n) {
    duelReason = 4n;
    roomReason = 4n;
  } else if (!mayStart) {
    duelReason = 6n;
    roomReason = 6n;
  } else {
    if (expected > 2n) duelReason = 2n;
    else if (present !== 2n) duelReason = 1n;
    if (present < 1n || expected > 8n) roomReason = 5n;
    else if (waiting > 0n) roomReason = 3n;
  }

  if (!f.get('logged')) {
    f.set('logged', true);
    f.printString('AUTO_PETS_LOBBY first_request');
  }
  if (requested === 0n) {
    f.sendSignal(lobbyView, actor, mode, present, waiting, requested, 0n,
      requestId, entry, duelReason, roomReason, lastChoice);
    return;
  }
  let reason = 5n;
  if (requestId <= lastChoice) {
    reason = 7n;
  } else {
    lastChoice = requestId;
    f.setCustomVariable(actor, 'AP_LobbyRequest', lastChoice, false);
    if (requested === 2n) reason = duelReason;
    if (requested === 8n) {
      reason = roomReason;
      if (roomReason === 3n && event.params.fill) reason = 0n;
    }
  }
  if (reason !== 0n) {
    f.printString('AUTO_PETS_LOBBY start_rejected');
    f.sendSignal(lobbyView, actor, mode, present, waiting, requested, reason,
      requestId, entry, duelReason, roomReason, lastChoice);
    return;
  }

  f.setCustomVariable(stage, 'AP_GameMode', requested, false);
  f.printString('AUTO_PETS_LOBBY start_accepted');
  for (const player of players) {
    let replyId = 0n;
    let playerChoice = f.getCustomVariable(player, 'AP_LobbyRequest').asType('int');
    if (f.equal(player, actor)) {
      replyId = requestId;
      playerChoice = lastChoice;
    }
    f.sendSignal(lobbyView, player, requested, present, waiting, requested, 0n,
      replyId, entry, 4n, 4n, playerChoice);
  }
});
