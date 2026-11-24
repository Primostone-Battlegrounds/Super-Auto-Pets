/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_DuelRequest', [
  ['action', 'int'], ['round', 'int'], ['sequence', 'int'], ['token', 'int'],
  ['from', 'int'], ['to', 'int'], ['flag', 'int'],
] as const);
const refresh = 1073741901n;
const ready = 1073741902n;
const advance = 1073741903n;
const buyFirstSlot = 1073741904n;
const buySecondSlot = 1073741905n;
const buyThirdSlot = 1073741906n;
const reroll = 1073741907n;

// The player template obtains its own round and next sequence at event delivery.
// The stage checks both values again against the verified event source.
g.server({ id: 1073741826, name: '_GSTS_AP_DuelButtons' })
  .on('whenUiControlGroupIsTriggered', (event, f) => {
    let action = 0n;
    let from = 0n;
    switch (event.uiControlGroupIndex) {
      case refresh:
        break;
      case ready:
        action = 1n;
        break;
      case advance:
        action = 2n;
        break;
      case buyFirstSlot:
        action = 11n;
        from = 1n;
        break;
      case buySecondSlot:
        action = 11n;
        from = 2n;
        break;
      case buyThirdSlot:
        action = 11n;
        from = 3n;
        break;
      case reroll:
        action = 10n;
        break;
      default:
        return;
    }
    const player = f.getSelfEntity();
    const round = f.getCustomVariable(player, 'AP_shopRound').asType('int');
    const previous = f.getCustomVariable(player, 'AP_sequence').asType('int');
    f.printString('AUTO_PETS_M2 native_input');
    f.printString(f.dataTypeConversion(f.getPlayerIdByPlayerGuid(event.eventSourceGuid), 'str'));
    f.printString(f.dataTypeConversion(event.uiControlGroupIndex, 'str'));
    f.sendSignal(request, action, round, previous + 1n, 0n, from, 0n, 0n);
  });
