import assert from 'node:assert/strict';
import vm from 'node:vm';
import { shopExport } from '../../platform/versus-shop.mjs';

function readAt(list, index, includeEnd = false) {
  assert.ok(index >= 0n && index < list.length + (includeEnd ? 1 : 0), `list index ${index} outside length ${list.length}`);
  return Number(index);
}

export const shopFlow = {
  assemblyList: list => Array.from(list),
  copyList: list => Array.from(list),
  getCorrespondingValueFromList: (list, index) => list[readAt(list, index)],
  getListLength: list => BigInt(list.length),
  modifyValueInList: (list, index, value) => { list[readAt(list, index)] = value; },
  removeValueFromList: (list, index) => { list.splice(readAt(list, index), 1); },
  insertValueIntoList: (list, index, value) => { list.splice(readAt(list, index, true), 0, value); },
  initLocalVariable: (_type, value) => ({ value }),
};

export function verifyShop(ts, source, lua, lua54 = 'lua5.4') {
  const expected = shopExport(lua, 'trace');
  assert.equal(shopExport(lua54, 'trace'), expected);
  const compiled = ts.transpileModule(`${source}\nmodule.exports = { gstsServerShopApply, gstsServerShopOpen };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  const { gstsServerShopApply: apply, gstsServerShopOpen: open } = module.exports;
  const actions = {};
  const maxExplicitCalls = {};
  let calls = 0;
  const measuredFlow = Object.fromEntries(Object.entries(shopFlow).map(([name, run]) => [name, (...args) => {
    calls += 1;
    return run(...args);
  }]));
  function recordCalls(action) {
    maxExplicitCalls[action] = Math.max(maxExplicitCalls[action] ?? 0, calls);
    calls = 0;
  }
  let state;
  let initializations = 0;
  let openings = 0;
  for (const [lineNumber, line] of expected.trimEnd().split('\n').entries()) {
    const [kind, ...fields] = line.split('\t');
    const values = fields.map(BigInt);
    if (kind === 'init') {
      state = values;
      initializations += 1;
    } else if (kind === 'open') {
      open(measuredFlow, state);
      assert.deepEqual(state, values, `open line ${lineNumber + 1}`);
      openings += 1;
      recordCalls('open');
    } else {
      assert.equal(kind, 'apply');
      const [action, from, to, flag, accepted, ...trace] = values;
      const result = apply(measuredFlow, state, action, from, to, flag);
      assert.equal(result, accepted === 1n, `action ${action} result line ${lineNumber + 1}`);
      assert.deepEqual(state, trace, `action ${action} state line ${lineNumber + 1}`);
      actions[action] ??= { accepted: 0, rejected: 0 };
      actions[action][result ? 'accepted' : 'rejected'] += 1;
      recordCalls(action);
    }
  }
  assert.equal(Object.keys(actions).length, 8);
  assert.ok(Object.values(actions).every(action => action.accepted > 0 && action.rejected > 0));
  return { initializations, openings, actions, maxExplicitCalls };
}
