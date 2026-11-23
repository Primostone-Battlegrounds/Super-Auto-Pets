/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [['action', 'int'], ['round', 'int']] as const);
const refresh = 1073741901n;
const readyFirstRound = 1073741902n;
const continueFirstRound = 1073741903n;
const readySecondRound = 1073741904n;
const buyFirstRoundSlot1 = 1073741905n;
const buyFirstRoundSlot2 = 1073741906n;
const buyFirstRoundSlot3 = 1073741907n;
const buySecondRoundSlot1 = 1073741908n;
const buySecondRoundSlot2 = 1073741909n;
const buySecondRoundSlot3 = 1073741910n;

g.server({ id: 1073741826, name: '_GSTS_AP_DuelButtons' })
  .on('whenUiControlGroupIsTriggered', (event, f) => {
    let action = 0n;
    let round = 0n;
    // IDs come from scene_add_button. Round-specific keys cannot buy from a later shop.
    switch (event.uiControlGroupIndex) {
      case refresh:
        break;
      case readyFirstRound:
        action = 1n;
        round = 1n;
        break;
      case continueFirstRound:
        action = 2n;
        round = 1n;
        break;
      case readySecondRound:
        action = 1n;
        round = 2n;
        break;
      case buyFirstRoundSlot1:
        action = 3n;
        round = 1n;
        break;
      case buyFirstRoundSlot2:
        action = 4n;
        round = 1n;
        break;
      case buyFirstRoundSlot3:
        action = 5n;
        round = 1n;
        break;
      case buySecondRoundSlot1:
        action = 3n;
        round = 2n;
        break;
      case buySecondRoundSlot2:
        action = 4n;
        round = 2n;
        break;
      case buySecondRoundSlot3:
        action = 5n;
        round = 2n;
        break;
      default:
        return;
    }
    // The runtime provides the graph's owning player as signal source.
    f.printString('AUTO_PETS_M2 native_input');
    f.printString(f.dataTypeConversion(f.getPlayerIdByPlayerGuid(event.eventSourceGuid), 'str'));
    f.printString(f.dataTypeConversion(event.uiControlGroupIndex, 'str'));
    f.sendSignal(request, action, round);
  });
