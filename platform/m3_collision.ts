/// <reference types="genshin-ts" />
import { g } from 'genshin-ts/runtime/core';

const clock = 'AP_CollisionProbe';
const pairs = 4n;
const strikeLimit = 0n; // AP_STRIKE_LIMIT

g.server({
  id: 1073741825,
  name: '_GSTS_AP_CollisionProbe',
  variables: {
    attacks: list('int', [0n]), // AP_PROBE_ATTACKS
    shields: list('int', [0n]), // AP_PROBE_SHIELDS
    health: list('int', [0n]), // AP_PROBE_HEALTH
    strikes: list('int', [0n, 0n, 0n, 0n]),
    status: list('int', [0n, 0n, 0n, 0n]),
    active: 4n, cursor: 0n, lastTick: -1n,
  },
})
.on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, clock, true, [1]);
  f.printString('AUTO_PETS_COLLISION_PROBE start');
})
.on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== clock) return;
  const now = f.queryGameTimeElapsed();
  if (now <= f.get('lastTick') || f.get('active') === 0n) return;
  f.set('lastTick', now);

  const pair = f.get('cursor');
  f.set('cursor', (pair + 1n) % pairs);
  const status = f.copyList(f.get('status'));
  if (f.getCorrespondingValueFromList(status, pair) !== 0n) return;
  const first = pair * 2n;
  const second = first + 1n;
  const attacks = f.get('attacks');
  const shields = f.copyList(f.get('shields'));
  const health = f.copyList(f.get('health'));
  const strikes = f.copyList(f.get('strikes'));
  const strike = f.getCorrespondingValueFromList(strikes, pair) + 1n;
  f.modifyValueInList(strikes, pair, strike);
  f.set('strikes', strikes);

  f.printString('AUTO_PETS_COLLISION_PROBE pair_strike');
  f.printString(f.dataTypeConversion(pair + 1n, 'str'));
  f.printString(f.dataTypeConversion(strike, 'str'));
  // Both amounts come from the committed attack array, even after one target faints.
  for (let offset = 0n; offset < 2n; offset += 1n) {
    const target = first + offset;
    const source = second - offset;
    const amount = f.getCorrespondingValueFromList(attacks, source);
    let targetShield = f.getCorrespondingValueFromList(shields, target);
    let targetHealth = f.getCorrespondingValueFromList(health, target);
    // AP_LOWERED_DAMAGE
    f.modifyValueInList(shields, target, targetShield);
    f.modifyValueInList(health, target, targetHealth);
    f.printString(f.dataTypeConversion(targetHealth, 'str'));
    f.printString(f.dataTypeConversion(targetShield, 'str'));
    f.printString(f.dataTypeConversion(remaining, 'str'));
  }
  f.set('shields', shields);
  f.set('health', health);
  const firstHealth = f.getCorrespondingValueFromList(health, first);
  const secondHealth = f.getCorrespondingValueFromList(health, second);
  let outcome = 0n;
  if (firstHealth === 0n && secondHealth === 0n) outcome = 3n;
  else if (secondHealth === 0n) outcome = 1n;
  else if (firstHealth === 0n) outcome = 2n;
  else if (strike >= strikeLimit) outcome = 4n;
  if (outcome === 0n) return;
  f.modifyValueInList(status, pair, outcome);
  f.set('status', status);
  const stillActive = f.get('active') - 1n;
  f.set('active', stillActive);
  f.printString('AUTO_PETS_COLLISION_PROBE pair_outcome');
  f.printString(f.dataTypeConversion(pair + 1n, 'str'));
  f.printString(f.dataTypeConversion(outcome, 'str'));
  if (stillActive === 0n) {
    f.stopTimer(event.eventSourceEntity, clock);
    f.printString('AUTO_PETS_COLLISION_PROBE done');
  }
});
