/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [['action', 'int'], ['round', 'int']] as const);
const refresh = 1073741901n;
const readyFirstRound = 1073741902n;
const continueFirstRound = 1073741903n;
const readySecondRound = 1073741904n;

g.server({ id: 1073741826, name: '_GSTS_AP_DuelButtons' })
  .on('whenUiControlGroupIsTriggered', (event, f) => {
    let action = 0n;
    let round = 0n;
    // These IDs are populated with the records returned by scene_add_button.
    // A delayed press for the first round cannot apply to the second round.
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
      default:
        return;
    }
    // This graph is attached to the player prefab. The Send Signal node
    // supplies its owning player as source without carrying one in the payload.
    f.printString('AUTO_PETS_M2 native_input');
    f.printString(f.dataTypeConversion(f.getPlayerIdByPlayerGuid(event.eventSourceGuid), 'str'));
    f.printString(f.dataTypeConversion(event.uiControlGroupIndex, 'str'));
    f.sendSignal(request, action, round);
  });
