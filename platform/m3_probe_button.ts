/// <reference types="genshin-ts" />
import { defineSignal, g } from 'genshin-ts/runtime/core';

const request = defineSignal('AP_EightProbeRequest', [['path', 'int']] as const);
const button = 1073741901n; // AP_EIGHT_BUTTON

g.server({ id: 1073741826, name: '_GSTS_AP_EightProbeButton' })
.on('whenUiControlGroupIsTriggered', (event, f) => {
  if (event.uiControlGroupIndex !== button) return;
  const player = event.eventSourceEntity;
  if (f.getCustomVariable(player, 'AP_ProbeSeat').asType('int') <= 0n) return;
  const count = f.getCustomVariable(player, 'AP_ProbeNative').asType('int');
  f.setCustomVariable(player, 'AP_ProbeNative', count + 1n, false);
  f.printString('AUTO_PETS_M3_PROBE native_guid');
  f.printString(f.dataTypeConversion(event.eventSourceGuid, 'str'));
  f.sendSignal(request, 1n);
});
