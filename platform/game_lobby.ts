/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const chooseMode = defineSignal('AP_GameChooseMode', [['mode', 'int'], ['fill', 'bool']] as const);
const lobbyView = defineSignal('client:AP_GameLobby', [
  ['player', 'entity'], ['mode', 'int'], ['present', 'int'], ['waiting', 'int'],
  ['requested', 'int'], ['reason', 'int'],
] as const);

g.server({
  id: 1073741825,
  name: '_GSTS_AP_GameLobby',
  variables: {},
}).onSignal(chooseMode, (event, f) => {
  const players = f.getListOfPlayerEntitiesOnTheField();
  const actor = event.signalSourceEntity;
  let authenticated = false;
  for (const player of players) {
    if (f.equal(player, actor)) authenticated = true;
  }
  if (!authenticated) return;

  const present = f.getListLength(players);
  let expected = f.queryGameModeAndPlayerNumber().playerCount;
  if (expected < present) expected = present;
  const requested = event.params.mode;
  const stage = f.getSelfEntity();
  let mode = f.getCustomVariable(stage, 'AP_GameMode').asType('int');
  const canStartDuel = requested === 2n && present === 2n && expected === 2n;
  const canStartRoom = requested === 8n && present >= 1n && present <= 8n && (expected === present || event.params.fill);
  if (mode === 0n && (canStartDuel || canStartRoom)) {
    mode = requested;
    f.setCustomVariable(stage, 'AP_GameMode', mode, false);
    for (const player of players) f.sendSignal(lobbyView, player, mode, present, expected - present, requested, 0n);
  } else {
    // Refusal is explicit; a status query never changes the selected authority.
    let reason = 0n;
    if (requested !== 0n && requested !== mode) {
      if (mode !== 0n) reason = 4n;
      else if (requested === 2n) {
        if (present > 2n || expected > 2n) reason = 2n;
        else reason = 1n;
      } else if (requested === 8n && present >= 1n && present <= 8n) reason = 3n;
      else reason = 5n;
    }
    f.sendSignal(lobbyView, actor, mode, present, expected - present, requested, reason);
  }
});
