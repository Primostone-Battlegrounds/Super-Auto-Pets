const probeClock = 'AP_ShopProofClock';
const probeStride = 6n;
const probeModulus = 524287n;
const probeCount = 0n; // AP_SHOP_PROBE_COUNT

g.server({
  id: 1073741825,
  name: '_GSTS_AP_VersusShopProof',
  variables: { state: [0n], step: 0n, slice: 0n, digest: 1n }, // AP_SHOP_PROBE_START
}).on('whenEntityIsCreated', (event, f) => {
  f.startTimer(event.eventSourceEntity, probeClock, true, [1]);
}).on('whenTimerIsTriggered', (event, f) => {
  if (event.timerName !== probeClock) return;
  const program = f.assemblyList([0n], 'int'); // AP_SHOP_PROBE_PROGRAM
  const index = f.get('step') * probeStride;
  const slice = f.get('slice');
  if (slice === 0n) {
    const action = f.getCorrespondingValueFromList(program, index);
    const state = f.copyList(f.get('state'));
    let accepted = true;
    if (action === 0n) gstsServerShopOpen(f, state);
    else {
      accepted = gstsServerShopApply(f, state, action,
        f.getCorrespondingValueFromList(program, index + 1n),
        f.getCorrespondingValueFromList(program, index + 2n),
        f.getCorrespondingValueFromList(program, index + 3n));
    }
    if (accepted !== (f.getCorrespondingValueFromList(program, index + 4n) === 1n)) {
      f.printString('AUTO_PETS_SHOP acceptance_mismatch');
      f.stopTimer(f.getSelfEntity(), probeClock);
      return;
    }
    f.set('state', state);
    f.set('slice', 1n);
    f.set('digest', 1n);
    return;
  }

  const state = f.get('state');
  const size = f.getListLength(state);
  const start = (slice - 1n) * 8n;
  let end = start + 8n;
  if (end > size) end = size;
  let digest = f.get('digest');
  for (let slot = start; slot < end; slot += 1n) {
    let value = f.getCorrespondingValueFromList(state, slot) % probeModulus;
    if (value < 0n) value += probeModulus;
    digest = (digest * 31n + value) % probeModulus;
  }
  if (end < size) {
    f.set('digest', digest);
    f.set('slice', slice + 1n);
    return;
  }
  if (digest !== f.getCorrespondingValueFromList(program, index + 5n)) {
    f.printString('AUTO_PETS_SHOP state_mismatch');
    f.stopTimer(f.getSelfEntity(), probeClock);
    return;
  }
  f.printString('AUTO_PETS_SHOP confirmed_step');
  f.printString(f.dataTypeConversion(f.get('step') + 1n, 'str'));
  if (f.get('step') + 1n === probeCount) {
    f.printString('AUTO_PETS_SHOP verified');
    f.stopTimer(f.getSelfEntity(), probeClock);
  } else {
    f.set('step', f.get('step') + 1n);
    f.set('slice', 0n);
  }
});
